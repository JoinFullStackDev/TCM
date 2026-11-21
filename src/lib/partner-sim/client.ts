/** Server-side calls to FullStackRx's Partner API (see transport.ts). */

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
  return performPartnerCall(opts);
}
