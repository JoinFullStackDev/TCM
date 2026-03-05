'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { motion } from 'framer-motion';
import { alpha } from '@mui/material/styles';
import { palette } from '@/theme/palette';

interface KpiCardsProps {
  totalCases: number;
  pass: number;
  fail: number;
  blocked: number;
  passRate: number;
}

const cards: Array<{ key: keyof KpiCardsProps; label: string; color: string; suffix?: string }> = [
  { key: 'totalCases', label: 'Total Cases', color: palette.primary.main },
  { key: 'pass', label: 'Passed', color: palette.success.main },
  { key: 'fail', label: 'Failed', color: palette.error.main },
  { key: 'blocked', label: 'Blocked', color: palette.warning.main },
  { key: 'passRate', label: 'Pass Rate', color: palette.success.main, suffix: '%' },
];

function getPassRateColor(rate: number): string {
  if (rate >= 80) return palette.success.main;
  if (rate >= 50) return palette.warning.main;
  return palette.error.main;
}

export default function KpiCards(props: KpiCardsProps) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 2,
        mb: 4,
      }}
    >
      {cards.map((card, i) => {
        const value = props[card.key];
        const borderColor =
          card.key === 'passRate' ? getPassRateColor(value) : card.color;

        return (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
          >
            <Box
              sx={{
                p: 2.5,
                borderRadius: 2,
                bgcolor: 'background.paper',
                border: `1px solid ${palette.divider}`,
                borderLeft: `4px solid ${borderColor}`,
              }}
            >
              <Typography
                variant="h4"
                sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5 }}
              >
                {value}
                {card.suffix ?? ''}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', fontWeight: 500 }}
              >
                {card.label}
              </Typography>
            </Box>
          </motion.div>
        );
      })}
    </Box>
  );
}
