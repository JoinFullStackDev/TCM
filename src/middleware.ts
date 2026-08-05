import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/login',
  '/auth/callback',
  '/invite',
  '/api/webhooks',
  '/api/agent-runs',       // auth handled in route handler (X-Clutch-Key or Supabase JWT)
  '/feedback',                 // public submission form page
  '/api/feedback/projects',    // public project list for form dropdown
  '/api/agent-runs',           // dual-auth: Bearer token (Clutch) or session cookie
  '/api/cron/',                // internal cron endpoints
  // Agent-reachable API routes for the MCP (Test Case CRUD). These handlers authenticate
  // header-based agent auth (X-Clutch-Key / Bearer JWT) themselves via withAgentAuth.
  // Middleware only inspects the cookie session, so without exempting them it would
  // 307-redirect agent (no-cookie) requests to /login before the handler runs. Browser
  // users are unaffected (they carry a cookie); unauthenticated requests get a 401/403
  // from the handler instead of a redirect. The /api/projects/*/suites route is matched
  // separately below -- its dynamic segment can't be a startsWith prefix without also
  // exempting every other /api/projects route.
  '/api/test-cases',           // list + create, and .../by-display-id get + update
];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }

  const { pathname } = request.nextUrl;
  const isPublicPath =
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    (pathname === '/api/feedback' && request.method === 'POST') ||
    // MCP list_projects -> GET /api/projects (list only). Handler does agent auth
    // (withAgentAuth). Exact match so the other /api/projects/* subroutes stay cookie-gated.
    pathname === '/api/projects' ||
    // MCP search_suite -> GET /api/projects/{id}/suites. Handler does agent auth (withAgentAuth).
    /^\/api\/projects\/[^/]+\/suites$/.test(pathname);

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
