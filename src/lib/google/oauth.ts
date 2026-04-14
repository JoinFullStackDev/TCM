import { google } from 'googleapis';

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
];

/**
 * Create a Google OAuth2 client using environment variables.
 */
export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!,
  );
}

/**
 * Generate the Google OAuth2 authorization URL.
 *
 * @param state - Base64-encoded state (includes CSRF token and return_to)
 */
export function generateAuthUrl(state: string): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_SCOPES,
    state,
    prompt: 'consent', // Always request refresh token
  });
}

export interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number; // ms since epoch
  scope: string;
}

/**
 * Exchange an authorization code for tokens.
 */
export async function exchangeCode(code: string): Promise<GoogleTokens> {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Incomplete tokens received from Google');
  }

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date ?? Date.now() + 3600 * 1000,
    scope: tokens.scope ?? GOOGLE_SCOPES.join(' '),
  };
}

/**
 * Refresh an access token using a refresh token.
 * Returns the new access token and updated expiry.
 */
export async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expiry_date: number }> {
  const client = createOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });

  const { credentials } = await client.refreshAccessToken();

  if (!credentials.access_token) {
    throw new Error('No access token returned from refresh');
  }

  return {
    access_token: credentials.access_token,
    expiry_date: credentials.expiry_date ?? Date.now() + 3600 * 1000,
  };
}

/**
 * Revoke a token with Google (best-effort — errors are ignored by caller).
 */
export async function revokeToken(token: string): Promise<void> {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
    method: 'POST',
  });
}
