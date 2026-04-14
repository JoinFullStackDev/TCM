import type { UserRole } from '@/types/database';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  viewer: 0,
  qa_engineer: 1,
  sdet: 2,
  admin: 3,
};

export type Permission =
  | 'read'
  | 'write'
  | 'delete'
  | 'soft_delete'
  | 'manage_users'
  | 'manage_integrations'
  | 'view_webhooks'
  | 'manage_webhooks'
  | 'delete_project'
  | 'export';

const PERMISSION_MAP: Record<Permission, UserRole[]> = {
  read: ['viewer', 'qa_engineer', 'sdet', 'admin'],
  write: ['qa_engineer', 'sdet', 'admin'],
  delete: ['admin'],
  /** soft_delete — Editor+ (qa_engineer and above) can move test cases to trash and restore them. Viewers get 403. */
  soft_delete: ['qa_engineer', 'sdet', 'admin'],
  manage_users: ['admin'],
  manage_integrations: ['sdet', 'admin'],
  view_webhooks: ['sdet', 'admin'],
  manage_webhooks: ['admin'],
  delete_project: ['admin'],
  /** export — viewers excluded; qa_engineer, sdet, admin can export */
  export: ['qa_engineer', 'sdet', 'admin'],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return PERMISSION_MAP[permission].includes(role);
}

export function hasMinRole(role: UserRole, minRole: UserRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole];
}

export function getRoleLevel(role: UserRole): number {
  return ROLE_HIERARCHY[role];
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  sdet: 'SDET',
  qa_engineer: 'QA Engineer',
  viewer: 'Viewer',
};

export const ALL_ROLES: UserRole[] = ['admin', 'sdet', 'qa_engineer', 'viewer'];
