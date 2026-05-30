import { NextResponse } from 'next/server';
import { withAgentAuth, notFound, serverError } from '@/lib/api/helpers';
import { TERMINAL_STATUSES } from '@/lib/validations/agent-run';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/agent-runs/:id/kill — operator-initiated kill
export async function POST(_request: Request, context: RouteContext) {
  const auth = await withAgentAuth();
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const { id } = await context.params;

  // Fetch record
  const { data: run, error: fetchErr } = await supabase
    .from('agent_runs')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !run) return notFound('Agent run');

  // Already terminal
  if (TERMINAL_STATUSES.includes(run.status as typeof TERMINAL_STATUSES[number])) {
    return NextResponse.json(
      { error: 'Run is already in a terminal state', code: 'ALREADY_TERMINAL' },
      { status: 409 },
    );
  }

  let openClawSkipped = false;
  let openClawError = false;

  const integrationEnabled = process.env.OPENCLAW_INTEGRATION_ENABLED === 'true';

  if (integrationEnabled) {
    // Proxy kill call to OpenClaw gateway
    try {
      const openClawUrl = process.env.OPENCLAW_API_URL;
      const openClawKey = process.env.OPENCLAW_API_KEY;

      const killRes = await fetch(`${openClawUrl}/api/sessions/kill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-OpenClaw-Key': openClawKey ?? '',
        },
        body: JSON.stringify({ sessionKey: run.session_key }),
      });

      // 404 = session already gone — continue anyway
      if (!killRes.ok && killRes.status !== 404) {
        console.error('[kill] OpenClaw returned non-OK status', killRes.status);
        openClawError = true;
        // Continue — do not block DB update on OpenClaw failure
      }
    } catch (err) {
      console.error('[kill] OpenClaw unreachable', err);
      openClawError = true;
      // Kill must proceed even if OpenClaw is unreachable
    }
  } else {
    openClawSkipped = true;
  }

  // Update DB record
  const { data: updated, error: updateErr } = await supabase
    .from('agent_runs')
    .update({ status: 'killed', ended_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (updateErr || !updated) return serverError(updateErr?.message ?? 'Failed to update run');

  return NextResponse.json({
    ...toRunResponse(updated),
    openClawSkipped,
    openClawError,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRunResponse(r: any) {
  return {
    id: r.id,
    agent: r.agent,
    brief: r.brief,
    status: r.status,
    sessionKey: r.session_key,
    spawnedBy: r.spawned_by,
    slackChannel: r.slack_channel,
    slackThreadTs: r.slack_thread_ts,
    projectTag: r.project_tag,
    startedAt: r.started_at,
    lastHeartbeat: r.last_heartbeat,
    endedAt: r.ended_at,
    outputTail: r.output_tail,
    outputTruncated: r.output_truncated,
    parentRunId: r.parent_run_id,
    archivedAt: r.archived_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
