'use client';

import { useCallback, useEffect, useState } from 'react';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import CallResultView from './CallResultView';
import { PARTNER_API_PREFIX } from '@/lib/partner-sim/transport';
import EventTimeline from './EventTimeline';
import JsonBlock from './JsonBlock';
import { HttpChip, OrderStatusChip } from './StatusChip';
import { formatTime, problemCode, readError, type CallResult, type SimEvent, type SimOrder, type SimPartner } from './types';
import { cancelOrder, refreshOrder, submitOrder } from './api';

interface Detail {
  order: SimOrder;
  attempts: {
    id: string;
    response_status: number | null;
    response_headers: Record<string, string> | null;
    fsrx_order_id: string | null;
    created_at: string;
    retry_of: string | null;
  }[];
  events: SimEvent[];
}

interface Props {
  partner: SimPartner;
  orderId: string | null;
  onClose: () => void;
  onChanged: (order: SimOrder) => void;
  onOpenOrder: (orderId: string) => void;
}

const POLL_MS = 5000;

export default function OrderDetailDrawer({ partner, orderId, onClose, onChanged, onOpenOrder }: Props) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<'refresh' | 'cancel' | 'retry' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCall, setLastCall] = useState<{ label: string; call: CallResult; body?: unknown } | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('QA test cancellation');

  const load = useCallback(async (id: string, quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await fetch(`/api/partner-sim/orders/${id}`);
      if (res.ok) setDetail(await res.json());
      else if (!quiet) setError(await readError(res));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setDetail(null);
    setError(null);
    setLastCall(null);
    if (!orderId) return;
    load(orderId);
    // Webhooks arrive on their own schedule; keep the timeline current while open.
    const timer = setInterval(() => load(orderId, true), POLL_MS);
    return () => clearInterval(timer);
  }, [orderId, load]);

  const act = async (kind: 'refresh' | 'cancel') => {
    if (!orderId || !detail) return;
    setBusy(kind);
    setError(null);
    try {
      const r =
        kind === 'cancel'
          ? await cancelOrder(detail.order, reason)
          : await refreshOrder(detail.order);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const data = r.data;
      setLastCall({ label: kind === 'cancel' ? 'Cancel' : 'Refresh', call: data.call, body: kind === 'cancel' ? { reason } : undefined });
      if (data.order) onChanged(data.order);
      await load(orderId, true);
    } finally {
      setBusy(null);
      setCancelOpen(false);
    }
  };

  const retry = async () => {
    if (!detail) return;
    const o = detail.order;
    setBusy('retry');
    setError(null);
    try {
      const r = await submitOrder(partner, {
        request: o.request_body,
        idempotency_key: o.idempotency_key || undefined,
        send_idempotency_key: !!o.idempotency_key,
        retry_of: o.retry_of ?? o.id,
        preset: o.preset ?? undefined,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      onChanged(r.data.order);
      onOpenOrder(r.data.order.id);
    } finally {
      setBusy(null);
    }
  };

  const o = detail?.order;
  const live = o?.last_order;
  const items = live?.items ?? [];

  return (
    <Drawer anchor="right" open={!!orderId} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', md: 760 } } }}>
      <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, flex: 1, wordBreak: 'break-all' }}>
            {o?.partner_order_id ?? 'Order'}
          </Typography>
          <IconButton onClick={onClose} aria-label="Close">
            <CloseIcon />
          </IconButton>
        </Box>

        {loading && !detail && <CircularProgress sx={{ alignSelf: 'center' }} />}
        {error && <Alert severity="error">{error}</Alert>}

        {o && (
          <>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
              <HttpChip status={o.response_status} code={problemCode(o.response_body)} />
              <OrderStatusChip status={o.status} />
              {live?.livemode === false && <Typography variant="caption" color="warning.main">test mode</Typography>}
              <Typography variant="caption" color="text.secondary">
                sent {formatTime(o.created_at)}
                {o.last_refreshed_at ? ` · refreshed ${formatTime(o.last_refreshed_at)}` : ''}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
              FullStackRx order id: {o.fsrx_order_id ?? '— (not accepted)'} · Idempotency-Key: {o.idempotency_key || '(none sent)'}
            </Typography>

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={busy === 'refresh' ? <CircularProgress size={14} /> : <RefreshIcon />}
                disabled={!o.fsrx_order_id || !!busy}
                onClick={() => act('refresh')}
              >
                Refresh (GET …/orders/&#123;id&#125;)
              </Button>
              <Button
                variant="outlined"
                size="small"
                color="error"
                startIcon={<CancelOutlinedIcon />}
                disabled={!o.fsrx_order_id || !!busy}
                onClick={() => setCancelOpen(true)}
              >
                Cancel order
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={busy === 'retry' ? <CircularProgress size={14} /> : <ReplayIcon />}
                disabled={!!busy}
                onClick={retry}
              >
                Retry with same Idempotency-Key
              </Button>
            </Box>

            {lastCall && (
              <Box>
                <Typography variant="overline" color="text.secondary">
                  Last {lastCall.label.toLowerCase()} call
                </Typography>
                <CallResultView call={lastCall.call} requestBody={lastCall.body} defaultExpanded={!lastCall.call.ok} />
              </Box>
            )}

            {live?.attention && (
              <Alert severity="warning">
                Needs attention: <strong>{live.attention.reasonCode}</strong> {live.attention.reason}
              </Alert>
            )}

            <Divider />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Items {live ? '' : '(refresh to load)'}
            </Typography>
            {items.length > 0 ? (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>SKU</TableCell>
                    <TableCell>Qty</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Tracking</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((it) => (
                    <TableRow key={it.id ?? it.lineNumber}>
                      <TableCell>{it.lineNumber}</TableCell>
                      <TableCell sx={{ wordBreak: 'break-all' }}>{it.sku}</TableCell>
                      <TableCell>{it.quantity}</TableCell>
                      <TableCell>
                        <OrderStatusChip status={it.status} />
                      </TableCell>
                      <TableCell sx={{ wordBreak: 'break-all' }}>
                        {[it.carrier, it.trackingNumber].filter(Boolean).join(' ')}
                        {it.trackingUrl &&
                          (/^https?:\/\//.test(it.trackingUrl) ? (
                            <Link href={it.trackingUrl} target="_blank" rel="noreferrer" sx={{ ml: 0.5 }}>
                              link
                            </Link>
                          ) : (
                            <Typography variant="caption" sx={{ ml: 0.5 }}>
                              {it.trackingUrl}
                            </Typography>
                          ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No items to show.
              </Typography>
            )}

            <Divider />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Webhook timeline
            </Typography>
            <EventTimeline events={detail!.events} />

            {detail!.attempts.length > 1 && (
              <>
                <Divider />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Sends with this Idempotency-Key ({detail!.attempts.length})
                </Typography>
                {detail!.attempts.map((a, i) => (
                  <Box key={a.id} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ width: 20 }}>
                      {i + 1}.
                    </Typography>
                    <HttpChip status={a.response_status} />
                    {/* Idempotent-Replayed is the signal; the same order id as the first send is too. */}
                    {(a.response_headers?.['idempotent-replayed'] ||
                      (i > 0 && !!a.fsrx_order_id && a.fsrx_order_id === detail!.attempts[0].fsrx_order_id)) && (
                      <Typography variant="caption" color="warning.main">
                        replayed
                      </Typography>
                    )}
                    <Link component="button" variant="caption" onClick={() => onOpenOrder(a.id)}>
                      {formatTime(a.created_at)}
                    </Link>
                    {a.id === o.id && <Typography variant="caption">(this one)</Typography>}
                  </Box>
                ))}
              </>
            )}

            <Divider />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Create request and response
            </Typography>
            {o.error_message && <Alert severity="error">{o.error_message}</Alert>}
            <Typography variant="overline" color="text.secondary">
              Request body
            </Typography>
            <JsonBlock value={o.request_body} maxHeight={300} />
            <Typography variant="overline" color="text.secondary">
              Response ({o.response_status ?? 'none'}, {o.duration_ms ?? '—'} ms)
            </Typography>
            <JsonBlock value={{ headers: o.response_headers, body: o.response_body }} maxHeight={300} />
            {live && (
              <>
                <Typography variant="overline" color="text.secondary">
                  Latest GET {PARTNER_API_PREFIX}/orders/&#123;id&#125;
                </Typography>
                <JsonBlock value={live} maxHeight={300} />
              </>
            )}
          </>
        )}
      </Box>

      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Cancel this order in FullStackRx?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Sends POST {PARTNER_API_PREFIX}/orders/&#123;id&#125;/cancel. Items already filled or shipped can&apos;t be cancelled (409
            order_not_cancellable).
          </Typography>
          <TextField
            label="Reason (never patient details)"
            size="small"
            fullWidth
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setCancelOpen(false)} disabled={busy === 'cancel'}>
            Keep it
          </Button>
          <Button variant="contained" color="error" onClick={() => act('cancel')} disabled={busy === 'cancel'}>
            {busy === 'cancel' ? 'Cancelling…' : 'Cancel order'}
          </Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  );
}
