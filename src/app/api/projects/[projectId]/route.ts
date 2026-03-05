import { NextResponse } from 'next/server';
import { withAuth, validationError, notFound, serverError } from '@/lib/api/helpers';
import { updateProjectSchema } from '@/lib/validations/project';

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { projectId } = await context.params;

  const { data: project, error } = await supabase
    .from('projects')
    .select('*, suites(count)')
    .eq('id', projectId)
    .single();

  if (error || !project) return notFound('Project');

  return NextResponse.json(project);
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { projectId } = await context.params;

  const body = await request.json();
  const parsed = updateProjectSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { data: project, error } = await supabase
    .from('projects')
    .update(parsed.data)
    .eq('id', projectId)
    .select()
    .single();

  if (error || !project) return notFound('Project');

  return NextResponse.json(project);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await withAuth('delete_project');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { projectId } = await context.params;

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);

  if (error) return serverError(error.message);

  return NextResponse.json({ success: true });
}
