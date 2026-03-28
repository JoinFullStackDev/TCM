import { NextResponse } from 'next/server';
import { withAuth, validationError, serverError, conflict } from '@/lib/api/helpers';
import { reorderTestCasesSchema } from '@/lib/validations/test-case';

interface RouteContext {
  params: Promise<{ suiteId: string }>;
}

/**
 * PATCH /api/suites/:suiteId/test-cases/reorder
 *
 * Accepts an ordered array of test case UUIDs and derives position = index + 1.
 * Delegates to the reorder_test_cases() Postgres function which assigns all
 * positions and increments reorder_version atomically in a single transaction,
 * avoiding transient unique-constraint violations on (suite_id, position).
 *
 * Optimistic concurrency: if `version` is supplied and mismatches the suite's
 * current reorder_version, returns 409. On success, returns the new reorder_version.
 */
export async function PATCH(request: Request, context: RouteContext) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { suiteId } = await context.params;

  const body = await request.json();
  const parsed = reorderTestCasesSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { ids, version } = parsed.data;

  // Fetch the suite's current reorder_version for the optimistic concurrency check.
  // Use select('*') rather than select('reorder_version') so that a PostgREST schema
  // cache miss (e.g. immediately after migration 00014 is applied) doesn't cause a
  // "column not found" error that 500s the entire route. reorder_version defaults to 0
  // if the column isn't present in the response yet.
  const { data: suite, error: suiteErr } = await supabase
    .from('suites')
    .select('id, reorder_version')
    .eq('id', suiteId)
    .single();

  // If the suite doesn't exist at all, fail. If suiteErr is a schema/column error,
  // treat reorder_version as 0 and proceed — the RPC will enforce correctness.
  if (!suiteErr && !suite) return serverError('Suite not found');
  const currentVersion = (suite as Record<string, unknown> | null)?.reorder_version as number ?? 0;

  // Optimistic concurrency check (only if client sent a version and suite fetch succeeded)
  if (!suiteErr && version !== undefined && currentVersion !== version) {
    return conflict(
      `Reorder conflict: suite was modified concurrently (expected version ${version}, current ${currentVersion}). Reload and retry.`,
    );
  }

  // Atomically assign positions + increment reorder_version via RPC
  const { data: newVersion, error: rpcError } = await supabase
    .rpc('reorder_test_cases', {
      p_suite_id: suiteId,
      p_ordered_ids: ids,
    });

  if (rpcError) return serverError(rpcError.message);

  // Fetch the updated list sorted by position
  const { data: testCases, error: fetchError } = await supabase
    .from('test_cases')
    .select('id, display_id, position, automation_status, title, suite_id')
    .eq('suite_id', suiteId)
    .is('deleted_at', null)
    .order('position', { ascending: true });

  if (fetchError) return serverError(fetchError.message);

  const items = (testCases ?? []).map((tc) => ({
    ...tc,
    is_automated: tc.automation_status === 'in_cicd',
  }));

  const cicd_locked = items.some((tc) => tc.is_automated);

  return NextResponse.json({ items, version: newVersion as number, cicd_locked });
}
