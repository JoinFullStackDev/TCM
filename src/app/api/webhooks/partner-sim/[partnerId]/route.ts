/**
 * Public receiver for FullStackRx partner webhooks, one URL per simulator partner.
 * QA pastes this URL into the connection's Webhooks tab in FullStackRx.
 *
 * Public because FullStackRx can't hold a TCM session (middleware exempts /api/webhooks).
 * It verifies FullStackRx-Signature with the partner's stored whsec_ secret, stores every
 * delivery (valid or not, deduped on event id) and answers with the partner's configured
 * status (200 by default; set 500 to watch FullStackRx retry).
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { decryptSecret } from '@/lib/partner-sim/crypto';
import { verifySignature } from '@/lib/partner-sim/signature';
import { indexEvent, KEPT_WEBHOOK_HEADERS } from '@/lib/partner-sim/webhook-events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 512 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RouteContext {
  params: Promise<{ partnerId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { partnerId } = await context.params;
  if (!UUID.test(partnerId)) return NextResponse.json({ error: 'Unknown endpoint' }, { status: 404 });

  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) return NextResponse.json({ error: 'Body too large' }, { status: 413 });
  // Verify over the exact bytes FullStackRx signed, so read the raw body before parsing.
  const raw = Buffer.from(await request.arrayBuffer());
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: 'Body too large' }, { status: 413 });

  const db = await createServiceClient();
  const { data: partner } = await db
    .from('partner_sim_partners')
    .select('id, webhook_secret_encrypted, webhook_response_status')
    .eq('id', partnerId)
    .maybeSingle();
  if (!partner) return NextResponse.json({ error: 'Unknown endpoint' }, { status: 404 });

  let secret: string | null = null;
  let decryptFailed = false;
  if (partner.webhook_secret_encrypted) {
    try {
      secret = decryptSecret(partner.webhook_secret_encrypted);
    } catch {
      decryptFailed = true;
    }
  }
  const signature = verifySignature({
    header: request.headers.get('fullstackrx-signature'),
    rawBody: raw,
    secret,
  });

  const rawText = raw.toString('utf8');
  let body: unknown = null;
  try {
    body = JSON.parse(rawText);
  } catch {
    body = null;
  }

  const headers: Record<string, string> = {};
  for (const name of KEPT_WEBHOOK_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) headers[name] = value;
  }

  const fields = indexEvent(body, request.headers);
  const now = new Date().toISOString();
  const { error: insertError } = await db.from('partner_sim_webhook_events').insert({
    partner_id: partnerId,
    ...fields,
    signature_valid: signature.valid,
    signature_error: signature.valid ? null : decryptFailed ? 'decrypt_failed' : signature.reason,
    headers,
    body,
    raw_body: body === null ? rawText : null,
    received_at: now,
    last_received_at: now,
  });

  let duplicate = false;
  if (insertError?.code === '23505' && fields.event_id) {
    // A redelivery of an event we already have: count it, keep the first copy.
    duplicate = true;
    const { data: existing } = await db
      .from('partner_sim_webhook_events')
      .select('id, delivery_count')
      .eq('partner_id', partnerId)
      .eq('event_id', fields.event_id)
      .maybeSingle();
    if (existing) {
      await db
        .from('partner_sim_webhook_events')
        .update({ delivery_count: (existing.delivery_count ?? 1) + 1, last_received_at: now })
        .eq('id', existing.id);
    }
  } else if (insertError) {
    console.error('[partner-sim webhook] insert failed', insertError.message);
    return NextResponse.json({ error: 'Could not store the event' }, { status: 500 });
  }

  return NextResponse.json(
    { received: true, duplicate, signatureValid: signature.valid },
    { status: partner.webhook_response_status ?? 200 },
  );
}
