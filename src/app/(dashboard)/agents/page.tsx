'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import RefreshIcon from '@mui/icons-material/Refresh';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import PageTransition from '@/components/animations/PageTransition';
import AgentFilterBar from '@/components/agents/AgentFilterBar';
import AgentRunRow from '@/components/agents/AgentRunRow';
import { useAgentRuns, groupRuns } from '@/hooks/useAgentRuns';
import type { AgentRunFilters, AgentRun } from '@/types/agent-run';

function AgentsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters: AgentRunFilters = {
    agent: searchParams.get('agent') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    projectTag: searchParams.get('projectTag') ?? undefined,
    includeArchived: searchParams.get('includeArchived') === 'true',
  };

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
      <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
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

        {/* Run list */}
        {!loading && runs.length > 0 && (
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
