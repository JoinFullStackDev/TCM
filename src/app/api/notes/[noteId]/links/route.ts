import { NextResponse } from 'next/server';
import { withAuth, notFound, serverError } from '@/lib/api/helpers';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ noteId: string }>;
}

const linkSchema = z.object({
  test_case_id: z.string().uuid(),
});

export async function GET(_request: Request, context: RouteContext) {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { noteId } = await context.params;

  const { data, error } = await supabase
    .from('note_test_case_links')
    .select('id, test_case_id, created_at, test_cases(id, display_id, title, suite_id, suite:suites(project_id))')
    .eq('note_id', noteId)
    .order('created_at', { ascending: true });

  if (error) return serverError(error.message);

  // Flatten to LinkedTestCase shape
  type TcRow = { id: string; display_id: string; title: string; suite_id: string; suite: { project_id: string } | null };
  const linked = (data ?? []).map((row) => {
    const tc = row.test_cases as unknown as TcRow;
    return {
      link_id: row.id,
      id: tc.id,
      display_id: tc.display_id,
      title: tc.title,
      suite_id: tc.suite_id,
      project_id: tc.suite?.project_id ?? '',
    };
  });

  return NextResponse.json(linked);
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;
  const { noteId } = await context.params;

  const { data: note } = await supabase
    .from('notes')
    .select('author_id')
    .eq('id', noteId)
    .single();

  if (!note) return notFound('Note');
  if (note.author_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'test_case_id (uuid) is required' }, { status: 400 });
  }

  const { data: link, error } = await supabase
    .from('note_test_case_links')
    .insert({ note_id: noteId, test_case_id: parsed.data.test_case_id })
    .select('id, test_case_id, created_at, test_cases(id, display_id, title, suite_id, suite:suites(project_id))')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Already linked' }, { status: 409 });
    }
    return serverError(error.message);
  }

  return NextResponse.json(link, { status: 201 });
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;
  const { noteId } = await context.params;

  const { data: note } = await supabase
    .from('notes')
    .select('author_id')
    .eq('id', noteId)
    .single();

  if (!note) return notFound('Note');
  if (note.author_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'test_case_id (uuid) is required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('note_test_case_links')
    .delete()
    .eq('note_id', noteId)
    .eq('test_case_id', parsed.data.test_case_id);

  if (error) return serverError(error.message);

  return NextResponse.json({ success: true });
}
