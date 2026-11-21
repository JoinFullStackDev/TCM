import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { computeSignature, parseSignatureHeader, signatureHeader, verifySignature } from '../signature';

const secret = 'whsec_test_5f1c0e3b9a7d4e2f8c6b1a0d';
const body =
  '{"id":"evt_3f6c2a9e","type":"order.received","createdAt":"2026-11-21T06:05:48.383483Z","livemode":true,' +
  '"data":{"orderId":"fa304374-34da-46dc-92c8-0721ce861d1e","partnerOrderId":"TH-230548","items":[]}}';
const t = 1795241160;

test('the signature is hex HMAC-SHA256 of "<t>.<raw body>" keyed with the whole whsec_ secret', () => {
  const expected = createHmac('sha256', Buffer.from(secret, 'utf8')).update(`${t}.${body}`).digest('hex');
  assert.equal(computeSignature(secret, t, body), expected);
  assert.match(expected, /^[0-9a-f]{64}$/);
  // Keyed with the prefix included: dropping "whsec_" must give a different MAC.
  assert.notEqual(computeSignature(secret.slice(6), t, body), expected);
});

test('a correct, fresh signature verifies', () => {
  const header = signatureHeader(secret, t, body);
  assert.deepEqual(verifySignature({ header, rawBody: body, secret, now: t + 10 }), { valid: true, timestamp: t });
  // Raw bytes work too, including non-ASCII.
  const unicode = '{"note":"Café – ünïcode"}';
  const h2 = signatureHeader(secret, t, unicode);
  assert.equal(verifySignature({ header: h2, rawBody: Buffer.from(unicode, 'utf8'), secret, now: t }).valid, true);
});

test('a body changed by one byte, or re-serialized JSON, fails', () => {
  const header = signatureHeader(secret, t, body);
  const tampered = body.replace('TH-230548', 'TH-230549');
  assert.deepEqual(verifySignature({ header, rawBody: tampered, secret, now: t }), {
    valid: false,
    reason: 'mismatch',
    timestamp: t,
  });
  const reserialized = JSON.stringify(JSON.parse(body), null, 2);
  assert.equal(verifySignature({ header, rawBody: reserialized, secret, now: t }).valid, false);
});

test('the wrong secret fails', () => {
  const header = signatureHeader(secret, t, body);
  const r = verifySignature({ header, rawBody: body, secret: 'whsec_other', now: t });
  assert.equal(r.valid, false);
  assert.equal(!r.valid && r.reason, 'mismatch');
});

test('a t older than 5 minutes (or further in the future) is refused even with a good MAC', () => {
  const header = signatureHeader(secret, t, body);
  assert.equal(verifySignature({ header, rawBody: body, secret, now: t + 300 }).valid, true);
  const old = verifySignature({ header, rawBody: body, secret, now: t + 301 });
  assert.deepEqual(old, { valid: false, reason: 'stale', timestamp: t });
  const future = verifySignature({ header, rawBody: body, secret, now: t - 301 });
  assert.equal(!future.valid && future.reason, 'stale');
});

test('the t in the header is part of the MAC: swapping in a fresh t fails', () => {
  const v1 = computeSignature(secret, t, body);
  const header = `t=${t + 100},v1=${v1}`;
  assert.equal(verifySignature({ header, rawBody: body, secret, now: t + 100 }).valid, false);
});

test('missing, malformed and secretless cases say why', () => {
  assert.deepEqual(verifySignature({ header: null, rawBody: body, secret, now: t }), {
    valid: false,
    reason: 'missing_header',
  });
  for (const bad of ['garbage', 't=abc,v1=00', `t=${t}`, `v1=${'a'.repeat(64)}`, `t=${t},v1=${'A'.repeat(64)}`]) {
    const r = verifySignature({ header: bad, rawBody: body, secret, now: t });
    assert.equal(!r.valid && r.reason, 'malformed', bad);
  }
  const header = signatureHeader(secret, t, body);
  const r = verifySignature({ header, rawBody: body, secret: null, now: t });
  assert.equal(!r.valid && r.reason, 'no_secret');
});

test('any of several v1 values may match (secret rotation)', () => {
  const good = computeSignature(secret, t, body);
  const header = `t=${t},v1=${'0'.repeat(64)},v1=${good}`;
  assert.equal(verifySignature({ header, rawBody: body, secret, now: t }).valid, true);
  assert.deepEqual(parseSignatureHeader(header)?.v1.length, 2);
});
