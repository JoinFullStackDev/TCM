'use client';

import { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import {
  DataGridPro,
  GridToolbarContainer,
  GridToolbarColumnsButton,
  GridToolbarFilterButton,
  type GridColDef,
  type GridRenderCellParams,
  type GridEventListener,
} from '@mui/x-data-grid-pro';
import { alpha } from '@mui/material/styles';
import { palette, semanticColors } from '@/theme/palette';
import TestRunStatusBadge from './TestRunStatusBadge';
import type { TestRunStatus } from '@/types/database';

interface RunCounts {
  total: number;
  pass: number;
  fail: number;
  blocked: number;
  skip: number;
  not_run: number;
}

export interface RunRow {
  id: string;
  name: string;
  status: TestRunStatus;
  project_id: string;
  start_date: string | null;
  due_date: string | null;
  is_automated: boolean;
  created_at?: string;
  projects: { name: string } | null;
  suites: { name: string; prefix: string } | null;
  assignee: { full_name: string; avatar_url: string | null } | null;
  counts: RunCounts;
}

interface TestRunDataGridProps {
  rows: RunRow[];
  loading: boolean;
  canDelete: boolean;
  onDelete: (id: string) => void;
}

const STATUS_OPTIONS = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'aborted', label: 'Aborted' },
];

function Toolbar() {
  return (
    <GridToolbarContainer sx={{ px: 2, py: 1, gap: 1 }}>
      <GridToolbarColumnsButton />
      <GridToolbarFilterButton />
    </GridToolbarContainer>
  );
}

function ProgressBar({ counts }: { counts: RunCounts }) {
  const total = counts.total || 1;
  const passRate = Math.round((counts.pass / total) * 100);

  if (counts.total === 0) {
    return (
      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
        No cases
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          height: 6,
          borderRadius: 3,
          overflow: 'hidden',
          bgcolor: alpha(palette.neutral.main, 0.15),
        }}
      >
        {counts.pass > 0 && (
          <Box sx={{ width: `${(counts.pass / total) * 100}%`, bgcolor: semanticColors.executionStatus.pass }} />
        )}
        {counts.fail > 0 && (
          <Box sx={{ width: `${(counts.fail / total) * 100}%`, bgcolor: semanticColors.executionStatus.fail }} />
        )}
        {counts.blocked > 0 && (
          <Box sx={{ width: `${(counts.blocked / total) * 100}%`, bgcolor: semanticColors.executionStatus.blocked }} />
        )}
        {counts.skip > 0 && (
          <Box sx={{ width: `${(counts.skip / total) * 100}%`, bgcolor: semanticColors.executionStatus.skip }} />
        )}
        {counts.not_run > 0 && (
          <Box sx={{ width: `${(counts.not_run / total) * 100}%`, bgcolor: semanticColors.executionStatus.not_run }} />
        )}
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap', minWidth: 64 }}>
        {passRate}% · {counts.total}
      </Typography>
    </Box>
  );
}

