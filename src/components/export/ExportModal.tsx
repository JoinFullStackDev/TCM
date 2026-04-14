'use client';

import { useState, useEffect, useRef } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import Typography from '@mui/material/Typography';
import ExportProgress from './ExportProgress';
import ExportResultBanner from './ExportResultBanner';

type ExportFormat = 'xlsx' | 'google_sheets';
type ModalState = 'idle' | 'in_progress' | 'success' | 'error';

interface ExportResult {
  format: ExportFormat;
  sheetsUrl?: string;
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
  const [format, setFormat] = useState<ExportFormat | null>(null);
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

  // Restore export intent that was stored before the Google OAuth redirect
  useEffect(() => {
    if (!open) return;
    try {
      const raw = sessionStorage.getItem('export_intent');
      if (raw) {
        sessionStorage.removeItem('export_intent');
        const intent = JSON.parse(raw) as { format?: string };
        if (intent.format === 'xlsx' || intent.format === 'google_sheets') {
          setFormat(intent.format);
        }
      }
    } catch {
      // corrupt storage value — ignore
    }
  }, [open]);

  const handleClose = () => {
    stopPolling();
    setFormat(null);
    setModalState('idle');
    setResult(null);
    onClose();
  };

  const handleExport = async () => {
    if (!format) return;

    // Check Google auth before starting
    if (format === 'google_sheets') {
      const statusRes = await fetch('/api/auth/google/status');
      const statusData = await statusRes.json() as { connected: boolean };
      if (!statusData.connected) {
        // Store export intent and redirect to OAuth
        const intent = { scope: suiteId ? 'suite' : 'project', projectId, suiteId, format };
        sessionStorage.setItem('export_intent', JSON.stringify(intent));
        const returnTo = encodeURIComponent(window.location.pathname);
        window.location.href = `/api/auth/google/connect?return_to=${returnTo}`;
        return;
      }
    }

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
        const errorMessage = mapErrorToMessage(data.error, format);
        setResult({ format, errorMessage });
        setModalState('error');
        return;
      }

      // 202 = async job queued — stay in_progress and poll for completion
      if (res.status === 202) {
        const data = await res.json() as { jobId: string; async: true };
        startPolling(data.jobId, format);
        return;
      }

      if (format === 'xlsx') {
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
        setResult({ format });
        setModalState('success');
      } else {
        const data = await res.json() as { url: string };
        setResult({ format, sheetsUrl: data.url });
        setModalState('success');
      }
    } catch {
      setResult({ format, errorMessage: 'Export failed. Please try again.' });
      setModalState('error');
    }
  };

  interface JobPollResponse {
    status: string;
    format?: string;
    download_url?: string;
    sheets_url?: string;
    error?: string;
  }

  const startPolling = (jobId: string, fmt: ExportFormat) => {
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/export-jobs/${jobId}`);
        if (!res.ok) return;
        const job = await res.json() as JobPollResponse;

        if (job.status === 'completed') {
          stopPolling();
          if (fmt === 'xlsx' && job.download_url) {
            const a = document.createElement('a');
            a.href = job.download_url;
            a.download = '';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
          setResult({ format: fmt, sheetsUrl: job.sheets_url });
          setModalState('success');
        } else if (job.status === 'failed') {
          stopPolling();
          setResult({ format: fmt, errorMessage: job.error ?? 'Export failed. Please try again.' });
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
          <FormControl>
            <FormLabel sx={{ mb: 1, fontWeight: 500, fontSize: '0.875rem' }}>
              Export format
            </FormLabel>
            <RadioGroup
              value={format ?? ''}
              onChange={(e) => setFormat(e.target.value as ExportFormat)}
            >
              <FormControlLabel
                value="xlsx"
                control={<Radio size="small" />}
                label={
                  <Typography fontSize="0.875rem">Export as Excel (.xlsx)</Typography>
                }
              />
              <FormControlLabel
                value="google_sheets"
                control={<Radio size="small" />}
                label={
                  <Typography fontSize="0.875rem">Export to Google Sheets</Typography>
                }
              />
            </RadioGroup>
          </FormControl>
        )}

        {modalState === 'in_progress' && (
          <ExportProgress format={format!} />
        )}

        {(modalState === 'success' || modalState === 'error') && result && (
          <ExportResultBanner
            format={result.format}
            sheetsUrl={result.sheetsUrl}
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
              disabled={!format}
              onClick={handleExport}
              sx={{ textTransform: 'none' }}
            >
              Export
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

function mapErrorToMessage(error: string | undefined, format: ExportFormat): string {
  if (error === 'google_not_connected') {
    return 'Your Google account is not connected. Please connect it in your profile settings.';
  }
  if (error === 'google_reauth_required') {
    return 'Your Google authorization has expired. Please reconnect your Google account in profile settings.';
  }
  if (error?.includes('too large')) {
    return error;
  }
  return `Export failed. Please try again.`;
}
