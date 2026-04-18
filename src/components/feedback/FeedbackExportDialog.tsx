'use client';

import { useState } from 'react';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import type { FeedbackExport } from '@/types/database';

interface Props {
  feedbackId: string;
  existingExports: FeedbackExport[];
  open: boolean;
  onClose: () => void;
  onExported: (exportRecord: FeedbackExport) => void;
}

type Provider = 'gitlab_issues' | 'ado';

const PROVIDER_LABELS: Record<Provider, string> = {
  gitlab_issues: 'GitLab Issues',
  ado: 'Azure DevOps',
};

export default function FeedbackExportDialog({
  feedbackId,
  existingExports,
  open,
  onClose,
  onExported,
}: Props) {
  const [provider, setProvider] = useState<Provider>('gitlab_issues');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FeedbackExport | null>(null);

  const alreadyExported = existingExports.some((e) => e.provider === provider);

  async function handleExport() {
    if (alreadyExported) return;
    setIsExporting(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/feedback/${feedbackId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? 'Export failed. Please try again.');
        return;
      }

      setResult(data as FeedbackExport);
      onExported(data as FeedbackExport);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsExporting(false);
    }
  }

  function handleClose() {
    if (isExporting) return;
    setError(null);
    setResult(null);
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Export Feedback</DialogTitle>

      <DialogContent>
        {result ? (
          <Alert severity="success" sx={{ mb: 1 }}>
            Exported successfully!{' '}
            <Link href={result.external_url} target="_blank" rel="noopener noreferrer">
              View #{result.external_id}
            </Link>
          </Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Create an issue or work item in an external tracker.
            </Typography>

            <FormControl fullWidth>
              <InputLabel>Provider</InputLabel>
              <Select
                label="Provider"
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value as Provider);
                  setError(null);
                }}
                disabled={isExporting}
              >
                {(['gitlab_issues', 'ado'] as Provider[]).map((p) => {
                  const exported = existingExports.some((e) => e.provider === p);
                  return (
                    <MenuItem key={p} value={p} disabled={exported}>
                      {PROVIDER_LABELS[p]}
                      {exported ? ' (already exported)' : ''}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>

            {alreadyExported && (
              <Alert severity="warning" sx={{ mt: 1.5 }}>
                Already exported to {PROVIDER_LABELS[provider]}.
              </Alert>
            )}

            {error && (
              <Alert severity="error" sx={{ mt: 1.5 }}>
                {error}
              </Alert>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={isExporting}>
          {result ? 'Close' : 'Cancel'}
        </Button>
        {!result && (
          <Button
            variant="contained"
            onClick={handleExport}
            disabled={isExporting || alreadyExported}
            startIcon={isExporting ? <CircularProgress size={14} color="inherit" /> : null}
          >
            {isExporting ? 'Exporting…' : 'Export'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
