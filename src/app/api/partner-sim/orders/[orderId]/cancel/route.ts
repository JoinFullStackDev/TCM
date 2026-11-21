import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { serverError, notFound, validationError } from '@/lib/api/helpers';
import { cancelOrderSchema } from '@/lib/validations/partner-sim';
import { simAuth, loadPartnerTarget, orderSummaryFrom, ORDER_COLUMNS } from '@/lib/partner-sim/server';
import { callPartnerApi } from '@/lib/partner-sim/client';

interface RouteContext {
  params: Promise<{ orderId: string }>;
}

/** POST /v1/orders/{id}/cancel with a fresh Idempotency-Key. */
export async function POST(request: Request, context: RouteContext) {
  const auth = await simAuth();
  if (!auth.ok) return auth.response;
  const { orderId } = await context.params;

  const parsed = cancelOrderSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { data: row, error } = await auth.db
    .from('partner_sim_orders')
    .select('id, partner_id, fsrx_order_id')
    .eq('id', orderId)
    .maybeSingle();
  if (error) return serverError(error.message);
  if (!row) return notFound('Order');
  if (!row.fsrx_order_id) {
    return NextResponse.json({ error: 'FullStackRx never accepted this request, so there is no order to cancel.' }, { status: 409 });
  }

  const target = await loadPartnerTarget(auth.db, row.partner_id);
  if (!target.ok) return target.response;
  const call = await callPartnerApi({
    baseUrl: target.baseUrl,
    apiKey: target.apiKey,
    method: 'POST',
    path: `/v1/orders/${encodeURIComponent(row.fsrx_order_id)}/cancel`,
    body: parsed.data.reason ? { reason: parsed.data.reason } : {},
    idempotencyKey: randomUUID(),
  });

  let order = null;
  if (call.status === 200) {
    const { data, error: updateError } = await auth.db
      .from('partner_sim_orders')
      .update({
        status: orderSummaryFrom(call.body).status,
        last_order: call.body,
        last_refreshed_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select(ORDER_COLUMNS)
      .single();
    if (updateError) return serverError(updateError.message);
    order = data;
  }

  return NextResponse.json({ order, call });
}
