'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { palette, semanticColors } from '@/theme/palette';

interface PlatformData {
  total: number;
  pass: number;
  fail: number;
  blocked: number;
  skip: number;
  not_run: number;
}

interface PlatformBarChartProps {
  data: Record<string, PlatformData>;
}

const PLATFORM_COLORS: Record<string, string> = {
  desktop: semanticColors.platform.desktop,
  tablet: semanticColors.platform.tablet,
  mobile: semanticColors.platform.mobile,
};

export default function PlatformBarChart({ data }: PlatformBarChartProps) {
  const chartData = Object.entries(data).map(([platform, stats]) => ({
    platform: platform.charAt(0).toUpperCase() + platform.slice(1),
    platformKey: platform,
    passRate: stats.total > 0 ? Math.round((stats.pass / stats.total) * 100) : 0,
    pass: stats.pass,
    fail: stats.fail,
    total: stats.total,
  }));

  if (chartData.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          No platform data available
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
        Platform Comparison
      </Typography>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} barSize={48}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={palette.divider}
            vertical={false}
          />
          <XAxis
            dataKey="platform"
            tick={{ fill: palette.text.secondary, fontSize: 12 }}
            axisLine={{ stroke: palette.divider }}
          />
          <YAxis
            tick={{ fill: palette.text.secondary, fontSize: 12 }}
            axisLine={{ stroke: palette.divider }}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: palette.background.surface3,
              border: `1px solid ${palette.divider}`,
              borderRadius: 8,
              color: palette.text.primary,
              fontSize: 12,
            }}
            formatter={(value) => [`${value}%`, 'Pass Rate']}
          />
          <Bar dataKey="passRate" radius={[4, 4, 0, 0]}>
            {chartData.map((entry) => (
              <Cell
                key={entry.platformKey}
                fill={PLATFORM_COLORS[entry.platformKey] ?? palette.primary.main}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
