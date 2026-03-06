'use client';

import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import { alpha } from '@mui/material/styles';
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay';
import DashboardCard from '../DashboardCard';
import { palette } from '@/theme/palette';
import type { DashboardMyAssignedRun } from '@/types/database';

const STATUS_COLORS: Record<string, string> = {
  planned: palette.neutral.main,
  in_progress: palette.primary.main,
};

export default function MyAssignedRuns({
  data,
  index,
}: {
  data: unknown;
  index: number;
}) {
  const router = useRouter();
  const runs = (data as DashboardMyAssignedRun[] | null) ?? [];

  return (
    <DashboardCard
      title="My Assigned Runs"
      icon={<PlaylistPlayIcon fontSize="small" />}
      loading={data === null}
      isEmpty={runs.length === 0}
      emptyMessage="No runs assigned to you"
      index={index}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {runs.map((run) => {
          const progress =
            run.total_cases > 0
              ? Math.round((run.executed_cases / run.total_cases) * 100)
              : 0;
          const statusColor = STATUS_COLORS[run.status] ?? palette.neutral.main;

          return (
            <Box
              key={run.id}
              onClick={() => router.push(`/runs/${run.id}`)}
              sx={{
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: 'background.default',
                cursor: 'pointer',
                transition: 'background-color 0.15s',
                '&:hover': { bgcolor: palette.background.surface2 },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {run.name}
                </Typography>
                <Chip
                  label={run.status.replace('_', ' ')}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.6rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    bgcolor: alpha(statusColor, 0.15),
                    color: statusColor,
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.75 }}>
                {run.project_name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  sx={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    bgcolor: alpha(palette.primary.main, 0.1),
                    '& .MuiLinearProgress-bar': {
                      bgcolor: palette.primary.main,
                      borderRadius: 2,
                    },
                  }}
                />
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem', minWidth: 30, textAlign: 'right' }}>
                  {run.executed_cases}/{run.total_cases}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
    </DashboardCard>
  );
}
