import { NextResponse } from 'next/server';
import { withAuth, notFound, serverError } from '@/lib/api/helpers';

interface RouteContext {
  params: Promise<{ runId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { runId } = await context.params;

  const { data: run, error: runErr } = await supabase
    .from('test_runs')
    .select('*, projects(name)')
    .eq('id', runId)
    .single();

  if (runErr || !run) return notFound('Test run');

  const { data: runCases, error: casesErr } = await supabase
    .from('test_run_cases')
    .select('id, overall_status')
    .eq('test_run_id', runId);

  if (casesErr) return serverError(casesErr.message);

  const { data: results, error: resultsErr } = await supabase
    .from('execution_results')
    .select('status, platform')
    .eq('test_run_id', runId);

  if (resultsErr) return serverError(resultsErr.message);

  const totalCases = runCases?.length ?? 0;
  const caseStatuses = { pass: 0, fail: 0, blocked: 0, skip: 0, not_run: 0 };
  for (const rc of runCases ?? []) {
    const s = rc.overall_status as keyof typeof caseStatuses;
    if (s in caseStatuses) caseStatuses[s]++;
  }

  const passRate =
    totalCases > 0
      ? Math.round((caseStatuses.pass / totalCases) * 100)
      : 0;

  const platformBreakdown: Record<
    string,
    { total: number; pass: number; fail: number; blocked: number; skip: number; not_run: number }
  > = {};

  for (const r of results ?? []) {
    if (!platformBreakdown[r.platform]) {
      platformBreakdown[r.platform] = {
        total: 0,
        pass: 0,
        fail: 0,
        blocked: 0,
        skip: 0,
        not_run: 0,
      };
    }
    const pb = platformBreakdown[r.platform];
    pb.total++;
    const s = r.status as keyof typeof caseStatuses;
    if (s in pb) (pb as Record<string, number>)[s]++;
  }

  const statusDistribution = { pass: 0, fail: 0, blocked: 0, skip: 0, not_run: 0 };
  for (const r of results ?? []) {
    const s = r.status as keyof typeof statusDistribution;
    if (s in statusDistribution) statusDistribution[s]++;
  }

  return NextResponse.json({
    run,
    summary: {
      totalCases,
      ...caseStatuses,
      passRate,
    },
    platformBreakdown,
    statusDistribution,
  });
}
