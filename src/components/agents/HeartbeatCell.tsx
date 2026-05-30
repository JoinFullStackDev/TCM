'use client';

import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { AgentRunStatus } from '@/types/agent-run';

const TERMINAL_STATUSES = new Set(['done', 'failed', 'timed_out', 'killed']);
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

function formatRelative(ts: string): string {
  const ago = Date.now() - new Date(ts).getTime();
  const seconds = Math.floor(ago / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

interface Props {
  lastHeartbeat: string | null;
  status: AgentRunStatus;
}

export default function HeartbeatCell({ lastHeartbeat, status }: Props) {
  if (!lastHeartbeat) {
    return <Typography variant="body2" color="text.disabled">—</Typography>;
  }

  const isActive = !TERMINAL_STATUSES.has(status);
  const ageMs = Date.now() - new Date(lastHeartbeat).getTime();
  const isStale = isActive && ageMs > STALE_THRESHOLD_MS;

  return (
    <Tooltip title={new Date(lastHeartbeat).toLocaleString()}>
      <Typography
        variant="body2"
        sx={{
          color: isStale ? 'error.main' : 'text.secondary',
          fontWeight: isStale ? 600 : 400,
        }}
      >
        {formatRelative(lastHeartbeat)}
        {isStale ? ' ⚠' : ''}
      </Typography>
    </Tooltip>
  );
}
