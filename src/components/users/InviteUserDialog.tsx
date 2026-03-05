'use client';

import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { alpha } from '@mui/material/styles';
import { semanticColors } from '@/theme/palette';
import { ROLE_LABELS, ALL_ROLES } from '@/lib/auth/rbac';
import type { UserRole } from '@/types/database';

interface InviteUserDialogProps {
  open: boolean;
  onClose: () => void;
  onInvited: () => void;
}

export default function InviteUserDialog({ open, onClose, onInvited }: InviteUserDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('qa_engineer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    setLoading(true);
    setError('');
    setInviteUrl('');

    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to create invitation');
        return;
      }

      const invitation = await res.json();
      const url = `${window.location.origin}/invite/${invitation.token}`;
      setInviteUrl(url);
      onInvited();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
  };

  const handleClose = () => {
    setEmail('');
    setRole('qa_engineer');
    setError('');
    setInviteUrl('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Invite User</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        <TextField
          label="Email Address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          fullWidth
          autoFocus
          disabled={loading || !!inviteUrl}
          error={!!error}
          helperText={error}
        />
        <FormControl fullWidth>
          <InputLabel>Role</InputLabel>
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            label="Role"
            disabled={loading || !!inviteUrl}
          >
            {ALL_ROLES.map((r) => {
              const color = semanticColors.role[r];
              return (
                <MenuItem key={r} value={r}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={ROLE_LABELS[r]}
                      size="small"
                      sx={{
                        height: 22,
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        bgcolor: alpha(color, 0.15),
                        color,
                      }}
                    />
                  </Box>
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>

        {inviteUrl && (
          <Alert
            severity="success"
            action={
              <IconButton size="small" onClick={handleCopy}>
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            }
          >
            Invitation created! Share this link:
            <Box
              component="code"
              sx={{
                display: 'block',
                mt: 0.5,
                p: 1,
                borderRadius: '4px',
                bgcolor: 'background.default',
                fontSize: '0.75rem',
                wordBreak: 'break-all',
              }}
            >
              {inviteUrl}
            </Box>
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} color="inherit">
          {inviteUrl ? 'Done' : 'Cancel'}
        </Button>
        {!inviteUrl && (
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={loading || !email.trim()}
          >
            {loading ? 'Sending...' : 'Send Invite'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
