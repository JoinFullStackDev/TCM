'use client';

import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LinkOffIcon from '@mui/icons-material/LinkOff';

export default function GoogleConnectStatus() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetch('/api/auth/google/status')
      .then((r) => r.json())
      .then((d: { connected: boolean }) => setConnected(d.connected))
      .catch(() => setConnected(false));
  }, []);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch('/api/auth/google/disconnect', { method: 'DELETE' });
      setConnected(false);
    } finally {
      setDisconnecting(false);
    }
  };

  const handleConnect = () => {
    window.location.href = '/api/auth/google/connect';
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography fontSize="0.875rem" color="text.secondary">
          Google Account:
        </Typography>
        {connected === null ? (
          <CircularProgress size={16} />
        ) : connected ? (
          <Chip
            icon={<CheckCircleOutlineIcon fontSize="small" />}
            label="Connected"
            size="small"
            color="success"
            variant="outlined"
          />
        ) : (
          <Chip label="Not connected" size="small" variant="outlined" />
        )}
      </Box>

      {connected === true && (
        <Button
          size="small"
          variant="outlined"
          color="error"
          startIcon={disconnecting ? <CircularProgress size={14} /> : <LinkOffIcon fontSize="small" />}
          onClick={handleDisconnect}
          disabled={disconnecting}
          sx={{ textTransform: 'none' }}
        >
          Disconnect
        </Button>
      )}

      {connected === false && (
        <Button
          size="small"
          variant="outlined"
          onClick={handleConnect}
          sx={{ textTransform: 'none' }}
        >
          Connect Google Account
        </Button>
      )}
    </Box>
  );
}
