'use client';

import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Checkbox from '@mui/material/Checkbox';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import RestoreIcon from '@mui/icons-material/Restore';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';

interface DeletedTestCase {
  id: string;
  display_id: string;
  title: string;
  deleted_at: string;
  automation_status?: string;
  suite?: { name: string; prefix: string } | null;
}

interface TrashViewProps {
  suiteId?: string;
}

/**
 * Trash view — shows all soft-deleted test cases.
 * Editor+ only (the API enforces 403 for Viewers).
 *
 * Features:
 * - Per-row restore button
 * - Per-row permanent delete button (with confirmation)
 * - Bulk restore via checkbox selection
 */
export default function TrashView({ suiteId }: TrashViewProps) {
  const [cases, setCases] = useState<DeletedTestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [restoring, setRestoring] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Set<string>>(new Set());

  // Initial hard delete confirmation dialog
  const [hardDeleteTarget, setHardDeleteTarget] = useState<DeletedTestCase | null>(null);
  const [hardDeletePending, setHardDeletePending] = useState(false);

  // Second-step CI/CD warning dialog (shown when API returns confirmation_required)
  const [cicdConfirmTarget, setCicdConfirmTarget] = useState<{ id: string; warning: string } | null>(null);
  const [cicdConfirmPending, setCicdConfirmPending] = useState(false);

  const fetchDeleted = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = suiteId
        ? `/api/test-cases?deleted=true&suite_id=${suiteId}`
        : '/api/test-cases?deleted=true';
      const res = await fetch(url);
      if (res.status === 403) {
        setError('You do not have permission to view the trash.');
        return;
      }
      if (!res.ok) throw new Error('Failed to load trash');
      const data = await res.json();
      setCases(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [suiteId]);

  useEffect(() => { fetchDeleted(); }, [fetchDeleted]);

  const handleRestore = async (id: string) => {
    setRestoring((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/test-cases/${id}/restore`, { method: 'POST' });
      if (res.ok) {
        setCases((prev) => prev.filter((c) => c.id !== id));
        setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
      }
    } finally {
      setRestoring((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  const handleBulkRestore = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setRestoring(new Set(ids));
    try {
      const res = await fetch('/api/test-cases/bulk?action=restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (res.ok) {
        const result = await res.json();
        const restoredSet = new Set<string>(result.restored ?? []);
        setCases((prev) => prev.filter((c) => !restoredSet.has(c.id)));
        setSelected(new Set());
      }
    } finally {
      setRestoring(new Set());
    }
  };

  /**
   * First hard-delete attempt — always called without ?confirm=true.
   * If the API returns { confirmation_required: true } (HTTP 200) for an
   * in_cicd test, we surface the automation warning in a second dialog
   * rather than treating the 200 as a success.
   */
  const handleHardDelete = async () => {
    if (!hardDeleteTarget) return;
    const { id } = hardDeleteTarget;
    setHardDeletePending(true);
    setDeleting((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/test-cases/${id}?hard=true`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.confirmation_required) {
          // API requires an extra automation-specific confirmation — show second dialog
          setHardDeleteTarget(null);
          setCicdConfirmTarget({ id, warning: data.warning ?? 'This test is used in automation. Permanently deleting it may break your CI/CD pipeline. This cannot be undone.' });
          return;
        }
        // Actual deletion succeeded
        setCases((prev) => prev.filter((c) => c.id !== id));
        setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
        setHardDeleteTarget(null);
      }
    } finally {
      setHardDeletePending(false);
      setDeleting((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  /**
   * Second hard-delete attempt — called with ?confirm=true after the user
   * acknowledges the automation-specific warning dialog.
   */
  const handleCicdConfirm = async () => {
    if (!cicdConfirmTarget) return;
    const { id } = cicdConfirmTarget;
    setCicdConfirmPending(true);
    setDeleting((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/test-cases/${id}?hard=true&confirm=true`, { method: 'DELETE' });
      if (res.ok) {
        setCases((prev) => prev.filter((c) => c.id !== id));
        setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
        setCicdConfirmTarget(null);
      }
    } finally {
      setCicdConfirmPending(false);
      setDeleting((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === cases.length) setSelected(new Set());
    else setSelected(new Set(cases.map((c) => c.id)));
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;

  const isAutomated = (tc: DeletedTestCase) => tc.automation_status === 'in_cicd';

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteSweepIcon color="warning" />
          <Typography variant="h6" fontWeight={600}>Trash</Typography>
          <Typography variant="body2" color="text.secondary">({cases.length} item{cases.length !== 1 ? 's' : ''})</Typography>
        </Box>
        {selected.size > 0 && (
          <Button
            startIcon={<RestoreIcon />}
            variant="outlined"
            color="primary"
            onClick={handleBulkRestore}
            disabled={restoring.size > 0}
          >
            Restore {selected.size} selected
          </Button>
        )}
      </Box>

      {cases.length === 0 ? (
        <Alert severity="info">The trash is empty.</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selected.size > 0 && selected.size < cases.length}
                    checked={cases.length > 0 && selected.size === cases.length}
                    onChange={toggleAll}
                  />
                </TableCell>
                <TableCell>ID</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Suite</TableCell>
                <TableCell>Deleted At</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cases.map((tc) => (
                <TableRow key={tc.id} selected={selected.has(tc.id)}>
                  <TableCell padding="checkbox">
                    <Checkbox checked={selected.has(tc.id)} onChange={() => toggleSelect(tc.id)} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" fontFamily="monospace" color="text.secondary">
                      {tc.display_id}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{tc.title}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {tc.suite?.name ?? '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(tc.deleted_at).toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                      <Tooltip title="Restore">
                        <span>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleRestore(tc.id)}
                            disabled={restoring.has(tc.id) || deleting.has(tc.id)}
                          >
                            <RestoreIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title={isAutomated(tc) ? 'Delete permanently (automated — extra confirmation required)' : 'Delete permanently'}>
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setHardDeleteTarget(tc)}
                            disabled={restoring.has(tc.id) || deleting.has(tc.id)}
                          >
                            <DeleteForeverIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Step 1 — Initial hard delete confirmation dialog */}
      <Dialog open={!!hardDeleteTarget} onClose={() => setHardDeleteTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteForeverIcon color="error" />
          Delete Permanently
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" gutterBottom>
            Are you sure you want to permanently delete <strong>&ldquo;{hardDeleteTarget?.title}&rdquo;</strong>?
          </Typography>
          <Alert severity="error" sx={{ mt: 1 }}>
            This cannot be undone. The test case and all its history will be permanently removed.
          </Alert>
          {hardDeleteTarget && isAutomated(hardDeleteTarget) && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              This test is used in automation. Permanently deleting it may break your CI/CD pipeline.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHardDeleteTarget(null)} disabled={hardDeletePending}>
            Cancel
          </Button>
          <Button
            onClick={handleHardDelete}
            color="error"
            variant="contained"
            disabled={hardDeletePending}
            startIcon={<DeleteForeverIcon />}
          >
            {hardDeletePending ? 'Deleting…' : 'Delete Permanently'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Step 2 — Automation-specific confirmation dialog (only for in_cicd tests) */}
      <Dialog open={!!cicdConfirmTarget} onClose={() => setCicdConfirmTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteForeverIcon color="error" />
          Confirm Automated Test Deletion
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            {cicdConfirmTarget?.warning}
          </Alert>
          <Typography variant="body2">
            Are you sure you want to permanently delete this automated test? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCicdConfirmTarget(null)} disabled={cicdConfirmPending}>
            Cancel
          </Button>
          <Button
            onClick={handleCicdConfirm}
            color="error"
            variant="contained"
            disabled={cicdConfirmPending}
            startIcon={<DeleteForeverIcon />}
          >
            {cicdConfirmPending ? 'Deleting…' : 'Yes, Delete Permanently'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
