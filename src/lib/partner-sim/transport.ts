/**
 * One call from TCM's server to FullStackRx's Partner API. Pure apart from `fetch`
 * (injectable for tests); the result is what TCM records and shows, with the API key
 * redacted from the request headers.
 */

export interface PartnerCallResult {
  method: string;
  url: string;
  /** What was sent, with the API key redacted. */
  requestHeaders: Record<string, string>;
  status: number | null;
  ok: boolean;
  headers: Record<string, string>;
  body: unknown;
  durationMs: number;
  /** Set when there was no HTTP answer (DNS, refused, timed out). */
  error?: string;
}

export interface PartnerCallOptions {
  baseUrl: string;
  apiKey: string;
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
  idempotencyKey?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export const KEPT_RESPONSE_HEADERS = [
  'content-type',
  'idempotent-replayed',
  'location',
  'retry-after',
  'x-request-id',
  'ratelimit-limit',
  'ratelimit-remaining',
  'ratelimit-reset',
];

export function redactKey(apiKey: string): string {
  const mode = apiKey.startsWith('fsrx_test_') ? 'fsrx_test_' : apiKey.startsWith('fsrx_live_') ? 'fsrx_live_' : '';
  return `${mode}…${apiKey.slice(-4)}`;
}

export async function performPartnerCall(opts: PartnerCallOptions): Promise<PartnerCallResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const url = `${opts.baseUrl}${opts.path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json, application/problem+json',
    Authorization: `Bearer ${opts.apiKey}`,
    'User-Agent': 'TCM-PartnerSimulator/1',
  };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  const requestHeaders = { ...headers, Authorization: `Bearer ${redactKey(opts.apiKey)}` };
  const base = { method: opts.method, url, requestHeaders };
  const started = Date.now();
  try {
    const res = await doFetch(url, {
      method: opts.method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // not JSON; keep the text
    }
    const kept: Record<string, string> = {};
    for (const name of KEPT_RESPONSE_HEADERS) {
      const value = res.headers.get(name);
      if (value !== null) kept[name] = value;
    }
    return { ...base, status: res.status, ok: res.ok, headers: kept, body, durationMs: Date.now() - started };
  } catch (err) {
    const e = err as Error & { cause?: { code?: string; message?: string } };
    const error =
      e.name === 'TimeoutError'
        ? `Timed out after ${timeoutMs / 1000}s`
        : `Request failed: ${e.cause?.code || e.cause?.message || e.message}. Is this environment reachable from the internet? (QA is VPN-only.)`;
    return { ...base, status: null, ok: false, headers: {}, body: null, durationMs: Date.now() - started, error };
  }
}
