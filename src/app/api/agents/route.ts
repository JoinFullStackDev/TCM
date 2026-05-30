import { NextResponse } from 'next/server';
import { withDualAuth, validationError, serverError } from '@/lib/api/helpers';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const agentStatusEnum = z.enum(['active', 'idle', 'offline', 'degraded']);

const createAgentSchema = z.object({
  name: z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/, 'Name must be lowercase alphanumeric, dash, or underscore'),
  display_name: z.string().min(1).max(128),
  description: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
  avatar_url: z.string().url().optional().or(z.string().startsWith('/').optional()),
  accent_color: z.string().max(16).optional(),
  status: agentStatusEnum.optional(),
  openclaw_id: z.string().max(256).optional(),
});

// ---------------------------------------------------------------------------
// GET /api/agents — list all registered agents
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  const auth = await withDualAuth(request);
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .order('name', { ascending: true });

  if (error) return serverError(error.message);
  return NextResponse.json(data ?? []);
}

// ---------------------------------------------------------------------------
// POST /api/agents — register a new agent (admin or bearer only)
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
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

  const body = await request.json().catch(() => null);
  const parsed = createAgentSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { data, error } = await supabase
    .from('agents')
    .insert(parsed.data)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Agent name already exists' }, { status: 409 });
    }
    return serverError(error.message);
  }

  return NextResponse.json(data, { status: 201 });
}
