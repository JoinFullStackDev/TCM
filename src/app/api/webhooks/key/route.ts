import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/helpers';

export async function GET() {
  const auth = await withAuth('view_webhooks');
  if (!auth.ok) return auth.response;

  const key = process.env.WEBHOOK_API_KEY ?? '';
  return NextResponse.json({ key });
}
