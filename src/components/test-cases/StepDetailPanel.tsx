'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import AddIcon from '@mui/icons-material/Add';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { alpha } from '@mui/material/styles';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { palette, semanticColors } from '@/theme/palette';
import StatusBadge from '@/components/execution/StatusBadge';
import type { ExecutionStatus, Platform } from '@/types/database';
import type { StepData } from './StepEditor';

export interface StepWithStatus {
  id: string;
  step_number: number;
  description: string;
  test_data: string | null;
  expected_result: string | null;
  is_automation_only: boolean;
  step_status?: Record<string, string>;
}

interface StepDetailPanelProps {
  steps: StepWithStatus[];
  platforms: Platform[];
  canWrite: boolean;
  selectedRunId?: string | null;
  testCaseId: string;
  title?: string;
  description?: string | null;
  precondition?: string | null;
  displayId?: string;
  onStatusChange?: (stepId: string, platform: Platform, status: ExecutionStatus) => void;
  onStepsUpdate?: (testCaseId: string, steps: StepData[]) => Promise<void>;
}

const STATUS_OPTIONS: ExecutionStatus[] = ['pass', 'fail', 'blocked', 'skip', 'not_run'];

type EditingField = {
  index: number;
  field: 'description' | 'test_data' | 'expected_result';
};

function toStepData(steps: StepWithStatus[]): StepData[] {
  return steps.map((s) => ({
    id: s.id,
    step_number: s.step_number,
    description: s.description,
    test_data: s.test_data,
    expected_result: s.expected_result,
    is_automation_only: s.is_automation_only,
  }));
}

interface SortableStepRowProps {
  step: StepWithStatus;
  index: number;
  canWrite: boolean;
  selectedRunId?: string | null;
  activePlatforms: Platform[];
  editingField: EditingField | null;
  onStartEdit: (index: number, field: EditingField['field']) => void;
  onFieldChange: (index: number, field: string, value: string | boolean) => void;
  onCommitEdit: () => void;
  onDelete: (index: number) => void;
  onInsertBelow: (index: number) => void;
  onStatusClick: (e: React.MouseEvent<HTMLElement>, stepId: string, platform: Platform) => void;
}

