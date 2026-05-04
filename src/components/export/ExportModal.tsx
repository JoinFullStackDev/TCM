'use client';

import { useState, useEffect, useRef } from 'react';
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
  const format = 'xlsx' as const;
  const [modalState, setModalState] = useState<ModalState>('idle');
  const [result, setResult] = useState<ExportResult | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollIntervalRef.current !== null) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  // Clean up polling on unmount
  useEffect(() => () => stopPolling(), []);

  const handleClose = () => {
    stopPolling();
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
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        const errorMessage = mapErrorToMessage(data.error);
        setResult({ errorMessage });
        setModalState('error');
        return;
      }

      // 202 = async job queued — stay in_progress and poll for completion
      if (res.status === 202) {
        const data = await res.json() as { jobId: string; async: true };
        startPolling(data.jobId);
        return;
      }

      // Trigger browser download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers.get('Content-Disposition') ?? '';
      const match = cd.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? 'export.xlsx';
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

  interface JobPollResponse {
    status: string;
    download_url?: string;
    error?: string;
  }

  const startPolling = (jobId: string) => {
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/export-jobs/${jobId}`);
        if (!res.ok) return;
        const job = await res.json() as JobPollResponse;

        if (job.status === 'completed') {
          stopPolling();
          if (job.download_url) {
            const a = document.createElement('a');
            a.href = job.download_url;
            a.download = '';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
          setResult({});
          setModalState('success');
        } else if (job.status === 'failed') {
          stopPolling();
          setResult({ errorMessage: job.error ?? 'Export failed. Please try again.' });
          setModalState('error');
        }
        // 'pending' / 'processing' → keep polling
      } catch {
        // Ignore transient fetch errors; keep polling
      }
    }, 3000);
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
          <Typography fontSize="0.875rem">
            Exports all test cases in {scopeLabel} as an Excel (.xlsx) file.
          </Typography>
        )}

        {modalState === 'in_progress' && (
          <ExportProgress />
        )}

        {(modalState === 'success' || modalState === 'error') && result && (
          <ExportResultBanner
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
              Export as .xlsx
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

function mapErrorToMessage(error: string | undefined): string {
  if (error?.includes('too large')) {
    return error;
  }
  return 'Export failed. Please try again.';
}
