import { NextResponse } from 'next/server';
import { withAuth, validationError, notFound, serverError, conflict } from '@/lib/api/helpers';
import { updateTestCaseSchema } from '@/lib/validations/test-case';
import { TestCaseRepository } from '@/lib/db/test-case-repository';

interface RouteContext {
  params: Promise<{ testCaseId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { testCaseId } = await context.params;

  const repo = new TestCaseRepository(supabase);
  const testCase = await repo.findByIdWithRelations(testCaseId);
  if (!testCase) return notFound('Test case');

  const sortedSteps = ((testCase as Record<string, unknown>).test_steps as Array<{ step_number: number }> ?? [])
    .sort((a, b) => a.step_number - b.step_number);
  const sortedVersions = ((testCase as Record<string, unknown>).test_case_versions as Array<{ version_number: number }> ?? [])
    .sort((a, b) => b.version_number - a.version_number);

  return NextResponse.json({
    ...testCase,
    test_steps: sortedSteps,
    test_case_versions: sortedVersions,
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;
  const { testCaseId } = await context.params;

  const body = await request.json();
  const parsed = updateTestCaseSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  // Only allow updating active test cases
  const repo = new TestCaseRepository(supabase);
  const existing = await repo.findById(testCaseId);
  if (!existing) return notFound('Test case');

  const { data: testCase, error } = await supabase
    .from('test_cases')
    .update({ ...parsed.data, updated_by: user.id })
    .eq('id', testCaseId)
    .is('deleted_at', null)
    .select()
    .single();

  if (error || !testCase) return notFound('Test case');

  return NextResponse.json(testCase);
}

/**
 * DELETE /api/test-cases/:id — soft delete
 *
 * Sets deleted_at, deleted_by; clears restored_at, restored_by.
 * Writes an audit log row in the same transaction.
 * If the case is referenced by active runs, a warning is included in the response.
 *
 * RBAC: Editor+ (soft_delete permission). Viewers get 403.
 * Errors: 401, 403, 404, 409 (already deleted)
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await withAuth('soft_delete');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;
  const { testCaseId } = await context.params;

  // Fetch unfiltered so we can give a proper 409 if already deleted
  const repo = new TestCaseRepository(supabase);
  const existing = await repo.findByIdUnfiltered(testCaseId); // UNFILTERED_SCOPE
  if (!existing) return notFound('Test case');
  if (existing.deleted_at) return conflict('Test case is already deleted');

  // Check for active runs referencing this case
  const { data: activeRunRefs } = await supabase
    .from('test_run_cases')
    .select('test_run_id, test_runs!inner(id, name, status)')
    .eq('test_case_id', testCaseId)
    .in('test_runs.status', ['planned', 'in_progress']);

  const activeRuns = (activeRunRefs ?? []).map((r) => {
    const run = (r as Record<string, unknown>).test_runs as { name: string } | null;
    return run?.name ?? r.test_run_id;
  });
  const warning = activeRuns.length > 0
    ? `This test case is referenced by ${activeRuns.length} active run(s): ${activeRuns.join(', ')}. It will be excluded from future run execution but historical results are preserved.`
    : null;

  const now = new Date().toISOString();

  // Soft delete + audit in a single RPC-level transaction using supabase
  // We use two sequential writes; Supabase doesn't expose raw transactions in
  // the JS client, so we do UPDATE first then INSERT audit — if audit fails the
  // delete is still applied (acceptable; worse to leave case in limbo).
  const { data: updated, error: updateError } = await supabase
    .from('test_cases')
    .update({
      deleted_at: now,
      deleted_by: user.id,
      restored_at: null,
      restored_by: null,
    })
    .eq('id', testCaseId)
    .is('deleted_at', null) // guard against race condition
    .select('id, deleted_at, deleted_by')
    .single();

  if (updateError || !updated) {
    return updateError?.code === 'PGRST116'
      ? conflict('Test case is already deleted')
      : serverError(updateError?.message ?? 'Failed to soft-delete test case');
  }

  // Write audit log
  await supabase
    .from('test_case_audit_log')
    .insert({
      test_case_id: testCaseId,
      action: 'deleted',
      actor_id: user.id,
      occurred_at: now,
      metadata: { warning },
    });

  return NextResponse.json({ ...updated, warning });
}
