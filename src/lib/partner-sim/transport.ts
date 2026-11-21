/**
 * One call to FullStackRx's Partner API, from either side:
 *  - 'server': TCM's route handlers (public environments such as staging).
 *  - 'browser': the tester's browser (QA, which only admits the VPN). This needs
 *    FullStackRx's CORS to allow TCM's origin on /v1, and the browser can only read
 *    response headers that CORS exposes (Idempotent-Replayed among them, once exposed).
 * Returns the same shape either way, so TCM records both identically.
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
  /** Set when there was no HTTP answer (unreachable, refused by CORS, timed out). */
  error?: string;
}

export interface PartnerCallOptions {
  baseUrl: string;
  apiKey: string;
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
  idempotencyKey?: string;
  runtime: 'server' | 'browser';
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

/** Why a browser fetch failed with no answer: almost always the VPN or CORS. */
export function browserNetworkHint(url: string, origin: string): string {
  return (
    `Your browser got no answer from ${url}. Either FullStackRx isn't reachable from this machine ` +
    `(for QA, turn the VPN on), or FullStackRx's CORS doesn't allow ${origin} on /v1 yet. ` +
    `The browser console shows which.`
  );
}

export async function performPartnerCall(opts: PartnerCallOptions): Promise<PartnerCallResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const url = `${opts.baseUrl}${opts.path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json, application/problem+json',
    Authorization: `Bearer ${opts.apiKey}`,
  };
  if (opts.runtime === 'server') headers['User-Agent'] = 'TCM-PartnerSimulator/1';
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
      ...(opts.runtime === 'browser' ? { mode: 'cors' as const, credentials: 'omit' as const } : {}),
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
    let error: string;
    if (e.name === 'TimeoutError') error = `Timed out after ${timeoutMs / 1000}s`;
    else if (opts.runtime === 'browser')
      error = browserNetworkHint(url, typeof location === 'undefined' ? 'this TCM site' : location.origin);
    else error = `Request failed: ${e.cause?.code || e.cause?.message || e.message}`;
    return { ...base, status: null, ok: false, headers: {}, body: null, durationMs: Date.now() - started, error };
  }
}
