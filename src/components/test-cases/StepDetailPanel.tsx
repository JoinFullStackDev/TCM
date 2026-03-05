'use client';

import { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { alpha } from '@mui/material/styles';
import { palette, semanticColors } from '@/theme/palette';
import StatusBadge from '@/components/execution/StatusBadge';
import type { ExecutionStatus, Platform, TestCaseCategory } from '@/types/database';

export interface StepWithStatus {
  id: string;
  step_number: number;
  description: string;
  test_data: string | null;
  expected_result: string | null;
  is_automation_only: boolean;
  category?: TestCaseCategory | null;
  step_status?: Record<string, string>;
}

interface StepDetailPanelProps {
  steps: StepWithStatus[];
  platforms: Platform[];
  canWrite: boolean;
  selectedRunId?: string | null;
  testCaseId: string;
  onStatusChange?: (stepId: string, platform: Platform, status: ExecutionStatus) => void;
}

const STATUS_OPTIONS: ExecutionStatus[] = ['pass', 'fail', 'blocked', 'skip', 'not_run'];

export default function StepDetailPanel({
  steps,
  platforms,
  canWrite,
  selectedRunId,
  testCaseId,
  onStatusChange,
}: StepDetailPanelProps) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuContext, setMenuContext] = useState<{ stepId: string; platform: Platform } | null>(null);

  const handleStatusClick = useCallback(
    (e: React.MouseEvent<HTMLElement>, stepId: string, platform: Platform) => {
      if (!canWrite || !selectedRunId) return;
      setMenuAnchor(e.currentTarget);
      setMenuContext({ stepId, platform });
    },
    [canWrite, selectedRunId],
  );

  const handleStatusSelect = useCallback(
    (status: ExecutionStatus) => {
      if (menuContext && onStatusChange) {
        onStatusChange(menuContext.stepId, menuContext.platform, status);
      }
      setMenuAnchor(null);
      setMenuContext(null);
    },
    [menuContext, onStatusChange],
  );

  const activePlatforms = platforms.length > 0 ? platforms : ['desktop' as Platform];

  return (
    <Box sx={{ px: 3, py: 1.5, bgcolor: alpha(palette.background.surface2, 0.5) }}>
      <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.75, borderColor: alpha(palette.neutral.main, 0.08) } }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600, fontSize: '0.7rem', color: 'text.secondary', width: 40 }}>#</TableCell>
            <TableCell sx={{ fontWeight: 600, fontSize: '0.7rem', color: 'text.secondary' }}>Step Description</TableCell>
            <TableCell sx={{ fontWeight: 600, fontSize: '0.7rem', color: 'text.secondary', width: 200 }}>Expected Result</TableCell>
            <TableCell sx={{ fontWeight: 600, fontSize: '0.7rem', color: 'text.secondary', width: 90 }}>Category</TableCell>
            {activePlatforms.map((p) => (
              <TableCell
                key={p}
                align="center"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  color: semanticColors.platform[p],
                  width: 90,
                }}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </TableCell>
            ))}
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
                        height: 14,
                        fontSize: '0.45rem',
                        fontWeight: 600,
                        bgcolor: alpha(palette.info.main, 0.12),
                        color: palette.info.main,
                      }}
                    />
                  )}
                </Box>
              </TableCell>
              <TableCell>
                <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                  {step.description.length > 120 ? step.description.slice(0, 120) + '...' : step.description}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                  {step.expected_result
                    ? step.expected_result.length > 80
                      ? step.expected_result.slice(0, 80) + '...'
                      : step.expected_result
                    : '—'}
                </Typography>
              </TableCell>
              <TableCell>
                {step.category ? (
                  <Chip
                    label={step.category.charAt(0).toUpperCase() + step.category.slice(1)}
                    size="small"
                    sx={{ height: 18, fontSize: '0.55rem', fontWeight: 600 }}
                  />
                ) : (
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>—</Typography>
                )}
              </TableCell>
              {activePlatforms.map((p) => {
                const status = step.step_status?.[p] as ExecutionStatus | undefined;
                const clickable = canWrite && !!selectedRunId;
                return (
                  <TableCell key={p} align="center">
                    {status && status !== 'not_run' ? (
                      <Box
                        onClick={clickable ? (e) => handleStatusClick(e, step.id, p) : undefined}
                        sx={{ cursor: clickable ? 'pointer' : 'default', display: 'inline-flex' }}
                      >
                        <StatusBadge status={status} />
                      </Box>
                    ) : selectedRunId ? (
                      <Box
                        onClick={clickable ? (e) => handleStatusClick(e, step.id, p) : undefined}
                        sx={{ cursor: clickable ? 'pointer' : 'default' }}
                      >
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>—</Typography>
                      </Box>
                    ) : (
                      <Typography variant="caption" sx={{ color: 'text.disabled' }}>—</Typography>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => { setMenuAnchor(null); setMenuContext(null); }}
        slotProps={{ paper: { sx: { bgcolor: palette.background.surface2, border: `1px solid ${palette.divider}` } } }}
      >
        {STATUS_OPTIONS.map((s) => (
          <MenuItem key={s} onClick={() => handleStatusSelect(s)} sx={{ gap: 1, fontSize: '0.8rem' }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: semanticColors.executionStatus[s],
                flexShrink: 0,
              }}
            />
            {s === 'not_run' ? 'Not Run' : s.charAt(0).toUpperCase() + s.slice(1)}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
