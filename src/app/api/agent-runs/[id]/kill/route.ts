import { NextResponse } from 'next/server';
import { withDualAuth, notFound, serverError } from '@/lib/api/helpers';

// ---------------------------------------------------------------------------
// POST /api/agent-runs/:id/kill — send kill signal via OpenClaw (feature-flagged)
// ---------------------------------------------------------------------------
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await withDualAuth(request);
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const { id } = await params;

  const { data: run, error: fetchError } = await supabase
    .from('agent_runs')
    .select('id, session_key, status')
    .eq('id', id)
    .single();

  if (fetchError || !run) return notFound('Agent run');

  const integrationEnabled =
    process.env.OPENCLAW_INTEGRATION_ENABLED === 'true';

  let openClawSkipped = false;
  let openClawError: string | null = null;

  if (integrationEnabled) {
    const openClawUrl = process.env.OPENCLAW_API_URL;
    const openClawKey = process.env.OPENCLAW_API_KEY;

    try {
      const res = await fetch(
        `${openClawUrl}/api/sessions/${run.session_key}/kill`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openClawKey}`,
            'Content-Type': 'application/json',
          },
        },
      );
      if (!res.ok) {
        const errBody = await res.text();
        openClawError = `OpenClaw returned ${res.status}: ${errBody}`;
      }
    } catch (err) {
      openClawError = err instanceof Error ? err.message : String(err);
    }

    if (openClawError) {
      return NextResponse.json({ error: openClawError }, { status: 502 });
    }
  } else {
    openClawSkipped = true;
  }

  // Mark run as killed in our DB
  const { data: updated, error: updateError } = await supabase
    .from('agent_runs')
    .update({ status: 'killed', ended_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (updateError) return serverError(updateError.message);

  return NextResponse.json({ run: updated, openClawSkipped });
}
