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
import { palette, semanticColors } from '@/theme/palette';

interface StatusDonutChartProps {
  data: {
    pass: number;
    fail: number;
    blocked: number;
    skip: number;
    not_run: number;
  };
  passRate: number;
}

const STATUS_COLORS: Record<string, string> = {
  Pass: semanticColors.executionStatus.pass,
  Fail: semanticColors.executionStatus.fail,
  Blocked: semanticColors.executionStatus.blocked,
  Skip: semanticColors.executionStatus.skip,
  'Not Run': semanticColors.executionStatus.not_run,
};

export default function StatusDonutChart({
  data,
  passRate,
}: StatusDonutChartProps) {
  const chartData = [
    { name: 'Pass', value: data.pass },
    { name: 'Fail', value: data.fail },
    { name: 'Blocked', value: data.blocked },
    { name: 'Skip', value: data.skip },
    { name: 'Not Run', value: data.not_run },
  ].filter((d) => d.value > 0);

  if (chartData.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          No execution data available
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: 3,
        borderRadius: 2,
        bgcolor: 'background.paper',
        border: `1px solid ${palette.divider}`,
        mb: 4,
      }}
    >
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        Status Distribution
      </Typography>
      <Box sx={{ position: 'relative', width: '100%', height: 300 }}>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={80}
              outerRadius={120}
              dataKey="value"
              stroke="none"
              animationBegin={0}
              animationDuration={400}
            >
              {chartData.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={STATUS_COLORS[entry.name] ?? palette.neutral.main}
                />
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
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
            {passRate}%
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Pass Rate
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 1, flexWrap: 'wrap' }}
      >
        {chartData.map((entry) => (
          <Box key={entry.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: STATUS_COLORS[entry.name],
              }}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {entry.name}: {entry.value}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
