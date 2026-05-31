import { NextResponse } from 'next/server';
import { withAgentAuth, validationError, serverError } from '@/lib/api/helpers';
import { CreateRunSchema, OUTPUT_TAIL_MAX_BYTES } from '@/lib/validations/agent-run';

// POST /api/agent-runs — register new run at spawn time
export async function POST(request: Request) {
  const auth = await withAgentAuth();
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError('Invalid JSON body');
  }

  const parsed = CreateRunSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const {
    agent,
    brief,
    sessionKey,
    spawnedBy,
    slackChannel,
    slackThreadTs,
    projectTag,
    startedAt,
    parentRunId,
    taskTitle,
    taskDescription,
    expectedOutcome,
  } = parsed.data;

  // Verify parentRunId exists if supplied
  if (parentRunId) {
    const { data: parent, error: parentErr } = await supabase
      .from('agent_runs')
      .select('id')
      .eq('id', parentRunId)
      .single();

    if (parentErr || !parent) {
      return NextResponse.json(
        { error: 'Parent run not found', code: 'PARENT_NOT_FOUND' },
        { status: 404 },
      );
    }
  }

  const { data: run, error } = await supabase
    .from('agent_runs')
    .insert({
      agent,
      brief,
      session_key: sessionKey,
      spawned_by: spawnedBy,
      slack_channel: slackChannel ?? null,
      slack_thread_ts: slackThreadTs ?? null,
      project_tag: projectTag ?? null,
      started_at: startedAt,
      parent_run_id: parentRunId ?? null,
      output_truncated: false,
      task_title: taskTitle ?? null,
      task_description: taskDescription ?? null,
      expected_outcome: expectedOutcome ?? null,
    })
    .select()
    .single();

  if (error) {
    // Unique constraint violation on session_key
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Session key already exists', code: 'SESSION_KEY_CONFLICT' },
        { status: 409 },
      );
    }
    return serverError(error.message);
  }

  return NextResponse.json(toRunResponse(run), { status: 201 });
}

// GET /api/agent-runs — list runs with filters and pagination
export async function GET(request: Request) {
  const auth = await withAgentAuth();
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get('status');
  const agentParam = searchParams.get('agent');
  const projectTag = searchParams.get('projectTag');
  const parentRunId = searchParams.get('parentRunId');
  const includeArchived = searchParams.get('includeArchived') === 'true';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 100);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  const statusFilter = statusParam ? statusParam.split(',').filter(Boolean) : null;
  const agentFilter = agentParam ? agentParam.split(',').filter(Boolean) : null;

  // Build query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('agent_runs')
    .select('*', { count: 'exact' })
    .order('started_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (!includeArchived) {
    query = query.is('archived_at', null);
  }
  if (statusFilter?.length) {
    query = query.in('status', statusFilter);
  }
  if (agentFilter?.length) {
    query = query.in('agent', agentFilter);
  }
  if (projectTag) {
    query = query.eq('project_tag', projectTag);
  }
  if (parentRunId) {
    query = query.eq('parent_run_id', parentRunId);
  }

  const { data: runs, error, count } = await query;
  if (error) return serverError(error.message);

  // Enforce output tail size cap on reads too (belt-and-suspenders)
  const mappedRuns = (runs ?? []).map((r: Record<string, unknown>) => {
    if (typeof r.output_tail === 'string' && Buffer.byteLength(r.output_tail) > OUTPUT_TAIL_MAX_BYTES) {
      const truncated = truncateFromFront(r.output_tail);
      return { ...r, output_tail: truncated, output_truncated: true };
    }
    return r;
  });

  return NextResponse.json({
    runs: mappedRuns.map(toRunResponse),
    total: count ?? 0,
    limit,
    offset,
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function truncateFromFront(text: string): string {
  // Keep last OUTPUT_TAIL_MAX_BYTES bytes (UTF-8 aware trim)
  const buf = Buffer.from(text, 'utf8');
  if (buf.byteLength <= OUTPUT_TAIL_MAX_BYTES) return text;
  return buf.slice(buf.byteLength - OUTPUT_TAIL_MAX_BYTES).toString('utf8');
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
