import { withAuth } from '@/lib/api/helpers';
import { isConnected } from '@/lib/google/tokenStore';

export async function GET(_request: Request) {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  const { user } = auth.ctx;
  const connected = await isConnected(user.id);

  return Response.json({ connected });
}
