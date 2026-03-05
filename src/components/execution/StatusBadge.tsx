'use client';

import Chip from '@mui/material/Chip';
import { alpha } from '@mui/material/styles';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import BlockIcon from '@mui/icons-material/Block';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { semanticColors } from '@/theme/palette';
import type { ExecutionStatus } from '@/types/database';

const STATUS_CONFIG: Record<ExecutionStatus, { label: string; icon: React.ReactElement }> = {
  pass: { label: 'Pass', icon: <CheckCircleOutlineIcon sx={{ fontSize: 14 }} /> },
  fail: { label: 'Fail', icon: <CancelOutlinedIcon sx={{ fontSize: 14 }} /> },
  blocked: { label: 'Blocked', icon: <BlockIcon sx={{ fontSize: 14 }} /> },
  skip: { label: 'Skip', icon: <SkipNextIcon sx={{ fontSize: 14 }} /> },
  not_run: { label: 'Not Run', icon: <RemoveCircleOutlineIcon sx={{ fontSize: 14 }} /> },
};

interface StatusBadgeProps {
  status: ExecutionStatus;
  size?: 'small' | 'medium';
}

export default function StatusBadge({ status, size = 'small' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const color = semanticColors.executionStatus[status];

  return (
    <Chip
      label={config.label}
      icon={config.icon}
      size={size}
      sx={{
        height: size === 'small' ? 22 : 28,
        fontSize: size === 'small' ? '0.65rem' : '0.75rem',
        fontWeight: 600,
        bgcolor: alpha(color, 0.15),
        color,
        '& .MuiChip-icon': { color },
      }}
    />
  );
}
