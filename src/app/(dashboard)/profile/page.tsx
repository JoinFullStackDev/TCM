'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import { alpha } from '@mui/material/styles';
import { useAuth } from '@/components/providers/AuthProvider';
import { ROLE_LABELS } from '@/lib/auth/rbac';
import { palette, semanticColors } from '@/theme/palette';
import NotesDataGrid from '@/components/notes/NotesDataGrid';

export default function ProfilePage() {
  const { profile, role } = useAuth();
  const [tab, setTab] = useState(1);
  const roleColor = semanticColors.role[role] ?? palette.neutral.main;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>
        My Profile
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          minHeight: 36,
          '& .MuiTab-root': { minHeight: 36, textTransform: 'none', fontSize: '0.875rem' },
        }}
      >
        <Tab label="Profile" />
        <Tab label="Notes" />
      </Tabs>

      {tab === 0 && (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: '12px',
            bgcolor: palette.background.paper,
            border: `1px solid ${palette.divider}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Avatar
              src={profile?.avatar_url ?? undefined}
              sx={{
                width: 80,
                height: 80,
                fontSize: '2rem',
                bgcolor: alpha(roleColor, 0.2),
                color: roleColor,
                border: `3px solid ${alpha(roleColor, 0.5)}`,
              }}
            >
              {profile?.full_name?.[0] ?? profile?.email?.[0] ?? '?'}
            </Avatar>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {profile?.full_name ?? 'User'}
              </Typography>
              <Typography variant="body2" sx={{ color: palette.text.secondary }}>
                {profile?.email}
              </Typography>
              <Chip
                label={ROLE_LABELS[role]}
                size="small"
                sx={{
                  height: 24,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  bgcolor: alpha(roleColor, 0.15),
                  color: roleColor,
                  alignSelf: 'flex-start',
                }}
              />
            </Box>
          </Box>

          <Box
            sx={{
              mt: 3,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 2,
            }}
          >
            <InfoCard label="Status" value={profile?.is_active ? 'Active' : 'Inactive'} />
            <InfoCard
              label="Last Active"
              value={
                profile?.last_active_at
                  ? new Date(profile.last_active_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })
                  : 'N/A'
              }
            />
            <InfoCard
              label="Member Since"
              value={
                profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })
                  : 'N/A'
              }
            />
          </Box>
        </Paper>
      )}

      {tab === 1 && (
        <NotesDataGrid />
      )}
    </Box>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: '8px',
        bgcolor: palette.background.surface2,
        border: `1px solid ${palette.divider}`,
      }}
    >
      <Typography variant="caption" sx={{ color: palette.text.disabled, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography variant="body1" sx={{ fontWeight: 500, mt: 0.5 }}>
        {value}
      </Typography>
    </Box>
  );
}
