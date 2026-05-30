import { NextResponse } from 'next/server';
import { withAuth, serverError } from '@/lib/api/helpers';

// GET /api/docs/folders — list all folders (flat list, client builds tree)
export async function GET() {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const { data, error } = await supabase
    .from('doc_folders')
    .select('*')
    .order('position', { ascending: true })
    .order('name', { ascending: true });

  if (error) return serverError(error.message);

  return NextResponse.json({ folders: data ?? [] });
}

// POST /api/docs/folders — create a folder
export async function POST(request: Request) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const body = await request.json();
  const { name, parent_id, project_id } = body as {
    name: string;
    parent_id?: string;
    project_id?: string;
  };

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  // Determine position: max sibling position + 1000
  const { data: siblings } = await supabase
    .from('doc_folders')
    .select('position')
    .eq('parent_id', parent_id ?? null);

  const maxPos = siblings && siblings.length > 0
    ? Math.max(...siblings.map((s: { position: number }) => s.position))
    : -1000;
  const position = maxPos + 1000;

  const { data: folder, error } = await supabase
    .from('doc_folders')
    .insert({
      name: name.trim(),
      parent_id: parent_id ?? null,
      project_id: project_id ?? null,
      position,
      created_by: user.id,
    })
    .select('*')
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json({ folder }, { status: 201 });
}
