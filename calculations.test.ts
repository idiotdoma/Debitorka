// ============================================================
// Тесты детерминированных расчётов — Этап 2
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  calculateOverdueDays,
  categorizeDebt,
  parseDate,
  parseAmountToCents,
  centsToRubles,
  formatCurrency,
  aggregateByCategory,
  hashPassword,
  verifyPassword,
  generateDocumentKey,
} from '../lib/calculations';

describe('Calculations (Stage 2)', () => {
  describe('calculateOverdueDays', () => {
    const refDate = new Date('2026-06-15T12:00:00');

    it('returns null when due date is null', () => {
      expect(calculateOverdueDays(null, refDate)).toBeNull();
    });

    it('returns null when due date is undefined', () => {
      expect(calculateOverdueDays(undefined, refDate)).toBeNull();
    });

    it('returns 0 when due date is today', () => {
      expect(calculateOverdueDays('2026-06-15', refDate)).toBe(0);
    });

    it('returns 0 when due date is in the future', () => {
      expect(calculateOverdueDays('2026-06-20', refDate)).toBe(0);
    });

    it('returns 1 when due date was yesterday', () => {
      expect(calculateOverdueDays('2026-06-14', refDate)).toBe(1);
    });

    it('returns 7 for 7 days overdue', () => {
      expect(calculateOverdueDays('2026-06-08', refDate)).toBe(7);
    });

    it('returns 8 for 8 days overdue', () => {
      expect(calculateOverdueDays('2026-06-07', refDate)).toBe(8);
    });

    it('returns 30 for 30 days overdue', () => {
      expect(calculateOverdueDays('2026-05-16', refDate)).toBe(30);
    });

    it('returns 31 for 31 days overdue', () => {
      expect(calculateOverdueDays('2026-05-15', refDate)).toBe(31);
    });

    it('returns 60 for 60 days overdue', () => {
      expect(calculateOverdueDays('2026-04-16', refDate)).toBe(60);
    });

    it('returns 61 for 61 days overdue', () => {
      expect(calculateOverdueDays('2026-04-15', refDate)).toBe(61);
    });

    it('is deterministic', () => {
      const r1 = calculateOverdueDays('2026-05-01', refDate);
      const r2 = calculateOverdueDays('2026-05-01', refDate);
      expect(r1).toBe(r2);
      expect(r1).toBe(45);
    });
  });

  describe('categorizeDebt', () => {
    it('returns no_due_date for null', () => {
      expect(categorizeDebt(null)).toBe('no_due_date');
    });

    it('returns not_overdue for 0 days', () => {
      expect(categorizeDebt(0)).toBe('not_overdue');
    });

    it('returns days_1_7 for 1-7 days', () => {
      expect(categorizeDebt(1)).toBe('days_1_7');
      expect(categorizeDebt(5)).toBe('days_1_7');
      expect(categorizeDebt(7)).toBe('days_1_7');
    });

    it('returns days_8_30 for 8-30 days', () => {
      expect(categorizeDebt(8)).toBe('days_8_30');
      expect(categorizeDebt(15)).toBe('days_8_30');
      expect(categorizeDebt(30)).toBe('days_8_30');
    });

    it('returns days_31_60 for 31-60 days', () => {
      expect(categorizeDebt(31)).toBe('days_31_60');
      expect(categorizeDebt(45)).toBe('days_31_60');
      expect(categorizeDebt(60)).toBe('days_31_60');
    });

    it('returns days_60_plus for 61+ days', () => {
      expect(categorizeDebt(61)).toBe('days_60_plus');
      expect(categorizeDebt(100)).toBe('days_60_plus');
      expect(categorizeDebt(365)).toBe('days_60_plus');
    });
  });

  describe('parseAmountToCents', () => {
    it('parses simple number to cents', () => {
      expect(parseAmountToCents('1000')).toBe(100000);
    });

    it('parses number with decimals', () => {
      expect(parseAmountToCents('125000.50')).toBe(12500050);
    });

    it('parses number with comma as decimal', () => {
      expect(parseAmountToCents('1000,50')).toBe(100050);
    });

    it('parses number with spaces', () => {
      expect(parseAmountToCents('1 000 000')).toBe(100000000);
    });

    it('parses number with currency symbol', () => {
      expect(parseAmountToCents('100 000 ₽')).toBe(10000000);
    });

    it('returns null for invalid', () => {
      expect(parseAmountToCents('abc')).toBeNull();
    });

    it('returns null for negative', () => {
      expect(parseAmountToCents('-100')).toBeNull();
    });

    it('returns null for empty', () => {
      expect(parseAmountToCents('')).toBeNull();
    });
  });

  describe('centsToRubles', () => {
    it('converts cents to rubles', () => {
      expect(centsToRubles(100000)).toBe(1000);
      expect(centsToRubles(12500050)).toBe(125000.5);
    });
  });

  describe('aggregateByCategory', () => {
    it('correctly aggregates records', () => {
      const records = [
        { category: 'not_overdue' as const, amountCents: 100000 },
        { category: 'not_overdue' as const, amountCents: 200000 },
        { category: 'days_8_30' as const, amountCents: 500000 },
        { category: 'days_60_plus' as const, amountCents: 1000000 },
      ];
      const result = aggregateByCategory(records);
      expect(result.not_overdue.count).toBe(2);
      expect(result.not_overdue.totalAmountCents).toBe(300000);
      expect(result.days_8_30.count).toBe(1);
      expect(result.days_8_30.totalAmountCents).toBe(500000);
      expect(result.days_60_plus.count).toBe(1);
      expect(result.days_1_7.count).toBe(0);
    });
  });

  describe('generateDocumentKey', () => {
    it('generates consistent key', () => {
      const key1 = generateDocumentKey('ООО Тест', 'DOC-001');
      const key2 = generateDocumentKey('ООО Тест', 'DOC-001');
      expect(key1).toBe(key2);
    });

    it('normalizes case and whitespace', () => {
      const key1 = generateDocumentKey('ООО Тест', 'DOC-001');
      const key2 = generateDocumentKey('ооо тест', 'doc-001');
      expect(key1).toBe(key2);
    });

    it('different docs produce different keys', () => {
      const key1 = generateDocumentKey('ООО Тест', 'DOC-001');
      const key2 = generateDocumentKey('ООО Тест', 'DOC-002');
      expect(key1).not.toBe(key2);
    });

    it('different counterparties produce different keys', () => {
      const key1 = generateDocumentKey('ООО А', 'DOC-001');
      const key2 = generateDocumentKey('ООО Б', 'DOC-001');
      expect(key1).not.toBe(key2);
    });
  });

  describe('Password hashing', () => {
    it('is deterministic', () => {
      expect(hashPassword('test')).toBe(hashPassword('test'));
    });

    it('different passwords produce different hashes', () => {
      expect(hashPassword('a')).not.toBe(hashPassword('b'));
    });

    it('verifyPassword works', () => {
      const hash = hashPassword('mypass');
      expect(verifyPassword('mypass', hash)).toBe(true);
      expect(verifyPassword('wrong', hash)).toBe(false);
    });
  });
});
