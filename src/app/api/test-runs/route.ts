import { NextResponse } from 'next/server';
import { withAuth, validationError, serverError } from '@/lib/api/helpers';
import { createTestRunSchema } from '@/lib/validations/test-run';

export async function GET(request: Request) {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');

  let query = supabase
    .from('test_runs')
    .select(`
      *,
      projects:project_id(name),
      suites:suite_id(name, prefix),
      assignee:assignee_id(full_name, avatar_url),
      test_run_cases(overall_status)
    `)
    .order('created_at', { ascending: false });

  if (projectId) query = query.eq('project_id', projectId);

  const { data, error } = await query;
  if (error) return serverError(error.message);

  const enriched = (data ?? []).map((run) => {
    const cases = (run.test_run_cases ?? []) as { overall_status: string }[];
    const counts = { total: cases.length, pass: 0, fail: 0, blocked: 0, skip: 0, not_run: 0 };
    for (const c of cases) {
      const s = c.overall_status as keyof typeof counts;
      if (s in counts) (counts as Record<string, number>)[s]++;
    }
    return { ...run, test_run_cases: undefined, counts };
  });

  return NextResponse.json(enriched);
}

export async function POST(request: Request) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const body = await request.json();
  const parsed = createTestRunSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { data: run, error } = await supabase
    .from('test_runs')
    .insert({
      ...parsed.data,
      suite_id: parsed.data.suite_id ?? null,
      assignee_id: parsed.data.assignee_id ?? null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(run, { status: 201 });
}
