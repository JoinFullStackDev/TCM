'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import { alpha } from '@mui/material/styles';
import { motion } from 'framer-motion';
import { palette } from '@/theme/palette';

interface DashboardCardProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  loading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  index?: number;
  span?: number;
  children: React.ReactNode;
}

export default function DashboardCard({
  title,
  subtitle,
  icon,
  action,
  loading,
  isEmpty,
  emptyMessage = 'No data available',
  index = 0,
  span,
  children,
}: DashboardCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      style={span ? { gridColumn: `span ${span}` } : undefined}
    >
      <Box
        sx={{
          p: 2.5,
          borderRadius: 2,
          bgcolor: 'background.paper',
          border: `1px solid ${palette.divider}`,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mb: 2,
          }}
        >
          {icon && (
            <Box
              sx={{
                color: palette.primary.main,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {icon}
            </Box>
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 600, lineHeight: 1.3 }}
            >
              {title}
            </Typography>
            {subtitle && (
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', lineHeight: 1.2 }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
          {action}
        </Box>

        <Box sx={{ flex: 1, minHeight: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Skeleton variant="rounded" height={20} />
              <Skeleton variant="rounded" height={20} width="80%" />
              <Skeleton variant="rounded" height={20} width="60%" />
            </Box>
          ) : isEmpty ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                py: 3,
                color: 'text.disabled',
              }}
            >
              <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                {emptyMessage}
              </Typography>
            </Box>
          ) : (
            children
          )}
        </Box>
      </Box>
    </motion.div>
  );
}

export function DashboardKpi({
  label,
  value,
  color = palette.primary.main,
  suffix,
}: {
  label: string;
  value: number;
  color?: string;
  suffix?: string;
}) {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 1.5,
        bgcolor: alpha(color, 0.06),
        borderLeft: `3px solid ${color}`,
      }}
    >
      <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
        {value}
        {suffix ?? ''}
      </Typography>
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', fontWeight: 500 }}
      >
        {label}
      </Typography>
    </Box>
  );
}
