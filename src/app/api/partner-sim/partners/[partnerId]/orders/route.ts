import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { validationError, serverError } from '@/lib/api/helpers';
import { submitOrderSchema } from '@/lib/validations/partner-sim';
import { simAuth, loadPartnerTarget, orderSummaryFrom, ORDER_COLUMNS } from '@/lib/partner-sim/server';
import { callPartnerApi } from '@/lib/partner-sim/client';

interface RouteContext {
  params: Promise<{ partnerId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await simAuth();
  if (!auth.ok) return auth.response;
  const { partnerId } = await context.params;

  const { data, error } = await auth.db
    .from('partner_sim_orders')
    .select(ORDER_COLUMNS)
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return serverError(error.message);
  return NextResponse.json(data ?? []);
}

/** Sends POST /v1/orders and records the request with FullStackRx's answer. */
export async function POST(request: Request, context: RouteContext) {
  const auth = await simAuth();
  if (!auth.ok) return auth.response;
  const { partnerId } = await context.params;

  const parsed = submitOrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error.flatten());
  const input = parsed.data;

  const target = await loadPartnerTarget(auth.db, partnerId);
  if (!target.ok) return target.response;

  const idempotencyKey = input.send_idempotency_key ? input.idempotency_key ?? randomUUID() : '';
  const call = await callPartnerApi({
    baseUrl: target.baseUrl,
    apiKey: target.apiKey,
    method: 'POST',
    path: '/v1/orders',
    body: input.request,
    idempotencyKey: idempotencyKey || undefined,
  });

  const summary = orderSummaryFrom(call.body);
  const partnerOrderId = typeof input.request.partnerOrderId === 'string' ? input.request.partnerOrderId : null;

  const { data: order, error } = await auth.db
    .from('partner_sim_orders')
    .insert({
      partner_id: partnerId,
      partner_order_id: partnerOrderId,
      preset: input.preset ?? null,
      idempotency_key: idempotencyKey,
      retry_of: input.retry_of ?? null,
      request_body: input.request,
      response_status: call.status,
      response_body: call.body,
      response_headers: call.headers,
      duration_ms: call.durationMs,
      error_message: call.error ?? null,
      fsrx_order_id: summary.fsrxOrderId,
      status: summary.status,
      last_order: summary.fsrxOrderId ? call.body : null,
      created_by: auth.userId,
    })
    .select(ORDER_COLUMNS)
    .single();
  if (error) return serverError(error.message);

  // FullStackRx took the order, so remember its prescriber for "reuse a saved prescriber".
  if (call.status === 201) await rememberPrescriber(auth.db, partnerId, input.request.prescriber);

  return NextResponse.json({ order, call }, { status: 201 });
}

async function rememberPrescriber(
  db: SupabaseClient,
  partnerId: string,
  prescriber: unknown,
) {
  if (!prescriber || typeof prescriber !== 'object') return;
  const p = prescriber as {
    npi?: unknown;
    firstName?: unknown;
    lastName?: unknown;
    stateLicense?: { state?: unknown; number?: unknown };
  };
  const npi = typeof p.npi === 'string' ? p.npi : '';
  const state = typeof p.stateLicense?.state === 'string' ? p.stateLicense.state : '';
  if (!/^\d{10}$/.test(npi) || !/^[A-Z]{2}$/.test(state)) return;

  await db.from('partner_sim_prescribers').upsert(
    {
      partner_id: partnerId,
      npi,
      first_name: String(p.firstName ?? '').slice(0, 100) || 'Unknown',
      last_name: String(p.lastName ?? '').slice(0, 100) || 'Unknown',
      license_state: state,
      license_number: String(p.stateLicense?.number ?? '').slice(0, 50) || 'Unknown',
      last_used_at: new Date().toISOString(),
    },
    { onConflict: 'partner_id,npi' },
  );
}
