'use client';

import { useState, useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Popover from '@mui/material/Popover';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import { alpha } from '@mui/material/styles';
import { palette, semanticColors } from '@/theme/palette';
import type { AutomationStatus, Platform, Priority, ExecutionStatus, TestCaseCategory } from '@/types/database';

interface FilterValues {
  automation_status: AutomationStatus[];
  platform: Platform[];
  priority: Priority[];
  type: string[];
  tags: string[];
  execution_status: ExecutionStatus[];
  category: TestCaseCategory[];
}

interface GridFilterBarProps {
  filters: FilterValues;
  onFiltersChange: (filters: FilterValues) => void;
  availableTags: string[];
}

interface FilterDef {
  key: keyof FilterValues;
  label: string;
  options: { value: string; label: string; color: string }[];
}

const FILTER_DEFS: FilterDef[] = [
  {
    key: 'automation_status',
    label: 'Automation',
    options: [
      { value: 'not_automated', label: 'Not Automated', color: semanticColors.automationStatus.not_automated },
      { value: 'scripted', label: 'Scripted', color: semanticColors.automationStatus.scripted },
      { value: 'in_cicd', label: 'In CICD', color: semanticColors.automationStatus.in_cicd },
      { value: 'out_of_sync', label: 'Out of Sync', color: semanticColors.automationStatus.out_of_sync },
    ],
  },
  {
    key: 'platform',
    label: 'Platform',
    options: [
      { value: 'desktop', label: 'Desktop', color: semanticColors.platform.desktop },
      { value: 'tablet', label: 'Tablet', color: semanticColors.platform.tablet },
      { value: 'mobile', label: 'Mobile', color: semanticColors.platform.mobile },
    ],
  },
  {
    key: 'priority',
    label: 'Priority',
    options: [
      { value: 'critical', label: 'Critical', color: palette.error.main },
      { value: 'high', label: 'High', color: palette.warning.main },
      { value: 'medium', label: 'Medium', color: palette.info.main },
      { value: 'low', label: 'Low', color: palette.neutral.main },
    ],
  },
  {
    key: 'type',
    label: 'Type',
    options: [
      { value: 'functional', label: 'Functional', color: palette.primary.main },
      { value: 'performance', label: 'Performance', color: palette.warning.main },
    ],
  },
  {
    key: 'category',
    label: 'Category',
    options: [
      { value: 'smoke', label: 'Smoke', color: palette.warning.main },
      { value: 'regression', label: 'Regression', color: palette.primary.main },
      { value: 'integration', label: 'Integration', color: palette.info.main },
      { value: 'e2e', label: 'E2E', color: palette.success.main },
      { value: 'unit', label: 'Unit', color: palette.neutral.main },
      { value: 'acceptance', label: 'Acceptance', color: palette.primary.light },
      { value: 'exploratory', label: 'Exploratory', color: palette.warning.light },
      { value: 'performance', label: 'Performance', color: palette.error.light },
      { value: 'security', label: 'Security', color: palette.error.main },
      { value: 'usability', label: 'Usability', color: palette.info.light },
    ],
  },
  {
    key: 'execution_status',
    label: 'Execution Status',
    options: [
      { value: 'pass', label: 'Pass', color: semanticColors.executionStatus.pass },
      { value: 'fail', label: 'Fail', color: semanticColors.executionStatus.fail },
      { value: 'blocked', label: 'Blocked', color: semanticColors.executionStatus.blocked },
      { value: 'skip', label: 'Skip', color: semanticColors.executionStatus.skip },
      { value: 'not_run', label: 'Not Run', color: semanticColors.executionStatus.not_run },
    ],
  },
];

export default function GridFilterBar({ filters, onFiltersChange, availableTags }: GridFilterBarProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterDef | null>(null);
  const [tagAnchorEl, setTagAnchorEl] = useState<HTMLElement | null>(null);

  const hasActiveFilters = useMemo(
    () =>
      filters.automation_status.length > 0 ||
      filters.platform.length > 0 ||
      filters.priority.length > 0 ||
      filters.type.length > 0 ||
      filters.tags.length > 0 ||
      filters.execution_status.length > 0 ||
      filters.category.length > 0,
    [filters],
  );

  const handleOpenFilter = useCallback(
    (event: React.MouseEvent<HTMLElement>, def: FilterDef) => {
      setAnchorEl(event.currentTarget);
      setActiveFilter(def);
    },
    [],
  );

  const handleToggle = useCallback(
    (key: keyof FilterValues, value: string) => {
      const current = filters[key] as string[];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      onFiltersChange({ ...filters, [key]: next });
    },
    [filters, onFiltersChange],
  );

  const handleClearAll = useCallback(() => {
    onFiltersChange({
      automation_status: [],
      platform: [],
      priority: [],
      type: [],
      tags: [],
      execution_status: [],
      category: [],
    });
  }, [onFiltersChange]);

  const handleToggleTag = useCallback(
    (tag: string) => {
      const next = filters.tags.includes(tag)
        ? filters.tags.filter((t) => t !== tag)
        : [...filters.tags, tag];
      onFiltersChange({ ...filters, tags: next });
    },
    [filters, onFiltersChange],
  );

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 2,
        py: 1.5,
        flexWrap: 'wrap',
        borderBottom: `1px solid ${palette.divider}`,
      }}
    >
      <FilterListIcon sx={{ fontSize: 18, color: 'text.secondary', mr: 0.5 }} />

      {FILTER_DEFS.map((def) => {
        const active = (filters[def.key] as string[]);
        const isActive = active.length > 0;
        const activeOption = isActive ? def.options.find((o) => o.value === active[0]) : null;

        return (
          <Chip
            key={def.key}
            label={
              isActive
                ? `${def.label}: ${active.length === 1 ? activeOption?.label : `${active.length} selected`}`
                : def.label
            }
            size="small"
            variant={isActive ? 'filled' : 'outlined'}
            onClick={(e) => handleOpenFilter(e, def)}
            onDelete={isActive ? () => onFiltersChange({ ...filters, [def.key]: [] }) : undefined}
            sx={{
              height: 28,
              fontSize: '0.75rem',
              fontWeight: 500,
              ...(isActive && activeOption
                ? {
                    bgcolor: alpha(activeOption.color, 0.15),
                    color: activeOption.color,
                    borderColor: alpha(activeOption.color, 0.3),
                  }
                : {
                    borderColor: alpha(palette.neutral.main, 0.3),
                    color: palette.text.secondary,
                  }),
            }}
          />
        );
      })}

      {availableTags.length > 0 && (
        <Chip
          label={
            filters.tags.length > 0
              ? `Tags: ${filters.tags.length} selected`
              : 'Tags'
          }
          size="small"
          variant={filters.tags.length > 0 ? 'filled' : 'outlined'}
          onClick={(e) => setTagAnchorEl(e.currentTarget)}
          onDelete={
            filters.tags.length > 0
              ? () => onFiltersChange({ ...filters, tags: [] })
              : undefined
          }
          sx={{
            height: 28,
            fontSize: '0.75rem',
            fontWeight: 500,
            ...(filters.tags.length > 0
              ? {
                  bgcolor: alpha(palette.primary.main, 0.15),
                  color: palette.primary.main,
                }
              : {
                  borderColor: alpha(palette.neutral.main, 0.3),
                  color: palette.text.secondary,
                }),
          }}
        />
      )}

      {hasActiveFilters && (
        <Button
          size="small"
          onClick={handleClearAll}
          startIcon={<ClearIcon sx={{ fontSize: 14 }} />}
          sx={{
            fontSize: '0.7rem',
            color: 'text.secondary',
            textTransform: 'none',
            ml: 0.5,
          }}
        >
          Clear all
        </Button>
      )}

      <Popover
        open={Boolean(anchorEl) && Boolean(activeFilter)}
        anchorEl={anchorEl}
        onClose={() => {
          setAnchorEl(null);
          setActiveFilter(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: palette.background.surface2,
              border: `1px solid ${palette.divider}`,
              mt: 0.5,
              minWidth: 180,
            },
          },
        }}
      >
        {activeFilter && (
          <List dense disablePadding sx={{ py: 0.5 }}>
            {activeFilter.options.map((opt) => {
              const checked = (filters[activeFilter.key] as string[]).includes(opt.value);
              return (
                <ListItemButton
                  key={opt.value}
                  onClick={() => handleToggle(activeFilter.key, opt.value)}
                  dense
                  sx={{ px: 1.5 }}
                >
                  <Checkbox
                    size="small"
                    checked={checked}
                    sx={{ p: 0.5, mr: 1 }}
                  />
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: opt.color,
                      mr: 1,
                      flexShrink: 0,
                    }}
                  />
                  <ListItemText
                    primary={opt.label}
                    primaryTypographyProps={{ fontSize: '0.8rem' }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        )}
      </Popover>

      <Popover
        open={Boolean(tagAnchorEl)}
        anchorEl={tagAnchorEl}
        onClose={() => setTagAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: palette.background.surface2,
              border: `1px solid ${palette.divider}`,
              mt: 0.5,
              minWidth: 180,
              maxHeight: 300,
            },
          },
        }}
      >
        {availableTags.length > 0 ? (
          <List dense disablePadding sx={{ py: 0.5, overflow: 'auto' }}>
            {availableTags.map((tag) => (
              <ListItemButton
                key={tag}
                onClick={() => handleToggleTag(tag)}
                dense
                sx={{ px: 1.5 }}
              >
                <Checkbox
                  size="small"
                  checked={filters.tags.includes(tag)}
                  sx={{ p: 0.5, mr: 1 }}
                />
                <ListItemText
                  primary={tag}
                  primaryTypographyProps={{ fontSize: '0.8rem' }}
                />
              </ListItemButton>
            ))}
          </List>
        ) : (
          <Typography variant="caption" sx={{ p: 2, display: 'block' }}>
            No tags available
          </Typography>
        )}
      </Popover>
    </Box>
  );
}

export type { FilterValues };
