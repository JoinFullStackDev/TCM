'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import StopIcon from '@mui/icons-material/Stop';
import ReplayIcon from '@mui/icons-material/Replay';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AgentStatusBadge from './AgentStatusBadge';
import AgentBadge from './AgentBadge';
import ElapsedTime from './ElapsedTime';
import HeartbeatCell from './HeartbeatCell';
import OutputPanel from './OutputPanel';
import OrchestratorBadge from './OrchestratorBadge';
import type { AgentRun } from '@/types/agent-run';

const TERMINAL_STATUSES = new Set(['done', 'failed', 'timed_out', 'killed']);
const ACTIVE_STATUSES = new Set(['spawned', 'running', 'waiting']);

interface Props {
  run: AgentRun;
  isChild?: boolean;
  isOrphan?: boolean;
  onAction?: () => void;
}

export default function AgentRunRow({ run, isChild = false, isOrphan = false, onAction }: Props) {
  const [killDialogOpen, setKillDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [openClawWarning, setOpenClawWarning] = useState(false);
  const [closeSessionLoading, setCloseSessionLoading] = useState(false);
  const [closeSessionSent, setCloseSessionSent] = useState(false);
  const [closeSessionError, setCloseSessionError] = useState<string | null>(null);

  const isActive = ACTIVE_STATUSES.has(run.status);
  const isTerminal = TERMINAL_STATUSES.has(run.status);

  const integrationEnabled = process.env.NEXT_PUBLIC_OPENCLAW_INTEGRATION_ENABLED === 'true';

  async function handleKill() {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/agent-runs/${run.id}/kill`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Kill failed');
      if (data.openClawSkipped || data.openClawError) setOpenClawWarning(true);
      onAction?.();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Kill failed');
    } finally {
      setActionLoading(false);
      setKillDialogOpen(false);
    }
  }

  async function handleCloseSession() {
    setCloseSessionLoading(true);
    setCloseSessionError(null);
    try {
      const res = await fetch(`/api/agent-runs/${run.id}/close-session`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Close session failed');
      setCloseSessionSent(true);
    } catch (err) {
      setCloseSessionError(err instanceof Error ? err.message : 'Close session failed');
    } finally {
      setCloseSessionLoading(false);
    }
  }

  async function handleRestart() {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/agent-runs/${run.id}/restart`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Restart failed');
      if (data.openClawSkipped || data.openClawError) setOpenClawWarning(true);
      onAction?.();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Restart failed');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        ml: isChild ? 4 : 0,
        mt: 1,
        p: 2,
        borderLeft: isChild ? '3px solid' : undefined,
        borderLeftColor: isChild ? 'primary.light' : undefined,
        opacity: run.archivedAt ? 0.65 : 1,
      }}
    >
      {/* Header row */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap' }}>
        <AgentBadge agent={run.agent} />
        <AgentStatusBadge status={run.status} />
        <OrchestratorBadge runType={run.runType ?? 'subagent'} />

        {isOrphan && (
          <Typography variant="caption" color="text.disabled" sx={{ alignSelf: 'center' }}>
            (sub-session)
          </Typography>
        )}

        <Typography
          variant="body2"
          sx={{ flex: 1, minWidth: 200, fontWeight: 500, alignSelf: 'center' }}
          title={run.brief}
        >
          {run.brief.length > 120 ? `${run.brief.slice(0, 120)}…` : run.brief}
        </Typography>

        {run.projectTag && (
          <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
            {run.projectTag}
          </Typography>
        )}
      </Box>

      {/* Meta row */}
      <Box sx={{ display: 'flex', gap: 3, mt: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Box>
          <Typography variant="caption" color="text.disabled">Elapsed</Typography>
          <ElapsedTime
            startedAt={run.startedAt}
            endedAt={run.endedAt}
            isActive={isActive}
          />
        </Box>

        <Box>
          <Typography variant="caption" color="text.disabled">Heartbeat</Typography>
          <HeartbeatCell lastHeartbeat={run.lastHeartbeat} status={run.status} />
        </Box>

        <Box>
          <Typography variant="caption" color="text.disabled">Spawned by</Typography>
          <Typography variant="body2" color="text.secondary">{run.spawnedBy}</Typography>
        </Box>

        {run.slackChannel && (
          <Box>
            <Typography variant="caption" color="text.disabled">Slack</Typography>
            <Typography variant="body2" color="text.secondary">
              {run.slackChannel}
              {run.slackThreadTs ? ` / ${run.slackThreadTs}` : ''}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Output panel */}
      <Box sx={{ mt: 1.5 }}>
        <OutputPanel outputTail={run.outputTail} outputTruncated={run.outputTruncated} />
      </Box>

      {/* Errors and warnings */}
      {actionError && (
        <Alert severity="error" sx={{ mt: 1 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}
      {openClawWarning && (
        <Alert severity="warning" sx={{ mt: 1 }} onClose={() => setOpenClawWarning(false)}>
          Agent may still be running — OpenClaw integration is not yet active. DB record updated, but the session was not terminated remotely.
        </Alert>
      )}
      {closeSessionError && (
        <Alert severity="error" sx={{ mt: 1 }} onClose={() => setCloseSessionError(null)}>
          {closeSessionError}
        </Alert>
      )}
      {closeSessionSent && (
        <Alert severity="success" sx={{ mt: 1 }} onClose={() => setCloseSessionSent(false)}>
          Close signal sent — waiting for Clutch to wrap up.
        </Alert>
      )}

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
        {isActive && (
          <Tooltip title="Signal this session to close itself. Clutch will wrap up and mark the run done.">
            <span>
              <Button
                size="small"
                variant="outlined"
                color="success"
                startIcon={<CheckCircleOutlineIcon />}
                onClick={handleCloseSession}
                disabled={closeSessionLoading || closeSessionSent}
                sx={{ textTransform: 'none' }}
              >
                {closeSessionSent ? 'Closing…' : closeSessionLoading ? 'Sending…' : 'Close Session'}
              </Button>
            </span>
          </Tooltip>
        )}
        {isActive && (
          <Tooltip
            title={
              !integrationEnabled
                ? 'Agent termination requires OpenClaw integration — not yet available'
                : 'Kill this run'
            }
          >
            <span>
              <Button
                size="small"
                variant="outlined"
                color="error"
                startIcon={<StopIcon />}
                onClick={() => setKillDialogOpen(true)}
                disabled={actionLoading}
                sx={{ textTransform: 'none' }}
              >
                Kill
              </Button>
            </span>
          </Tooltip>
        )}

        {isTerminal && (
          <Tooltip
            title={
              !integrationEnabled
                ? 'Agent restart requires OpenClaw integration — not yet available'
                : 'Restart this run with the same brief'
            }
          >
            <span>
              <Button
                size="small"
                variant="outlined"
                color="primary"
                startIcon={<ReplayIcon />}
                onClick={handleRestart}
                disabled={actionLoading}
                sx={{ textTransform: 'none' }}
              >
                Restart
              </Button>
            </span>
          </Tooltip>
        )}
      </Box>

      {/* Kill confirmation dialog */}
      <Dialog open={killDialogOpen} onClose={() => setKillDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Kill run?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will mark the run as killed
            {!integrationEnabled ? ' (OpenClaw integration is off — the agent process may still be running)' : ''}.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setKillDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button onClick={handleKill} color="error" disabled={actionLoading} autoFocus>
            Kill
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
