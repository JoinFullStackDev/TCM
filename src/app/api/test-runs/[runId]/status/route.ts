import { NextResponse } from 'next/server';
import { withAuth, serverError } from '@/lib/api/helpers';

interface RouteContext {
  params: Promise<{ runId: string }>;
}

function worstStatus(statuses: string[]): string {
  const priority: Record<string, number> = { fail: 4, blocked: 3, skip: 2, not_run: 1, pass: 0 };
  let worst = 'pass';
  let worstP = 0;
  for (const s of statuses) {
    const p = priority[s] ?? 0;
    if (p > worstP) {
      worst = s;
      worstP = p;
    }
  }
  return worst;
}

export async function PATCH(_request: Request, context: RouteContext) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { runId } = await context.params;

  const { data: trcs } = await supabase
    .from('test_run_cases')
    .select('id, test_case_id')
    .eq('test_run_id', runId);

  if (!trcs) return NextResponse.json({ success: true });

  for (const trc of trcs) {
    const { data: results } = await supabase
      .from('execution_results')
      .select('status')
      .eq('test_run_id', runId)
      .eq('test_case_id', trc.test_case_id);

    const statuses = (results ?? []).map((r) => r.status);
    const overall = statuses.length > 0 ? worstStatus(statuses) : 'not_run';

    await supabase
      .from('test_run_cases')
      .update({ overall_status: overall })
      .eq('id', trc.id);
  }

  return NextResponse.json({ success: true });
}
