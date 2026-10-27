// ============================================================
// Система разрешений (Permissions) — Этап 6
// Определяет, какие действия доступны для каждой роли
// ============================================================

import { UserRole, Permission } from '../types/models';

// Матрица разрешений для каждой роли
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  // Владелец организации — полный доступ
  owner: [
    // Задолженность
    'debts:view_all',
    'debts:edit',
    
    // Задачи
    'tasks:view_all',
    'tasks:create',
    'tasks:assign',
    'tasks:edit_all',
    
    // Коммуникации и обещания
    'communications:create',
    'promises:create',
    'promises:edit_own',
    'promises:edit_team',
    
    // Интеграции
    'integrations:view',
    'integrations:manage',
    
    // Управление
    'users:invite',
    'users:manage',
    'teams:manage',
    'organization:settings',
    'audit:view',
    
    // Финансы
    'finance:view_analytics',
    'finance:view_reports',
    'finance:export',
    
    // ИИ
    'ai:use',
    'ai:manage',
  ],
  
  // Администратор организации — почти полный доступ, кроме некоторых настроек
  admin: [
    // Задолженность
    'debts:view_all',
    'debts:edit',
    
    // Задачи
    'tasks:view_all',
    'tasks:create',
    'tasks:assign',
    'tasks:edit_all',
    
    // Коммуникации и обещания
    'communications:create',
    'promises:create',
    'promises:edit_own',
    'promises:edit_team',
    
    // Интеграции
    'integrations:view',
    'integrations:manage',
    
    // Управление
    'users:invite',
    'users:manage',
    'teams:manage',
    'organization:settings',
    'audit:view',
    
    // Финансы
    'finance:view_analytics',
    'finance:view_reports',
    'finance:export',
    
    // ИИ
    'ai:use',
    'ai:manage',
  ],
  
  // Руководитель команды — доступ к своей команде
  manager: [
    // Задолженность
    'debts:view_all',
    
    // Задачи
    'tasks:view_team',
    'tasks:create',
    'tasks:assign',
    'tasks:edit_team',
    
    // Коммуникации и обещания
    'communications:create',
    'promises:create',
    'promises:edit_own',
    'promises:edit_team',
    
    // Интеграции
    'integrations:view',
    
    // Управление
    'teams:manage',
    
    // Финансы
    'finance:view_analytics',
    'finance:view_reports',
    
    // ИИ
    'ai:use',
  ],
  
  // Финансовый специалист — доступ к финансовой аналитике
  finance: [
    // Задолженность
    'debts:view_all',
    
    // Задачи
    'tasks:view_all',
    'tasks:create',
    'tasks:edit_own',
    
    // Коммуникации и обещания
    'communications:create',
    'promises:create',
    'promises:edit_own',
    
    // Интеграции
    'integrations:view',
    
    // Финансы
    'finance:view_analytics',
    'finance:view_reports',
    'finance:export',
    
    // ИИ
    'ai:use',
  ],
  
  // Сотрудник по работе с должниками — базовый доступ
  employee: [
    // Задолженность
    'debts:view_assigned',
    
    // Задачи
    'tasks:view_own',
    'tasks:edit_own',
    
    // Коммуникации и обещания
    'communications:create',
    'promises:create',
    'promises:edit_own',
    
    // ИИ
    'ai:use',
  ],
  
  // Наблюдатель — только чтение
  viewer: [
    // Задолженность
    'debts:view_assigned',
    
    // Задачи
    'tasks:view_own',
    
    // Финансы
    'finance:view_reports',
  ],
  
  // Администратор платформы — технический доступ (отдельная сущность)
  platform_admin: [
    // Минимальный доступ к данным организаций
    'audit:view',
  ],
};

/**
 * Проверяет, имеет ли пользователь указанное разрешение
 */
export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  return permissions.includes(permission);
}

/**
 * Проверяет, имеет ли пользователь хотя бы одно из указанных разрешений
 */
export function hasAnyPermission(userRole: UserRole, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(userRole, p));
}

/**
 * Проверяет, имеет ли пользователь все указанные разрешения
 */
export function hasAllPermissions(userRole: UserRole, permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(userRole, p));
}

/**
 * Возвращает все разрешения для указанной роли
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Проверяет, может ли пользователь просматривать задолженность
 */
export function canViewDebts(role: UserRole): boolean {
  return hasAnyPermission(role, ['debts:view_all', 'debts:view_assigned']);
}

/**
 * Проверяет, может ли пользователь просматривать все задолженности организации
 */
export function canViewAllDebts(role: UserRole): boolean {
  return hasPermission(role, 'debts:view_all');
}

/**
 * Проверяет, может ли пользователь создавать задачи
 */
export function canCreateTasks(role: UserRole): boolean {
  return hasPermission(role, 'tasks:create');
}

/**
 * Проверяет, может ли пользователь назначать задачи
 */
export function canAssignTasks(role: UserRole): boolean {
  return hasPermission(role, 'tasks:assign');
}

/**
 * Проверяет, может ли пользователь управлять интеграциями
 */
export function canManageIntegrations(role: UserRole): boolean {
  return hasPermission(role, 'integrations:manage');
}

/**
 * Проверяет, может ли пользователь приглашать сотрудников
 */
export function canInviteUsers(role: UserRole): boolean {
  return hasPermission(role, 'users:invite');
}

/**
 * Проверяет, может ли пользователь управлять пользователями
 */
export function canManageUsers(role: UserRole): boolean {
  return hasPermission(role, 'users:manage');
}

/**
 * Проверяет, может ли пользователь управлять командами
 */
export function canManageTeams(role: UserRole): boolean {
  return hasPermission(role, 'teams:manage');
}

/**
 * Проверяет, может ли пользователь просматривать финансовую аналитику
 */
export function canViewFinanceAnalytics(role: UserRole): boolean {
  return hasPermission(role, 'finance:view_analytics');
}

/**
 * Проверяет, может ли пользователь использовать ИИ-помощник
 */
export function canUseAI(role: UserRole): boolean {
  return hasPermission(role, 'ai:use');
}

/**
 * Проверяет, является ли пользователь владельцем организации
 */
export function isOwner(role: UserRole): boolean {
  return role === 'owner';
}

/**
 * Проверяет, является ли пользователь администратором
 */
export function isAdmin(role: UserRole): boolean {
  return role === 'admin' || role === 'owner';
}

/**
 * Проверяет, является ли пользователь руководителем
 */
export function isManager(role: UserRole): boolean {
  return role === 'manager';
}

/**
 * Проверяет, является ли пользователь финансовым специалистом
 */
export function isFinance(role: UserRole): boolean {
  return role === 'finance';
}

/**
 * Проверяет, является ли пользователь сотрудником
 */
export function isEmployee(role: UserRole): boolean {
  return role === 'employee';
}

/**
 * Проверяет, является ли пользователь наблюдателем
 */
export function isViewer(role: UserRole): boolean {
  return role === 'viewer';
}

/**
 * Возвращает метаданные роли (название, описание, цвет)
 */
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
