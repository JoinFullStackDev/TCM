'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { createClient } from '@/lib/supabase/client';

function LoadingScreen() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 2 }}>
      <CircularProgress />
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Signing you in...
      </Typography>
    </Box>
  );
}

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const handleCallback = async () => {
      const supabase = createClient();
      const code = searchParams.get('code');
      const inviteToken = searchParams.get('invite_token');

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
          if (inviteToken) {
            await processInvitation(supabase, inviteToken);
          }
          router.replace('/');
          return;
        }
      }

      router.replace('/login?error=auth');
    };

    handleCallback();
  }, [router, searchParams]);

  return <LoadingScreen />;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <CallbackHandler />
    </Suspense>
  );
}

async function processInvitation(
  supabase: ReturnType<typeof createClient>,
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
    // Non-critical
  }
}
