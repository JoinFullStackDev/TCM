'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import StopIcon from '@mui/icons-material/Stop';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PageTransition from '@/components/animations/PageTransition';
import { palette } from '@/theme/palette';
import { useAuth } from '@/components/providers/AuthProvider';
import RunDetailDrawer from './RunDetailDrawer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type AgentRunStatus =
  | 'spawned'
  | 'running'
  | 'waiting'
  | 'done'
  | 'failed'
  | 'timed_out'
  | 'killed';

type AgentName = 'axel' | 'riff' | 'arc' | 'torque' | 'clutch';

interface AgentRun {
  id: string;
  agent: AgentName;
  brief: string;
  task_title: string | null;
  status: AgentRunStatus;
  session_key: string;
  spawned_by: string;
  slack_channel: string | null;
  slack_thread_ts: string | null;
  project_tag: string | null;
  started_at: string;
  last_heartbeat: string | null;
  ended_at: string | null;
  output_tail: string | null;
  output_truncated: boolean;
  parent_run_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ACTIVE_STATUSES: AgentRunStatus[] = ['spawned', 'running', 'waiting'];
const TERMINAL_STATUSES: AgentRunStatus[] = ['done', 'failed', 'timed_out', 'killed'];
const STALL_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

const STATUS_CONFIG: Record<
  AgentRunStatus,
  { label: string; color: string; pulse: boolean }
> = {
  spawned: { label: 'Spawned', color: '#A78BFA', pulse: true },
  running: { label: 'Running', color: '#14B8A6', pulse: true },
  waiting: { label: 'Waiting', color: '#F59E0B', pulse: true },
  done: { label: 'Done', color: '#6B7280', pulse: false },
  failed: { label: 'Failed', color: '#F43F5E', pulse: false },
  timed_out: { label: 'Timed Out', color: '#F59E0B', pulse: false },
  killed: { label: 'Killed', color: '#6B7280', pulse: false },
};

const AGENT_COLORS: Record<AgentName, string> = {
  clutch: '#6366F1',
  axel: '#14B8A6',
  riff: '#F59E0B',
  arc: '#A78BFA',
  torque: '#F43F5E',
};

function formatElapsed(startedAt: string, endedAt: string | null): string {
  const end = endedAt ? new Date(endedAt) : new Date();
  const ms = end.getTime() - new Date(startedAt).getTime();
  if (ms < 0) return '0s';
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ${secs % 60}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString();
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function StatusBadge({ status }: { status: AgentRunStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <FiberManualRecordIcon
        sx={{
          fontSize: 10,
          color: cfg.color,
          animation: cfg.pulse ? 'pulse 1.5s ease-in-out infinite' : 'none',
          '@keyframes pulse': {
            '0%, 100%': { opacity: 1 },
            '50%': { opacity: 0.3 },
          },
        }}
      />
      <Typography variant="caption" sx={{ color: cfg.color, fontWeight: 600, fontSize: '0.7rem' }}>
        {cfg.label.toUpperCase()}
      </Typography>
    </Box>
  );
}

function AgentBadge({ agent }: { agent: AgentName }) {
  return (
    <Chip
      label={agent.toUpperCase()}
      size="small"
      sx={{
        bgcolor: AGENT_COLORS[agent] + '22',
        color: AGENT_COLORS[agent],
        border: `1px solid ${AGENT_COLORS[agent]}44`,
        fontWeight: 700,
        fontSize: '0.65rem',
        height: 20,
      }}
    />
  );
}

interface RunRowProps {
  run: AgentRun;
  isChild: boolean;
  onKill: (id: string) => void;
  onRestart: (id: string) => void;
  onArchive: (id: string) => void;
  onSelect: (id: string) => void;
  actionLoading: string | null;
}

function RunRow({ run, isChild, onKill, onRestart, onArchive, onSelect, actionLoading }: RunRowProps) {
  const [expanded, setExpanded] = useState(false);
  const isActive = ACTIVE_STATUSES.includes(run.status);
  const isTerminal = TERMINAL_STATUSES.includes(run.status);
  const loading = actionLoading === run.id;

  // Stall detection: active run, has heartbeat, heartbeat is >30min ago
  const isStalled =
    (run.status === 'running' || run.status === 'waiting') &&
    !!run.last_heartbeat &&
    Date.now() - new Date(run.last_heartbeat).getTime() > STALL_THRESHOLD_MS;

  // Slack thread URL
  const slackUrl =
    run.slack_channel && run.slack_thread_ts
      ? `https://slack.com/archives/${run.slack_channel}/p${run.slack_thread_ts.replace('.', '')}`
      : null;

  return (
    <Box
      sx={{
        ml: isChild ? 4 : 0,
        borderLeft: isChild ? `2px solid ${palette.primary.main}44` : 'none',
        pl: isChild ? 2 : 0,
        mb: 0.5,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          bgcolor: palette.background.surface2,
          border: `1px solid ${isActive ? palette.primary.main + '33' : '#ffffff11'}`,
          borderRadius: 1.5,
          transition: 'border-color 0.2s',
          position: 'relative',
          cursor: 'pointer',
          '&:hover': { borderColor: isActive ? palette.primary.main + '55' : '#ffffff22' },
        }}
        onClick={(e) => {
          // Don't open drawer if clicking an action button
          if ((e.target as HTMLElement).closest('button')) return;
          onSelect(run.id);
        }}
      >
        {/* Stall badge */}
        {isStalled && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 1,
              pointerEvents: 'none',
            }}
          >
            <Chip
              icon={<WarningAmberOutlinedIcon sx={{ fontSize: '0.75rem !important' }} />}
              label="Stalled?"
              size="small"
              sx={{
                bgcolor: '#F59E0B22',
                color: '#F59E0B',
                border: '1px solid #F59E0B44',
                fontWeight: 600,
                fontSize: '0.6rem',
                height: 20,
              }}
            />
          </Box>
        )}

        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          {/* Agent badge + status */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 80 }}>
            <AgentBadge agent={run.agent} />
            <StatusBadge status={run.status} />
          </Box>

          {/* Main content */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography
                variant="body2"
                sx={{
                  color: '#e2e8f0',
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 460,
                }}
                title={run.task_title || run.brief}
              >
                {isChild ? (
                  <Typography component="span" variant="caption" sx={{ color: palette.primary.light, mr: 0.5 }}>
                    (sub-session)
                  </Typography>
                ) : null}
                {run.task_title || run.brief}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5, flexWrap: 'wrap' }}>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                {formatElapsed(run.started_at, run.ended_at)} elapsed
              </Typography>
              {run.last_heartbeat && (
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  heartbeat {formatTimestamp(run.last_heartbeat)}
                </Typography>
              )}
              {run.project_tag && (
                <Chip
                  label={run.project_tag}
                  size="small"
                  sx={{ bgcolor: '#ffffff11', color: '#94a3b8', height: 16, fontSize: '0.6rem' }}
                />
              )}
              {run.slack_channel && !run.slack_thread_ts && (
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  #{run.slack_channel}
                </Typography>
              )}
              <Typography variant="caption" sx={{ color: '#475569' }}>
                by {run.spawned_by}
              </Typography>
            </Box>
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            {/* Slack link */}
            {slackUrl && (
              <Tooltip title="View Slack thread">
                <IconButton
                  size="small"
                  component="a"
                  href={slackUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ color: '#64748b', '&:hover': { color: '#94a3b8' } }}
                >
                  <OpenInNewIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            )}

            {run.output_tail && (
              <Tooltip title={expanded ? 'Collapse output' : 'Expand output'}>
                <IconButton size="small" onClick={() => setExpanded((e) => !e)} sx={{ color: '#64748b' }}>
                  {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
            )}

            {/* Archive button for terminal runs */}
            {isTerminal && (
              <Tooltip title="Archive run">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => onArchive(run.id)}
                    disabled={loading}
                    sx={{ color: '#64748b', '&:hover': { bgcolor: '#ffffff11' } }}
                  >
                    {loading ? <CircularProgress size={14} /> : <ArchiveOutlinedIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
            )}

            {isActive && (
              <Tooltip title="Kill run">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => onKill(run.id)}
                    disabled={loading}
                    sx={{ color: '#F43F5E', '&:hover': { bgcolor: '#F43F5E22' } }}
                  >
                    {loading ? <CircularProgress size={14} /> : <StopIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
            )}
            {isTerminal && (
              <Tooltip title="Restart run">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => onRestart(run.id)}
                    disabled={loading}
                    sx={{ color: '#14B8A6', '&:hover': { bgcolor: '#14B8A622' } }}
                  >
                    {loading ? <CircularProgress size={14} /> : <RefreshIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Output tail */}
        <Collapse in={expanded && !!run.output_tail}>
          <Box
            sx={{
              mt: 1.5,
              p: 1.5,
              bgcolor: '#0A0A0F',
              borderRadius: 1,
              border: '1px solid #ffffff11',
              maxHeight: 240,
              overflow: 'auto',
            }}
          >
            {run.output_truncated && (
              <Typography variant="caption" sx={{ color: '#F59E0B', display: 'block', mb: 1 }}>
                [output truncated — showing last 64KB]
              </Typography>
            )}
            <Typography
              variant="caption"
              component="pre"
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.7rem',
                color: '#94a3b8',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                m: 0,
              }}
            >
              {run.output_tail}
            </Typography>
          </Box>
        </Collapse>
      </Paper>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function AgentsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterAgent, setFilterAgent] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const visibilityRef = useRef(true);

  const fetchRuns = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterAgent) params.set('agent', filterAgent);
      if (filterStatus) params.set('status', filterStatus);
      if (showArchived) params.set('include_archived', 'true');
      params.set('limit', '100');

      const res = await fetch(`/api/agent-runs?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AgentRun[] = await res.json();
      setRuns(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent runs');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [filterAgent, filterStatus, showArchived]);

  // Adaptive polling: 5s when active runs, 30s otherwise
  const setupPolling = useCallback(
    (currentRuns: AgentRun[]) => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      const hasActive = currentRuns.some((r) => ACTIVE_STATUSES.includes(r.status));
      const interval = hasActive ? 5000 : 30000;
      pollIntervalRef.current = setInterval(() => {
        if (visibilityRef.current) fetchRuns(true);
      }, interval);
    },
    [fetchRuns],
  );

  useEffect(() => {
    const handleVisibility = () => {
      visibilityRef.current = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  useEffect(() => {
    setupPolling(runs);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [runs, setupPolling]);

  const handleKill = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/agent-runs/${id}/kill`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await fetchRuns(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kill failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestart = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/agent-runs/${id}/restart`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await fetchRuns(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restart failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleArchive = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/agent-runs/${id}/archive`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      // Remove from local state immediately
      setRuns((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Archive failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkArchive = async () => {
    if (!window.confirm('Archive all completed runs older than 7 days?')) return;
    try {
      const res = await fetch('/api/agent-runs/bulk-archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 7 }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { archived } = await res.json();
      await fetchRuns(true);
      setError(null);
      // Brief success message via error state (reuse for simplicity)
      if (archived > 0) {
        setError(`Archived ${archived} run${archived !== 1 ? 's' : ''}`);
        setTimeout(() => setError(null), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk archive failed');
    }
  };

  // Derive distinct project tags for the filter dropdown
  const projectTags = Array.from(
    new Set(runs.map((r) => r.project_tag).filter(Boolean) as string[]),
  ).sort();

  // Apply client-side project filter
  const filteredRuns =
    projectFilter === 'all'
      ? runs
      : runs.filter((r) => r.project_tag === projectFilter);

  // Build tree
  const topLevel = filteredRuns.filter((r) => !r.parent_run_id);
  const childrenByParent = filteredRuns.reduce<Record<string, AgentRun[]>>((acc, r) => {
    if (r.parent_run_id) {
      if (!acc[r.parent_run_id]) acc[r.parent_run_id] = [];
      acc[r.parent_run_id].push(r);
    }
    return acc;
  }, {});

  // Orphan children (parent not in current result set) shown at top level
  const parentIds = new Set(filteredRuns.map((r) => r.id));
  const orphans = filteredRuns.filter(
    (r) => r.parent_run_id && !parentIds.has(r.parent_run_id),
  );

  const activeCount = runs.filter((r) => ACTIVE_STATUSES.includes(r.status)).length;

  return (
    <PageTransition>
      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <SmartToyOutlinedIcon sx={{ color: palette.primary.main, fontSize: 28 }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#f1f5f9' }}>
              Agent Runs
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              Live visibility into FullThrottle agent sessions
            </Typography>
          </Box>
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
            {activeCount > 0 && (
              <Chip
                label={`${activeCount} active`}
                size="small"
                sx={{
                  bgcolor: '#14B8A622',
                  color: '#14B8A6',
                  border: '1px solid #14B8A644',
                  fontWeight: 600,
                }}
              />
            )}
            <Tooltip title="Refresh">
              <IconButton onClick={() => fetchRuns()} size="small" sx={{ color: '#64748b' }}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Filters */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Agent</InputLabel>
            <Select
              value={filterAgent}
              label="Agent"
              onChange={(e) => setFilterAgent(e.target.value)}
            >
              <MenuItem value="">All agents</MenuItem>
              {(['clutch', 'axel', 'riff', 'arc', 'torque'] as AgentName[]).map((a) => (
                <MenuItem key={a} value={a}>
                  {a.charAt(0).toUpperCase() + a.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filterStatus}
              label="Status"
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <MenuItem value="">All statuses</MenuItem>
              {(Object.keys(STATUS_CONFIG) as AgentRunStatus[]).map((s) => (
                <MenuItem key={s} value={s}>
                  {STATUS_CONFIG[s].label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Project filter */}
          {projectTags.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Project</InputLabel>
              <Select
                value={projectFilter}
                label="Project"
                onChange={(e) => setProjectFilter(e.target.value)}
              >
                <MenuItem value="all">All Projects</MenuItem>
                {projectTags.map((tag) => (
                  <MenuItem key={tag} value={tag}>
                    {tag}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Show Archived toggle */}
          <FormControlLabel
            control={
              <Switch
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                size="small"
              />
            }
            label={
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                Show Archived
              </Typography>
            }
            sx={{ ml: 0 }}
          />

          {/* Bulk archive — admin only */}
          {isAdmin && (
            <Tooltip title="Archive completed runs older than 7 days">
              <Button
                size="small"
                variant="outlined"
                startIcon={<ArchiveOutlinedIcon fontSize="small" />}
                onClick={handleBulkArchive}
                sx={{ color: '#64748b', borderColor: '#ffffff22', fontSize: '0.7rem' }}
              >
                Archive Old Runs
              </Button>
            </Tooltip>
          )}

          {(filterAgent || filterStatus || projectFilter !== 'all' || showArchived) && (
            <Button
              size="small"
              variant="text"
              onClick={() => {
                setFilterAgent('');
                setFilterStatus('');
                setProjectFilter('all');
                setShowArchived(false);
              }}
              sx={{ color: '#64748b' }}
            >
              Clear filters
            </Button>
          )}
        </Box>

        {/* Error / info */}
        {error && (
          <Alert
            severity={error.startsWith('Archived') ? 'success' : 'error'}
            sx={{ mb: 2 }}
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        {/* Loading */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={32} />
          </Box>
        ) : filteredRuns.length === 0 ? (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
              color: '#475569',
              border: '1px dashed #ffffff11',
              borderRadius: 2,
            }}
          >
            <SmartToyOutlinedIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
            <Typography variant="body2">No agent runs found</Typography>
          </Box>
        ) : (
          <Box>
            {/* Orphan children at top */}
            {orphans.map((run) => (
              <RunRow
                key={run.id}
                run={run}
                isChild={false}
                onKill={handleKill}
                onRestart={handleRestart}
                onArchive={handleArchive}
                onSelect={setSelectedRunId}
                actionLoading={actionLoading}
              />
            ))}

            {/* Top-level runs with their children */}
            {topLevel.map((run) => (
              <Box key={run.id} sx={{ mb: 1 }}>
                <RunRow
                  run={run}
                  isChild={false}
                  onKill={handleKill}
                  onRestart={handleRestart}
                  onArchive={handleArchive}
                  onSelect={setSelectedRunId}
                  actionLoading={actionLoading}
                />
                {(childrenByParent[run.id] ?? []).map((child) => (
                  <RunRow
                    key={child.id}
                    run={child}
                    isChild
                    onKill={handleKill}
                    onRestart={handleRestart}
                    onArchive={handleArchive}
                    onSelect={setSelectedRunId}
                    actionLoading={actionLoading}
                  />
                ))}
              </Box>
            ))}
          </Box>
        )}

        {/* Legend */}
        {filteredRuns.length > 0 && (
          <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {(Object.entries(STATUS_CONFIG) as [AgentRunStatus, (typeof STATUS_CONFIG)[AgentRunStatus]][]).map(
              ([status, cfg]) => (
                <Box key={status} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <FiberManualRecordIcon sx={{ fontSize: 8, color: cfg.color }} />
                  <Typography variant="caption" sx={{ color: '#475569', fontSize: '0.65rem' }}>
                    {cfg.label}
                  </Typography>
                </Box>
              ),
            )}
          </Box>
        )}
      </Box>

      {/* Run Detail Drawer */}
      <RunDetailDrawer
        runId={selectedRunId}
        onClose={() => setSelectedRunId(null)}
        onOpenRun={(id) => setSelectedRunId(id)}
      />
    </PageTransition>
  );
}
