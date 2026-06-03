'use client';

import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import type { AgentRunType } from '@/types/agent-run';

interface Props {
  runType: AgentRunType;
  size?: 'small' | 'medium';
}

/**
 * Subtle visual badge shown on kanban cards and list rows for orchestrator runs.
 * Renders nothing for subagent runs (the default).
 */
export default function OrchestratorBadge({ runType, size = 'small' }: Props) {
  if (runType !== 'orchestrator') return null;

  return (
    <Tooltip title="Orchestrator run — Clutch self-registered this turn" arrow>
      <Chip
        label="Orchestrator"
        icon={<AutoAwesomeIcon sx={{ fontSize: '0.75rem !important' }} />}
        size={size}
        sx={{
          height: size === 'small' ? 18 : 22,
          fontSize: size === 'small' ? '0.6rem' : '0.7rem',
          fontWeight: 600,
          bgcolor: 'secondary.main',
          color: 'secondary.contrastText',
          letterSpacing: '0.02em',
          '& .MuiChip-icon': {
            color: 'secondary.contrastText',
            ml: 0.5,
          },
          '& .MuiChip-label': {
            px: 0.75,
          },
        }}
      />
    </Tooltip>
  );
}
