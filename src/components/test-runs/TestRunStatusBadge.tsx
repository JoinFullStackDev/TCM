'use client';

import Chip from '@mui/material/Chip';
import { alpha } from '@mui/material/styles';
import { palette } from '@/theme/palette';
import type { TestRunStatus } from '@/types/database';

const STATUS_CONFIG: Record<TestRunStatus, { color: string; label: string }> = {
  planned: { color: palette.neutral.main, label: 'Planned' },
  in_progress: { color: palette.primary.main, label: 'In Progress' },
  completed: { color: palette.success.main, label: 'Completed' },
  aborted: { color: palette.error.main, label: 'Aborted' },
};

interface TestRunStatusBadgeProps {
  status: TestRunStatus;
  size?: 'small' | 'medium';
}

export default function TestRunStatusBadge({ status, size = 'small' }: TestRunStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <Chip
      label={config.label}
      size={size}
      sx={{
        height: size === 'small' ? 22 : 28,
        fontSize: size === 'small' ? '0.65rem' : '0.75rem',
        fontWeight: 600,
        bgcolor: alpha(config.color, 0.15),
        color: config.color,
      }}
    />
  );
}
