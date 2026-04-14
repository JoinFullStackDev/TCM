import { withAuth, notFound } from '@/lib/api/helpers';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const auth = await withAuth('export');
  if (!auth.ok) return auth.response;

  const { jobId } = await context.params;
  const { user } = auth.ctx;

  const supabase = await createServiceClient();
  const { data: job } = await supabase
    .from('export_jobs')
    .select('id, status, format, result_url, file_name, error_message')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .single();

  if (!job) return notFound('Export job');

  return Response.json({
    status: job.status,
    format: job.format,
    download_url: job.format === 'xlsx' ? (job.result_url ?? undefined) : undefined,
    sheets_url: job.format === 'google_sheets' ? (job.result_url ?? undefined) : undefined,
    error: job.error_message ?? undefined,
  });
}
