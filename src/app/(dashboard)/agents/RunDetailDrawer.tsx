'use client';

import { useState, useEffect } from 'react';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { createClient } from '@/lib/supabase/client';
import { palette } from '@/theme/palette';

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

interface ChildRun {
  id: string;
  agent: AgentName;
  brief: string;
  taskTitle: string | null;
  status: AgentRunStatus;
  startedAt: string;
}

interface RunNote {
  id: string;
  run_id: string;
  author: string;
  note: string;
  created_at: string;
}

interface RunDetail {
  id: string;
  agent: AgentName;
  brief: string;
  taskTitle: string | null;
  taskDescription: string | null;
  expectedOutcome: string | null;
  status: AgentRunStatus;
  sessionKey: string;
  spawnedBy: string;
  slackChannel: string | null;
  slackThreadTs: string | null;
  projectTag: string | null;
  startedAt: string;
  lastHeartbeat: string | null;
  endedAt: string | null;
  outputTail: string | null;
  outputTruncated: boolean;
  parentRunId: string | null;
  archivedAt: string | null;
  children: ChildRun[];
  notes: RunNote[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const AGENT_COLORS: Record<AgentName, string> = {
  clutch: '#6366F1',
  axel: '#14B8A6',
  riff: '#F59E0B',
  arc: '#A78BFA',
  torque: '#F43F5E',
};

const STATUS_CONFIG: Record<AgentRunStatus, { label: string; color: string }> = {
  spawned: { label: 'Spawned', color: '#A78BFA' },
  running: { label: 'Running', color: '#14B8A6' },
  waiting: { label: 'Waiting', color: '#F59E0B' },
  done: { label: 'Done', color: '#6B7280' },
  failed: { label: 'Failed', color: '#F43F5E' },
  timed_out: { label: 'Timed Out', color: '#F59E0B' },
  killed: { label: 'Killed', color: '#6B7280' },
};

function formatTs(ts: string | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface Props {
  runId: string | null;
  onClose: () => void;
  onOpenRun: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function RunDetailDrawer({ runId, onClose, onOpenRun }: Props) {
  const [run, setRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');

  // Get user email from Supabase session
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? 'unknown');
    });
  }, []);

