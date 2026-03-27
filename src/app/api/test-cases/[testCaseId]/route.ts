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

/**
 * PATCH /api/test-cases/:id — update a test case
 *
 * ID mutability gate: if automation_status is 'in_cicd' and display_id is being
 * changed, return 403. Changing the ID of an automated test risks breaking pipelines.
 */
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

  // ID mutability gate: block display_id change for in-CICD automated tests
  if (parsed.data.display_id !== undefined && existing.automation_status === 'in_cicd') {
    return NextResponse.json(
      { error: 'This test is used in automation — ID is locked. Remove it from CI/CD before changing the ID.' },
      { status: 403 },
    );
  }

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
 * DELETE /api/test-cases/:id
 *
 * Without ?hard=true: soft delete (archive).
 *   - Sets deleted_at, deleted_by; clears restored_at, restored_by.
 *   - Renormalizes remaining active positions in the suite.
 *   - Returns warning if case is in active runs.
 *   - If is_automated (in_cicd) and no ?confirm=true: returns
 *     { confirmation_required: true, warning: "..." } with status 200.
 *     Client should re-call with ?confirm=true to proceed.
 *
 * With ?hard=true: permanent delete.
 *   - Only allowed on already-archived (deleted_at IS NOT NULL) records.
 *   - If is_automated (in_cicd), requires ?confirm=true.
 *   - Irreversible.
 *
 * RBAC: Editor+ (soft_delete). Viewers get 403.
 */
export async function DELETE(request: Request, context: RouteContext) {
  const auth = await withAuth('soft_delete');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;
  const { testCaseId } = await context.params;

  const { searchParams } = new URL(request.url);
  const hard = searchParams.get('hard') === 'true';
  const confirm = searchParams.get('confirm') === 'true';

  const repo = new TestCaseRepository(supabase);
  const existing = await repo.findByIdUnfiltered(testCaseId); // UNFILTERED_SCOPE
  if (!existing) return notFound('Test case');

  // ── Hard delete ──────────────────────────────────────────────────────────
  if (hard) {
    if (!existing.deleted_at) {
      return NextResponse.json(
        { error: 'Hard delete is only allowed on archived (trashed) test cases. Archive it first.' },
        { status: 400 },
      );
    }

    // Extra confirmation required for automated tests
    if (existing.automation_status === 'in_cicd' && !confirm) {
      return NextResponse.json(
        {
          confirmation_required: true,
          warning: 'This test is used in automation. Permanently deleting it may break your CI/CD pipeline. This cannot be undone.',
        },
        { status: 200 },
      );
    }

    const { error: deleteError } = await supabase
      .from('test_cases')
      .delete()
      .eq('id', testCaseId)
      .not('deleted_at', 'is', null); // guard: only delete archived records

    if (deleteError) return serverError(deleteError.message);

    return NextResponse.json({ deleted: true, id: testCaseId });
  }

  // ── Soft delete (archive) ─────────────────────────────────────────────────
  if (existing.deleted_at) return conflict('Test case is already deleted');

  // Automation warning gate — return confirmation_required if in_cicd and not confirmed
  if (existing.automation_status === 'in_cicd' && !confirm) {
    return NextResponse.json(
      {
        confirmation_required: true,
        warning: 'This test is used in automation. Archiving it may break your CI/CD pipeline. Continue?',
      },
      { status: 200 },
    );
  }

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
  const suiteId = existing.suite_id;

  // Soft delete
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

  // Renormalize positions for remaining active test cases in the suite
  await renormalizePositions(supabase, suiteId);

  return NextResponse.json({ ...updated, warning });
}

/**
 * Renormalize positions for all active test cases in a suite.
 * Assigns sequential 1-based positions ordered by current position ASC.
 * Uses parallel updates — safe because the partial UNIQUE index only applies
 * to active records and we preserve relative order.
 */
async function renormalizePositions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  suiteId: string,
): Promise<void> {
  const { data: activeCases } = await supabase
    .from('test_cases')
    .select('id, position')
    .eq('suite_id', suiteId)
    .is('deleted_at', null)
    .order('position', { ascending: true });

  if (!activeCases || activeCases.length === 0) return;

  // Assign new sequential positions; skip if already correct to avoid unnecessary writes
  const updates = activeCases
    .map((tc: { id: string; position: number }, i: number) => ({ id: tc.id, newPos: i + 1, oldPos: tc.position }))
    .filter(({ newPos, oldPos }: { newPos: number; oldPos: number }) => newPos !== oldPos)
    .map(({ id, newPos }: { id: string; newPos: number }) =>
      supabase
        .from('test_cases')
        .update({ position: newPos })
        .eq('id', id)
        .is('deleted_at', null),
    );

  if (updates.length > 0) {
    await Promise.all(updates);
  }
}
