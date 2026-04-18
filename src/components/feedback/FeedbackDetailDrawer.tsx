'use client';

import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import IosShareIcon from '@mui/icons-material/IosShare';
import type { FeedbackSubmission, FeedbackAttachment, FeedbackStatus, FeedbackExport } from '@/types/database';
import FeedbackStatusBadge from './FeedbackStatusBadge';
import FeedbackExportDialog from './FeedbackExportDialog';

interface AttachmentWithUrl extends FeedbackAttachment {
  signed_url: string | null;
}

interface DetailSubmission extends FeedbackSubmission {
  attachments: AttachmentWithUrl[];
  project?: { id: string; name: string } | null;
}

interface Props {
  feedbackId: string | null;
  open: boolean;
  onClose: () => void;
  onUpdated?: (updated: Partial<FeedbackSubmission>) => void;
}

const SEVERITY_COLORS: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  critical: 'error',
  high: 'warning',
  medium: 'info',
  low: 'default',
};

export default function FeedbackDetailDrawer({ feedbackId, open, onClose, onUpdated }: Props) {
  const [submission, setSubmission] = useState<DetailSubmission | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [internalNotes, setInternalNotes] = useState('');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const loadSubmission = useCallback(async () => {
    if (!feedbackId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/feedback/${feedbackId}`);
      if (res.ok) {
        const data = await res.json();
        setSubmission(data);
        setInternalNotes(data.internal_notes ?? '');
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [feedbackId]);

  useEffect(() => {
    if (open && feedbackId) {
      loadSubmission();
    } else {
      setSubmission(null);
      setInternalNotes('');
    }
  }, [open, feedbackId, loadSubmission]);

  async function handleStatusChange(newStatus: FeedbackStatus) {
    if (!submission) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/feedback/${submission.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setSubmission((prev) => prev ? { ...prev, status: newStatus } : prev);
        onUpdated?.({ id: submission.id, status: newStatus });
      }
    } catch {
      // silently fail
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveNotes() {
    if (!submission) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/feedback/${submission.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ internal_notes: internalNotes }),
      });
      if (res.ok) {
        setSubmission((prev) => prev ? { ...prev, internal_notes: internalNotes } : prev);
      }
    } catch {
      // silently fail
    } finally {
      setIsSaving(false);
    }
  }

  function handleExported(exportRecord: FeedbackExport) {
    setSubmission((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exports: [...(prev.exports ?? []), exportRecord],
        status: 'exported',
      };
    });
    onUpdated?.({ id: feedbackId ?? undefined, status: 'exported' });
  }

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{ sx: { width: { xs: '100%', sm: 520 } } }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ flex: 1 }}>
              Feedback Detail
            </Typography>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Content */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
              </Box>
            ) : !submission ? (
              <Typography color="text.secondary">Failed to load submission.</Typography>
            ) : (
              <Stack spacing={2}>
                {/* Title + badges */}
                <Box>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    {submission.title}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip
                      label={submission.submission_type === 'bug' ? 'Bug' : 'Feature Request'}
                      size="small"
                      variant="outlined"
                    />
                    {submission.severity && (
                      <Chip
                        label={submission.severity.charAt(0).toUpperCase() + submission.severity.slice(1)}
                        size="small"
                        color={SEVERITY_COLORS[submission.severity]}
                        variant="outlined"
                      />
                    )}
                    <FeedbackStatusBadge status={submission.status} />
                  </Stack>
                </Box>

                {/* Status control */}
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    label="Status"
                    value={submission.status}
                    onChange={(e) => handleStatusChange(e.target.value as FeedbackStatus)}
                    disabled={isSaving}
                  >
                    <MenuItem value="new">New</MenuItem>
                    <MenuItem value="under_review">Under Review</MenuItem>
                    <MenuItem value="accepted">Accepted</MenuItem>
                    <MenuItem value="rejected">Rejected</MenuItem>
                    <MenuItem value="exported">Exported</MenuItem>
                  </Select>
                </FormControl>

                <Divider />

                {/* Description */}
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    Description
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {submission.description}
                  </Typography>
                </Box>

                {/* Bug-specific fields */}
                {submission.submission_type === 'bug' && (
                  <>
                    {submission.steps_to_reproduce && (
                      <Box>
                        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                          Steps to Reproduce
                        </Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {submission.steps_to_reproduce}
                        </Typography>
                      </Box>
                    )}
                    {submission.expected_behavior && (
                      <Box>
                        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                          Expected Behavior
                        </Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {submission.expected_behavior}
                        </Typography>
                      </Box>
                    )}
                    {submission.actual_behavior && (
                      <Box>
                        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                          Actual Behavior
                        </Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {submission.actual_behavior}
                        </Typography>
                      </Box>
                    )}
                  </>
                )}

                {/* Metadata */}
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    Details
                  </Typography>
                  <Stack spacing={0.5}>
                    {submission.environment && (
                      <Typography variant="body2" color="text.secondary">
                        <strong>Environment:</strong> {submission.environment}
                      </Typography>
                    )}
                    {submission.project && (
                      <Typography variant="body2" color="text.secondary">
                        <strong>Project:</strong> {(submission.project as { name: string }).name}
                      </Typography>
                    )}
                    {submission.submitter_name && (
                      <Typography variant="body2" color="text.secondary">
                        <strong>Submitter:</strong> {submission.submitter_name}
                        {submission.submitter_email ? ` (${submission.submitter_email})` : ''}
                      </Typography>
                    )}
                    {submission.loom_url && (
                      <Typography variant="body2">
                        <Link href={submission.loom_url} target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                          <OpenInNewIcon fontSize="inherit" />
                          Loom Recording
                        </Link>
                      </Typography>
                    )}
                    <Typography variant="body2" color="text.secondary">
                      <strong>Submitted:</strong> {new Date(submission.created_at).toLocaleString()}
                    </Typography>
                  </Stack>
                </Box>

                {/* Attachments */}
                {submission.attachments.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      Attachments ({submission.attachments.length})
                    </Typography>
                    <Stack spacing={0.5}>
                      {submission.attachments.map((att) => (
                        <Box key={att.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <AttachFileIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                          {att.signed_url ? (
                            <Link href={att.signed_url} target="_blank" rel="noopener noreferrer" variant="body2">
                              {att.file_name}
                            </Link>
                          ) : (
                            <Typography variant="body2">{att.file_name}</Typography>
                          )}
                          {att.file_size && (
                            <Typography variant="caption" color="text.disabled">
                              {(att.file_size / 1024).toFixed(0)} KB
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                )}

                <Divider />

                {/* Internal notes */}
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    Internal Notes
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    placeholder="Internal notes visible only to team members…"
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    onBlur={handleSaveNotes}
                    disabled={isSaving}
                    size="small"
                  />
                </Box>

                {/* Existing exports */}
                {submission.exports.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      Exports
                    </Typography>
                    <Stack spacing={0.5}>
                      {submission.exports.map((exp, i) => (
                        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" color="text.secondary">
                            {exp.provider === 'gitlab_issues' ? 'GitLab Issues' : 'Azure DevOps'}
                          </Typography>
                          <Link href={exp.external_url} target="_blank" rel="noopener noreferrer" variant="body2">
                            #{exp.external_id}
                          </Link>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            )}
          </Box>

          {/* Footer */}
          {submission && (
            <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<IosShareIcon />}
                onClick={() => setExportDialogOpen(true)}
              >
                Export to Tracker
              </Button>
            </Box>
          )}
        </Box>
      </Drawer>

      {submission && (
        <FeedbackExportDialog
          feedbackId={submission.id}
          existingExports={submission.exports}
          open={exportDialogOpen}
          onClose={() => setExportDialogOpen(false)}
          onExported={handleExported}
        />
      )}
    </>
  );
}
