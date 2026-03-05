'use client';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import { alpha } from '@mui/material/styles';
import { semanticColors } from '@/theme/palette';
import type { Platform } from '@/types/database';

const LABELS: Record<Platform, string> = {
  desktop: 'Desktop',
  tablet: 'Tablet',
  mobile: 'Mobile',
};

interface PlatformChipsProps {
  platforms: Platform[];
  size?: 'small' | 'medium';
}

export default function PlatformChips({ platforms, size = 'small' }: PlatformChipsProps) {
  if (platforms.length === 0) return null;

  return (
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
      {platforms.map((platform) => {
        const color = semanticColors.platform[platform];
        return (
          <Chip
            key={platform}
            label={LABELS[platform]}
            size={size}
            sx={{
              height: size === 'small' ? 20 : 24,
              fontSize: size === 'small' ? '0.6rem' : '0.7rem',
              fontWeight: 600,
              bgcolor: alpha(color, 0.12),
              color,
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        );
      })}
    </Box>
  );
}
