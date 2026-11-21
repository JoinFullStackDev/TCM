import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { apiKeyMode, decryptSecret, encryptSecret, last4, MissingEncryptionKeyError, resolveEncryptionKey } from '../crypto';

const key = randomBytes(32).toString('hex');

test('secrets round-trip, and each encryption is different', () => {
  const secret = 'fsrx_live_Abc123_s3cr3tvalue';
  const a = encryptSecret(secret, key);
  const b = encryptSecret(secret, key);
  assert.notEqual(a, b);
  assert.ok(!a.includes(secret));
  assert.equal(decryptSecret(a, key), secret);
  assert.equal(decryptSecret(b, key), secret);
});

test('a different key or tampered ciphertext fails to decrypt', () => {
  const c = encryptSecret('whsec_abc', key);
  assert.throws(() => decryptSecret(c, randomBytes(32).toString('hex')));
  const buf = Buffer.from(c, 'base64');
  buf[buf.length - 1] ^= 1;
  assert.throws(() => decryptSecret(buf.toString('base64'), key));
});

test('a missing or short key is a clear configuration error', () => {
  assert.throws(() => encryptSecret('x', ''), MissingEncryptionKeyError);
  assert.throws(() => encryptSecret('x', 'abcd'), MissingEncryptionKeyError);
});

test('without an explicit key, the encryption key is derived from the service-role key', () => {
  const derivedA = resolveEncryptionKey(undefined, 'service-role-A');
  assert.equal(derivedA.length, 32);
  assert.deepEqual(resolveEncryptionKey('', 'service-role-A'), derivedA, 'stable for the same secret');
  assert.notDeepEqual(resolveEncryptionKey(undefined, 'service-role-B'), derivedA);
  // An explicit key wins over the fallback.
  assert.deepEqual(resolveEncryptionKey(key, 'service-role-A'), Buffer.from(key, 'hex'));
  assert.throws(() => resolveEncryptionKey('', ''), MissingEncryptionKeyError);
});

test('key mode and last 4', () => {
  assert.equal(apiKeyMode('fsrx_test_abc'), 'test');
  assert.equal(apiKeyMode('fsrx_live_abc'), 'live');
  assert.equal(apiKeyMode('sk_live_abc'), null);
  assert.equal(last4('fsrx_test_abcdWXYZ'), 'WXYZ');
});
