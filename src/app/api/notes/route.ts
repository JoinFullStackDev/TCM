import { NextResponse } from 'next/server';
import { withAuth, validationError, serverError } from '@/lib/api/helpers';
import { createNoteSchema } from '@/lib/validations/note';

export async function GET(request: Request) {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const { searchParams } = new URL(request.url);
  const filter = searchParams.get('filter') ?? 'all';
  const search = searchParams.get('search')?.trim();

  let query = supabase
    .from('notes')
    .select(`
      *,
      note_attachments(*),
      author:profiles!notes_author_id_fkey(id, full_name, avatar_url, email),
      linked_test_cases:note_test_case_links(test_cases(id, display_id, title, suite_id, suite:suites(project_id)))
    `)
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false });

  if (filter === 'mine') {
    query = query.eq('author_id', user.id);
  } else if (filter === 'team') {
    query = query.eq('visibility', 'team').neq('author_id', user.id);
  }

  if (search) {
    query = query.or(`title.ilike.%${search}%,content_plain.ilike.%${search}%`);
  }

  const { data, error } = await query;

  if (error) return serverError(error.message);

  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const body = await request.json();
  const parsed = createNoteSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { data: note, error } = await supabase
    .from('notes')
    .insert({
      author_id: user.id,
      title: parsed.data.title ?? null,
      content: parsed.data.content,
      content_plain: parsed.data.content_plain ?? null,
      visibility: parsed.data.visibility,
      meeting_url: parsed.data.meeting_url ?? null,
      is_pinned: parsed.data.is_pinned,
    })
    .select('*, note_attachments(*)')
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(note, { status: 201 });
}
