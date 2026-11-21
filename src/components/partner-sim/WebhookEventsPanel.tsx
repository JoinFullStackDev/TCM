'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Collapse from '@mui/material/Collapse';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Link from '@mui/material/Link';
import RefreshIcon from '@mui/icons-material/Refresh';
import { SignatureBadge } from './EventTimeline';
import JsonBlock from './JsonBlock';
import { OrderStatusChip } from './StatusChip';
import { formatTime, type SimEvent, type SimOrder, type SimPartner } from './types';

interface Props {
  partner: SimPartner;
  orders: SimOrder[];
  onOpenOrder: (orderId: string) => void;
}

export default function WebhookEventsPanel({ partner, orders, onOpenOrder }: Props) {
  const [events, setEvents] = useState<SimEvent[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [auto, setAuto] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/partner-sim/partners/${partner.id}/events`);
    if (res.ok) setEvents(await res.json());
  }, [partner.id]);

  useEffect(() => {
    load();
    if (!auto) return;
    const timer = setInterval(load, 10_000);
    return () => clearInterval(timer);
  }, [load, auto]);

  const orderFor = (e: SimEvent) =>
    e.fsrx_order_id ? orders.find((o) => o.fsrx_order_id === e.fsrx_order_id && !o.retry_of) : undefined;

  return (
    <Paper variant="outlined">
      <Box sx={{ display: 'flex', alignItems: 'center', p: 1.5, gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
          Webhooks received ({events.length})
        </Typography>
        <FormControlLabel control={<Switch size="small" checked={auto} onChange={(e) => setAuto(e.target.checked)} />} label="Auto-refresh" />
        <Button size="small" startIcon={<RefreshIcon />} onClick={load}>
          Reload
        </Button>
      </Box>
      {!partner.webhook_secret_last4 && (
        <Alert severity="warning" sx={{ mx: 1.5, mb: 1.5 }}>
          No webhook signing secret saved, so signatures can&apos;t be verified. Copy the whsec_ secret from the
          connection&apos;s Webhooks tab into this partner&apos;s settings.
        </Alert>
      )}
      {events.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
          Nothing received yet. Paste this partner&apos;s webhook URL (Connection tab) into the connection&apos;s Webhooks
          tab in FullStackRx, then send an order.
        </Typography>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Received</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Event createdAt</TableCell>
                <TableCell>Order</TableCell>
                <TableCell>Signature</TableCell>
                <TableCell>Deliveries</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.map((e) => {
                const order = orderFor(e);
                return (
                  <Fragment key={e.id}>
                    <TableRow hover sx={{ cursor: 'pointer' }} onClick={() => setOpen(open === e.id ? null : e.id)}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatTime(e.last_received_at)}</TableCell>
                      <TableCell>
                        <OrderStatusChip status={e.event_type} />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatTime(e.event_created_at)}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {order ? (
                          <Link
                            component="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              onOpenOrder(order.id);
                            }}
                          >
                            {e.partner_order_id ?? e.fsrx_order_id}
                          </Link>
                        ) : (
                          e.partner_order_id ?? '—'
                        )}
                      </TableCell>
                      <TableCell>
                        <SignatureBadge event={e} />
                      </TableCell>
                      <TableCell>{e.delivery_count}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={6} sx={{ p: 0, border: open === e.id ? undefined : 0 }}>
                        <Collapse in={open === e.id} unmountOnExit>
                          <Box sx={{ p: 1.5, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 2fr' }, gap: 1.5 }}>
                            <JsonBlock value={e.headers} maxHeight={240} />
                            <JsonBlock value={e.body} maxHeight={240} />
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}
    </Paper>
  );
}
