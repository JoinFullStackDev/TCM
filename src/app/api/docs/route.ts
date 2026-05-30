import { NextResponse } from 'next/server';
import { withAuth, serverError } from '@/lib/api/helpers';

// GET /api/docs — list docs (summary, no content), optional ?folderId=
export async function GET(request: Request) {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get('folderId');

  let query = supabase
    .from('docs')
    .select('id, title, folder_id, project_id, created_by, updated_by, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (folderId) {
    query = query.eq('folder_id', folderId);
  }

  const { data, error } = await query;

  if (error) return serverError(error.message);

  return NextResponse.json({ docs: data ?? [] });
}

// POST /api/docs — create a doc
export async function POST(request: Request) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const body = await request.json();
  const { title, folder_id, project_id } = body as {
    title?: string;
    folder_id?: string;
    project_id?: string;
  };

  const { data: doc, error } = await supabase
    .from('docs')
    .insert({
      title: title ?? 'Untitled Document',
      folder_id: folder_id ?? null,
      project_id: project_id ?? null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select('*')
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json({ doc }, { status: 201 });
}
