import { NextResponse } from 'next/server';
import { withAuth, serverError } from '@/lib/api/helpers';

export async function GET() {
  const auth = await withAuth('manage_users');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, role, is_active, last_active_at, created_at')
    .order('created_at', { ascending: true });

  if (error) return serverError(error.message);

  return NextResponse.json(data ?? []);
}
