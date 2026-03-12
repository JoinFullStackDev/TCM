'use client';

import { useMemo, useCallback } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  DataGridPro,
  useGridApiRef,
  type GridColDef,
  type GridRenderCellParams,
  type GridRowParams,
  type GridRowSelectionModel,
  type GridColumnVisibilityModel,
  type GridGroupingColDefOverride,
  type GridFilterModel,
  type GridEventListener,
  type GridProSlotsComponent,
  type GridSlotProps,
  type GridRowOrderChangeParams,
} from '@mui/x-data-grid-pro';
import { alpha } from '@mui/material/styles';
import { palette, semanticColors } from '@/theme/palette';
import AutomationBadge from './AutomationBadge';
import PlatformChips from './PlatformChips';
import CombinedStatusDisplay from '@/components/execution/CombinedStatusDisplay';
import StepDetailPanel, { type StepWithStatus } from './StepDetailPanel';
import PlatformTagsEditCell from './edit-cells/PlatformTagsEditCell';
import TagsEditCell from './edit-cells/TagsEditCell';
import TextPopoverEditCell from './edit-cells/TextPopoverEditCell';
import type { TestCase, AutomationStatus, Platform, Priority, ExecutionStatus, TestCaseCategory, TestCaseType } from '@/types/database';
import type { StepData } from './StepEditor';

export interface TestCaseRow extends TestCase {
  suite_name?: string;
  suite_prefix?: string;
  suite_color_index?: number;
  suite_position?: number;
  treePath?: string[];
  platform_status?: Record<string, string>;
  test_steps?: StepWithStatus[];
}

const PRIORITY_COLORS: Record<Priority, string> = {
  critical: palette.error.main,
  high: palette.warning.main,
  medium: palette.info.main,
  low: palette.neutral.main,
};

const AUTOMATION_OPTIONS = [
  { value: 'not_automated', label: 'Not Automated' },
  { value: 'scripted', label: 'Scripted' },
  { value: 'in_cicd', label: 'In CICD' },
  { value: 'out_of_sync', label: 'Out of Sync' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'smoke', label: 'Smoke' },
  { value: 'regression', label: 'Regression' },
  { value: 'integration', label: 'Integration' },
  { value: 'e2e', label: 'E2E' },
  { value: 'unit', label: 'Unit' },
  { value: 'acceptance', label: 'Acceptance' },
  { value: 'exploratory', label: 'Exploratory' },
  { value: 'performance', label: 'Performance' },
  { value: 'security', label: 'Security' },
  { value: 'usability', label: 'Usability' },
];

const TYPE_OPTIONS = [
  { value: 'functional', label: 'Functional' },
  { value: 'performance', label: 'Performance' },
];

const CATEGORY_COLORS: Record<string, string> = {
  smoke: palette.warning.main,
  regression: palette.primary.main,
  integration: palette.info.main,
  e2e: palette.success.main,
  unit: palette.neutral.main,
  acceptance: palette.primary.light,
  exploratory: palette.warning.light,
  performance: palette.error.light,
  security: palette.error.main,
  usability: palette.info.light,
};

interface TestCaseDataGridProps {
  rows: TestCaseRow[];
  canWrite: boolean;
  treeData?: boolean;
  loading?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  onOpenDrawer?: (testCase: TestCaseRow) => void;
  onRowUpdate?: (id: string, updates: Partial<TestCase>) => Promise<TestCaseRow | null>;
  onStepsUpdate?: (testCaseId: string, steps: StepData[]) => Promise<void>;
  columnVisibilityModel?: GridColumnVisibilityModel;
  onColumnVisibilityChange?: (model: GridColumnVisibilityModel) => void;
  onColumnWidthChange?: GridEventListener<'columnWidthChange'>;
  onColumnOrderChange?: GridEventListener<'columnOrderChange'>;
  filterModel?: GridFilterModel;
  onFilterModelChange?: (model: GridFilterModel) => void;
  columnOrder?: string[];
  columnWidths?: Record<string, number>;
  slots?: Partial<GridProSlotsComponent>;
  slotProps?: Partial<GridSlotProps>;
  selectedRunId?: string | null;
  onStepStatusChange?: (testCaseId: string, stepId: string, platform: Platform, status: ExecutionStatus) => void;
  rowReordering?: boolean;
  onRowOrderChange?: (params: GridRowOrderChangeParams) => void;
}

