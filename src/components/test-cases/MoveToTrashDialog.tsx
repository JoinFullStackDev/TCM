'use client';

import { useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

interface MoveToTrashDialogProps {
  open: boolean;
  testCaseTitle: string;
  /** Warning string returned by the API when the case is in an active run. */
  activeRunWarning?: string | null;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

/**
 * Confirmation dialog for moving a test case to the trash.
 *
 * Labelled "Move to Trash" — never "Delete" — per ARC hard rule.
 * If the case is in an active run, an inline warning is shown before confirmation.
 */
export default function MoveToTrashDialog({
  open,
  testCaseTitle,
  activeRunWarning,
  onConfirm,
  onClose,
}: MoveToTrashDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <DeleteOutlineIcon color="warning" />
        Move to Trash
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" gutterBottom>
          Are you sure you want to move <strong>&ldquo;{testCaseTitle}&rdquo;</strong> to the trash?
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          The test case will be hidden from the active list. You can restore it from the Trash view at any time.
        </Typography>
        {activeRunWarning && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {activeRunWarning}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          color="warning"
          variant="contained"
          disabled={loading}
          startIcon={<DeleteOutlineIcon />}
        >
          {loading ? 'Moving…' : 'Move to Trash'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
