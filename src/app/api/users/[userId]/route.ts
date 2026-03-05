import { NextResponse } from 'next/server';
import { withAuth, validationError, notFound, serverError } from '@/lib/api/helpers';
import { updateUserRoleSchema } from '@/lib/validations/invitation';

interface RouteContext {
  params: Promise<{ userId: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await withAuth('manage_users');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;
  const { userId } = await context.params;

  if (userId === user.id) {
    return NextResponse.json(
      { error: 'Cannot change your own role' },
      { status: 400 },
    );
  }

  const body = await request.json();
  const parsed = updateUserRoleSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { data: profile, error } = await supabase
    .from('profiles')
    .update({ role: parsed.data.role })
    .eq('id', userId)
    .select()
    .single();

  if (error || !profile) return notFound('User');

  return NextResponse.json(profile);
}
