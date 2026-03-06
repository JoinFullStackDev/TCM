'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import WebhookOutlinedIcon from '@mui/icons-material/WebhookOutlined';
import DashboardCard from '../DashboardCard';
import { palette } from '@/theme/palette';
import type { DashboardWebhookHealth } from '@/types/database';

const STATUS_CONFIG: Array<{ key: keyof Omit<DashboardWebhookHealth, 'total'>; label: string; color: string }> = [
  { key: 'success', label: 'Success', color: palette.success.main },
  { key: 'failed', label: 'Failed', color: palette.error.main },
  { key: 'processing', label: 'Processing', color: palette.primary.main },
  { key: 'pending', label: 'Pending', color: palette.warning.main },
];

export default function WebhookHealth({
  data,
  index,
}: {
  data: unknown;
  index: number;
}) {
  const health = data as DashboardWebhookHealth | null;

  return (
    <DashboardCard
      title="Webhook Health"
      subtitle="Last 7 days"
      icon={<WebhookOutlinedIcon fontSize="small" />}
      loading={data === null}
      isEmpty={!health || health.total === 0}
      emptyMessage="No webhook events in the last 7 days"
      index={index}
    >
      {health && health.total > 0 && (
        <Box>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            {STATUS_CONFIG.filter((s) => health[s.key] > 0).map((s) => {
              const ratio = health[s.key] / health.total;
              return (
                <Box
                  key={s.key}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: s.color,
                    flex: ratio,
                    minWidth: 4,
                  }}
                />
              );
            })}
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {STATUS_CONFIG.map((s) => (
              <Box
                key={s.key}
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: s.color,
                    }}
                  />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {s.label}
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  {health[s.key]}
                </Typography>
              </Box>
            ))}
          </Box>
          <Box
            sx={{
              mt: 1.5,
              pt: 1.5,
              borderTop: `1px solid ${palette.divider}`,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Total Events
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              {health.total}
            </Typography>
          </Box>
        </Box>
      )}
    </DashboardCard>
  );
}
