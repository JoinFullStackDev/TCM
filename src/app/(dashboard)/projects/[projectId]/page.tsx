'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MergeOutlinedIcon from '@mui/icons-material/CallMergeOutlined';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import NextLink from 'next/link';
import { alpha } from '@mui/material/styles';
import type { GridColumnVisibilityModel, GridEventListener } from '@mui/x-data-grid-pro';
import { palette } from '@/theme/palette';
import PageTransition from '@/components/animations/PageTransition';
import SuiteList from '@/components/suites/SuiteList';
import CreateSuiteDialog from '@/components/suites/CreateSuiteDialog';
import EditSuiteDialog from '@/components/suites/EditSuiteDialog';
import MergeSuiteDialog from '@/components/suites/MergeSuiteDialog';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import EmptyState from '@/components/common/EmptyState';
import TestCaseDataGrid, { type TestCaseRow } from '@/components/test-cases/TestCaseDataGrid';
import TestCaseDrawer from '@/components/test-cases/TestCaseDrawer';
import BulkEditToolbar, { type BulkEditUpdates } from '@/components/test-cases/BulkEditToolbar';
import GridFilterBar, { type FilterValues } from '@/components/test-cases/GridFilterBar';
import GridToolbar, { type SaveStatus, type TestRunOption } from '@/components/test-cases/GridToolbar';
import { useAuth } from '@/components/providers/AuthProvider';
import type { Project, Suite, TestCase, ExecutionStatus, Platform } from '@/types/database';

interface SuiteWithCount extends Suite {
  test_case_count: number;
}

interface ColumnConfig {
  columnOrder?: string[];
  columnWidths?: Record<string, number>;
  columnVisibility?: Record<string, boolean>;
}

