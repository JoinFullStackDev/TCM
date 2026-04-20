'use client';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';

interface Props {
  feedbackIds?: string[];
  open: boolean;
  onClose: () => void;
}

export default function FeedbackExportDialog({ feedbackIds, open, onClose }: Props) {
  function handleExport() {
    const url = feedbackIds && feedbackIds.length > 0
      ? `/api/feedback/export?ids=${feedbackIds.join(',')}`
      : '/api/feedback/export';

    const a = document.createElement('a');
    a.href = url;
    a.click();
    onClose();
  }

  const count = feedbackIds?.length ?? null;
  const label = count != null ? `${count} item${count !== 1 ? 's' : ''}` : 'all feedback';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Export as CSV</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          Export {label} as CSV?
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleExport}>
          Export
        </Button>
      </DialogActions>
    </Dialog>
  );
}
