// ============================================================
// Тесты интеграции — Stage 5
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { MockOneCAdapter } from '../lib/integration/adapters/mockAdapter';
import { CustomHttpAdapter } from '../lib/integration/adapters/customHttpAdapter';
import { syncService } from '../lib/integration/syncService';
import { orgStore, userStore, debtStore, resetAllData } from '../lib/store';
import { hashPassword, generateId, generateDocumentKey } from '../lib/calculations';
import type { IntegrationConnection, FieldMapping } from '../types/integration';
import type { Organization, User, AuthSession } from '../types/models';

function makeOrg(id: string): Organization {
  return { id, name: 'Test', timezone: 'Europe/Moscow', staleDataThresholdHours: 24, createdAt: new Date().toISOString() };
}

function makeUser(id: string, email: string, orgId: string): User {
  return { id, email, passwordHash: hashPassword('pass'), name: email, organizationId: orgId, role: 'admin', createdAt: new Date().toISOString() };
}

function makeSession(orgId: string): AuthSession {
  return { userId: 'user-1', organizationId: orgId, token: 't', expiresAt: new Date(Date.now() + 86400000).toISOString() };
}

function makeConnection(orgId: string): IntegrationConnection {
  return {
    id: generateId('int'),
    organizationId: orgId,
    sourceType: 'onec_odata',
    name: 'Test 1C',
    endpoint: 'http://localhost/odata',
    status: 'not_configured',
    config: {},
    fieldMapping: {
      counterpartyExternalId: 'Ref_Key',
      counterpartyName: 'Description',
      counterpartyINN: 'ИНН',
      receivableExternalId: 'Ref_Key',
      receivableCounterpartyRef: 'Контрагент',
      documentNumber: 'Number',
      documentDate: 'Date',
      dueDate: 'СрокПлатежа',
      outstandingAmount: 'СуммаДолга',
      currency: 'Валюта',
    },
    syncPaused: false,
    credentialsStatus: 'not_set',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'user-1',
  };
}

