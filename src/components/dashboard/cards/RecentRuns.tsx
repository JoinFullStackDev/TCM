'use client';

import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import { alpha } from '@mui/material/styles';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import DashboardCard from '../DashboardCard';
import { palette } from '@/theme/palette';
import type { DashboardRecentRun } from '@/types/database';

const STATUS_COLORS: Record<string, string> = {
  planned: palette.neutral.main,
  in_progress: palette.primary.main,
  completed: palette.success.main,
  aborted: palette.error.main,
};

export default function RecentRuns({
  data,
  index,
}: {
  data: unknown;
  index: number;
}) {
  const router = useRouter();
  const runs = (data as DashboardRecentRun[] | null) ?? [];

  return (
    <DashboardCard
      title="Recent Runs"
      icon={<PlayArrowOutlinedIcon fontSize="small" />}
      loading={data === null}
      isEmpty={runs.length === 0}
      emptyMessage="No runs yet"
      index={index}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {runs.map((run) => {
          const statusColor = STATUS_COLORS[run.status] ?? palette.neutral.main;
          return (
            <Box
              key={run.id}
              onClick={() => router.push(`/runs/${run.id}`)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                py: 0.75,
                px: 1,
                borderRadius: 1,
                cursor: 'pointer',
                transition: 'background-color 0.15s',
                '&:hover': { bgcolor: palette.background.surface2 },
              }}
            >
              <Chip
                label={run.status.replace('_', ' ')}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.55rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  bgcolor: alpha(statusColor, 0.15),
                  color: statusColor,
                  '& .MuiChip-label': { px: 0.5 },
                  minWidth: 64,
                }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {run.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem' }}>
                  {run.project_name}
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.6rem', flexShrink: 0 }}>
                {new Date(run.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </DashboardCard>
  );
}
