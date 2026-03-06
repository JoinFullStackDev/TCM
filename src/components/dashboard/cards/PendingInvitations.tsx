'use client';

import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import { alpha } from '@mui/material/styles';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import DashboardCard from '../DashboardCard';
import { palette, semanticColors } from '@/theme/palette';
import { ROLE_LABELS } from '@/lib/auth/rbac';
import type { DashboardPendingInvitation } from '@/types/database';
import type { UserRole } from '@/types/database';

function daysUntil(dateStr: string): number {
  return Math.max(0, Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

export default function PendingInvitations({
  data,
  index,
}: {
  data: unknown;
  index: number;
}) {
  const router = useRouter();
  const invitations = (data as DashboardPendingInvitation[] | null) ?? [];

  return (
    <DashboardCard
      title="Pending Invitations"
      icon={<MailOutlineIcon fontSize="small" />}
      loading={data === null}
      isEmpty={invitations.length === 0}
      emptyMessage="No pending invitations"
      index={index}
      action={
        invitations.length > 0 ? (
          <Button
            size="small"
            onClick={() => router.push('/users')}
            sx={{ fontSize: '0.7rem', textTransform: 'none' }}
          >
            Manage
          </Button>
        ) : undefined
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {invitations.map((inv) => {
          const roleColor =
            semanticColors.role[inv.role as UserRole] ?? palette.neutral.main;
          const days = daysUntil(inv.expires_at);
          const isExpiringSoon = days <= 2;

          return (
            <Box
              key={inv.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                py: 0.75,
                px: 1,
                borderRadius: 1,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  flex: 1,
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {inv.email}
              </Typography>
              <Chip
                label={ROLE_LABELS[inv.role as UserRole] ?? inv.role}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.55rem',
                  fontWeight: 600,
                  bgcolor: alpha(roleColor, 0.12),
                  color: roleColor,
                  '& .MuiChip-label': { px: 0.5 },
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  color: isExpiringSoon ? palette.warning.main : 'text.disabled',
                  fontSize: '0.6rem',
                  fontWeight: isExpiringSoon ? 600 : 400,
                  minWidth: 40,
                  textAlign: 'right',
                }}
              >
                {days === 0 ? 'Today' : `${days}d left`}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </DashboardCard>
  );
}
