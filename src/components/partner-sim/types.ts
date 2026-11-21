import type { PartnerCatalog, PartnerConnection, PartnerOrderResponse } from '@/lib/partner-sim/types';
import type { SimEnvironment, EnvironmentInfo } from '@/lib/partner-sim/environments';

export interface SimPartner {
  id: string;
  name: string;
  environment: SimEnvironment;
  api_key_last4: string;
  api_key_mode: 'test' | 'live';
  webhook_secret_last4: string | null;
  webhook_response_status: number;
  connection: PartnerConnection | null;
  connection_checked_at: string | null;
  catalog: PartnerCatalog | null;
  catalog_fetched_at: string | null;
  created_at: string;
  updated_at: string;
  // Only on GET /api/partner-sim/partners/[id]
  api_url?: string | null;
  docs_url?: string | null;
  webhook_url?: string;
}

export interface SimPartnersResponse {
  partners: SimPartner[];
  environments: EnvironmentInfo[];
  webhookBaseUrl: string;
  encryptionConfigured: boolean;
}

export interface SimPrescriber {
  id: string;
  partner_id: string;
  npi: string;
  first_name: string;
  last_name: string;
  license_state: string;
  license_number: string;
  note: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface SimOrder {
  id: string;
  partner_id: string;
  partner_order_id: string | null;
  preset: string | null;
  idempotency_key: string;
  retry_of: string | null;
  request_body: Record<string, unknown>;
  response_status: number | null;
  response_body: unknown;
  response_headers: Record<string, string> | null;
  duration_ms: number | null;
  error_message: string | null;
  fsrx_order_id: string | null;
  status: string | null;
  last_order: PartnerOrderResponse | null;
  last_refreshed_at: string | null;
  created_at: string;
}

export interface SimEvent {
  id: string;
  partner_id: string;
  event_id: string | null;
  event_type: string | null;
  event_created_at: string | null;
  livemode: boolean | null;
  fsrx_order_id: string | null;
  partner_order_id: string | null;
  item_id: string | null;
  signature_valid: boolean;
  signature_error: string | null;
  headers: Record<string, string> | null;
  body: unknown;
  delivery_count: number;
  received_at: string;
  last_received_at: string;
}

export interface CallResult {
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  status: number | null;
  ok: boolean;
  headers: Record<string, string>;
  body: unknown;
  durationMs: number;
  error?: string;
}

/** The error code from a problem+json body, if there is one. */
export function problemCode(body: unknown): string | null {
  if (body && typeof body === 'object' && typeof (body as { code?: unknown }).code === 'string') {
    return (body as { code: string }).code;
  }
  return null;
}

export async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.error === 'string') {
      const details = body.details?.fieldErrors
        ? Object.entries(body.details.fieldErrors as Record<string, string[]>)
            .map(([k, v]) => `${k}: ${v.join(', ')}`)
            .join('; ')
        : '';
      return details ? `${body.error} (${details})` : body.error;
    }
  } catch {
    // fall through
  }
  return `Request failed (${res.status})`;
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}
