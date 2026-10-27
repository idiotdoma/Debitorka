// ============================================================
// Модели данных — Этап 6.1
// ============================================================

export type UUID = string;

// --- Роли пользователей ---

export type UserRole = 
  | 'owner'           // Владелец организации
  | 'admin'           // Администратор
  | 'manager'         // Руководитель команды
  | 'finance'         // Финансовый специалист
  | 'employee'        // Сотрудник
  | 'viewer';         // Наблюдатель

// --- Организация ---

export interface Organization {
  id: UUID;
  name: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

// --- Пользователь ---

export interface User {
  id: UUID;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName?: string;
  organizationId: UUID;
  role: UserRole;
  teamId?: UUID;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Сессия ---

export interface AuthSession {
  userId: UUID;
  organizationId: UUID;
  token: string;
  expiresAt: string;
}

// --- Команда ---

export interface Team {
  id: UUID;
  organizationId: UUID;
  name: string;
  description?: string;
  managerId?: UUID;
  createdAt: string;
  updatedAt: string;
}

// --- Приглашение ---

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface Invitation {
  id: UUID;
  organizationId: UUID;
  email: string;
  role: UserRole;
  teamId?: UUID;
  token: string;
  tokenHash: string;
  status: InvitationStatus;
  invitedBy: UUID;
  expiresAt: string;
  acceptedAt?: string;
  createdAt: string;
}

// --- Задолженность (упрощённая для демо) ---

export interface DebtRecord {
  id: UUID;
  organizationId: UUID;
  counterpartyName: string;
  amountCents: number;
  dueDate?: string;
  createdAt: string;
}

// --- Задача ---

export interface Task {
  id: UUID;
  organizationId: UUID;
  title: string;
  assignedTo: UUID;
  createdBy: UUID;
  status: 'new' | 'in_progress' | 'completed';
  dueDate?: string;
  createdAt: string;
}
