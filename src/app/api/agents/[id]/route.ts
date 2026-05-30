import { NextResponse } from 'next/server';
import { withDualAuth, notFound, serverError, validationError } from '@/lib/api/helpers';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const agentStatusEnum = z.enum(['active', 'idle', 'offline', 'degraded']);

const updateAgentSchema = z.object({
  display_name: z.string().min(1).max(128).optional(),
  description: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
  avatar_url: z.string().optional().nullable(),
  accent_color: z.string().max(16).optional(),
  status: agentStatusEnum.optional(),
  openclaw_id: z.string().max(256).optional().nullable(),
  last_seen_at: z.string().datetime().optional().nullable(),
});

// ---------------------------------------------------------------------------
// GET /api/agents/:id
// ---------------------------------------------------------------------------
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await withDualAuth(request);
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { id } = await params;

  // Support lookup by name or UUID
  const isUuid = /^[0-9a-f-]{36}$/.test(id);
  const query = isUuid
    ? supabase.from('agents').select('*').eq('id', id).single()
    : supabase.from('agents').select('*').eq('name', id).single();

  const { data, error } = await query;
  if (error || !data) return notFound('Agent');

  return NextResponse.json(data);
}

// ---------------------------------------------------------------------------
// PATCH /api/agents/:id — update agent (admin or bearer only)
// ---------------------------------------------------------------------------
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await withDualAuth(request);
  if (!auth.ok) return auth.response;
  const { supabase, mode } = auth.ctx;

  // For session-based requests, require admin role
  if (mode === 'session') {
    const supabaseUser = await createClient();
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await supabaseUser.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateAgentSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const isUuid = /^[0-9a-f-]{36}$/.test(id);
  const query = isUuid
    ? supabase.from('agents').update(parsed.data).eq('id', id).select().single()
    : supabase.from('agents').update(parsed.data).eq('name', id).select().single();

  const { data, error } = await query;
  if (error) return serverError(error.message);
  if (!data) return notFound('Agent');

  return NextResponse.json(data);
}
