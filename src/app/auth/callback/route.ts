import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';
  const inviteToken = searchParams.get('invite_token');

  if (code) {
    const pendingCookies: { name: string; value: string; options: CookieOptions }[] = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            pendingCookies.push(...cookiesToSet);
          },
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      if (inviteToken) {
        await processInvitation(supabase, inviteToken);
      }

      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';

      let redirectUrl: string;
      if (isLocalEnv) {
        redirectUrl = `${origin}${next}`;
      } else if (forwardedHost) {
        redirectUrl = `https://${forwardedHost}${next}`;
      } else {
        redirectUrl = `${origin}${next}`;
      }

      const response = NextResponse.redirect(redirectUrl);

      pendingCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, { ...options, httpOnly: false });
      });

      return response;
    }
  }

  return NextResponse.redirect(`${new URL(request.url).origin}/login?error=auth`);
}

async function processInvitation(
  supabase: ReturnType<typeof createServerClient>,
  token: string,
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return;

    const { data: invitation } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', token)
      .eq('status', 'pending')
      .single();

    if (!invitation) return;

    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) return;

    if (new Date(invitation.expires_at) < new Date()) return;

    await supabase
      .from('invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', invitation.id);

    await supabase
      .from('profiles')
      .update({ role: invitation.role })
      .eq('id', user.id);
  } catch {
    // Non-critical -- user still gets signed in with default role
  }
}
