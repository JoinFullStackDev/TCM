'use client';

import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import PageTransition from '@/components/animations/PageTransition';
import { useAuth } from '@/components/providers/AuthProvider';
import { getVisibleCards, type CardSection } from './cardRegistry';
import CustomizeDrawer from './CustomizeDrawer';
import MyAssignedRuns from './cards/MyAssignedRuns';
import MyRecentActivity from './cards/MyRecentActivity';
import MyStats from './cards/MyStats';
import ActiveProjects from './cards/ActiveProjects';
import RunOverview from './cards/RunOverview';
import RecentRuns from './cards/RecentRuns';
import PassRateSummary from './cards/PassRateSummary';
import PlatformCoverage from './cards/PlatformCoverage';
import UserActivity from './cards/UserActivity';
import PendingInvitations from './cards/PendingInvitations';
import SystemStats from './cards/SystemStats';
import WebhookHealth from './cards/WebhookHealth';
import ImportActivity from './cards/ImportActivity';
import type {
  DashboardSummary,
  DashboardCardConfig,
} from '@/types/database';

const CARD_COMPONENTS: Record<string, React.ComponentType<{ data: unknown; index: number }>> = {
  my_assigned_runs: MyAssignedRuns as React.ComponentType<{ data: unknown; index: number }>,
  my_recent_activity: MyRecentActivity as React.ComponentType<{ data: unknown; index: number }>,
  my_stats: MyStats as React.ComponentType<{ data: unknown; index: number }>,
  active_projects: ActiveProjects as React.ComponentType<{ data: unknown; index: number }>,
  run_overview: RunOverview as React.ComponentType<{ data: unknown; index: number }>,
  recent_runs: RecentRuns as React.ComponentType<{ data: unknown; index: number }>,
  pass_rate_summary: PassRateSummary as React.ComponentType<{ data: unknown; index: number }>,
  platform_coverage: PlatformCoverage as React.ComponentType<{ data: unknown; index: number }>,
  user_activity: UserActivity as React.ComponentType<{ data: unknown; index: number }>,
  pending_invitations: PendingInvitations as React.ComponentType<{ data: unknown; index: number }>,
  system_stats: SystemStats as React.ComponentType<{ data: unknown; index: number }>,
  webhook_health: WebhookHealth as React.ComponentType<{ data: unknown; index: number }>,
  import_activity: ImportActivity as React.ComponentType<{ data: unknown; index: number }>,
};

const DATA_KEYS: Record<string, { section: keyof DashboardSummary; key: string }> = {
  my_assigned_runs: { section: 'user_section', key: 'my_assigned_runs' },
  my_recent_activity: { section: 'user_section', key: 'my_recent_activity' },
  my_stats: { section: 'user_section', key: 'my_stats' },
  active_projects: { section: 'global_section', key: 'active_projects' },
  run_overview: { section: 'global_section', key: 'run_overview' },
  recent_runs: { section: 'global_section', key: 'recent_runs' },
  pass_rate_summary: { section: 'global_section', key: 'pass_rate_summary' },
  platform_coverage: { section: 'global_section', key: 'platform_coverage' },
  user_activity: { section: 'admin_section', key: 'user_activity' },
  pending_invitations: { section: 'admin_section', key: 'pending_invitations' },
  system_stats: { section: 'admin_section', key: 'system_stats' },
  webhook_health: { section: 'admin_section', key: 'webhook_health' },
  import_activity: { section: 'admin_section', key: 'import_activity' },
};

const SECTION_LABELS: Record<CardSection, string> = {
  user: 'Your Overview',
  global: 'Platform',
  admin: 'Administration',
};

function getCardData(summary: DashboardSummary, cardId: string): unknown {
  const mapping = DATA_KEYS[cardId];
  if (!mapping) return null;
  const sectionData = summary[mapping.section];
  if (!sectionData) return null;
  return (sectionData as unknown as Record<string, unknown>)[mapping.key] ?? null;
}

export default function DashboardPage() {
  const { profile, role, can, isLoading: authLoading } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [preferences, setPreferences] = useState<DashboardCardConfig[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isAdmin = can('manage_users');

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPreferences = useCallback(async () => {
    const res = await fetch('/api/dashboard/preferences');
    if (res.ok) {
      const data = await res.json();
      if (data?.card_config) {
        setPreferences(data.card_config);
      }
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    fetchDashboard();
    if (isAdmin) fetchPreferences();
  }, [authLoading, fetchDashboard, fetchPreferences, isAdmin]);

  const handlePreferencesSaved = useCallback((config: DashboardCardConfig[]) => {
    setPreferences(config);
  }, []);

  if (authLoading || loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const sections = getVisibleCards(role, preferences);

  return (
    <PageTransition>
      <Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 3,
          }}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {profile?.full_name ? `Welcome, ${profile.full_name.split(' ')[0]}` : 'Dashboard'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Here&apos;s what&apos;s happening across your projects
            </Typography>
          </Box>
          {isAdmin && (
            <Tooltip title="Customize dashboard">
              <IconButton onClick={() => setDrawerOpen(true)} size="small">
                <TuneOutlinedIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {sections.map((section) => (
          <Box key={section.section} sx={{ mb: 4 }}>
            <Typography
              variant="overline"
              sx={{
                color: 'text.secondary',
                fontWeight: 700,
                letterSpacing: '0.08em',
                mb: 2,
                display: 'block',
              }}
            >
              {SECTION_LABELS[section.section]}
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'repeat(2, 1fr)',
                  lg: 'repeat(3, 1fr)',
                },
                gap: 2,
              }}
            >
              {section.cards.map((card, i) => {
                const Component = CARD_COMPONENTS[card.id];
                if (!Component) return null;
                const data = summary ? getCardData(summary, card.id) : null;
                return (
                  <Component
                    key={card.id}
                    data={data}
                    index={i}
                  />
                );
              })}
            </Box>
          </Box>
        ))}

        {isAdmin && (
          <CustomizeDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            preferences={preferences}
            onSaved={handlePreferencesSaved}
          />
        )}
      </Box>
    </PageTransition>
  );
}
