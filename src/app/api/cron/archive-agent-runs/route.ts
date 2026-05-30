import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Vercel Cron: hourly — soft-archive terminal runs older than 24h
// vercel.json config: { "crons": [{ "path": "/api/cron/archive-agent-runs", "schedule": "0 * * * *" }] }
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Guard: only allow Vercel Cron or internal calls
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createServiceClient();

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: archived, error } = await supabase
    .from('agent_runs')
    .update({ archived_at: new Date().toISOString() })
    .in('status', ['done', 'failed', 'timed_out', 'killed'])
    .lt('ended_at', cutoff)
    .is('archived_at', null)
    .select('id');

  if (error) {
    console.error('[cron:archive-agent-runs] Archive failed', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    archived: archived?.length ?? 0,
    cutoff,
  });
}
