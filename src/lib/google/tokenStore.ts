/**
 * GAP-07: Application-level AES-256 token encryption.
 *
 * Tokens are encrypted with AES-256-GCM before storage in user_google_tokens.
 * The encryption key is read from the GOOGLE_TOKEN_ENCRYPTION_KEY environment variable.
 * Key must be a 32-byte (256-bit) hex string (64 hex chars).
 *
 * This approach was chosen over pgcrypto because:
 * - No Supabase database config changes required
 * - Key management stays in the application environment (Vercel/Railway secrets)
 * - Rotation is possible by re-encrypting on read+write
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { refreshAccessToken } from './oauth';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const keyHex = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(keyHex, 'hex');
}

function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv(12 bytes) + authTag(16 bytes) + ciphertext — all base64-encoded together
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

export interface StoredToken {
  access_token: string;
  refresh_token: string;
  token_expiry: Date;
  scopes: string[];
}

/**
 * Store or update Google OAuth tokens for a user.
 * Tokens are AES-256-GCM encrypted before storage.
 */
export async function storeToken(
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiryDate: number,
  scopes: string[],
): Promise<void> {
  const supabase = await createServiceClient();
  const encryptedAccess = encrypt(accessToken);
  const encryptedRefresh = encrypt(refreshToken);

  const { error } = await supabase.from('user_google_tokens').upsert(
    {
      user_id: userId,
      access_token: encryptedAccess,
      refresh_token: encryptedRefresh,
      token_expiry: new Date(expiryDate).toISOString(),
      scopes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (error) throw new Error(`Failed to store Google token: ${error.message}`);
}

/**
 * Retrieve and decrypt a stored token for a user.
 * Returns null if no token exists.
 */
export async function getToken(userId: string): Promise<StoredToken | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('user_google_tokens')
    .select('access_token, refresh_token, token_expiry, scopes')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;

  return {
    access_token: decrypt(data.access_token as string),
    refresh_token: decrypt(data.refresh_token as string),
    token_expiry: new Date(data.token_expiry as string),
    scopes: (data.scopes as string[]) ?? [],
  };
}

/**
 * Delete a stored token for a user.
 */
export async function deleteToken(userId: string): Promise<void> {
  const supabase = await createServiceClient();
  await supabase.from('user_google_tokens').delete().eq('user_id', userId);
}

/**
 * Get a valid (non-expired) access token for a user, refreshing if necessary.
 * Throws 'NOT_CONNECTED' if no token exists.
 * Throws 'TOKEN_REVOKED' if the refresh token is invalid.
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const token = await getToken(userId);
  if (!token) throw new Error('NOT_CONNECTED');

  // Use existing token if it's valid for more than 1 minute
  if (token.token_expiry > new Date(Date.now() + 60_000)) {
    return token.access_token;
  }

  // Refresh the token
  try {
    const refreshed = await refreshAccessToken(token.refresh_token);
    // Update stored token with new access token and expiry
    await storeToken(
      userId,
      refreshed.access_token,
      token.refresh_token,
      refreshed.expiry_date,
      token.scopes,
    );
    return refreshed.access_token;
  } catch (err: unknown) {
    const apiError = err as { response?: { data?: { error?: string } } };
    if (apiError?.response?.data?.error === 'invalid_grant') {
      await deleteToken(userId);
      throw new Error('TOKEN_REVOKED');
    }
    throw err;
  }
}

/**
 * Check whether a user has a connected Google account.
 */
export async function isConnected(userId: string): Promise<boolean> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from('user_google_tokens')
    .select('id')
    .eq('user_id', userId)
    .single();
  return !!data;
}
