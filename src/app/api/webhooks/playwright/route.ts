import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { playwrightWebhookSchema } from '@/lib/validations/webhook';
import { processPlaywrightWebhook } from '@/lib/webhooks/process-playwright';

export async function POST(request: Request) {
  const supabase = await createServiceClient();

  const apiKey = request.headers.get('X-API-Key') ?? request.headers.get('x-api-key');
  const expectedKey = process.env.WEBHOOK_API_KEY;

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const projectId =
    body && typeof body === 'object' && 'project_id' in body
      ? (body as Record<string, unknown>).project_id as string
      : null;

  if (!apiKey || apiKey !== expectedKey) {
    const { data: event } = await supabase
      .from('webhook_events')
      .insert({
        project_id: projectId ?? '00000000-0000-0000-0000-000000000000',
        provider: 'playwright',
        event_type: 'test_run_completed',
        payload: (body as Record<string, unknown>) ?? {},
        status: 'failed',
        error_message: 'Invalid API key',
      })
      .select('id')
      .single();

    return NextResponse.json(
      { error: 'Invalid API key', event_id: event?.id ?? null },
      { status: 401 },
    );
  }

  const parsed = playwrightWebhookSchema.safeParse(body);
  if (!parsed.success) {
    const issues = 'issues' in parsed.error ? parsed.error.issues : [];
    const errorMsg = (issues as Array<{ path: (string | number)[]; message: string }>)
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join('; ') || 'Validation failed';

    const { data: event } = await supabase
      .from('webhook_events')
      .insert({
        project_id: projectId ?? '00000000-0000-0000-0000-000000000000',
        provider: 'playwright',
        event_type: 'test_run_completed',
        payload: (body as Record<string, unknown>) ?? {},
        status: 'failed',
        error_message: errorMsg,
      })
      .select('id')
      .single();

    return NextResponse.json(
      { error: 'Validation failed', details: errorMsg, event_id: event?.id ?? null },
      { status: 400 },
    );
  }

  const { data: event, error: eventErr } = await supabase
    .from('webhook_events')
    .insert({
      project_id: parsed.data.project_id,
      provider: 'playwright',
      event_type: parsed.data.event_type,
      payload: parsed.data as unknown as Record<string, unknown>,
      status: 'pending',
    })
    .select('id')
    .single();

  if (eventErr || !event) {
    return NextResponse.json(
      { error: 'Failed to log webhook event' },
      { status: 500 },
    );
  }

  await supabase
    .from('webhook_events')
    .update({ status: 'processing' })
    .eq('id', event.id);

  const result = await processPlaywrightWebhook(supabase, event.id, parsed.data);

  if (!result.success) {
    await supabase
      .from('webhook_events')
      .update({
        status: 'failed',
        error_message: result.error,
        processed_at: new Date().toISOString(),
      })
      .eq('id', event.id);
  }

  return NextResponse.json(
    {
      event_id: event.id,
      test_run_id: result.test_run_id ?? null,
      matched_cases: result.matched_cases,
      unmatched_cases: result.unmatched_cases,
      status: result.success ? 'accepted' : 'failed',
      error: result.error ?? null,
    },
    { status: result.success ? 202 : 500 },
  );
}
