import { NextResponse } from 'next/server';
import { withAgentAuth, notFound, serverError } from '@/lib/api/helpers';
import { TERMINAL_STATUSES } from '@/lib/validations/agent-run';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/agent-runs/:id/close-session
// Operator-initiated: fires the OpenClaw cron wake endpoint with full run context
// so the Clutch session can wrap up and close itself. Does NOT directly update
// the run status — Clutch will PATCH the run to 'done' once it finishes.
export async function POST(_request: Request, context: RouteContext) {
  const auth = await withAgentAuth();
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const { id } = await context.params;

  // Fetch the run
  const { data: run, error: fetchErr } = await supabase
    .from('agent_runs')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !run) return notFound('Agent run');

  // Guard: only active runs can be closed
  if (TERMINAL_STATUSES.includes(run.status as typeof TERMINAL_STATUSES[number])) {
    return NextResponse.json(
      { error: 'Run is already in a terminal state', code: 'ALREADY_TERMINAL' },
      { status: 409 },
    );
  }

  const wakeUrl = process.env.OPENCLAW_WAKE_URL;
  const clutchKey = process.env.CLUTCH_API_KEY;

  if (!wakeUrl) {
    return NextResponse.json(
      { error: 'OPENCLAW_WAKE_URL is not configured', code: 'NOT_CONFIGURED' },
      { status: 503 },
    );
  }

  // Build the webhook payload
  const payload = {
    runId: run.id,
    sessionKey: run.session_key,
    agent: run.agent,
    brief: run.brief,
    taskTitle: run.task_title ?? null,
    taskDescription: run.task_description ?? null,
    outputTail: run.output_tail ?? null,
    slackChannel: run.slack_channel ?? null,
    slackThreadTs: run.slack_thread_ts ?? null,
    runType: run.run_type ?? 'subagent',
  };

  try {
    const wakeRes = await fetch(wakeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Clutch-Key': clutchKey ?? '',
      },
      body: JSON.stringify(payload),
    });

    if (!wakeRes.ok) {
      const errorText = await wakeRes.text().catch(() => '');
      console.error('[close-session] OpenClaw wake endpoint returned non-OK', wakeRes.status, errorText);
      return NextResponse.json(
        {
          error: `OpenClaw wake endpoint returned ${wakeRes.status}`,
          code: 'WAKE_FAILED',
          detail: errorText,
        },
        { status: 502 },
      );
    }
  } catch (err) {
    console.error('[close-session] OpenClaw wake endpoint unreachable', err);
    return serverError(err instanceof Error ? err.message : 'Failed to reach OpenClaw wake endpoint');
  }

  return NextResponse.json({ ok: true, runId: run.id });
}
