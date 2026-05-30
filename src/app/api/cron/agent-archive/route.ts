import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// POST /api/cron/agent-archive — archive terminal runs older than 24 hours
// Designed to be called hourly
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization') ?? '';
  const cronSecret = process.env.CRON_SECRET ?? process.env.CLUTCH_API_KEY;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('agent_runs')
    .update({ archived_at: new Date().toISOString() })
    .in('status', ['done', 'failed', 'timed_out', 'killed'])
    .is('archived_at', null)
    .lt('ended_at', cutoff)
    .select('id');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ archived: (data ?? []).length });
}

export async function GET(request: Request) {
  return POST(request);
}
