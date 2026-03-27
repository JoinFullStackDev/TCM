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
 * Writes positions in parallel, all scoped to suite_id.
 * Returns the full updated list sorted by position ASC plus the new reorder_version.
 *
 * Optimistic concurrency: if `version` is supplied and mismatches the suite's
 * current reorder_version, returns 409. On success, increments reorder_version.
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

  // Fetch the suite's current reorder_version (always needed to increment)
  const { data: suite, error: suiteErr } = await supabase
    .from('suites')
    .select('reorder_version')
    .eq('id', suiteId)
    .single();

  if (suiteErr || !suite) return serverError('Suite not found');
  const currentVersion = (suite as Record<string, unknown>).reorder_version as number ?? 0;

  // Optimistic concurrency check (only if client sent a version)
  if (version !== undefined && currentVersion !== version) {
    return conflict(
      `Reorder conflict: suite was modified concurrently (expected version ${version}, current ${currentVersion}). Reload and retry.`,
    );
  }

  // Write positions in parallel — each update is scoped to suite_id for safety
  const updates = ids.map((id, index) =>
    supabase
      .from('test_cases')
      .update({ position: index + 1 })
      .eq('id', id)
      .eq('suite_id', suiteId)
      .is('deleted_at', null),
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) return serverError(failed.error.message);

  const nextVersion = currentVersion + 1;

  // Increment reorder_version and fetch updated list in parallel
  const [, fetchResult] = await Promise.all([
    supabase
      .from('suites')
      .update({ reorder_version: nextVersion })
      .eq('id', suiteId),
    supabase
      .from('test_cases')
      .select('id, display_id, position, automation_status, title, suite_id')
      .eq('suite_id', suiteId)
      .is('deleted_at', null)
      .order('position', { ascending: true }),
  ]);

  if (fetchResult.error) return serverError(fetchResult.error.message);

  const items = (fetchResult.data ?? []).map((tc) => ({
    ...tc,
    is_automated: tc.automation_status === 'in_cicd',
  }));

  return NextResponse.json({ items, version: nextVersion });
}
