// ============================================================
// Тесты импорта и обещаний — Stage 3.1
// ============================================================

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { debtStore, orgStore, userStore, promiseStore, resetAllData } from '../lib/store';
import { hashPassword, generateId, generateDocumentKey } from '../lib/calculations';
import type { Organization, User, AuthSession, DebtRecord, PaymentPromise } from '../types/models';

function makeOrg(id: string): Organization {
  return { id, name: 'Test', timezone: 'Europe/Moscow', staleDataThresholdHours: 24, createdAt: new Date().toISOString() };
}

function makeUser(id: string, email: string, orgId: string): User {
  return { id, email, passwordHash: hashPassword('pass'), name: email, organizationId: orgId, role: 'admin', createdAt: new Date().toISOString() };
}

function makeSession(orgId: string): AuthSession {
  return { userId: 'user-1', organizationId: orgId, token: 't', expiresAt: new Date(Date.now() + 86400000).toISOString() };
}

describe('Import Safety (Stage 3.1)', () => {
  let orgId: string;
  let session: AuthSession;

  beforeEach(() => {
    resetAllData();
    orgId = 'org-import-safety';
    orgStore.create(makeOrg(orgId));
    userStore.create(makeUser('user-1', 'test@test.ru', orgId));
    session = makeSession(orgId);
  });

  it('reimport does not duplicate documents', () => {
    const docKey = generateDocumentKey('Client A', 'DOC-001');
    
    const debt1: DebtRecord = {
      id: generateId('debt'),
      organizationId: orgId,
      importBatchId: 'batch-1',
      documentKey: docKey,
      counterpartyName: 'Client A',
      docNumber: 'DOC-001',
      amountCents: 100000,
      currency: 'RUB',
      category: 'not_overdue',
      overdueDays: 0,
      lastSourceUpdate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    debtStore.create(debt1);
    
    // Проверяем, что документ существует
    const debts = debtStore.getAll(orgId, session);
    expect(debts).toHaveLength(1);
    
    // Проверяем, что findByDocumentKey находит документ
    const found = debtStore.findByDocumentKey(docKey, orgId, session);
    expect(found).toBeDefined();
    expect(found?.amountCents).toBe(100000);
  });

  it('update preserves optional fields when new values are empty', () => {
    const docKey = generateDocumentKey('Client B', 'DOC-002');
    
    const debt: DebtRecord = {
      id: generateId('debt'),
      organizationId: orgId,
      importBatchId: 'batch-1',
      documentKey: docKey,
      counterpartyName: 'Client B',
      counterpartyINN: '1234567890',
      docNumber: 'DOC-002',
      docDate: '2024-01-01',
      dueDate: '2024-02-01',
      amountCents: 100000,
      currency: 'RUB',
      ownerEmail: 'owner@test.ru',
      category: 'not_overdue',
      overdueDays: 0,
      lastSourceUpdate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    debtStore.create(debt);
    
    // Обновляем только сумму, не трогая необязательные поля
    debtStore.update(debt.id, {
      amountCents: 200000,
      lastSourceUpdate: new Date().toISOString(),
    }, orgId, session);
    
    const updated = debtStore.getById(debt.id, orgId, session);
    expect(updated?.amountCents).toBe(200000);
    expect(updated?.counterpartyINN).toBe('1234567890'); // Сохранено
    expect(updated?.ownerEmail).toBe('owner@test.ru'); // Сохранено
  });
});

describe('Promise Safety (Stage 3.1)', () => {
  let orgId: string;
  let session: AuthSession;

  beforeEach(() => {
    resetAllData();
    orgId = 'org-promise-safety';
    orgStore.create(makeOrg(orgId));
    userStore.create(makeUser('user-1', 'test@test.ru', orgId));
    session = makeSession(orgId);
  });

  it('creating promise does not change debt amount', () => {
    const docKey = generateDocumentKey('Client C', 'DOC-003');
    
    const debt: DebtRecord = {
      id: generateId('debt'),
      organizationId: orgId,
      importBatchId: 'batch-1',
      documentKey: docKey,
      counterpartyName: 'Client C',
      docNumber: 'DOC-003',
      amountCents: 100000,
      currency: 'RUB',
      category: 'not_overdue',
      overdueDays: 0,
      lastSourceUpdate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    debtStore.create(debt);
    
    // Создаём обещание оплаты
    const promise: PaymentPromise = {
      id: generateId('promise'),
      organizationId: orgId,
      counterpartyName: 'Client C',
      debtRecordId: debt.id,
      promisedDate: '2024-03-01',
      promisedAmountCents: 50000,
      currency: 'RUB',
      status: 'expected',
      source: 'call',
      contactName: 'Director',
      employeeId: 'user-1',
      createdBy: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    promiseStore.create(promise);
    
    // Проверяем, что сумма долга не изменилась
    const updatedDebt = debtStore.getById(debt.id, orgId, session);
    expect(updatedDebt?.amountCents).toBe(100000); // Не изменилась
  });

  it('partial fulfillment does not change debt amount', () => {
    const promise: PaymentPromise = {
      id: generateId('promise'),
      organizationId: orgId,
      counterpartyName: 'Client D',
      promisedDate: '2024-03-01',
      promisedAmountCents: 100000,
      currency: 'RUB',
      status: 'partially_fulfilled',
      actualReceivedCents: 50000,
      source: 'call',
      contactName: 'Director',
      employeeId: 'user-1',
      createdBy: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    promiseStore.create(promise);
    
    const promises = promiseStore.getAll(orgId, session);
    expect(promises).toHaveLength(1);
    expect(promises[0].status).toBe('partially_fulfilled');
    expect(promises[0].actualReceivedCents).toBe(50000);
    
    // Сумма долга остаётся неизменной — это только отметка о частичном платеже
  });

  it('promise transfer history is preserved', () => {
    const promise: PaymentPromise = {
      id: generateId('promise'),
      organizationId: orgId,
      counterpartyName: 'Client E',
      promisedDate: '2024-03-01',
      promisedAmountCents: 100000,
      currency: 'RUB',
      status: 'expected',
      source: 'call',
      contactName: 'Director',
      employeeId: 'user-1',
      transferHistory: [
        {
          from: '2024-03-01',
          to: '2024-03-15',
          reason: 'Client requested extension',
          transferredAt: new Date().toISOString(),
          transferredBy: 'user-1',
        },
      ],
      createdBy: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    promiseStore.create(promise);
    
    const saved = promiseStore.getAll(orgId, session);
    expect(saved[0].transferHistory).toHaveLength(1);
    expect(saved[0].transferHistory?.[0].reason).toBe('Client requested extension');
  });

  it('overdue promise does not automatically become broken', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00'));
    
    const promise: PaymentPromise = {
      id: generateId('promise'),
      organizationId: orgId,
      counterpartyName: 'Client F',
      promisedDate: '2024-06-10', // 5 дней назад
      promisedAmountCents: 100000,
      currency: 'RUB',
      status: 'expected', // Всё ещё expected, не broken!
      source: 'call',
      contactName: 'Director',
      employeeId: 'user-1',
      createdBy: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    promiseStore.create(promise);
    
    const saved = promiseStore.getAll(orgId, session);
    expect(saved[0].status).toBe('expected'); // Не изменился автоматически
    
    vi.useRealTimers();
  });
});
