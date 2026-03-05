'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { alpha } from '@mui/material/styles';
import { palette } from '@/theme/palette';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  showAction?: boolean;
}

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  showAction = true,
}: EmptyStateProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
        px: 3,
        textAlign: 'center',
      }}
    >
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: '16px',
          bgcolor: alpha(palette.primary.main, 0.1),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 3,
          color: palette.primary.main,
        }}
      >
        {icon}
      </Box>
      <Typography variant="h6" sx={{ mb: 1 }}>
        {title}
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: 'text.secondary', mb: 3, maxWidth: 360 }}
      >
        {description}
      </Typography>
      {showAction && actionLabel && onAction && (
        <Button variant="contained" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}
