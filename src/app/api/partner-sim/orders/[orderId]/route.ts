import { NextResponse } from 'next/server';
import { serverError, notFound } from '@/lib/api/helpers';
import { simAuth, ORDER_COLUMNS, EVENT_COLUMNS } from '@/lib/partner-sim/server';

interface RouteContext {
  params: Promise<{ orderId: string }>;
}

/** One simulator order, its retries, and the webhooks FullStackRx sent about it. */
export async function GET(_request: Request, context: RouteContext) {
  const auth = await simAuth();
  if (!auth.ok) return auth.response;
  const { orderId } = await context.params;

  const { data: order, error } = await auth.db
    .from('partner_sim_orders')
    .select(ORDER_COLUMNS)
    .eq('id', orderId)
    .maybeSingle();
  if (error) return serverError(error.message);
  if (!order) return notFound('Order');
  const row = order as unknown as { partner_id: string; fsrx_order_id: string | null; idempotency_key: string };

  const [{ data: attempts }, { data: events }] = await Promise.all([
    // Every request sent with the same Idempotency-Key (the original and its retries).
    row.idempotency_key
      ? auth.db
          .from('partner_sim_orders')
          .select('id, response_status, response_headers, created_at, retry_of')
          .eq('partner_id', row.partner_id)
          .eq('idempotency_key', row.idempotency_key)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] }),
    row.fsrx_order_id
      ? auth.db
          .from('partner_sim_webhook_events')
          .select(EVENT_COLUMNS)
          .eq('partner_id', row.partner_id)
          .eq('fsrx_order_id', row.fsrx_order_id)
          // Delivery order isn't guaranteed; the event's own createdAt is.
          .order('event_created_at', { ascending: true, nullsFirst: false })
      : Promise.resolve({ data: [] }),
  ]);

  return NextResponse.json({ order, attempts: attempts ?? [], events: events ?? [] });
}
