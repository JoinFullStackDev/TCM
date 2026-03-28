'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import NextLink from 'next/link';
import { alpha } from '@mui/material/styles';
import type { GridColumnVisibilityModel, GridEventListener, GridRowOrderChangeParams } from '@mui/x-data-grid-pro';
import PageTransition from '@/components/animations/PageTransition';
import TestCaseDataGrid, { type TestCaseRow } from '@/components/test-cases/TestCaseDataGrid';
import TestCaseDrawer from '@/components/test-cases/TestCaseDrawer';
import BulkEditToolbar, { type BulkEditUpdates } from '@/components/test-cases/BulkEditToolbar';
import GridFilterBar, { type FilterValues } from '@/components/test-cases/GridFilterBar';
import GridToolbar, { type SaveStatus, type TestRunOption } from '@/components/test-cases/GridToolbar';
import EmptyState from '@/components/common/EmptyState';
import { useAuth } from '@/components/providers/AuthProvider';
import { semanticColors } from '@/theme/palette';
import type { Project, Suite, TestCase, ExecutionStatus, Platform } from '@/types/database';

interface ColumnConfig {
  columnOrder?: string[];
  columnWidths?: Record<string, number>;
  columnVisibility?: Record<string, boolean>;
}

export default function SuiteViewPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const suiteId = params.suiteId as string;
  const { can, isLoading: authLoading } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [suite, setSuite] = useState<Suite | null>(null);
  const [reorderVersion, setReorderVersion] = useState<number | undefined>(undefined);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reorderInFlightRef = useRef(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTestCaseId, setDrawerTestCaseId] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState(false);

  const [columnConfig, setColumnConfig] = useState<ColumnConfig>({});
  const [columnVisibility, setColumnVisibility] = useState<GridColumnVisibilityModel>({});
  const persistRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [runs, setRuns] = useState<TestRunOption[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

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
  const readOnly = !canWrite;

  const fetchProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}`);
    if (res.ok) setProject(await res.json());
    else router.push('/');
  }, [projectId, router]);

  const fetchSuite = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/suites/${suiteId}`);
    if (res.ok) {
      const data = await res.json();
      setSuite(data);
      setReorderVersion(data.reorder_version ?? 0);
    } else {
      router.push(`/projects/${projectId}`);
    }
  }, [projectId, suiteId, router]);

  const fetchTestCases = useCallback(async () => {
    let url = `/api/test-cases?suite_id=${suiteId}&include_status=true&include_steps=true`;
    if (selectedRunId) url += `&run_id=${selectedRunId}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      setTestCases(Array.isArray(data) ? data : []);
    }
  }, [suiteId, selectedRunId]);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch(`/api/test-runs?project_id=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setRuns((data ?? []).map((r: { id: string; name: string }) => ({ id: r.id, name: r.name })));
      }
    } catch { /* silent */ }
  }, [projectId]);

  const fetchPreferences = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/grid-preferences?project_id=${projectId}&suite_id=${suiteId}`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.column_config) {
          const cfg = data.column_config as ColumnConfig;
          setColumnConfig(cfg);
          if (cfg.columnVisibility) {
            setColumnVisibility(cfg.columnVisibility);
          }
        }
      }
    } catch {
      // use defaults
    }
  }, [projectId, suiteId]);

  useEffect(() => {
    if (!authLoading) {
      Promise.all([
        fetchProject(),
        fetchSuite(),
        fetchTestCases(),
        fetchPreferences(),
        fetchRuns(),
      ]).finally(() => setLoading(false));
    }
  }, [authLoading, fetchProject, fetchSuite, fetchTestCases, fetchPreferences, fetchRuns]);

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
            body: JSON.stringify({
              project_id: projectId,
              suite_id: suiteId,
              column_config: cfg,
            }),
          });
        } catch {
          // silent
        }
      }, 500);
    },
    [projectId, suiteId],
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

  const handleRunChange = useCallback((runId: string | null) => {
    setSelectedRunId(runId);
  }, []);

  useEffect(() => {
    fetchTestCases();
  }, [selectedRunId, fetchTestCases]);

  const handleStepStatusChange = useCallback(async (testCaseId: string, stepId: string, platform: Platform, status: ExecutionStatus) => {
    if (!selectedRunId) return;
    await fetch(`/api/test-runs/${selectedRunId}/results`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        results: [{ test_case_id: testCaseId, test_step_id: stepId, platform, browser: 'default', status }],
      }),
    });
    fetchTestCases();
  }, [selectedRunId, fetchTestCases]);

  const handleRowClick = (tc: TestCaseRow) => {
    setDrawerTestCaseId(tc.id);
    setCreateMode(false);
    setDrawerOpen(true);
  };

  const handleCreate = () => {
    setDrawerTestCaseId(null);
    setCreateMode(true);
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setDrawerTestCaseId(null);
    setCreateMode(false);
  };

  const handleSaved = () => {
    handleDrawerClose();
    fetchTestCases();
  };

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
        fetchTestCases();
      }
    } catch {
      // silent
    }
  };

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
        setTestCases((prev) =>
          prev.map((tc) => (tc.id === id ? { ...tc, ...updated } : tc)),
        );
        setSaveStatus('saved');
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
        return { ...testCases.find((tc) => tc.id === id)!, ...updated };
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
        setTestCases((prev) =>
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

  const handleRowOrderChange = useCallback(
    async (params: GridRowOrderChangeParams) => {
      // Guard against MUI DataGrid Pro v8 double-fire: when the rows prop changes
      // after the optimistic update, the grid fires onRowOrderChange a second time
      // (to "normalize" the new rows), which reverts the reorder within ~200ms.
      // The ref is set before the optimistic update and cleared after the server
      // response (or on error), so any re-fire during that window is ignored.
      if (reorderInFlightRef.current) return;
      reorderInFlightRef.current = true;

      const { oldIndex, targetIndex } = params;
      // Sort by position to match the grid's rendered order (sortModel: position ASC).
      // testCases state is in fetch order which may not match position order —
      // using raw indices against the unsorted array moves the wrong item.
      const reordered = [...testCases].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(targetIndex, 0, moved);

      // Optimistic update: assign 1-based positions immediately
      setTestCases(reordered.map((tc, i) => ({ ...tc, position: i + 1 })));

      try {
        const res = await fetch(`/api/suites/${suiteId}/test-cases/reorder`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ids: reordered.map((tc) => tc.id),
            version: reorderVersion,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          // Update local version for next optimistic concurrency check
          if (data.version !== undefined) setReorderVersion(data.version);
          // Sync server's authoritative positions and display_ids
          if (data.items) {
            const posMap = new Map<string, { position: number; display_id: string }>(
              (data.items as Array<{ id: string; position: number; display_id: string }>).map(
                (it) => [it.id, { position: it.position, display_id: it.display_id }],
              ),
            );
            setTestCases((prev) =>
              prev.map((tc) => {
                const update = posMap.get(tc.id);
                if (!update) return tc;
                return { ...tc, position: update.position, display_id: update.display_id };
              }),
            );
          }
        } else if (res.status === 409) {
          // Conflict — reload from server
          fetchTestCases();
        } else {
          fetchTestCases();
        }
      } catch {
        fetchTestCases();
      } finally {
        reorderInFlightRef.current = false;
      }
    },
    [testCases, suiteId, fetchTestCases, reorderVersion],
  );

  const filteredTestCases = useMemo(() => {
    return testCases.filter((tc) => {
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
        const ps = (tc as unknown as TestCaseRow).platform_status;
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
  }, [testCases, filters]);

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    testCases.forEach((tc) => tc.tags?.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [testCases]);

  if (authLoading || loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!project || !suite) return null;

  const suiteColor = semanticColors.suiteColors[suite.color_index % 5];

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
          <Link
            component={NextLink}
            href={`/projects/${projectId}`}
            underline="hover"
            color="text.secondary"
            fontSize="0.875rem"
          >
            {project.name}
          </Link>
          <Typography fontSize="0.875rem" color="text.primary">
            {suite.name}
          </Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <IconButton
            onClick={() => router.push(`/projects/${projectId}`)}
            size="small"
            sx={{ color: 'text.secondary' }}
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Chip
            label={suite.prefix}
            size="small"
            sx={{
              fontWeight: 700,
              fontSize: '0.75rem',
              bgcolor: alpha(suiteColor, 0.15),
              color: suiteColor,
            }}
          />
          <Typography variant="h4" sx={{ fontWeight: 700, flex: 1 }}>
            {suite.name}
          </Typography>
          {canWrite && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreate}
            >
              New Test Case
            </Button>
          )}
        </Box>

        {suite.description && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
            {suite.description}
          </Typography>
        )}

        {testCases.length === 0 && !loading ? (
          <EmptyState
            icon={<ScienceOutlinedIcon sx={{ fontSize: 32 }} />}
            title="No test cases yet"
            description={`Create your first test case in the "${suite.name}" suite. It will automatically get the ID ${suite.prefix}-1.`}
            actionLabel="New Test Case"
            onAction={handleCreate}
            showAction={canWrite}
          />
        ) : (
          <Box>
            <GridFilterBar
              filters={filters}
              onFiltersChange={setFilters}
              availableTags={availableTags}
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
                onBulkTrash={async () => {
                  if (selectedIds.length === 0) return;
                  // Check if any selected cases are automated — show confirmation if so
                  const automatedCount = testCases.filter(
                    (tc) => selectedIds.includes(tc.id) && tc.automation_status === 'in_cicd',
                  ).length;
                  if (automatedCount > 0) {
                    const confirmed = window.confirm(
                      `${automatedCount} of the selected test case${automatedCount > 1 ? 's are' : ' is'} used in automation. Archiving may break your CI/CD pipeline. Continue?`,
                    );
                    if (!confirmed) return;
                  }
                  const res = await fetch('/api/test-cases/bulk?action=delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: selectedIds }),
                  });
                  if (res.ok) {
                    setSelectedIds([]);
                    fetchTestCases();
                  }
                }}
              />
            )}

            <TestCaseDataGrid
              rows={filteredTestCases}
              canWrite={canWrite}
              loading={loading}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onOpenDrawer={handleRowClick}
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
              rowReordering={canWrite}
              onRowOrderChange={handleRowOrderChange}
              slots={{ toolbar: GridToolbar }}
              slotProps={{ toolbar: { saveStatus, runs, selectedRunId, onRunChange: handleRunChange } }}
            />
          </Box>
        )}

        <TestCaseDrawer
          open={drawerOpen}
          testCaseId={drawerTestCaseId}
          suiteId={suiteId}
          projectId={projectId}
          createMode={createMode}
          readOnly={readOnly}
          onClose={handleDrawerClose}
          onSaved={handleSaved}
          onTrashed={() => { handleDrawerClose(); fetchTestCases(); }}
        />
      </Box>
    </PageTransition>
  );
}
