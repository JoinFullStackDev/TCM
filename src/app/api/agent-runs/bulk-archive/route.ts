import { NextResponse } from 'next/server';
import { withDualAuth, validationError, serverError } from '@/lib/api/helpers';
import { z } from 'zod';

const schema = z.object({ days: z.number().int().min(1).max(365).default(7) });

export async function POST(request: Request) {
  const auth = await withDualAuth(request);
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const cutoff = new Date(
    Date.now() - parsed.data.days * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from('agent_runs')
    .update({ archived_at: new Date().toISOString() })
    .in('status', ['done', 'failed', 'timed_out', 'killed'])
    .lt('ended_at', cutoff)
    .is('archived_at', null)
    .select('id');

  if (error) return serverError(error.message);
  return NextResponse.json({ archived: data?.length ?? 0 });
}
