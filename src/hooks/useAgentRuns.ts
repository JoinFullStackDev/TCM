'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { AgentRun, AgentRunFilters } from '@/types/agent-run';

const TERMINAL_STATUSES = new Set(['done', 'failed', 'timed_out', 'killed']);

const ACTIVE_INTERVAL_MS = 5_000;
const IDLE_INTERVAL_MS = 30_000;

function buildUrl(filters: AgentRunFilters): string {
  const params = new URLSearchParams();
  if (filters.status) {
    const statusValue = filters.status === 'active'
      ? 'spawned,running,waiting'
      : filters.status;
    params.set('status', statusValue);
  }
  if (filters.agent) params.set('agent', filters.agent);
  if (filters.projectTag) params.set('projectTag', filters.projectTag);
  if (filters.includeArchived) params.set('includeArchived', 'true');
  params.set('limit', '100');
  return `/api/agent-runs?${params.toString()}`;
}

export function useAgentRuns(filters: AgentRunFilters) {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consecutiveErrorsRef = useRef(0);

  const hasActive = runs.some((r) => !TERMINAL_STATUSES.has(r.status));
  const intervalMs = hasActive ? ACTIVE_INTERVAL_MS : IDLE_INTERVAL_MS;

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch(buildUrl(filters));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!cancelledRef.current) {
        setRuns(data.runs ?? []);
        setTotal(data.total ?? 0);
        setError(null);
        consecutiveErrorsRef.current = 0;
      }
    } catch (err) {
      consecutiveErrorsRef.current += 1;
      if (consecutiveErrorsRef.current >= 3) {
        setError(err instanceof Error ? err.message : 'Failed to fetch runs');
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    cancelledRef.current = false;
    setLoading(true);

    function poll() {
      if (cancelledRef.current) return;
      if (document.hidden) {
        // Tab hidden — skip fetch, schedule next check
        timerRef.current = setTimeout(poll, intervalMs);
        return;
      }
      fetchRuns().finally(() => {
        if (!cancelledRef.current) {
          timerRef.current = setTimeout(poll, intervalMs);
        }
      });
    }

    // Immediate initial fetch
    fetchRuns().finally(() => {
      if (!cancelledRef.current) {
        timerRef.current = setTimeout(poll, intervalMs);
      }
    });

    function onVisibilityChange() {
      if (!document.hidden && !cancelledRef.current) {
        if (timerRef.current) clearTimeout(timerRef.current);
        // Resume immediately on tab focus
        fetchRuns().finally(() => {
          if (!cancelledRef.current) {
            timerRef.current = setTimeout(poll, intervalMs);
          }
        });
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelledRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [fetchRuns, intervalMs]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    fetchRuns().finally(() => {
      if (!cancelledRef.current) {
        timerRef.current = setTimeout(() => {}, intervalMs);
      }
    });
  }, [fetchRuns, intervalMs]);

  return { runs, total, loading, error, refresh };
}

// ─── Parent/child grouping ───────────────────────────────────────────────────

export interface GroupedRuns {
  top: AgentRun[];
  children: Map<string, AgentRun[]>;
}

export function groupRuns(runs: AgentRun[]): GroupedRuns {
  const childMap = new Map<string, AgentRun[]>();
  const topLevel: AgentRun[] = [];

  for (const run of runs) {
    if (run.parentRunId) {
      const siblings = childMap.get(run.parentRunId) ?? [];
      siblings.push(run);
      childMap.set(run.parentRunId, siblings);
    } else {
      topLevel.push(run);
    }
  }

  return { top: topLevel, children: childMap };
}
