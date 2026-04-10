'use client';

import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import TextField from '@mui/material/TextField';
import { alpha } from '@mui/material/styles';
import { palette, semanticColors } from '@/theme/palette';
import ExecutionStatusCell from './ExecutionStatusCell';
import type { ExecutionStatus, Platform, TestStep } from '@/types/database';

export interface ResultEntry {
  status: ExecutionStatus;
  id?: string;
  comment?: string | null;
  actual_data_used?: string | null;
}

export interface ResultMap {
  [stepId: string]: {
    [platform: string]: ResultEntry;
  };
}

export interface BrowserResultMap {
  [stepId: string]: {
    [platform: string]: {
      [browser: string]: ResultEntry;
    };
  };
}

interface ExecutionMatrixProps {
  steps: TestStep[];
  platforms: Platform[];
  results: ResultMap;
  browserResults?: BrowserResultMap;
  browsers?: string[];
  selectedBrowser?: string;
  onBrowserChange?: (browser: string) => void;
  onStatusChange: (stepId: string, platform: Platform, status: ExecutionStatus, comment?: string | null) => void;
  onCommentChange?: (stepId: string, platform: Platform, comment: string) => void;
  onActualDataChange?: (stepId: string, platform: Platform, value: string | null) => void;
  readOnly?: boolean;
}

const PLATFORM_LABELS: Record<Platform, string> = {
  desktop: 'Desktop',
  tablet: 'Tablet',
  mobile: 'Mobile',
};

export default function ExecutionMatrix({
  steps, platforms, results, browsers, selectedBrowser, onBrowserChange, onStatusChange, onCommentChange, onActualDataChange, readOnly,
}: ExecutionMatrixProps) {
  return (
    <Box>
      {browsers && browsers.length > 1 && (
        <Tabs
          value={selectedBrowser ?? browsers[0]}
          onChange={(_, val) => onBrowserChange?.(val)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 36,
            borderBottom: `1px solid ${palette.divider}`,
            '& .MuiTab-root': { minHeight: 36, fontSize: '0.8rem', textTransform: 'none' },
          }}
        >
          {browsers.map((b) => (
            <Tab key={b} value={b} label={b === 'default' ? 'Default' : b} />
          ))}
        </Tabs>
      )}
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', width: 60 }}>#</TableCell>
            <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>Step Description</TableCell>
            {platforms.map((p) => {
              const platColor = semanticColors.platform[p];
              return (
                <TableCell
                  key={p}
                  align="center"
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    width: 160,
                    color: platColor,
                    bgcolor: alpha(platColor, 0.05),
                    borderBottom: `2px solid ${platColor}`,
                  }}
                >
                  {PLATFORM_LABELS[p]}
                </TableCell>
              );
            })}
          </TableRow>
        </TableHead>
        <TableBody>
          {steps.map((step) => (
            <TableRow
              key={step.id}
              sx={{
                bgcolor: step.is_automation_only ? alpha(palette.info.main, 0.03) : 'transparent',
                verticalAlign: 'top',
              }}
            >
              <TableCell sx={{ pt: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                    {step.step_number}
                  </Typography>
                  {step.is_automation_only && (
                    <Chip
                      label="Auto"
                      size="small"
                      sx={{
                        height: 16,
                        fontSize: '0.5rem',
                        fontWeight: 600,
                        bgcolor: alpha(palette.info.main, 0.12),
                        color: palette.info.main,
                      }}
                    />
                  )}
                </Box>
              </TableCell>
              <TableCell sx={{ pt: 1.5 }}>
                <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                  {step.description}
                </Typography>
                {step.expected_result && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
                    Expected: {step.expected_result}
                  </Typography>
                )}
                {step.test_data && (
                  <Box
                    sx={{
                      mt: 0.5,
                      px: 1,
                      py: 0.25,
                      borderRadius: '4px',
                      bgcolor: alpha(palette.info.main, 0.08),
                      border: `1px solid ${alpha(palette.info.main, 0.2)}`,
                      display: 'inline-block',
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 600, color: palette.info.main }}>
                      Expected data:
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.primary', ml: 0.5 }}>
                      {step.test_data}
                    </Typography>
                  </Box>
                )}
              </TableCell>
              {platforms.map((p) => {
                const result = results[step.id]?.[p];
                const status = result?.status ?? 'not_run';
                const comment = result?.comment ?? '';
                const actualDataUsed = result?.actual_data_used ?? '';
                return (
                  <TableCell key={p} align="center" sx={{ pt: 1.5 }}>
                    <ExecutionStatusCell
                      status={status}
                      onChange={(newStatus) => onStatusChange(step.id, p, newStatus)}
                      readOnly={readOnly}
                    />
                    {!readOnly && (
                      <TextField
                        size="small"
                        multiline
                        minRows={1}
                        maxRows={3}
                        placeholder="Add note…"
                        value={comment}
                        onChange={(e) => onCommentChange?.(step.id, p, e.target.value)}
                        onBlur={(e) => {
                          const val = e.target.value;
                          if (val !== (result?.comment ?? '')) {
                            onStatusChange(step.id, p, status, val || null);
                          }
                        }}
                        sx={{
                          mt: 0.75,
                          width: '100%',
                          '& .MuiInputBase-root': { fontSize: '0.7rem', py: 0.5 },
                          '& textarea': { resize: 'none' },
                        }}
                        inputProps={{ maxLength: 2000 }}
                      />
                    )}
                    {readOnly && comment && (
                      <Typography
                        variant="caption"
                        sx={{ display: 'block', mt: 0.5, color: 'text.secondary', fontStyle: 'italic', fontSize: '0.7rem', textAlign: 'left' }}
                      >
                        {comment}
                      </Typography>
                    )}
                    {!readOnly && (
                      <TextField
                        size="small"
                        multiline
                        minRows={1}
                        maxRows={4}
                        placeholder="Actual data used…"
                        value={actualDataUsed}
                        onChange={(e) => {
                          // Local optimistic update via parent map — parent handles state
                          onActualDataChange?.(step.id, p, e.target.value || null);
                        }}
                        onBlur={(e) => {
                          const val = e.target.value;
                          // Coerce empty string to null before saving (EC-03)
                          const normalized = val.trim() === '' ? null : val;
                          if (normalized !== (result?.actual_data_used ?? null)) {
                            onActualDataChange?.(step.id, p, normalized);
                          }
                        }}
                        sx={{
                          mt: 0.75,
                          width: '100%',
                          '& .MuiInputBase-root': {
                            fontSize: '0.7rem',
                            py: 0.5,
                            bgcolor: alpha(palette.warning.main, 0.06),
                            border: `1px solid ${alpha(palette.warning.main, 0.25)}`,
                            borderRadius: '4px',
                          },
                          '& textarea': { resize: 'none' },
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: alpha(palette.warning.main, 0.3),
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: palette.warning.main,
                          },
                        }}
                        inputProps={{ maxLength: 10000 }}
                        label="Actual data used"
                        InputLabelProps={{ sx: { fontSize: '0.65rem', color: palette.warning.main } }}
                      />
                    )}
                    {readOnly && result?.actual_data_used && (
                      <Box
                        sx={{
                          mt: 0.5,
                          px: 1,
                          py: 0.25,
                          borderRadius: '4px',
                          bgcolor: alpha(palette.warning.main, 0.08),
                          border: `1px solid ${alpha(palette.warning.main, 0.25)}`,
                          textAlign: 'left',
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 600, color: palette.warning.main, display: 'block' }}>
                          Actual used:
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.primary' }}>
                          {result.actual_data_used}
                        </Typography>
                      </Box>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
    </Box>
  );
}
