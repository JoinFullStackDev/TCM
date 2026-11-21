import { NextRequest, NextResponse } from 'next/server';
import { validationError, serverError } from '@/lib/api/helpers';
import { createPartnerSchema } from '@/lib/validations/partner-sim';
import { simAuth, PARTNER_PUBLIC_COLUMNS, encryptionKeyError } from '@/lib/partner-sim/server';
import { encryptSecret, last4, apiKeyMode, MissingEncryptionKeyError } from '@/lib/partner-sim/crypto';
import { listEnvironments, webhookBaseUrl } from '@/lib/partner-sim/environments';

export async function GET(request: NextRequest) {
  const auth = await simAuth();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.db
    .from('partner_sim_partners')
    .select(PARTNER_PUBLIC_COLUMNS)
    .order('created_at', { ascending: false });
  if (error) return serverError(error.message);

  return NextResponse.json({
    partners: data ?? [],
    environments: listEnvironments(),
    webhookBaseUrl: webhookBaseUrl(request.nextUrl.origin),
    encryptionConfigured: /^[0-9a-fA-F]{64}$/.test(process.env.PARTNER_SIM_ENCRYPTION_KEY ?? ''),
  });
}

export async function POST(request: Request) {
  const auth = await simAuth();
  if (!auth.ok) return auth.response;

  const parsed = createPartnerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error.flatten());
  const input = parsed.data;

  let apiKeyEncrypted: string;
  let secretEncrypted: string | null = null;
  try {
    apiKeyEncrypted = encryptSecret(input.api_key);
    if (input.webhook_secret) secretEncrypted = encryptSecret(input.webhook_secret);
  } catch (err) {
    if (err instanceof MissingEncryptionKeyError) return encryptionKeyError();
    throw err;
  }

  const { data, error } = await auth.db
    .from('partner_sim_partners')
    .insert({
      name: input.name,
      environment: input.environment,
      api_key_encrypted: apiKeyEncrypted,
      api_key_last4: last4(input.api_key),
      api_key_mode: apiKeyMode(input.api_key),
      webhook_secret_encrypted: secretEncrypted,
      webhook_secret_last4: input.webhook_secret ? last4(input.webhook_secret) : null,
      webhook_response_status: input.webhook_response_status ?? 200,
      created_by: auth.userId,
    })
    .select(PARTNER_PUBLIC_COLUMNS)
    .single();
  if (error) return serverError(error.message);

  return NextResponse.json(data, { status: 201 });
}
