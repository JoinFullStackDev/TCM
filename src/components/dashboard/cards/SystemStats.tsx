'use client';

import Box from '@mui/material/Box';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import DashboardCard, { DashboardKpi } from '../DashboardCard';
import { palette } from '@/theme/palette';
import type { DashboardSystemStats } from '@/types/database';

const STAT_CONFIG: Array<{ key: keyof DashboardSystemStats; label: string; color: string }> = [
  { key: 'users', label: 'Users', color: palette.primary.main },
  { key: 'projects', label: 'Active Projects', color: palette.success.main },
  { key: 'suites', label: 'Suites', color: palette.info.main },
  { key: 'test_cases', label: 'Test Cases', color: palette.warning.main },
  { key: 'test_runs', label: 'Test Runs', color: palette.primary.light },
  { key: 'executions', label: 'Executions', color: palette.success.light },
];

export default function SystemStats({
  data,
  index,
}: {
  data: unknown;
  index: number;
}) {
  const stats = data as DashboardSystemStats | null;

  return (
    <DashboardCard
      title="System Stats"
      icon={<StorageOutlinedIcon fontSize="small" />}
      loading={data === null}
      isEmpty={!stats}
      index={index}
      span={2}
    >
      {stats && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 1.5,
          }}
        >
          {STAT_CONFIG.map((s) => (
            <DashboardKpi
              key={s.key}
              label={s.label}
              value={stats[s.key]}
              color={s.color}
            />
          ))}
        </Box>
      )}
    </DashboardCard>
  );
}
