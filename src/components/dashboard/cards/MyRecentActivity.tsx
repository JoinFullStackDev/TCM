'use client';

import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import { alpha } from '@mui/material/styles';
import HistoryIcon from '@mui/icons-material/History';
import DashboardCard from '../DashboardCard';
import { palette, semanticColors } from '@/theme/palette';
import type { DashboardRecentActivity } from '@/types/database';

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function MyRecentActivity({
  data,
  index,
}: {
  data: unknown;
  index: number;
}) {
  const router = useRouter();
  const activity = (data as DashboardRecentActivity[] | null) ?? [];

  return (
    <DashboardCard
      title="My Recent Activity"
      icon={<HistoryIcon fontSize="small" />}
      loading={data === null}
      isEmpty={activity.length === 0}
      emptyMessage="No recent executions"
      index={index}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {activity.map((item) => {
          const statusColor =
            semanticColors.executionStatus[item.status as keyof typeof semanticColors.executionStatus] ??
            palette.neutral.main;

          return (
            <Box
              key={item.id}
              onClick={() => router.push(`/runs/${item.test_run_id}`)}
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
                label={item.status}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.55rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  bgcolor: alpha(statusColor, 0.15),
                  color: statusColor,
                  '& .MuiChip-label': { px: 0.5 },
                  minWidth: 44,
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  color: 'text.secondary',
                  minWidth: 48,
                }}
              >
                {item.display_id}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: 'text.primary',
                }}
              >
                {item.test_case_title}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: 'text.disabled', fontSize: '0.6rem', flexShrink: 0 }}
              >
                {timeAgo(item.executed_at)}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </DashboardCard>
  );
}
