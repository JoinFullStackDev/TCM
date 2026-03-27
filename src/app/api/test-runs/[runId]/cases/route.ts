import { NextResponse } from 'next/server';
import { withAuth, validationError, serverError } from '@/lib/api/helpers';
import { addCasesSchema, removeCasesSchema } from '@/lib/validations/test-run';

interface RouteContext {
  params: Promise<{ runId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { runId } = await context.params;

  const { data, error } = await supabase
    .from('test_run_cases')
    .select(`
      *,
      test_cases:test_case_id(
        id, display_id, title, platform_tags, deleted_at,
        suites:suite_id(prefix, name)
      )
    `)
    .eq('test_run_id', runId);

  if (error) return serverError(error.message);
  // Note: test_cases join may return a deleted case (deleted_at IS NOT NULL) — this is
  // intentional for historical run results. The [Deleted] badge is shown in the UI.
  // UNFILTERED_SCOPE — run history reads joined test_cases regardless of deleted_at

  const enriched = await Promise.all(
    (data ?? []).map(async (trc) => {
      const { data: results } = await supabase
        .from('execution_results')
        .select('platform, status')
        .eq('test_run_id', runId)
        .eq('test_case_id', trc.test_case_id);

      const platformStatus: Record<string, string> = {};
      for (const r of results ?? []) {
        const current = platformStatus[r.platform];
        if (!current || statusPriority(r.status) > statusPriority(current)) {
          platformStatus[r.platform] = r.status;
        }
      }

      return { ...trc, platform_status: platformStatus };
    }),
  );

  return NextResponse.json(enriched);
}

function statusPriority(status: string): number {
  const map: Record<string, number> = { pass: 0, not_run: 1, skip: 2, blocked: 3, fail: 4 };
  return map[status] ?? 0;
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { runId } = await context.params;

  const body = await request.json();
  const parsed = addCasesSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const trcRows = parsed.data.test_case_ids.map((tcId) => ({
    test_run_id: runId,
    test_case_id: tcId,
    overall_status: 'not_run' as const,
  }));

  const { error: trcError } = await supabase
    .from('test_run_cases')
    .upsert(trcRows, { onConflict: 'test_run_id,test_case_id' });

  if (trcError) return serverError(trcError.message);

  for (const tcId of parsed.data.test_case_ids) {
    // Only query active test cases (soft-delete safe)
    const { data: tc } = await supabase
      .from('test_cases')
      .select('id, title, platform_tags')
      .eq('id', tcId)
      .is('deleted_at', null) // active scope
      .single();

    if (!tc) continue;

    const { data: steps } = await supabase
      .from('test_steps')
      .select('id, step_number, description, test_data, expected_result, is_automation_only')
      .eq('test_case_id', tcId)
      .order('step_number', { ascending: true });

    const stepsSnapshot = steps ?? [];

    // Snapshot title + steps into run_test_cases so the run engine never
    // re-queries live test_cases after the run starts.
    await supabase
      .from('test_run_cases')
      .update({
        snapshot_title: tc.title,
        snapshot_steps: stepsSnapshot,
      })
      .eq('test_run_id', runId)
      .eq('test_case_id', tcId);

    if (stepsSnapshot.length === 0) continue;

    const platforms = (tc.platform_tags as string[]) ?? ['desktop'];
    const erRows = stepsSnapshot.flatMap((step) =>
      platforms.map((platform) => ({
        test_run_id: runId,
        test_case_id: tcId,
        test_step_id: step.id,
        platform,
        browser: 'default',
        status: 'not_run' as const,
      })),
    );

    if (erRows.length > 0) {
      await supabase
        .from('execution_results')
        .upsert(erRows, { onConflict: 'test_run_id,test_step_id,platform,browser' });
    }
  }

  return NextResponse.json({ success: true }, { status: 201 });
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { runId } = await context.params;

  const body = await request.json();
  const parsed = removeCasesSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  for (const tcId of parsed.data.test_case_ids) {
    await supabase
      .from('execution_results')
      .delete()
      .eq('test_run_id', runId)
      .eq('test_case_id', tcId);
  }

  const { error } = await supabase
    .from('test_run_cases')
    .delete()
    .eq('test_run_id', runId)
    .in('test_case_id', parsed.data.test_case_ids);

  if (error) return serverError(error.message);

  return NextResponse.json({ success: true });
}
