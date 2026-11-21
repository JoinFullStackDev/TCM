'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import { alpha } from '@mui/material/styles';
import PageTransition from '@/components/animations/PageTransition';
import EmptyState from '@/components/common/EmptyState';
import PartnerFormDialog from '@/components/partner-sim/PartnerFormDialog';
import { useAuth } from '@/components/providers/AuthProvider';
import { palette } from '@/theme/palette';
import { formatTime, type SimPartnersResponse } from '@/components/partner-sim/types';

export default function PartnerSimPage() {
  const { can, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<SimPartnersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    fetch('/api/partner-sim/partners').then(async (res) => {
      if (!active) return;
      if (res.ok) setData(await res.json());
      else setError(res.status === 403 ? 'The Partner API simulator needs the QA Engineer role or above.' : `Could not load partners (${res.status})`);
    });
    return () => {
      active = false;
    };
  }, [authLoading]);

  if (authLoading || (!data && !error)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <PageTransition>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Partner API Simulator
          </Typography>
          {can('write') && data && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
              New partner
            </Button>
          )}
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 820 }}>
          Act as a telehealth partner against FullStackRx&apos;s Partner Order API: save a partner&apos;s API key, sync its
          catalog, randomize valid (or deliberately broken) orders, send them, track their status and watch the signed
          webhooks come back. Make one partner per FullStackRx connection you test; each keeps its own key, webhook
          secret, prescribers and orders.
        </Typography>
        <Alert severity="info" variant="outlined" sx={{ mb: 3, maxWidth: 820 }}>
          Requests to QA go from your own browser, so turn the VPN on just as you do to use FullStackRx QA. These are
          QA/staging keys only; after a partner has sent a batch of orders, TCM will remind you to swap its key for a
          fresh one.
        </Alert>

        {error && <Alert severity="error">{error}</Alert>}
        {data && !data.encryptionConfigured && (
          <Alert severity="error" sx={{ mb: 2 }}>
            The server can&apos;t encrypt keys: set PARTNER_SIM_ENCRYPTION_KEY or SUPABASE_SERVICE_ROLE_KEY.
          </Alert>
        )}

        {data && data.partners.length === 0 ? (
          <EmptyState
            icon={<ScienceOutlinedIcon sx={{ fontSize: 32 }} />}
            title="No test partners yet"
            description="Create a pharmacy partner connection in FullStackRx, issue an API key, then add it here as a test partner."
            actionLabel="New partner"
            onAction={() => setCreateOpen(true)}
            showAction={can('write')}
          />
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' }, gap: 2 }}>
            {data?.partners.map((p) => {
              const env = data.environments.find((e) => e.id === p.environment);
              const live = p.api_key_mode === 'live';
              return (
                <Paper
                  key={p.id}
                  component={Link}
                  href={`/partner-sim/${p.id}`}
                  variant="outlined"
                  sx={{
                    p: 2,
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'border-color 0.15s',
                    '&:hover': { borderColor: palette.primary.main },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>
                      {p.name}
                    </Typography>
                    <Chip label={env?.label ?? p.environment} size="small" />
                    <Chip
                      label={`${p.api_key_mode} …${p.api_key_last4}`}
                      size="small"
                      sx={{
                        bgcolor: alpha(live ? palette.warning.main : palette.info.main, 0.15),
                        color: live ? palette.warning.main : palette.info.main,
                      }}
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {p.connection?.pharmacyName ? `${p.connection.pharmacyName} · ${p.connection.status}` : 'Connection not checked yet'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', wordBreak: 'break-all' }}>
                    {p.api_base_url ?? 'no API base URL'} · from {p.call_mode === 'browser' ? 'your browser' : "TCM's server"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {p.catalog ? `${p.catalog.items?.length ?? 0} catalog items` : 'Catalog not synced'} · webhook secret{' '}
                    {p.webhook_secret_last4 ? 'saved' : 'missing'} · created {formatTime(p.created_at)}
                  </Typography>
                </Paper>
              );
            })}
          </Box>
        )}

        {data && (
          <PartnerFormDialog
            open={createOpen}
            environments={data.environments}
            onClose={() => setCreateOpen(false)}
            onSaved={(p) => {
              setData((d) => (d ? { ...d, partners: [p, ...d.partners] } : d));
              window.location.assign(`/partner-sim/${p.id}`);
            }}
          />
        )}
      </Box>
    </PageTransition>
  );
}
