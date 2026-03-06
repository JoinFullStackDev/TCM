'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import { alpha } from '@mui/material/styles';
import DevicesOutlinedIcon from '@mui/icons-material/DevicesOutlined';
import DashboardCard from '../DashboardCard';
import { palette, semanticColors } from '@/theme/palette';
import type { DashboardPlatformCoverage } from '@/types/database';

const PLATFORM_COLORS: Record<string, string> = {
  desktop: semanticColors.platform.desktop,
  tablet: semanticColors.platform.tablet,
  mobile: semanticColors.platform.mobile,
};

export default function PlatformCoverage({
  data,
  index,
}: {
  data: unknown;
  index: number;
}) {
  const platforms = (data as DashboardPlatformCoverage[] | null) ?? [];

  return (
    <DashboardCard
      title="Platform Coverage"
      icon={<DevicesOutlinedIcon fontSize="small" />}
      loading={data === null}
      isEmpty={platforms.length === 0}
      emptyMessage="No execution data yet"
      index={index}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {platforms.map((p) => {
          const color = PLATFORM_COLORS[p.platform] ?? palette.neutral.main;
          return (
            <Box key={p.platform}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
                  {p.platform}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {p.pass_rate}% pass &middot; {p.total} executions
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={p.pass_rate}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: alpha(color, 0.12),
                  '& .MuiLinearProgress-bar': {
                    bgcolor: color,
                    borderRadius: 3,
                  },
                }}
              />
            </Box>
          );
        })}
      </Box>
    </DashboardCard>
  );
}
