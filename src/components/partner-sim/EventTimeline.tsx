'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Collapse from '@mui/material/Collapse';
import Tooltip from '@mui/material/Tooltip';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import GppBadOutlinedIcon from '@mui/icons-material/GppBadOutlined';
import { palette } from '@/theme/palette';
import { buildTimeline } from '@/lib/partner-sim/webhook-events';
import JsonBlock from './JsonBlock';
import { OrderStatusChip } from './StatusChip';
import { formatTime, type SimEvent } from './types';

const SIGNATURE_REASONS: Record<string, string> = {
  no_secret: 'No webhook secret saved for this partner, so it could not be checked',
  missing_header: 'No FullStackRx-Signature header',
  malformed: 'FullStackRx-Signature header is malformed',
  stale: 'Signed more than 5 minutes from now (replay window)',
  mismatch: 'Signature does not match the body and secret',
  decrypt_failed: 'The stored webhook secret could not be decrypted',
};

export function SignatureBadge({ event }: { event: SimEvent }) {
  return event.signature_valid ? (
    <Tooltip title="Signature verified">
      <VerifiedOutlinedIcon fontSize="small" sx={{ color: palette.success.main }} />
    </Tooltip>
  ) : (
    <Tooltip title={SIGNATURE_REASONS[event.signature_error ?? ''] ?? event.signature_error ?? 'Not verified'}>
      <GppBadOutlinedIcon fontSize="small" sx={{ color: palette.error.main }} />
    </Tooltip>
  );
}

function itemLabel(event: SimEvent): string {
  const data = (event.body as { data?: Record<string, unknown> } | null)?.data ?? {};
  const bits: string[] = [];
  if (typeof data.sku === 'string') bits.push(data.sku);
  if (typeof data.reasonCode === 'string') bits.push(data.reasonCode);
  if (typeof data.reason === 'string') bits.push(data.reason);
  if (typeof data.stage === 'string') bits.push(`stage ${data.stage}`);
  if (typeof data.trackingNumber === 'string') bits.push(`tracking ${data.trackingNumber}`);
  else if (typeof data.trackingUrl === 'string') bits.push('tracking link');
  return bits.join(' · ');
}

/** Webhooks for one order, deduped on event id and ordered by the event's createdAt. */
export default function EventTimeline({ events }: { events: SimEvent[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const timeline = buildTimeline(events);

  if (timeline.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No webhooks received for this order yet. Check the connection&apos;s webhook URL points at this partner&apos;s
        receiver.
      </Typography>
    );
  }

  return (
    <Box sx={{ position: 'relative', pl: 2.5 }}>
      <Box sx={{ position: 'absolute', left: 7, top: 6, bottom: 6, width: 2, bgcolor: palette.divider }} />
      {timeline.map((e) => (
        <Box key={e.id} sx={{ position: 'relative', mb: 1.5 }}>
          <Box
            sx={{
              position: 'absolute',
              left: -18.5,
              top: 7,
              width: 10,
              height: 10,
              borderRadius: '50%',
              bgcolor: e.signature_valid ? palette.primary.main : palette.error.main,
            }}
          />
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', cursor: 'pointer' }}
            onClick={() => setOpen(open === e.id ? null : e.id)}
          >
            <OrderStatusChip status={e.event_type} />
            <SignatureBadge event={e} />
            <Typography variant="caption" color="text.secondary">
              {formatTime(e.event_created_at)}
            </Typography>
            {e.delivery_count > 1 && (
              <Typography variant="caption" color="warning.main">
                delivered {e.delivery_count}×
              </Typography>
            )}
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {itemLabel(e)}
            </Typography>
          </Box>
          <Collapse in={open === e.id} unmountOnExit>
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {e.event_id} · received {formatTime(e.received_at)}
              </Typography>
              <JsonBlock value={e.body} maxHeight={240} />
            </Box>
          </Collapse>
        </Box>
      ))}
    </Box>
  );
}
