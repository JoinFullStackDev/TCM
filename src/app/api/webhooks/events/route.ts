import { NextResponse } from 'next/server';
import { withAuth, serverError } from '@/lib/api/helpers';

export async function GET(request: Request) {
  const auth = await withAuth('view_webhooks');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');

  let query = supabase
    .from('webhook_events')
    .select('*, test_runs(name)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) return serverError(error.message);

  return NextResponse.json(data ?? []);
}
