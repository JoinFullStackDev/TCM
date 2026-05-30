'use client';

import Chip from '@mui/material/Chip';
import type { AgentRunStatus } from '@/types/agent-run';

const STATUS_CONFIG: Record<
  AgentRunStatus,
  { label: string; color: 'default' | 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' }
> = {
  spawned: { label: 'Spawned', color: 'secondary' },
  running: { label: 'Running', color: 'primary' },
  waiting: { label: 'Waiting', color: 'info' },
  done: { label: 'Done', color: 'success' },
  failed: { label: 'Failed', color: 'error' },
  timed_out: { label: 'Timed Out', color: 'warning' },
  killed: { label: 'Killed', color: 'default' },
};

interface Props {
  status: AgentRunStatus;
  size?: 'small' | 'medium';
}

export default function AgentStatusBadge({ status, size = 'small' }: Props) {
  const config = STATUS_CONFIG[status] ?? { label: status, color: 'default' };
  return (
    <Chip
      label={config.label}
      color={config.color}
      size={size}
      sx={{ fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.02em' }}
    />
  );
}
