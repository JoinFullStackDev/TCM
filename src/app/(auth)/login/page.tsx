'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { alpha } from '@mui/material/styles';
import { createClient } from '@/lib/supabase/client';
import { palette } from '@/theme/palette';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          p: 5,
          borderRadius: 2,
          bgcolor: 'background.paper',
          border: `1px solid ${palette.divider}`,
          maxWidth: 400,
          width: '100%',
          mx: 2,
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '12px',
              background: `linear-gradient(135deg, ${palette.primary.main}, ${palette.info.main})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 1,
            }}
          >
            <Typography variant="h5" sx={{ color: '#fff', fontWeight: 800 }}>
              T
            </Typography>
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
            TCM
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
            Test Case Management
          </Typography>
        </Box>

        <Button
          fullWidth
          variant="contained"
          size="large"
          disabled={loading}
          onClick={handleGoogleSignIn}
          sx={{
            py: 1.5,
            bgcolor: palette.background.surface2,
            color: 'text.primary',
            border: `1px solid ${palette.divider}`,
            '&:hover': {
              bgcolor: palette.background.surface3,
              boxShadow: `0 0 20px ${alpha(palette.primary.main, 0.15)}`,
            },
          }}
        >
          {loading ? (
            <CircularProgress size={20} sx={{ mr: 1 }} />
          ) : (
            <Box
              component="svg"
              viewBox="0 0 24 24"
              sx={{ width: 20, height: 20, mr: 1.5 }}
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </Box>
          )}
          Sign in with Google
        </Button>

        <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
          Use your company Google Workspace account
        </Typography>
      </Box>
    </Box>
  );
}
