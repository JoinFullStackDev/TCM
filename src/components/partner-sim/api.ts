'use client';

/**
 * Every Partner API action the UI takes, routed by the partner's call mode:
 *  - 'browser': this browser calls FullStackRx (QA is VPN-only), then TCM records the answer.
 *  - 'server':  TCM's server calls FullStackRx and records the answer.
 */

import { performPartnerCall } from '@/lib/partner-sim/transport';
import { readError, type CallResult, type SimOrder, type SimPartner } from './types';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

interface Credentials {
  api_key: string;
  webhook_secret: string | null;
  api_url: string;
}

const credentialCache = new Map<string, Credentials>();

export function forgetCredentials(partnerId: string) {
  credentialCache.delete(partnerId);
}

export async function getCredentials(partnerId: string): Promise<Result<Credentials>> {
  const cached = credentialCache.get(partnerId);
  if (cached) return { ok: true, data: cached };
  const res = await fetch(`/api/partner-sim/partners/${partnerId}/credentials`, { cache: 'no-store' });
  if (!res.ok) return { ok: false, error: await readError(res) };
  const data = (await res.json()) as Credentials;
  credentialCache.set(partnerId, data);
  return { ok: true, data };
}

async function browserCall(
  partner: SimPartner,
  req: { method: 'GET' | 'POST'; path: string; body?: unknown; idempotencyKey?: string },
): Promise<Result<CallResult>> {
  const creds = await getCredentials(partner.id);
  if (!creds.ok) return creds;
  const call = await performPartnerCall({
    ...req,
    baseUrl: creds.data.api_url,
    apiKey: creds.data.api_key,
    runtime: 'browser',
  });
  return { ok: true, data: call };
}

async function postJson<T>(url: string, body: unknown): Promise<Result<T>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, error: await readError(res) };
  return { ok: true, data: (await res.json()) as T };
}

const viaBrowser = (partner: SimPartner) => partner.call_mode === 'browser';

export async function syncPartner(partner: SimPartner) {
  let calls: { connection: CallResult; catalog: CallResult } | undefined;
  if (viaBrowser(partner)) {
    const [connection, catalog] = await Promise.all([
      browserCall(partner, { method: 'GET', path: '/v1/connection' }),
      browserCall(partner, { method: 'GET', path: '/v1/catalog' }),
    ]);
    if (!connection.ok) return connection;
    if (!catalog.ok) return catalog;
    calls = { connection: connection.data, catalog: catalog.data };
  }
  return postJson<{ partner: SimPartner; calls: { connection: CallResult; catalog: CallResult } }>(
    `/api/partner-sim/partners/${partner.id}/sync`,
    { calls },
  );
}

export interface SubmitBody {
  request: Record<string, unknown>;
  idempotency_key?: string;
  send_idempotency_key?: boolean;
  preset?: string;
  retry_of?: string;
}

export async function submitOrder(partner: SimPartner, body: SubmitBody) {
  const send = body.send_idempotency_key !== false;
  if (!viaBrowser(partner)) {
    return postJson<{ order: SimOrder; call: CallResult }>(`/api/partner-sim/partners/${partner.id}/orders`, body);
  }
  const idempotencyKey = send ? body.idempotency_key ?? crypto.randomUUID() : undefined;
  const call = await browserCall(partner, { method: 'POST', path: '/v1/orders', body: body.request, idempotencyKey });
  if (!call.ok) return call;
  return postJson<{ order: SimOrder; call: CallResult }>(`/api/partner-sim/partners/${partner.id}/orders`, {
    ...body,
    idempotency_key: idempotencyKey,
    send_idempotency_key: send,
    call: call.data,
  });
}

export async function refreshOrder(partner: SimPartner, order: SimOrder) {
  let call: CallResult | undefined;
  if (viaBrowser(partner) && order.fsrx_order_id) {
    const r = await browserCall(partner, { method: 'GET', path: `/v1/orders/${encodeURIComponent(order.fsrx_order_id)}` });
    if (!r.ok) return r;
    call = r.data;
  }
  return postJson<{ order: SimOrder | null; call: CallResult }>(`/api/partner-sim/orders/${order.id}/refresh`, { call });
}

export async function cancelOrder(partner: SimPartner, order: SimOrder, reason: string) {
  let call: CallResult | undefined;
  if (viaBrowser(partner) && order.fsrx_order_id) {
    const r = await browserCall(partner, {
      method: 'POST',
      path: `/v1/orders/${encodeURIComponent(order.fsrx_order_id)}/cancel`,
      body: reason ? { reason } : {},
      idempotencyKey: crypto.randomUUID(),
    });
    if (!r.ok) return r;
    call = r.data;
  }
  return postJson<{ order: SimOrder | null; call: CallResult }>(`/api/partner-sim/orders/${order.id}/cancel`, { reason, call });
}
