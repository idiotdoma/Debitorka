// ============================================================
// Система разрешений (Permissions) — Этап 6
// Определяет, какие действия доступны для каждой роли
// ============================================================

import { UserRole, Permission } from '../types/models';

// Матрица разрешений для каждой роли
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    'debts:view_all',
    'debts:edit',
    'tasks:view_all',
    'tasks:create',
    'tasks:assign',
    'tasks:edit_all',
    'communications:create',
    'promises:create',
    'promises:edit_own',
    'promises:edit_team',
    'integrations:view',
    'integrations:manage',
    'users:invite',
    'users:manage',
    'teams:manage',
    'organization:settings',
    'audit:view',
    'finance:view_analytics',
    'finance:view_reports',
    'finance:export',
    'ai:use',
    'ai:manage',
  ],
  
  admin: [
    'debts:view_all',
    'debts:edit',
    'tasks:view_all',
    'tasks:create',
    'tasks:assign',
    'tasks:edit_all',
    'communications:create',
    'promises:create',
    'promises:edit_own',
    'promises:edit_team',
    'integrations:view',
    'integrations:manage',
    'users:invite',
    'users:manage',
    'teams:manage',
    'organization:settings',
    'audit:view',
    'finance:view_analytics',
    'finance:view_reports',
    'finance:export',
    'ai:use',
    'ai:manage',
  ],
  
  manager: [
    'debts:view_all',
    'tasks:view_team',
    'tasks:create',
    'tasks:assign',
    'tasks:edit_team',
    'communications:create',
    'promises:create',
    'promises:edit_own',
    'promises:edit_team',
    'integrations:view',
    'teams:manage',
    'finance:view_analytics',
    'finance:view_reports',
    'ai:use',
  ],
  
  finance: [
    'debts:view_all',
    'tasks:view_all',
    'tasks:create',
    'tasks:edit_own',
    'communications:create',
    'promises:create',
    'promises:edit_own',
    'integrations:view',
    'finance:view_analytics',
    'finance:view_reports',
    'finance:export',
    'ai:use',
  ],
  
  employee: [
    'debts:view_assigned',
    'tasks:view_own',
    'tasks:edit_own',
    'communications:create',
    'promises:create',
    'promises:edit_own',
    'ai:use',
  ],
  
  viewer: [
    'debts:view_assigned',
    'tasks:view_own',
    'finance:view_reports',
  ],
  
  platform_admin: [
    'audit:view',
  ],
};

export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  return permissions.includes(permission);
}

export function hasAnyPermission(userRole: UserRole, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(userRole, p));
}

export function hasAllPermissions(userRole: UserRole, permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(userRole, p));
}

export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

export function canViewDebts(role: UserRole): boolean {
  return hasAnyPermission(role, ['debts:view_all', 'debts:view_assigned']);
}

export function canViewAllDebts(role: UserRole): boolean {
  return hasPermission(role, 'debts:view_all');
}

export function canCreateTasks(role: UserRole): boolean {
  return hasPermission(role, 'tasks:create');
}

export function canAssignTasks(role: UserRole): boolean {
  return hasPermission(role, 'tasks:assign');
}

export function canManageIntegrations(role: UserRole): boolean {
  return hasPermission(role, 'integrations:manage');
}

export function canInviteUsers(role: UserRole): boolean {
  return hasPermission(role, 'users:invite');
}

export function canManageUsers(role: UserRole): boolean {
  return hasPermission(role, 'users:manage');
}

export function canManageTeams(role: UserRole): boolean {
  return hasPermission(role, 'teams:manage');
}

export function canViewFinanceAnalytics(role: UserRole): boolean {
  return hasPermission(role, 'finance:view_analytics');
}

export function canUseAI(role: UserRole): boolean {
  return hasPermission(role, 'ai:use');
}

export function isOwner(role: UserRole): boolean {
  return role === 'owner';
}

export function isAdmin(role: UserRole): boolean {
  return role === 'admin' || role === 'owner';
}

export function isManager(role: UserRole): boolean {
  return role === 'manager';
}

export function isFinance(role: UserRole): boolean {
  return role === 'finance';
}

export function isEmployee(role: UserRole): boolean {
  return role === 'employee';
}

export function isViewer(role: UserRole): boolean {
  return role === 'viewer';
}

export function getRoleMetadata(role: UserRole): {
  label: string;
  description: string;
  color: string;
  icon: string;
} {
  const metadata: Record<UserRole, { label: string; description: string; color: string; icon: string }> = {
    owner: {
      label: 'Владелец',
      description: 'Полный доступ ко всем функциям организации',
      color: 'purple',
      icon: 'crown',
    },
    admin: {
      label: 'Администратор',
      description: 'Управление пользователями и настройками',
      color: 'red',
      icon: 'shield',
    },
    manager: {
      label: 'Руководитель',
      description: 'Управление командой и задачами',
      color: 'blue',
      icon: 'users',
    },
    finance: {
      label: 'Финансовый специалист',
      description: 'Работа с финансовой аналитикой',
      color: 'green',
      icon: 'dollar',
    },
    employee: {
      label: 'Сотрудник',
      description: 'Работа с задачами и контрагентами',
      color: 'yellow',
      icon: 'user',
    },
    viewer: {
      label: 'Наблюдатель',
      description: 'Только просмотр данных',
      color: 'gray',
      icon: 'eye',
    },
    platform_admin: {
      label: 'Администратор платформы',
      description: 'Техническое управление сервисом',
      color: 'indigo',
      icon: 'settings',
    },
  };
  
  return metadata[role] || metadata.employee;
}
