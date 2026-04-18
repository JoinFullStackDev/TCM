import { NextRequest, NextResponse } from 'next/server';
import { withAuth, validationError, notFound, serverError } from '@/lib/api/helpers';
import { updateFeedbackSchema } from '@/lib/validations/feedback';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/feedback/[id] — AUTHENTICATED, full detail with signed attachment URLs
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const auth = await withAuth('view_feedback');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const { data: submission, error } = await supabase
    .from('feedback_submissions')
    .select(
      `*, project:project_id(id, name), attachments:feedback_attachments(*)`,
    )
    .eq('id', id)
    .single();

  if (error || !submission) return notFound('Feedback submission');

  // Generate signed URLs for attachments (60-min TTL)
  const attachments = (submission.attachments ?? []) as {
    id: string;
    file_name: string;
    file_size: number | null;
    mime_type: string | null;
    storage_path: string;
    created_at: string;
  }[];

  const attachmentsWithUrls = await Promise.all(
    attachments.map(async (att) => {
      const { data: signedData } = await supabase.storage
        .from('feedback-attachments')
        .createSignedUrl(att.storage_path, 3600);
      return {
        ...att,
        signed_url: signedData?.signedUrl ?? null,
      };
    }),
  );

  return NextResponse.json({
    ...submission,
    attachments: attachmentsWithUrls,
  });
}

// PATCH /api/feedback/[id] — AUTHENTICATED, triage update
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const auth = await withAuth('manage_feedback');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = updateFeedbackSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const updateData: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.internal_notes !== undefined) updateData.internal_notes = parsed.data.internal_notes;
  if (parsed.data.project_id !== undefined) updateData.project_id = parsed.data.project_id;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await supabase
    .from('feedback_submissions')
    .select('id')
    .eq('id', id)
    .single();

  if (fetchError || !existing) return notFound('Feedback submission');

  const { data: updated, error: updateError } = await supabase
    .from('feedback_submissions')
    .update(updateData)
    .eq('id', id)
    .select(`*, project:project_id(id, name), attachments:feedback_attachments(*)`)
    .single();

  if (updateError || !updated) return serverError(updateError?.message ?? 'Update failed');

  return NextResponse.json(updated);
}
