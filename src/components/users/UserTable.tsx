'use client';

import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import { alpha } from '@mui/material/styles';
import { semanticColors } from '@/theme/palette';
import { ROLE_LABELS } from '@/lib/auth/rbac';
import RoleSelect from './RoleSelect';
import type { Profile, UserRole } from '@/types/database';

interface UserTableProps {
  users: Profile[];
  currentUserId: string;
  onRoleChanged: () => void;
}

export default function UserTable({ users, currentUserId, onRoleChanged }: UserTableProps) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>User</TableCell>
            <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>Email</TableCell>
            <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', width: 160 }}>Role</TableCell>
            <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', width: 120 }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', width: 130 }}>Last Active</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map((u) => {
            const roleColor = semanticColors.role[u.role];
            const isSelf = u.id === currentUserId;
            return (
              <TableRow key={u.id}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar
                      src={u.avatar_url ?? undefined}
                      sx={{
                        width: 32,
                        height: 32,
                        fontSize: '0.75rem',
                        bgcolor: alpha(roleColor, 0.2),
                        color: roleColor,
                        border: `2px solid ${alpha(roleColor, 0.5)}`,
                      }}
                    >
                      {u.full_name?.[0] ?? u.email[0]}
                    </Avatar>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {u.full_name ?? 'Unnamed'}
                      {isSelf && (
                        <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ml: 0.5 }}>
                          (you)
                        </Typography>
                      )}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>{u.email}</Typography>
                </TableCell>
                <TableCell>
                  {isSelf ? (
                    <Chip
                      label={ROLE_LABELS[u.role]}
                      size="small"
                      sx={{
                        height: 22,
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        bgcolor: alpha(roleColor, 0.15),
                        color: roleColor,
                      }}
                    />
                  ) : (
                    <RoleSelect
                      value={u.role as UserRole}
                      userId={u.id}
                      onChanged={onRoleChanged}
                    />
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    label={u.is_active ? 'Active' : 'Inactive'}
                    size="small"
                    variant={u.is_active ? 'filled' : 'outlined'}
                    sx={{ height: 22, fontSize: '0.65rem' }}
                    color={u.is_active ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {u.last_active_at
                      ? new Date(u.last_active_at).toLocaleDateString()
                      : 'Never'}
                  </Typography>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
