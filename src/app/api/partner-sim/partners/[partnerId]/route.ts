import { NextRequest, NextResponse } from 'next/server';
import { validationError, serverError, notFound } from '@/lib/api/helpers';
import { updatePartnerSchema } from '@/lib/validations/partner-sim';
import { simAuth, PARTNER_PUBLIC_COLUMNS, encryptionKeyError } from '@/lib/partner-sim/server';
import { encryptSecret, last4, apiKeyMode, MissingEncryptionKeyError } from '@/lib/partner-sim/crypto';
import {
  docsUrlFor,
  resolveApiBase,
  webhookBaseUrl,
  webhookUrlFor,
  type SimEnvironment,
} from '@/lib/partner-sim/environments';

interface RouteContext {
  params: Promise<{ partnerId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await simAuth();
  if (!auth.ok) return auth.response;
  const { partnerId } = await context.params;

  const { data, error } = await auth.db
    .from('partner_sim_partners')
    .select(PARTNER_PUBLIC_COLUMNS)
    .eq('id', partnerId)
    .maybeSingle();
  if (error) return serverError(error.message);
  if (!data) return notFound('Partner');

  const row = data as unknown as { environment: SimEnvironment; api_base_url: string | null; api_key_set_at: string };
  // How many orders the current key has sent, for the "swap your key" reminder.
  const { count } = await auth.db
    .from('partner_sim_orders')
    .select('id', { count: 'exact', head: true })
    .eq('partner_id', partnerId)
    .gte('created_at', row.api_key_set_at);

  return NextResponse.json({
    ...(data as object),
    api_url: resolveApiBase(row),
    docs_url: docsUrlFor(row.environment),
    webhook_url: webhookUrlFor(webhookBaseUrl(request.nextUrl.origin), partnerId),
    orders_with_current_key: count ?? 0,
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await simAuth();
  if (!auth.ok) return auth.response;
  const { partnerId } = await context.params;

  const parsed = updatePartnerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error.flatten());
  const input = parsed.data;

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) update.name = input.name;
  if (input.call_mode !== undefined) update.call_mode = input.call_mode;
  if (input.webhook_response_status !== undefined) update.webhook_response_status = input.webhook_response_status;
  if (input.environment !== undefined) update.environment = input.environment;
  if (input.api_base_url !== undefined) update.api_base_url = input.api_base_url;
  if (input.environment !== undefined || input.api_base_url !== undefined) {
    // Possibly a different FullStackRx: drop the cached answers so nothing stale is used.
    update.connection = null;
    update.connection_checked_at = null;
    update.catalog = null;
    update.catalog_fetched_at = null;
  }
  try {
    if (input.api_key !== undefined) {
      update.api_key_encrypted = encryptSecret(input.api_key);
      update.api_key_last4 = last4(input.api_key);
      update.api_key_mode = apiKeyMode(input.api_key);
      update.api_key_set_at = new Date().toISOString();
    }
    if (input.webhook_secret === null) {
      update.webhook_secret_encrypted = null;
      update.webhook_secret_last4 = null;
    } else if (input.webhook_secret !== undefined) {
      update.webhook_secret_encrypted = encryptSecret(input.webhook_secret);
      update.webhook_secret_last4 = last4(input.webhook_secret);
    }
  } catch (err) {
    if (err instanceof MissingEncryptionKeyError) return encryptionKeyError();
    throw err;
  }

  const { data, error } = await auth.db
    .from('partner_sim_partners')
    .update(update)
    .eq('id', partnerId)
    .select(PARTNER_PUBLIC_COLUMNS)
    .maybeSingle();
  if (error) return serverError(error.message);
  if (!data) return notFound('Partner');
  return NextResponse.json(data);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await simAuth();
  if (!auth.ok) return auth.response;
  const { partnerId } = await context.params;

  const { error } = await auth.db.from('partner_sim_partners').delete().eq('id', partnerId);
  if (error) return serverError(error.message);
  return new NextResponse(null, { status: 204 });
}
