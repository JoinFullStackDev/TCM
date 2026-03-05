'use client';

import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import type { Project } from '@/types/database';

interface EditProjectDialogProps {
  open: boolean;
  project: Project | null;
  onClose: () => void;
  onUpdated: () => void;
}

export default function EditProjectDialog({
  open,
  project,
  onClose,
  onUpdated,
}: EditProjectDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description ?? '');
    }
  }, [project]);

  const handleSubmit = async () => {
    if (!project || !name.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to update project');
        return;
      }

      onUpdated();
      onClose();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Project</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        <TextField
          label="Project Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={!!error}
          helperText={error}
          fullWidth
          autoFocus
          disabled={loading}
          slotProps={{ htmlInput: { maxLength: 100 } }}
        />
        <TextField
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          fullWidth
          multiline
          rows={3}
          disabled={loading}
          slotProps={{ htmlInput: { maxLength: 1000 } }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !name.trim()}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
