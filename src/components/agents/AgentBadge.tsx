'use client';

import Chip from '@mui/material/Chip';
import type { AgentName } from '@/types/agent-run';

const AGENT_COLORS: Record<AgentName, string> = {
  axel: '#1565C0',
  riff: '#6A1B9A',
  arc: '#00695C',
  torque: '#E65100',
  clutch: '#37474F',
};

interface Props {
  agent: AgentName;
  size?: 'small' | 'medium';
}

export default function AgentBadge({ agent, size = 'small' }: Props) {
  const color = AGENT_COLORS[agent] ?? '#607D8B';
  const label = agent.charAt(0).toUpperCase() + agent.slice(1);
  return (
    <Chip
      label={label}
      size={size}
      sx={{
        bgcolor: color,
        color: '#fff',
        fontWeight: 700,
        fontSize: '0.72rem',
        letterSpacing: '0.04em',
      }}
    />
  );
}
