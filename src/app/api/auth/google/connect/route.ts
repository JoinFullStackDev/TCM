import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/helpers';
import { generateAuthUrl } from '@/lib/google/oauth';
import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const auth = await withAuth('export');
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const returnTo = searchParams.get('return_to') ?? '/';

  // Generate CSRF token and store in a short-lived cookie
  const csrfToken = randomBytes(32).toString('hex');
  const cookieStore = await cookies();
  cookieStore.set('google_oauth_csrf', csrfToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  // Encode state: JSON { returnTo, csrfToken } as base64
  const state = Buffer.from(JSON.stringify({ returnTo, csrfToken })).toString('base64url');
  const authUrl = generateAuthUrl(state);

  return NextResponse.redirect(authUrl);
}
