import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/helpers';
import { getToken, deleteToken } from '@/lib/google/tokenStore';
import { revokeToken } from '@/lib/google/oauth';

export async function DELETE(_request: Request) {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  const { user } = auth.ctx;

  const token = await getToken(user.id);
  if (token) {
    // Best-effort revoke with Google — ignore errors
    try {
      await revokeToken(token.refresh_token);
    } catch {
      // Ignore — token may already be invalid
    }
    await deleteToken(user.id);
  }

  return NextResponse.json({ ok: true });
}