function SortableStepRow({
  step,
  index,
  canWrite,
  selectedRunId,
  activePlatforms,
  editingField,
  onStartEdit,
  onFieldChange,
  onCommitEdit,
  onDelete,
  onInsertBelow,
  onStatusClick,
}: SortableStepRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id || `new-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isEditingDesc = editingField?.index === index && editingField.field === 'description';
  const isEditingData = editingField?.index === index && editingField.field === 'test_data';
  const isEditingExpected = editingField?.index === index && editingField.field === 'expected_result';

  const renderTextCell = (
    field: EditingField['field'],
    value: string | null,
    isEditing: boolean,
  ) => {
    if (canWrite && isEditing) {
      return (
        <TextField
          value={value ?? ''}
          onChange={(e) => onFieldChange(index, field, e.target.value)}
          onBlur={onCommitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onCommitEdit(); }
            if (e.key === 'Escape') onCommitEdit();
          }}
          size="small"
          multiline
          maxRows={4}
          fullWidth
          autoFocus
          variant="standard"
          slotProps={{ input: { sx: { fontSize: '0.75rem', py: 0 } } }}
        />
      );
    }

    const display = value || '';
    return (
      <Typography
        variant="caption"
        onClick={canWrite ? () => onStartEdit(index, field) : undefined}
        sx={{
          fontSize: '0.75rem',
          color: display ? 'text.primary' : 'text.disabled',
          cursor: canWrite ? 'text' : 'default',
          display: 'block',
          minHeight: 20,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          '&:hover': canWrite ? { bgcolor: alpha(palette.primary.main, 0.06), borderRadius: '4px', px: 0.5, mx: -0.5 } : {},
        }}
      >
        {display || '—'}
      </Typography>
    );
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      sx={{
        bgcolor: step.is_automation_only ? alpha(palette.info.main, 0.03) : 'transparent',
        '&:hover .step-actions': { opacity: 1 },
      }}
    >
      <TableCell sx={{ width: 60 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
          {canWrite && (
            <Tooltip title="Drag to reorder" enterDelay={400}>
              <Box
                {...attributes}
                {...listeners}
                sx={{ cursor: 'grab', color: 'text.disabled', display: 'flex', '&:active': { cursor: 'grabbing' }, opacity: 0.7, '&:hover': { opacity: 1 } }}
              >
                <DragIndicatorIcon sx={{ fontSize: 16 }} />
              </Box>
            </Tooltip>
          )}
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
            {step.step_number}
          </Typography>
          {step.is_automation_only && (
            <Chip
              label="A"
              size="small"
              sx={{
                height: 14,
                minWidth: 14,
                fontSize: '0.4rem',
                fontWeight: 700,
                bgcolor: alpha(palette.info.main, 0.12),
                color: palette.info.main,
                '& .MuiChip-label': { px: 0.3 },
              }}
            />
          )}
        </Box>
      </TableCell>

      <TableCell sx={{ width: 280, wordBreak: 'break-word', whiteSpace: 'normal' }}>
        {renderTextCell('description', step.description, isEditingDesc)}
      </TableCell>

      <TableCell sx={{ width: 180, wordBreak: 'break-word', whiteSpace: 'normal' }}>
        {renderTextCell('test_data', step.test_data, isEditingData)}
      </TableCell>

      <TableCell sx={{ width: 180, wordBreak: 'break-word', whiteSpace: 'normal' }}>
        {renderTextCell('expected_result', step.expected_result, isEditingExpected)}
      </TableCell>

      {canWrite && (
        <TableCell sx={{ width: 40 }}>
          <Switch
            checked={step.is_automation_only}
            onChange={(e) => onFieldChange(index, 'is_automation_only', e.target.checked)}
            size="small"
            sx={{ transform: 'scale(0.7)' }}
          />
        </TableCell>
      )}

      {activePlatforms.map((p) => {
        const status = step.step_status?.[p] as ExecutionStatus | undefined;
        const hasStatus = status && status !== 'not_run';
        return (
          <TableCell key={p} align="center" sx={{ width: 90 }}>
            <Box
              onClick={canWrite ? (e) => onStatusClick(e, step.id, p) : undefined}
              onDoubleClick={canWrite ? (e) => onStatusClick(e, step.id, p) : undefined}
              sx={{
                cursor: canWrite ? 'pointer' : 'default',
                display: 'inline-flex',
                borderRadius: '4px',
                px: 0.5,
                py: 0.25,
                minWidth: 50,
                justifyContent: 'center',
                '&:hover': canWrite ? { bgcolor: alpha(palette.primary.main, 0.08) } : {},
              }}
            >
              {hasStatus ? (
                <StatusBadge status={status} />
              ) : (
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>—</Typography>
              )}
            </Box>
          </TableCell>
        );
      })}

      {canWrite && (
        <TableCell sx={{ width: 56 }}>
          <Box sx={{ display: 'flex', gap: 0 }}>
            <Tooltip title="Insert step below">
              <IconButton
                size="small"
                onClick={() => onInsertBelow(index)}
                className="step-actions"
                sx={{ opacity: 0, transition: 'opacity 0.15s', color: 'text.secondary', '&:hover': { color: palette.primary.main } }}
              >
                <PlaylistAddIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete step">
              <IconButton
                size="small"
                onClick={() => onDelete(index)}
                className="step-actions"
                sx={{ opacity: 0, transition: 'opacity 0.15s', color: 'text.secondary', '&:hover': { color: palette.error.main } }}
              >
                <DeleteOutlineIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </TableCell>
      )}
    </TableRow>
  );
}

export default function StepDetailPanel({
  steps: propSteps,
  platforms,
  canWrite,
  selectedRunId,
  testCaseId,
  title,
  description,
  precondition,
  displayId,
  onStatusChange,
  onStepsUpdate,
}: StepDetailPanelProps) {
  const [localSteps, setLocalSteps] = useState<StepWithStatus[]>(propSteps);
  const [editingField, setEditingField] = useState<EditingField | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuContext, setMenuContext] = useState<{ stepId: string; platform: Platform } | null>(null);
  const [noRunWarning, setNoRunWarning] = useState(false);

  const buildKey = (steps: StepWithStatus[]) =>
    steps.map((s) => `${s.id}:${JSON.stringify(s.step_status ?? {})}`).join(',');

  const propsKeyRef = useRef(buildKey(propSteps));
  useEffect(() => {
    const newKey = buildKey(propSteps);
    if (newKey !== propsKeyRef.current) {
      propsKeyRef.current = newKey;
      setLocalSteps(propSteps);
    }
  }, [propSteps]);

  const triggerSave = useCallback(
    (steps: StepWithStatus[]) => {
      if (!onStepsUpdate) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setSaveStatus('saving');
        try {
          await onStepsUpdate(testCaseId, toStepData(steps));
          setSaveStatus('saved');
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
          saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
        } catch {
          setSaveStatus('error');
        }
      }, 800);
    },
    [onStepsUpdate, testCaseId],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const updateSteps = useCallback(
    (updater: (prev: StepWithStatus[]) => StepWithStatus[]) => {
      setLocalSteps((prev) => {
        const next = updater(prev);
        triggerSave(next);
        return next;
      });
    },
    [triggerSave],
  );

  const handleFieldChange = useCallback(
    (index: number, field: string, value: string | boolean) => {
      updateSteps((prev) => {
        const copy = [...prev];
        copy[index] = { ...copy[index], [field]: value };
        return copy;
      });
    },
    [updateSteps],
  );

  const handleStartEdit = useCallback((index: number, field: EditingField['field']) => {
    setEditingField({ index, field });
  }, []);

  const handleCommitEdit = useCallback(() => {
    setEditingField(null);
  }, []);

  const handleDelete = useCallback(
    (index: number) => {
      updateSteps((prev) =>
        prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_number: i + 1 })),
      );
    },
    [updateSteps],
  );

  const handleAdd = useCallback(() => {
    updateSteps((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        step_number: prev.length + 1,
        description: '',
        test_data: null,
        expected_result: null,
        is_automation_only: false,
      },
    ]);
  }, [updateSteps]);

  const handleInsertBelow = useCallback(
    (index: number) => {
      updateSteps((prev) => {
        const newStep: StepWithStatus = {
          id: `temp-${Date.now()}`,
          step_number: index + 2,
          description: '',
          test_data: null,
          expected_result: null,
          is_automation_only: false,
        };
        const copy = [...prev];
        copy.splice(index + 1, 0, newStep);
        return copy.map((s, i) => ({ ...s, step_number: i + 1 }));
      });
    },
    [updateSteps],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      updateSteps((prev) => {
        const oldIndex = prev.findIndex((s) => (s.id || `new-${prev.indexOf(s)}`) === active.id);
        const newIndex = prev.findIndex((s) => (s.id || `new-${prev.indexOf(s)}`) === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;

        const reordered = [...prev];
        const [moved] = reordered.splice(oldIndex, 1);
        reordered.splice(newIndex, 0, moved);
        return reordered.map((s, i) => ({ ...s, step_number: i + 1 }));
      });
    },
    [updateSteps],
  );

  const handleStatusClick = useCallback(
    (e: React.MouseEvent<HTMLElement>, stepId: string, platform: Platform) => {
      if (!canWrite) return;
      if (!selectedRunId) {
        setNoRunWarning(true);
        setTimeout(() => setNoRunWarning(false), 3000);
        return;
      }
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

  const sortableIds = localSteps.map((s, i) => s.id || `new-${i}`);

  return (
    <Box sx={{ px: 3, py: 1.5, bgcolor: palette.background.default, borderTop: `1px solid ${alpha(palette.neutral.main, 0.15)}`, borderBottom: `1px solid ${alpha(palette.neutral.main, 0.15)}`, height: '100%', overflow: 'auto' }}>
      {(title || description || precondition) && (
        <Box
          sx={{
            mb: 1.5,
            p: 1.5,
            borderRadius: '6px',
            bgcolor: alpha(palette.background.surface2, 0.6),
            border: `1px solid ${alpha(palette.neutral.main, 0.12)}`,
          }}
        >
          {title && (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: (description || precondition) ? 1 : 0 }}>
              {displayId && (
                <Chip
                  label={displayId}
                  size="small"
                  variant="outlined"
                  sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.65rem', height: 20, flexShrink: 0, mt: 0.25 }}
                />
              )}
              <Typography
                variant="body2"
                sx={{ fontWeight: 700, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}
              >
                {title}
              </Typography>
            </Box>
          )}
          {description && (
            <Box sx={{ mb: precondition ? 1 : 0 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Description
              </Typography>
              <Typography
                variant="caption"
                sx={{ display: 'block', mt: 0.25, fontSize: '0.75rem', color: 'text.primary', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}
              >
                {description}
              </Typography>
            </Box>
          )}
          {precondition && (
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 600, color: palette.warning.main, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Precondition
              </Typography>
              <Typography
                variant="caption"
                sx={{ display: 'block', mt: 0.25, fontSize: '0.75rem', color: 'text.primary', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}
              >
                {precondition}
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {canWrite && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mb: 0.5, minHeight: 20 }}>
          {saveStatus === 'saving' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CircularProgress size={12} sx={{ color: palette.primary.main }} />
              <Typography variant="caption" sx={{ color: palette.primary.main, fontSize: '0.65rem' }}>Saving...</Typography>
            </Box>
          )}
          {saveStatus === 'saved' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CheckCircleOutlineIcon sx={{ fontSize: 12, color: palette.success.main }} />
              <Typography variant="caption" sx={{ color: palette.success.main, fontSize: '0.65rem' }}>Saved</Typography>
            </Box>
          )}
          {saveStatus === 'error' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ErrorOutlineIcon sx={{ fontSize: 12, color: palette.error.main }} />
              <Typography variant="caption" sx={{ color: palette.error.main, fontSize: '0.65rem' }}>Save failed</Typography>
            </Box>
          )}
        </Box>
      )}

      {noRunWarning && (
        <Box
          sx={{
            mb: 1,
            px: 1.5,
            py: 0.75,
            borderRadius: 1,
            bgcolor: alpha(palette.warning.main, 0.1),
            border: `1px solid ${alpha(palette.warning.main, 0.3)}`,
          }}
        >
          <Typography variant="caption" sx={{ color: palette.warning.main, fontWeight: 500 }}>
            Select a test run from the &quot;Test Run&quot; dropdown in the grid toolbar to record execution results.
          </Typography>
        </Box>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <Table size="small" sx={{
          border: `1px solid ${alpha(palette.neutral.main, 0.15)}`,
          borderRadius: '6px',
          overflow: 'hidden',
          '& .MuiTableCell-root': {
            py: 0.5,
            borderBottom: `1px solid ${alpha(palette.neutral.main, 0.15)}`,
            borderRight: `1px solid ${alpha(palette.neutral.main, 0.08)}`,
            '&:last-child': { borderRight: 'none' },
          },
          '& .MuiTableHead-root .MuiTableCell-root': {
            bgcolor: palette.background.surface2,
            borderBottom: `2px solid ${alpha(palette.neutral.main, 0.2)}`,
          },
        }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.7rem', color: 'text.secondary', width: 60 }}>#</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.7rem', color: 'text.secondary', width: 280 }}>Test Step Description</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.7rem', color: 'text.secondary', width: 180 }}>Test Data</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.7rem', color: 'text.secondary', width: 180 }}>Expected Result</TableCell>
              {canWrite && (
                <TableCell sx={{ fontWeight: 600, fontSize: '0.7rem', color: 'text.secondary', width: 40 }}>Auto</TableCell>
              )}
              {activePlatforms.map((p) => (
                <TableCell
                  key={p}
                  align="center"
                  sx={{ fontWeight: 600, fontSize: '0.7rem', color: semanticColors.platform[p], width: 90 }}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </TableCell>
              ))}
              {canWrite && <TableCell sx={{ width: 56 }} />}
            </TableRow>
          </TableHead>
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <TableBody>
              {localSteps.map((step, index) => (
                <SortableStepRow
                  key={step.id || `new-${index}`}
                  step={step}
                  index={index}
                  canWrite={canWrite}
                  selectedRunId={selectedRunId}
                  activePlatforms={activePlatforms}
                  editingField={editingField}
                  onStartEdit={handleStartEdit}
                  onFieldChange={handleFieldChange}
                  onCommitEdit={handleCommitEdit}
                  onDelete={handleDelete}
                  onInsertBelow={handleInsertBelow}
                  onStatusClick={handleStatusClick}
                />
              ))}
            </TableBody>
          </SortableContext>
        </Table>
      </DndContext>

      {canWrite && (
        <Button
          startIcon={<AddIcon sx={{ fontSize: 14 }} />}
          onClick={handleAdd}
          size="small"
          sx={{ mt: 0.5, fontSize: '0.7rem' }}
        >
          Add Step
        </Button>
      )}

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
