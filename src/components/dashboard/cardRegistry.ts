import type { UserRole, DashboardCardConfig } from '@/types/database';
import { hasMinRole } from '@/lib/auth/rbac';

export type CardSection = 'user' | 'global' | 'admin';

export interface CardDefinition {
  id: string;
  title: string;
  section: CardSection;
  minRole?: UserRole;
  defaultVisible: boolean;
  defaultPosition: number;
}

export const CARD_DEFINITIONS: CardDefinition[] = [
  // User section
  { id: 'my_assigned_runs', title: 'My Assigned Runs', section: 'user', defaultVisible: true, defaultPosition: 0 },
  { id: 'my_recent_activity', title: 'My Recent Activity', section: 'user', defaultVisible: true, defaultPosition: 1 },
  { id: 'my_stats', title: 'My Stats', section: 'user', defaultVisible: true, defaultPosition: 2 },

  // Global section
  { id: 'active_projects', title: 'Active Projects', section: 'global', defaultVisible: true, defaultPosition: 0 },
  { id: 'run_overview', title: 'Test Run Overview', section: 'global', defaultVisible: true, defaultPosition: 1 },
  { id: 'recent_runs', title: 'Recent Runs', section: 'global', defaultVisible: true, defaultPosition: 2 },
  { id: 'pass_rate_summary', title: 'Pass Rate (30d)', section: 'global', defaultVisible: true, defaultPosition: 3 },
  { id: 'platform_coverage', title: 'Platform Coverage', section: 'global', defaultVisible: true, defaultPosition: 4 },

  // Admin section
  { id: 'user_activity', title: 'User Activity', section: 'admin', minRole: 'admin', defaultVisible: true, defaultPosition: 0 },
  { id: 'pending_invitations', title: 'Pending Invitations', section: 'admin', minRole: 'admin', defaultVisible: true, defaultPosition: 1 },
  { id: 'system_stats', title: 'System Stats', section: 'admin', minRole: 'admin', defaultVisible: true, defaultPosition: 2 },
  { id: 'webhook_health', title: 'Webhook Health', section: 'admin', minRole: 'admin', defaultVisible: true, defaultPosition: 3 },
  { id: 'import_activity', title: 'Import Activity', section: 'admin', minRole: 'admin', defaultVisible: true, defaultPosition: 4 },
];

export function getVisibleCards(
  role: UserRole,
  preferences?: DashboardCardConfig[] | null,
): { section: CardSection; cards: CardDefinition[] }[] {
  const eligible = CARD_DEFINITIONS.filter(
    (c) => !c.minRole || hasMinRole(role, c.minRole),
  );

  const prefMap = new Map(
    (preferences ?? []).map((p) => [p.card_id, p]),
  );

  const resolved = eligible.map((card) => {
    const pref = prefMap.get(card.id);
    return {
      ...card,
      visible: pref ? pref.visible : card.defaultVisible,
      position: pref ? pref.position : card.defaultPosition,
    };
  });

  const visible = resolved.filter((c) => c.visible);

  const sections: CardSection[] = ['user', 'global', 'admin'];
  return sections
    .map((section) => ({
      section,
      cards: visible
        .filter((c) => c.section === section)
        .sort((a, b) => a.position - b.position),
    }))
    .filter((s) => s.cards.length > 0);
}

export function getDefaultConfig(): DashboardCardConfig[] {
  return CARD_DEFINITIONS.map((c) => ({
    card_id: c.id,
    visible: c.defaultVisible,
    position: c.defaultPosition,
  }));
}
