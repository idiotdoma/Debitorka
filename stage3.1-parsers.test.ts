// ============================================================
// Тесты строгого парсера сумм и дат — Stage 3.1
// ============================================================

import { describe, it, expect } from 'vitest';
import { parseAmountToCents, parseDate } from '../lib/calculations';

describe('Strict Amount Parser (Stage 3.1)', () => {
  describe('Valid formats', () => {
    it('parses simple integer', () => {
      expect(parseAmountToCents('100')).toBe(10000);
    });

    it('parses decimal with dot', () => {
      expect(parseAmountToCents('100.50')).toBe(10050);
    });

    it('parses decimal with comma', () => {
      expect(parseAmountToCents('100,50')).toBe(10050);
    });

    it('parses with space thousands separator', () => {
      expect(parseAmountToCents('1 234,56')).toBe(123456);
    });

    it('parses with non-breaking space', () => {
      expect(parseAmountToCents('1 234,56')).toBe(123456);
    });

    it('parses European format (1.234,56)', () => {
      expect(parseAmountToCents('1.234,56')).toBe(123456);
    });

    it('parses English format (1,234.56)', () => {
      expect(parseAmountToCents('1,234.56')).toBe(123456);
    });

    it('parses zero', () => {
      expect(parseAmountToCents('0')).toBe(0);
    });

    it('parses small decimal', () => {
      expect(parseAmountToCents('0,01')).toBe(1);
    });

    it('parses large number', () => {
      expect(parseAmountToCents('1000000')).toBe(100000000);
    });
  });

  describe('Invalid formats', () => {
    it('rejects text after number', () => {
      expect(parseAmountToCents('100abc')).toBeNull();
    });

    it('rejects empty string', () => {
      expect(parseAmountToCents('')).toBeNull();
    });

    it('rejects whitespace only', () => {
      expect(parseAmountToCents('   ')).toBeNull();
    });

    it('rejects negative value', () => {
      expect(parseAmountToCents('-100')).toBeNull();
    });

    it('rejects too many decimal places', () => {
      expect(parseAmountToCents('100.123')).toBeNull();
    });

    it('rejects NaN', () => {
      expect(parseAmountToCents('NaN')).toBeNull();
    });

    it('rejects Infinity', () => {
      expect(parseAmountToCents('Infinity')).toBeNull();
    });

    it('rejects extremely large value', () => {
      expect(parseAmountToCents('999999999999999')).toBeNull();
    });

    it('rejects text only', () => {
      expect(parseAmountToCents('abc')).toBeNull();
    });

    it('rejects null', () => {
      expect(parseAmountToCents(null as any)).toBeNull();
    });

    it('rejects undefined', () => {
      expect(parseAmountToCents(undefined as any)).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('handles leading/trailing whitespace', () => {
      expect(parseAmountToCents('  100.50  ')).toBe(10050);
    });

    it('handles currency symbols', () => {
      expect(parseAmountToCents('100 ₽')).toBe(10000);
      expect(parseAmountToCents('$100')).toBe(10000);
      expect(parseAmountToCents('100 руб')).toBe(10000);
    });
  });
});

describe('Strict Date Parser (Stage 3.1)', () => {
  describe('Valid dates', () => {
    it('parses YYYY-MM-DD', () => {
      expect(parseDate('2024-01-15')).toBe('2024-01-15');
    });

    it('parses DD.MM.YYYY', () => {
      expect(parseDate('15.01.2024')).toBe('2024-01-15');
    });

    it('parses DD/MM/YYYY', () => {
      expect(parseDate('15/01/2024')).toBe('2024-01-15');
    });

    it('parses DD-MM-YYYY', () => {
      expect(parseDate('15-01-2024')).toBe('2024-01-15');
    });

    it('parses leap year Feb 29', () => {
      expect(parseDate('29.02.2024')).toBe('2024-02-29');
    });

    it('parses month boundaries', () => {
      expect(parseDate('31.01.2024')).toBe('2024-01-31');
      expect(parseDate('30.04.2024')).toBe('2024-04-30');
    });
  });

  describe('Invalid dates', () => {
    it('rejects Feb 29 in non-leap year', () => {
      expect(parseDate('29.02.2023')).toBeNull();
    });

    it('rejects Feb 30', () => {
      expect(parseDate('30.02.2024')).toBeNull();
    });

    it('rejects Feb 31', () => {
      expect(parseDate('31.02.2024')).toBeNull();
    });

    it('rejects Apr 31', () => {
      expect(parseDate('31.04.2024')).toBeNull();
    });

    it('rejects month 13', () => {
      expect(parseDate('15.13.2024')).toBeNull();
    });

    it('rejects month 0', () => {
      expect(parseDate('15.00.2024')).toBeNull();
    });

    it('rejects day 0', () => {
      expect(parseDate('00.01.2024')).toBeNull();
    });

    it('rejects day 32', () => {
      expect(parseDate('32.01.2024')).toBeNull();
    });

    it('rejects empty string', () => {
      expect(parseDate('')).toBeNull();
    });

    it('rejects invalid format', () => {
      expect(parseDate('not-a-date')).toBeNull();
    });

    it('rejects year out of range', () => {
      expect(parseDate('15.01.1800')).toBeNull();
      expect(parseDate('15.01.2200')).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('handles leading/trailing whitespace', () => {
      expect(parseDate('  2024-01-15  ')).toBe('2024-01-15');
    });

    it('handles single digit day/month', () => {
      expect(parseDate('5.1.2024')).toBe('2024-01-05');
    });
  });
});
