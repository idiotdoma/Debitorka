// ============================================================
// Система разрешений (Permissions)
// ============================================================

import { UserRole } from '../types/models';

export type Permission = 
  | 'debts:view_all'
  | 'debts:view_assigned'
  | 'tasks:view_all'
  | 'tasks:view_team'
  | 'tasks:view_own'
  | 'tasks:create'
  | 'tasks:assign'
  | 'tasks:edit_own'
  | 'teams:manage'
  | 'users:invite'
  | 'users:manage'
  | 'organization:settings'
  | 'finance:view_analytics'
  | 'ai:use';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    'debts:view_all',
    'tasks:view_all',
    'tasks:create',
    'tasks:assign',
    'tasks:edit_own',
    'teams:manage',
    'users:invite',
    'users:manage',
    'organization:settings',
    'finance:view_analytics',
    'ai:use',
  ],
  admin: [
    'debts:view_all',
    'tasks:view_all',
    'tasks:create',
    'tasks:assign',
    'tasks:edit_own',
    'teams:manage',
    'users:invite',
    'users:manage',
    'organization:settings',
    'finance:view_analytics',
    'ai:use',
  ],
  manager: [
    'debts:view_all',
    'tasks:view_team',
    'tasks:create',
    'tasks:assign',
    'teams:manage',
    'finance:view_analytics',
    'ai:use',
  ],
  finance: [
    'debts:view_all',
    'tasks:view_all',
    'tasks:create',
    'tasks:edit_own',
    'finance:view_analytics',
    'ai:use',
  ],
  employee: [
    'debts:view_assigned',
    'tasks:view_own',
    'tasks:edit_own',
    'ai:use',
  ],
  viewer: [
    'debts:view_assigned',
    'tasks:view_own',
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

export function canViewAllDebts(role: UserRole): boolean {
  return hasPermission(role, 'debts:view_all');
}

export function canManageUsers(role: UserRole): boolean {
  return hasPermission(role, 'users:manage');
}

export function canManageTeams(role: UserRole): boolean {
  return hasPermission(role, 'teams:manage');
}

export function canInviteUsers(role: UserRole): boolean {
  return hasPermission(role, 'users:invite');
}

export function canViewFinanceAnalytics(role: UserRole): boolean {
  return hasPermission(role, 'finance:view_analytics');
}

export function getRoleMetadata(role: UserRole): { label: string; description: string; color: string } {
  const metadata: Record<UserRole, { label: string; description: string; color: string }> = {
    owner: { label: 'Владелец', description: 'Полный доступ', color: 'purple' },
    admin: { label: 'Администратор', description: 'Управление пользователями', color: 'red' },
    manager: { label: 'Руководитель', description: 'Управление командой', color: 'blue' },
    finance: { label: 'Финансовый специалист', description: 'Финансовая аналитика', color: 'green' },
    employee: { label: 'Сотрудник', description: 'Работа с задачами', color: 'yellow' },
    viewer: { label: 'Наблюдатель', description: 'Только просмотр', color: 'gray' },
  };
  return metadata[role];
}
