import { NextResponse } from 'next/server';
import { withAuth, validationError, serverError, conflict } from '@/lib/api/helpers';
import { createInvitationSchema } from '@/lib/validations/invitation';

export async function GET() {
  const auth = await withAuth('manage_users');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return serverError(error.message);

  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const auth = await withAuth('manage_users');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const body = await request.json();
  const parsed = createInvitationSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { data: existing } = await supabase
    .from('invitations')
    .select('id')
    .eq('email', parsed.data.email)
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) return conflict('A pending invitation already exists for this email');

  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { data: invitation, error } = await supabase
    .from('invitations')
    .insert({
      email: parsed.data.email,
      role: parsed.data.role,
      invited_by: user.id,
      token,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(invitation, { status: 201 });
}
