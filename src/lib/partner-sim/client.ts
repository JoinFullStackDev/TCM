/**
 * Server-side calls to FullStackRx's Partner API. The API key is only ever used here;
 * what goes back to the browser carries a redacted Authorization header.
 */

const TIMEOUT_MS = 20_000;
const KEPT_RESPONSE_HEADERS = [
  'content-type',
  'idempotent-replayed',
  'location',
  'retry-after',
  'x-request-id',
  'ratelimit-limit',
  'ratelimit-remaining',
  'ratelimit-reset',
];

export interface PartnerCallResult {
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  status: number | null;
  ok: boolean;
  headers: Record<string, string>;
  body: unknown;
  durationMs: number;
  /** Set when the request never got an HTTP answer (DNS, refused, timeout). */
  error?: string;
}

export function redactKey(apiKey: string): string {
  const mode = apiKey.startsWith('fsrx_test_') ? 'fsrx_test_' : apiKey.startsWith('fsrx_live_') ? 'fsrx_live_' : '';
  return `${mode}…${apiKey.slice(-4)}`;
}

export async function callPartnerApi(opts: {
  baseUrl: string;
  apiKey: string;
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
  idempotencyKey?: string;
}): Promise<PartnerCallResult> {
  const url = `${opts.baseUrl}${opts.path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json, application/problem+json',
    Authorization: `Bearer ${opts.apiKey}`,
    'User-Agent': 'TCM-PartnerSimulator/1',
  };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  const requestHeaders = { ...headers, Authorization: `Bearer ${redactKey(opts.apiKey)}` };
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: opts.method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
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
    return {
      method: opts.method,
      url,
      requestHeaders,
      status: res.status,
      ok: res.ok,
      headers: kept,
      body,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    const e = err as Error & { cause?: { code?: string; message?: string } };
    const detail = e.cause?.code || e.cause?.message || e.message;
    return {
      method: opts.method,
      url,
      requestHeaders,
      status: null,
      ok: false,
      headers: {},
      body: null,
      durationMs: Date.now() - started,
      error: e.name === 'TimeoutError' ? `Timed out after ${TIMEOUT_MS / 1000}s` : `Request failed: ${detail}`,
    };
  }
}
