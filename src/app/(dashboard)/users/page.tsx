'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import AddIcon from '@mui/icons-material/Add';
import BlockIcon from '@mui/icons-material/Block';
import { alpha } from '@mui/material/styles';
import PageTransition from '@/components/animations/PageTransition';
import UserTable from '@/components/users/UserTable';
import InviteUserDialog from '@/components/users/InviteUserDialog';
import { useAuth } from '@/components/providers/AuthProvider';
import { semanticColors, palette } from '@/theme/palette';
import { ROLE_LABELS } from '@/lib/auth/rbac';
import type { Profile, Invitation, UserRole, InvitationStatus } from '@/types/database';

const STATUS_COLORS: Record<InvitationStatus, string> = {
  pending: palette.warning.main,
  accepted: palette.success.main,
  expired: palette.neutral.main,
  revoked: palette.error.main,
};

export default function UsersPage() {
  const { user, can, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<Profile[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);

  const isAdmin = can('manage_users');

  const fetchUsers = useCallback(async () => {
    const res = await fetch('/api/users');
    if (res.ok) setUsers(await res.json());
  }, []);

  const fetchInvitations = useCallback(async () => {
    const res = await fetch('/api/invitations');
    if (res.ok) setInvitations(await res.json());
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      await Promise.all([fetchUsers(), fetchInvitations()]);
    } finally {
      setLoading(false);
    }
  }, [fetchUsers, fetchInvitations]);

  useEffect(() => {
    if (!authLoading) {
      if (!isAdmin) {
        router.push('/');
        return;
      }
      fetchAll();
    }
  }, [authLoading, isAdmin, router, fetchAll]);

  const handleRevoke = async (id: string) => {
    await fetch(`/api/invitations/${id}`, { method: 'PATCH' });
    fetchInvitations();
  };

  if (authLoading || loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAdmin) return null;

  const pendingInvitations = invitations.filter((i) => i.status === 'pending');

  return (
    <PageTransition>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>Users</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setInviteOpen(true)}>
            Invite User
          </Button>
        </Box>

        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', bgcolor: 'background.paper', overflow: 'hidden', mb: 4 }}>
          <UserTable users={users} currentUserId={user?.id ?? ''} onRoleChanged={fetchUsers} />
        </Box>

        {invitations.length > 0 && (
          <>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              Invitations
              {pendingInvitations.length > 0 && (
                <Chip label={`${pendingInvitations.length} pending`} size="small" sx={{ ml: 1, height: 22, fontSize: '0.65rem', bgcolor: alpha(palette.warning.main, 0.15), color: palette.warning.main }} />
              )}
            </Typography>
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', bgcolor: 'background.paper', overflow: 'hidden' }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>Email</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', width: 120 }}>Role</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', width: 100 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', width: 120 }}>Expires</TableCell>
                      <TableCell sx={{ width: 60 }} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {invitations.map((inv) => {
                      const roleColor = semanticColors.role[inv.role as UserRole];
                      const statusColor = STATUS_COLORS[inv.status];
                      return (
                        <TableRow key={inv.id}>
                          <TableCell><Typography variant="body2">{inv.email}</Typography></TableCell>
                          <TableCell>
                            <Chip label={ROLE_LABELS[inv.role as UserRole]} size="small" sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600, bgcolor: alpha(roleColor, 0.15), color: roleColor }} />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                              size="small"
                              variant={inv.status === 'pending' ? 'filled' : 'outlined'}
                              sx={{ height: 22, fontSize: '0.65rem', fontWeight: 600, bgcolor: inv.status === 'pending' ? alpha(statusColor, 0.15) : 'transparent', color: statusColor, borderColor: statusColor }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {new Date(inv.expires_at).toLocaleDateString()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {inv.status === 'pending' && (
                              <IconButton size="small" onClick={() => handleRevoke(inv.id)} sx={{ color: 'text.secondary' }}>
                                <BlockIcon fontSize="small" />
                              </IconButton>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </>
        )}

        <InviteUserDialog open={inviteOpen} onClose={() => setInviteOpen(false)} onInvited={fetchInvitations} />
      </Box>
    </PageTransition>
  );
}
