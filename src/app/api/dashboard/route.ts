import { NextResponse } from 'next/server';
import { withAuth, serverError } from '@/lib/api/helpers';

export async function GET() {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase, profile, role } = auth.ctx;

  const { data, error } = await supabase.rpc('dashboard_summary', {
    p_user_id: profile.id,
    p_role: role,
  });

  if (error) return serverError(error.message);

  return NextResponse.json(data);
}
