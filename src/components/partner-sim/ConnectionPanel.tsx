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
import CallResultView from './CallResultView';
import { formatTime, type CallResult, type SimPartner } from './types';

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
}

export default function ConnectionPanel({ partner, lastSync }: Props) {
  const [copied, setCopied] = useState(false);
  const c = partner.connection;
  const cat = partner.catalog;
  const money = (cents?: number) => (cents === undefined ? '—' : `$${(cents / 100).toFixed(2)}`);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
        {partner.webhook_url?.includes('localhost') && (
          <Alert severity="info" sx={{ mt: 1 }}>
            FullStackRx can&apos;t reach &quot;localhost&quot; from QA/staging, and the local API in Docker needs
            host.docker.internal. Set PARTNER_SIM_WEBHOOK_BASE_URL (e.g. http://host.docker.internal:3000) for local
            testing, or use the deployed TCM URL.
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
