import { NextResponse } from 'next/server';
import { serverError } from '@/lib/api/helpers';
import { simAuth, loadPartnerTarget, PARTNER_PUBLIC_COLUMNS } from '@/lib/partner-sim/server';
import { callPartnerApi } from '@/lib/partner-sim/client';

interface RouteContext {
  params: Promise<{ partnerId: string }>;
}

/** Re-reads GET /v1/connection and GET /v1/catalog and caches both on the partner. */
export async function POST(_request: Request, context: RouteContext) {
  const auth = await simAuth();
  if (!auth.ok) return auth.response;
  const { partnerId } = await context.params;

  const target = await loadPartnerTarget(auth.db, partnerId);
  if (!target.ok) return target.response;
  const { baseUrl, apiKey } = target;

  const [connection, catalog] = await Promise.all([
    callPartnerApi({ baseUrl, apiKey, method: 'GET', path: '/v1/connection' }),
    callPartnerApi({ baseUrl, apiKey, method: 'GET', path: '/v1/catalog' }),
  ]);

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { updated_at: now };
  if (connection.status === 200) {
    update.connection = connection.body;
    update.connection_checked_at = now;
  }
  if (catalog.status === 200) {
    update.catalog = catalog.body;
    update.catalog_fetched_at = now;
  }

  const { data, error } = await auth.db
    .from('partner_sim_partners')
    .update(update)
    .eq('id', partnerId)
    .select(PARTNER_PUBLIC_COLUMNS)
    .single();
  if (error) return serverError(error.message);

  return NextResponse.json({ partner: data, calls: { connection, catalog } });
}
