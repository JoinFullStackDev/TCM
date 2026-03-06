'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import DonutSmallOutlinedIcon from '@mui/icons-material/DonutSmallOutlined';
import DashboardCard from '../DashboardCard';
import { palette } from '@/theme/palette';
import type { DashboardRunOverview } from '@/types/database';

const STATUS_CONFIG: Array<{ key: keyof DashboardRunOverview; label: string; color: string }> = [
  { key: 'planned', label: 'Planned', color: palette.neutral.main },
  { key: 'in_progress', label: 'In Progress', color: palette.primary.main },
  { key: 'completed', label: 'Completed', color: palette.success.main },
  { key: 'aborted', label: 'Aborted', color: palette.error.main },
];

export default function RunOverview({
  data,
  index,
}: {
  data: unknown;
  index: number;
}) {
  const overview = data as DashboardRunOverview | null;
  const total = overview
    ? overview.planned + overview.in_progress + overview.completed + overview.aborted
    : 0;

  const chartData = overview
    ? STATUS_CONFIG.map((s) => ({ name: s.label, value: overview[s.key], color: s.color })).filter(
        (d) => d.value > 0,
      )
    : [];

  return (
    <DashboardCard
      title="Test Run Overview"
      icon={<DonutSmallOutlinedIcon fontSize="small" />}
      loading={data === null}
      isEmpty={total === 0}
      emptyMessage="No test runs yet"
      index={index}
    >
      {chartData.length > 0 && (
        <Box>
          <Box sx={{ position: 'relative', width: '100%', height: 180 }}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  dataKey="value"
                  stroke="none"
                  animationBegin={0}
                  animationDuration={400}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: palette.background.surface3,
                    border: `1px solid ${palette.divider}`,
                    borderRadius: 8,
                    color: palette.text.primary,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
              }}
            >
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {total}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem' }}>
                Total Runs
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5, mt: 1, flexWrap: 'wrap' }}>
            {chartData.map((entry) => (
              <Box key={entry.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: entry.color,
                  }}
                />
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem' }}>
                  {entry.name}: {entry.value}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </DashboardCard>
  );
}
