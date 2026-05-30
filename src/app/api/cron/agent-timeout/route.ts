import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// POST /api/cron/agent-timeout — mark stale runs as timed_out
// Designed to be called every 2 minutes (e.g., Vercel Cron or external scheduler)
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  // Verify internal cron secret
  const authHeader = request.headers.get('authorization') ?? '';
  const cronSecret = process.env.CRON_SECRET ?? process.env.CLUTCH_API_KEY;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const timeoutMinutes = parseInt(process.env.AGENT_TIMEOUT_MINUTES ?? '10', 10);
  const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString();

  const supabase = await createServiceClient();

  // Find active runs whose last_heartbeat (or started_at if no heartbeat) is older than cutoff
  const { data: staleRuns, error: fetchError } = await supabase
    .from('agent_runs')
    .select('id, session_key, status, last_heartbeat, started_at')
    .in('status', ['spawned', 'running', 'waiting'])
    .is('archived_at', null);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const timedOutIds: string[] = [];

  for (const run of staleRuns ?? []) {
    const checkTime = run.last_heartbeat ?? run.started_at;
    if (checkTime && checkTime < cutoff) {
      timedOutIds.push(run.id as string);
    }
  }

  if (timedOutIds.length === 0) {
    return NextResponse.json({ timedOut: 0 });
  }

  const { error: updateError } = await supabase
    .from('agent_runs')
    .update({
      status: 'timed_out',
      ended_at: new Date().toISOString(),
    })
    .in('id', timedOutIds);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ timedOut: timedOutIds.length, ids: timedOutIds });
}

// Also support GET for Vercel Cron (which sends GET)
export async function GET(request: Request) {
  return POST(request);
}
