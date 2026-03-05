'use client';

import { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Collapse from '@mui/material/Collapse';
import { alpha } from '@mui/material/styles';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MoreVertIcon from '@mui/icons-material/MoreVert';
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
import type { Suite } from '@/types/database';

interface SuiteWithCount extends Suite {
  test_case_count: number;
}

interface SuiteListProps {
  suites: SuiteWithCount[];
  projectId: string;
  onReorder: (items: { id: string; position: number }[]) => void;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>, suite: SuiteWithCount) => void;
  canWrite: boolean;
}

function SuiteItem({
  suite,
  projectId,
  onMenuOpen,
  canWrite,
}: {
  suite: SuiteWithCount;
  projectId: string;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>, suite: SuiteWithCount) => void;
  canWrite: boolean;
}) {
  const router = useRouter();
  const suiteColor = semanticColors.suiteColors[suite.color_index % 5];

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: suite.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      onClick={() => router.push(`/projects/${projectId}/suites/${suite.id}`)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 2,
        borderLeft: `4px solid ${suiteColor}`,
        borderRadius: '8px',
        bgcolor: 'background.paper',
        border: `1px solid`,
        borderColor: 'divider',
        borderLeftColor: suiteColor,
        borderLeftWidth: 4,
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        '&:hover': {
          borderColor: alpha(suiteColor, 0.6),
          boxShadow: `0 0 0 1px ${alpha(suiteColor, 0.15)}`,
        },
      }}
    >
      {canWrite && (
        <Box
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          sx={{
            cursor: 'grab',
            color: 'text.secondary',
            display: 'flex',
            '&:active': { cursor: 'grabbing' },
          }}
        >
          <DragIndicatorIcon fontSize="small" />
        </Box>
      )}
      <Chip
        label={suite.prefix}
        size="small"
        sx={{
          fontWeight: 700,
          fontSize: '0.7rem',
          bgcolor: alpha(suiteColor, 0.15),
          color: suiteColor,
          height: 24,
        }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {suite.name}
        </Typography>
        {suite.description && (
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              display: 'block',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {suite.description}
          </Typography>
        )}
        {suite.tags && suite.tags.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
            {suite.tags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                variant="outlined"
                sx={{ height: 18, fontSize: '0.55rem' }}
              />
            ))}
          </Box>
        )}
      </Box>
      <Chip
        label={`${suite.test_case_count} case${suite.test_case_count !== 1 ? 's' : ''}`}
        size="small"
        variant="outlined"
        sx={{ height: 22, fontSize: '0.65rem' }}
      />
      {canWrite && (
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onMenuOpen(e, suite);
          }}
          sx={{ color: 'text.secondary' }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      )}
    </Box>
  );
}

interface SuiteGroup {
  name: string;
  suites: SuiteWithCount[];
}

export default function SuiteList({
  suites,
  projectId,
  onReorder,
  onMenuOpen,
  canWrite,
}: SuiteListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const groups = useMemo<SuiteGroup[]>(() => {
    const groupMap = new Map<string, SuiteWithCount[]>();
    const ungrouped: SuiteWithCount[] = [];

    for (const suite of suites) {
      const g = suite.group?.trim();
      if (g) {
        if (!groupMap.has(g)) groupMap.set(g, []);
        groupMap.get(g)!.push(suite);
      } else {
        ungrouped.push(suite);
      }
    }

    const result: SuiteGroup[] = [];
    for (const [name, items] of groupMap) {
      result.push({ name, suites: items });
    }
    if (ungrouped.length > 0) {
      result.push({ name: '', suites: ungrouped });
    }

    return result;
  }, [suites]);

  const hasGroups = groups.some((g) => g.name);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    groups.forEach((g, i) => {
      if (i > 0) initial.add(g.name || '__ungrouped__');
    });
    return initial;
  });

  const toggleGroup = useCallback((groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = suites.findIndex((s) => s.id === active.id);
    const newIndex = suites.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...suites];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    onReorder(reordered.map((s, i) => ({ id: s.id, position: i })));
  };

  if (!hasGroups) {
    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={suites.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {suites.map((suite) => (
              <SuiteItem key={suite.id} suite={suite} projectId={projectId} onMenuOpen={onMenuOpen} canWrite={canWrite} />
            ))}
          </Box>
        </SortableContext>
      </DndContext>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {groups.map((group) => {
          const groupKey = group.name || '__ungrouped__';
          const isCollapsed = collapsedGroups.has(groupKey);

          return (
            <Box key={groupKey}>
              <Box
                onClick={() => toggleGroup(groupKey)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mb: isCollapsed ? 0 : 1.5,
                  px: 0.5,
                  py: 0.75,
                  cursor: 'pointer',
                  borderRadius: '6px',
                  '&:hover': { bgcolor: alpha(palette.neutral.main, 0.06) },
                  transition: 'background-color 0.15s',
                }}
              >
                <ExpandMoreIcon
                  sx={{
                    fontSize: 18,
                    color: 'text.secondary',
                    transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }}
                />
                <Typography
                  variant="overline"
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    color: 'text.secondary',
                    letterSpacing: '0.08em',
                    lineHeight: 1,
                  }}
                >
                  {group.name || 'Other'}
                </Typography>
                <Chip
                  label={group.suites.length}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.6rem',
                    fontWeight: 600,
                    bgcolor: alpha(palette.neutral.main, 0.1),
                    color: 'text.secondary',
                  }}
                />
                <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider', ml: 1 }} />
              </Box>
              <Collapse in={!isCollapsed} timeout={200}>
                <SortableContext items={group.suites.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {group.suites.map((suite) => (
                      <SuiteItem key={suite.id} suite={suite} projectId={projectId} onMenuOpen={onMenuOpen} canWrite={canWrite} />
                    ))}
                  </Box>
                </SortableContext>
              </Collapse>
            </Box>
          );
        })}
      </Box>
    </DndContext>
  );
}
