'use client';

import Chip from '@mui/material/Chip';
import { alpha } from '@mui/material/styles';
import { palette } from '@/theme/palette';

function httpColor(status: number | null): string {
  if (status === null) return palette.error.main;
  if (status < 300) return palette.success.main;
  if (status < 500) return palette.warning.main;
  return palette.error.main;
}

const ORDER_STATUS_COLORS: Record<string, string> = {
  received: palette.info.main,
  needs_attention: palette.warning.main,
  accepted: palette.primary.main,
  pending: palette.neutral.light,
  processing: palette.primary.light,
  filled: palette.primary.light,
  shipped: palette.success.light,
  delivered: palette.success.main,
  rejected: palette.error.main,
  cancelled: palette.neutral.main,
};

function chip(label: string, color: string) {
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        height: 22,
        fontSize: '0.7rem',
        fontWeight: 600,
        bgcolor: alpha(color, 0.15),
        color,
        border: `1px solid ${alpha(color, 0.35)}`,
      }}
    />
  );
}

/** An HTTP status, plus the problem code when there is one (e.g. "422 invalid_npi"). */
export function HttpChip({ status, code }: { status: number | null; code?: string | null }) {
  const label = status === null ? 'no response' : code ? `${status} ${code}` : String(status);
  return chip(label, httpColor(status));
}

/** A FullStackRx order or item status, or an event type like order.shipped. */
export function OrderStatusChip({ status }: { status: string | null | undefined }) {
  if (!status) return chip('—', palette.neutral.main);
  const key = status.replace(/^order\./, '').toLowerCase();
  return chip(status, ORDER_STATUS_COLORS[key] ?? palette.neutral.light);
}
