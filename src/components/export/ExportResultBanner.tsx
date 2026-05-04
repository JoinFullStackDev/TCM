'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

interface ExportResultBannerProps {
  errorMessage?: string;
  onRetry?: () => void;
}

export default function ExportResultBanner({
  errorMessage,
  onRetry,
}: ExportResultBannerProps) {
  if (errorMessage) {
    return (
      <Box sx={{ py: 1 }}>
        <Alert severity="error" sx={{ fontSize: '0.875rem' }}>
          {errorMessage}
        </Alert>
        {onRetry && (
          <Button
            onClick={onRetry}
            size="small"
            sx={{ mt: 1, textTransform: 'none' }}
          >
            Retry
          </Button>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
      <CheckCircleOutlineIcon color="success" fontSize="small" />
      <Typography fontSize="0.875rem" fontWeight={500} color="success.main">
        Export ready — your download has started.
      </Typography>
    </Box>
  );
}
