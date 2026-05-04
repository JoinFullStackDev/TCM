import { NextResponse } from 'next/server';
import { withAuth, notFound, serverError } from '@/lib/api/helpers';
import { createServiceClient } from '@/lib/supabase/server';

function escapeCsv(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string; suiteId: string }> },
) {
  const auth = await withAuth('export');
  if (!auth.ok) return auth.response;

  const { projectId, suiteId } = await context.params;
  const { role, user } = auth.ctx;

  const supabase = await createServiceClient();

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

  const { data: suite } = await supabase
    .from('suites')
    .select('id, name, project_id')
    .eq('id', suiteId)
    .single();

  if (!suite || suite.project_id !== projectId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let testCaseCount = 0;
  let exportSucceeded = false;
  let errorMsg: string | undefined;

  try {
    const { data: testCases } = await supabase
      .from('test_cases')
      .select('id, title, description, precondition, automation_status')
      .eq('suite_id', suiteId)
      .is('deleted_at', null);

    const headers = [
      'Suite', 'Test Case ID', 'Title', 'Description', 'Precondition',
      'Step #', 'Step Description', 'Test Data', 'Expected Result',
      'Automation Status', 'Bug Links',
    ];
    const rows: string[] = [headers.map(escapeCsv).join(',')];

    for (const tc of testCases ?? []) {
      testCaseCount++;

      const { data: steps } = await supabase
        .from('test_steps')
        .select('step_number, description, test_data, expected_result')
        .eq('test_case_id', tc.id)
        .order('step_number');

      const { data: bugLinks } = await supabase
        .from('bug_links')
        .select('url')
        .eq('test_case_id', tc.id);

      const bugLinkStr = (bugLinks ?? []).map((b: { url: string }) => b.url).join(', ');
      const stepList = steps ?? [];

      if (stepList.length === 0) {
        rows.push([
          escapeCsv(suite.name),
          escapeCsv(tc.id),
          escapeCsv(tc.title),
          escapeCsv(tc.description),
          escapeCsv(tc.precondition),
          '',
          '',
          '',
          '',
          escapeCsv(tc.automation_status),
          escapeCsv(bugLinkStr),
        ].join(','));
      } else {
        for (const step of stepList) {
          rows.push([
            escapeCsv(suite.name),
            escapeCsv(tc.id),
            escapeCsv(tc.title),
            escapeCsv(tc.description),
            escapeCsv(tc.precondition),
            escapeCsv(String(step.step_number)),
            escapeCsv(step.description),
            escapeCsv(step.test_data),
            escapeCsv(step.expected_result),
            escapeCsv(tc.automation_status),
            escapeCsv(bugLinkStr),
          ].join(','));
        }
      }
    }

    const csv = rows.join('\n');
    const date = new Date().toISOString().split('T')[0];
    const safeProject = (project.name as string).toLowerCase().replace(/\s+/g, '-');
    const safeSuite = (suite.name as string).toLowerCase().replace(/\s+/g, '-');
    const filename = `${safeProject}-${safeSuite}-export-${date}.csv`;

    exportSucceeded = true;

    await writeAuditLog({
      userId: user.id,
      projectId,
      suiteId,
      format: 'csv',
      scope: 'suite',
      status: 'success',
      testCaseCount,
      fileName: filename,
      request,
    });

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    errorMsg = (err as Error).message ?? 'Export failed';
    if (!exportSucceeded) {
      await writeAuditLog({
        userId: user.id,
        projectId,
        suiteId,
        format: 'csv',
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
      sheets_url: null,
      error_message: params.errorMsg ?? null,
      ip_address: params.request.headers.get('x-forwarded-for') ?? null,
      user_agent: params.request.headers.get('user-agent') ?? null,
    });
  } catch (err) {
    console.error('[export/audit-log] Failed to write audit entry:', err);
  }
}
