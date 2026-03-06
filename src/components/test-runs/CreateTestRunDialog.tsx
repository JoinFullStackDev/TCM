'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { palette } from '@/theme/palette';
import type { Project, Suite, Profile } from '@/types/database';

interface CreateTestRunDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateTestRunDialog({ open, onClose, onCreated }: CreateTestRunDialogProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [suites, setSuites] = useState<Suite[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [projectId, setProjectId] = useState('');
  const [suiteId, setSuiteId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetVersion, setTargetVersion] = useState('');
  const [environments, setEnvironments] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      fetch('/api/projects').then((r) => r.ok ? r.json() : []).then(setProjects);
      fetch('/api/users').then((r) => r.ok ? r.json() : []).then(setProfiles).catch(() => setProfiles([]));
    }
  }, [open]);

  useEffect(() => {
    if (projectId) {
      fetch(`/api/projects/${projectId}/suites`).then((r) => r.ok ? r.json() : []).then(setSuites);
      fetch(`/api/projects/${projectId}/test-cases`)
        .then((r) => r.ok ? r.json() : [])
        .then((cases: { platform_tags?: string[] }[]) => {
          const platforms = new Set<string>();
          for (const tc of cases) {
            for (const p of tc.platform_tags ?? []) {
              platforms.add(p.charAt(0).toUpperCase() + p.slice(1));
            }
          }
          if (platforms.size > 0) setEnvironments([...platforms]);
        });
    } else {
      setSuites([]);
      setSuiteId('');
      setEnvironments([]);
    }
  }, [projectId]);

  const handleSubmit = async () => {
    if (!projectId || !name.trim()) {
      setError('Project and name are required');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/test-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          suite_id: suiteId || null,
          name: name.trim(),
          description: description.trim() || null,
          target_version: targetVersion.trim() || null,
          environment: environments.length > 0 ? environments.join(', ') : null,
          start_date: startDate || null,
          due_date: dueDate || null,
          assignee_id: assigneeId || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to create');
        return;
      }

      const run = await res.json();
      onCreated();
      handleClose();
      router.push(`/runs/${run.id}`);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setProjectId('');
    setSuiteId('');
    setName('');
    setDescription('');
    setTargetVersion('');
    setEnvironments([]);
    setStartDate('');
    setDueDate('');
    setAssigneeId('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create Test Run</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        <FormControl fullWidth error={!!error && !projectId}>
          <InputLabel>Project *</InputLabel>
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} label="Project *" disabled={loading}>
            {projects.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
          </Select>
        </FormControl>

        {suites.length > 0 && (
          <FormControl fullWidth>
            <InputLabel>Suite (optional)</InputLabel>
            <Select value={suiteId} onChange={(e) => setSuiteId(e.target.value)} label="Suite (optional)" disabled={loading}>
              <MenuItem value="">All Suites</MenuItem>
              {suites.map((s) => <MenuItem key={s.id} value={s.id}>{s.prefix} - {s.name}</MenuItem>)}
            </Select>
          </FormControl>
        )}

        <TextField
          label="Run Name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          disabled={loading}
          error={!!error}
          helperText={error}
          slotProps={{ htmlInput: { maxLength: 200 } }}
        />

        <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline rows={2} disabled={loading} />

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField label="Target Version" value={targetVersion} onChange={(e) => setTargetVersion(e.target.value)} sx={{ flex: 1 }} size="small" disabled={loading} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>Environment</Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {([
                { value: 'Desktop', color: palette.primary.main },
                { value: 'Tablet', color: palette.info.main },
                { value: 'Mobile', color: palette.success.main },
              ] as const).map((env) => {
                const selected = environments.includes(env.value);
                return (
                  <Chip
                    key={env.value}
                    label={env.value}
                    size="small"
                    variant={selected ? 'filled' : 'outlined'}
                    onClick={() => setEnvironments((prev) =>
                      prev.includes(env.value) ? prev.filter((e) => e !== env.value) : [...prev, env.value]
                    )}
                    disabled={loading}
                    sx={selected ? {
                      bgcolor: alpha(env.color, 0.15),
                      color: env.color,
                    } : undefined}
                  />
                );
              })}
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} fullWidth size="small" disabled={loading} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} fullWidth size="small" disabled={loading} slotProps={{ inputLabel: { shrink: true } }} />
        </Box>

        <FormControl fullWidth size="small">
          <InputLabel>Assignee</InputLabel>
          <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} label="Assignee" disabled={loading}>
            <MenuItem value="">Unassigned</MenuItem>
            {profiles.map((p) => <MenuItem key={p.id} value={p.id}>{p.full_name || p.email}</MenuItem>)}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} color="inherit" disabled={loading}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading || !projectId || !name.trim()}>
          {loading ? 'Creating...' : 'Create Run'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
