import { NextRequest, NextResponse } from 'next/server';
import { withAuth, validationError, serverError } from '@/lib/api/helpers';
import { createServiceClient } from '@/lib/supabase/server';
import { createFeedbackSchema } from '@/lib/validations/feedback';

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'application/pdf',
  'text/plain',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

// GET /api/feedback — AUTHENTICATED, paginated list with filters
export async function GET(request: NextRequest) {
  const auth = await withAuth('view_feedback');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const params = request.nextUrl.searchParams;
  const status = params.get('status');
  const type = params.get('type');
  const severity = params.get('severity');
  const projectId = params.get('project_id');
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') ?? '25', 10)));
  const offset = (page - 1) * limit;

  let query = supabase
    .from('feedback_submissions')
    .select(
      `id, submission_type, title, severity, status, submitter_name, submitter_email,
       environment, project_id, created_at, updated_at,
       project:project_id(id, name),
       attachments:feedback_attachments(id)`,
      { count: 'exact' },
    );

  if (status) query = query.eq('status', status);
  if (type) query = query.eq('submission_type', type);
  if (severity) query = query.eq('severity', severity);
  if (projectId) query = query.eq('project_id', projectId);

  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) return serverError(error.message);

  // Attach attachment_count
  const enriched = (data ?? []).map((row) => {
    const { attachments, ...rest } = row as typeof row & { attachments: unknown[] };
    return {
      ...rest,
      attachment_count: Array.isArray(attachments) ? attachments.length : 0,
    };
  });

  return NextResponse.json({
    data: enriched,
    total: count ?? 0,
    page,
    limit,
  });
}

// POST /api/feedback — PUBLIC, submit feedback form
export async function POST(request: NextRequest) {
  // Do NOT call withAuth — this is a public endpoint
  const supabase = await createServiceClient();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  // Honeypot check — if populated, silently accept but discard
  const honeypot = formData.get('_hp_field');
  if (honeypot && typeof honeypot === 'string' && honeypot.length > 0) {
    // Return success to not reveal detection, but don't store
    return NextResponse.json({ id: 'ignored', created_at: new Date().toISOString() }, { status: 201 });
  }

  // Extract scalar fields
  const rawFields: Record<string, string | null> = {};
  const fieldKeys = [
    'submission_type', 'title', 'description', 'severity', 'steps_to_reproduce',
    'expected_behavior', 'actual_behavior', 'loom_url', 'submitter_name',
    'submitter_email', 'environment', 'project_id', '_hp_field',
  ];
  for (const key of fieldKeys) {
    const val = formData.get(key);
    rawFields[key] = typeof val === 'string' && val.length > 0 ? val : null;
  }

  // Normalize empty strings to null for optional fields
  const parsed = createFeedbackSchema.safeParse({
    ...rawFields,
    loom_url: rawFields.loom_url || null,
    submitter_email: rawFields.submitter_email || null,
  });

  if (!parsed.success) {
    return validationError(parsed.error.flatten());
  }

  const input = parsed.data;

  // Extract files
  const files = formData.getAll('files[]') as File[];
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Maximum ${MAX_FILES} files allowed per submission` },
      { status: 400 },
    );
  }

  // Validate files before uploading
  for (const file of files) {
    if (!(file instanceof File)) continue;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File "${file.name}" exceeds the 10MB limit` },
        { status: 400 },
      );
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `File type "${file.type}" is not allowed` },
        { status: 400 },
      );
    }
  }

  // Insert feedback submission first
  const submissionData = {
    submission_type: input.submission_type,
    title: input.title,
    description: input.description,
    severity: input.severity ?? null,
    steps_to_reproduce: input.steps_to_reproduce ?? null,
    expected_behavior: input.expected_behavior ?? null,
    actual_behavior: input.actual_behavior ?? null,
    loom_url: input.loom_url || null,
    submitter_name: input.submitter_name ?? null,
    submitter_email: input.submitter_email || null,
    environment: input.environment ?? null,
    project_id: input.project_id ?? null,
    _hp_field: null,
  };

  const { data: submission, error: submissionError } = await supabase
    .from('feedback_submissions')
    .insert(submissionData)
    .select('id, created_at')
    .single();

  if (submissionError || !submission) {
    return serverError(submissionError?.message ?? 'Failed to create submission');
  }

  // Upload files and record attachments
  const uploadedPaths: string[] = [];
  const attachmentRows: {
    feedback_id: string;
    storage_path: string;
    file_name: string;
    file_size: number;
    mime_type: string;
  }[] = [];

  for (const file of files) {
    if (!(file instanceof File)) continue;
    const ext = file.name.split('.').pop() ?? 'bin';
    const uniqueName = `${crypto.randomUUID()}.${ext}`;
    const storagePath = `${submission.id}/${uniqueName}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('feedback-attachments')
      .upload(storagePath, new Uint8Array(arrayBuffer), {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      // Cleanup already-uploaded files
      for (const path of uploadedPaths) {
        await supabase.storage.from('feedback-attachments').remove([path]);
      }
      // Delete the submission row
      await supabase.from('feedback_submissions').delete().eq('id', submission.id);
      return serverError(`File upload failed: ${uploadError.message}`);
    }

    uploadedPaths.push(storagePath);
    attachmentRows.push({
      feedback_id: submission.id,
      storage_path: storagePath,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
    });
  }

  if (attachmentRows.length > 0) {
    const { error: attachError } = await supabase
      .from('feedback_attachments')
      .insert(attachmentRows);

    if (attachError) {
      // Best effort — submission is still valid, just log
      console.error('Failed to record attachments:', attachError.message);
    }
  }

  return NextResponse.json(
    { id: submission.id, created_at: submission.created_at },
    { status: 201 },
  );
}
