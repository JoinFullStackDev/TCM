import { NextResponse } from 'next/server';
import { withAuth, notFound, serverError } from '@/lib/api/helpers';

interface RouteContext {
  params: Promise<{ invitationId: string }>;
}

export async function PATCH(_request: Request, context: RouteContext) {
  const auth = await withAuth('manage_users');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { invitationId } = await context.params;

  const { data, error } = await supabase
    .from('invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId)
    .eq('status', 'pending')
    .select()
    .single();

  if (error || !data) return notFound('Invitation');

  return NextResponse.json(data);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await withAuth('manage_users');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { invitationId } = await context.params;

  const { error } = await supabase
    .from('invitations')
    .delete()
    .eq('id', invitationId);

  if (error) return serverError(error.message);

  return NextResponse.json({ success: true });
}
