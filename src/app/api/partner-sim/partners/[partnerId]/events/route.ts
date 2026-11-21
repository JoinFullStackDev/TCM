import { NextRequest, NextResponse } from 'next/server';
import { serverError } from '@/lib/api/helpers';
import { simAuth, EVENT_COLUMNS } from '@/lib/partner-sim/server';

interface RouteContext {
  params: Promise<{ partnerId: string }>;
}

/** Webhooks received for a partner, newest first (or one order's, oldest first). */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await simAuth();
  if (!auth.ok) return auth.response;
  const { partnerId } = await context.params;
  const fsrxOrderId = request.nextUrl.searchParams.get('fsrx_order_id');

  const base = auth.db.from('partner_sim_webhook_events').select(EVENT_COLUMNS).eq('partner_id', partnerId);
  const { data, error } = fsrxOrderId
    ? await base.eq('fsrx_order_id', fsrxOrderId).order('event_created_at', { ascending: true, nullsFirst: false })
    : await base.order('last_received_at', { ascending: false }).limit(200);
  if (error) return serverError(error.message);
  return NextResponse.json(data ?? []);
}
