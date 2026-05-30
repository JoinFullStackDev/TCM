'use client';

import { Suspense, useMemo, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import RefreshIcon from '@mui/icons-material/Refresh';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import ViewListIcon from '@mui/icons-material/ViewList';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PageTransition from '@/components/animations/PageTransition';
import AgentFilterBar from '@/components/agents/AgentFilterBar';
import AgentRunRow from '@/components/agents/AgentRunRow';
import AgentKanbanBoard from '@/components/agents/AgentKanbanBoard';
import { useAgentRuns, groupRuns } from '@/hooks/useAgentRuns';
import type { AgentRunFilters, AgentRun } from '@/types/agent-run';
import type { BoardGrouping } from '@/components/agents/AgentKanbanBoard';

type ViewMode = 'list' | 'board';

const VIEW_MODE_KEY = 'agents-view-mode';
const BOARD_GROUP_KEY = 'agents-board-group';

function AgentsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // View mode — persisted in localStorage
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [boardGrouping, setBoardGrouping] = useState<BoardGrouping>('status');

  useEffect(() => {
    try {
      const storedView = localStorage.getItem(VIEW_MODE_KEY) as ViewMode | null;
      if (storedView === 'list' || storedView === 'board') setViewMode(storedView);
      const storedGroup = localStorage.getItem(BOARD_GROUP_KEY) as BoardGrouping | null;
      if (storedGroup === 'status' || storedGroup === 'agent') setBoardGrouping(storedGroup);
    } catch {
      // localStorage unavailable — use defaults
    }
  }, []);

  function handleViewModeChange(_: React.MouseEvent<HTMLElement>, value: ViewMode | null) {
    if (!value) return;
    setViewMode(value);
    try {
      localStorage.setItem(VIEW_MODE_KEY, value);
    } catch {
      // ignore
    }
  }

  function handleBoardGroupingChange(next: BoardGrouping) {
    setBoardGrouping(next);
    try {
      localStorage.setItem(BOARD_GROUP_KEY, next);
    } catch {
      // ignore
    }
  }

  const filters: AgentRunFilters = useMemo(() => ({
    agent: searchParams.get('agent') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    projectTag: searchParams.get('projectTag') ?? undefined,
    includeArchived: searchParams.get('includeArchived') === 'true',
  }), [
    searchParams.get('agent'),
    searchParams.get('status'),
    searchParams.get('projectTag'),
    searchParams.get('includeArchived'),
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  const { runs, total, loading, error, refresh } = useAgentRuns(filters);
  const { top, children } = groupRuns(runs);

  // All run IDs in the response (for orphan detection)
  const runIdSet = new Set(runs.map((r) => r.id));

  function handleFilterChange(next: AgentRunFilters) {
    const params = new URLSearchParams();
    if (next.agent) params.set('agent', next.agent);
    if (next.status) params.set('status', next.status);
    if (next.projectTag) params.set('projectTag', next.projectTag);
    if (next.includeArchived) params.set('includeArchived', 'true');
    router.push(`/agents${params.toString() ? `?${params.toString()}` : ''}`);
  }

  // Count active runs for status indicator
  const TERMINAL = new Set(['done', 'failed', 'timed_out', 'killed']);
  const activeCount = runs.filter((r) => !TERMINAL.has(r.status)).length;

  // Determine if we have orphan children (parent filtered out / archived)
  const orphanedChildren: AgentRun[] = [];
  for (const [parentId, childList] of children.entries()) {
    if (!runIdSet.has(parentId)) {
      orphanedChildren.push(...childList);
    }
  }

  return (
    <PageTransition>
      <Box sx={{ overflow: 'hidden' }}>
        <Box sx={{ px: 3, pt: 3, maxWidth: 1200, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <SmartToyOutlinedIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" fontWeight={700}>
              Agent Monitor
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Live view of FullThrottle agent runs
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {activeCount > 0 && (
              <Chip
                label={`${activeCount} active`}
                color="primary"
                size="small"
                sx={{ fontWeight: 600 }}
              />
            )}

            {/* View mode toggle */}
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={handleViewModeChange}
              size="small"
              aria-label="view mode"
            >
              <ToggleButton value="list" aria-label="list view">
                <Tooltip title="List view">
                  <ViewListIcon fontSize="small" />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="board" aria-label="board view">
                <Tooltip title="Board view">
                  <DashboardIcon fontSize="small" />
                </Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>

            <Tooltip title="Refresh now">
              <IconButton onClick={refresh} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Filter bar */}
        <AgentFilterBar filters={filters} onChange={handleFilterChange} />

        {/* Error state */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to load runs: {error}
          </Alert>
        )}

        {/* Loading state */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Empty state */}
        {!loading && runs.length === 0 && (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
              color: 'text.disabled',
            }}
          >
            <SmartToyOutlinedIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
            <Typography variant="h6" color="text.disabled">
              No agent runs found
            </Typography>
            <Typography variant="body2" color="text.disabled">
              {Object.values(filters).some(Boolean)
                ? 'Try adjusting your filters'
                : 'Runs will appear here when agents are spawned'}
            </Typography>
          </Box>
        )}

        </Box>{/* end constrained header region */}

        {/* ── Board view — full width, own horizontal scroll ─── */}
        {!loading && runs.length > 0 && viewMode === 'board' && (
          <Box sx={{ px: 3, pb: 3 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              {total} run{total !== 1 ? 's' : ''} total
              {activeCount > 0 ? ` · polling every 5s` : ` · polling every 30s`}
            </Typography>
            <AgentKanbanBoard
              runs={runs}
              childMap={children}
              grouping={boardGrouping}
              onGroupingChange={handleBoardGroupingChange}
              onAction={refresh}
            />
          </Box>
        )}

        {/* ── List view — back inside constrained box ─────────── */}
        {!loading && runs.length > 0 && viewMode === 'list' && (
          <Box sx={{ px: 3, pb: 3, maxWidth: 1200, mx: 'auto' }}>
          <>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              {total} run{total !== 1 ? 's' : ''} total
              {activeCount > 0 ? ` · polling every 5s` : ` · polling every 30s`}
            </Typography>

            <Box>
              {top.map((run) => {
                const runChildren = children.get(run.id) ?? [];
                return (
                  <Box key={run.id}>
                    <AgentRunRow run={run} onAction={refresh} />
                    {runChildren.map((child) => (
                      <AgentRunRow key={child.id} run={child} isChild onAction={refresh} />
                    ))}
                  </Box>
                );
              })}

              {/* Orphaned children (parent filtered out / archived) */}
              {orphanedChildren.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }}>
                    <Typography variant="caption" color="text.disabled">
                      Orphaned sub-sessions
                    </Typography>
                  </Divider>
                  {orphanedChildren.map((run) => (
                    <AgentRunRow key={run.id} run={run} isOrphan onAction={refresh} />
                  ))}
                </>
              )}
            </Box>
          </>
          </Box>
        )}
      </Box>
    </PageTransition>
  );
}

export default function AgentsPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <CircularProgress size={32} />
        </Box>
      }
    >
      <AgentsPageInner />
    </Suspense>
  );
}
