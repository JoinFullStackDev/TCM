'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import { alpha } from '@mui/material/styles';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import WebhookOutlinedIcon from '@mui/icons-material/WebhookOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { motion } from 'framer-motion';
import { useAuth } from '@/components/providers/AuthProvider';
import { ROLE_LABELS } from '@/lib/auth/rbac';
import { palette, semanticColors } from '@/theme/palette';
import FullStackLogo from './FullStackLogo';
import type { Suite } from '@/types/database';

const SIDEBAR_WIDTH = 240;
const SIDEBAR_COLLAPSED = 64;

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  disabled?: boolean;
  adminOnly?: boolean;
  permission?: 'view_webhooks' | 'soft_delete' | 'view_feedback' | 'docs:read';
  group?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/' , icon: <DashboardOutlinedIcon /> },
  { label: 'Projects',  href: '/projects', icon: <FolderOutlinedIcon />,    group: 'Testing' },
  { label: 'Test Runs', href: '/runs',     icon: <PlaylistPlayIcon />,       group: 'Testing' },
  { label: 'Reports',   href: '/reports',  icon: <AssessmentOutlinedIcon />, group: 'Testing' },
  { label: 'Agents',    href: '/agents',   icon: <SmartToyOutlinedIcon />,   group: 'Intelligence' },
  { label: 'Registry',  href: '/registry', icon: <GridViewOutlinedIcon />,   group: 'Intelligence' },
  { label: 'Docs',      href: '/docs',     icon: <MenuBookOutlinedIcon />,   group: 'Intelligence' },
  { label: 'Feedback',     href: '/feedback-inbox', icon: <InboxOutlinedIcon />,  permission: 'view_feedback' as const, group: 'Admin' },
  { label: 'Integrations', href: '/integrations',   icon: <WebhookOutlinedIcon />, permission: 'view_webhooks',          group: 'Admin' },
  { label: 'Users',        href: '/users',           icon: <PeopleOutlineIcon />,  adminOnly: true,                      group: 'Admin' },
  /** Trash — soft-deleted test cases. Editor+ only; the API enforces 403 for Viewers. */
  { label: 'Trash',        href: '/trash',           icon: <DeleteOutlineIcon />,  permission: 'soft_delete' as const,   group: 'Admin' },
];

const NAV_GROUP_DEFAULTS: Record<string, boolean> = {
  Testing:      true,
  Intelligence: true,
  Admin:        false,
};

function extractProjectId(pathname: string): string | null {
  const match = pathname.match(/^\/projects\/([^/]+)/);
  return match ? match[1] : null;
}

function extractSuiteId(pathname: string): string | null {
  const match = pathname.match(/\/suites\/([^/]+)/);
  return match ? match[1] : null;
}

