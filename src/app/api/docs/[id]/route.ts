import { NextResponse } from 'next/server';
import { withAuth, serverError, notFound } from '@/lib/api/helpers';

// GET /api/docs/[id] — get full doc including content
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const { id } = await params;

  const { data: doc, error } = await supabase
    .from('docs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return notFound('Doc');
    return serverError(error.message);
  }

  return NextResponse.json({ doc });
}

// PATCH /api/docs/[id] — update title, content, folder_id, project_id
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const { id } = await params;
  const body = await request.json();
  const { title, content, folder_id, project_id } = body as {
    title?: string;
    content?: string;
    folder_id?: string | null;
    project_id?: string | null;
  };

  const updates: Record<string, unknown> = { updated_by: user.id };
  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;
  if ('folder_id' in body) updates.folder_id = folder_id ?? null;
  if ('project_id' in body) updates.project_id = project_id ?? null;

  const { data: doc, error } = await supabase
    .from('docs')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    if (error.code === 'PGRST116') return notFound('Doc');
    return serverError(error.message);
  }

  return NextResponse.json({ doc });
}

// DELETE /api/docs/[id] — delete a doc
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const { id } = await params;

  const { error } = await supabase
    .from('docs')
    .delete()
    .eq('id', id);

  if (error) return serverError(error.message);

  return NextResponse.json({ success: true });
}
