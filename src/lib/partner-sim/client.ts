/**
 * Server-side calls to FullStackRx's Partner API (call_mode 'server', e.g. staging).
 * QA's FullStackRx is VPN-only, so for it the browser calls instead (see transport.ts).
 */

import { performPartnerCall, type PartnerCallResult } from './transport';

export type { PartnerCallResult } from './transport';
export { redactKey } from './transport';

export function callPartnerApi(opts: {
  baseUrl: string;
  apiKey: string;
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
  idempotencyKey?: string;
}): Promise<PartnerCallResult> {
  return performPartnerCall({ ...opts, runtime: 'server' });
}
