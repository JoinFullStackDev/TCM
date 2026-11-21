'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import Button from '@mui/material/Button';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import CallResultView from './CallResultView';
import { getCredentials } from './api';
import { formatTime, type CallResult, type SimPartner } from './types';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Tooltip title={copied ? 'Copied' : 'Copy'}>
      <IconButton
        size="small"
        onClick={() => {
          navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}

/** The saved API key and webhook secret, hidden until asked for. */
function KeysSection({ partner, onSwapKey }: { partner: SimPartner; onSwapKey: () => void }) {
  const [revealed, setRevealed] = useState<{ api_key: string; webhook_secret: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    if (revealed) return setRevealed(null);
    const r = await getCredentials(partner.id);
    if (r.ok) setRevealed(r.data);
    else setError(r.error);
  };

  const mono = { fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all' } as const;
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
          Keys
        </Typography>
        <Button size="small" startIcon={revealed ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />} onClick={toggle}>
          {revealed ? 'Hide' : 'Show'}
        </Button>
        <Button size="small" onClick={onSwapKey}>
          Swap key
        </Button>
      </Box>
      <Row label="API key">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography sx={mono}>{revealed ? revealed.api_key : `fsrx_${partner.api_key_mode}_…${partner.api_key_last4}`}</Typography>
          {revealed && <CopyButton text={revealed.api_key} />}
        </Box>
      </Row>
      <Row label="Added">
        {formatTime(partner.api_key_set_at)} · {partner.orders_with_current_key ?? 0} orders sent with it
      </Row>
      <Row label="Webhook secret">
        {partner.webhook_secret_last4 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography sx={mono}>{revealed?.webhook_secret ?? `whsec_…${partner.webhook_secret_last4}`}</Typography>
            {revealed?.webhook_secret && <CopyButton text={revealed.webhook_secret} />}
          </Box>
        ) : (
          <Typography color="warning.main" variant="body2">
            not saved
          </Typography>
        )}
      </Row>
      <Row label="Requests go">
        {partner.call_mode === 'browser' ? (
          <>
            from <strong>your browser</strong> to {partner.api_url ?? '—'}/v1. For QA, have the VPN on. FullStackRx must
            also allow this TCM site&apos;s origin in its CORS settings for /v1.
          </>
        ) : (
          <>
            from <strong>TCM&apos;s server</strong> to {partner.api_url ?? '—'}/v1, so the environment must be reachable
            from the internet (staging, not VPN-only QA).
          </>
        )}
      </Row>
      {error && <Alert severity="error">{error}</Alert>}
    </Paper>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', gap: 2, py: 0.5 }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: 160, flexShrink: 0 }}>
        {label}
      </Typography>
      <Box sx={{ minWidth: 0, wordBreak: 'break-word' }}>{children}</Box>
    </Box>
  );
}

interface Props {
  partner: SimPartner;
  lastSync: { connection: CallResult; catalog: CallResult } | null;
  onSwapKey: () => void;
}

export default function ConnectionPanel({ partner, lastSync, onSwapKey }: Props) {
  const [copied, setCopied] = useState(false);
  const c = partner.connection;
  const cat = partner.catalog;
  const money = (cents?: number) => (cents === undefined ? '—' : `$${(cents / 100).toFixed(2)}`);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <KeysSection partner={partner} onSwapKey={onSwapKey} />

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Webhook receiver
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          In FullStackRx, open Settings → Partner connections → this connection → Webhooks, set the URL below, and copy the
          whsec_ signing secret it shows into this partner (Edit).
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            component="code"
            sx={{ p: 1, bgcolor: 'background.default', borderRadius: 1, fontSize: '0.8rem', wordBreak: 'break-all', flex: 1 }}
          >
            {partner.webhook_url}
          </Box>
          <Tooltip title={copied ? 'Copied' : 'Copy'}>
            <IconButton
              onClick={() => {
                navigator.clipboard.writeText(partner.webhook_url ?? '');
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
        <Row label="Signing secret">
          {partner.webhook_secret_last4 ? `whsec_…${partner.webhook_secret_last4}` : <Typography color="warning.main" variant="body2">not saved</Typography>}
        </Row>
        <Row label="Receiver answers">{partner.webhook_response_status}</Row>
        {/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(partner.webhook_url ?? '') && (
          <Alert severity="info" sx={{ mt: 1 }}>
            This is a local TCM address, which FullStackRx on QA or staging can&apos;t reach. Use the deployed TCM for
            webhooks.
          </Alert>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Connection (GET /v1/connection)
        </Typography>
        {c ? (
          <>
            <Row label="Pharmacy">{c.pharmacyName ?? '—'}</Row>
            <Row label="Partner name">{c.partnerName ?? '—'}</Row>
            <Row label="Status">{c.status ?? '—'}</Row>
            <Row label="Mode">{c.livemode === false ? 'test (creates nothing)' : 'live'}</Row>
            <Row label="Allowed states">
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {(c.allowedStates ?? []).map((s) => (
                  <Chip key={s} label={s} size="small" />
                ))}
              </Box>
            </Row>
            <Row label="Events">{(c.events ?? []).join(', ') || '—'}</Row>
            <Row label="Sends tracking">{c.sendsTracking ? 'yes' : 'no'}</Row>
            <Row label="Checked">{formatTime(partner.connection_checked_at)}</Row>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Not checked yet. Use Sync connection &amp; catalog.
          </Typography>
        )}
      </Paper>

      <Paper variant="outlined">
        <Typography variant="subtitle2" sx={{ fontWeight: 700, p: 1.5 }}>
          Catalog (GET /v1/catalog){cat ? ` · ${cat.items?.length ?? 0} items · fetched ${formatTime(partner.catalog_fetched_at)}` : ''}
        </Typography>
        {cat ? (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>SKU</TableCell>
                  <TableCell>Product</TableCell>
                  <TableCell>Price</TableCell>
                  <TableCell>Max qty</TableCell>
                  <TableCell>Rationale</TableCell>
                  <TableCell>Available</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(cat.items ?? []).map((i) => (
                  <TableRow key={i.sku}>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{i.sku}</TableCell>
                    <TableCell>
                      {i.productName}
                      {i.variationName ? ` · ${i.variationName}` : ''}
                    </TableCell>
                    <TableCell>{money(i.priceCents)}</TableCell>
                    <TableCell>{i.maxQuantity ?? '—'}</TableCell>
                    <TableCell>{i.rationaleRequired ? 'required' : ''}</TableCell>
                    <TableCell>{i.available === false ? 'no' : 'yes'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Box sx={{ p: 1.5 }}>
              <Typography variant="body2" color="text.secondary">
                Shipping methods:{' '}
                {(cat.shippingMethods ?? []).map((m) => `${m.label ?? m.code} (${m.code}, ${money(m.priceCents)})`).join(' · ') || '—'}
              </Typography>
            </Box>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>
            Not fetched yet.
          </Typography>
        )}
      </Paper>

      {lastSync && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="overline" color="text.secondary">
            Last sync calls
          </Typography>
          <CallResultView call={lastSync.connection} defaultExpanded={!lastSync.connection.ok} />
          <CallResultView call={lastSync.catalog} defaultExpanded={!lastSync.catalog.ok} />
        </Box>
      )}
    </Box>
  );
}
