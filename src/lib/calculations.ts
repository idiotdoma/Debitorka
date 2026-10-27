// ============================================================
// Детерминированные расчёты — Этап 2
// Точные денежные расчёты в копейках (integer)
// ============================================================

import { DebtCategory } from '../types/models';
import { DEBT_CATEGORIES } from './constants';

/**
 * Вычисляет количество дней просрочки от даты оплаты до сегодня.
 * Использует календарные даты (без учёта времени).
 * 
 * Правила:
 * - Если срок оплаты сегодня, просрочки нет (0)
 * - Если срок оплаты в будущем, просрочки нет (0)
 * - Если срок оплаты вчера, просрочка 1 день
 * - Если срок оплаты отсутствует, возвращает null
 */
export function calculateOverdueDays(dueDate: string | null | undefined, referenceDate?: Date): number | null {
  if (!dueDate) return null;
  
  const due = new Date(dueDate);
  const ref = referenceDate || new Date();
  
  // Нормализуем к началу дня (только дата, без времени)
  due.setHours(0, 0, 0, 0);
  ref.setHours(0, 0, 0, 0);
  
  const diffMs = ref.getTime() - due.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
}

/**
 * Определяет категорию задолженности по дням просрочки.
 */
export function categorizeDebt(overdueDays: number | null): DebtCategory {
  if (overdueDays === null) return 'no_due_date';
  if (overdueDays === 0) return 'not_overdue';
  if (overdueDays >= 1 && overdueDays <= 7) return 'days_1_7';
  if (overdueDays >= 8 && overdueDays <= 30) return 'days_8_30';
  if (overdueDays >= 31 && overdueDays <= 60) return 'days_31_60';
  if (overdueDays >= 61) return 'days_60_plus';
  
  return 'not_overdue';
}

/**
 * Форматирует сумму из копеек в рубли с копейками
 */
export function formatCurrency(amountCents: number | undefined | null, currency: string = 'RUB'): string {
  const safeAmount = amountCents ?? 0;
  const amount = safeAmount / 100;
  
  if (isNaN(amount)) {
    return '0,00 ₽';
  }
  
  try {
    const formatted = new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    
    return formatted;
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/**
 * Форматирует дату в русский формат
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

/**
 * Строгий парсер дат
 */
export function parseDate(value: string): string | null {
  if (!value || typeof value !== 'string') return null;
  
  const trimmed = value.trim();
  if (!trimmed) return null;
  
  let year: number, month: number, day: number;
  
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    year = parseInt(isoMatch[1]);
    month = parseInt(isoMatch[2]);
    day = parseInt(isoMatch[3]);
  } else {
    const dmyMatch = trimmed.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{4})$/);
    if (dmyMatch) {
      day = parseInt(dmyMatch[1]);
      month = parseInt(dmyMatch[2]);
      year = parseInt(dmyMatch[3]);
    } else {
      return null;
    }
  }
  
  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1) return null;
  
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) return null;
  
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  
  const yyyy = year.toString().padStart(4, '0');
  const mm = month.toString().padStart(2, '0');
  const dd = day.toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Строгий парсер денежных значений
 */
export function parseAmountToCents(value: string): number | null {
  if (!value || typeof value !== 'string') return null;
  
  const trimmed = value.trim();
  if (!trimmed) return null;
  
  let cleaned = trimmed
    .replace(/[₽$€£]/g, '')
    .replace(/руб\.?/gi, '')
    .trim();
  
  if (!cleaned) return null;
  
  const hasDot = cleaned.includes('.');
  const hasComma = cleaned.includes(',');
  
  cleaned = cleaned.replace(/\s+/g, '');
  
  let decimalSeparator: '.' | ',' | null = null;
  let thousandsSeparator: '.' | ',' | null = null;
  
  if (hasDot && hasComma) {
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    
    if (lastDot > lastComma) {
      decimalSeparator = '.';
      thousandsSeparator = ',';
    } else {
      decimalSeparator = ',';
      thousandsSeparator = '.';
    }
  } else if (hasDot) {
    const dotCount = (cleaned.match(/\./g) || []).length;
    if (dotCount === 1) {
      const afterDot = cleaned.split('.')[1];
      if (afterDot && afterDot.length <= 2) {
        decimalSeparator = '.';
      } else if (afterDot && afterDot.length === 3) {
        const beforeDot = cleaned.split('.')[0];
        if (beforeDot.length <= 3) {
          decimalSeparator = '.';
        } else {
          thousandsSeparator = '.';
        }
      }
    } else {
      thousandsSeparator = '.';
    }
  } else if (hasComma) {
    const commaCount = (cleaned.match(/,/g) || []).length;
    if (commaCount === 1) {
      const afterComma = cleaned.split(',')[1];
      if (afterComma && afterComma.length <= 2) {
        decimalSeparator = ',';
      } else if (afterComma && afterComma.length === 3) {
        const beforeComma = cleaned.split(',')[0];
        if (beforeComma.length <= 3) {
          decimalSeparator = ',';
        } else {
          thousandsSeparator = ',';
        }
      }
    } else {
      thousandsSeparator = ',';
    }
  }
  
  if (thousandsSeparator) {
    cleaned = cleaned.split(thousandsSeparator).join('');
  }
  
  if (decimalSeparator === ',') {
    cleaned = cleaned.replace(',', '.');
  }
  
  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    return null;
  }
  
  const parts = cleaned.split('.');
  if (parts.length === 2 && parts[1].length > 2) {
    return null;
  }
  
  const num = parseFloat(cleaned);
  
  if (isNaN(num) || !isFinite(num) || num < 0) {
    return null;
  }
  
  if (num > 1_000_000_000_000) {
    return null;
  }
  
  return Math.round(num * 100);
}

export function centsToRubles(cents: number): number {
  return cents / 100;
}

export function aggregateByCategory(records: { category: DebtCategory; amountCents: number }[]): Record<DebtCategory, { count: number; totalAmountCents: number }> {
  const result: Record<DebtCategory, { count: number; totalAmountCents: number }> = {
    not_overdue: { count: 0, totalAmountCents: 0 },
    days_1_7: { count: 0, totalAmountCents: 0 },
    days_8_30: { count: 0, totalAmountCents: 0 },
    days_31_60: { count: 0, totalAmountCents: 0 },
    days_60_plus: { count: 0, totalAmountCents: 0 },
    no_due_date: { count: 0, totalAmountCents: 0 },
  };
  
  for (const record of records) {
    result[record.category].count++;
    result[record.category].totalAmountCents += record.amountCents;
  }
  
  return result;
}

export function hashPassword(password: string): string {
  let hash = 0;
  const salted = `debitor_salt_${password}_2024`;
  for (let i = 0; i < salted.length; i++) {
    const char = salted.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `hashed_${Math.abs(hash).toString(36)}_${salted.length}`;
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}${prefix ? '-' : ''}${timestamp}-${random}`;
}

export function generateDocumentKey(counterpartyName: string, docNumber: string): string {
  const normalized = `${counterpartyName.trim().toLowerCase()}|${docNumber.trim().toLowerCase()}`;
  return normalized;
}

export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export function generateToken(): string {
  return generateId('token');
}

export function hashToken(token: string): string {
  // Простое хеширование для демонстрации
  // В production использовать bcrypt или аналог
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    const char = token.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `hashed_${Math.abs(hash).toString(36)}`;
}
