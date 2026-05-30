import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { hasPermission, type Permission } from '@/lib/auth/rbac';
import type { Profile, UserRole } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

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

// ---------------------------------------------------------------------------
// Dual-auth: supports Supabase session cookie OR Bearer token (server-to-server)
// ---------------------------------------------------------------------------
export interface ServiceAuthContext {
  supabase: SupabaseClient;
  mode: 'bearer' | 'session';
}

type DualAuthResult =
  | { ok: true; ctx: ServiceAuthContext }
  | { ok: false; response: NextResponse };

/**
 * withDualAuth — accepts either:
 *   1. A valid Supabase session cookie (browser users)
 *   2. Authorization: Bearer <CLUTCH_API_KEY> (server-to-server from Clutch)
 *
 * On success returns a service-role supabase client (bypasses RLS for writes).
 */
export async function withDualAuth(request: Request): Promise<DualAuthResult> {
  const authHeader = request.headers.get('authorization') ?? '';
  const expectedKey = process.env.CLUTCH_API_KEY;

  // Bearer token path — Clutch server-to-server
  if (authHeader.startsWith('Bearer ') && expectedKey) {
    const token = authHeader.slice(7);
    if (token === expectedKey) {
      const supabase = await createServiceClient();
      return { ok: true, ctx: { supabase, mode: 'bearer' } };
    }
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  // Cookie/session path — browser users
  const supabaseUser = await createClient();
  let user = null;
  try {
    const result = await supabaseUser.auth.getUser();
    user = result.data.user;
  } catch {
    user = null;
  }

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  // Use service client so reads/writes bypass RLS
  const supabase = await createServiceClient();
  return { ok: true, ctx: { supabase, mode: 'session' } };
}

export function serverError(message = 'Internal server error') {
  return NextResponse.json(
    { error: message },
    { status: 500 },
  );
}

/**
 * Dual-auth helper for the agent-runs API.
 * Accepts, in priority order:
 *  1. X-Clutch-Key: <key> header (server-to-server, validated against CLUTCH_API_KEY env var)
 *  2. Authorization: Bearer <supabase-jwt> (Clutch legacy server-to-server)
 *  3. Supabase session cookie (browser)
 *
 * Returns a service-role Supabase client so route handlers can bypass RLS
 * when writing on behalf of agents. Auth is still validated — only the DB
 * client is elevated.
 */
export async function withAgentAuth(): Promise<
  { ok: true; supabase: SupabaseClient } | { ok: false; response: NextResponse }
> {
  const headerStore = await headers();

  // Path 1: X-Clutch-Key header (server-to-server API key auth)
  const clutchKey = headerStore.get('x-clutch-key');
  if (clutchKey !== null) {
    if (clutchKey !== process.env.CLUTCH_API_KEY || !process.env.CLUTCH_API_KEY) {
      return { ok: false, response: NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 }) };
    }
    const supabase = await createServiceClient();
    return { ok: true, supabase };
  }

  const authorization = headerStore.get('authorization') ?? '';

  if (authorization.startsWith('Bearer ')) {
    const token = authorization.slice(7);
    // Validate the JWT against Supabase by fetching the user
    const supabase = await createServiceClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 }),
      };
    }
    return { ok: true, supabase };
  }

  // Fall back to cookie auth
  const cookieClient = await createClient();
  const { data, error } = await cookieClient.auth.getUser();
  if (error || !data.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 }),
    };
  }

  // Return service client so RLS doesn't interfere with agent-runs writes
  const supabase = await createServiceClient();
  return { ok: true, supabase };
}
