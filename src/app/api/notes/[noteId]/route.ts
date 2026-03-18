import { NextResponse } from 'next/server';
import { withAuth, validationError, notFound, serverError } from '@/lib/api/helpers';
import { updateNoteSchema } from '@/lib/validations/note';

interface RouteContext {
  params: Promise<{ noteId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { noteId } = await context.params;

  const { data: note, error } = await supabase
    .from('notes')
    .select(`
      *,
      note_attachments(*),
      author:profiles!notes_author_id_fkey(id, full_name, avatar_url, email),
      linked_test_cases:note_test_case_links(test_cases(id, display_id, title, suite_id, suite:suites(project_id)))
    `)
    .eq('id', noteId)
    .single();

  if (error || !note) return notFound('Note');

  return NextResponse.json(note);
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;
  const { noteId } = await context.params;

  const { data: existing } = await supabase
    .from('notes')
    .select('author_id')
    .eq('id', noteId)
    .single();

  if (!existing) return notFound('Note');
  if (existing.author_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = updateNoteSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const updateData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) updateData[key] = value;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data: note, error } = await supabase
    .from('notes')
    .update(updateData)
    .eq('id', noteId)
    .select(`*, note_attachments(*), linked_test_cases:note_test_case_links(test_cases(id, display_id, title, suite_id, suite:suites(project_id)))`)
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(note);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;
  const { noteId } = await context.params;

  const { data: existing } = await supabase
    .from('notes')
    .select('author_id')
    .eq('id', noteId)
    .single();

  if (!existing) return notFound('Note');
  if (existing.author_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: attachments } = await supabase
    .from('note_attachments')
    .select('storage_path')
    .eq('note_id', noteId);

  if (attachments?.length) {
    const paths = attachments.map((a) => a.storage_path);
    await supabase.storage.from('note-attachments').remove(paths);
  }

  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', noteId);

  if (error) return serverError(error.message);

  return NextResponse.json({ success: true });
}
