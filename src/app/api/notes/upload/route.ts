import { NextResponse } from 'next/server';
import { withAuth, serverError } from '@/lib/api/helpers';
import { createServiceClient } from '@/lib/supabase/server';

const ALLOWED_MIME_TYPES = [
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain', 'text/markdown', 'text/csv',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const noteId = formData.get('note_id') as string;

  if (!file) {
    return NextResponse.json({ error: 'File is required' }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Invalid file type: ${file.type}` },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'File exceeds 10MB limit' },
      { status: 400 },
    );
  }

  if (!noteId) {
    return NextResponse.json(
      { error: 'note_id is required' },
      { status: 400 },
    );
  }

  const { data: note } = await supabase
    .from('notes')
    .select('author_id')
    .eq('id', noteId)
    .single();

  if (!note || note.author_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Use service client for storage + insert (bypasses storage RLS;
  // auth and ownership are already verified above)
  const serviceClient = await createServiceClient();

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${user.id}/${noteId}/${timestamp}_${safeName}`;

  const buffer = await file.arrayBuffer();
  const { error: uploadError } = await serviceClient.storage
    .from('note-attachments')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) return serverError(uploadError.message);

  const { data: attachment, error: dbError } = await serviceClient
    .from('note_attachments')
    .insert({
      note_id: noteId,
      storage_path: storagePath,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
    })
    .select()
    .single();

  if (dbError) return serverError(dbError.message);

  return NextResponse.json(attachment, { status: 201 });
}
