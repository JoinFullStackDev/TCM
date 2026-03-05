'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CircularProgress from '@mui/material/CircularProgress';
import { alpha } from '@mui/material/styles';
import PageTransition from '@/components/animations/PageTransition';
import WebhookEventLog from '@/components/webhooks/WebhookEventLog';
import { useAuth } from '@/components/providers/AuthProvider';
import { palette } from '@/theme/palette';

export default function IntegrationsPage() {
  const router = useRouter();
  const { can, isLoading: authLoading } = useAuth();
  const [events, setEvents] = useState<Parameters<typeof WebhookEventLog>[0]['events']>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const canView = can('view_webhooks');
  const canManage = can('manage_webhooks');

  useEffect(() => {
    if (!authLoading && !canView) {
      router.push('/');
    }
  }, [authLoading, canView, router]);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/webhooks/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && canView) fetchEvents();
  }, [authLoading, canView, fetchEvents]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  if (authLoading || !canView) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhooks/playwright`
    : '/api/webhooks/playwright';

  return (
    <PageTransition>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Integrations
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
          Configure webhook endpoints for CI/CD automation. Playwright test
          results are automatically ingested and create test runs.
        </Typography>

        <Box
          sx={{
            p: 3,
            mb: 3,
            borderRadius: 2,
            bgcolor: 'background.paper',
            border: `1px solid ${palette.divider}`,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Playwright Webhook
          </Typography>

          <Box sx={{ mb: 2 }}>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}
            >
              Endpoint URL
            </Typography>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                p: 1.5,
                borderRadius: 1,
                bgcolor: palette.background.surface2,
                border: `1px solid ${palette.divider}`,
              }}
            >
              <Typography
                variant="body2"
                sx={{ fontFamily: 'monospace', fontSize: '0.8rem', flex: 1 }}
              >
                {webhookUrl}
              </Typography>
              <Tooltip title={copied === 'url' ? 'Copied!' : 'Copy'}>
                <IconButton
                  size="small"
                  onClick={() => handleCopy(webhookUrl, 'url')}
                >
                  <ContentCopyIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {canManage && (
            <Box sx={{ mb: 2 }}>
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}
              >
                API Key (X-API-Key header)
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: palette.background.surface2,
                  border: `1px solid ${palette.divider}`,
                }}
              >
                <Typography
                  variant="body2"
                  sx={{ fontFamily: 'monospace', fontSize: '0.8rem', flex: 1 }}
                >
                  ••••••••••••••••••••
                </Typography>
                <Tooltip title={copied === 'key' ? 'Copied!' : 'Copy key'}>
                  <IconButton
                    size="small"
                    onClick={() =>
                      handleCopy('tcm-webhook-dev-key-change-in-production', 'key')
                    }
                  >
                    <ContentCopyIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                Include this key in the X-API-Key header of your CI/CD webhook requests.
              </Typography>
            </Box>
          )}

          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Method: <Chip label="POST" size="small" sx={{ height: 20, fontSize: '0.6rem', fontWeight: 600, ml: 0.5 }} />
            </Typography>
          </Box>
        </Box>

        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
          Webhook Event Log
        </Typography>

        <WebhookEventLog
          events={events}
          loading={loading}
        />

        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            onClick={fetchEvents}
            sx={{ fontSize: '0.75rem' }}
          >
            Refresh
          </Button>
        </Box>
      </Box>
    </PageTransition>
  );
}
