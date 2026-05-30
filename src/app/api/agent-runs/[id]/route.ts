import { NextResponse } from 'next/server';
import { withDualAuth, validationError, notFound, serverError } from '@/lib/api/helpers';
import { updateAgentRunSchema } from '@/lib/validations/agent-run';

const TERMINAL_STATUSES = new Set(['done', 'failed', 'timed_out', 'killed']);
const OUTPUT_TAIL_MAX_BYTES = 64 * 1024; // 64KB

// ---------------------------------------------------------------------------
// PATCH /api/agent-runs/:id — update status, heartbeat, or output_tail
// ---------------------------------------------------------------------------
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await withDualAuth(request);
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError('Invalid JSON body');
  }

  const parsed = updateAgentRunSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  // Guard: fetch existing row to check terminal state
  const { data: existing, error: fetchError } = await supabase
    .from('agent_runs')
    .select('id, status, output_tail')
    .eq('id', id)
    .single();

  if (fetchError || !existing) return notFound('Agent run');

  if (TERMINAL_STATUSES.has(existing.status)) {
    return NextResponse.json(
      { error: `Cannot update a run in terminal status: ${existing.status}` },
      { status: 409 },
    );
  }

  // Build update payload
  const updates: Record<string, unknown> = {};

  if (parsed.data.status !== undefined) {
    updates.status = parsed.data.status;
    if (TERMINAL_STATUSES.has(parsed.data.status)) {
      updates.ended_at = parsed.data.ended_at ?? new Date().toISOString();
    }
  }

  if (parsed.data.last_heartbeat !== undefined) {
    updates.last_heartbeat = parsed.data.last_heartbeat;
  }

  if (parsed.data.ended_at !== undefined) {
    updates.ended_at = parsed.data.ended_at;
  }

  // output_tail: append and cap at 64KB, truncating from the front
  if (parsed.data.output_tail !== undefined && parsed.data.output_tail !== null) {
    const prev = (existing.output_tail as string | null) ?? '';
    const combined = prev + parsed.data.output_tail;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(combined);

    if (bytes.length > OUTPUT_TAIL_MAX_BYTES) {
      const sliced = bytes.slice(bytes.length - OUTPUT_TAIL_MAX_BYTES);
      updates.output_tail = new TextDecoder().decode(sliced);
      updates.output_truncated = true;
    } else {
      updates.output_tail = combined;
    }
  }

  const { data: updated, error } = await supabase
    .from('agent_runs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(updated);
}
