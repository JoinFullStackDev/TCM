import { NextResponse } from 'next/server';
import { withAuth, validationError, notFound, serverError } from '@/lib/api/helpers';
import { updateTestRunSchema } from '@/lib/validations/test-run';

interface RouteContext {
  params: Promise<{ runId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { runId } = await context.params;

  const { data: run, error } = await supabase
    .from('test_runs')
    .select(`
      *,
      projects:project_id(id, name),
      suites:suite_id(id, name, prefix),
      assignee:assignee_id(id, full_name, avatar_url, email),
      creator:created_by(full_name)
    `)
    .eq('id', runId)
    .single();

  if (error || !run) return notFound('Test run');

  return NextResponse.json(run);
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { runId } = await context.params;

  const body = await request.json();
  const parsed = updateTestRunSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const updates: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === 'completed' || parsed.data.status === 'aborted') {
    updates.completed_at = new Date().toISOString();
  }

  const { data: run, error } = await supabase
    .from('test_runs')
    .update(updates)
    .eq('id', runId)
    .select()
    .single();

  if (error || !run) return notFound('Test run');

  return NextResponse.json(run);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await withAuth('delete');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { runId } = await context.params;

  const { error } = await supabase
    .from('test_runs')
    .delete()
    .eq('id', runId);

  if (error) return serverError(error.message);

  return NextResponse.json({ success: true });
}
