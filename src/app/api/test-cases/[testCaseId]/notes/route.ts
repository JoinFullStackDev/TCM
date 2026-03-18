import { NextResponse } from 'next/server';
import { withAuth, serverError } from '@/lib/api/helpers';

interface RouteContext {
  params: Promise<{ testCaseId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;
  const { testCaseId } = await context.params;

  // RLS on `notes` already ensures only own + team-visible notes are returned
  const { data, error } = await supabase
    .from('note_test_case_links')
    .select(`
      note_id,
      notes(
        id, title, content_plain, summary, visibility, is_pinned, meeting_url,
        author_id, created_at, updated_at,
        author:profiles!notes_author_id_fkey(id, full_name, avatar_url, email)
      )
    `)
    .eq('test_case_id', testCaseId);

  if (error) return serverError(error.message);

  const notes = (data ?? [])
    .map((row) => row.notes)
    .filter(Boolean);

  return NextResponse.json(notes);
}
