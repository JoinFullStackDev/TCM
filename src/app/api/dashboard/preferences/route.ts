import { NextResponse } from 'next/server';
import { withAuth, serverError, validationError } from '@/lib/api/helpers';

export async function GET() {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase, profile } = auth.ctx;

  const { data, error } = await supabase
    .from('dashboard_preferences')
    .select('*')
    .eq('user_id', profile.id)
    .maybeSingle();

  if (error) return serverError(error.message);

  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const auth = await withAuth('manage_users');
  if (!auth.ok) return auth.response;
  const { supabase, profile } = auth.ctx;

  let body: { card_config?: unknown };
  try {
    body = await request.json();
  } catch {
    return validationError('Invalid JSON body');
  }

  if (!Array.isArray(body.card_config)) {
    return validationError('card_config must be an array');
  }

  const { data, error } = await supabase
    .from('dashboard_preferences')
    .upsert(
      { user_id: profile.id, card_config: body.card_config },
      { onConflict: 'user_id' },
    )
    .select()
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(data);
}
