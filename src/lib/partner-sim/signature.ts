/**
 * FullStackRx webhook signatures.
 *
 * Header: `FullStackRx-Signature: t=<unix seconds>,v1=<hex>` where v1 is the lowercase
 * hex HMAC-SHA256 of `<t>.<raw request body>`, keyed with the UTF-8 bytes of the whole
 * webhook signing secret (`whsec_…`, prefix included). Verify over the raw bytes,
 * compare in constant time, and refuse a t more than 300 seconds away from now.
 */

import { createHmac, timingSafeEqual } from 'crypto';

export const SIGNATURE_TOLERANCE_SECONDS = 300;

export type SignatureFailure = 'no_secret' | 'missing_header' | 'malformed' | 'stale' | 'mismatch';

export type SignatureResult =
  | { valid: true; timestamp: number }
  | { valid: false; reason: SignatureFailure; timestamp?: number };

export function computeSignature(secret: string, timestamp: number | string, rawBody: string | Buffer): string {
  const mac = createHmac('sha256', Buffer.from(secret, 'utf8'));
  mac.update(`${timestamp}.`, 'utf8');
  mac.update(typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody);
  return mac.digest('hex');
}

/** Builds a header value, for tests and for "send a sample event" tooling. */
export function signatureHeader(secret: string, timestamp: number, rawBody: string | Buffer): string {
  return `t=${timestamp},v1=${computeSignature(secret, timestamp, rawBody)}`;
}

/** Parses `t=…,v1=…[,v1=…]`; several v1 values are allowed (secret rotation). */
export function parseSignatureHeader(header: string): { t: number; v1: string[] } | null {
  let t: number | null = null;
  const v1: string[] = [];
  for (const part of header.split(',')) {
    const eq = part.indexOf('=');
    if (eq < 0) return null;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === 't') {
      if (!/^\d+$/.test(value)) return null;
      t = Number(value);
    } else if (key === 'v1') {
      if (!/^[0-9a-f]{64}$/.test(value)) return null;
      v1.push(value);
    }
  }
  return t === null || v1.length === 0 ? null : { t, v1 };
}

export function verifySignature(opts: {
  header: string | null | undefined;
  rawBody: string | Buffer;
  secret: string | null | undefined;
  /** Unix seconds; defaults to now. */
  now?: number;
  toleranceSeconds?: number;
}): SignatureResult {
  const { header, rawBody, secret } = opts;
  if (!header) return { valid: false, reason: 'missing_header' };
  const parsed = parseSignatureHeader(header);
  if (!parsed) return { valid: false, reason: 'malformed' };
  if (!secret) return { valid: false, reason: 'no_secret', timestamp: parsed.t };

  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const tolerance = opts.toleranceSeconds ?? SIGNATURE_TOLERANCE_SECONDS;
  if (Math.abs(now - parsed.t) > tolerance) return { valid: false, reason: 'stale', timestamp: parsed.t };

  const expected = Buffer.from(computeSignature(secret, parsed.t, rawBody), 'hex');
  const match = parsed.v1.some((candidate) => {
    const got = Buffer.from(candidate, 'hex');
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
  return match ? { valid: true, timestamp: parsed.t } : { valid: false, reason: 'mismatch', timestamp: parsed.t };
}
