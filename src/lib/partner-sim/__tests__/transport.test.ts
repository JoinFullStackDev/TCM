import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performPartnerCall, redactKey } from '../transport';
import { isValidApiBase, normalizeApiBase, DEFAULT_CALL_MODE } from '../environments';

const KEY = 'fsrx_live_Abc123_supersecretvalueldF8';

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
    path: '/v1/orders',
    body: { partnerOrderId: 'TCM-1' },
    idempotencyKey: 'key-1',
    runtime: 'server',
    fetchImpl: f.impl,
  });

  const sent = f.calls[0];
  assert.equal(sent.url, 'https://api.example.test/v1/orders');
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
  assert.equal(r.requestHeaders.Authorization, 'Bearer fsrx_live_…ldF8');
  assert.ok(!JSON.stringify(r).includes('supersecret'), 'the key never appears in the result');
});

test('browser runtime: CORS mode, no cookies, no User-Agent header', async () => {
  const f = fakeFetch(() => new Response('', { status: 204 }));
  const r = await performPartnerCall({
    baseUrl: 'https://api.example.test',
    apiKey: KEY,
    method: 'GET',
    path: '/v1/connection',
    runtime: 'browser',
    fetchImpl: f.impl,
  });
  const init = f.calls[0].init;
  assert.equal(init.mode, 'cors');
  assert.equal(init.credentials, 'omit');
  assert.equal((init.headers as Record<string, string>)['User-Agent'], undefined);
  assert.equal((init.headers as Record<string, string>)['Content-Type'], undefined, 'no body, no content type');
  assert.equal(r.body, null);
});

test('a problem+json refusal comes back as data, not an error', async () => {
  const problem = { status: 422, code: 'invalid_npi', detail: 'bad check digit' };
  const f = fakeFetch(() => new Response(JSON.stringify(problem), { status: 422 }));
  const r = await performPartnerCall({
    baseUrl: 'https://x.test', apiKey: KEY, method: 'POST', path: '/v1/orders', body: {}, runtime: 'browser', fetchImpl: f.impl,
  });
  assert.equal(r.status, 422);
  assert.equal(r.ok, false);
  assert.deepEqual(r.body, problem);
  assert.equal(r.error, undefined);
});

test('no answer in the browser points at the VPN or CORS', async () => {
  const f = fakeFetch(() => {
    throw new TypeError('Failed to fetch');
  });
  const r = await performPartnerCall({
    baseUrl: 'https://qa-api.example.test', apiKey: KEY, method: 'GET', path: '/v1/catalog', runtime: 'browser', fetchImpl: f.impl,
  });
  assert.equal(r.status, null);
  assert.match(r.error!, /VPN/);
  assert.match(r.error!, /CORS/);
  assert.match(r.error!, /qa-api\.example\.test\/v1\/catalog/);
});

test('no answer on the server reports the network cause', async () => {
  const f = fakeFetch(() => {
    throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
  });
  const r = await performPartnerCall({
    baseUrl: 'https://nope.test', apiKey: KEY, method: 'GET', path: '/v1/catalog', runtime: 'server', fetchImpl: f.impl,
  });
  assert.equal(r.error, 'Request failed: ENOTFOUND');
});

test('a non-JSON body is kept as text', async () => {
  const f = fakeFetch(() => new Response('<html>Bad gateway</html>', { status: 502 }));
  const r = await performPartnerCall({
    baseUrl: 'https://x.test', apiKey: KEY, method: 'GET', path: '/v1/catalog', runtime: 'server', fetchImpl: f.impl,
  });
  assert.equal(r.body, '<html>Bad gateway</html>');
});

test('redactKey keeps the mode and last 4', () => {
  assert.equal(redactKey('fsrx_test_abcdWXYZ'), 'fsrx_test_…WXYZ');
  assert.equal(redactKey('something-else-1234'), '…1234');
});

test('API base URLs: /v1 and trailing slashes are optional; junk is refused', () => {
  assert.equal(normalizeApiBase(' https://api.qa.example.com/v1/ '), 'https://api.qa.example.com');
  assert.equal(normalizeApiBase('https://api.qa.example.com/'), 'https://api.qa.example.com');
  assert.equal(normalizeApiBase('https://x.example.com/api/V1'), 'https://x.example.com/api');
  assert.ok(isValidApiBase('https://api.qa.example.com/v1'));
  assert.ok(isValidApiBase('http://10.0.1.5:8080'));
  for (const bad of ['', 'api.qa.example.com', 'ftp://x.test', 'https://x.test/?a=1', 'not a url']) {
    assert.equal(isValidApiBase(bad), false, bad);
  }
});

test('QA defaults to calling from the browser (VPN-only); staging from the server', () => {
  assert.equal(DEFAULT_CALL_MODE.qa, 'browser');
  assert.equal(DEFAULT_CALL_MODE.staging, 'server');
});
