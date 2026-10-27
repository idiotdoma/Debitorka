// ============================================================
// Тесты tenant isolation — Этап 2
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { debtStore, orgStore, userStore, resetAllData } from '../lib/store';
import { hashPassword, generateId, generateDocumentKey } from '../lib/calculations';
import type { Organization, User, AuthSession, DebtRecord } from '../types/models';

function makeOrg(id: string, name: string): Organization {
  return { id, name, timezone: 'Europe/Moscow', staleDataThresholdHours: 24, createdAt: new Date().toISOString() };
}

function makeUser(id: string, email: string, orgId: string): User {
  return { id, email, passwordHash: hashPassword('pass'), name: email, organizationId: orgId, role: 'admin', createdAt: new Date().toISOString() };
}

function makeSession(userId: string, orgId: string): AuthSession {
  return { userId, organizationId: orgId, token: 'token', expiresAt: new Date(Date.now() + 86400000).toISOString() };
}

function makeDebt(orgId: string, name: string, docNo: string, amountCents: number, daysOverdue: number | null): DebtRecord {
  const now = new Date();
  let dueDate: string | undefined;
  let overdueDays: number | null = null;
  if (daysOverdue !== null) {
    const d = new Date(now);
    d.setDate(d.getDate() - daysOverdue);
    dueDate = d.toISOString().split('T')[0];
    overdueDays = daysOverdue;
  }
  return {
    id: generateId('debt'),
    organizationId: orgId,
    importBatchId: 'batch-1',
    documentKey: generateDocumentKey(name, docNo),
    counterpartyName: name,
    docNumber: docNo,
    dueDate,
    amountCents,
    currency: 'RUB',
    category: 'not_overdue',
    overdueDays,
    lastSourceUpdate: now.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

describe('Tenant Isolation (Stage 2)', () => {
  let orgA: Organization, orgB: Organization;
  let sessionA: AuthSession, sessionB: AuthSession;

  beforeEach(() => {
    resetAllData();
    orgA = makeOrg('org-a', 'Org A');
    orgB = makeOrg('org-b', 'Org B');
    orgStore.create(orgA);
    orgStore.create(orgB);
    userStore.create(makeUser('user-a', 'a@test.ru', orgA.id));
    userStore.create(makeUser('user-b', 'b@test.ru', orgB.id));
    sessionA = makeSession('user-a', orgA.id);
    sessionB = makeSession('user-b', orgB.id);
  });

  it('User A cannot see debts of Organization B', () => {
    debtStore.create(makeDebt(orgB.id, 'Client B', 'DOC-1', 100000, 30));
    expect(debtStore.getAll(orgA.id, sessionA)).toHaveLength(0);
    expect(debtStore.getAll(orgB.id, sessionB)).toHaveLength(1);
  });

  it('User A cannot update debt of Organization B', () => {
    const debt = makeDebt(orgB.id, 'Client B', 'DOC-1', 100000, 30);
    debtStore.create(debt);
    const result = debtStore.update(debt.id, { amountCents: 999999 }, orgA.id, sessionA);
    expect(result).toBeUndefined();
    const original = debtStore.getById(debt.id, orgB.id, sessionB);
    expect(original?.amountCents).toBe(100000);
  });

  it('User A cannot delete debt of Organization B', () => {
    const debt = makeDebt(orgB.id, 'Client B', 'DOC-1', 100000, 30);
    debtStore.create(debt);
    expect(debtStore.delete(debt.id, orgA.id, sessionA)).toBe(false);
    expect(debtStore.getById(debt.id, orgB.id, sessionB)).toBeDefined();
  });

  it('Throws when session org does not match requested org', () => {
    expect(() => debtStore.getAll(orgB.id, sessionA)).toThrow('FORBIDDEN');
  });

  it('Throws when session is null', () => {
    expect(() => debtStore.getAll(orgA.id, null)).toThrow('UNAUTHORIZED');
  });

  it('Multiple debts in different orgs are fully isolated', () => {
    for (let i = 0; i < 3; i++) debtStore.create(makeDebt(orgA.id, `Client A-${i}`, `DOC-A-${i}`, (i+1)*10000, 10));
    for (let i = 0; i < 2; i++) debtStore.create(makeDebt(orgB.id, `Client B-${i}`, `DOC-B-${i}`, (i+1)*50000, 100));
    expect(debtStore.getAll(orgA.id, sessionA)).toHaveLength(3);
    expect(debtStore.getAll(orgB.id, sessionB)).toHaveLength(2);
  });
});
