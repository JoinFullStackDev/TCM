'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Tooltip from '@mui/material/Tooltip';
import { alpha } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
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
import { palette } from '@/theme/palette';
import StepAutocomplete from './StepAutocomplete';

export interface StepData {
  id?: string;
  step_number: number;
  description: string;
  test_data: string | null;
  expected_result: string | null;
  is_automation_only: boolean;
}

interface StepEditorProps {
  steps: StepData[];
  onChange: (steps: StepData[]) => void;
  readOnly?: boolean;
  projectId?: string;
}

function StepRow({
  step,
  index,
  onChange,
  onBatchChange,
  onDelete,
  readOnly,
  projectId,
}: {
  step: StepData;
  index: number;
  onChange: (index: number, field: keyof StepData, value: string | boolean) => void;
  onBatchChange: (index: number, fields: Partial<StepData>) => void;
  onDelete: (index: number) => void;
  readOnly?: boolean;
  projectId?: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `step-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      sx={{
        p: 2,
        borderRadius: '6px',
        bgcolor: step.is_automation_only
          ? alpha(palette.info.main, 0.04)
          : 'background.default',
        border: `1px solid ${palette.divider}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {!readOnly && (
          <Box
            {...attributes}
            {...listeners}
            sx={{ cursor: 'grab', color: 'text.secondary', display: 'flex', '&:active': { cursor: 'grabbing' } }}
          >
            <DragIndicatorIcon fontSize="small" />
          </Box>
        )}
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', minWidth: 32 }}>
          #{step.step_number}
        </Typography>
        {step.is_automation_only && (
          <Chip
            label="Auto Only"
            size="small"
            sx={{
              height: 20,
              fontSize: '0.6rem',
              fontWeight: 600,
              bgcolor: alpha(palette.info.main, 0.12),
              color: palette.info.main,
            }}
          />
        )}
        <Box sx={{ flex: 1 }} />
        {!readOnly && (
          <>
            <FormControlLabel
              control={
                <Switch
                  checked={step.is_automation_only}
                  onChange={(e) => onChange(index, 'is_automation_only', e.target.checked)}
                  size="small"
                />
              }
              label={<Typography variant="caption" sx={{ color: 'text.secondary' }}>Auto Only</Typography>}
              sx={{ mr: 0 }}
            />
            <Tooltip title="Delete step">
              <IconButton size="small" onClick={() => onDelete(index)} sx={{ color: 'text.secondary' }}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Box>

      <StepAutocomplete
        value={step.description}
        onChange={(val) => onChange(index, 'description', val)}
        onSelect={(s) => onBatchChange(index, {
          description: s.description,
          test_data: s.test_data ?? '',
          expected_result: s.expected_result ?? '',
        })}
        projectId={projectId}
        label="Description"
        disabled={readOnly}
      />

      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <TextField
          label="Test Data"
          value={step.test_data ?? ''}
          onChange={(e) => onChange(index, 'test_data', e.target.value)}
          fullWidth
          multiline
          minRows={1}
          maxRows={3}
          size="small"
          disabled={readOnly}
        />
        <TextField
          label="Expected Result"
          value={step.expected_result ?? ''}
          onChange={(e) => onChange(index, 'expected_result', e.target.value)}
          fullWidth
          multiline
          minRows={1}
          maxRows={3}
          size="small"
          disabled={readOnly}
        />
      </Box>
    </Box>
  );
}

export default function StepEditor({ steps, onChange, readOnly, projectId }: StepEditorProps) {
  const [, setDragKey] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleChange = (index: number, field: keyof StepData, value: string | boolean) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleBatchChange = (index: number, fields: Partial<StepData>) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], ...fields };
    onChange(updated);
  };

  const handleDelete = (index: number) => {
    const updated = steps.filter((_, i) => i !== index);
    onChange(updated.map((s, i) => ({ ...s, step_number: i + 1 })));
  };

  const handleAdd = () => {
    onChange([
      ...steps,
      {
        step_number: steps.length + 1,
        description: '',
        test_data: null,
        expected_result: null,
        is_automation_only: false,
      },
    ]);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = parseInt(String(active.id).split('-')[1]);
    const newIndex = parseInt(String(over.id).split('-')[1]);

    const reordered = [...steps];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    onChange(reordered.map((s, i) => ({ ...s, step_number: i + 1 })));
    setDragKey((k) => k + 1);
  };

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
        Test Steps ({steps.length})
      </Typography>

      {steps.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={steps.map((_, i) => `step-${i}`)} strategy={verticalListSortingStrategy}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {steps.map((step, index) => (
                <StepRow
                  key={`step-${index}`}
                  step={step}
                  index={index}
                  onChange={handleChange}
                  onBatchChange={handleBatchChange}
                  onDelete={handleDelete}
                  readOnly={readOnly}
                  projectId={projectId}
                />
              ))}
            </Box>
          </SortableContext>
        </DndContext>
      ) : (
        <Typography variant="body2" sx={{ color: 'text.secondary', py: 2, textAlign: 'center' }}>
          No steps yet
        </Typography>
      )}

      {!readOnly && (
        <Button
          startIcon={<AddIcon />}
          onClick={handleAdd}
          size="small"
          sx={{ mt: 1.5 }}
        >
          Add Step
        </Button>
      )}
    </Box>
  );
}
