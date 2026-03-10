'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { alpha } from '@mui/material/styles';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { palette } from '@/theme/palette';
import FullStackLogo from '@/components/layout/FullStackLogo';

const GRID_SIZE = 40;
const GRID_COLS = 50;
const GRID_ROWS = 30;

function AnimatedGrid() {
  const [cells, setCells] = useState<number[]>([]);

  useEffect(() => {
    const pick = () => {
      const count = 4 + Math.floor(Math.random() * 4);
      const indices: number[] = [];
      for (let i = 0; i < count; i++) {
        indices.push(Math.floor(Math.random() * GRID_COLS * GRID_ROWS));
      }
      setCells(indices);
    };
    pick();
    const id = setInterval(pick, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0 }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
          <path
            d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`}
            fill="none"
            stroke={alpha(palette.primary.main, 0.04)}
            strokeWidth="1"
          />
        </pattern>
        <radialGradient id="gridFade" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="gridMask">
          <rect width="100%" height="100%" fill="url(#gridFade)" />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" mask="url(#gridMask)" />
      {cells.map((idx) => {
        const col = idx % GRID_COLS;
        const row = Math.floor(idx / GRID_COLS);
        return (
          <motion.rect
            key={`${idx}-${Math.random()}`}
            x={col * GRID_SIZE}
            y={row * GRID_SIZE}
            width={GRID_SIZE}
            height={GRID_SIZE}
            rx="2"
            fill={palette.primary.main}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.08, 0] }}
            transition={{ duration: 2.5, ease: 'easeInOut' }}
          />
        );
      })}
    </svg>
  );
}

function OrbGlow({ color, size, top, left, delay }: { color: string; size: number; top: string; left: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: [0.15, 0.3, 0.15], scale: [0.9, 1.1, 0.9] }}
      transition={{ duration: 8, ease: 'easeInOut', repeat: Infinity, delay }}
      style={{
        position: 'absolute',
        top,
        left,
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${alpha(color, 0.4)} 0%, transparent 70%)`,
        filter: 'blur(60px)',
        pointerEvents: 'none',
      }}
    />
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const error = searchParams.get('error');

  useEffect(() => {
    setMounted(true);
    const supabase = createClient();
    supabase.auth.signOut({ scope: 'local' });
  }, []);

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
        bgcolor: palette.background.default,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {mounted && <AnimatedGrid />}

      <OrbGlow color={palette.primary.main} size={600} top="-15%" left="-10%" delay={0} />
      <OrbGlow color={palette.info.main} size={500} top="60%" left="70%" delay={2} />
      <OrbGlow color={palette.success.main} size={350} top="30%" left="80%" delay={4} />

      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 800,
          height: 800,
          borderRadius: '50%',
          border: `1px solid ${alpha(palette.primary.main, 0.06)}`,
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 1100,
          height: 1100,
          borderRadius: '50%',
          border: `1px solid ${alpha(palette.primary.main, 0.03)}`,
          pointerEvents: 'none',
        }}
      />

      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          maxWidth: 480,
          mx: 2,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0, 0, 0.2, 1] }}
          style={{ marginBottom: 16 }}
        >
          <FullStackLogo height={44} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0, 0, 0.2, 1] }}
          style={{ width: '100%' }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3.5,
              p: { xs: 4, sm: 5 },
              borderRadius: 3,
              bgcolor: alpha(palette.background.paper, 0.7),
              backdropFilter: 'blur(24px)',
              border: `1px solid ${alpha(palette.primary.main, 0.1)}`,
              boxShadow: `
                0 0 0 1px ${alpha(palette.primary.main, 0.05)},
                0 20px 50px -12px ${alpha(palette.background.default, 0.8)},
                0 0 80px ${alpha(palette.primary.main, 0.08)}
              `,
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
              <Typography
                variant="h2"
                sx={{
                  fontWeight: 800,
                  background: `linear-gradient(135deg, ${palette.text.primary} 0%, ${palette.primary.light} 50%, ${palette.info.light} 100%)`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  letterSpacing: '-0.02em',
                }}
              >
                TestForge
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  color: 'text.secondary',
                  textAlign: 'center',
                  maxWidth: 320,
                  fontSize: '1.15rem',
                  lineHeight: 1.6,
                }}
              >
                Build, track, and ship quality.
                <br />
                <Box
                  component="span"
                  sx={{ color: palette.primary.light, fontWeight: 600 }}
                >
                  Your QA command center.
                </Box>
              </Typography>
            </Box>

            {error === 'auth' && (
              <Alert severity="warning" sx={{ width: '100%' }}>
                Session expired. Please sign in again.
              </Alert>
            )}

            <Button
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              onClick={handleGoogleSignIn}
              sx={{
                py: 1.75,
                bgcolor: palette.background.surface2,
                color: 'text.primary',
                border: `1px solid ${alpha(palette.divider, 1)}`,
                borderRadius: 2,
                fontSize: '0.95rem',
                fontWeight: 600,
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: palette.background.surface3,
                  borderColor: palette.primary.main,
                  boxShadow: `
                    0 0 20px ${alpha(palette.primary.main, 0.2)},
                    0 0 60px ${alpha(palette.primary.main, 0.1)}
                  `,
                },
              }}
            >
              {loading ? (
                <CircularProgress size={20} sx={{ mr: 1.5 }} />
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

            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              Use your company Google Workspace account
            </Typography>
          </Box>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          style={{ marginTop: 32, textAlign: 'center' }}
        >
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>
            Want something like this built for you?{' '}
            <Box
              component="a"
              href="https://joinfullstack.com"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: palette.primary.light,
                textDecoration: 'none',
                fontWeight: 600,
                transition: 'color 0.15s',
                '&:hover': { color: palette.primary.main },
              }}
            >
              joinfullstack.com
            </Box>
          </Typography>
        </motion.div>
      </Box>
    </Box>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
