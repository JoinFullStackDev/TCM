import { NextResponse } from 'next/server';
import { serverError, notFound, validationError } from '@/lib/api/helpers';
import { refreshOrderSchema } from '@/lib/validations/partner-sim';
import { simAuth, loadPartnerTarget, orderSummaryFrom, ORDER_COLUMNS } from '@/lib/partner-sim/server';
import { callPartnerApi } from '@/lib/partner-sim/client';

interface RouteContext {
  params: Promise<{ orderId: string }>;
}

/**
 * GET /v1/orders/{id}: per-item status and tracking. With `call` in the body the browser
 * already made the request and TCM only records the answer.
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await simAuth();
  if (!auth.ok) return auth.response;
  const { orderId } = await context.params;

  const parsed = refreshOrderSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { data: row, error } = await auth.db
    .from('partner_sim_orders')
    .select('id, partner_id, fsrx_order_id')
    .eq('id', orderId)
    .maybeSingle();
  if (error) return serverError(error.message);
  if (!row) return notFound('Order');
  if (!row.fsrx_order_id) {
    return NextResponse.json({ error: 'FullStackRx never accepted this request, so there is no order to read.' }, { status: 409 });
  }

  let call = parsed.data.call;
  if (!call) {
    const target = await loadPartnerTarget(auth.db, row.partner_id);
    if (!target.ok) return target.response;
    call = await callPartnerApi({
      baseUrl: target.baseUrl,
      apiKey: target.apiKey,
      method: 'GET',
      path: `/v1/orders/${encodeURIComponent(row.fsrx_order_id)}`,
    });
  }

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
