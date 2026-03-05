import { NextResponse } from 'next/server';
import { withAuth, notFound, serverError } from '@/lib/api/helpers';

interface RouteContext {
  params: Promise<{ annotationId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { annotationId } = await context.params;

  const { data, error } = await supabase
    .from('annotations')
    .select('*, attachments(*)')
    .eq('id', annotationId)
    .single();

  if (error || !data) return notFound('Annotation');

  return NextResponse.json(data);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase, user, role } = auth.ctx;
  const { annotationId } = await context.params;

  const { data: annotation } = await supabase
    .from('annotations')
    .select('id, created_by')
    .eq('id', annotationId)
    .single();

  if (!annotation) return notFound('Annotation');

  if (role !== 'admin' && annotation.created_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: attachments } = await supabase
    .from('attachments')
    .select('storage_path')
    .eq('annotation_id', annotationId);

  if (attachments && attachments.length > 0) {
    const paths = attachments.map((a) => a.storage_path);
    await supabase.storage.from('screenshots').remove(paths);
  }

  const { error } = await supabase
    .from('annotations')
    .delete()
    .eq('id', annotationId);

  if (error) return serverError(error.message);

  return NextResponse.json({ success: true });
}