export default function TestRunDataGrid({ rows, loading, canDelete, onDelete }: TestRunDataGridProps) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      onDelete(deleteTarget.id);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, onDelete]);

  const handleRowClick: GridEventListener<'rowClick'> = useCallback(
    (params, event) => {
      const target = event.target as HTMLElement;
      if (target.closest('button') || target.closest('[role="button"]')) return;
      router.push(`/runs/${params.id}`);
    },
    [router],
  );

  const columns = useMemo<GridColDef<RunRow>[]>(() => {
    const cols: GridColDef<RunRow>[] = [
      {
        field: 'name',
        headerName: 'Name',
        flex: 1,
        minWidth: 200,
        sortable: true,
        renderCell: (params: GridRenderCellParams<RunRow>) => (
          <Typography
            variant="body2"
            sx={{
              fontWeight: 500,
              lineHeight: '52px',
              cursor: 'pointer',
              '&:hover': { color: palette.primary.light },
            }}
          >
            {params.value}
          </Typography>
        ),
      },
      {
        field: 'projectName',
        headerName: 'Project',
        width: 160,
        sortable: true,
        valueGetter: (_value: unknown, row: RunRow) => row.projects?.name ?? '',
        renderCell: (params: GridRenderCellParams<RunRow>) => (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {params.value || '--'}
          </Typography>
        ),
      },
      {
        field: 'suiteName',
        headerName: 'Suite',
        width: 140,
        sortable: true,
        valueGetter: (_value: unknown, row: RunRow) => row.suites?.name ?? '',
        renderCell: (params: GridRenderCellParams<RunRow>) => (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {params.value || '--'}
          </Typography>
        ),
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 130,
        sortable: true,
        type: 'singleSelect',
        valueOptions: STATUS_OPTIONS,
        renderCell: (params: GridRenderCellParams<RunRow>) => (
          <TestRunStatusBadge status={params.value as TestRunStatus} />
        ),
      },
      {
        field: 'assigneeName',
        headerName: 'Assignee',
        width: 160,
        sortable: true,
        valueGetter: (_value: unknown, row: RunRow) => row.assignee?.full_name ?? '',
        renderCell: (params: GridRenderCellParams<RunRow>) => {
          const assignee = params.row.assignee;
          if (!assignee) {
            return (
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                Unassigned
              </Typography>
            );
          }
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar src={assignee.avatar_url ?? undefined} sx={{ width: 22, height: 22, fontSize: '0.6rem' }}>
                {assignee.full_name[0]}
              </Avatar>
              <Typography variant="body2">{assignee.full_name}</Typography>
            </Box>
          );
        },
      },
      {
        field: 'progress',
        headerName: 'Progress',
        width: 180,
        sortable: false,
        filterable: false,
        renderCell: (params: GridRenderCellParams<RunRow>) => (
          <ProgressBar counts={params.row.counts} />
        ),
      },
      {
        field: 'is_automated',
        headerName: 'Automated',
        width: 110,
        sortable: true,
        type: 'boolean',
        renderCell: (params: GridRenderCellParams<RunRow>) =>
          params.value ? (
            <Chip
              icon={<SmartToyOutlinedIcon sx={{ fontSize: 14 }} />}
              label="Auto"
              size="small"
              sx={{
                height: 22,
                fontSize: '0.6rem',
                fontWeight: 600,
                bgcolor: alpha(palette.info.main, 0.15),
                color: palette.info.main,
                '& .MuiChip-icon': { color: palette.info.main },
              }}
            />
          ) : null,
      },
      {
        field: 'start_date',
        headerName: 'Start Date',
        width: 120,
        sortable: true,
        filterable: false,
        valueFormatter: (value: string | null) => {
          if (!value) return '';
          return new Date(value).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
        },
      },
      {
        field: 'due_date',
        headerName: 'Due Date',
        width: 120,
        sortable: true,
        filterable: false,
        valueFormatter: (value: string | null) => {
          if (!value) return '';
          return new Date(value).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
        },
      },
    ];

    if (canDelete) {
      cols.push({
        field: 'actions',
        headerName: '',
        width: 50,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        disableReorder: true,
        renderCell: (params: GridRenderCellParams<RunRow>) => (
          <Tooltip title="Delete run">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget({ id: params.row.id, name: params.row.name });
              }}
              sx={{ color: 'text.secondary', '&:hover': { color: palette.error.main } }}
            >
              <DeleteOutlineIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        ),
      });
    }

    return cols;
  }, [canDelete]);

  return (
    <>
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
            cursor: 'pointer',
            transition: 'background-color 0.15s, border-color 0.15s',
            borderLeft: '3px solid transparent',
            '&:hover': {
              bgcolor: alpha(palette.primary.main, 0.08),
              borderLeft: `3px solid ${alpha(palette.primary.main, 0.3)}`,
            },
          },
          '& .MuiDataGrid-columnSeparator': {
            color: alpha(palette.primary.main, 0.3),
            '&:hover': { color: palette.primary.main },
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
          rows={rows}
          columns={columns}
          loading={loading}
          autoHeight
          rowHeight={52}
          columnHeaderHeight={44}
          disableRowSelectionOnClick
          disableColumnReorder={false}
          onRowClick={handleRowClick}
          pagination
          paginationModel={{ page: 0, pageSize: 25 }}
          pageSizeOptions={[10, 25, 50]}
          slots={{ toolbar: Toolbar }}
          initialState={{
            sorting: {
              sortModel: [{ field: 'start_date', sort: 'desc' }],
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
          }}
        />
      </Box>

      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete Test Run</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This will also
            remove all associated execution results and cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained" disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
