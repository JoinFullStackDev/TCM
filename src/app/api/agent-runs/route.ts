import { NextResponse } from 'next/server';
import { withDualAuth, validationError, serverError } from '@/lib/api/helpers';
import {
  createAgentRunSchema,
  listAgentRunsQuerySchema,
} from '@/lib/validations/agent-run';

// ---------------------------------------------------------------------------
// GET /api/agent-runs — list agent runs with optional filters
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  const auth = await withDualAuth(request);
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const { searchParams } = new URL(request.url);
  const queryResult = listAgentRunsQuerySchema.safeParse({
    agent: searchParams.get('agent') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    project_tag: searchParams.get('project_tag') ?? undefined,
    include_archived: searchParams.get('include_archived') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  });

  if (!queryResult.success) return validationError(queryResult.error.flatten());
  const { agent, status, project_tag, include_archived, limit } = queryResult.data;

  let query = supabase
    .from('agent_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit ?? 100);

  if (agent) query = query.eq('agent', agent);
  if (status) query = query.eq('status', status);
  if (project_tag) query = query.eq('project_tag', project_tag);
  if (include_archived !== 'true') {
    query = query.is('archived_at', null);
  }

  const { data, error } = await query;
  if (error) return serverError(error.message);

  return NextResponse.json(data ?? []);
}

// ---------------------------------------------------------------------------
// POST /api/agent-runs — create a new agent run record
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  const auth = await withDualAuth(request);
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError('Invalid JSON body');
  }

  const parsed = createAgentRunSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const {
    agent,
    brief,
    session_key,
    spawned_by,
    slack_channel,
    slack_thread_ts,
    project_tag,
    started_at,
    parent_run_id,
    task_title,
    task_description,
    expected_outcome,
  } = parsed.data;

  const { data: run, error } = await supabase
    .from('agent_runs')
    .insert({
      agent,
      brief,
      session_key,
      spawned_by,
      slack_channel: slack_channel ?? null,
      slack_thread_ts: slack_thread_ts ?? null,
      project_tag: project_tag ?? null,
      started_at,
      parent_run_id: parent_run_id ?? null,
      task_title: task_title ?? null,
      task_description: task_description ?? null,
      expected_outcome: expected_outcome ?? null,
      status: 'spawned',
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'session_key already exists' },
        { status: 409 },
      );
    }
    return serverError(error.message);
  }

  return NextResponse.json(run, { status: 201 });
}
