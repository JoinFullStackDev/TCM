'use client';

import { useState, useEffect } from 'react';
import Typography from '@mui/material/Typography';

function formatElapsed(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

interface Props {
  startedAt: string;
  endedAt: string | null;
  isActive: boolean;
}

export default function ElapsedTime({ startedAt, endedAt, isActive }: Props) {
  const [elapsed, setElapsed] = useState(() => {
    const end = endedAt ? new Date(endedAt).getTime() : Date.now();
    return end - new Date(startedAt).getTime();
  });

  useEffect(() => {
    if (!isActive || endedAt) return;

    const interval = setInterval(() => {
      setElapsed(Date.now() - new Date(startedAt).getTime());
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt, endedAt, isActive]);

  return (
    <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', color: 'text.secondary' }}>
      {formatElapsed(elapsed)}
    </Typography>
  );
}
