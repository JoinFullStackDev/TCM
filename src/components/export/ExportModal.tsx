'use client';

import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import ExportProgress from './ExportProgress';
import ExportResultBanner from './ExportResultBanner';

type ModalState = 'idle' | 'in_progress' | 'success' | 'error';

interface ExportResult {
  errorMessage?: string;
}

interface ExportModalProps {
  open: boolean;
  projectId: string;
  projectName: string;
  suiteId?: string;
  suiteName?: string;
  onClose: () => void;
}

export default function ExportModal({
  open,
  projectId,
  projectName,
  suiteId,
  suiteName,
  onClose,
}: ExportModalProps) {
  const [modalState, setModalState] = useState<ModalState>('idle');
  const [result, setResult] = useState<ExportResult | null>(null);

  const handleClose = () => {
    setModalState('idle');
    setResult(null);
    onClose();
  };

  const handleExport = async () => {
    setModalState('in_progress');

    const endpoint = suiteId
      ? `/api/projects/${projectId}/suites/${suiteId}/export`
      : `/api/projects/${projectId}/export`;

    try {
      const res = await fetch(endpoint);

      if (!res.ok) {
        setResult({ errorMessage: 'Export failed. Please try again.' });
        setModalState('error');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers.get('Content-Disposition') ?? '';
      const match = cd.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? 'export.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setResult({});
      setModalState('success');
    } catch {
      setResult({ errorMessage: 'Export failed. Please try again.' });
      setModalState('error');
    }
  };

  const handleRetry = () => {
    setModalState('idle');
    setResult(null);
  };

  const scopeLabel = suiteId && suiteName ? `suite "${suiteName}"` : `project "${projectName}"`;

  return (
    <Dialog open={open} onClose={modalState === 'in_progress' ? undefined : handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>
        Export {scopeLabel}
      </DialogTitle>

      <DialogContent>
        {modalState === 'idle' && (
          <Typography fontSize="0.875rem" color="text.secondary">
            Export all test cases to a CSV file.
          </Typography>
        )}

        {modalState === 'in_progress' && (
          <ExportProgress format="csv" />
        )}

        {(modalState === 'success' || modalState === 'error') && result && (
          <ExportResultBanner
            format="csv"
            errorMessage={result.errorMessage}
            onRetry={handleRetry}
          />
        )}
      </DialogContent>

      <DialogActions>
        {modalState === 'idle' && (
          <>
            <Button onClick={handleClose} sx={{ textTransform: 'none' }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleExport}
              sx={{ textTransform: 'none' }}
            >
              Export CSV
            </Button>
          </>
        )}
        {(modalState === 'success' || modalState === 'error') && (
          <Button onClick={handleClose} sx={{ textTransform: 'none' }}>
            Close
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
