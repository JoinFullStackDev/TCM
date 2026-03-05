'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from '@mui/material/CircularProgress';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { alpha } from '@mui/material/styles';
import { palette } from '@/theme/palette';
import AutomationBadge from './AutomationBadge';
import PlatformChips from './PlatformChips';
import type { TestCase, Priority, AutomationStatus } from '@/types/database';

const PRIORITY_COLORS: Record<Priority, string> = {
  critical: palette.error.main,
  high: palette.warning.main,
  medium: palette.info.main,
  low: palette.neutral.main,
};

type EditableField = 'title' | 'automation_status' | 'priority';

interface EditingCell {
  id: string;
  field: EditableField;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface TestCaseTableProps {
  testCases: TestCase[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onRowClick: (testCase: TestCase) => void;
  onInlineUpdate?: (id: string, updates: Partial<TestCase>) => Promise<boolean>;
  canWrite: boolean;
}

export default function TestCaseTable({
  testCases,
  selectedIds,
  onSelectionChange,
  onRowClick,
  onInlineUpdate,
  canWrite,
}: TestCaseTableProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [flashId, setFlashId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allSelected = testCases.length > 0 && selectedIds.length === testCases.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < testCases.length;

  const toggleAll = () => {
    onSelectionChange(allSelected ? [] : testCases.map((tc) => tc.id));
  };

  const toggleOne = (id: string) => {
    onSelectionChange(
      selectedIds.includes(id)
        ? selectedIds.filter((i) => i !== id)
        : [...selectedIds, id],
    );
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const saveField = useCallback(
    async (id: string, field: EditableField, value: string) => {
      if (!onInlineUpdate) return;
      setSaveStatus('saving');
      const updates: Partial<TestCase> = {};

      if (field === 'title') {
        if (!value.trim()) return;
        updates.title = value.trim();
      } else if (field === 'automation_status') {
        updates.automation_status = value as AutomationStatus;
      } else if (field === 'priority') {
        updates.priority = (value || null) as Priority | null;
      }

      const success = await onInlineUpdate(id, updates);
      setSaveStatus(success ? 'saved' : 'error');
      if (success) {
        setFlashId(id);
        savedTimerRef.current = setTimeout(() => {
          setSaveStatus('idle');
          setFlashId(null);
        }, 2000);
      }
    },
    [onInlineUpdate],
  );

  const startEditing = (id: string, field: EditableField, currentValue: string) => {
    if (!canWrite || !onInlineUpdate) return;
    setEditing({ id, field });
    setEditValue(currentValue);
  };

  const commitEdit = () => {
    if (!editing) return;
    const tc = testCases.find((t) => t.id === editing.id);
    if (!tc) return;

    const field = editing.field;
    let originalValue = '';
    if (field === 'title') originalValue = tc.title;
    else if (field === 'automation_status') originalValue = tc.automation_status;
    else if (field === 'priority') originalValue = tc.priority ?? '';

    if (editValue !== originalValue) {
      saveField(editing.id, field, editValue);
    }
    setEditing(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      setEditing(null);
    }
  };

  const handleTitleChange = (value: string) => {
    setEditValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (editing) {
        saveField(editing.id, 'title', value);
      }
    }, 1000);
  };

  return (
    <Box>
      {/* Save indicator */}
      {saveStatus !== 'idle' && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 2,
            py: 0.5,
            borderBottom: `1px solid ${palette.divider}`,
          }}
        >
          {saveStatus === 'saving' && (
            <>
              <CircularProgress size={14} sx={{ color: palette.primary.main }} />
              <Typography variant="caption" sx={{ color: palette.primary.main }}>Saving...</Typography>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <CheckCircleOutlineIcon sx={{ fontSize: 14, color: palette.success.main }} />
              <Typography variant="caption" sx={{ color: palette.success.main }}>Saved</Typography>
            </>
          )}
          {saveStatus === 'error' && (
            <>
              <ErrorOutlineIcon sx={{ fontSize: 14, color: palette.error.main }} />
              <Typography variant="caption" sx={{ color: palette.error.main }}>Save failed</Typography>
            </>
          )}
        </Box>
      )}

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              {canWrite && (
                <TableCell padding="checkbox" sx={{ width: 48 }}>
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={toggleAll}
                    size="small"
                  />
                </TableCell>
              )}
              <TableCell sx={{ width: 100, fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                ID
              </TableCell>
              <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                Title
              </TableCell>
              <TableCell sx={{ width: 140, fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                Automation
              </TableCell>
              <TableCell sx={{ width: 160, fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                Platforms
              </TableCell>
              <TableCell sx={{ width: 90, fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                Priority
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {testCases.map((tc) => {
              const isSelected = selectedIds.includes(tc.id);
              const isHovered = hoveredId === tc.id;
              const isFlash = flashId === tc.id;
              return (
                <TableRow
                  key={tc.id}
                  onMouseEnter={() => setHoveredId(tc.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => {
                    if (!editing) onRowClick(tc);
                  }}
                  sx={{
                    cursor: editing ? 'default' : 'pointer',
                    bgcolor: isSelected
                      ? alpha(palette.primary.main, 0.12)
                      : isFlash
                        ? alpha(palette.success.main, 0.08)
                        : isHovered
                          ? alpha(palette.primary.main, 0.06)
                          : 'transparent',
                    borderLeft: isSelected
                      ? `3px solid ${palette.primary.main}`
                      : isFlash
                        ? `3px solid ${palette.success.main}`
                        : isHovered
                          ? `3px solid ${alpha(palette.primary.main, 0.3)}`
                          : '3px solid transparent',
                    transition: 'background-color 0.15s, border-color 0.15s',
                  }}
                >
                  {canWrite && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleOne(tc.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        size="small"
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <Chip
                      label={tc.display_id}
                      size="small"
                      variant="outlined"
                      sx={{
                        height: 22,
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        fontFamily: 'monospace',
                      }}
                    />
                  </TableCell>

                  {/* Title - inline editable */}
                  <TableCell
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      startEditing(tc.id, 'title', tc.title);
                    }}
                  >
                    {editing?.id === tc.id && editing.field === 'title' ? (
                      <TextField
                        value={editValue}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={handleKeyDown}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                        fullWidth
                        size="small"
                        variant="outlined"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderColor: palette.primary.main,
                            boxShadow: `0 0 0 2px ${alpha(palette.primary.main, 0.2)}`,
                          },
                        }}
                      />
                    ) : (
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {tc.title}
                      </Typography>
                    )}
                  </TableCell>

                  {/* Automation Status - inline editable */}
                  <TableCell
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      startEditing(tc.id, 'automation_status', tc.automation_status);
                    }}
                  >
                    {editing?.id === tc.id && editing.field === 'automation_status' ? (
                      <Select
                        value={editValue}
                        onChange={(e) => {
                          setEditValue(e.target.value);
                          saveField(tc.id, 'automation_status', e.target.value);
                          setEditing(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onClose={() => setEditing(null)}
                        autoFocus
                        open
                        size="small"
                        fullWidth
                        sx={{ fontSize: '0.75rem' }}
                      >
                        <MenuItem value="not_automated">Not Automated</MenuItem>
                        <MenuItem value="scripted">Scripted</MenuItem>
                        <MenuItem value="in_cicd">In CICD</MenuItem>
                        <MenuItem value="out_of_sync">Out of Sync</MenuItem>
                      </Select>
                    ) : (
                      <AutomationBadge status={tc.automation_status} />
                    )}
                  </TableCell>

                  <TableCell>
                    <PlatformChips platforms={tc.platform_tags} />
                  </TableCell>

                  {/* Priority - inline editable */}
                  <TableCell
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      startEditing(tc.id, 'priority', tc.priority ?? '');
                    }}
                  >
                    {editing?.id === tc.id && editing.field === 'priority' ? (
                      <Select
                        value={editValue}
                        onChange={(e) => {
                          setEditValue(e.target.value);
                          saveField(tc.id, 'priority', e.target.value);
                          setEditing(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onClose={() => setEditing(null)}
                        autoFocus
                        open
                        size="small"
                        fullWidth
                        sx={{ fontSize: '0.75rem' }}
                      >
                        <MenuItem value="">None</MenuItem>
                        <MenuItem value="critical">Critical</MenuItem>
                        <MenuItem value="high">High</MenuItem>
                        <MenuItem value="medium">Medium</MenuItem>
                        <MenuItem value="low">Low</MenuItem>
                      </Select>
                    ) : tc.priority ? (
                      <Chip
                        label={tc.priority.charAt(0).toUpperCase() + tc.priority.slice(1)}
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          bgcolor: alpha(PRIORITY_COLORS[tc.priority], 0.15),
                          color: PRIORITY_COLORS[tc.priority],
                        }}
                      />
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {testCases.length === 0 && (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No test cases yet
            </Typography>
          </Box>
        )}
      </TableContainer>
    </Box>
  );
}
