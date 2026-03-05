'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { alpha } from '@mui/material/styles';
import { palette } from '@/theme/palette';
import type { WebhookEventStatus } from '@/types/database';

interface WebhookEvent {
  id: string;
  project_id: string;
  test_run_id: string | null;
  provider: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: WebhookEventStatus;
  error_message: string | null;
  processed_at: string | null;
  created_at: string;
  test_runs?: { name: string } | null;
}

const STATUS_CONFIG: Record<
  WebhookEventStatus,
  { color: string; label: string }
> = {
  pending: { color: palette.warning.main, label: 'Pending' },
  processing: { color: palette.warning.main, label: 'Processing' },
  success: { color: palette.success.main, label: 'Success' },
  failed: { color: palette.error.main, label: 'Failed' },
};

interface WebhookEventLogProps {
  events: WebhookEvent[];
  loading: boolean;
}

function EventRow({ event }: { event: WebhookEvent }) {
  const [open, setOpen] = useState(false);
  const config = STATUS_CONFIG[event.status];
  const isSpinning = event.status === 'pending' || event.status === 'processing';

  return (
    <>
      <TableRow
        sx={{
          cursor: 'pointer',
          '&:hover': { bgcolor: alpha(palette.primary.main, 0.04) },
        }}
        onClick={() => setOpen(!open)}
      >
        <TableCell sx={{ width: 40, p: 0.5 }}>
          <IconButton size="small">
            {open ? (
              <KeyboardArrowUpIcon fontSize="small" />
            ) : (
              <KeyboardArrowDownIcon fontSize="small" />
            )}
          </IconButton>
        </TableCell>
        <TableCell>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {new Date(event.created_at).toLocaleString()}
          </Typography>
        </TableCell>
        <TableCell>
          <Chip
            label={event.event_type.replace(/_/g, ' ')}
            size="small"
            variant="outlined"
            sx={{ height: 22, fontSize: '0.65rem' }}
          />
        </TableCell>
        <TableCell>
          {event.test_runs?.name && (
            <Typography variant="caption">{event.test_runs.name}</Typography>
          )}
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isSpinning ? (
              <CircularProgress size={10} sx={{ color: config.color }} />
            ) : (
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor: config.color,
                  flexShrink: 0,
                }}
              />
            )}
            <Typography
              variant="caption"
              sx={{ color: config.color, fontWeight: 600 }}
            >
              {config.label}
            </Typography>
          </Box>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={5} sx={{ py: 0, border: open ? undefined : 'none' }}>
          <Collapse in={open}>
            <Box sx={{ p: 2 }}>
              {event.error_message && (
                <Box
                  sx={{
                    p: 1.5,
                    mb: 2,
                    borderRadius: 1,
                    bgcolor: alpha(palette.error.main, 0.08),
                    border: `1px solid ${alpha(palette.error.main, 0.2)}`,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ color: palette.error.main, fontWeight: 600 }}
                  >
                    Error: {event.error_message}
                  </Typography>
                </Box>
              )}
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', mb: 1, display: 'block' }}
              >
                Payload:
              </Typography>
              <Box
                component="pre"
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: palette.background.surface2,
                  border: `1px solid ${palette.divider}`,
                  fontSize: '0.7rem',
                  color: 'text.secondary',
                  overflow: 'auto',
                  maxHeight: 200,
                  m: 0,
                }}
              >
                {JSON.stringify(event.payload, null, 2)}
              </Box>
              {event.processed_at && (
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', mt: 1, display: 'block' }}
                >
                  Processed at: {new Date(event.processed_at).toLocaleString()}
                </Typography>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function WebhookEventLog({
  events,
  loading,
}: WebhookEventLogProps) {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (events.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          No webhook events yet. Events will appear here when the Playwright
          webhook receives requests.
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
      }}
    >
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 40 }} />
            <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
              Timestamp
            </TableCell>
            <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
              Event Type
            </TableCell>
            <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
              Test Run
            </TableCell>
            <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
              Status
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
