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
    truncateAt: number,
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
          '&:hover': canWrite ? { bgcolor: alpha(palette.primary.main, 0.06), borderRadius: '4px', px: 0.5, mx: -0.5 } : {},
        }}
      >
        {display
          ? display.length > truncateAt ? display.slice(0, truncateAt) + '...' : display
          : '—'}
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
            <Box
              {...attributes}
              {...listeners}
              sx={{ cursor: 'grab', color: 'text.disabled', display: 'flex', '&:active': { cursor: 'grabbing' }, opacity: 0.5, '&:hover': { opacity: 1 } }}
            >
              <DragIndicatorIcon sx={{ fontSize: 14 }} />
            </Box>
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
        {renderTextCell('description', step.description, isEditingDesc, 120)}
      </TableCell>

      <TableCell sx={{ width: 180, wordBreak: 'break-word', whiteSpace: 'normal' }}>
        {renderTextCell('test_data', step.test_data, isEditingData, 80)}
      </TableCell>

      <TableCell sx={{ width: 180, wordBreak: 'break-word', whiteSpace: 'normal' }}>
        {renderTextCell('expected_result', step.expected_result, isEditingExpected, 80)}
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
        const clickable = canWrite && !!selectedRunId;
        return (
          <TableCell key={p} align="center" sx={{ width: 90 }}>
            {status && status !== 'not_run' ? (
              <Box
                onClick={clickable ? (e) => onStatusClick(e, step.id, p) : undefined}
                sx={{ cursor: clickable ? 'pointer' : 'default', display: 'inline-flex' }}
              >
                <StatusBadge status={status} />
              </Box>
            ) : selectedRunId ? (
              <Box
                onClick={clickable ? (e) => onStatusClick(e, step.id, p) : undefined}
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

      {canWrite && (
        <TableCell sx={{ width: 36 }}>
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

  const propsKeyRef = useRef(propSteps.map((s) => s.id).join(','));
  useEffect(() => {
    const newKey = propSteps.map((s) => s.id).join(',');
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

  const sortableIds = localSteps.map((s, i) => s.id || `new-${i}`);

  return (
    <Box sx={{ px: 3, py: 1.5, bgcolor: alpha(palette.background.surface2, 0.5) }}>
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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, borderColor: alpha(palette.neutral.main, 0.08) } }}>
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
              {canWrite && <TableCell sx={{ width: 36 }} />}
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
