'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

interface ExportResultBannerProps {
  format: 'xlsx' | 'google_sheets';
  sheetsUrl?: string;
  errorMessage?: string;
  onRetry?: () => void;
}

export default function ExportResultBanner({
  format,
  sheetsUrl,
  errorMessage,
  onRetry,
}: ExportResultBannerProps) {
  const [copyToast, setCopyToast] = useState(false);

  const handleCopy = () => {
    if (sheetsUrl) {
      navigator.clipboard.writeText(sheetsUrl);
      setCopyToast(true);
    }
  };

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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, py: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CheckCircleOutlineIcon color="success" fontSize="small" />
        <Typography fontSize="0.875rem" fontWeight={500} color="success.main">
          {format === 'xlsx'
            ? 'Export ready — your download has started.'
            : 'Export complete.'}
        </Typography>
      </Box>

      {format === 'google_sheets' && sheetsUrl && (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            size="small"
            startIcon={<OpenInNewIcon fontSize="small" />}
            href={sheetsUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ textTransform: 'none' }}
          >
            Open in Google Sheets
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<ContentCopyIcon fontSize="small" />}
            onClick={handleCopy}
            sx={{ textTransform: 'none' }}
          >
            Copy link
          </Button>
        </Box>
      )}

      <Snackbar
        open={copyToast}
        autoHideDuration={2500}
        onClose={() => setCopyToast(false)}
        message="Link copied to clipboard"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
