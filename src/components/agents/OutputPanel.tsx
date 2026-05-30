'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import Typography from '@mui/material/Typography';

interface Props {
  outputTail: string | null;
  outputTruncated: boolean;
}

export default function OutputPanel({ outputTail, outputTruncated }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!outputTail) {
    return (
      <Typography variant="body2" color="text.disabled" sx={{ pl: 1 }}>
        No output yet
      </Typography>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(outputTail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <Box>
      <Button
        size="small"
        startIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        onClick={() => setExpanded((v) => !v)}
        sx={{ mb: 0.5, textTransform: 'none', fontSize: '0.75rem' }}
      >
        {expanded ? 'Collapse output' : 'Expand output'}
      </Button>

      <Collapse in={expanded}>
        <Box sx={{ position: 'relative' }}>
          {outputTruncated && (
            <Alert severity="warning" sx={{ mb: 1, py: 0.5, fontSize: '0.75rem' }}>
              Output was truncated — only the most recent content is shown.
            </Alert>
          )}

          <Box
            sx={{
              position: 'relative',
              bgcolor: '#1a1a2e',
              borderRadius: 1,
              p: 1.5,
              maxHeight: 320,
              overflow: 'auto',
            }}
          >
            <Tooltip title={copied ? 'Copied!' : 'Copy output'}>
              <IconButton
                size="small"
                onClick={handleCopy}
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  color: '#aaa',
                  '&:hover': { color: '#fff' },
                }}
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <pre
              style={{
                margin: 0,
                fontFamily: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
                fontSize: '0.72rem',
                lineHeight: 1.6,
                color: '#e0e0e0',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {outputTail}
            </pre>
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
}
