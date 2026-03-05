'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { alpha } from '@mui/material/styles';
import { palette, semanticColors } from '@/theme/palette';
import type { ParsedTestCase } from '@/lib/validations/csv-import';

interface ReviewStepProps {
  parsedData: ParsedTestCase[];
  duplicateIds: string[];
  duplicateStrategy: 'skip' | 'update';
  onDuplicateStrategyChange: (strategy: 'skip' | 'update') => void;
  totalTestCases?: number;
  totalSteps?: number;
}

export default function ReviewStep({
  parsedData,
  duplicateIds,
  duplicateStrategy,
  onDuplicateStrategyChange,
  totalTestCases,
  totalSteps: totalStepsProp,
}: ReviewStepProps) {
  const suites = [...new Set(parsedData.map((tc) => tc.suite_name))];
  const totalSteps = totalStepsProp ?? parsedData.reduce((sum, tc) => sum + tc.steps.length, 0);
  const displayTotal = totalTestCases ?? parsedData.length;
  const preview = parsedData.slice(0, 20);

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        Review Import
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Chip
          label={`${displayTotal} test cases`}
          sx={{ bgcolor: alpha(palette.primary.main, 0.15), color: palette.primary.main }}
        />
        <Chip
          label={`${totalSteps} steps`}
          sx={{ bgcolor: alpha(palette.info.main, 0.15), color: palette.info.main }}
        />
        <Chip
          label={`${suites.length} suites`}
          sx={{ bgcolor: alpha(palette.success.main, 0.15), color: palette.success.main }}
        />
        {duplicateIds.length > 0 && (
          <Chip
            icon={<WarningAmberIcon sx={{ fontSize: 16 }} />}
            label={`${duplicateIds.length} duplicates`}
            sx={{ bgcolor: alpha(palette.warning.main, 0.15), color: palette.warning.main }}
          />
        )}
      </Box>

      {duplicateIds.length > 0 && (
        <Box
          sx={{
            p: 2,
            mb: 3,
            borderRadius: 1,
            border: `1px solid ${alpha(palette.warning.main, 0.3)}`,
            bgcolor: alpha(palette.warning.main, 0.05),
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
            Duplicate test cases detected: {duplicateIds.join(', ')}
          </Typography>
          <ToggleButtonGroup
            value={duplicateStrategy}
            exclusive
            onChange={(_, val) => {
              if (val) onDuplicateStrategyChange(val);
            }}
            size="small"
          >
            <ToggleButton value="skip" sx={{ px: 2 }}>
              Skip Duplicates
            </ToggleButton>
            <ToggleButton value="update" sx={{ px: 2 }}>
              Update Existing
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      )}

      <TableContainer
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          maxHeight: 400,
        }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>ID</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Suite</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Title</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Steps</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Automation</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Platforms</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {preview.map((tc) => {
              const isDuplicate = duplicateIds.includes(tc.display_id);
              return (
                <TableRow
                  key={tc.display_id}
                  sx={{
                    bgcolor: isDuplicate
                      ? alpha(palette.warning.main, 0.06)
                      : 'transparent',
                  }}
                >
                  <TableCell>
                    <Chip
                      label={tc.display_id}
                      size="small"
                      variant="outlined"
                      sx={{ fontFamily: 'monospace', fontSize: '0.7rem', height: 22 }}
                    />
                    {isDuplicate && (
                      <WarningAmberIcon
                        sx={{ fontSize: 14, color: palette.warning.main, ml: 0.5, verticalAlign: 'middle' }}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{tc.suite_name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ maxWidth: 300 }} noWrap>
                      {tc.title}
                    </Typography>
                  </TableCell>
                  <TableCell>{tc.steps.length}</TableCell>
                  <TableCell>
                    <Chip
                      label={tc.automation_status.replace('_', ' ').toUpperCase()}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.6rem',
                        bgcolor: alpha(
                          semanticColors.automationStatus[tc.automation_status],
                          0.15,
                        ),
                        color: semanticColors.automationStatus[tc.automation_status],
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    {tc.platform_tags.map((p) => (
                      <Chip
                        key={p}
                        label={p.charAt(0).toUpperCase() + p.slice(1)}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.55rem',
                          mr: 0.5,
                          bgcolor: alpha(semanticColors.platform[p], 0.12),
                          color: semanticColors.platform[p],
                        }}
                      />
                    ))}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {displayTotal > 20 && (
        <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
          Showing first 20 of {displayTotal} test cases
        </Typography>
      )}
    </Box>
  );
}
