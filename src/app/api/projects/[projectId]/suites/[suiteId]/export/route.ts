import { NextResponse } from 'next/server';
import { withAuth, notFound, serverError } from '@/lib/api/helpers';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchSuiteSnapshot, countSuiteTestCases, fetchAnnotationMap } from '@/lib/export/fetchExportSnapshot';
import { buildExcel } from '@/lib/export/buildExcel';
import { buildGoogleSheets } from '@/lib/export/buildGoogleSheets';
import { buildFilename } from '@/lib/export/sanitizeFilename';
import { getValidAccessToken } from '@/lib/google/tokenStore';
import { runAsyncExport } from '@/lib/export/runAsyncExport';

// Sync path for ≤500 test cases. For >500, dispatch an async job (HIGH-05/GAP-08/09).
const SYNC_THRESHOLD = 500;

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; suiteId: string }> },
) {
  const auth = await withAuth('export');
  if (!auth.ok) return auth.response;

  const { projectId, suiteId } = await context.params;
  const { role, user } = auth.ctx;

  const supabase = await createServiceClient();

  // Per-project permission check
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, export_allowed_roles')
    .eq('id', projectId)
    .single();

  if (!project) return notFound('Project');

  const allowedRoles = (project.export_allowed_roles as string[]) ?? ['admin', 'qa_engineer', 'sdet'];
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Suite scope verification (TF-EXP-17)
  const { data: suite } = await supabase
    .from('suites')
    .select('id, name, project_id')
    .eq('id', suiteId)
    .single();

  if (!suite || suite.project_id !== projectId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const format: string = body.format ?? 'xlsx';

  if (format !== 'xlsx' && format !== 'google_sheets') {
    return NextResponse.json({ error: 'Invalid format. Must be xlsx or google_sheets.' }, { status: 400 });
  }

  let testCaseCount = 0;
  let exportSucceeded = false;
  let errorMsg: string | undefined;
  let xlsxFilename: string | undefined;
  let sheetsUrl: string | undefined;

  try {
    testCaseCount = await countSuiteTestCases(suiteId);

    if (testCaseCount > SYNC_THRESHOLD) {
      // For Google Sheets, verify auth before queuing so we fail fast
      if (format === 'google_sheets') {
        try {
          await getValidAccessToken(user.id);
        } catch (err: unknown) {
          const errMsg = (err as Error).message;
          if (errMsg === 'NOT_CONNECTED') {
            return NextResponse.json({ error: 'google_not_connected' }, { status: 401 });
          }
          if (errMsg === 'TOKEN_REVOKED') {
            return NextResponse.json({ error: 'google_reauth_required' }, { status: 401 });
          }
          throw err;
        }
      }

      // Create async export job (HIGH-05)
      const { data: job, error: jobError } = await supabase
        .from('export_jobs')
        .insert({
          user_id: user.id,
          project_id: projectId,
          suite_id: suiteId,
          format,
          scope: 'suite',
          status: 'pending',
          test_case_count: testCaseCount,
        })
        .select('id')
        .single();

      if (jobError || !job) {
        return serverError('Failed to create export job.');
      }

      // Fire-and-forget — response is already sent (202 below)
      runAsyncExport({
        jobId: job.id,
        userId: user.id,
        projectId,
        suiteId,
        projectName: project.name as string,
        suiteName: suite.name as string,
        format: format as 'xlsx' | 'google_sheets',
        scope: 'suite',
        testCaseCount,
        ipAddress: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent'),
      }).catch((err) => console.error('[export/suite async] unhandled:', err));

      return NextResponse.json({ jobId: job.id, async: true }, { status: 202 });
    }

    const snapshot = await fetchSuiteSnapshot(suiteId);
    snapshot.annotationMap = await fetchAnnotationMap(projectId);

    if (format === 'xlsx') {
      const buffer = await buildExcel(snapshot);
      xlsxFilename = buildFilename(project.name as string, suite.name as string);
      exportSucceeded = true;

      await writeAuditLog({
        userId: user.id,
        projectId,
        suiteId,
        format,
        scope: 'suite',
        status: 'success',
        testCaseCount,
        fileName: xlsxFilename,
        request,
      });

      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${xlsxFilename}"`,
          'Cache-Control': 'no-store',
        },
      });
    } else {
      // Google Sheets
      let accessToken: string;
      try {
        accessToken = await getValidAccessToken(user.id);
      } catch (err: unknown) {
        const errMsg = (err as Error).message;
        if (errMsg === 'NOT_CONNECTED') {
          return NextResponse.json({ error: 'google_not_connected' }, { status: 401 });
        }
        if (errMsg === 'TOKEN_REVOKED') {
          return NextResponse.json({ error: 'google_reauth_required' }, { status: 401 });
        }
        throw err;
      }

      const title = `${project.name} / ${suite.name} — TestForge Export`;
      sheetsUrl = await buildGoogleSheets(accessToken, title as string, snapshot);
      exportSucceeded = true;

      await writeAuditLog({
        userId: user.id,
        projectId,
        suiteId,
        format,
        scope: 'suite',
        status: 'success',
        testCaseCount,
        sheetsUrl,
        request,
      });

      return NextResponse.json({ url: sheetsUrl });
    }
  } catch (err: unknown) {
    errorMsg = (err as Error).message ?? 'Export failed';
    if (!exportSucceeded) {
      await writeAuditLog({
        userId: user.id,
        projectId,
        suiteId,
        format,
        scope: 'suite',
        status: 'failed',
        testCaseCount,
        errorMsg,
        request,
      });
    }
    console.error('[export/suite]', err);
    return serverError('Export failed. Please try again.');
  }
}

interface AuditLogParams {
  userId: string;
  projectId: string;
  suiteId: string | null;
  format: string;
  scope: string;
  status: 'success' | 'failed';
  testCaseCount: number;
  fileName?: string;
  sheetsUrl?: string;
  errorMsg?: string;
  request: Request;
}

async function writeAuditLog(params: AuditLogParams) {
  try {
    const supabase = await createServiceClient();
    await supabase.from('export_audit_log').insert({
      user_id: params.userId,
      project_id: params.projectId,
      suite_id: params.suiteId,
      format: params.format,
      scope: params.scope,
      status: params.status,
      test_case_count: params.testCaseCount,
      file_name: params.fileName ?? null,
      sheets_url: params.sheetsUrl ?? null,
      error_message: params.errorMsg ?? null,
      ip_address: params.request.headers.get('x-forwarded-for') ?? null,
      user_agent: params.request.headers.get('user-agent') ?? null,
    });
  } catch (err) {
    console.error('[export/audit-log] Failed to write audit entry:', err);
  }
}
