import { NextResponse } from 'next/server';
import { withDualAuth, notFound, serverError, validationError } from '@/lib/api/helpers';
import { z } from 'zod';

const schema = z.object({
  status: z.enum(['active', 'idle', 'offline', 'degraded']),
  last_seen_at: z.string().datetime().optional(),
});

// ---------------------------------------------------------------------------
// POST /api/agents/:id/status — webhook stub for agent heartbeat/status update
// ---------------------------------------------------------------------------
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await withDualAuth(request);
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const updatePayload = {
    status: parsed.data.status,
    last_seen_at: parsed.data.last_seen_at ?? new Date().toISOString(),
  };

  const isUuid = /^[0-9a-f-]{36}$/.test(id);
  const query = isUuid
    ? supabase.from('agents').update(updatePayload).eq('id', id).select().single()
    : supabase.from('agents').update(updatePayload).eq('name', id).select().single();

  const { data, error } = await query;
  if (error) return serverError(error.message);
  if (!data) return notFound('Agent');

  return NextResponse.json(data);
}
