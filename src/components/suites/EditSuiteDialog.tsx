'use client';

import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import type { Suite } from '@/types/database';

interface EditSuiteDialogProps {
  open: boolean;
  suite: Suite | null;
  projectId: string;
  existingGroups?: string[];
  onClose: () => void;
  onUpdated: () => void;
}

export default function EditSuiteDialog({
  open,
  suite,
  projectId,
  existingGroups = [],
  onClose,
  onUpdated,
}: EditSuiteDialogProps) {
  const [name, setName] = useState('');
  const [prefix, setPrefix] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const prefixChanged = suite ? prefix !== suite.prefix : false;

  useEffect(() => {
    if (suite) {
      setName(suite.name);
      setPrefix(suite.prefix);
      setDescription(suite.description ?? '');
      setTags((suite.tags ?? []).join(', '));
      setGroup(suite.group ?? null);
    }
  }, [suite]);

  const handleSubmit = async () => {
    if (!suite || !name.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/projects/${projectId}/suites/${suite.id}`, {
        method: 'PATCH',
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
        setError(data.error || 'Failed to update suite');
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
      <DialogTitle>Edit Suite</DialogTitle>
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
        <TextField
          label="Prefix"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value.toUpperCase())}
          error={!!error}
          helperText={error}
          fullWidth
          disabled={loading}
          slotProps={{ htmlInput: { maxLength: 10, style: { textTransform: 'uppercase' } } }}
        />
        {prefixChanged && (
          <Alert severity="warning" variant="outlined">
            Changing the prefix will not update existing test case IDs. New test cases will use the new prefix.
          </Alert>
        )}
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
        <Button onClick={onClose} color="inherit" disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !name.trim() || !prefix.trim()}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
