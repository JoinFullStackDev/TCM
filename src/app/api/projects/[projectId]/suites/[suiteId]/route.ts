import { NextResponse } from 'next/server';
import { withAuth, validationError, notFound, serverError, conflict } from '@/lib/api/helpers';
import { updateSuiteSchema } from '@/lib/validations/suite';

interface RouteContext {
  params: Promise<{ projectId: string; suiteId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { suiteId } = await context.params;

  const { data: suite, error } = await supabase
    .from('suites')
    .select('*')
    .eq('id', suiteId)
    .single();

  if (error || !suite) return notFound('Suite');

  return NextResponse.json(suite);
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { projectId, suiteId } = await context.params;

  const body = await request.json();
  const parsed = updateSuiteSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  if (parsed.data.prefix) {
    const { data: existing } = await supabase
      .from('suites')
      .select('id')
      .eq('project_id', projectId)
      .eq('prefix', parsed.data.prefix)
      .neq('id', suiteId)
      .maybeSingle();

    if (existing) return conflict(`A suite with prefix "${parsed.data.prefix}" already exists`);
  }

  const { data: suite, error } = await supabase
    .from('suites')
    .update(parsed.data)
    .eq('id', suiteId)
    .select()
    .single();

  if (error || !suite) return notFound('Suite');

  return NextResponse.json(suite);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await withAuth('delete');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { suiteId } = await context.params;

  const { error } = await supabase
    .from('suites')
    .delete()
    .eq('id', suiteId);

  if (error) return serverError(error.message);

  return NextResponse.json({ success: true });
}