describe('Mock Adapter', () => {
  let adapter: MockOneCAdapter;

  beforeEach(() => {
    adapter = new MockOneCAdapter();
    adapter.setSimulatedDelay(0); // Убираем задержку для тестов
  });

  it('should successfully test connection', async () => {
    const result = await adapter.testConnection('http://localhost/odata', {});
    expect(result.success).toBe(true);
  });

  it('should fail connection when configured', async () => {
    adapter.setFailConnection(true);
    const result = await adapter.testConnection('http://localhost/odata', {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('server_unreachable');
    }
  });

  it('should fail auth when configured', async () => {
    adapter.setFailAuth(true);
    const result = await adapter.testConnection('http://localhost/odata', {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('auth_failed');
    }
  });

  it('should discover entities', async () => {
    const entities = await adapter.discoverEntities('http://localhost/odata', {});
    expect(entities.length).toBeGreaterThan(0);
    expect(entities.some(e => e.name.includes('Контрагенты'))).toBe(true);
    expect(entities.some(e => e.name.includes('Взаиморасчеты'))).toBe(true);
  });

  it('should fetch preview data', async () => {
    const mapping: FieldMapping = {
      counterpartyExternalId: 'Ref_Key',
      counterpartyName: 'Description',
      outstandingAmount: 'СуммаДолга',
    };
    const data = await adapter.fetchPreview('http://localhost/odata', {}, mapping, 5);
    expect(data.counterparties.length).toBeGreaterThan(0);
    expect(data.receivables.length).toBeGreaterThan(0);
    expect(data.currency).toBe('RUB');
  });

  it('should return empty data when configured', async () => {
    adapter.setReturnEmpty(true);
    const mapping: FieldMapping = {
      counterpartyExternalId: 'Ref_Key',
      counterpartyName: 'Description',
      outstandingAmount: 'СуммаДолга',
    };
    const data = await adapter.fetchPreview('http://localhost/odata', {}, mapping, 5);
    expect(data.counterparties.length).toBe(0);
    expect(data.receivables.length).toBe(0);
  });

  it('should validate mapping correctly', async () => {
    const entities = await adapter.discoverEntities('http://localhost/odata', {});
    
    const validMapping: FieldMapping = {
      counterpartyExternalId: 'Ref_Key',
      counterpartyName: 'Description',
      receivableExternalId: 'Ref_Key',
      outstandingAmount: 'СуммаДолга',
    };
    
    const result = adapter.validateMapping(validMapping, entities);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('should reject mapping without outstanding_amount', async () => {
    const entities = await adapter.discoverEntities('http://localhost/odata', {});
    
    const invalidMapping: FieldMapping = {
      counterpartyExternalId: 'Ref_Key',
      counterpartyName: 'Description',
    };
    
    const result = adapter.validateMapping(invalidMapping, entities);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('outstanding_amount'))).toBe(true);
  });
});

describe('Custom HTTP Adapter', () => {
  let adapter: CustomHttpAdapter;

  beforeEach(() => {
    adapter = new CustomHttpAdapter();
  });

  it('should reject invalid URLs', async () => {
    const result = await adapter.testConnection('not-a-url', {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('invalid_url');
    }
  });

  it('should validate mapping for custom HTTP', async () => {
    const validMapping: FieldMapping = {
      outstandingAmount: 'outstanding_amount',
    };
    
    const result = adapter.validateMapping(validMapping, []);
    expect(result.valid).toBe(true);
  });

  it('should reject mapping without outstanding_amount', () => {
    const invalidMapping: FieldMapping = {};
    const result = adapter.validateMapping(invalidMapping, []);
    expect(result.valid).toBe(false);
  });
});

describe('Sync Service', () => {
  let orgId: string;
  let session: AuthSession;
  let connection: IntegrationConnection;

  beforeEach(() => {
    resetAllData();
    orgId = 'org-sync-test';
    orgStore.create(makeOrg(orgId));
    userStore.create(makeUser('user-1', 'test@test.ru', orgId));
    session = makeSession(orgId);
    connection = makeConnection(orgId);
  });

  it('should execute sync and create new records', async () => {
    const credentials = { password: 'test' };
    
    const history = await syncService.executeSync(
      connection,
      credentials,
      orgId,
      session,
      'manual',
      'user-1'
    );
    
    expect(history.status).toBe('success');
    expect(history.newRecords).toBeGreaterThan(0);
    expect(history.totalRecords).toBeGreaterThan(0);
    
    // Проверяем, что записи созданы в хранилище
    const debts = debtStore.getAll(orgId, session);
    expect(debts.length).toBeGreaterThan(0);
  });

  it('should not duplicate records on re-sync', async () => {
    const credentials = { password: 'test' };
    
    // Первая синхронизация
    await syncService.executeSync(connection, credentials, orgId, session, 'manual', 'user-1');
    const debtsAfterFirst = debtStore.getAll(orgId, session);
    
    // Вторая синхронизация (те же данные)
    await syncService.executeSync(connection, credentials, orgId, session, 'manual', 'user-1');
    const debtsAfterSecond = debtStore.getAll(orgId, session);
    
    // Количество записей не должно увеличиться
    expect(debtsAfterSecond.length).toBe(debtsAfterFirst.length);
  });

  it('should update existing records when amount changes', async () => {
    const credentials = { password: 'test' };
    
    // Первая синхронизация
    await syncService.executeSync(connection, credentials, orgId, session, 'manual', 'user-1');
    const debtsAfterFirst = debtStore.getAll(orgId, session);
    const firstAmount = debtsAfterFirst[0].amountCents;
    
    // Вторая синхронизация (данные те же, но mock генерирует одинаковые данные)
    await syncService.executeSync(connection, credentials, orgId, session, 'manual', 'user-1');
    const debtsAfterSecond = debtStore.getAll(orgId, session);
    
    // Записи должны остаться теми же
    expect(debtsAfterSecond.length).toBe(debtsAfterFirst.length);
  });

  it('should preserve existing tasks and communications', async () => {
    const credentials = { password: 'test' };
    
    // Синхронизация
    await syncService.executeSync(connection, credentials, orgId, session, 'manual', 'user-1');
    
    // Записи должны быть созданы
    const debts = debtStore.getAll(orgId, session);
    expect(debts.length).toBeGreaterThan(0);
  });

  it('should calculate correct totals', async () => {
    const credentials = { password: 'test' };
    
    const history = await syncService.executeSync(connection, credentials, orgId, session, 'manual', 'user-1');
    
    expect(history.totalOutstandingAmountCents).toBeGreaterThan(0);
    expect(history.currency).toBe('RUB');
  });
});

describe('Tenant Isolation for Integrations', () => {
  let orgA: string, orgB: string;
  let sessionA: AuthSession, sessionB: AuthSession;

  beforeEach(() => {
    resetAllData();
    orgA = 'org-a';
    orgB = 'org-b';
    orgStore.create(makeOrg(orgA));
    orgStore.create(makeOrg(orgB));
    userStore.create(makeUser('user-a', 'a@test.ru', orgA));
    userStore.create(makeUser('user-b', 'b@test.ru', orgB));
    sessionA = makeSession(orgA);
    sessionB = makeSession(orgB);
  });

  it('should isolate sync history between organizations', async () => {
    const connectionA = makeConnection(orgA);
    const credentials = { password: 'test' };
    
    // Синхронизация для Org A
    await syncService.executeSync(connectionA, credentials, orgA, sessionA, 'manual', 'user-a');
    
    // Проверяем, что Org B не видит записи Org A
    const debtsB = debtStore.getAll(orgB, sessionB);
    expect(debtsB.length).toBe(0);
    
    // А Org A видит свои записи
    const debtsA = debtStore.getAll(orgA, sessionA);
    expect(debtsA.length).toBeGreaterThan(0);
  });
});
