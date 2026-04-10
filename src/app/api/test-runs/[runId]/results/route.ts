import { NextResponse } from 'next/server';
import { withAuth, validationError, serverError } from '@/lib/api/helpers';
import { upsertResultsSchema } from '@/lib/validations/execution-result';

interface RouteContext {
  params: Promise<{ runId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { runId } = await context.params;

  const { searchParams } = new URL(request.url);
  const caseId = searchParams.get('case_id');

  let query = supabase
    .from('execution_results')
    .select('*')
    .eq('test_run_id', runId);

  if (caseId) query = query.eq('test_case_id', caseId);

  const { data, error } = await query.order('test_step_id');
  if (error) return serverError(error.message);

  return NextResponse.json(data ?? []);
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;
  const { runId } = await context.params;

  const body = await request.json();
  const parsed = upsertResultsSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const now = new Date().toISOString();
  // actual_data_used is stored in execution_results ONLY.
  // Never add a test_steps write to this handler.
  const rows = parsed.data.results.map((r) => ({
    test_run_id: runId,
    test_case_id: r.test_case_id,
    test_step_id: r.test_step_id,
    platform: r.platform,
    browser: r.browser ?? 'default',
    status: r.status,
    comment: r.comment ?? null,
    actual_data_used: r.actual_data_used ?? null,   // runtime override; coerced from "" to null at API boundary
    executed_by: user.id,
    executed_at: now,
  }));

  const { error } = await supabase
    .from('execution_results')
    .upsert(rows, { onConflict: 'test_run_id,test_step_id,platform,browser' });

  if (error) {
    console.error('[PUT /api/test-runs/results] upsert error:', error);
    return serverError(error.message);
  }

  return NextResponse.json({ success: true });
}
