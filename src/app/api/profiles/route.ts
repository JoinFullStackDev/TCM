import { NextResponse } from 'next/server';
import { withAuth, serverError } from '@/lib/api/helpers';

export async function GET() {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, role, is_active')
    .eq('is_active', true)
    .order('full_name', { ascending: true });

  if (error) return serverError(error.message);

  return NextResponse.json(data ?? []);
}
