import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performPartnerCall, redactKey, PARTNER_API_PREFIX } from '../transport';
import { isValidApiBase, normalizeApiBase, UNREACHABLE_ENVIRONMENTS } from '../environments';

const KEY = 'fsrx_live_Abc123_supersecretvalueZq9X';

function fakeFetch(respond: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return respond(url, init);
  }) as unknown as typeof fetch;
  return { impl, calls };
}

test('sends Bearer key, Idempotency-Key and JSON; reports a redacted Authorization', async () => {
  const f = fakeFetch(() =>
    new Response(JSON.stringify({ id: 'o-1', status: 'received' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json', 'Idempotent-Replayed': 'true', 'Set-Cookie': 'x=1' },
    }),
  );
  const r = await performPartnerCall({
    baseUrl: 'https://api.example.test',
    apiKey: KEY,
    method: 'POST',
    path: '/orders',
    body: { partnerOrderId: 'TCM-1' },
    idempotencyKey: 'key-1',
    fetchImpl: f.impl,
  });

  const sent = f.calls[0];
  assert.equal(PARTNER_API_PREFIX, '/api/partner/v1');
  assert.equal(sent.url, 'https://api.example.test/api/partner/v1/orders');
  const h = sent.init.headers as Record<string, string>;
  assert.equal(h.Authorization, `Bearer ${KEY}`);
  assert.equal(h['Idempotency-Key'], 'key-1');
  assert.equal(h['Content-Type'], 'application/json');
  assert.equal(h['User-Agent'], 'TCM-PartnerSimulator/1');
  assert.equal(sent.init.body, '{"partnerOrderId":"TCM-1"}');

  assert.equal(r.status, 201);
  assert.equal(r.ok, true);
  assert.deepEqual(r.body, { id: 'o-1', status: 'received' });
  assert.equal(r.headers['idempotent-replayed'], 'true');
  assert.equal(r.headers['set-cookie'], undefined, 'only the listed headers are kept');
  assert.equal(r.requestHeaders.Authorization, 'Bearer fsrx_live_…Zq9X');
  assert.ok(!JSON.stringify(r).includes('supersecret'), 'the key never appears in the result');
});

test('a GET sends no body and no content type; an empty answer is null', async () => {
  const f = fakeFetch(() => new Response('', { status: 204 }));
  const r = await performPartnerCall({
    baseUrl: 'https://api.example.test', apiKey: KEY, method: 'GET', path: '/connection', fetchImpl: f.impl,
  });
  const init = f.calls[0].init;
  assert.equal(init.body, undefined);
  assert.equal((init.headers as Record<string, string>)['Content-Type'], undefined);
  assert.equal((init.headers as Record<string, string>)['Idempotency-Key'], undefined);
  assert.equal(r.body, null);
});

test('a problem+json refusal comes back as data, not an error', async () => {
  const problem = { status: 422, code: 'invalid_npi', detail: 'bad check digit' };
  const f = fakeFetch(() => new Response(JSON.stringify(problem), { status: 422 }));
  const r = await performPartnerCall({
    baseUrl: 'https://x.test', apiKey: KEY, method: 'POST', path: '/orders', body: {}, fetchImpl: f.impl,
  });
  assert.equal(r.status, 422);
  assert.equal(r.ok, false);
  assert.deepEqual(r.body, problem);
  assert.equal(r.error, undefined);
});

test('no answer reports the network cause and hints that QA is VPN-only', async () => {
  const f = fakeFetch(() => {
    throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
  });
  const r = await performPartnerCall({
    baseUrl: 'https://nope.test', apiKey: KEY, method: 'GET', path: '/catalog', fetchImpl: f.impl,
  });
  assert.equal(r.status, null);
  assert.equal(r.url, 'https://nope.test/api/partner/v1/catalog');
  assert.match(r.error!, /^Request failed: ENOTFOUND\./);
  assert.match(r.error!, /VPN/);
});

test('a non-JSON body is kept as text', async () => {
  const f = fakeFetch(() => new Response('<html>Bad gateway</html>', { status: 502 }));
  const r = await performPartnerCall({
    baseUrl: 'https://x.test', apiKey: KEY, method: 'GET', path: '/catalog', fetchImpl: f.impl,
  });
  assert.equal(r.body, '<html>Bad gateway</html>');
});

test('redactKey keeps the mode and last 4', () => {
  assert.equal(redactKey('fsrx_test_abcdWXYZ'), 'fsrx_test_…WXYZ');
  assert.equal(redactKey('something-else-1234'), '…1234');
});

test('API base URLs: the bare host is kept; a pasted prefix or trailing slash is trimmed; junk is refused', () => {
  assert.equal(normalizeApiBase(' https://demo.fullstackrx.com/api/partner/v1/ '), 'https://demo.fullstackrx.com');
  assert.equal(normalizeApiBase('https://demo.fullstackrx.com/API/Partner/V1'), 'https://demo.fullstackrx.com');
  assert.equal(normalizeApiBase('https://demo.fullstackrx.com'), 'https://demo.fullstackrx.com');
  assert.equal(normalizeApiBase(' https://api.staging.example.com/v1/ '), 'https://api.staging.example.com');
  assert.equal(normalizeApiBase('https://api.staging.example.com/'), 'https://api.staging.example.com');
  assert.equal(normalizeApiBase('https://x.example.com/api/V1'), 'https://x.example.com/api');
  assert.ok(isValidApiBase('https://api.staging.example.com/v1'));
  assert.ok(isValidApiBase('http://10.0.1.5:8080'));
  for (const bad of ['', 'api.staging.example.com', 'ftp://x.test', 'https://x.test/?a=1', 'not a url']) {
    assert.equal(isValidApiBase(bad), false, bad);
  }
});

test('QA is flagged as unreachable from TCM; staging is not', () => {
  assert.match(UNREACHABLE_ENVIRONMENTS.qa!, /VPN/);
  assert.equal(UNREACHABLE_ENVIRONMENTS.staging, undefined);
});
