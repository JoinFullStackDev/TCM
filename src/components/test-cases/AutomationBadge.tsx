'use client';

import Chip from '@mui/material/Chip';
import { alpha } from '@mui/material/styles';
import { semanticColors } from '@/theme/palette';
import type { AutomationStatus } from '@/types/database';

const LABELS: Record<AutomationStatus, string> = {
  in_cicd: 'IN CICD',
  scripted: 'SCRIPTED',
  out_of_sync: 'OUT OF SYNC',
  not_automated: 'Not Automated',
};

interface AutomationBadgeProps {
  status: AutomationStatus;
  size?: 'small' | 'medium';
}

export default function AutomationBadge({ status, size = 'small' }: AutomationBadgeProps) {
  const color = semanticColors.automationStatus[status];

  return (
    <Chip
      label={LABELS[status]}
      size={size}
      sx={{
        height: size === 'small' ? 22 : 26,
        fontSize: size === 'small' ? '0.65rem' : '0.75rem',
        fontWeight: 600,
        bgcolor: alpha(color, 0.15),
        color,
        '& .MuiChip-label': { px: 1 },
      }}
    />
  );
}
