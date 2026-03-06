import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/helpers';
import articles from '@/data/knowledge-base.json';

export async function GET() {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;

  return NextResponse.json(articles);
}
