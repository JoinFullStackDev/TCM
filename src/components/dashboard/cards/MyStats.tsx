'use client';

import Box from '@mui/material/Box';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import DashboardCard, { DashboardKpi } from '../DashboardCard';
import { palette } from '@/theme/palette';
import type { DashboardMyStats } from '@/types/database';

function getPassRateColor(rate: number): string {
  if (rate >= 80) return palette.success.main;
  if (rate >= 50) return palette.warning.main;
  return palette.error.main;
}

export default function MyStats({
  data,
  index,
}: {
  data: unknown;
  index: number;
}) {
  const stats = data as DashboardMyStats | null;

  return (
    <DashboardCard
      title="My Stats"
      icon={<BarChartOutlinedIcon fontSize="small" />}
      loading={data === null}
      isEmpty={!stats}
      index={index}
    >
      {stats && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <DashboardKpi
            label="Executions This Week"
            value={stats.executions_this_week}
            color={palette.primary.main}
          />
          <DashboardKpi
            label="Executions This Month"
            value={stats.executions_this_month}
            color={palette.info.main}
          />
          <DashboardKpi
            label="Pass Rate (30d)"
            value={stats.pass_rate_30d}
            suffix="%"
            color={getPassRateColor(stats.pass_rate_30d)}
          />
        </Box>
      )}
    </DashboardCard>
  );
}
