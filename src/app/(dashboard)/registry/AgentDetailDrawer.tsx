'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import CloseIcon from '@mui/icons-material/Close';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import type { Agent, AgentStatus } from './AgentCard';
import { palette } from '@/theme/palette';

const STATUS_CONFIG: Record<AgentStatus, { label: string; color: string; pulse: boolean }> = {
  active: { label: 'Active', color: '#14B8A6', pulse: true },
  idle: { label: 'Idle', color: '#F59E0B', pulse: false },
  offline: { label: 'Offline', color: '#475569', pulse: false },
  degraded: { label: 'Degraded', color: '#F43F5E', pulse: true },
};

function formatTs(ts: string | null): string {
  if (!ts) return 'Never';
  return new Date(ts).toLocaleString();
}

interface Props {
  agent: Agent | null;
  isAdmin: boolean;
  onClose: () => void;
  onAgentUpdated: (updated: Agent) => void;
}

export default function AgentDetailDrawer({ agent, isAdmin, onClose, onAgentUpdated }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Edit form state
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCapabilities, setEditCapabilities] = useState('');
  const [editAccentColor, setEditAccentColor] = useState('');
  const [editOpenclawId, setEditOpenclawId] = useState('');
  const [editStatus, setEditStatus] = useState<AgentStatus>('offline');

  useEffect(() => {
    if (agent) {
      setEditDisplayName(agent.display_name);
      setEditDescription(agent.description ?? '');
      setEditCapabilities((agent.capabilities ?? []).join(', '));
      setEditAccentColor(agent.accent_color);
      setEditOpenclawId(agent.openclaw_id ?? '');
      setEditStatus(agent.status);
      setEditing(false);
      setSaveError(null);
    }
  }, [agent]);

  const handleSave = async () => {
    if (!agent) return;
    setSaving(true);
    setSaveError(null);
    try {
      const capabilities = editCapabilities
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: editDisplayName,
          description: editDescription || null,
          capabilities,
          accent_color: editAccentColor,
          openclaw_id: editOpenclawId || null,
          status: editStatus,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const updated: Agent = await res.json();
      onAgentUpdated(updated);
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!agent) return null;

  const statusCfg = STATUS_CONFIG[agent.status];
  const avatarSrc = agent.avatar_url ?? `/agents/${agent.name}.png`;

  return (
    <Drawer
      anchor="right"
      open={!!agent}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: 520,
          bgcolor: '#0F172A',
          borderLeft: '1px solid #ffffff11',
          p: 0,
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2.5,
          borderBottom: '1px solid #ffffff11',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 2,
        }}
      >
        {/* Avatar */}
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            overflow: 'hidden',
            flexShrink: 0,
            bgcolor: agent.accent_color + '22',
            border: `2px solid ${agent.accent_color}44`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box
            component="img"
            src={avatarSrc}
            alt={agent.display_name}
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              img.style.display = 'none';
              const parent = img.parentElement;
              if (parent) {
                parent.innerHTML = `<span style="color:#fff;font-weight:700;font-size:22px">${agent.display_name.charAt(0).toUpperCase()}</span>`;
              }
            }}
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ color: '#f1f5f9', fontWeight: 700 }}>
            {agent.display_name}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <FiberManualRecordIcon
              sx={{
                fontSize: 10,
                color: statusCfg.color,
                animation: statusCfg.pulse ? 'pulse 1.5s ease-in-out infinite' : 'none',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.3 },
                },
              }}
            />
            <Typography variant="caption" sx={{ color: statusCfg.color, fontWeight: 600 }}>
              {statusCfg.label}
            </Typography>
            <Typography variant="caption" sx={{ color: '#475569' }}>
              · {agent.name}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {isAdmin && !editing && (
            <IconButton size="small" onClick={() => setEditing(true)} sx={{ color: '#64748b' }}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          )}
          <IconButton size="small" onClick={onClose} sx={{ color: '#64748b' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Body */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5 }}>
        {saveError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveError(null)}>
            {saveError}
          </Alert>
        )}

        {editing ? (
          /* Edit Form */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Display Name"
              value={editDisplayName}
              onChange={(e) => setEditDisplayName(e.target.value)}
              size="small"
              fullWidth
              sx={inputSx}
            />
            <TextField
              label="Description"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              size="small"
              fullWidth
              multiline
              minRows={3}
              sx={inputSx}
            />
            <TextField
              label="Capabilities (comma-separated)"
              value={editCapabilities}
              onChange={(e) => setEditCapabilities(e.target.value)}
              size="small"
              fullWidth
              sx={inputSx}
            />
            <TextField
              label="Accent Color (hex)"
              value={editAccentColor}
              onChange={(e) => setEditAccentColor(e.target.value)}
              size="small"
              fullWidth
              sx={inputSx}
              InputProps={{
                startAdornment: (
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: '3px',
                      bgcolor: editAccentColor,
                      mr: 1,
                      flexShrink: 0,
                    }}
                  />
                ),
              }}
            />
            <TextField
              label="OpenClaw Agent ID"
              value={editOpenclawId}
              onChange={(e) => setEditOpenclawId(e.target.value)}
              size="small"
              fullWidth
              sx={inputSx}
              placeholder="agent:clutch:..."
            />
            <FormControl size="small" fullWidth sx={inputSx}>
              <InputLabel>Status</InputLabel>
              <Select
                value={editStatus}
                label="Status"
                onChange={(e) => setEditStatus(e.target.value as AgentStatus)}
              >
                {(['active', 'idle', 'offline', 'degraded'] as AgentStatus[]).map((s) => (
                  <MenuItem key={s} value={s}>
                    {STATUS_CONFIG[s].label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Button
                variant="contained"
                size="small"
                startIcon={saving ? <CircularProgress size={14} /> : <SaveOutlinedIcon />}
                onClick={handleSave}
                disabled={saving}
              >
                Save
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setEditing(false)}
                sx={{ borderColor: '#ffffff22', color: '#94a3b8' }}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        ) : (
          /* View Mode */
          <>
            {/* Description */}
            {agent.description && (
              <Typography variant="body2" sx={{ color: '#94a3b8', lineHeight: 1.7, mb: 2.5 }}>
                {agent.description}
              </Typography>
            )}

            {/* Meta */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 2.5 }}>
              <MetaRow label="Agent ID" value={agent.name} />
              {agent.openclaw_id && <MetaRow label="OpenClaw ID" value={agent.openclaw_id} />}
              <MetaRow label="Last Seen" value={formatTs(agent.last_seen_at)} />
              <MetaRow label="Registered" value={formatTs(agent.created_at)} />
            </Box>

            <Divider sx={{ borderColor: '#ffffff11', mb: 2.5 }} />

            {/* Capabilities */}
            {agent.capabilities && agent.capabilities.length > 0 && (
              <>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, display: 'block', mb: 1.5 }}>
                  Capabilities
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2.5 }}>
                  {agent.capabilities.map((cap) => (
                    <Chip
                      key={cap}
                      label={cap}
                      size="small"
                      sx={{
                        bgcolor: agent.accent_color + '18',
                        color: agent.accent_color,
                        border: `1px solid ${agent.accent_color}33`,
                        fontSize: '0.7rem',
                        height: 22,
                      }}
                    />
                  ))}
                </Box>
              </>
            )}

            {/* Accent preview */}
            <Divider sx={{ borderColor: '#ffffff11', mb: 2.5 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
              <Box sx={{ width: 24, height: 24, borderRadius: '4px', bgcolor: agent.accent_color }} />
              <Typography variant="caption" sx={{ color: '#64748b', fontFamily: 'monospace' }}>
                {agent.accent_color}
              </Typography>
            </Box>

            {/* View Runs link */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<SmartToyOutlinedIcon fontSize="small" />}
                onClick={() => {
                  router.push(`/agents?agent=${agent.name}`);
                  onClose();
                }}
                sx={{ borderColor: '#ffffff22', color: '#94a3b8', fontSize: '0.75rem' }}
              >
                View Runs
              </Button>
            </Box>
          </>
        )}
      </Box>
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'baseline' }}>
      <Typography
        variant="caption"
        sx={{ color: '#475569', fontWeight: 600, minWidth: 110, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 }}
      >
        {label}
      </Typography>
      <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.75rem', wordBreak: 'break-all' }}>
        {value}
      </Typography>
    </Box>
  );
}

const inputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: '#ffffff08',
    '& fieldset': { borderColor: '#ffffff22' },
    '&:hover fieldset': { borderColor: '#ffffff44' },
    '&.Mui-focused fieldset': { borderColor: palette.primary.main },
  },
  '& .MuiInputBase-input': { color: '#e2e8f0', fontSize: '0.85rem' },
  '& .MuiInputLabel-root': { color: '#64748b' },
  '& .MuiInputLabel-root.Mui-focused': { color: palette.primary.light },
};
