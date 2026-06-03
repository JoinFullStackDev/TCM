'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import Tooltip from '@mui/material/Tooltip';
import StopIcon from '@mui/icons-material/Stop';
import ReplayIcon from '@mui/icons-material/Replay';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AgentBadge from './AgentBadge';
import AgentStatusBadge from './AgentStatusBadge';
import ElapsedTime from './ElapsedTime';
import HeartbeatCell from './HeartbeatCell';
import OutputPanel from './OutputPanel';
import OrchestratorBadge from './OrchestratorBadge';
import type { AgentRun } from '@/types/agent-run';

const TERMINAL_STATUSES = new Set(['done', 'failed', 'timed_out', 'killed']);
const ACTIVE_STATUSES = new Set(['spawned', 'running', 'waiting']);

interface Props {
  run: AgentRun;
  children?: AgentRun[];
  isChild?: boolean;
  onAction?: () => void;
}

export default function AgentKanbanCard({ run, children = [], isChild = false, onAction }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [killDialogOpen, setKillDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [openClawWarning, setOpenClawWarning] = useState(false);

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
    <Card
      variant="outlined"
      sx={{
        mb: 1,
        ml: isChild ? 2 : 0,
        opacity: run.archivedAt ? 0.65 : 1,
        borderLeft: isChild ? '3px solid' : undefined,
        borderLeftColor: isChild ? 'primary.light' : undefined,
        cursor: 'default',
        '&:hover': {
          boxShadow: isChild ? undefined : 2,
        },
      }}
    >
      <CardContent sx={{ pb: '4px !important', pt: 1.5, px: 1.5 }}>
        {/* Badge row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', mb: 0.75 }}>
          <AgentBadge agent={run.agent} />
          <AgentStatusBadge status={run.status} />
          <OrchestratorBadge runType={run.runType ?? 'subagent'} />
        </Box>

        {/* Brief (2-line clamp) */}
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            fontSize: '0.8rem',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            mb: 0.75,
            lineHeight: 1.4,
          }}
          title={run.brief}
        >
          {run.brief}
        </Typography>

        {/* Meta row */}
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
              Elapsed
            </Typography>
            <ElapsedTime startedAt={run.startedAt} endedAt={run.endedAt} isActive={isActive} />
          </Box>
          <Box>
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
              Heartbeat
            </Typography>
            <HeartbeatCell lastHeartbeat={run.lastHeartbeat} status={run.status} />
          </Box>
        </Box>

        {/* Spawned by + Slack */}
        <Box sx={{ mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
            {run.spawnedBy}
            {run.slackChannel ? ` · ${run.slackChannel}` : ''}
          </Typography>
        </Box>

        {/* Errors / warnings */}
        {actionError && (
          <Alert severity="error" sx={{ mt: 1, py: 0 }} onClose={() => setActionError(null)}>
            {actionError}
          </Alert>
        )}
        {openClawWarning && (
          <Alert severity="warning" sx={{ mt: 1, py: 0 }} onClose={() => setOpenClawWarning(false)}>
            OpenClaw integration not active — DB record updated but session was not terminated remotely.
          </Alert>
        )}

        {/* Expand toggle */}
        <Button
          size="small"
          startIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          onClick={() => setExpanded((v) => !v)}
          sx={{ mt: 0.5, textTransform: 'none', fontSize: '0.72rem', p: 0, minWidth: 0 }}
        >
          {expanded ? 'Hide output' : 'Show output'}
        </Button>

        {/* Output panel (shown when expanded) */}
        {expanded && (
          <Box sx={{ mt: 1 }}>
            <OutputPanel outputTail={run.outputTail} outputTruncated={run.outputTruncated} />
          </Box>
        )}
      </CardContent>

      {/* Action buttons */}
      {(isActive || isTerminal) && (
        <CardActions sx={{ px: 1.5, pt: 0, pb: 1 }}>
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
                  sx={{ textTransform: 'none', fontSize: '0.72rem' }}
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
                  sx={{ textTransform: 'none', fontSize: '0.72rem' }}
                >
                  Restart
                </Button>
              </span>
            </Tooltip>
          )}
        </CardActions>
      )}

      {/* Kill confirmation dialog */}
      <Dialog open={killDialogOpen} onClose={() => setKillDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Kill run?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will mark the run as killed
            {!integrationEnabled
              ? ' (OpenClaw integration is off — the agent process may still be running)'
              : ''}
            .
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

      {/* Child run sub-cards */}
      {children.length > 0 && (
        <Box sx={{ px: 1.5, pb: 1.5 }}>
          {children.map((child) => (
            <AgentKanbanCard key={child.id} run={child} isChild onAction={onAction} />
          ))}
        </Box>
      )}
    </Card>
  );
}
