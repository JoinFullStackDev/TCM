'use client';

import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Autocomplete from '@mui/material/Autocomplete';
import { palette } from '@/theme/palette';

interface CreateSuiteDialogProps {
  open: boolean;
  projectId: string;
  existingGroups?: string[];
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateSuiteDialog({
  open,
  projectId,
  existingGroups = [],
  onClose,
  onCreated,
}: CreateSuiteDialogProps) {
  const [name, setName] = useState('');
  const [prefix, setPrefix] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim() || !prefix.trim()) {
      setError('Name and prefix are required');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/projects/${projectId}/suites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          prefix: prefix.trim().toUpperCase(),
          description: description.trim() || null,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          group: group?.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to create suite');
        return;
      }

      setName('');
      setPrefix('');
      setDescription('');
      setTags('');
      setGroup(null);
      onCreated();
      onClose();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setName('');
      setPrefix('');
      setDescription('');
      setTags('');
      setGroup(null);
      setError('');
      onClose();
    }
  };

  const previewId = prefix.trim().toUpperCase() ? `${prefix.trim().toUpperCase()}-1` : '';

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>New Suite</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        <TextField
          label="Suite Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          autoFocus
          disabled={loading}
          slotProps={{ htmlInput: { maxLength: 100 } }}
        />
        <Box>
          <TextField
            label="Prefix"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.toUpperCase())}
            error={!!error}
            helperText={error || 'Used to generate test case IDs (e.g., SR → SR-1, SR-2)'}
            fullWidth
            disabled={loading}
            slotProps={{ htmlInput: { maxLength: 10, style: { textTransform: 'uppercase' } } }}
          />
          {previewId && (
            <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Preview:
              </Typography>
              <Chip
                label={previewId}
                size="small"
                sx={{
                  height: 22,
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  bgcolor: `${palette.neutral.main}22`,
                  color: palette.neutral.light,
                }}
              />
            </Box>
          )}
        </Box>
        <Autocomplete
          freeSolo
          options={existingGroups}
          value={group}
          onChange={(_, val) => setGroup(val)}
          onInputChange={(_, val) => setGroup(val)}
          disabled={loading}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Group (optional)"
              size="small"
              placeholder="e.g. Sponsor, Investor, Admin"
              helperText="Groups suites together in the sidebar"
            />
          )}
        />
        <TextField
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          fullWidth
          multiline
          rows={2}
          disabled={loading}
          slotProps={{ htmlInput: { maxLength: 1000 } }}
        />
        <TextField
          label="Tags (comma separated)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          fullWidth
          size="small"
          disabled={loading}
          placeholder="e.g. regression, smoke, onboarding"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} color="inherit" disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !name.trim() || !prefix.trim()}
        >
          {loading ? 'Creating...' : 'Create Suite'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
