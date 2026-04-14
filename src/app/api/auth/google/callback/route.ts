import { NextResponse } from 'next/server';

function safeReturnTo(value: string): string {
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  return '/';
}
import { createClient } from '@/lib/supabase/server';
import { exchangeCode } from '@/lib/google/oauth';
import { storeToken } from '@/lib/google/tokenStore';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const oauthError = searchParams.get('error');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  // Handle user denying access
  if (oauthError || !code || !stateParam) {
    return NextResponse.redirect(`${baseUrl}/?google_error=access_denied`);
  }

  // Decode and validate state
  let returnTo = '/';
  try {
    const stateJson = Buffer.from(stateParam, 'base64url').toString('utf8');
    const state = JSON.parse(stateJson) as { returnTo: string; csrfToken: string };

    const cookieStore = await cookies();
    const storedCsrf = cookieStore.get('google_oauth_csrf')?.value;

    if (!storedCsrf || storedCsrf !== state.csrfToken) {
      return NextResponse.redirect(`${baseUrl}/?google_error=csrf_mismatch`);
    }

    // Clear the CSRF cookie
    cookieStore.delete('google_oauth_csrf');
    returnTo = safeReturnTo(state.returnTo);
  } catch {
    return NextResponse.redirect(`${baseUrl}/?google_error=invalid_state`);
  }

  // Get current user
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${baseUrl}/login`);
  }

  // Exchange code for tokens
  try {
    const tokens = await exchangeCode(code);
    const scopes = tokens.scope.split(' ').filter(Boolean);
    await storeToken(user.id, tokens.access_token, tokens.refresh_token, tokens.expiry_date, scopes);
  } catch (err) {
    console.error('[google/callback] Token exchange failed:', err);
    return NextResponse.redirect(`${baseUrl}/?google_error=token_exchange_failed`);
  }

  return NextResponse.redirect(`${baseUrl}${returnTo}`);
}
