import { NextResponse } from 'next/server';
import { withAuth, validationError, serverError, notFound, conflict } from '@/lib/api/helpers';
import { createServiceClient } from '@/lib/supabase/server';
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

  // Optimistic concurrency check (only if client sent a version).
  //
  // IMPORTANT: uses the service-role client, NOT the user/anon client.
  //
  // Root cause of the production 500: the user client created by `withAuth`
  // relies on the authenticated JWT being present in the PostgREST request.
  // In Next.js App Router, cookie propagation can lag or fail for PATCH
  // requests, causing the query to run as the `anon` role. The `suites_select`
  // RLS policy only grants SELECT to `authenticated`, so `anon` sees 0 rows.
  // `.single()` then returns PGRST116 → `suiteErr` is set → handler returns
  // 500 with "Suite not found".
  //
  // The service-role client bypasses RLS entirely and always resolves the row,
  // making the version check reliable. The RPC (reorder_test_cases) already
  // runs as SECURITY DEFINER for the same reason — this aligns the pre-flight
  // check with the same security posture.
  if (version !== undefined) {
    const serviceClient = await createServiceClient();
    const { data: suite, error: suiteErr } = await serviceClient
      .from('suites')
      .select('reorder_version')
      .eq('id', suiteId)
      .single();

    if (suiteErr || !suite) return notFound('Suite');

    const currentVersion = (suite as Record<string, unknown>).reorder_version as number ?? 0;

    if (currentVersion !== version) {
      return conflict(
        `Reorder conflict: suite was modified concurrently (expected version ${version}, current ${currentVersion}). Reload and retry.`,
      );
    }
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
