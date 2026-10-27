// ============================================================
// Тесты сервиса импорта — Этап 2
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { mapHeaders, createPreview } from '../lib/importService';
import { debtStore, orgStore, userStore, resetAllData } from '../lib/store';
import { hashPassword, generateDocumentKey } from '../lib/calculations';
import type { Organization, User, AuthSession, DebtRecord } from '../types/models';

function makeOrg(id: string): Organization {
  return { id, name: 'Test', timezone: 'Europe/Moscow', staleDataThresholdHours: 24, createdAt: new Date().toISOString() };
}

function makeSession(orgId: string): AuthSession {
  return { userId: 'user-1', organizationId: orgId, token: 't', expiresAt: new Date(Date.now() + 86400000).toISOString() };
}

describe('Import Service (Stage 2)', () => {
  let orgId: string;
  let session: AuthSession;

  beforeEach(() => {
    resetAllData();
    orgId = 'org-import-test';
    orgStore.create(makeOrg(orgId));
    userStore.create({
      id: 'user-1', email: 'test@test.ru', passwordHash: hashPassword('pass'),
      name: 'Test', organizationId: orgId, role: 'admin', createdAt: new Date().toISOString(),
    });
    session = makeSession(orgId);
  });

  describe('mapHeaders', () => {
    it('maps Russian headers', () => {
      const m = mapHeaders(['Контрагент', 'Сумма', 'Срок оплаты', 'Счёт']);
      expect(m['Контрагент']).toBe('counterpartyName');
      expect(m['Сумма']).toBe('amountCents');
      expect(m['Срок оплаты']).toBe('dueDate');
      expect(m['Счёт']).toBe('docNumber');
    });

    it('maps English headers from template', () => {
      const m = mapHeaders(['counterparty', 'inn', 'doc_no', 'doc_date', 'due_date', 'debt_amount', 'currency', 'owner_email']);
      expect(m['counterparty']).toBe('counterpartyName');
      expect(m['inn']).toBe('counterpartyINN');
      expect(m['doc_no']).toBe('docNumber');
      expect(m['doc_date']).toBe('docDate');
      expect(m['due_date']).toBe('dueDate');
      expect(m['debt_amount']).toBe('amountCents');
      expect(m['currency']).toBe('currency');
      expect(m['owner_email']).toBe('ownerEmail');
    });

    it('leaves unknown headers unmapped', () => {
      const m = mapHeaders(['Unknown', 'Контрагент']);
      expect(m['Unknown']).toBeUndefined();
      expect(m['Контрагент']).toBe('counterpartyName');
    });
  });

  describe('createPreview', () => {
    const headerMapping = {
      'Name': 'counterpartyName',
      'DocNo': 'docNumber',
      'Amount': 'amountCents',
      'Due': 'dueDate',
    };

    it('validates required fields', () => {
      const rows = [
        { 'Name': 'Client', 'DocNo': 'DOC-1', 'Amount': '100000', 'Due': '2024-01-15' },
        { 'Name': '', 'DocNo': 'DOC-2', 'Amount': '200000', 'Due': '2024-02-15' }, // missing name
        { 'Name': 'Client', 'DocNo': '', 'Amount': '300000', 'Due': '2024-03-15' }, // missing docNo
      ];
      const preview = createPreview(rows, headerMapping, orgId, session);
      expect(preview[0].valid).toBe(true);
      expect(preview[1].valid).toBe(false);
      expect(preview[2].valid).toBe(false);
    });

    it('allows missing due date', () => {
      const rows = [{ 'Name': 'Client', 'DocNo': 'DOC-1', 'Amount': '100000', 'Due': '' }];
      const preview = createPreview(rows, headerMapping, orgId, session);
      expect(preview[0].valid).toBe(true);
    });

    it('rejects unsupported currency', () => {
      const mapping = { ...headerMapping, 'Curr': 'currency' };
      const rows = [{ 'Name': 'Client', 'DocNo': 'DOC-1', 'Amount': '100000', 'Due': '', 'Curr': 'USD' }];
      const preview = createPreview(rows, mapping, orgId, session);
      expect(preview[0].valid).toBe(false);
      expect(preview[0].errors.some(e => e.field === 'currency')).toBe(true);
    });

    it('accepts RUB currency', () => {
      const mapping = { ...headerMapping, 'Curr': 'currency' };
      const rows = [{ 'Name': 'Client', 'DocNo': 'DOC-1', 'Amount': '100000', 'Due': '', 'Curr': 'RUB' }];
      const preview = createPreview(rows, mapping, orgId, session);
      expect(preview[0].valid).toBe(true);
    });

    it('detects duplicates within file', () => {
      const rows = [
        { 'Name': 'Client', 'DocNo': 'DOC-1', 'Amount': '100000', 'Due': '' },
        { 'Name': 'Client', 'DocNo': 'DOC-1', 'Amount': '200000', 'Due': '' }, // duplicate
      ];
      const preview = createPreview(rows, headerMapping, orgId, session);
      expect(preview[0].valid).toBe(true);
      expect(preview[1].valid).toBe(false);
    });

    it('detects existing records for update', () => {
      // Создаём существующую запись
      debtStore.create({
        id: 'existing-1',
        organizationId: orgId,
        importBatchId: 'batch-0',
        documentKey: generateDocumentKey('Client', 'DOC-1'),
        counterpartyName: 'Client',
        docNumber: 'DOC-1',
        amountCents: 10000000,
        currency: 'RUB',
        category: 'not_overdue',
        overdueDays: 0,
        lastSourceUpdate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const rows = [{ 'Name': 'Client', 'DocNo': 'DOC-1', 'Amount': '200000', 'Due': '' }];
      const preview = createPreview(rows, headerMapping, orgId, session);
      expect(preview[0].valid).toBe(true);
      expect(preview[0].existingRecordId).toBe('existing-1');
      expect(preview[0].changeType).toBe('updated_amount');
    });

    it('validates date format', () => {
      const rows = [{ 'Name': 'Client', 'DocNo': 'DOC-1', 'Amount': '100000', 'Due': 'not-a-date' }];
      const preview = createPreview(rows, headerMapping, orgId, session);
      expect(preview[0].valid).toBe(false);
    });

    it('validates amount format', () => {
      const rows = [{ 'Name': 'Client', 'DocNo': 'DOC-1', 'Amount': 'abc', 'Due': '' }];
      const preview = createPreview(rows, headerMapping, orgId, session);
      expect(preview[0].valid).toBe(false);
    });
  });
});
