import { NextResponse } from 'next/server';
import { withAuth, validationError, serverError, conflict } from '@/lib/api/helpers';
import { createSuiteSchema } from '@/lib/validations/suite';

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { projectId } = await context.params;

  const { data: suites, error } = await supabase
    .from('suites')
    .select('*')
    .eq('project_id', projectId)
    .order('position', { ascending: true });

  if (error) return serverError(error.message);

  const enriched = await Promise.all(
    (suites ?? []).map(async (s) => {
      const { count } = await supabase
        .from('test_cases')
        .select('*', { count: 'exact', head: true })
        .eq('suite_id', s.id);
      return { ...s, test_case_count: count ?? 0 };
    }),
  );

  return NextResponse.json(enriched);
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;
  const { projectId } = await context.params;

  const body = await request.json();
  const parsed = createSuiteSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { data: existing } = await supabase
    .from('suites')
    .select('id')
    .eq('project_id', projectId)
    .eq('prefix', parsed.data.prefix)
    .maybeSingle();

  if (existing) return conflict(`A suite with prefix "${parsed.data.prefix}" already exists in this project`);

  const { data: maxPos } = await supabase
    .from('suites')
    .select('position')
    .eq('project_id', projectId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: suiteCount } = await supabase
    .from('suites')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId);

  const { data: suite, error } = await supabase
    .from('suites')
    .insert({
      project_id: projectId,
      name: parsed.data.name,
      prefix: parsed.data.prefix,
      description: parsed.data.description ?? null,
      color_index: (suiteCount ?? 0) % 5,
      position: (maxPos?.position ?? -1) + 1,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(suite, { status: 201 });
}
