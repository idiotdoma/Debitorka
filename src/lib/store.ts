// ============================================================
// Хранилище с tenant isolation
// Все операции проверяют organizationId
// ============================================================

import { Organization, User, AuthSession, DebtRecord, ContactInfo, PaymentPromise, Task, Communication, Notification, ActivityAudit, ImportBatch, UUID, Team, Invitation, CounterpartyAssignment, UserPreferences, DebtSnapshot, DataQualityIssue, SavedReportView } from '../types/models';
import type { IntegrationConnection, SyncHistory } from '../types/integration';

const STORAGE_PREFIX = 'debitor_';

// --- Generic storage helpers ---

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

function setItem<T>(key: string, data: T[]): void {
  localStorage.setItem(getKey(key), JSON.stringify(data));
}

// ============================================================
// TENANT ISOLATION: Все запросы данных фильтруются по organizationId
// ============================================================

/**
 * Проверяет, что пользователь принадлежит организации и возвращает данные ТОЛЬКО этой организации.
 * Это критическая функция безопасности.
 */
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
    const orgs = getItem<Organization>('organizations');
    // Миграция: добавляем значения по умолчанию для старых данных
    return orgs.map(o => ({
      ...o,
      timezone: o.timezone || 'Europe/Moscow',
      staleDataThresholdHours: o.staleDataThresholdHours ?? 24,
    }));
  },
  
  getById(id: UUID): Organization | undefined {
    const org = this.getAll().find(o => o.id === id);
    if (org) {
      return {
        ...org,
        timezone: org.timezone || 'Europe/Moscow',
        staleDataThresholdHours: org.staleDataThresholdHours ?? 24,
      };
    }
    return undefined;
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
  
  update(id: UUID, data: Partial<User>): User | undefined {
    const users = this.getAll();
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return undefined;
    users[idx] = { ...users[idx], ...data };
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

// --- Debt Records (с tenant isolation) ---

export const debtStore = {
  getAll(organizationId: UUID, session: AuthSession | null): DebtRecord[] {
    assertTenantAccess(organizationId, session);
    const debts = getItem<DebtRecord>('debts').filter(d => d.organizationId === organizationId);
    // Миграция: добавляем значения по умолчанию для старых данных
    return debts.map(d => {
      const legacy = d as any;
      return {
        ...d,
        documentKey: d.documentKey || `${(d.counterpartyName || '').toLowerCase()}|${(legacy.invoiceNumber || d.docNumber || '').toLowerCase()}`,
        docNumber: d.docNumber || legacy.invoiceNumber || '',
        amountCents: d.amountCents ?? (legacy.amount ? Math.round(legacy.amount * 100) : 0),
        overdueDays: d.overdueDays === undefined ? null : d.overdueDays,
        lastSourceUpdate: d.lastSourceUpdate || d.createdAt,
      };
    });
  },
  
  getById(id: UUID, organizationId: UUID, session: AuthSession | null): DebtRecord | undefined {
    assertTenantAccess(organizationId, session);
    const debt = getItem<DebtRecord>('debts').find(d => d.id === id && d.organizationId === organizationId);
    if (debt) {
      const legacy = debt as any;
      return {
        ...debt,
        documentKey: debt.documentKey || `${(debt.counterpartyName || '').toLowerCase()}|${(legacy.invoiceNumber || debt.docNumber || '').toLowerCase()}`,
        docNumber: debt.docNumber || legacy.invoiceNumber || '',
        amountCents: debt.amountCents ?? (legacy.amount ? Math.round(legacy.amount * 100) : 0),
        overdueDays: debt.overdueDays === undefined ? null : debt.overdueDays,
        lastSourceUpdate: debt.lastSourceUpdate || debt.createdAt,
      };
    }
    return undefined;
  },
  
  create(record: DebtRecord): DebtRecord {
    const debts = getItem<DebtRecord>('debts');
    debts.push(record);
    setItem('debts', debts);
    return record;
  },
  
  createMany(records: DebtRecord[]): number {
    const debts = getItem<DebtRecord>('debts');
    debts.push(...records);
    setItem('debts', debts);
    return records.length;
  },
  
  update(id: UUID, data: Partial<DebtRecord>, organizationId: UUID, session: AuthSession | null): DebtRecord | undefined {
    assertTenantAccess(organizationId, session);
    const debts = getItem<DebtRecord>('debts');
    const idx = debts.findIndex(d => d.id === id && d.organizationId === organizationId);
    if (idx === -1) return undefined;
    debts[idx] = { ...debts[idx], ...data, updatedAt: new Date().toISOString() };
    setItem('debts', debts);
    return debts[idx];
  },
  
  delete(id: UUID, organizationId: UUID, session: AuthSession | null): boolean {
    assertTenantAccess(organizationId, session);
    const debts = getItem<DebtRecord>('debts');
    const filtered = debts.filter(d => !(d.id === id && d.organizationId === organizationId));
    if (filtered.length === debts.length) return false;
    setItem('debts', filtered);
    return true;
  },
  
  findByDocumentKey(
    documentKey: string,
    organizationId: UUID,
    session: AuthSession | null
  ): DebtRecord | undefined {
    assertTenantAccess(organizationId, session);
    return getItem<DebtRecord>('debts').find(d => 
      d.documentKey === documentKey && d.organizationId === organizationId
    );
  },
};

// --- Contacts (с tenant isolation) ---

export const contactStore = {
  getAll(organizationId: UUID, session: AuthSession | null): ContactInfo[] {
    assertTenantAccess(organizationId, session);
    return getItem<ContactInfo>('contacts').filter(c => c.organizationId === organizationId);
  },
  
  getByDebt(debtRecordId: UUID, organizationId: UUID, session: AuthSession | null): ContactInfo[] {
    assertTenantAccess(organizationId, session);
    return getItem<ContactInfo>('contacts').filter(c => 
      c.debtRecordId === debtRecordId && c.organizationId === organizationId
    );
  },
  
  create(contact: ContactInfo): ContactInfo {
    const contacts = getItem<ContactInfo>('contacts');
    contacts.push(contact);
    setItem('contacts', contacts);
    return contact;
  },
  
  update(id: UUID, data: Partial<ContactInfo>, organizationId: UUID, session: AuthSession | null): ContactInfo | undefined {
    assertTenantAccess(organizationId, session);
    const contacts = getItem<ContactInfo>('contacts');
    const idx = contacts.findIndex(c => c.id === id && c.organizationId === organizationId);
    if (idx === -1) return undefined;
    contacts[idx] = { ...contacts[idx], ...data };
    setItem('contacts', contacts);
    return contacts[idx];
  },
};

// --- Payment Promises (с tenant isolation) ---

export const promiseStore = {
  getAll(organizationId: UUID, session: AuthSession | null): PaymentPromise[] {
    assertTenantAccess(organizationId, session);
    return getItem<PaymentPromise>('promises').filter(p => p.organizationId === organizationId);
  },
  
  getByDebt(debtRecordId: UUID, organizationId: UUID, session: AuthSession | null): PaymentPromise[] {
    assertTenantAccess(organizationId, session);
    return getItem<PaymentPromise>('promises').filter(p => 
      p.debtRecordId === debtRecordId && p.organizationId === organizationId
    );
  },
  
  create(promise: PaymentPromise): PaymentPromise {
    const promises = getItem<PaymentPromise>('promises');
    promises.push(promise);
    setItem('promises', promises);
    return promise;
  },
  
  update(id: UUID, data: Partial<PaymentPromise>, organizationId: UUID, session: AuthSession | null): PaymentPromise | undefined {
    assertTenantAccess(organizationId, session);
    const promises = getItem<PaymentPromise>('promises');
    const idx = promises.findIndex(p => p.id === id && p.organizationId === organizationId);
    if (idx === -1) return undefined;
    promises[idx] = { ...promises[idx], ...data, updatedAt: new Date().toISOString() };
    setItem('promises', promises);
    return promises[idx];
  },
};

// --- Tasks (с tenant isolation) ---

export const taskStore = {
  getAll(organizationId: UUID, session: AuthSession | null): Task[] {
    assertTenantAccess(organizationId, session);
    return getItem<Task>('tasks').filter(t => t.organizationId === organizationId);
  },
  
  getById(id: UUID, organizationId: UUID, session: AuthSession | null): Task | undefined {
    assertTenantAccess(organizationId, session);
    return getItem<Task>('tasks').find(t => t.id === id && t.organizationId === organizationId);
  },
  
  getByDebt(debtRecordId: UUID, organizationId: UUID, session: AuthSession | null): Task[] {
    assertTenantAccess(organizationId, session);
    return getItem<Task>('tasks').filter(t => 
      t.debtRecordId === debtRecordId && t.organizationId === organizationId
    );
  },
  
  getByCounterparty(counterpartyName: string, organizationId: UUID, session: AuthSession | null): Task[] {
    assertTenantAccess(organizationId, session);
    return getItem<Task>('tasks').filter(t => 
      t.counterpartyName === counterpartyName && t.organizationId === organizationId
    );
  },
  
  getByAssignee(assignedTo: UUID, organizationId: UUID, session: AuthSession | null): Task[] {
    assertTenantAccess(organizationId, session);
    return getItem<Task>('tasks').filter(t => 
      t.assignedTo === assignedTo && t.organizationId === organizationId
    );
  },
  
  create(task: Task): Task {
    const tasks = getItem<Task>('tasks');
    tasks.push(task);
    setItem('tasks', tasks);
    return task;
  },
  
  update(id: UUID, data: Partial<Task>, organizationId: UUID, session: AuthSession | null): Task | undefined {
    assertTenantAccess(organizationId, session);
    const tasks = getItem<Task>('tasks');
    const idx = tasks.findIndex(t => t.id === id && t.organizationId === organizationId);
    if (idx === -1) return undefined;
    tasks[idx] = { ...tasks[idx], ...data, updatedAt: new Date().toISOString() };
    setItem('tasks', tasks);
    return tasks[idx];
  },
  
  delete(id: UUID, organizationId: UUID, session: AuthSession | null): boolean {
    assertTenantAccess(organizationId, session);
    const tasks = getItem<Task>('tasks');
    const filtered = tasks.filter(t => !(t.id === id && t.organizationId === organizationId));
    if (filtered.length === tasks.length) return false;
    setItem('tasks', filtered);
    return true;
  },
};

// --- Communications (с tenant isolation) ---

export const communicationStore = {
  getAll(organizationId: UUID, session: AuthSession | null): Communication[] {
    assertTenantAccess(organizationId, session);
    return getItem<Communication>('communications').filter(c => c.organizationId === organizationId);
  },
  
  getByCounterparty(counterpartyName: string, organizationId: UUID, session: AuthSession | null): Communication[] {
    assertTenantAccess(organizationId, session);
    return getItem<Communication>('communications').filter(c => 
      c.counterpartyName === counterpartyName && c.organizationId === organizationId
    );
  },
  
  getByDebt(debtRecordId: UUID, organizationId: UUID, session: AuthSession | null): Communication[] {
    assertTenantAccess(organizationId, session);
    return getItem<Communication>('communications').filter(c => 
      c.debtRecordId === debtRecordId && c.organizationId === organizationId
    );
  },
  
  create(communication: Communication): Communication {
    const communications = getItem<Communication>('communications');
    communications.push(communication);
    setItem('communications', communications);
    return communication;
  },
  
  update(id: UUID, data: Partial<Communication>, organizationId: UUID, session: AuthSession | null): Communication | undefined {
    assertTenantAccess(organizationId, session);
    const communications = getItem<Communication>('communications');
    const idx = communications.findIndex(c => c.id === id && c.organizationId === organizationId);
    if (idx === -1) return undefined;
    communications[idx] = { ...communications[idx], ...data, updatedAt: new Date().toISOString() };
    setItem('communications', communications);
    return communications[idx];
  },
};

// --- Notifications (с tenant isolation) ---

export const notificationStore = {
  getAll(organizationId: UUID, session: AuthSession | null): Notification[] {
    assertTenantAccess(organizationId, session);
    return getItem<Notification>('notifications').filter(n => n.organizationId === organizationId);
  },
  
  getByRecipient(recipientId: UUID, organizationId: UUID, session: AuthSession | null): Notification[] {
    assertTenantAccess(organizationId, session);
    return getItem<Notification>('notifications').filter(n => 
      n.recipientId === recipientId && n.organizationId === organizationId
    );
  },
  
  getUnread(recipientId: UUID, organizationId: UUID, session: AuthSession | null): Notification[] {
    assertTenantAccess(organizationId, session);
    return getItem<Notification>('notifications').filter(n => 
      n.recipientId === recipientId && n.organizationId === organizationId && !n.isRead
    );
  },
  
  create(notification: Notification): Notification {
    const notifications = getItem<Notification>('notifications');
    const exists = notifications.some(n => n.idempotencyKey === notification.idempotencyKey);
    if (exists) return notification;
    notifications.push(notification);
    setItem('notifications', notifications);
    return notification;
  },
  
  markAsRead(id: UUID, recipientId: UUID, organizationId: UUID, session: AuthSession | null): boolean {
    assertTenantAccess(organizationId, session);
    const notifications = getItem<Notification>('notifications');
    const idx = notifications.findIndex(n => 
      n.id === id && n.recipientId === recipientId && n.organizationId === organizationId
    );
    if (idx === -1) return false;
    notifications[idx] = { ...notifications[idx], isRead: true };
    setItem('notifications', notifications);
    return true;
  },
  
  markAllAsRead(recipientId: UUID, organizationId: UUID, session: AuthSession | null): void {
    assertTenantAccess(organizationId, session);
    const notifications = getItem<Notification>('notifications');
    const updated = notifications.map(n => 
      n.recipientId === recipientId && n.organizationId === organizationId && !n.isRead
        ? { ...n, isRead: true }
        : n
    );
    setItem('notifications', updated);
  },
};

// --- Activity Audit ---

export const auditStore = {
  getAll(organizationId: UUID, session: AuthSession | null): ActivityAudit[] {
    assertTenantAccess(organizationId, session);
    return getItem<ActivityAudit>('audit').filter(a => a.organizationId === organizationId);
  },
  
  getByEntity(entityType: string, entityId: UUID, organizationId: UUID, session: AuthSession | null): ActivityAudit[] {
    assertTenantAccess(organizationId, session);
    return getItem<ActivityAudit>('audit').filter(a => 
      a.entityType === entityType && a.entityId === entityId && a.organizationId === organizationId
    );
  },
  
  getByEntityType(entityType: string, organizationId: UUID, session: AuthSession | null): ActivityAudit[] {
    assertTenantAccess(organizationId, session);
    return getItem<ActivityAudit>('audit').filter(a => 
      a.entityType === entityType && a.organizationId === organizationId
    );
  },
  
  create(audit: ActivityAudit): ActivityAudit {
    const audits = getItem<ActivityAudit>('audit');
    audits.push(audit);
    setItem('audit', audits);
    return audit;
  },
};

// --- Import Batches ---

export const importStore = {
  getAll(organizationId: UUID, session: AuthSession | null): ImportBatch[] {
    assertTenantAccess(organizationId, session);
    return getItem<ImportBatch>('imports').filter(i => i.organizationId === organizationId);
  },
  
  create(batch: ImportBatch): ImportBatch {
    const imports = getItem<ImportBatch>('imports');
    imports.push(batch);
    setItem('imports', imports);
    return batch;
  },
  
  update(id: UUID, data: Partial<ImportBatch>, organizationId: UUID, session: AuthSession | null): ImportBatch | undefined {
    assertTenantAccess(organizationId, session);
    const imports = getItem<ImportBatch>('imports');
    const idx = imports.findIndex(i => i.id === id && i.organizationId === organizationId);
    if (idx === -1) return undefined;
    imports[idx] = { ...imports[idx], ...data };
    setItem('imports', imports);
    return imports[idx];
  },
};

// --- Integration Connections (с tenant isolation) ---

export const integrationStore = {
  getAll(organizationId: UUID, session: AuthSession | null): IntegrationConnection[] {
    assertTenantAccess(organizationId, session);
    return getItem<IntegrationConnection>('integrations').filter(c => c.organizationId === organizationId);
  },
  
  getById(id: UUID, organizationId: UUID, session: AuthSession | null): IntegrationConnection | undefined {
    assertTenantAccess(organizationId, session);
    return getItem<IntegrationConnection>('integrations').find(c => 
      c.id === id && c.organizationId === organizationId
    );
  },
  
  create(connection: IntegrationConnection): IntegrationConnection {
    const connections = getItem<IntegrationConnection>('integrations');
    connections.push(connection);
    setItem('integrations', connections);
    return connection;
  },
  
  update(id: UUID, data: Partial<IntegrationConnection>, organizationId: UUID, session: AuthSession | null): IntegrationConnection | undefined {
    assertTenantAccess(organizationId, session);
    const connections = getItem<IntegrationConnection>('integrations');
    const idx = connections.findIndex(c => c.id === id && c.organizationId === organizationId);
    if (idx === -1) return undefined;
    connections[idx] = { ...connections[idx], ...data, updatedAt: new Date().toISOString() };
    setItem('integrations', connections);
    return connections[idx];
  },
  
  delete(id: UUID, organizationId: UUID, session: AuthSession | null): boolean {
    assertTenantAccess(organizationId, session);
    const connections = getItem<IntegrationConnection>('integrations');
    const filtered = connections.filter(c => !(c.id === id && c.organizationId === organizationId));
    if (filtered.length === connections.length) return false;
    setItem('integrations', filtered);
    return true;
  },
};

// --- Sync History (с tenant isolation) ---

export const syncHistoryStore = {
  getAll(organizationId: UUID, session: AuthSession | null): SyncHistory[] {
    assertTenantAccess(organizationId, session);
    return getItem<SyncHistory>('sync_history').filter(h => h.organizationId === organizationId);
  },
  
  getByConnection(connectionId: UUID, organizationId: UUID, session: AuthSession | null): SyncHistory[] {
    assertTenantAccess(organizationId, session);
    return getItem<SyncHistory>('sync_history').filter(h => 
      h.connectionId === connectionId && h.organizationId === organizationId
    );
  },
  
  create(history: SyncHistory): SyncHistory {
    const histories = getItem<SyncHistory>('sync_history');
    histories.push(history);
    setItem('sync_history', histories);
    return history;
  },
  
  update(id: UUID, data: Partial<SyncHistory>, organizationId: UUID, session: AuthSession | null): SyncHistory | undefined {
    assertTenantAccess(organizationId, session);
    const histories = getItem<SyncHistory>('sync_history');
    const idx = histories.findIndex(h => h.id === id && h.organizationId === organizationId);
    if (idx === -1) return undefined;
    histories[idx] = { ...histories[idx], ...data };
    setItem('sync_history', histories);
    return histories[idx];
  },
};

// --- Teams (с tenant isolation) ---

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
  
  update(id: UUID, data: Partial<Team>, organizationId: UUID, session: AuthSession | null): Team | undefined {
    assertTenantAccess(organizationId, session);
    const teams = getItem<Team>('teams');
    const idx = teams.findIndex(t => t.id === id && t.organizationId === organizationId);
    if (idx === -1) return undefined;
    teams[idx] = { ...teams[idx], ...data, updatedAt: new Date().toISOString() };
    setItem('teams', teams);
    return teams[idx];
  },
  
  delete(id: UUID, organizationId: UUID, session: AuthSession | null): boolean {
    assertTenantAccess(organizationId, session);
    const teams = getItem<Team>('teams');
    const filtered = teams.filter(t => !(t.id === id && t.organizationId === organizationId));
    if (filtered.length === teams.length) return false;
    setItem('teams', filtered);
    return true;
  },
};

// --- Invitations (с tenant isolation) ---

export const invitationStore = {
  getAll(organizationId: UUID, session: AuthSession | null): Invitation[] {
    assertTenantAccess(organizationId, session);
    return getItem<Invitation>('invitations').filter(i => i.organizationId === organizationId);
  },
  
  getByToken(tokenHash: string): Invitation | undefined {
    return getItem<Invitation>('invitations').find(i => i.tokenHash === tokenHash);
  },
  
  getByEmail(email: string, organizationId: UUID, session: AuthSession | null): Invitation[] {
    assertTenantAccess(organizationId, session);
    return getItem<Invitation>('invitations').filter(i => 
      i.email.toLowerCase() === email.toLowerCase() && i.organizationId === organizationId
    );
  },
  
  create(invitation: Invitation): Invitation {
    const invitations = getItem<Invitation>('invitations');
    invitations.push(invitation);
    setItem('invitations', invitations);
    return invitation;
  },
  
  update(id: UUID, data: Partial<Invitation>, organizationId: UUID, session: AuthSession | null): Invitation | undefined {
    assertTenantAccess(organizationId, session);
    const invitations = getItem<Invitation>('invitations');
    const idx = invitations.findIndex(i => i.id === id && i.organizationId === organizationId);
    if (idx === -1) return undefined;
    invitations[idx] = { ...invitations[idx], ...data };
    setItem('invitations', invitations);
    return invitations[idx];
  },
};

// --- Counterparty Assignments (с tenant isolation) ---

export const assignmentStore = {
  getAll(organizationId: UUID, session: AuthSession | null): CounterpartyAssignment[] {
    assertTenantAccess(organizationId, session);
    return getItem<CounterpartyAssignment>('assignments').filter(a => a.organizationId === organizationId);
  },
  
  getByUser(userId: UUID, organizationId: UUID, session: AuthSession | null): CounterpartyAssignment[] {
    assertTenantAccess(organizationId, session);
    return getItem<CounterpartyAssignment>('assignments').filter(a => 
      a.assignedTo === userId && a.organizationId === organizationId
    );
  },
  
  getByCounterparty(counterpartyName: string, organizationId: UUID, session: AuthSession | null): CounterpartyAssignment[] {
    assertTenantAccess(organizationId, session);
    return getItem<CounterpartyAssignment>('assignments').filter(a => 
      a.counterpartyName === counterpartyName && a.organizationId === organizationId
    );
  },
  
  create(assignment: CounterpartyAssignment): CounterpartyAssignment {
    const assignments = getItem<CounterpartyAssignment>('assignments');
    assignments.push(assignment);
    setItem('assignments', assignments);
    return assignment;
  },
  
  delete(id: UUID, organizationId: UUID, session: AuthSession | null): boolean {
    assertTenantAccess(organizationId, session);
    const assignments = getItem<CounterpartyAssignment>('assignments');
    const filtered = assignments.filter(a => !(a.id === id && a.organizationId === organizationId));
    if (filtered.length === assignments.length) return false;
    setItem('assignments', filtered);
    return true;
  },
};

// --- User Preferences ---

export const preferencesStore = {
  getByUser(userId: UUID): UserPreferences | undefined {
    const prefs = getItem<UserPreferences>('preferences');
    return prefs.find(p => p.userId === userId);
  },
  
  save(preferences: UserPreferences): UserPreferences {
    const prefs = getItem<UserPreferences>('preferences');
    const idx = prefs.findIndex(p => p.userId === preferences.userId);
    if (idx >= 0) {
      prefs[idx] = preferences;
    } else {
      prefs.push(preferences);
    }
    setItem('preferences', prefs);
    return preferences;
  },
};

// --- Snapshots (Этап 7) ---

export const snapshotStore = {
  getAll(organizationId: UUID, session: AuthSession | null): DebtSnapshot[] {
    assertTenantAccess(organizationId, session);
    return getItem<DebtSnapshot>('snapshots')
      .filter(s => s.organizationId === organizationId)
      .sort((a, b) => new Date(b.snapshotDate).getTime() - new Date(a.snapshotDate).getTime());
  },
  
  getById(id: UUID, organizationId: UUID, session: AuthSession | null): DebtSnapshot | undefined {
    assertTenantAccess(organizationId, session);
    return getItem<DebtSnapshot>('snapshots').find(s => 
      s.id === id && s.organizationId === organizationId
    );
  },
  
  create(snapshot: DebtSnapshot): DebtSnapshot {
    const snapshots = getItem<DebtSnapshot>('snapshots');
    snapshots.push(snapshot);
    setItem('snapshots', snapshots);
    return snapshot;
  },
  
  delete(id: UUID, organizationId: UUID, session: AuthSession | null): boolean {
    assertTenantAccess(organizationId, session);
    const snapshots = getItem<DebtSnapshot>('snapshots');
    const filtered = snapshots.filter(s => !(s.id === id && s.organizationId === organizationId));
    if (filtered.length === snapshots.length) return false;
    setItem('snapshots', filtered);
    return true;
  },
};

// --- Data Quality Issues (Этап 7) ---

export const dataQualityStore = {
  getAll(organizationId: UUID, session: AuthSession | null): DataQualityIssue[] {
    assertTenantAccess(organizationId, session);
    return getItem<DataQualityIssue>('data_quality')
      .filter(i => i.organizationId === organizationId)
      .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
  },
  
  create(issue: DataQualityIssue): DataQualityIssue {
    const issues = getItem<DataQualityIssue>('data_quality');
    issues.push(issue);
    setItem('data_quality', issues);
    return issue;
  },
  
  update(id: UUID, updateData: Partial<DataQualityIssue>, organizationId: UUID, session: AuthSession | null): DataQualityIssue | undefined {
    assertTenantAccess(organizationId, session);
    const issues = getItem<DataQualityIssue>('data_quality');
    const idx = issues.findIndex(i => i.id === id && i.organizationId === organizationId);
    if (idx === -1) return undefined;
    issues[idx] = { ...issues[idx], ...updateData };
    setItem('data_quality', issues);
    return issues[idx];
  },
  
  delete(id: UUID, organizationId: UUID, session: AuthSession | null): boolean {
    assertTenantAccess(organizationId, session);
    const issues = getItem<DataQualityIssue>('data_quality');
    const filtered = issues.filter(i => !(i.id === id && i.organizationId === organizationId));
    if (filtered.length === issues.length) return false;
    setItem('data_quality', filtered);
    return true;
  },
};

// --- Saved Report Views (Этап 7) ---

export const savedReportViewStore = {
  getAll(organizationId: UUID, session: AuthSession | null): SavedReportView[] {
    assertTenantAccess(organizationId, session);
    return getItem<SavedReportView>('saved_reports')
      .filter(r => r.organizationId === organizationId);
  },
  
  getByUser(userId: UUID, organizationId: UUID, session: AuthSession | null): SavedReportView[] {
    assertTenantAccess(organizationId, session);
    return getItem<SavedReportView>('saved_reports')
      .filter(r => r.organizationId === organizationId && r.userId === userId);
  },
  
  create(view: SavedReportView): SavedReportView {
    const views = getItem<SavedReportView>('saved_reports');
    views.push(view);
    setItem('saved_reports', views);
    return view;
  },
  
  update(id: UUID, updateData: Partial<SavedReportView>, organizationId: UUID, session: AuthSession | null): SavedReportView | undefined {
    assertTenantAccess(organizationId, session);
    const views = getItem<SavedReportView>('saved_reports');
    const idx = views.findIndex(v => v.id === id && v.organizationId === organizationId);
    if (idx === -1) return undefined;
    views[idx] = { ...views[idx], ...updateData, updatedAt: new Date().toISOString() };
    setItem('saved_reports', views);
    return views[idx];
  },
  
  delete(id: UUID, organizationId: UUID, session: AuthSession | null): boolean {
    assertTenantAccess(organizationId, session);
    const views = getItem<SavedReportView>('saved_reports');
    const filtered = views.filter(v => !(v.id === id && v.organizationId === organizationId));
    if (filtered.length === views.length) return false;
    setItem('saved_reports', filtered);
    return true;
  },
};

// --- Reset all data (для тестов) ---

export function resetAllData(): void {
  const keys = ['organizations', 'users', 'session', 'debts', 'contacts', 'promises', 'tasks', 'communications', 'notifications', 'audit', 'imports', 'integrations', 'sync_history', 'teams', 'invitations', 'assignments', 'preferences', 'snapshots', 'data_quality', 'saved_reports'];
  keys.forEach(key => localStorage.removeItem(getKey(key)));
}
