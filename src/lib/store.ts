// ============================================================
// Хранилище с tenant isolation
// ============================================================

import { Organization, User, AuthSession, Team, Invitation, DebtRecord, Task, UUID } from '../types/models';

const STORAGE_PREFIX = 'debitor_';

function getKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

function getItem<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(getKey(key));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setItem<T>(key: string, items: T[]): void {
  localStorage.setItem(getKey(key), JSON.stringify(items));
}

// Проверка tenant isolation
function assertTenantAccess(organizationId: UUID, session: AuthSession | null): void {
  if (!session) {
    throw new Error('UNAUTHORIZED: Нет активной сессии');
  }
  if (session.organizationId !== organizationId) {
    throw new Error('FORBIDDEN: Попытка доступа к данным другой организации');
  }
}

// --- Organizations ---

export const orgStore = {
  getAll(): Organization[] {
    return getItem<Organization>('organizations');
  },
  
  getById(id: UUID): Organization | undefined {
    return this.getAll().find(o => o.id === id);
  },
  
  create(org: Organization): Organization {
    const orgs = this.getAll();
    orgs.push(org);
    setItem('organizations', orgs);
    return org;
  },
};

// --- Users ---

export const userStore = {
  getAll(): User[] {
    return getItem<User>('users');
  },
  
  getByOrganization(organizationId: UUID, session: AuthSession | null): User[] {
    assertTenantAccess(organizationId, session);
    return this.getAll().filter(u => u.organizationId === organizationId);
  },
  
  getById(id: UUID): User | undefined {
    return this.getAll().find(u => u.id === id);
  },
  
  getByEmail(email: string): User | undefined {
    return this.getAll().find(u => u.email.toLowerCase() === email.toLowerCase());
  },
  
  create(user: User): User {
    const users = this.getAll();
    users.push(user);
    setItem('users', users);
    return user;
  },
  
  update(id: UUID, updateData: Partial<User>): User | undefined {
    const users = this.getAll();
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return undefined;
    users[idx] = { ...users[idx], ...updateData, updatedAt: new Date().toISOString() };
    setItem('users', users);
    return users[idx];
  },
};

// --- Auth ---

export const authStore = {
  getSession(): AuthSession | null {
    try {
      const raw = localStorage.getItem(getKey('session'));
      if (!raw) return null;
      const session: AuthSession = JSON.parse(raw);
      if (new Date(session.expiresAt) < new Date()) {
        this.clearSession();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  },
  
  setSession(session: AuthSession): void {
    localStorage.setItem(getKey('session'), JSON.stringify(session));
  },
  
  clearSession(): void {
    localStorage.removeItem(getKey('session'));
  },
};

// --- Teams ---

export const teamStore = {
  getAll(organizationId: UUID, session: AuthSession | null): Team[] {
    assertTenantAccess(organizationId, session);
    return getItem<Team>('teams').filter(t => t.organizationId === organizationId);
  },
  
  getById(id: UUID, organizationId: UUID, session: AuthSession | null): Team | undefined {
    assertTenantAccess(organizationId, session);
    return getItem<Team>('teams').find(t => t.id === id && t.organizationId === organizationId);
  },
  
  create(team: Team): Team {
    const teams = getItem<Team>('teams');
    teams.push(team);
    setItem('teams', teams);
    return team;
  },
  
  update(id: UUID, updateData: Partial<Team>, organizationId: UUID, session: AuthSession | null): Team | undefined {
    assertTenantAccess(organizationId, session);
    const teams = getItem<Team>('teams');
    const idx = teams.findIndex(t => t.id === id && t.organizationId === organizationId);
    if (idx === -1) return undefined;
    teams[idx] = { ...teams[idx], ...updateData, updatedAt: new Date().toISOString() };
    setItem('teams', teams);
    return teams[idx];
  },
};

// --- Invitations ---

export const invitationStore = {
  getAll(organizationId: UUID, session: AuthSession | null): Invitation[] {
    assertTenantAccess(organizationId, session);
    return getItem<Invitation>('invitations').filter(i => i.organizationId === organizationId);
  },
  
  getByToken(tokenHash: string): Invitation | undefined {
    return getItem<Invitation>('invitations').find(i => i.tokenHash === tokenHash);
  },
  
  create(invitation: Invitation): Invitation {
    const invitations = getItem<Invitation>('invitations');
    invitations.push(invitation);
    setItem('invitations', invitations);
    return invitation;
  },
  
  update(id: UUID, updateData: Partial<Invitation>, organizationId: UUID, session: AuthSession | null): Invitation | undefined {
    assertTenantAccess(organizationId, session);
    const invitations = getItem<Invitation>('invitations');
    const idx = invitations.findIndex(i => i.id === id && i.organizationId === organizationId);
    if (idx === -1) return undefined;
    invitations[idx] = { ...invitations[idx], ...updateData };
    setItem('invitations', invitations);
    return invitations[idx];
  },
};

// --- Debts ---

export const debtStore = {
  getAll(organizationId: UUID, session: AuthSession | null): DebtRecord[] {
    assertTenantAccess(organizationId, session);
    return getItem<DebtRecord>('debts').filter(d => d.organizationId === organizationId);
  },
  
  create(debt: DebtRecord): DebtRecord {
    const debts = getItem<DebtRecord>('debts');
    debts.push(debt);
    setItem('debts', debts);
    return debt;
  },
};

// --- Tasks ---

export const taskStore = {
  getAll(organizationId: UUID, session: AuthSession | null): Task[] {
    assertTenantAccess(organizationId, session);
    return getItem<Task>('tasks').filter(t => t.organizationId === organizationId);
  },
  
  getByAssignee(assignedTo: UUID, organizationId: UUID, session: AuthSession | null): Task[] {
    assertTenantAccess(organizationId, session);
    return getItem<Task>('tasks').filter(t => t.assignedTo === assignedTo && t.organizationId === organizationId);
  },
  
  create(task: Task): Task {
    const tasks = getItem<Task>('tasks');
    tasks.push(task);
    setItem('tasks', tasks);
    return task;
  },
  
  update(id: UUID, updateData: Partial<Task>, organizationId: UUID, session: AuthSession | null): Task | undefined {
    assertTenantAccess(organizationId, session);
    const tasks = getItem<Task>('tasks');
    const idx = tasks.findIndex(t => t.id === id && t.organizationId === organizationId);
    if (idx === -1) return undefined;
    tasks[idx] = { ...tasks[idx], ...updateData };
    setItem('tasks', tasks);
    return tasks[idx];
  },
};

// --- Reset ---

export function resetAllData(): void {
  const keys = ['organizations', 'users', 'session', 'teams', 'invitations', 'debts', 'tasks'];
  keys.forEach(key => localStorage.removeItem(getKey(key)));
}
