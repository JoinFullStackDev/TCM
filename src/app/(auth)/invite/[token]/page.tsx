'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import { alpha } from '@mui/material/styles';
import GoogleIcon from '@mui/icons-material/Google';
import { createClient } from '@/lib/supabase/client';
import { ROLE_LABELS } from '@/lib/auth/rbac';
import { palette, semanticColors } from '@/theme/palette';
import type { Invitation, UserRole } from '@/types/database';

export default function InviteAcceptPage() {
  const params = useParams();
  const token = params.token as string;
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const checkInvitation = async () => {
      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from('invitations')
          .select('*')
          .eq('token', token)
          .single();

        if (fetchError || !data) {
          setError('Invitation not found');
          return;
        }

        if (data.status !== 'pending') {
          setError(`This invitation has already been ${data.status}`);
          return;
        }

        if (new Date(data.expires_at) < new Date()) {
          setError('This invitation has expired');
          return;
        }

        setInvitation(data as Invitation);
      } catch {
        setError('Failed to load invitation');
      } finally {
        setLoading(false);
      }
    };

    checkInvitation();
  }, [token]);

  const handleSignIn = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/&invite_token=${token}`,
      },
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: 'background.default' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', bgcolor: 'background.default', p: 3 }}>
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
          Invalid Invitation
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          {error}
        </Typography>
      </Box>
    );
  }

  if (!invitation) return null;

  const roleColor = semanticColors.role[invitation.role as UserRole];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', bgcolor: 'background.default', p: 3 }}>
      <Box
        sx={{
          maxWidth: 420,
          width: '100%',
          p: 4,
          borderRadius: '12px',
          bgcolor: 'background.paper',
          border: `1px solid ${palette.divider}`,
          textAlign: 'center',
        }}
      >
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: '12px',
            background: `linear-gradient(135deg, ${palette.primary.main}, ${palette.info.main})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 3,
          }}
        >
          <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.2rem' }}>T</Typography>
        </Box>

        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          You&apos;re Invited
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3 }}>
          You&apos;ve been invited to join TCM as
        </Typography>

        <Chip
          label={ROLE_LABELS[invitation.role as UserRole]}
          sx={{
            height: 32,
            fontSize: '0.875rem',
            fontWeight: 600,
            bgcolor: alpha(roleColor, 0.15),
            color: roleColor,
            mb: 3,
          }}
        />

        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
          Sign in with your Google account ({invitation.email}) to accept.
        </Typography>

        <Button
          variant="contained"
          size="large"
          fullWidth
          startIcon={<GoogleIcon />}
          onClick={handleSignIn}
          sx={{ py: 1.5 }}
        >
          Sign in with Google
        </Button>
      </Box>
    </Box>
  );
}