type ViewMode = 'suites' | 'grid';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const { can, isLoading: authLoading } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [suites, setSuites] = useState<SuiteWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('suites');

  const [suiteGroupFilter, setSuiteGroupFilter] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editSuite, setEditSuite] = useState<Suite | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSuiteId, setDeleteSuiteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuSuite, setMenuSuite] = useState<SuiteWithCount | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeSuite, setMergeSuite] = useState<SuiteWithCount | null>(null);

  const [gridTestCases, setGridTestCases] = useState<TestCaseRow[]>([]);
  const [gridLoading, setGridLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [runs, setRuns] = useState<TestRunOption[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTestCaseId, setDrawerTestCaseId] = useState<string | null>(null);
  const [drawerSuiteId, setDrawerSuiteId] = useState<string | null>(null);

  const [columnConfig, setColumnConfig] = useState<ColumnConfig>({});
  const [columnVisibility, setColumnVisibility] = useState<GridColumnVisibilityModel>({});
  const persistRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [filters, setFilters] = useState<FilterValues>({
    automation_status: [],
    platform: [],
    priority: [],
    type: [],
    tags: [],
    execution_status: [],
    category: [],
    suite_ids: [],
  });

  const canWrite = can('write');
  const canDelete = can('delete');

  const existingGroups = useMemo(() => {
    const groups = new Set<string>();
    for (const s of suites) {
      if (s.group?.trim()) groups.add(s.group.trim());
    }
    return [...groups].sort();
  }, [suites]);

  const filteredSuites = useMemo(() => {
    if (!suiteGroupFilter) return suites;
    return suites.filter((s) => (s.group?.trim() ?? '') === suiteGroupFilter);
  }, [suites, suiteGroupFilter]);

  const fetchProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}`);
    if (res.ok) setProject(await res.json());
    else router.push('/');
  }, [projectId, router]);

  const fetchSuites = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/suites`);
    if (res.ok) setSuites(await res.json());
  }, [projectId]);

  const fetchGridTestCases = useCallback(async () => {
    setGridLoading(true);
    try {
      let url = `/api/projects/${projectId}/test-cases?include_status=true&include_steps=true`;
      if (selectedRunId) url += `&run_id=${selectedRunId}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setGridTestCases(Array.isArray(data) ? data : []);
      }
    } finally {
      setGridLoading(false);
    }
  }, [projectId, selectedRunId]);

  const fetchGridPreferences = useCallback(async () => {
    try {
      const res = await fetch(`/api/grid-preferences?project_id=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.column_config) {
          const cfg = data.column_config as ColumnConfig;
          setColumnConfig(cfg);
          if (cfg.columnVisibility) setColumnVisibility(cfg.columnVisibility);
        }
      }
    } catch {
      // use defaults
    }
  }, [projectId]);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch(`/api/test-runs?project_id=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setRuns(
          (Array.isArray(data) ? data : []).map((r: { id: string; name: string }) => ({
            id: r.id,
            name: r.name,
          })),
        );
      }
    } catch {
      // ignore
    }
  }, [projectId]);

  const handleRunChange = useCallback((runId: string | null) => {
    setSelectedRunId(runId);
  }, []);

  const handleStepStatusChange = useCallback(
    async (testCaseId: string, stepId: string, platform: Platform, status: ExecutionStatus) => {
      if (!selectedRunId) return;
      await fetch(`/api/test-runs/${selectedRunId}/results`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_case_id: testCaseId, test_step_id: stepId, platform, status }),
      });
      fetchGridTestCases();
    },
    [selectedRunId, fetchGridTestCases],
  );

  useEffect(() => {
    if (!authLoading) {
      Promise.all([fetchProject(), fetchSuites()]).finally(() => setLoading(false));
    }
  }, [authLoading, fetchProject, fetchSuites]);

  useEffect(() => {
    if (viewMode === 'grid') {
      fetchGridTestCases();
      fetchGridPreferences();
      fetchRuns();
    }
  }, [viewMode, fetchGridTestCases, fetchGridPreferences, fetchRuns]);

  useEffect(() => {
    return () => {
      if (persistRef.current) clearTimeout(persistRef.current);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const persistPreferences = useCallback(
    (cfg: ColumnConfig) => {
      if (persistRef.current) clearTimeout(persistRef.current);
      persistRef.current = setTimeout(async () => {
        try {
          await fetch('/api/grid-preferences', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_id: projectId, column_config: cfg }),
          });
        } catch {
          // silent
        }
      }, 500);
    },
    [projectId],
  );

  const handleColumnVisibilityChange = useCallback(
    (model: GridColumnVisibilityModel) => {
      setColumnVisibility(model);
      const cfg = { ...columnConfig, columnVisibility: model };
      setColumnConfig(cfg);
      persistPreferences(cfg);
    },
    [columnConfig, persistPreferences],
  );

  const handleColumnWidthChange: GridEventListener<'columnWidthChange'> = useCallback(
    (params) => {
      const widths = { ...columnConfig.columnWidths, [params.colDef.field]: params.width };
      const cfg = { ...columnConfig, columnWidths: widths };
      setColumnConfig(cfg);
      persistPreferences(cfg);
    },
    [columnConfig, persistPreferences],
  );

  const handleColumnOrderChange: GridEventListener<'columnOrderChange'> = useCallback(
    () => {
      const cfg = { ...columnConfig };
      setColumnConfig(cfg);
      persistPreferences(cfg);
    },
    [columnConfig, persistPreferences],
  );

  const handleRowUpdate = async (
    id: string,
    updates: Partial<TestCase>,
  ): Promise<TestCaseRow | null> => {
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/test-cases/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = await res.json();
        setGridTestCases((prev) =>
          prev.map((tc) => (tc.id === id ? { ...tc, ...updated } : tc)),
        );
        setSaveStatus('saved');
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
        return { ...gridTestCases.find((tc) => tc.id === id)!, ...updated };
      }
      setSaveStatus('error');
      return null;
    } catch {
      setSaveStatus('error');
      return null;
    }
  };

  const handleStepsUpdate = useCallback(async (testCaseId: string, steps: { step_number: number; description: string; test_data: string | null; expected_result: string | null; is_automation_only: boolean; category?: string | null }[]) => {
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/test-cases/${testCaseId}/steps`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps }),
      });
      if (res.ok) {
        const newSteps = await res.json();
        setGridTestCases((prev) =>
          prev.map((tc) => {
            if (tc.id !== testCaseId) return tc;
            return { ...tc, test_steps: newSteps } as TestCase;
          }),
        );
        setSaveStatus('saved');
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    }
  }, []);

  const handleBulkApply = async (updates: BulkEditUpdates) => {
    if (selectedIds.length === 0) return;
    try {
      const res = await fetch('/api/test-cases/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, updates }),
      });
      if (res.ok) {
        setSelectedIds([]);
        fetchGridTestCases();
      }
    } catch {
      // silent
    }
  };

  const handleMoveSuite = async (suiteId: string) => {
    if (selectedIds.length === 0) return;
    try {
      await Promise.all(
        selectedIds.map((id) =>
          fetch(`/api/test-cases/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ suite_id: suiteId }),
          }),
        ),
      );
      setSelectedIds([]);
      fetchGridTestCases();
      fetchSuites();
    } catch {
      // silent
    }
  };

  const handleGridRowClick = (tc: TestCaseRow) => {
    setDrawerTestCaseId(tc.id);
    setDrawerSuiteId(tc.suite_id);
    setDrawerOpen(true);
  };

  const handleReorder = async (items: { id: string; position: number }[]) => {
    const reordered = items
      .map((item) => {
        const s = suites.find((suite) => suite.id === item.id);
        return s ? { ...s, position: item.position } : null;
      })
      .filter(Boolean) as SuiteWithCount[];
    reordered.sort((a, b) => a.position - b.position);
    setSuites(reordered);

    await fetch(`/api/projects/${projectId}/suites/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, suite: SuiteWithCount) => {
    setMenuAnchor(event.currentTarget);
    setMenuSuite(suite);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setMenuSuite(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteSuiteId) return;
    setDeleteLoading(true);
    await fetch(`/api/projects/${projectId}/suites/${deleteSuiteId}`, { method: 'DELETE' });
    setDeleteLoading(false);
    setDeleteOpen(false);
    setDeleteSuiteId(null);
    fetchSuites();
  };

  const filteredGridTestCases = useMemo(() => {
    return gridTestCases.filter((tc) => {
      if (
        filters.suite_ids.length > 0 &&
        !filters.suite_ids.includes(tc.suite_id)
      )
        return false;
      if (
        filters.automation_status.length > 0 &&
        !filters.automation_status.includes(tc.automation_status)
      )
        return false;
      if (
        filters.platform.length > 0 &&
        !filters.platform.some((p) => tc.platform_tags.includes(p))
      )
        return false;
      if (
        filters.priority.length > 0 &&
        (!tc.priority || !filters.priority.includes(tc.priority))
      )
        return false;
      if (filters.type.length > 0 && !filters.type.includes(tc.type)) return false;
      if (
        filters.tags.length > 0 &&
        !filters.tags.some((t) => tc.tags.includes(t))
      )
        return false;
      if (filters.execution_status.length > 0) {
        const ps = (tc as TestCaseRow).platform_status;
        if (!ps || Object.keys(ps).length === 0) return false;
        const statuses = Object.values(ps);
        if (!filters.execution_status.some((s) => statuses.includes(s))) return false;
      }
      if (
        filters.category.length > 0 &&
        (!tc.category || !filters.category.includes(tc.category))
      )
        return false;
      return true;
    });
  }, [gridTestCases, filters]);

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    gridTestCases.forEach((tc) => tc.tags?.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [gridTestCases]);

  if (authLoading || loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!project) return null;

  return (
    <PageTransition>
      <Box>
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link
            component={NextLink}
            href="/projects"
            underline="hover"
            color="text.secondary"
            fontSize="0.875rem"
          >
            Projects
          </Link>
          <Typography fontSize="0.875rem" color="text.primary">
            {project.name}
          </Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <IconButton
            onClick={() => router.push('/')}
            size="small"
            sx={{ color: 'text.secondary' }}
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Typography variant="h4" sx={{ fontWeight: 700, flex: 1 }}>
            {project.name}
          </Typography>

          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, val) => { if (val) setViewMode(val); }}
            size="small"
          >
            <ToggleButton value="suites" sx={{ px: 1.5, py: 0.5 }}>
              <GridViewOutlinedIcon sx={{ fontSize: 18, mr: 0.5 }} />
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                Suites
              </Typography>
            </ToggleButton>
            <ToggleButton value="grid" sx={{ px: 1.5, py: 0.5 }}>
              <TableChartOutlinedIcon sx={{ fontSize: 18, mr: 0.5 }} />
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                Grid
              </Typography>
            </ToggleButton>
          </ToggleButtonGroup>

          {canWrite && (
            <Button
              variant="outlined"
              startIcon={<UploadFileOutlinedIcon />}
              onClick={() => router.push(`/projects/${projectId}/import`)}
            >
              Import CSV
            </Button>
          )}

          {canWrite && viewMode === 'suites' && (
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setCreateOpen(true)}
            >
              New Suite
            </Button>
          )}
        </Box>

        {project.description && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
            {project.description}
          </Typography>
        )}

        {viewMode === 'suites' && existingGroups.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.75, mb: 2, flexWrap: 'wrap' }}>
            <Chip
              label="All"
              size="small"
              variant={suiteGroupFilter === null ? 'filled' : 'outlined'}
              onClick={() => setSuiteGroupFilter(null)}
              sx={{
                height: 26,
                fontSize: '0.75rem',
                fontWeight: 500,
                ...(suiteGroupFilter === null && {
                  bgcolor: alpha(palette.primary.main, 0.15),
                  color: palette.primary.main,
                }),
              }}
            />
            {existingGroups.map((g) => (
              <Chip
                key={g}
                label={g}
                size="small"
                variant={suiteGroupFilter === g ? 'filled' : 'outlined'}
                onClick={() => setSuiteGroupFilter(suiteGroupFilter === g ? null : g)}
                sx={{
                  height: 26,
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  ...(suiteGroupFilter === g && {
                    bgcolor: alpha(palette.primary.main, 0.15),
                    color: palette.primary.main,
                  }),
                }}
              />
            ))}
          </Box>
        )}

        {viewMode === 'suites' && (
          <>
            {suites.length === 0 ? (
              <EmptyState
                icon={<ViewListOutlinedIcon sx={{ fontSize: 32 }} />}
                title="No suites yet"
                description="Create your first suite to start organizing test cases. Each suite has a unique prefix for test case IDs."
                actionLabel="New Suite"
                onAction={() => setCreateOpen(true)}
                showAction={canWrite}
              />
            ) : (
              <SuiteList
                suites={filteredSuites}
                projectId={projectId}
                onReorder={handleReorder}
                onMenuOpen={handleMenuOpen}
                canWrite={canWrite}
              />
            )}
          </>
        )}

        {viewMode === 'grid' && (
          <Box>
            <GridFilterBar
              filters={filters}
              onFiltersChange={setFilters}
              availableTags={availableTags}
              suites={suites.map((s) => ({ id: s.id, name: s.name, prefix: s.prefix }))}
              runs={runs}
              selectedRunId={selectedRunId}
              onRunChange={handleRunChange}
            />

            {canWrite && (
              <BulkEditToolbar
                selectedCount={selectedIds.length}
                visible={selectedIds.length > 0}
                onApply={handleBulkApply}
                onCancel={() => setSelectedIds([])}
                suites={suites.map((s) => ({ id: s.id, name: s.name, prefix: s.prefix }))}
                onMoveSuite={handleMoveSuite}
              />
            )}

            <TestCaseDataGrid
              rows={filteredGridTestCases}
              canWrite={canWrite}
              treeData
              loading={gridLoading}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onOpenDrawer={handleGridRowClick}
              onRowUpdate={handleRowUpdate}
              onStepsUpdate={handleStepsUpdate}
              columnVisibilityModel={columnVisibility}
              onColumnVisibilityChange={handleColumnVisibilityChange}
              onColumnWidthChange={handleColumnWidthChange}
              onColumnOrderChange={handleColumnOrderChange}
              columnOrder={columnConfig.columnOrder}
              columnWidths={columnConfig.columnWidths}
              selectedRunId={selectedRunId}
              onStepStatusChange={handleStepStatusChange}
              slots={{ toolbar: GridToolbar }}
              slotProps={{ toolbar: { saveStatus, runs, selectedRunId, onRunChange: handleRunChange } }}
            />
          </Box>
        )}

        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleMenuClose}>
          <MenuItem
            onClick={() => {
              if (menuSuite) {
                setEditSuite(menuSuite);
                setEditOpen(true);
              }
              handleMenuClose();
            }}
          >
            <ListItemIcon>
              <EditOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Edit</ListItemText>
          </MenuItem>
          {canDelete && suites.length > 1 && (
            <MenuItem
              onClick={() => {
                if (menuSuite) {
                  setMergeSuite(menuSuite);
                  setMergeOpen(true);
                }
                handleMenuClose();
              }}
            >
              <ListItemIcon>
                <MergeOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Merge into...</ListItemText>
            </MenuItem>
          )}
          {canDelete && (
            <MenuItem
              onClick={() => {
                if (menuSuite) {
                  setDeleteSuiteId(menuSuite.id);
                  setDeleteOpen(true);
                }
                handleMenuClose();
              }}
              sx={{ color: 'error.main' }}
            >
              <ListItemIcon>
                <DeleteOutlineIcon fontSize="small" sx={{ color: 'error.main' }} />
              </ListItemIcon>
              <ListItemText>Delete</ListItemText>
            </MenuItem>
          )}
        </Menu>

        <CreateSuiteDialog
          open={createOpen}
          projectId={projectId}
          existingGroups={existingGroups}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            fetchSuites();
            if (viewMode === 'grid') fetchGridTestCases();
          }}
        />

        <EditSuiteDialog
          open={editOpen}
          suite={editSuite}
          projectId={projectId}
          existingGroups={existingGroups}
          onClose={() => setEditOpen(false)}
          onUpdated={() => {
            fetchSuites();
            if (viewMode === 'grid') fetchGridTestCases();
          }}
        />

        <MergeSuiteDialog
          open={mergeOpen}
          sourceSuite={mergeSuite}
          projectId={projectId}
          suites={suites}
          onClose={() => {
            setMergeOpen(false);
            setMergeSuite(null);
          }}
          onMerged={() => {
            fetchSuites();
            if (viewMode === 'grid') fetchGridTestCases();
          }}
        />

        <ConfirmDialog
          open={deleteOpen}
          title="Delete Suite"
          message="This will permanently delete the suite and all its test cases, steps, and related data. This action cannot be undone."
          confirmLabel="Delete"
          destructive
          loading={deleteLoading}
          onConfirm={handleDeleteConfirm}
          onCancel={() => {
            setDeleteOpen(false);
            setDeleteSuiteId(null);
          }}
        />

        {viewMode === 'grid' && (
          <TestCaseDrawer
            open={drawerOpen}
            testCaseId={drawerTestCaseId}
            suiteId={drawerSuiteId ?? ''}
            projectId={projectId}
            createMode={false}
            readOnly={!canWrite}
            onClose={() => {
              setDrawerOpen(false);
              setDrawerTestCaseId(null);
              setDrawerSuiteId(null);
            }}
            onSaved={() => {
              setDrawerOpen(false);
              setDrawerTestCaseId(null);
              setDrawerSuiteId(null);
              fetchGridTestCases();
            }}
          />
        )}
      </Box>
    </PageTransition>
  );
}
