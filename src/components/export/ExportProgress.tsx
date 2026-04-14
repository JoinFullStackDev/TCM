'use client';

import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';

interface ExportProgressProps {
  format: 'xlsx' | 'google_sheets';
}

export default function ExportProgress({ format }: ExportProgressProps) {
  const [slowMessage, setSlowMessage] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlowMessage(true), 30_000);
    return () => clearTimeout(timer);
  }, []);

  const label = format === 'xlsx' ? 'Excel file' : 'Google Sheet';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 2 }}>
      <CircularProgress size={40} />
      <Typography fontSize="0.875rem" color="text.secondary">
        Generating your {label}…
      </Typography>
      {slowMessage && (
        <Typography fontSize="0.8rem" color="text.secondary" textAlign="center">
          This export is taking longer than expected. We'll notify you when it's ready — you can
          continue using TestForge.
        </Typography>
      )}
    </Box>
  );
}
