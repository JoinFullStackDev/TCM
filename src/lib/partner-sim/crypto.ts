/**
 * AES-256-GCM encryption for partner API keys and webhook secrets at rest.
 * Key: PARTNER_SIM_ENCRYPTION_KEY, a 64-character hex string (32 bytes).
 * Format: base64(iv[12] + authTag[16] + ciphertext), same as src/lib/google/tokenStore.ts.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export class MissingEncryptionKeyError extends Error {
  constructor() {
    super('PARTNER_SIM_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
}

function getKey(keyHex = process.env.PARTNER_SIM_ENCRYPTION_KEY): Buffer {
  if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) throw new MissingEncryptionKeyError();
  return Buffer.from(keyHex, 'hex');
}

export function encryptSecret(plaintext: string, keyHex?: string): string {
  const key = getKey(keyHex);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

export function decryptSecret(ciphertext: string, keyHex?: string): string {
  const key = getKey(keyHex);
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH)) + decipher.final('utf8');
}

export const last4 = (secret: string) => secret.slice(-4);

/** `fsrx_test_…` → test, `fsrx_live_…` → live, anything else → null. */
export function apiKeyMode(apiKey: string): 'test' | 'live' | null {
  if (apiKey.startsWith('fsrx_test_')) return 'test';
  if (apiKey.startsWith('fsrx_live_')) return 'live';
  return null;
}
