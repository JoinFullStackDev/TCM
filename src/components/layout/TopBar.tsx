'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import NextLink from 'next/link';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import { alpha } from '@mui/material/styles';
import LogoutIcon from '@mui/icons-material/Logout';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { useAuth } from '@/components/providers/AuthProvider';
import { ROLE_LABELS } from '@/lib/auth/rbac';
import { palette, semanticColors } from '@/theme/palette';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

function useBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const [crumbs, setCrumbs] = useState<BreadcrumbItem[]>([{ label: 'Dashboard' }]);

  useEffect(() => {
    const buildCrumbs = async () => {
      if (pathname === '/') {
        setCrumbs([{ label: 'Projects' }]);
        return;
      }

      if (pathname === '/users') {
        setCrumbs([{ label: 'Users' }]);
        return;
      }

      if (pathname === '/integrations') {
        setCrumbs([{ label: 'Integrations' }]);
        return;
      }

      if (pathname.startsWith('/reports')) {
        const items: BreadcrumbItem[] = [{ label: 'Reports', href: '/reports' }];
        const runMatch = pathname.match(/^\/reports\/([^/]+)/);
        if (runMatch) {
          const runId = runMatch[1];
          try {
            const res = await fetch(`/api/test-runs/${runId}`);
            if (res.ok) {
              const run = await res.json();
              items.push({ label: run.name });
            }
          } catch { /* fallback */ }
        }
        setCrumbs(items);
        return;
      }

      if (pathname.startsWith('/runs')) {
        const items: BreadcrumbItem[] = [{ label: 'Test Runs', href: '/runs' }];
        const runMatch = pathname.match(/^\/runs\/([^/]+)/);
        if (runMatch) {
          const runId = runMatch[0].split('/')[2];
          try {
            const res = await fetch(`/api/test-runs/${runId}`);
            if (res.ok) {
              const run = await res.json();
              const execMatch = pathname.match(/\/execute\/([^/]+)/);
              if (execMatch) {
                items.push({ label: run.name, href: `/runs/${runId}` });
                const caseId = execMatch[1];
                const tcRes = await fetch(`/api/test-cases/${caseId}`);
                if (tcRes.ok) {
                  const tc = await tcRes.json();
                  items.push({ label: tc.display_id });
                }
              } else {
                items.push({ label: run.name });
              }
            }
          } catch { /* fallback */ }
        }
        setCrumbs(items);
        return;
      }

      const items: BreadcrumbItem[] = [{ label: 'Projects', href: '/' }];
      const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
      if (projectMatch) {
        const projectId = projectMatch[1];
        try {
          const res = await fetch(`/api/projects/${projectId}`);
          if (res.ok) {
            const project = await res.json();
            const suiteMatch = pathname.match(/\/suites\/([^/]+)/);
            const isImport = pathname.endsWith('/import');

            if (isImport) {
              items.push({ label: project.name, href: `/projects/${projectId}` });
              items.push({ label: 'Import CSV' });
            } else if (suiteMatch) {
              items.push({ label: project.name, href: `/projects/${projectId}` });
              const suiteId = suiteMatch[1];
              const suiteRes = await fetch(`/api/projects/${projectId}/suites/${suiteId}`);
              if (suiteRes.ok) {
                const suite = await suiteRes.json();
                items.push({ label: suite.name });
              }
            } else {
              items.push({ label: project.name });
            }
          }
        } catch { /* fallback */ }
      }

      setCrumbs(items);
    };

    buildCrumbs();
  }, [pathname]);

  return crumbs;
}

export default function TopBar() {
  const { profile, role, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const breadcrumbs = useBreadcrumbs(pathname);

  const roleColor = semanticColors.role[role] ?? palette.neutral.main;

  const handleSignOut = async () => {
    setAnchorEl(null);
    await signOut();
    router.push('/login');
  };

  return (
    <Box
      component="header"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 3,
        py: 1,
        minHeight: 56,
        borderBottom: `1px solid ${palette.divider}`,
        bgcolor: 'background.paper',
      }}
    >
      <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 16 }} />}>
        {breadcrumbs.map((crumb, i) => {
          const isLast = i === breadcrumbs.length - 1;
          return crumb.href && !isLast ? (
            <Link
              key={i}
              component={NextLink}
              href={crumb.href}
              underline="hover"
              color="text.secondary"
              fontSize="0.875rem"
            >
              {crumb.label}
            </Link>
          ) : (
            <Typography key={i} fontSize="0.875rem" color={isLast ? 'text.primary' : 'text.secondary'}>
              {crumb.label}
            </Typography>
          );
        })}
      </Breadcrumbs>

      <Box>
        <IconButton
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{ p: 0.5 }}
        >
          <Avatar
            src={profile?.avatar_url ?? undefined}
            sx={{
              width: 32,
              height: 32,
              fontSize: '0.8rem',
              bgcolor: alpha(roleColor, 0.2),
              color: roleColor,
              border: `2px solid ${alpha(roleColor, 0.5)}`,
            }}
          >
            {profile?.full_name?.[0] ?? '?'}
          </Avatar>
        </IconButton>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          slotProps={{
            paper: {
              sx: { mt: 1, minWidth: 200 },
            },
          }}
        >
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {profile?.full_name ?? 'User'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {profile?.email}
            </Typography>
            <Box sx={{ mt: 0.75 }}>
              <Chip
                label={ROLE_LABELS[role]}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  bgcolor: alpha(roleColor, 0.15),
                  color: roleColor,
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            </Box>
          </Box>

          <Divider />

          <MenuItem onClick={handleSignOut} sx={{ mt: 0.5, color: 'error.main' }}>
            <ListItemIcon>
              <LogoutIcon fontSize="small" sx={{ color: 'error.main' }} />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: '0.8125rem' }}>
              Sign out
            </ListItemText>
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
}
