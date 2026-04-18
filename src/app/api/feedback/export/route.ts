import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/helpers';

function escapeCsv(value: string | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function truncate(value: string | null | undefined, max: number): string {
  if (value == null) return '';
  return value.length > max ? value.slice(0, max) : value;
}

// GET /api/feedback/export — AUTHENTICATED, returns CSV file
export async function GET(request: NextRequest) {
  const auth = await withAuth('manage_feedback');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const idsParam = request.nextUrl.searchParams.get('ids');
  const ids = idsParam ? idsParam.split(',').map((s) => s.trim()).filter(Boolean) : null;

  let query = supabase
    .from('feedback_submissions')
    .select(
      'id, submission_type, severity, status, project_id, submitter_name, submitter_email, environment, loom_url, description, steps_to_reproduce, created_at, title, project:projects(name)',
    )
    .order('created_at', { ascending: false });

  if (ids && ids.length > 0) {
    query = query.in('id', ids);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
  }

  const rows = data ?? [];

  const HEADERS = [
    'id',
    'type',
    'severity',
    'status',
    'project_name',
    'submitter_name',
    'submitter_email',
    'environment',
    'loom_url',
    'description',
    'repro_steps',
    'created_at',
  ];

  const csvLines: string[] = [HEADERS.join(',')];

  for (const row of rows) {
    const projectRaw = row.project as unknown;
    const project: { name: string } | null = Array.isArray(projectRaw)
      ? (projectRaw[0] ?? null)
      : (projectRaw as { name: string } | null);
    const cols = [
      escapeCsv(row.id),
      escapeCsv(row.submission_type),
      escapeCsv(row.severity),
      escapeCsv(row.status),
      escapeCsv(project?.name),
      escapeCsv(row.submitter_name),
      escapeCsv(row.submitter_email),
      escapeCsv(row.environment),
      escapeCsv(row.loom_url),
      escapeCsv(truncate(row.description, 200)),
      escapeCsv(truncate(row.steps_to_reproduce, 200)),
      escapeCsv(row.created_at),
    ];
    csvLines.push(cols.join(','));
  }

  const csvBody = csvLines.join('\r\n');
  const date = new Date().toISOString().slice(0, 10);
  const filename = `feedback-export-${date}.csv`;

  return new NextResponse(csvBody, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