  // Fetch run detail whenever runId changes
  useEffect(() => {
    if (!runId) {
      setRun(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/agent-runs/${runId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: RunDetail) => {
        setRun(data);
      })
      .catch((err: Error) => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [runId]);

  const handleAddNote = async () => {
    if (!runId || !noteText.trim()) return;
    setNoteLoading(true);
    try {
      const res = await fetch(`/api/agent-runs/${runId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: userEmail, note: noteText.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const newNote: RunNote = await res.json();
      setRun((prev) => prev ? { ...prev, notes: [...prev.notes, newNote] } : prev);
      setNoteText('');
    } catch {
      // silently ignore for now
    } finally {
      setNoteLoading(false);
    }
  };

  // Build timeline steps
  const timelineSteps: { label: string; ts: string | null }[] = [];
  if (run) {
    timelineSteps.push({ label: 'Spawned', ts: run.startedAt });
    if (run.status !== 'spawned') {
      timelineSteps.push({ label: 'Running', ts: run.lastHeartbeat });
    }
    if (run.endedAt) {
      const label = run.status === 'done' ? 'Done'
        : run.status === 'failed' ? 'Failed'
        : run.status === 'killed' ? 'Killed'
        : run.status === 'timed_out' ? 'Timed Out'
        : run.status;
      timelineSteps.push({ label, ts: run.endedAt });
    }
  }

  const activeStep = timelineSteps.length - 1;

  return (
    <Drawer
      anchor="right"
      open={!!runId}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: 480,
          bgcolor: '#0F172A',
          borderLeft: '1px solid #ffffff11',
          p: 0,
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.5,
          p: 2.5,
          borderBottom: '1px solid #ffffff11',
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {run ? (
            <>
              <Typography
                variant="subtitle1"
                sx={{ color: '#f1f5f9', fontWeight: 600, wordBreak: 'break-word' }}
              >
                {run.taskTitle || run.brief}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                <Chip
                  label={run.agent.toUpperCase()}
                  size="small"
                  sx={{
                    bgcolor: AGENT_COLORS[run.agent] + '22',
                    color: AGENT_COLORS[run.agent],
                    border: `1px solid ${AGENT_COLORS[run.agent]}44`,
                    fontWeight: 700,
                    fontSize: '0.65rem',
                    height: 20,
                  }}
                />
                <Chip
                  label={STATUS_CONFIG[run.status].label}
                  size="small"
                  sx={{
                    bgcolor: STATUS_CONFIG[run.status].color + '22',
                    color: STATUS_CONFIG[run.status].color,
                    border: `1px solid ${STATUS_CONFIG[run.status].color}44`,
                    fontWeight: 600,
                    fontSize: '0.65rem',
                    height: 20,
                  }}
                />
              </Box>
            </>
          ) : (
            <Typography variant="subtitle1" sx={{ color: '#94a3b8' }}>
              Loading run…
            </Typography>
          )}
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: '#64748b', mt: 0.5 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Body */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {run && !loading && (
          <>
            {/* Meta row */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 2.5 }}>
              <MetaRow label="Spawned by" value={run.spawnedBy} />
              {run.projectTag && <MetaRow label="Project" value={run.projectTag} />}
              {run.sessionKey && <MetaRow label="Session" value={run.sessionKey} />}
            </Box>

            <Divider sx={{ borderColor: '#ffffff11', mb: 2.5 }} />

            {/* Timestamps */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 2.5 }}>
              <MetaRow label="Started" value={formatTs(run.startedAt)} />
              {run.endedAt && <MetaRow label="Ended" value={formatTs(run.endedAt)} />}
              {run.lastHeartbeat && (
                <MetaRow label="Last heartbeat" value={formatTs(run.lastHeartbeat)} />
              )}
            </Box>

            {/* Slack link */}
            {run.slackChannel && run.slackThreadTs && (
              <Box sx={{ mb: 2.5 }}>
                <Button
                  size="small"
                  variant="outlined"
                  endIcon={<OpenInNewIcon fontSize="small" />}
                  component="a"
                  href={`https://slack.com/archives/${run.slackChannel}/p${run.slackThreadTs.replace('.', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ borderColor: '#ffffff22', color: '#94a3b8', fontSize: '0.7rem' }}
                >
                  View Slack thread
                </Button>
              </Box>
            )}

            <Divider sx={{ borderColor: '#ffffff11', mb: 2.5 }} />

            {/* Timeline */}
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, display: 'block', mb: 1.5 }}>
              Timeline
            </Typography>
            <Stepper activeStep={activeStep} orientation="vertical" sx={{ mb: 2.5 }}>
              {timelineSteps.map((step, idx) => (
                <Step key={idx} completed={idx < activeStep}>
                  <StepLabel
                    sx={{
                      '& .MuiStepLabel-label': { color: '#94a3b8', fontSize: '0.8rem' },
                      '& .MuiStepIcon-root': { color: palette.primary.main },
                      '& .MuiStepIcon-root.Mui-completed': { color: palette.primary.main },
                    }}
                  >
                    <Box>
                      <Typography variant="caption" sx={{ color: '#e2e8f0', fontWeight: 600 }}>
                        {step.label}
                      </Typography>
                      {step.ts && (
                        <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                          {formatTs(step.ts)}
                        </Typography>
                      )}
                    </Box>
                  </StepLabel>
                </Step>
              ))}
            </Stepper>

            {/* task_description */}
            {run.taskDescription && (
              <>
                <Divider sx={{ borderColor: '#ffffff11', mb: 2 }} />
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, display: 'block', mb: 1 }}>
                  Task Description
                </Typography>
                <Typography variant="body2" sx={{ color: '#94a3b8', lineHeight: 1.7 }}>
                  {run.taskDescription}
                </Typography>
              </>
            )}

