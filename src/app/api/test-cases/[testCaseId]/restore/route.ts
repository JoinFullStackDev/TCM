import { NextResponse } from 'next/server';
import { withAuth, notFound, serverError, conflict } from '@/lib/api/helpers';
import { TestCaseRepository } from '@/lib/db/test-case-repository';

interface RouteContext {
  params: Promise<{ testCaseId: string }>;
}

/**
 * POST /api/test-cases/:id/restore — restore a soft-deleted test case
 *
 * Sets restored_at, restored_by; clears deleted_at, deleted_by.
 * Writes an audit log row in the same operation.
 *
 * RBAC: Editor+ (soft_delete permission). Viewers get 403.
 * Errors: 401, 403, 404, 409 (already active)
 */
export async function POST(_request: Request, context: RouteContext) {
  const auth = await withAuth('soft_delete');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;
  const { testCaseId } = await context.params;

  const repo = new TestCaseRepository(supabase);

  // UNFILTERED_SCOPE — we need to check deleted_at to decide if restore is valid
  const existing = await repo.findByIdUnfiltered(testCaseId); // UNFILTERED_SCOPE
  if (!existing) return notFound('Test case');
  if (!existing.deleted_at) return conflict('Test case is already active');

  const now = new Date().toISOString();

  // Compute next position: append at MAX(active position) + 1 for the suite
  const { data: maxPosRow } = await supabase
    .from('test_cases')
    .select('position')
    .eq('suite_id', existing.suite_id)
    .is('deleted_at', null)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = ((maxPosRow?.position as number | null) ?? 0) + 1;

  const { data: restored, error: updateError } = await supabase
    .from('test_cases')
    .update({
      deleted_at: null,
      deleted_by: null,
      restored_at: now,
      restored_by: user.id,
      position: nextPosition,
    })
    .eq('id', testCaseId)
    .not('deleted_at', 'is', null) // guard against race condition
    .select('id, restored_at, restored_by, position')
    .single();

  if (updateError || !restored) {
    return updateError?.code === 'PGRST116'
      ? conflict('Test case is already active')
      : serverError(updateError?.message ?? 'Failed to restore test case');
  }

  // Write audit log
  await supabase
    .from('test_case_audit_log')
    .insert({
      test_case_id: testCaseId,
      action: 'restored',
      actor_id: user.id,
      occurred_at: now,
      metadata: {},
    });

  return NextResponse.json(restored);
}
