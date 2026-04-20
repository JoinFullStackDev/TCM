'use client';

import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Pagination from '@mui/material/Pagination';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Link from 'next/link';
import FeedbackStatusBadge from './FeedbackStatusBadge';
import FeedbackDetailDrawer from './FeedbackDetailDrawer';
import FeedbackExportDialog from './FeedbackExportDialog';
import type { FeedbackStatus } from '@/types/database';

interface FeedbackRow {
  id: string;
  submission_type: 'bug' | 'feature_request';
  title: string;
  severity: string | null;
  status: FeedbackStatus;
  submitter_name: string | null;
  submitter_email: string | null;
  environment: string | null;
  project_id: string | null;
  project: { id: string; name: string } | null;
  attachment_count: number;
  created_at: string;
  updated_at: string;
}

const SEVERITY_COLORS: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  critical: 'error',
  high: 'warning',
  medium: 'info',
  low: 'default',
};

const PAGE_SIZE = 25;

export default function FeedbackInbox() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');

  // Detail drawer
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Export dialog
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (filterStatus) params.set('status', filterStatus);
      if (filterType) params.set('type', filterType);
      if (filterSeverity) params.set('severity', filterSeverity);

      const res = await fetch(`/api/feedback?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? 'Failed to load feedback');
        return;
      }
      const data = await res.json();
      setRows(data.data ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError('Network error loading feedback');
    } finally {
      setIsLoading(false);
    }
  }, [page, filterStatus, filterType, filterSeverity]);

  useEffect(() => {
    load();
  }, [load]);

  function handleRowClick(id: string) {
    setSelectedId(id);
    setDrawerOpen(true);
  }

  function handleUpdated(updated: { id?: string; status?: FeedbackStatus }) {
    if (!updated.id) return;
    setRows((prev) =>
      prev.map((row) =>
        row.id === updated.id ? { ...row, ...updated } : row,
      ),
    );
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Feedback Inbox
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {total} submission{total !== 1 ? 's' : ''}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon fontSize="small" />}
            onClick={() => setExportDialogOpen(true)}
          >
            Export CSV
          </Button>
          <Button
            variant="outlined"
            size="small"
            endIcon={<OpenInNewIcon fontSize="small" />}
            component={Link}
            href="/feedback"
            target="_blank"
          >
            Public Form
          </Button>
        </Stack>
      </Box>

      {/* Filters */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select label="Status" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="new">New</MenuItem>
            <MenuItem value="under_review">Under Review</MenuItem>
            <MenuItem value="accepted">Accepted</MenuItem>
            <MenuItem value="rejected">Rejected</MenuItem>
            <MenuItem value="exported">Exported</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Type</InputLabel>
          <Select label="Type" value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="bug">Bug</MenuItem>
            <MenuItem value="feature_request">Feature Request</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Severity</InputLabel>
          <Select label="Severity" value={filterSeverity} onChange={(e) => { setFilterSeverity(e.target.value); setPage(1); }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="critical">Critical</MenuItem>
            <MenuItem value="high">High</MenuItem>
            <MenuItem value="medium">Medium</MenuItem>
            <MenuItem value="low">Low</MenuItem>
          </Select>
        </FormControl>

        {(filterStatus || filterType || filterSeverity) && (
          <Button
            size="small"
            onClick={() => { setFilterStatus(''); setFilterType(''); setFilterSeverity(''); setPage(1); }}
          >
            Clear Filters
          </Button>
        )}
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : rows.length === 0 ? (
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <Typography color="text.secondary">No feedback submissions found.</Typography>
        </Box>
      ) : (
        <>
          <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Title</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Severity</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Project</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Submitted</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.id}
                    hover
                    onClick={() => handleRowClick(row.id)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: 280 }}>
                        {row.title}
                      </Typography>
                      {row.attachment_count > 0 && (
                        <Typography variant="caption" color="text.disabled">
                          {row.attachment_count} attachment{row.attachment_count !== 1 ? 's' : ''}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={row.submission_type === 'bug' ? 'Bug' : 'Feature'}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.65rem' }}
                      />
                    </TableCell>
                    <TableCell>
                      {row.severity ? (
                        <Chip
                          label={row.severity.charAt(0).toUpperCase() + row.severity.slice(1)}
                          size="small"
                          color={SEVERITY_COLORS[row.severity] ?? 'default'}
                          variant="outlined"
                          sx={{ fontSize: '0.65rem' }}
                        />
                      ) : (
                        <Typography variant="caption" color="text.disabled">—</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <FeedbackStatusBadge status={row.status} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {row.project ? (row.project as { name: string }).name : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {new Date(row.created_at).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, p) => setPage(p)}
                size="small"
              />
            </Box>
          )}
        </>
      )}

      <FeedbackDetailDrawer
        feedbackId={selectedId}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onUpdated={handleUpdated}
      />

      <FeedbackExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
      />
    </Box>
  );
}
