import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Vercel Cron: every 2 minutes — mark stale active runs as timed_out
// vercel.json config: { "crons": [{ "path": "/api/cron/timeout-agent-runs", "schedule": "*/2 * * * *" }] }
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Guard: only allow Vercel Cron or internal calls
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createServiceClient();

  const timeoutMinutes = parseInt(process.env.AGENT_TIMEOUT_MINUTES ?? '10', 10);
  const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString();

  // Mark stale active runs as timed_out
  // "stale" = last_heartbeat (or started_at if no heartbeat) older than cutoff
  const { data, error } = await supabase.rpc('timeout_stale_agent_runs', {
    cutoff_ts: cutoff,
  });

  if (error) {
    // Fallback: raw update if RPC not available
    const { data: updated, error: updateErr } = await supabase
      .from('agent_runs')
      .update({ status: 'timed_out', ended_at: new Date().toISOString() })
      .in('status', ['spawned', 'running', 'waiting'])
      .is('archived_at', null)
      .or(`last_heartbeat.lt.${cutoff},and(last_heartbeat.is.null,started_at.lt.${cutoff})`)
      .select('id');

    if (updateErr) {
      console.error('[cron:timeout-agent-runs] Update failed', updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      timedOut: updated?.length ?? 0,
      cutoff,
      timeoutMinutes,
    });
  }

  return NextResponse.json({
    timedOut: data ?? 0,
    cutoff,
    timeoutMinutes,
  });
}
