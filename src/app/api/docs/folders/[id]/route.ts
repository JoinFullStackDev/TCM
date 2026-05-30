import { NextResponse } from 'next/server';
import { withAuth, serverError, notFound } from '@/lib/api/helpers';

// PATCH /api/docs/folders/[id] — rename or re-parent a folder
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const { id } = await params;
  const body = await request.json();
  const { name, parent_id, position } = body as {
    name?: string;
    parent_id?: string | null;
    position?: number;
  };

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name.trim();
  if ('parent_id' in body) updates.parent_id = parent_id ?? null;
  if (position !== undefined) updates.position = position;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data: folder, error } = await supabase
    .from('doc_folders')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    if (error.code === 'PGRST116') return notFound('Folder');
    return serverError(error.message);
  }

  return NextResponse.json({ folder });
}

// DELETE /api/docs/folders/[id] — delete folder (cascade handled by DB)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const { id } = await params;

  const { error } = await supabase
    .from('doc_folders')
    .delete()
    .eq('id', id);

  if (error) return serverError(error.message);

  return NextResponse.json({ success: true });
}
