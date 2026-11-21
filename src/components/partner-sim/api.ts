'use client';

/** The UI's Partner API actions. TCM's server makes every call to FullStackRx. */

import { readError, type CallResult, type SimOrder, type SimPartner } from './types';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function postJson<T>(url: string, body: unknown): Promise<Result<T>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) return { ok: false, error: await readError(res) };
  return { ok: true, data: (await res.json()) as T };
}

/** The saved API key and webhook secret in plain text, for "show / copy". */
export async function getCredentials(
  partnerId: string,
): Promise<Result<{ api_key: string; webhook_secret: string | null }>> {
  const res = await fetch(`/api/partner-sim/partners/${partnerId}/credentials`, { cache: 'no-store' });
  if (!res.ok) return { ok: false, error: await readError(res) };
  return { ok: true, data: await res.json() };
}

export function syncPartner(partner: SimPartner) {
  return postJson<{ partner: SimPartner; calls: { connection: CallResult; catalog: CallResult } }>(
    `/api/partner-sim/partners/${partner.id}/sync`,
    {},
  );
}

export interface SubmitBody {
  request: Record<string, unknown>;
  idempotency_key?: string;
  send_idempotency_key?: boolean;
  preset?: string;
  retry_of?: string;
}

export function submitOrder(partner: SimPartner, body: SubmitBody) {
  return postJson<{ order: SimOrder; call: CallResult }>(`/api/partner-sim/partners/${partner.id}/orders`, body);
}

export function refreshOrder(order: SimOrder) {
  return postJson<{ order: SimOrder | null; call: CallResult }>(`/api/partner-sim/orders/${order.id}/refresh`, {});
}

export function cancelOrder(order: SimOrder, reason: string) {
  return postJson<{ order: SimOrder | null; call: CallResult }>(`/api/partner-sim/orders/${order.id}/cancel`, { reason });
}
