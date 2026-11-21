/**
 * Server helpers for the Partner API simulator's route handlers.
 *
 * The simulator tables have RLS on with no policies, so they're reachable only with the
 * service-role client. Every handler first checks the caller's TCM role with withAuth,
 * then talks to the tables through `db`.
 */

import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { withAuth, notFound, serverError } from '@/lib/api/helpers';
import { createServiceClient } from '@/lib/supabase/server';
import type { Permission } from '@/lib/auth/rbac';
import { decryptSecret, MissingEncryptionKeyError } from './crypto';
import { environmentApiUrl, ENVIRONMENT_LABELS, type SimEnvironment } from './environments';

/** Everything about a partner that is safe to send to the browser. */
export const PARTNER_PUBLIC_COLUMNS =
  'id, name, environment, api_key_last4, api_key_mode, webhook_secret_last4, webhook_response_status, ' +
  'connection, connection_checked_at, catalog, catalog_fetched_at, created_by, created_at, updated_at';

/** Everything about an order row the browser sees. */
export const ORDER_COLUMNS =
  'id, partner_id, partner_order_id, preset, idempotency_key, retry_of, request_body, response_status, ' +
  'response_body, response_headers, duration_ms, error_message, fsrx_order_id, status, last_order, ' +
  'last_refreshed_at, created_by, created_at';

export const EVENT_COLUMNS =
  'id, partner_id, event_id, event_type, event_created_at, livemode, fsrx_order_id, partner_order_id, ' +
  'item_id, signature_valid, signature_error, headers, body, delivery_count, received_at, last_received_at';

type SimAuth =
  | { ok: true; userId: string; db: SupabaseClient }
  | { ok: false; response: NextResponse };

export async function simAuth(permission: Permission = 'write'): Promise<SimAuth> {
  const auth = await withAuth(permission);
  if (!auth.ok) return auth;
  const db = await createServiceClient();
  return { ok: true, userId: auth.ctx.user.id, db };
}

export function encryptionKeyError() {
  return NextResponse.json(
    { error: 'The simulator is not configured: set PARTNER_SIM_ENCRYPTION_KEY (64 hex characters) on the server.' },
    { status: 500 },
  );
}

interface PartnerSecretsRow {
  id: string;
  name: string;
  environment: SimEnvironment;
  api_key_encrypted: string;
  webhook_secret_encrypted: string | null;
}

export type PartnerTarget =
  | { ok: true; partner: PartnerSecretsRow; apiKey: string; baseUrl: string }
  | { ok: false; response: NextResponse };

/** Loads a partner with its decrypted API key and its environment's base URL. */
export async function loadPartnerTarget(db: SupabaseClient, partnerId: string): Promise<PartnerTarget> {
  const { data, error } = await db
    .from('partner_sim_partners')
    .select('id, name, environment, api_key_encrypted, webhook_secret_encrypted')
    .eq('id', partnerId)
    .maybeSingle();
  if (error) return { ok: false, response: serverError(error.message) };
  if (!data) return { ok: false, response: notFound('Partner') };

  const partner = data as PartnerSecretsRow;
  const baseUrl = environmentApiUrl(partner.environment);
  if (!baseUrl) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: `No API URL is configured for ${ENVIRONMENT_LABELS[partner.environment]}. Set PARTNER_SIM_${partner.environment.toUpperCase()}_API_URL on the server.`,
        },
        { status: 500 },
      ),
    };
  }
  try {
    return { ok: true, partner, apiKey: decryptSecret(partner.api_key_encrypted), baseUrl };
  } catch (err) {
    if (err instanceof MissingEncryptionKeyError) return { ok: false, response: encryptionKeyError() };
    return {
      ok: false,
      response: serverError('Could not decrypt the stored API key. Was PARTNER_SIM_ENCRYPTION_KEY changed? Re-enter the key.'),
    };
  }
}

/** Pulls the order's status and FullStackRx id out of a create/get/cancel answer. */
export function orderSummaryFrom(body: unknown): { fsrxOrderId: string | null; status: string | null } {
  if (!body || typeof body !== 'object') return { fsrxOrderId: null, status: null };
  const b = body as { id?: unknown; status?: unknown; code?: unknown };
  // A problem+json body also has a numeric status; only an order has a string one.
  if (typeof b.id !== 'string') return { fsrxOrderId: null, status: null };
  return { fsrxOrderId: b.id, status: typeof b.status === 'string' ? b.status : null };
}
