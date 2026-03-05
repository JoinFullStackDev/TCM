'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { alpha } from '@mui/material/styles';
import { palette } from '@/theme/palette';

interface ImportProgressStepProps {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  totalCount: number;
}

export default function ImportProgressStep({
  status,
  importedCount,
  skippedCount,
  errorCount,
  totalCount,
}: ImportProgressStepProps) {
  const processed = importedCount + skippedCount + errorCount;
  const progress = totalCount > 0 ? (processed / totalCount) * 100 : 0;

  return (
    <Box sx={{ textAlign: 'center', py: 4 }}>
      {status === 'processing' && (
        <>
          <CircularProgress size={48} sx={{ mb: 2, color: palette.primary.main }} />
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
            Importing...
          </Typography>
        </>
      )}

      {status === 'completed' && (
        <>
          <CheckCircleOutlineIcon
            sx={{ fontSize: 48, color: palette.success.main, mb: 2 }}
          />
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
            Import Complete
          </Typography>
        </>
      )}

      {status === 'failed' && (
        <>
          <ErrorOutlineIcon
            sx={{ fontSize: 48, color: palette.error.main, mb: 2 }}
          />
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
            Import Failed
          </Typography>
        </>
      )}

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        {processed} of {totalCount} test cases processed
      </Typography>

      <Box sx={{ px: 8, mb: 4 }}>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 8,
            borderRadius: 4,
            bgcolor: alpha(palette.neutral.main, 0.15),
            '& .MuiLinearProgress-bar': {
              borderRadius: 4,
              background:
                status === 'failed'
                  ? palette.error.main
                  : `linear-gradient(90deg, ${palette.primary.main}, ${palette.success.main})`,
            },
          }}
        />
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: palette.success.main }}>
            {importedCount}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Imported
          </Typography>
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: palette.neutral.main }}>
            {skippedCount}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Skipped
          </Typography>
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: palette.error.main }}>
            {errorCount}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Errors
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
