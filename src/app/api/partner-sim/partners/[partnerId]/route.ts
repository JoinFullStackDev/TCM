import { NextRequest, NextResponse } from 'next/server';
import { validationError, serverError, notFound } from '@/lib/api/helpers';
import { updatePartnerSchema } from '@/lib/validations/partner-sim';
import { simAuth, PARTNER_PUBLIC_COLUMNS, encryptionKeyError } from '@/lib/partner-sim/server';
import { encryptSecret, last4, apiKeyMode, MissingEncryptionKeyError } from '@/lib/partner-sim/crypto';
import {
  environmentApiUrl,
  environmentDocsUrl,
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

  const env = (data as unknown as { environment: SimEnvironment }).environment;
  return NextResponse.json({
    ...(data as object),
    api_url: environmentApiUrl(env),
    docs_url: environmentDocsUrl(env),
    webhook_url: webhookUrlFor(webhookBaseUrl(request.nextUrl.origin), partnerId),
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
  if (input.webhook_response_status !== undefined) update.webhook_response_status = input.webhook_response_status;
  if (input.environment !== undefined) {
    update.environment = input.environment;
    // A different environment means a different connection: drop the cached answers.
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
