import { NextResponse } from 'next/server';
import { withAuth, serverError } from '@/lib/api/helpers';

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: Request) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const projectId = formData.get('project_id') as string;
  const testRunId = formData.get('test_run_id') as string;
  const annotationId = formData.get('annotation_id') as string;

  if (!file) {
    return NextResponse.json({ error: 'File is required' }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}` },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'File exceeds 5MB limit' },
      { status: 400 },
    );
  }

  if (!projectId || !testRunId || !annotationId) {
    return NextResponse.json(
      { error: 'project_id, test_run_id, and annotation_id are required' },
      { status: 400 },
    );
  }

  const fileName = `${annotationId}_${file.name}`;
  const storagePath = `${projectId}/${testRunId}/${fileName}`;

  const buffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from('screenshots')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) return serverError(uploadError.message);

  const { data: attachment, error: dbError } = await supabase
    .from('attachments')
    .insert({
      annotation_id: annotationId,
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
