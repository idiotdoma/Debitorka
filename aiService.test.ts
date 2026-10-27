// Тесты ИИ-сервиса

import { describe, it, expect, beforeEach } from 'vitest';
import { aiService } from '../lib/ai/aiService';
import { orgStore, userStore, debtStore, resetAllData } from '../lib/store';
import { hashPassword, generateId, generateDocumentKey } from '../lib/calculations';
import type { Organization, User, AuthSession, DebtRecord } from '../types/models';

function makeOrg(id: string): Organization {
  return {
    id,
    name: 'Test Org',
    timezone: 'Europe/Moscow',
    staleDataThresholdHours: 24,
    createdAt: new Date().toISOString(),
  };
}

function makeUser(id: string, email: string, orgId: string): User {
  return {
    id,
    email,
    passwordHash: hashPassword('pass'),
    name: email,
    organizationId: orgId,
    role: 'admin',
    createdAt: new Date().toISOString(),
  };
}

function makeSession(userId: string, orgId: string): AuthSession {
  return {
    userId,
    organizationId: orgId,
    token: 'token',
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  };
}

describe('AI Service', () => {
  let orgId: string;
  let userId: string;
  let session: AuthSession;

  beforeEach(() => {
    resetAllData();
    orgId = 'org-ai-test';
    userId = 'user-ai-test';
    orgStore.create(makeOrg(orgId));
    userStore.create(makeUser(userId, 'test@test.ru', orgId));
    session = makeSession(userId, orgId);
  });

  describe('analyzeCounterparty', () => {
    it('should analyze counterparty with debts', async () => {
      // Создаём тестовые данные
      const debt: DebtRecord = {
        id: generateId('debt'),
        organizationId: orgId,
        importBatchId: 'batch-1',
        documentKey: generateDocumentKey('Test Client', 'DOC-001'),
        counterpartyName: 'Test Client',
        docNumber: 'DOC-001',
        amountCents: 10000000,
        currency: 'RUB',
        category: 'days_31_60',
        overdueDays: 45,
        lastSourceUpdate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      debtStore.create(debt);

      const response = await aiService.analyzeCounterparty('Test Client', orgId, session);

      expect(response.success).toBe(true);
      expect(response.operation).toBe('analyze_counterparty');
      expect(response.data).toBeDefined();
      expect(response.data.summary).toContain('Test Client');
      expect(response.data.facts.length).toBeGreaterThan(0);
    });

    it('should reject access to another organization', async () => {
      const otherSession = makeSession(userId, 'other-org');

      const response = await aiService.analyzeCounterparty('Test Client', orgId, otherSession);

      expect(response.success).toBe(false);
      expect(response.error).toContain('FORBIDDEN');
    });

    it('should handle missing counterparty', async () => {
      const response = await aiService.analyzeCounterparty('Nonexistent Client', orgId, session);

      expect(response.success).toBe(true);
      expect(response.data.summary).toContain('0');
    });
  });

  describe('generateLetter', () => {
    it('should generate letter draft', async () => {
      const debt: DebtRecord = {
        id: generateId('debt'),
        organizationId: orgId,
        importBatchId: 'batch-1',
        documentKey: generateDocumentKey('Test Client', 'DOC-001'),
        counterpartyName: 'Test Client',
        docNumber: 'DOC-001',
        amountCents: 10000000,
        currency: 'RUB',
        category: 'days_31_60',
        overdueDays: 45,
        lastSourceUpdate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      debtStore.create(debt);

      const response = await aiService.generateLetter(
        'Test Client',
        debt.id,
        'reminder_overdue',
        { tone: 'polite', format: 'email' },
        orgId,
        session
      );

      expect(response.success).toBe(true);
      expect(response.data.body).toBeDefined();
      expect(response.data.tone).toBe('polite');
      expect(response.data.format).toBe('email');
    });
  });

  describe('explainPriorities', () => {
    it('should explain priorities for debts', async () => {
      const debt1: DebtRecord = {
        id: generateId('debt'),
        organizationId: orgId,
        importBatchId: 'batch-1',
        documentKey: generateDocumentKey('Client A', 'DOC-001'),
        counterpartyName: 'Client A',
        docNumber: 'DOC-001',
        amountCents: 50000000,
        currency: 'RUB',
        category: 'days_60_plus',
        overdueDays: 90,
        lastSourceUpdate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const debt2: DebtRecord = {
        id: generateId('debt'),
        organizationId: orgId,
        importBatchId: 'batch-1',
        documentKey: generateDocumentKey('Client B', 'DOC-002'),
        counterpartyName: 'Client B',
        docNumber: 'DOC-002',
        amountCents: 10000000,
        currency: 'RUB',
        category: 'days_8_30',
        overdueDays: 15,
        lastSourceUpdate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      debtStore.create(debt1);
      debtStore.create(debt2);

      const response = await aiService.explainPriorities(orgId, session);

      expect(response.success).toBe(true);
      expect(response.data.length).toBeGreaterThan(0);
      expect(response.data[0].priority).toBeDefined();
      expect(response.data[0].reasons.length).toBeGreaterThan(0);
    });
  });

  describe('generateDailyPlan', () => {
    it('should generate daily plan', async () => {
      const response = await aiService.generateDailyPlan(userId, orgId, session);

      expect(response.success).toBe(true);
      expect(Array.isArray(response.data)).toBe(true);
    });
  });

  describe('answerQuestion', () => {
    it('should answer questions about debts', async () => {
      const debt: DebtRecord = {
        id: generateId('debt'),
        organizationId: orgId,
        importBatchId: 'batch-1',
        documentKey: generateDocumentKey('Test Client', 'DOC-001'),
        counterpartyName: 'Test Client',
        docNumber: 'DOC-001',
        amountCents: 10000000,
        currency: 'RUB',
        category: 'days_31_60',
        overdueDays: 45,
        lastSourceUpdate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      debtStore.create(debt);

      const response = await aiService.answerQuestion('Какая общая задолженность?', orgId, session);

      expect(response.success).toBe(true);
      expect(response.data.answer).toBeDefined();
      expect(response.data.answer.length).toBeGreaterThan(0);
    });

    it('should handle unknown questions gracefully', async () => {
      const response = await aiService.answerQuestion('Какая погода?', orgId, session);

      expect(response.success).toBe(true);
      expect(response.data.answer).toContain('не могу ответить');
    });
  });

  describe('security', () => {
    it('should not allow access without session', async () => {
      const response = await aiService.analyzeCounterparty('Test', orgId, null as any);

      expect(response.success).toBe(false);
      expect(response.error).toContain('UNAUTHORIZED');
    });

    it('should not allow cross-organization access', async () => {
      const otherOrgId = 'other-org';
      orgStore.create(makeOrg(otherOrgId));
      const otherSession = makeSession(userId, otherOrgId);

      const response = await aiService.analyzeCounterparty('Test', orgId, otherSession);

      expect(response.success).toBe(false);
      expect(response.error).toContain('FORBIDDEN');
    });
  });

  describe('logging', () => {
    it('should log requests', async () => {
      await aiService.analyzeCounterparty('Test', orgId, session);

      const log = aiService.getRequestLog();
      expect(log.length).toBeGreaterThan(0);
      expect(log[0].operation).toBe('analyze_counterparty');
      expect(log[0].timestamp).toBeDefined();
    });
  });
});
