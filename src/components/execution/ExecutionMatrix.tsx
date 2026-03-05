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
import { alpha } from '@mui/material/styles';
import { palette, semanticColors } from '@/theme/palette';
import ExecutionStatusCell from './ExecutionStatusCell';
import type { ExecutionStatus, Platform, TestStep } from '@/types/database';

export interface ResultMap {
  [stepId: string]: {
    [platform: string]: {
      status: ExecutionStatus;
      id?: string;
    };
  };
}

export interface BrowserResultMap {
  [stepId: string]: {
    [platform: string]: {
      [browser: string]: {
        status: ExecutionStatus;
        id?: string;
      };
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
  onStatusChange: (stepId: string, platform: Platform, status: ExecutionStatus) => void;
  readOnly?: boolean;
}

const PLATFORM_LABELS: Record<Platform, string> = {
  desktop: 'Desktop',
  tablet: 'Tablet',
  mobile: 'Mobile',
};

export default function ExecutionMatrix({
  steps, platforms, results, browsers, selectedBrowser, onBrowserChange, onStatusChange, readOnly,
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
                    width: 120,
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
              }}
            >
              <TableCell>
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
              <TableCell>
                <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                  {step.description}
                </Typography>
                {step.expected_result && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    Expected: {step.expected_result}
                  </Typography>
                )}
              </TableCell>
              {platforms.map((p) => {
                const result = results[step.id]?.[p];
                const status = result?.status ?? 'not_run';
                return (
                  <TableCell key={p} align="center">
                    <ExecutionStatusCell
                      status={status}
                      onChange={(newStatus) => onStatusChange(step.id, p, newStatus)}
                      readOnly={readOnly}
                    />
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
