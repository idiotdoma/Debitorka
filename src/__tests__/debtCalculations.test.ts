import { describe, it, expect } from 'vitest';
import {
  recalculateOverdueDays,
  recalculateCategory,
  filterValidDebts,
  getActualDebtRecord,
} from '../lib/debtCalculations';
import type { DebtRecord } from '../types/models';

describe('debtCalculations', () => {
  describe('recalculateOverdueDays', () => {
    it('should return null for undefined dueDate', () => {
      expect(recalculateOverdueDays(undefined)).toBeNull();
    });

    it('should return 0 for future dueDate', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      expect(recalculateOverdueDays(futureDate.toISOString())).toBe(0);
    });

    it('should return 0 for today dueDate', () => {
      const today = new Date();
      expect(recalculateOverdueDays(today.toISOString())).toBe(0);
    });

    it('should return positive number for past dueDate', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      const result = recalculateOverdueDays(pastDate.toISOString());
      expect(result).toBe(5);
    });
  });

  describe('recalculateCategory', () => {
    it('should return no_due_date for null overdueDays', () => {
      expect(recalculateCategory(null)).toBe('no_due_date');
    });

    it('should return not_overdue for 0 overdueDays', () => {
      expect(recalculateCategory(0)).toBe('not_overdue');
    });

    it('should return days_1_7 for 1-7 overdueDays', () => {
      expect(recalculateCategory(1)).toBe('days_1_7');
      expect(recalculateCategory(7)).toBe('days_1_7');
    });

    it('should return days_8_30 for 8-30 overdueDays', () => {
      expect(recalculateCategory(8)).toBe('days_8_30');
      expect(recalculateCategory(30)).toBe('days_8_30');
    });

    it('should return days_31_60 for 31-60 overdueDays', () => {
      expect(recalculateCategory(31)).toBe('days_31_60');
      expect(recalculateCategory(60)).toBe('days_31_60');
    });

    it('should return days_60_plus for >60 overdueDays', () => {
      expect(recalculateCategory(61)).toBe('days_60_plus');
      expect(recalculateCategory(100)).toBe('days_60_plus');
    });
  });

  describe('filterValidDebts', () => {
    it('should filter out unsupported currencies', () => {
      const debts: Partial<DebtRecord>[] = [
        { id: '1', amountCents: 10000, currency: 'RUB' },
        { id: '2', amountCents: 20000, currency: 'USD' },
        { id: '3', amountCents: 30000, currency: 'RUB' },
      ];
      
      const result = filterValidDebts(debts as DebtRecord[]);
      expect(result.validDebts).toHaveLength(2);
      expect(result.unsupportedCurrencyDebts).toHaveLength(1);
      expect(result.unsupportedCurrencyDebts[0].id).toBe('2');
    });

    it('should filter out negative amounts', () => {
      const debts: Partial<DebtRecord>[] = [
        { id: '1', amountCents: 10000, currency: 'RUB' },
        { id: '2', amountCents: -5000, currency: 'RUB' },
        { id: '3', amountCents: 30000, currency: 'RUB' },
      ];
      
      const result = filterValidDebts(debts as DebtRecord[]);
      expect(result.validDebts).toHaveLength(2);
      expect(result.negativeDebts).toHaveLength(1);
      expect(result.negativeDebts[0].id).toBe('2');
    });

    it('should handle debts without currency as RUB', () => {
      const debts: Partial<DebtRecord>[] = [
        { id: '1', amountCents: 10000 },
        { id: '2', amountCents: 20000, currency: 'RUB' },
      ];
      
      const result = filterValidDebts(debts as DebtRecord[]);
      expect(result.validDebts).toHaveLength(2);
    });
  });

  describe('getActualDebtRecord', () => {
    it('should recalculate overdueDays and category', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      
      const debt: Partial<DebtRecord> = {
        id: '1',
        dueDate: pastDate.toISOString(),
        overdueDays: 0,
        category: 'not_overdue',
      };
      
      const result = getActualDebtRecord(debt as DebtRecord);
      expect(result.overdueDays).toBe(10);
      expect(result.category).toBe('days_8_30');
    });

    it('should handle debt without dueDate', () => {
      const debt: Partial<DebtRecord> = {
        id: '1',
        dueDate: undefined,
        overdueDays: 0,
        category: 'not_overdue',
      };
      
      const result = getActualDebtRecord(debt as DebtRecord);
      expect(result.overdueDays).toBeNull();
      expect(result.category).toBe('no_due_date');
    });
  });
});
