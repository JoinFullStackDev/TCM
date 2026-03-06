'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import DashboardCard from '../DashboardCard';
import { palette } from '@/theme/palette';
import type { DashboardPassRateSummary } from '@/types/database';

function getPassRateColor(rate: number): string {
  if (rate >= 80) return palette.success.main;
  if (rate >= 50) return palette.warning.main;
  return palette.error.main;
}

export default function PassRateSummary({
  data,
  index,
}: {
  data: unknown;
  index: number;
}) {
  const summary = data as DashboardPassRateSummary | null;

  return (
    <DashboardCard
      title="Pass Rate (30d)"
      icon={<CheckCircleOutlinedIcon fontSize="small" />}
      loading={data === null}
      isEmpty={!summary || summary.total_cases === 0}
      emptyMessage="No completed runs in the last 30 days"
      index={index}
    >
      {summary && summary.total_cases > 0 && (
        <Box sx={{ textAlign: 'center', py: 1 }}>
          <Box
            sx={{
              width: 100,
              height: 100,
              borderRadius: '50%',
              border: `4px solid ${getPassRateColor(summary.pass_rate)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 1.5,
              bgcolor: alpha(getPassRateColor(summary.pass_rate), 0.06),
            }}
          >
            <Typography
              variant="h4"
              sx={{ fontWeight: 700, color: getPassRateColor(summary.pass_rate) }}
            >
              {summary.pass_rate}%
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            {summary.passed} passed &middot; {summary.failed} failed of {summary.total_cases} cases
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.6rem' }}>
            across {summary.completed_runs} completed run{summary.completed_runs !== 1 ? 's' : ''}
          </Typography>
        </Box>
      )}
    </DashboardCard>
  );
}
