import { NextResponse } from 'next/server';
import { withAuth, validationError, notFound, serverError } from '@/lib/api/helpers';
import { mergeSuitesSchema } from '@/lib/validations/suite';

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await withAuth('delete');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { projectId } = await context.params;

  const body = await request.json();
  const parsed = mergeSuitesSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { source_suite_id, target_suite_id } = parsed.data;

  const { data: source } = await supabase
    .from('suites')
    .select('id')
    .eq('id', source_suite_id)
    .eq('project_id', projectId)
    .maybeSingle();

  if (!source) return notFound('Source suite');

  const { data: target } = await supabase
    .from('suites')
    .select('id')
    .eq('id', target_suite_id)
    .eq('project_id', projectId)
    .maybeSingle();

  if (!target) return notFound('Target suite');

  const { data, error } = await supabase.rpc('merge_suites', {
    p_source_suite_id: source_suite_id,
    p_target_suite_id: target_suite_id,
  });

  if (error) return serverError(error.message);

  return NextResponse.json(data);
}
