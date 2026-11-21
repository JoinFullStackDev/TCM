'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { palette } from '@/theme/palette';

export default function JsonBlock({ value, maxHeight = 360 }: { value: unknown; maxHeight?: number }) {
  const [copied, setCopied] = useState(false);
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);

  return (
    <Box sx={{ position: 'relative' }}>
      <Tooltip title={copied ? 'Copied' : 'Copy'}>
        <IconButton
          size="small"
          sx={{ position: 'absolute', top: 4, right: 4, color: 'text.secondary' }}
          onClick={() => {
            navigator.clipboard.writeText(text ?? '');
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 1.5,
          pr: 5,
          maxHeight,
          overflow: 'auto',
          bgcolor: palette.background.surface2,
          border: `1px solid ${palette.divider}`,
          borderRadius: 1,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: '0.75rem',
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {text ?? 'null'}
      </Box>
    </Box>
  );
}