            {/* expected_outcome */}
            {run.expectedOutcome && (
              <>
                <Divider sx={{ borderColor: '#ffffff11', my: 2 }} />
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, display: 'block', mb: 1 }}>
                  Expected Outcome
                </Typography>
                <Typography variant="body2" sx={{ color: '#94a3b8', lineHeight: 1.7 }}>
                  {run.expectedOutcome}
                </Typography>
              </>
            )}

            {/* Output */}
            {run.outputTail && (
              <>
                <Divider sx={{ borderColor: '#ffffff11', my: 2 }} />
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, display: 'block', mb: 1 }}>
                  Output
                </Typography>
                {run.outputTruncated && (
                  <Alert
                    severity="warning"
                    sx={{ mb: 1, py: 0.25, '& .MuiAlert-message': { fontSize: '0.7rem' } }}
                  >
                    Output truncated — showing last captured characters
                  </Alert>
                )}
                <Box
                  sx={{
                    maxHeight: 300,
                    overflow: 'auto',
                    bgcolor: '#0A0A0F',
                    borderRadius: 1,
                    border: '1px solid #ffffff11',
                    p: 1.5,
                  }}
                >
                  <Typography
                    component="pre"
                    variant="caption"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: 12,
                      color: '#94a3b8',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      m: 0,
                    }}
                  >
                    {run.outputTail}
                  </Typography>
                </Box>
              </>
            )}

            {/* Parent run */}
            {run.parentRunId && (
              <>
                <Divider sx={{ borderColor: '#ffffff11', my: 2 }} />
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, display: 'block', mb: 1 }}>
                  Parent Run
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => onOpenRun(run.parentRunId!)}
                  sx={{ borderColor: '#ffffff22', color: '#94a3b8', fontSize: '0.7rem' }}
                >
                  View Parent Run
                </Button>
              </>
            )}

            {/* Child runs */}
            {run.children.length > 0 && (
              <>
                <Divider sx={{ borderColor: '#ffffff11', my: 2 }} />
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, display: 'block', mb: 1.5 }}>
                  Sub-sessions ({run.children.length})
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  {run.children.map((child) => (
                    <Box
                      key={child.id}
                      onClick={() => onOpenRun(child.id)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        p: 1,
                        bgcolor: '#ffffff08',
                        borderRadius: 1,
                        border: '1px solid #ffffff11',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: '#ffffff12' },
                      }}
                    >
                      <Chip
                        label={child.agent.toUpperCase()}
                        size="small"
                        sx={{
                          bgcolor: AGENT_COLORS[child.agent] + '22',
                          color: AGENT_COLORS[child.agent],
                          border: `1px solid ${AGENT_COLORS[child.agent]}44`,
                          fontWeight: 700,
                          fontSize: '0.6rem',
                          height: 18,
                        }}
                      />
                      <Chip
                        label={STATUS_CONFIG[child.status].label}
                        size="small"
                        sx={{
                          bgcolor: STATUS_CONFIG[child.status].color + '22',
                          color: STATUS_CONFIG[child.status].color,
                          fontSize: '0.6rem',
                          height: 18,
                        }}
                      />
                      <Typography
                        variant="caption"
                        sx={{
                          color: '#94a3b8',
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {child.taskTitle || child.brief}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </>
            )}

            {/* Notes */}
            <Divider sx={{ borderColor: '#ffffff11', my: 2 }} />
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, display: 'block', mb: 1.5 }}>
              Notes ({run.notes.length})
            </Typography>

            {run.notes.length > 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                {run.notes.map((note) => (
                  <Box
                    key={note.id}
                    sx={{
                      p: 1.25,
                      bgcolor: '#ffffff08',
                      borderRadius: 1,
                      border: '1px solid #ffffff11',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" sx={{ color: palette.primary.light, fontWeight: 600, fontSize: '0.65rem' }}>
                        {note.author}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#475569', fontSize: '0.65rem' }}>
                        {formatTs(note.created_at)}
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: '#94a3b8', lineHeight: 1.6, display: 'block' }}>
                      {note.note}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}

            {/* Add note */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField
                multiline
                minRows={2}
                size="small"
                placeholder="Add a note…"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                sx={{
                  flex: 1,
                  '& .MuiOutlinedInput-root': {
                    bgcolor: '#ffffff08',
                    '& fieldset': { borderColor: '#ffffff22' },
                    '&:hover fieldset': { borderColor: '#ffffff44' },
                  },
                  '& .MuiInputBase-input': { color: '#e2e8f0', fontSize: '0.8rem' },
                  '& .MuiInputBase-input::placeholder': { color: '#475569' },
                }}
              />
              <Button
                size="small"
                variant="contained"
                onClick={handleAddNote}
                disabled={!noteText.trim() || noteLoading}
                sx={{ mt: 0.5, minWidth: 80 }}
              >
                {noteLoading ? <CircularProgress size={14} /> : 'Add Note'}
              </Button>
            </Box>
          </>
        )}
      </Box>
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// MetaRow helper
// ---------------------------------------------------------------------------
function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'baseline' }}>
      <Typography
        variant="caption"
        sx={{ color: '#475569', fontWeight: 600, minWidth: 100, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.5 }}
      >
        {label}
      </Typography>
      <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.75rem', wordBreak: 'break-all' }}>
        {value}
      </Typography>
    </Box>
  );
}
