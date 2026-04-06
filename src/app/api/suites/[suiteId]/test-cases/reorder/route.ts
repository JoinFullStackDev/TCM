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
  const { suiteId } = await context.params;

  const body = await request.json();
  const parsed = reorderTestCasesSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { ids, version } = parsed.data;

  // All DB operations on this route use the service-role client.
  //
  // Root cause of the production 500: the user client created by `withAuth`
  // relies on the authenticated JWT being present in PostgREST requests.
  // In Next.js App Router, cookie propagation can lag or fail for PATCH
  // requests, causing queries to run as the `anon` role. Two problems result:
  //
  //   1. `suites_select` RLS policy only grants SELECT to `authenticated` →
  //      `anon` sees 0 rows → `.single()` returns PGRST116 → "Suite not found"
  //
  //   2. `reorder_test_cases` RPC is SECURITY DEFINER (runs as owner), but
  //      the *caller* still needs EXECUTE permission. `anon` role was never
  //      granted EXECUTE, so PostgREST returns an error before the function
  //      even runs.
  //
  // Auth is already verified above via `withAuth`. Using the service-role
  // client here is safe — it bypasses RLS and permission checks while keeping
  // all business logic (CICD locking, display_id renumbering) inside the
  // SECURITY DEFINER RPC where it belongs.
  const serviceClient = await createServiceClient();

  // Optimistic concurrency check (only if client sent a version).
  if (version !== undefined) {
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
  const { data: newVersion, error: rpcError } = await serviceClient
    .rpc('reorder_test_cases', {
      p_suite_id: suiteId,
      p_ordered_ids: ids,
    });

  if (rpcError) return serverError(rpcError.message);

  // Fetch the updated list sorted by position
  const { data: testCases, error: fetchError } = await serviceClient
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
