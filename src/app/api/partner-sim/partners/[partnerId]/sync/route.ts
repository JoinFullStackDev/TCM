import { NextResponse } from 'next/server';
import { serverError } from '@/lib/api/helpers';
import { simAuth, loadPartnerTarget, PARTNER_PUBLIC_COLUMNS } from '@/lib/partner-sim/server';
import { callPartnerApi } from '@/lib/partner-sim/client';

interface RouteContext {
  params: Promise<{ partnerId: string }>;
}

/** Re-reads GET {prefix}/connection and {prefix}/catalog and caches both on the partner. */
export async function POST(_request: Request, context: RouteContext) {
  const auth = await simAuth();
  if (!auth.ok) return auth.response;
  const { partnerId } = await context.params;

  const target = await loadPartnerTarget(auth.db, partnerId);
  if (!target.ok) return target.response;
  const { baseUrl, apiKey } = target;
  const [connection, catalog] = await Promise.all([
    callPartnerApi({ baseUrl, apiKey, method: 'GET', path: '/connection' }),
    callPartnerApi({ baseUrl, apiKey, method: 'GET', path: '/catalog' }),
  ]);
  const calls = { connection, catalog };

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { updated_at: now };
  if (calls.connection.status === 200) {
    update.connection = calls.connection.body;
    update.connection_checked_at = now;
  }
  if (calls.catalog.status === 200) {
    update.catalog = calls.catalog.body;
    update.catalog_fetched_at = now;
  }

  const { data, error } = await auth.db
    .from('partner_sim_partners')
    .update(update)
    .eq('id', partnerId)
    .select(PARTNER_PUBLIC_COLUMNS)
    .maybeSingle();
  if (error) return serverError(error.message);
  if (!data) return NextResponse.json({ error: 'Partner not found' }, { status: 404 });

  return NextResponse.json({ partner: data, calls });
}
