'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { alpha } from '@mui/material/styles';
import { palette } from '@/theme/palette';

interface ImportCompleteStepProps {
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  projectId: string;
  onViewTestCases: () => void;
  errors: Array<{ row_number: number | null; error_message: string }>;
}

export default function ImportCompleteStep({
  importedCount,
  skippedCount,
  errorCount,
  onViewTestCases,
  errors,
}: ImportCompleteStepProps) {
  const hasErrors = errorCount > 0;

  return (
    <Box sx={{ textAlign: 'center', py: 4 }}>
      {hasErrors ? (
        <WarningAmberIcon sx={{ fontSize: 56, color: palette.warning.main, mb: 2 }} />
      ) : (
        <CheckCircleOutlineIcon sx={{ fontSize: 56, color: palette.success.main, mb: 2 }} />
      )}

      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        {hasErrors ? 'Import Completed with Warnings' : 'Import Successful'}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        {importedCount} test cases imported successfully
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 4 }}>
        <Chip
          icon={<CheckCircleOutlineIcon sx={{ fontSize: 16 }} />}
          label={`${importedCount} imported`}
          sx={{
            bgcolor: alpha(palette.success.main, 0.15),
            color: palette.success.main,
          }}
        />
        {skippedCount > 0 && (
          <Chip
            label={`${skippedCount} skipped`}
            sx={{
              bgcolor: alpha(palette.neutral.main, 0.15),
              color: palette.neutral.main,
            }}
          />
        )}
        {errorCount > 0 && (
          <Chip
            icon={<ErrorOutlineIcon sx={{ fontSize: 16 }} />}
            label={`${errorCount} errors`}
            sx={{
              bgcolor: alpha(palette.error.main, 0.15),
              color: palette.error.main,
            }}
          />
        )}
      </Box>

      {errors.length > 0 && (
        <Box
          sx={{
            textAlign: 'left',
            maxWidth: 600,
            mx: 'auto',
            mb: 4,
            p: 2,
            borderRadius: 1,
            border: `1px solid ${alpha(palette.error.main, 0.3)}`,
            bgcolor: alpha(palette.error.main, 0.05),
            maxHeight: 200,
            overflow: 'auto',
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
            Error Details
          </Typography>
          {errors.slice(0, 20).map((err, i) => (
            <Typography key={i} variant="caption" sx={{ display: 'block', mb: 0.5 }}>
              {err.row_number ? `Row ${err.row_number}: ` : ''}
              {err.error_message}
            </Typography>
          ))}
          {errors.length > 20 && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              ...and {errors.length - 20} more errors
            </Typography>
          )}
        </Box>
      )}

      <Button
        variant="contained"
        endIcon={<ArrowForwardIcon />}
        onClick={onViewTestCases}
        size="large"
      >
        View Imported Test Cases
      </Button>
    </Box>
  );
}
