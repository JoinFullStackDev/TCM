'use client';

import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import RefreshIcon from '@mui/icons-material/Refresh';
import { PRESETS } from '@/lib/partner-sim/randomizer';
import { HttpChip, OrderStatusChip } from './StatusChip';
import { formatTime, problemCode, type SimOrder } from './types';

interface Props {
  orders: SimOrder[];
  onOpen: (orderId: string) => void;
  onReload: () => void;
}

export default function OrdersTable({ orders, onOpen, onReload }: Props) {
  return (
    <Paper variant="outlined">
      <Box sx={{ display: 'flex', alignItems: 'center', p: 1.5, gap: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
          Orders sent ({orders.length})
        </Typography>
        <Button size="small" startIcon={<RefreshIcon />} onClick={onReload}>
          Reload
        </Button>
      </Box>
      {orders.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
          Nothing sent yet. Build an order on the Order builder tab.
        </Typography>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Sent</TableCell>
                <TableCell>partnerOrderId</TableCell>
                <TableCell>Preset</TableCell>
                <TableCell>Response</TableCell>
                <TableCell>Order status</TableCell>
                <TableCell>Items</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.map((o) => {
                const items = o.last_order?.items ?? [];
                const replayed = o.response_headers?.['idempotent-replayed'];
                return (
                  <TableRow key={o.id} hover sx={{ cursor: 'pointer' }} onClick={() => onOpen(o.id)}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatTime(o.created_at)}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {o.partner_order_id ?? '—'}
                      {o.retry_of && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          retry{replayed ? ' (replayed)' : ''}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{PRESETS.find((p) => p.id === o.preset)?.label ?? o.preset ?? 'custom'}</TableCell>
                    <TableCell>
                      <HttpChip status={o.response_status} code={problemCode(o.response_body)} />
                    </TableCell>
                    <TableCell>
                      <OrderStatusChip status={o.status} />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {items.length
                          ? items.map((it) => <OrderStatusChip key={it.id ?? it.lineNumber} status={it.status} />)
                          : '—'}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}
    </Paper>
  );
}
