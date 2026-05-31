import { NextResponse } from 'next/server';
import { withAgentAuth, validationError, notFound, serverError } from '@/lib/api/helpers';
import { PatchRunSchema, TERMINAL_STATUSES, OUTPUT_TAIL_MAX_BYTES } from '@/lib/validations/agent-run';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/agent-runs/:id — fetch single run with children and notes
export async function GET(_request: Request, context: RouteContext) {
  const auth = await withAgentAuth();
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const { id } = await context.params;

  const { data: run, error } = await supabase
    .from('agent_runs')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !run) return notFound('Agent run');

  // Fetch child runs
  const { data: children } = await supabase
    .from('agent_runs')
    .select('id, agent, brief, task_title, status, started_at')
    .eq('parent_run_id', id)
    .order('started_at', { ascending: true });

  // Fetch notes
  const { data: notes } = await supabase
    .from('run_notes')
    .select('*')
    .eq('run_id', id)
    .order('created_at', { ascending: true });

  return NextResponse.json({
    ...toRunResponse(run),
    children: children ?? [],
    notes: notes ?? [],
  });
}

// PATCH /api/agent-runs/:id — lifecycle updates and heartbeats
export async function PATCH(request: Request, context: RouteContext) {
  const auth = await withAgentAuth();
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError('Invalid JSON body');
  }

  const parsed = PatchRunSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { status, lastHeartbeat, outputTail, endedAt } = parsed.data;

  // Fetch existing record
  const { data: existing, error: fetchErr } = await supabase
    .from('agent_runs')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !existing) return notFound('Agent run');

  // Guard: reject status change if run is already terminal
  const isTerminal = TERMINAL_STATUSES.includes(existing.status as typeof TERMINAL_STATUSES[number]);
  if (status && isTerminal) {
    return NextResponse.json(
      { error: 'Cannot update a terminal run', code: 'ILLEGAL_TRANSITION' },
      { status: 409 },
    );
  }

  // output_tail truncation (server-side enforcement)
  let finalOutputTail = outputTail;
  let outputTruncated = existing.output_truncated as boolean;

  if (finalOutputTail !== undefined) {
    const byteLen = Buffer.byteLength(finalOutputTail, 'utf8');
    if (byteLen > OUTPUT_TAIL_MAX_BYTES) {
      const buf = Buffer.from(finalOutputTail, 'utf8');
      finalOutputTail = buf.slice(buf.byteLength - OUTPUT_TAIL_MAX_BYTES).toString('utf8');
      outputTruncated = true;
    }
  }

  // Build update payload — only include defined fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatePayload: Record<string, any> = {};
  if (status !== undefined) updatePayload.status = status;
  if (lastHeartbeat !== undefined) updatePayload.last_heartbeat = lastHeartbeat;
  if (finalOutputTail !== undefined) {
    updatePayload.output_tail = finalOutputTail;
    updatePayload.output_truncated = outputTruncated;
  }
  if (endedAt !== undefined) updatePayload.ended_at = endedAt;

  // Atomic UPDATE with stale-heartbeat guard and terminal-state guard
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('agent_runs')
    .update(updatePayload)
    .eq('id', id)
    .not('status', 'in', `(${TERMINAL_STATUSES.join(',')})`)
    .select()
    .single();

  // Stale heartbeat guard: only apply when lastHeartbeat is being set and existing is non-null
  if (lastHeartbeat && existing.last_heartbeat) {
    query = query.lt('last_heartbeat', lastHeartbeat);
  }

  const { data: updated, error: updateErr } = await query;

  if (updateErr || !updated) {
    // Re-fetch to determine cause of 0-row update
    const { data: recheck } = await supabase
      .from('agent_runs')
      .select('status, last_heartbeat')
      .eq('id', id)
      .single();

    if (!recheck) return notFound('Agent run');

    // Terminal state blocked the update
    if (TERMINAL_STATUSES.includes(recheck.status as typeof TERMINAL_STATUSES[number])) {
      return NextResponse.json(
        { error: 'Cannot update a terminal run', code: 'ILLEGAL_TRANSITION' },
        { status: 409 },
      );
    }

    // Stale heartbeat — silent dedup, not an error
    const { data: current } = await supabase
      .from('agent_runs')
      .select('*')
      .eq('id', id)
      .single();

    return NextResponse.json(toRunResponse(current));
  }

  return NextResponse.json(toRunResponse(updated));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRunResponse(r: any) {
  return {
    id: r.id,
    agent: r.agent,
    brief: r.brief,
    taskTitle: r.task_title ?? null,
    taskDescription: r.task_description ?? null,
    expectedOutcome: r.expected_outcome ?? null,
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
