import { createServiceClient } from '@/lib/supabase/server';
import { fetchProjectSnapshot, fetchSuiteSnapshot, fetchAnnotationMap } from './fetchExportSnapshot';
import { buildExcel } from './buildExcel';
import { buildGoogleSheets } from './buildGoogleSheets';
import { buildFilename } from './sanitizeFilename';
import { getValidAccessToken } from '@/lib/google/tokenStore';

export interface AsyncExportParams {
  jobId: string;
  userId: string;
  projectId: string;
  suiteId?: string;
  projectName: string;
  suiteName?: string;
  format: 'xlsx' | 'google_sheets';
  scope: 'project' | 'suite';
  testCaseCount: number;
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Process an async export job in the background.
 * Call this fire-and-forget — it manages its own job status updates and audit log.
 */
export async function runAsyncExport(params: AsyncExportParams): Promise<void> {
  const supabase = await createServiceClient();

  const updateJob = async (status: string, extra: Record<string, unknown> = {}) => {
    try {
      await supabase
        .from('export_jobs')
        .update({ status, updated_at: new Date().toISOString(), ...extra })
        .eq('id', params.jobId);
    } catch (err) {
      console.error('[async-export] Failed to update job status:', err);
    }
  };

  try {
    await updateJob('processing');

    // Fetch snapshot
    const snapshot = params.suiteId
      ? await fetchSuiteSnapshot(params.suiteId)
      : await fetchProjectSnapshot(params.projectId);

    // Attach annotation map (HIGH-03)
    snapshot.annotationMap = await fetchAnnotationMap(params.projectId);

    let resultUrl: string | null = null;
    let fileName: string | null = null;

    if (params.format === 'xlsx') {
      const buffer = await buildExcel(snapshot);
      fileName = buildFilename(params.projectName, params.suiteName);

      // Try to upload to Supabase Storage bucket 'exports'
      // TODO: The 'exports' storage bucket must be created in Supabase for async Excel downloads
      // to work. If the bucket doesn't exist or credentials aren't configured, result_url will
      // be null and the completed job won't have a download link.
      const uploadPath = `${params.userId}/${params.jobId}/${fileName}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('exports')
        .upload(uploadPath, buffer, {
          contentType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

      if (!uploadError && uploadData) {
        // Signed URL valid for 1 hour
        const { data: signedUrlData } = await supabase.storage
          .from('exports')
          .createSignedUrl(uploadData.path, 3600);
        resultUrl = signedUrlData?.signedUrl ?? null;
      } else {
        console.warn(
          '[async-export] Storage upload failed — result_url will be null.',
          uploadError?.message,
        );
      }
    } else {
      // Google Sheets — token refresh is handled by getValidAccessToken
      const accessToken = await getValidAccessToken(params.userId);
      const title = params.suiteName
        ? `${params.projectName} / ${params.suiteName} — TestForge Export`
        : `${params.projectName} — TestForge Export`;
      resultUrl = await buildGoogleSheets(accessToken, title, snapshot);
    }

    await updateJob('completed', {
      result_url: resultUrl,
      file_name: fileName,
      completed_at: new Date().toISOString(),
    });

    // Audit log
    await supabase.from('export_audit_log').insert({
      user_id: params.userId,
      project_id: params.projectId,
      suite_id: params.suiteId ?? null,
      format: params.format,
      scope: params.scope,
      status: 'success',
      test_case_count: params.testCaseCount,
      file_name: fileName,
      sheets_url: params.format === 'google_sheets' ? resultUrl : null,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
    });
  } catch (err) {
    const errorMsg = (err as Error).message ?? 'Async export failed';
    await updateJob('failed', {
      error_message: errorMsg,
      completed_at: new Date().toISOString(),
    });

    try {
      await supabase.from('export_audit_log').insert({
        user_id: params.userId,
        project_id: params.projectId,
        suite_id: params.suiteId ?? null,
        format: params.format,
        scope: params.scope,
        status: 'failed',
        test_case_count: params.testCaseCount,
        error_message: errorMsg,
        ip_address: params.ipAddress,
        user_agent: params.userAgent,
      });
    } catch {
      // Non-blocking — audit log failure must not mask the original error
    }

    console.error('[async-export] Export failed for job', params.jobId, err);
  }
}
