import { NextResponse } from 'next/server';
import { withAgentAuth, notFound, serverError } from '@/lib/api/helpers';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/agent-runs/:id/restart — operator-initiated restart
export async function POST(_request: Request, context: RouteContext) {
  const auth = await withAgentAuth();
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const { id } = await context.params;

  // Fetch original record
  const { data: original, error: fetchErr } = await supabase
    .from('agent_runs')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !original) return notFound('Agent run');

  let newSessionKey: string | null = null;
  let openClawSkipped = false;
  let openClawError = false;

  const integrationEnabled = process.env.OPENCLAW_INTEGRATION_ENABLED === 'true';

  if (integrationEnabled) {
    try {
      const openClawUrl = process.env.OPENCLAW_API_URL;
      const openClawKey = process.env.OPENCLAW_API_KEY;

      const spawnRes = await fetch(`${openClawUrl}/api/sessions/spawn`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-OpenClaw-Key': openClawKey ?? '',
        },
        body: JSON.stringify({
          agent: original.agent,
          brief: original.brief,
          spawnedBy: original.spawned_by,
          projectTag: original.project_tag,
        }),
      });

      if (spawnRes.ok) {
        const spawnData = await spawnRes.json();
        newSessionKey = spawnData.sessionKey ?? null;
      } else {
        console.error('[restart] OpenClaw spawn failed', spawnRes.status);
        openClawError = true;
      }
    } catch (err) {
      console.error('[restart] OpenClaw unreachable', err);
      openClawError = true;
    }
  } else {
    openClawSkipped = true;
  }

  // If OpenClaw didn't provide a session key, generate a placeholder
  if (!newSessionKey) {
    newSessionKey = `restart-${original.session_key}-${Date.now()}`;
  }

  const now = new Date().toISOString();

  // Insert new top-level run (restart is fresh, parentRunId = null)
  const { data: newRun, error: insertErr } = await supabase
    .from('agent_runs')
    .insert({
      agent: original.agent,
      brief: original.brief,
      session_key: newSessionKey,
      spawned_by: original.spawned_by,
      slack_channel: original.slack_channel,
      slack_thread_ts: original.slack_thread_ts,
      project_tag: original.project_tag,
      started_at: now,
      status: 'spawned',
      parent_run_id: null,
      output_truncated: false,
    })
    .select()
    .single();

  if (insertErr || !newRun) return serverError(insertErr?.message ?? 'Failed to create restart run');

  return NextResponse.json(
    {
      ...toRunResponse(newRun),
      openClawSkipped,
      openClawError,
    },
    { status: 201 },
  );
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
