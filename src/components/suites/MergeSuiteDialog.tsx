'use client';

import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import { alpha } from '@mui/material/styles';
import { palette } from '@/theme/palette';
import type { Suite } from '@/types/database';

interface SuiteWithCount extends Suite {
  test_case_count: number;
}

interface MergeSuiteDialogProps {
  open: boolean;
  sourceSuite: SuiteWithCount | null;
  projectId: string;
  suites: SuiteWithCount[];
  onClose: () => void;
  onMerged: () => void;
}

export default function MergeSuiteDialog({
  open,
  sourceSuite,
  projectId,
  suites,
  onClose,
  onMerged,
}: MergeSuiteDialogProps) {
  const [targetId, setTargetId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetOptions = suites.filter((s) => s.id !== sourceSuite?.id);
  const targetSuite = targetOptions.find((s) => s.id === targetId) ?? null;

  const handleClose = () => {
    if (loading) return;
    setTargetId('');
    setError(null);
    onClose();
  };

  const handleMerge = async () => {
    if (!sourceSuite || !targetId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/suites/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_suite_id: sourceSuite.id,
          target_suite_id: targetId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Merge failed');
        setLoading(false);
        return;
      }

      setTargetId('');
      setError(null);
      setLoading(false);
      onMerged();
      onClose();
    } catch {
      setError('Network error');
      setLoading(false);
    }
  };

  if (!sourceSuite) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Merge Suite</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
          Move all test cases from the source suite into a target suite. The source suite will be
          deleted after the merge.
        </Typography>

        <Box
          sx={{
            p: 2,
            borderRadius: 1.5,
            bgcolor: 'background.default',
            mb: 3,
          }}
        >
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 0.5 }}>
            Source (will be deleted)
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={sourceSuite.prefix}
              size="small"
              sx={{
                fontFamily: 'monospace',
                fontWeight: 700,
                fontSize: '0.7rem',
                bgcolor: alpha(palette.error.main, 0.1),
                color: palette.error.main,
              }}
            />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {sourceSuite.name}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', ml: 'auto' }}>
              {sourceSuite.test_case_count} test case{sourceSuite.test_case_count !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </Box>

        <TextField
          select
          fullWidth
          label="Target suite"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          size="small"
          sx={{ mb: 2 }}
        >
          {targetOptions.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                <Chip
                  label={s.prefix}
                  size="small"
                  sx={{
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    fontSize: '0.65rem',
                    height: 20,
                  }}
                />
                <Typography variant="body2">{s.name}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', ml: 'auto' }}>
                  {s.test_case_count} cases
                </Typography>
              </Box>
            </MenuItem>
          ))}
        </TextField>

        {targetSuite && (
          <Alert severity="warning" sx={{ mb: 1 }}>
            <strong>{sourceSuite.test_case_count}</strong> test case{sourceSuite.test_case_count !== 1 ? 's' : ''} will
            be moved from <strong>{sourceSuite.prefix}</strong> into <strong>{targetSuite.prefix}</strong> and
            re-numbered. The <strong>{sourceSuite.name}</strong> suite will be permanently deleted.
            This cannot be undone.
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleMerge}
          variant="contained"
          color="error"
          disabled={!targetId || loading}
        >
          {loading ? 'Merging...' : 'Merge & Delete Source'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
