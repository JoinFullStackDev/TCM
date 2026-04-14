import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/helpers';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const auth = await withAuth('export');
  if (!auth.ok) return auth.response;

  const { role } = auth.ctx;

  // Admin-only endpoint
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);
  const cursor = searchParams.get('cursor'); // ISO date string for pagination

  const supabase = await createServiceClient();
  let query = supabase
    .from('export_audit_log')
    .select(
      'id, user_id, project_id, suite_id, format, scope, status, test_case_count, file_name, sheets_url, error_message, ip_address, user_agent, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch audit log' }, { status: 500 });
  }

  return NextResponse.json({
    entries: data ?? [],
    next_cursor: data && data.length === limit ? data[data.length - 1].created_at : null,
  });
}
