'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import { alpha } from '@mui/material/styles';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import DashboardCard from '../DashboardCard';
import { palette, semanticColors } from '@/theme/palette';
import { ROLE_LABELS } from '@/lib/auth/rbac';
import type { DashboardUserActivity } from '@/types/database';
import type { UserRole } from '@/types/database';

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function isInactive(dateStr: string | null): boolean {
  if (!dateStr) return true;
  return Date.now() - new Date(dateStr).getTime() > 7 * 24 * 60 * 60 * 1000;
}

export default function UserActivity({
  data,
  index,
}: {
  data: unknown;
  index: number;
}) {
  const users = (data as DashboardUserActivity[] | null) ?? [];

  return (
    <DashboardCard
      title="User Activity"
      icon={<PeopleOutlineIcon fontSize="small" />}
      loading={data === null}
      isEmpty={users.length === 0}
      emptyMessage="No users"
      index={index}
      span={2}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {users.map((user) => {
          const roleColor =
            semanticColors.role[user.role as UserRole] ?? palette.neutral.main;
          const inactive = isInactive(user.last_active_at);

          return (
            <Box
              key={user.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                py: 0.75,
                px: 1,
                borderRadius: 1,
                opacity: inactive ? 0.6 : 1,
              }}
            >
              <Avatar
                src={user.avatar_url ?? undefined}
                sx={{
                  width: 28,
                  height: 28,
                  fontSize: '0.7rem',
                  bgcolor: alpha(roleColor, 0.2),
                  color: roleColor,
                }}
              >
                {user.full_name?.[0] ?? user.email[0]}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {user.full_name ?? user.email}
                </Typography>
              </Box>
              <Chip
                label={ROLE_LABELS[user.role as UserRole] ?? user.role}
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
                  color: inactive ? palette.warning.main : 'text.disabled',
                  fontSize: '0.6rem',
                  minWidth: 50,
                  textAlign: 'right',
                }}
              >
                {timeAgo(user.last_active_at)}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </DashboardCard>
  );
}