export default function TestCaseDataGrid({
  rows,
  canWrite,
  treeData = false,
  loading = false,
  selectedIds,
  onSelectionChange,
  onOpenDrawer,
  onRowUpdate,
  onStepsUpdate,
  columnVisibilityModel,
  onColumnVisibilityChange,
  onColumnWidthChange,
  onColumnOrderChange,
  filterModel,
  onFilterModelChange,
  columnOrder,
  columnWidths,
  slots,
  slotProps,
  selectedRunId,
  onStepStatusChange,
  rowReordering = false,
  onRowOrderChange,
}: TestCaseDataGridProps) {
  const apiRef = useGridApiRef();

  const getDetailPanelContent = useCallback(
    (params: GridRowParams<TestCaseRow>) => {
      const row = params.row;
      if (row.treePath && row.treePath.length === 1) return null;
      const hasSteps = row.test_steps && row.test_steps.length > 0;
      if (!hasSteps && !canWrite) return null;
      return (
        <StepDetailPanel
          steps={row.test_steps ?? []}
          platforms={(row.platform_tags?.length > 0 ? row.platform_tags : ['desktop']) as Platform[]}
          canWrite={canWrite}
          selectedRunId={selectedRunId}
          testCaseId={row.id}
          onStatusChange={onStepStatusChange ? (stepId, platform, status) => onStepStatusChange(row.id, stepId, platform, status) : undefined}
          onStepsUpdate={onStepsUpdate}
        />
      );
    },
    [canWrite, selectedRunId, onStepStatusChange, onStepsUpdate],
  );

  const getDetailPanelHeight = useCallback(
    (params: GridRowParams<TestCaseRow>) => {
      const stepCount = params.row.test_steps?.length ?? 0;
      if (stepCount === 0 && !canWrite) return 0;
      const headerRow = 44;
      const addButtonRow = canWrite ? 44 : 0;
      const contentHeight = headerRow + Math.max(stepCount, 0) * 44 + addButtonRow;
      return Math.max(contentHeight, 200);
    },
    [canWrite],
  );

  const processRowUpdate = useCallback(
    async (newRow: TestCaseRow, oldRow: TestCaseRow) => {
      if (!onRowUpdate) return oldRow;

      const updates: Partial<TestCase> = {};
      if (newRow.title !== oldRow.title) updates.title = newRow.title;
      if (newRow.description !== oldRow.description) updates.description = newRow.description;
      if (newRow.precondition !== oldRow.precondition) updates.precondition = newRow.precondition;
      if (newRow.automation_status !== oldRow.automation_status)
        updates.automation_status = newRow.automation_status;
      if (newRow.priority !== oldRow.priority) updates.priority = newRow.priority;
      if (newRow.category !== oldRow.category) updates.category = newRow.category;
      if (newRow.type !== oldRow.type) updates.type = newRow.type;
      if (JSON.stringify(newRow.platform_tags) !== JSON.stringify(oldRow.platform_tags))
        updates.platform_tags = newRow.platform_tags;
      if (JSON.stringify(newRow.tags) !== JSON.stringify(oldRow.tags))
        updates.tags = newRow.tags;

      if (Object.keys(updates).length === 0) return oldRow;

      const result = await onRowUpdate(newRow.id, updates);
      return result ?? oldRow;
    },
    [onRowUpdate],
  );

  const columns = useMemo<GridColDef<TestCaseRow>[]>(() => {
    const cols: GridColDef<TestCaseRow>[] = [
      {
        field: 'display_id',
        headerName: 'ID',
        width: columnWidths?.display_id ?? 110,
        sortable: true,
        filterable: false,
        renderCell: (params: GridRenderCellParams<TestCaseRow>) => {
          if (!params.value) return null;
          return (
            <Chip
              label={params.value}
              size="small"
              variant="outlined"
              sx={{
                height: 22,
                fontSize: '0.7rem',
                fontWeight: 600,
                fontFamily: 'monospace',
              }}
            />
          );
        },
      },
      {
        field: 'title',
        headerName: 'Title',
        flex: 1,
        minWidth: 200,
        width: columnWidths?.title,
        sortable: true,
        editable: canWrite,
        renderCell: (params: GridRenderCellParams<TestCaseRow>) => (
          <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: '52px' }}>
            {params.value}
          </Typography>
        ),
      },
      {
        field: 'automation_status',
        headerName: 'Automation',
        width: columnWidths?.automation_status ?? 140,
        sortable: true,
        editable: canWrite,
        type: 'singleSelect',
        valueOptions: AUTOMATION_OPTIONS,
        renderCell: (params: GridRenderCellParams<TestCaseRow>) => {
          if (!params.value) return null;
          return <AutomationBadge status={params.value as AutomationStatus} />;
        },
      },
      {
        field: 'platform_tags',
        headerName: 'Platforms',
        width: columnWidths?.platform_tags ?? 180,
        sortable: false,
        filterable: false,
        editable: canWrite,
        renderCell: (params: GridRenderCellParams<TestCaseRow>) => (
          <PlatformChips platforms={(params.value as Platform[]) ?? []} />
        ),
        renderEditCell: (params) => <PlatformTagsEditCell {...params} />,
      },
      {
        field: 'platform_status',
        headerName: 'Execution Status',
        width: columnWidths?.platform_status ?? 200,
        sortable: false,
        filterable: false,
        renderCell: (params: GridRenderCellParams<TestCaseRow>) => {
          const status = params.row.platform_status;
          if (!status || Object.keys(status).length === 0) return null;
          return <CombinedStatusDisplay platformStatus={status} />;
        },
      },
      {
        field: 'priority',
        headerName: 'Priority',
        width: columnWidths?.priority ?? 100,
        sortable: true,
        editable: canWrite,
        type: 'singleSelect',
        valueOptions: PRIORITY_OPTIONS,
        valueGetter: (value: string | null) => value ?? '',
        valueSetter: (value: string, row: TestCaseRow) => ({ ...row, priority: (value || null) as TestCaseRow['priority'] }),
        renderCell: (params: GridRenderCellParams<TestCaseRow>) => {
          const val = params.value as Priority | null;
          if (!val) return null;
          return (
            <Chip
              label={val.charAt(0).toUpperCase() + val.slice(1)}
              size="small"
              sx={{
                height: 22,
                fontSize: '0.65rem',
                fontWeight: 600,
                bgcolor: alpha(PRIORITY_COLORS[val], 0.15),
                color: PRIORITY_COLORS[val],
              }}
            />
          );
        },
      },
      {
        field: 'category',
        headerName: 'Category',
        width: columnWidths?.category ?? 120,
        sortable: true,
        editable: canWrite,
        type: 'singleSelect',
        valueOptions: CATEGORY_OPTIONS,
        valueGetter: (value: string | null) => value ?? '',
        valueSetter: (value: string, row: TestCaseRow) => ({ ...row, category: (value || null) as TestCaseRow['category'] }),
        renderCell: (params: GridRenderCellParams<TestCaseRow>) => {
          const val = params.value as TestCaseCategory | null;
          if (!val) return null;
          const color = CATEGORY_COLORS[val] ?? palette.neutral.main;
          return (
            <Chip
              label={val.charAt(0).toUpperCase() + val.slice(1)}
              size="small"
              sx={{
                height: 22,
                fontSize: '0.65rem',
                fontWeight: 600,
                bgcolor: alpha(color, 0.15),
                color,
              }}
            />
          );
        },
      },
      {
        field: 'type',
        headerName: 'Type',
        width: columnWidths?.type ?? 110,
        sortable: true,
        editable: canWrite,
        type: 'singleSelect',
        valueOptions: TYPE_OPTIONS,
        renderCell: (params: GridRenderCellParams<TestCaseRow>) => {
          if (!params.value) return null;
          const label = params.value === 'functional' ? 'Functional' : 'Performance';
          return (
            <Chip
              label={label}
              size="small"
              variant="outlined"
              sx={{ height: 22, fontSize: '0.65rem', fontWeight: 600 }}
            />
          );
        },
      },
      {
        field: 'tags',
        headerName: 'Tags',
        width: columnWidths?.tags ?? 160,
        sortable: false,
        filterable: false,
        editable: canWrite,
        renderCell: (params: GridRenderCellParams<TestCaseRow>) => {
          const tags = (params.value as string[]) ?? [];
          if (tags.length === 0) return null;
          return (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {tags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.6rem' }}
                />
              ))}
            </Box>
          );
        },
        renderEditCell: (params) => <TagsEditCell {...params} />,
      },
      {
        field: 'description',
        headerName: 'Description',
        width: columnWidths?.description ?? 180,
        sortable: false,
        editable: canWrite,
        valueGetter: (value: string | null) => value ?? '',
        valueSetter: (value: string, row: TestCaseRow) => ({ ...row, description: value || null }),
        renderCell: (params: GridRenderCellParams<TestCaseRow>) => {
          const val = params.value as string | null;
          if (!val) return <Typography variant="caption" sx={{ color: 'text.disabled' }}>--</Typography>;
          return (
            <Typography variant="caption" sx={{ fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {val}
            </Typography>
          );
        },
        renderEditCell: (params) => <TextPopoverEditCell {...params} />,
      },
      {
        field: 'precondition',
        headerName: 'Precondition',
        width: columnWidths?.precondition ?? 160,
        sortable: false,
        editable: canWrite,
        valueGetter: (value: string | null) => value ?? '',
        valueSetter: (value: string, row: TestCaseRow) => ({ ...row, precondition: value || null }),
        renderCell: (params: GridRenderCellParams<TestCaseRow>) => {
          const val = params.value as string | null;
          if (!val) return <Typography variant="caption" sx={{ color: 'text.disabled' }}>--</Typography>;
          return (
            <Typography variant="caption" sx={{ fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {val}
            </Typography>
          );
        },
        renderEditCell: (params) => <TextPopoverEditCell {...params} />,
      },
      {
        field: 'updated_at',
        headerName: 'Updated',
        width: columnWidths?.updated_at ?? 120,
        sortable: true,
        filterable: false,
        valueFormatter: (value: string) => {
          if (!value) return '';
          return new Date(value).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
        },
      },
    ];

    if (onOpenDrawer) {
      cols.push({
        field: 'actions',
        headerName: '',
        width: 50,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        disableReorder: true,
        renderCell: (params: GridRenderCellParams<TestCaseRow>) => {
          if (params.row.treePath && params.row.treePath.length === 1) return null;
          return (
            <Tooltip title="Open in drawer">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDrawer(params.row);
                }}
                sx={{ color: 'text.secondary', '&:hover': { color: palette.primary.main } }}
              >
                <OpenInNewIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          );
        },
      });
    }

    if (columnOrder && columnOrder.length > 0) {
      const orderMap = new Map(columnOrder.map((field, idx) => [field, idx]));
      cols.sort((a, b) => {
        const aIdx = orderMap.get(a.field) ?? 999;
        const bIdx = orderMap.get(b.field) ?? 999;
        return aIdx - bIdx;
      });
    }

    return cols;
  }, [canWrite, columnOrder, columnWidths, onOpenDrawer]);

  const groupingColDef = useMemo<GridGroupingColDefOverride<TestCaseRow>>(
    () => ({
      headerName: 'Suite',
      width: 250,
      renderCell: (params) => {
        const row = params.row as TestCaseRow;
        if (params.rowNode.type === 'group') {
          const colorIndex = row.suite_color_index ?? 0;
          const suiteColor = semanticColors.suiteColors[colorIndex % 5];
          const childCount = params.rowNode.children?.length ?? 0;
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
              <Box
                sx={{
                  width: 4,
                  height: 28,
                  borderRadius: 1,
                  bgcolor: suiteColor,
                  flexShrink: 0,
                }}
              />
              <Chip
                label={row.suite_prefix ?? ''}
                size="small"
                sx={{
                  height: 22,
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  bgcolor: alpha(suiteColor, 0.15),
                  color: suiteColor,
                }}
              />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {row.suite_name ?? params.rowNode.groupingKey ?? ''}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', ml: 'auto' }}>
                {childCount} test{childCount !== 1 ? 's' : ''}
              </Typography>
            </Box>
          );
        }
        return null;
      },
    }),
    [],
  );

  const getTreeDataPath = useCallback(
    (row: TestCaseRow) => row.treePath ?? [row.display_id],
    [],
  );

  const handleSelectionChange = useCallback(
    (model: GridRowSelectionModel) => {
      if (onSelectionChange) {
        onSelectionChange(Array.from(model.ids).map(String));
      }
    },
    [onSelectionChange],
  );

  const treeRows = useMemo(() => {
    if (!treeData) return rows;

    const suiteMap = new Map<string, TestCaseRow>();
    const result: TestCaseRow[] = [];

    for (const row of rows) {
      const suiteName = row.suite_name ?? 'Unknown Suite';

      if (!suiteMap.has(suiteName)) {
        const suiteRow: TestCaseRow = {
          ...row,
          id: `suite-${row.suite_id}`,
          display_id: '',
          title: suiteName,
          treePath: [suiteName],
        };
        suiteMap.set(suiteName, suiteRow);
        result.push(suiteRow);
      }

      result.push({
        ...row,
        treePath: [suiteName, row.display_id],
      });
    }

    return result;
  }, [rows, treeData]);

  const isGroupSelectableRow = useCallback(
    (row: TestCaseRow) => !row.treePath || row.treePath.length > 1,
    [],
  );

  return (
    <Box
      sx={{
        width: '100%',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '8px',
        bgcolor: 'background.paper',
        overflow: 'hidden',
        '& .MuiDataGrid-root': {
          border: 'none',
          '--DataGrid-containerBackground': palette.background.surface2,
        },
        '& .MuiDataGrid-columnHeaders': {
          bgcolor: palette.background.surface2,
          borderBottom: `1px solid ${alpha(palette.neutral.main, 0.15)}`,
        },
        '& .MuiDataGrid-columnHeaderTitle': {
          fontWeight: 600,
          fontSize: '0.75rem',
          color: palette.text.secondary,
        },
        '& .MuiDataGrid-cell': {
          borderBottom: `1px solid ${alpha(palette.neutral.main, 0.1)}`,
          display: 'flex',
          alignItems: 'center',
        },
        '& .MuiDataGrid-row': {
          transition: 'background-color 0.15s, border-color 0.15s',
          borderLeft: '3px solid transparent',
          '&:hover': {
            bgcolor: alpha(palette.primary.main, 0.08),
            borderLeft: `3px solid ${alpha(palette.primary.main, 0.3)}`,
          },
          '&.Mui-selected': {
            bgcolor: alpha(palette.primary.main, 0.15),
            borderLeft: `3px solid ${palette.primary.main}`,
            '&:hover': {
              bgcolor: alpha(palette.primary.main, 0.2),
            },
          },
        },
        '& .MuiDataGrid-row--treeDataGroup': {
          bgcolor: alpha(palette.background.surface2, 0.5),
          '&:hover': {
            bgcolor: alpha(palette.background.surface3, 0.7),
            borderLeft: '3px solid transparent',
          },
        },
        '& .MuiDataGrid-columnSeparator': {
          color: alpha(palette.primary.main, 0.3),
          '&:hover': {
            color: palette.primary.main,
          },
        },
        '& .MuiDataGrid-sortIcon': {
          color: palette.primary.main,
        },
        '& .MuiDataGrid-menuIcon': {
          color: palette.text.secondary,
        },
        '& .MuiDataGrid-footerContainer': {
          borderTop: `1px solid ${alpha(palette.neutral.main, 0.15)}`,
        },
        '& .MuiDataGrid-overlay': {
          bgcolor: alpha(palette.background.default, 0.7),
        },
      }}
    >
      <DataGridPro
        apiRef={apiRef}
        rows={treeRows}
        columns={columns}
        loading={loading}
        autoHeight
        rowHeight={52}
        columnHeaderHeight={44}
        disableColumnMenu={false}
        disableColumnReorder={false}
        checkboxSelection={canWrite}
        disableRowSelectionOnClick
        rowSelectionModel={{ type: 'include', ids: new Set(selectedIds ?? []) }}
        onRowSelectionModelChange={handleSelectionChange}
        isRowSelectable={(params) => isGroupSelectableRow(params.row)}
        processRowUpdate={processRowUpdate}
        onProcessRowUpdateError={(error) => console.error('Row update error:', error)}
        isCellEditable={(params) => canWrite && (!params.row.treePath || params.row.treePath.length > 1)}
        columnVisibilityModel={columnVisibilityModel}
        onColumnVisibilityModelChange={onColumnVisibilityChange}
        onColumnWidthChange={onColumnWidthChange}
        onColumnOrderChange={onColumnOrderChange}
        filterModel={filterModel}
        onFilterModelChange={onFilterModelChange}
        treeData={treeData}
        getTreeDataPath={treeData ? getTreeDataPath : undefined}
        groupingColDef={treeData ? groupingColDef : undefined}
        defaultGroupingExpansionDepth={-1}
        getDetailPanelContent={getDetailPanelContent}
        getDetailPanelHeight={getDetailPanelHeight}
        rowReordering={rowReordering}
        onRowOrderChange={onRowOrderChange}
        slots={slots}
        slotProps={slotProps}
        initialState={{
          sorting: {
            sortModel: [{ field: rowReordering ? 'position' : 'display_id', sort: 'asc' }],
          },
        }}
        sx={{
          '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': {
            outline: `2px solid ${palette.primary.main}`,
            outlineOffset: -2,
          },
          '& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within': {
            outline: 'none',
          },
          ...(rowReordering && {
            '& .MuiDataGrid-rowReorderCell': {
              color: palette.text.disabled,
              '&:hover': { color: palette.text.secondary },
            },
          }),
        }}
      />
    </Box>
  );
}
