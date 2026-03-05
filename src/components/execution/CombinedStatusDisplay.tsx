'use client';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import { alpha } from '@mui/material/styles';
import { semanticColors } from '@/theme/palette';
import type { Platform, ExecutionStatus } from '@/types/database';

const PLATFORM_LABELS: Record<Platform, string> = {
  desktop: 'Desktop',
  tablet: 'Tablet',
  mobile: 'Mobile',
};

const STATUS_ICONS: Record<ExecutionStatus, string> = {
  pass: '✓',
  fail: '✗',
  blocked: '⊘',
  skip: '⏭',
  not_run: '—',
};

interface CombinedStatusDisplayProps {
  platformStatus: Record<string, string>;
}

export default function CombinedStatusDisplay({ platformStatus }: CombinedStatusDisplayProps) {
  const entries = Object.entries(platformStatus);
  if (entries.length === 0) return null;

  const allPass = entries.every(([, s]) => s === 'pass');
  if (allPass) {
    return (
      <Chip
        label="All Pass"
        size="small"
        sx={{
          height: 20,
          fontSize: '0.6rem',
          fontWeight: 600,
          bgcolor: alpha(semanticColors.executionStatus.pass, 0.15),
          color: semanticColors.executionStatus.pass,
        }}
      />
    );
  }

  return (
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
      {entries.map(([platform, status]) => {
        const platColor = semanticColors.platform[platform as Platform] ?? semanticColors.platform.desktop;
        const statusColor = semanticColors.executionStatus[status as ExecutionStatus] ?? semanticColors.executionStatus.not_run;
        const icon = STATUS_ICONS[status as ExecutionStatus] ?? '—';

        return (
          <Chip
            key={platform}
            label={`${icon} ${PLATFORM_LABELS[platform as Platform] ?? platform}`}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.55rem',
              fontWeight: 600,
              bgcolor: alpha(platColor, 0.08),
              color: statusColor,
              borderLeft: `2px solid ${platColor}`,
              borderRadius: '4px',
            }}
          />
        );
      })}
    </Box>
  );
}