export default function Sidebar({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const { profile, role, can } = useAuth();

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.adminOnly && !can('manage_users')) return false;
    if (item.permission && !can(item.permission)) return false;
    return true;
  });

  const [suites, setSuites] = useState<Suite[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Nav group open/closed state (Testing, Intelligence, Admin)
  const [navGroupsOpen, setNavGroupsOpen] = useState<Record<string, boolean>>(NAV_GROUP_DEFAULTS);

  const toggleNavGroup = useCallback((groupName: string) => {
    setNavGroupsOpen((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  }, []);
  const projectId = extractProjectId(pathname);
  const activeSuiteId = extractSuiteId(pathname);

  const groupedSuites = useMemo(() => {
    const groups: { name: string; suites: Suite[] }[] = [];
    const groupMap = new Map<string, Suite[]>();
    const ungrouped: Suite[] = [];

    for (const suite of suites) {
      const g = suite.group?.trim();
      if (g) {
        if (!groupMap.has(g)) groupMap.set(g, []);
        groupMap.get(g)!.push(suite);
      } else {
        ungrouped.push(suite);
      }
    }

    for (const [name, items] of groupMap) {
      groups.push({ name, suites: items });
    }

    if (ungrouped.length > 0) {
      groups.push({ name: '', suites: ungrouped });
    }

    return groups;
  }, [suites]);

  const toggleGroup = useCallback((groupName: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!activeSuiteId) return;
    for (const group of groupedSuites) {
      if (group.name && group.suites.some((s) => s.id === activeSuiteId)) {
        setExpandedGroups((prev) => {
          if (prev.has(group.name)) return prev;
          return new Set(prev).add(group.name);
        });
        break;
      }
    }
  }, [activeSuiteId, groupedSuites]);

  const fetchSuites = useCallback(async () => {
    if (!projectId) {
      setSuites([]);
      return;
    }
    try {
      const res = await fetch(`/api/projects/${projectId}/suites`);
      if (res.ok) {
        const data = await res.json();
        setSuites(data);
      }
    } catch {
      setSuites([]);
    }
  }, [projectId]);

  useEffect(() => {
    fetchSuites();
  }, [fetchSuites]);

  const width = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_WIDTH;
  const roleColor = semanticColors.role[role] ?? palette.neutral.main;

  // Force-open any nav group that contains the current active route
  const forcedOpenGroups = useMemo(() => {
    const forced = new Set<string>();
    for (const item of visibleNavItems) {
      if (!item.group) continue;
      const isActive = item.href === '/'
        ? pathname === '/'
        : item.href === '/projects'
          ? pathname.startsWith('/projects')
          : pathname.startsWith(item.href);
      if (isActive) forced.add(item.group);
    }
    return forced;
  }, [visibleNavItems, pathname]);

  // Render a single nav item button (shared between grouped and flat modes)
  const renderNavItem = (item: NavItem) => {
    const isActive = item.href === '/'
      ? pathname === '/'
      : item.href === '/projects'
        ? pathname.startsWith('/projects')
        : pathname.startsWith(item.href);

    return (
      <Box key={item.href}>
        <Tooltip title={collapsed ? item.label : ''} placement="right">
          <ListItemButton
            component={item.disabled ? 'div' : Link}
            href={item.disabled ? undefined : item.href}
            disabled={item.disabled}
            selected={isActive}
            sx={{
              mb: 0.5,
              minHeight: 40,
              px: collapsed ? 1.5 : 2,
              justifyContent: collapsed ? 'center' : 'flex-start',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {isActive && !activeSuiteId && (
              <motion.div
                layoutId="sidebar-indicator"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 3,
                  backgroundColor: palette.primary.main,
                  borderRadius: '0 2px 2px 0',
                }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              />
            )}
            <ListItemIcon
              sx={{
                minWidth: collapsed ? 0 : 36,
                color: isActive ? 'primary.main' : 'text.secondary',
                justifyContent: 'center',
              }}
            >
              {item.icon}
            </ListItemIcon>
            {!collapsed && (
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontSize: '0.8125rem',
                  fontWeight: isActive ? 600 : 400,
                }}
              />
            )}
          </ListItemButton>
        </Tooltip>

        {item.href === '/projects' && !collapsed && (
          <Collapse in={!!projectId && suites.length > 0}>
            <List disablePadding sx={{ pl: 1 }}>
              {groupedSuites.map((group) => {
                const groupKey = group.name || '__ungrouped__';
                const isGroupExpanded = expandedGroups.has(groupKey);
                const hasGroupHeader = !!group.name;

                return (
                  <Box key={groupKey}>
                    {hasGroupHeader && (
                      <ListItemButton
                        onClick={() => toggleGroup(groupKey)}
                        sx={{
                          minHeight: 28,
                          py: 0.25,
                          px: 1,
                          mb: 0.25,
                          borderRadius: '4px',
                        }}
                      >
                        {isGroupExpanded ? (
                          <ExpandLessIcon sx={{ fontSize: 14, color: 'text.secondary', mr: 0.5 }} />
                        ) : (
                          <ExpandMoreIcon sx={{ fontSize: 14, color: 'text.secondary', mr: 0.5 }} />
                        )}
                        <ListItemText
                          primary={group.name}
                          primaryTypographyProps={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            color: 'text.secondary',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}
                        />
                        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.6rem' }}>
                          {group.suites.length}
                        </Typography>
                      </ListItemButton>
                    )}
                    <Collapse in={isGroupExpanded || !hasGroupHeader}>
                      <List disablePadding sx={{ pl: hasGroupHeader ? 1 : 0 }}>
                        {group.suites.map((suite) => {
                          const suiteColor = semanticColors.suiteColors[suite.color_index % 5];
                          const isActiveSuite = activeSuiteId === suite.id;
                          return (
                            <ListItemButton
                              key={suite.id}
                              component={Link}
                              href={`/projects/${projectId}/suites/${suite.id}`}
                              selected={isActiveSuite}
                              sx={{
                                minHeight: 30,
                                py: 0.25,
                                px: 1.5,
                                mb: 0.25,
                                borderRadius: '4px',
                                position: 'relative',
                              }}
                            >
                              {isActiveSuite && (
                                <motion.div
                                  layoutId="sidebar-indicator"
                                  style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    bottom: 0,
                                    width: 3,
                                    backgroundColor: suiteColor,
                                    borderRadius: '0 2px 2px 0',
                                  }}
                                  transition={{ duration: 0.2, ease: 'easeOut' }}
                                />
                              )}
                              <ListItemIcon sx={{ minWidth: 20 }}>
                                <FiberManualRecordIcon
                                  sx={{ fontSize: 7, color: suiteColor }}
                                />
                              </ListItemIcon>
                              <ListItemText
                                primary={suite.name}
                                primaryTypographyProps={{
                                  fontSize: '0.7rem',
                                  fontWeight: isActiveSuite ? 600 : 400,
                                  color: isActiveSuite ? suiteColor : 'text.secondary',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              />
                              <Chip
                                label={suite.prefix}
                                size="small"
                                sx={{
                                  height: 16,
                                  fontSize: '0.55rem',
                                  fontWeight: 600,
                                  bgcolor: alpha(suiteColor, 0.12),
                                  color: suiteColor,
                                  '& .MuiChip-label': { px: 0.5 },
                                }}
                              />
                            </ListItemButton>
                          );
                        })}
                      </List>
                    </Collapse>
                  </Box>
                );
              })}
            </List>
          </Collapse>
        )}
      </Box>
    );
  };

  return (
    <Box
      component="nav"
      sx={{
        width,
        minWidth: width,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        borderRight: `1px solid ${palette.divider}`,
        transition: 'width 0.2s ease-out, min-width 0.2s ease-out',
        overflow: 'hidden',
      }}
    >
      <Link
        href="/"
        style={{ textDecoration: 'none' }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: collapsed ? 0.5 : 2,
            py: 1.5,
            minHeight: 64,
            overflow: 'hidden',
            cursor: 'pointer',
          }}
        >
          <Box
            sx={{
              width: collapsed ? 40 : '100%',
              overflow: 'hidden',
              transition: 'width 0.2s ease-out',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FullStackLogo height={28} />
          </Box>
        </Box>
      </Link>

      <Divider />

      <List sx={{ flex: 1, px: 1, py: 1.5, overflow: 'auto' }}>
        {collapsed
          ? /* Icon-only mode: flat list, no group headers */
            visibleNavItems.map((item) => renderNavItem(item))
          : /* Expanded mode: group headers + collapsible sections */
            (() => {
              const seenGroups = new Set<string>();
              const nodes: React.ReactNode[] = [];

              for (const item of visibleNavItems) {
                if (!item.group) {
                  // Top-level ungrouped item (Dashboard)
                  nodes.push(renderNavItem(item));
                  continue;
                }

                if (!seenGroups.has(item.group)) {
                  seenGroups.add(item.group);
                  const groupName = item.group;
                  const groupItems = visibleNavItems.filter((i) => i.group === groupName);
                  const isOpen = forcedOpenGroups.has(groupName) || (navGroupsOpen[groupName] ?? false);

                  nodes.push(
                    <Box key={`group-${groupName}`}>
                      {/* Group header */}
                      <ListItemButton
                        onClick={() => toggleNavGroup(groupName)}
                        sx={{
                          minHeight: 28,
                          py: 0.25,
                          px: 1,
                          mb: 0.25,
                          borderRadius: '4px',
                        }}
                      >
                        <ListItemText
                          primary={groupName}
                          primaryTypographyProps={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            color: 'text.secondary',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}
                        />
                        {isOpen
                          ? <ExpandLessIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                          : <ExpandMoreIcon sx={{ fontSize: 14, color: 'text.secondary' }} />}
                      </ListItemButton>

                      {/* Group items */}
                      <Collapse in={isOpen}>
                        {groupItems.map((gi) => renderNavItem(gi))}
                      </Collapse>
                    </Box>
                  );
                }
              }

              return nodes;
            })()
        }
      </List>

      <Divider />

      {/* Knowledge Base & Profile — visible to all roles */}
      <List sx={{ px: 1, py: 1 }}>
        {(() => {
          const kbHref = '/knowledge-base';
          const kbActive = pathname.startsWith(kbHref);
          const profileHref = '/profile';
          const profileActive = pathname.startsWith(profileHref);

          const bottomItems = [
            { href: kbHref, active: kbActive, label: 'Knowledge Base', icon: <MenuBookOutlinedIcon /> },
            { href: profileHref, active: profileActive, label: 'My Profile', icon: <AccountCircleOutlinedIcon /> },
          ];

          return bottomItems.map((item) => (
            <Tooltip key={item.href} title={collapsed ? item.label : ''} placement="right">
              <ListItemButton
                component={Link}
                href={item.href}
                selected={item.active}
                sx={{
                  minHeight: 40,
                  mb: 0.5,
                  px: collapsed ? 1.5 : 2,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {item.active && (
                  <motion.div
                    layoutId="sidebar-indicator"
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 3,
                      backgroundColor: palette.primary.main,
                      borderRadius: '0 2px 2px 0',
                    }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                  />
                )}
                <ListItemIcon
                  sx={{
                    minWidth: collapsed ? 0 : 36,
                    color: item.active ? 'primary.main' : 'text.secondary',
                    justifyContent: 'center',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                {!collapsed && (
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontSize: '0.8125rem',
                      fontWeight: item.active ? 600 : 400,
                    }}
                  />
                )}
              </ListItemButton>
            </Tooltip>
          ));
        })()}
      </List>

      <Divider />

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: collapsed ? 1.25 : 2,
          py: 1.5,
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}
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
          {profile?.full_name?.[0] ?? profile?.email?.[0] ?? '?'}
        </Avatar>
        {!collapsed && (
          <Box sx={{ overflow: 'hidden', flex: 1 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {profile?.full_name ?? 'User'}
            </Typography>
            <Chip
              label={ROLE_LABELS[role]}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.625rem',
                fontWeight: 600,
                bgcolor: alpha(roleColor, 0.15),
                color: roleColor,
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
          </Box>
        )}
      </Box>

    </Box>
  );
}
