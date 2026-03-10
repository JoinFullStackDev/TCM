import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasPermission, type Permission } from '@/lib/auth/rbac';
import type { Profile, UserRole } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface AuthContext {
  user: { id: string; email?: string };
  profile: Profile;
  role: UserRole;
  supabase: SupabaseClient;
}

type AuthResult =
  | { ok: true; ctx: AuthContext }
  | { ok: false; response: NextResponse };

export async function withAuth(
  requiredPermission?: Permission,
): Promise<AuthResult> {
  const supabase = await createClient();

  let user = null;
  let authError: unknown = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
    authError = result.error;
  } catch (e) {
    authError = e;
  }

  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      ),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Profile not found' },
        { status: 401 },
      ),
    };
  }

  if (requiredPermission && !hasPermission(profile.role as UserRole, requiredPermission)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    ctx: {
      user,
      profile: profile as Profile,
      role: profile.role as UserRole,
      supabase,
    },
  };
}

export function validationError(error: unknown) {
  return NextResponse.json(
    { error: 'Validation failed', details: error },
    { status: 400 },
  );
}

export function notFound(entity: string) {
  return NextResponse.json(
    { error: `${entity} not found` },
    { status: 404 },
  );
}

export function conflict(message: string) {
  return NextResponse.json(
    { error: message },
    { status: 409 },
  );
}

export function serverError(message = 'Internal server error') {
  return NextResponse.json(
    { error: message },
    { status: 500 },
  );
}
