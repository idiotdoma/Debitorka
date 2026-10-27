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
 * Новые категории по ТЗ этапа 2:
 * - not_overdue: 0 дней
 * - days_1_7: 1–7 дней
 * - days_8_30: 8–30 дней
 * - days_31_60: 31–60 дней
 * - days_60_plus: более 60 дней
 * - no_due_date: срок не указан
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
  
  // Защита от NaN
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
 * Поддерживает форматы: YYYY-MM-DD, DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY
 * Проверяет реальные календарные даты (не допускает 31 февраля и т.п.)
 * Возвращает нормализованную дату в формате YYYY-MM-DD или null
 */
export function parseDate(value: string): string | null {
  if (!value || typeof value !== 'string') return null;
  
  const trimmed = value.trim();
  if (!trimmed) return null;
  
  let year: number, month: number, day: number;
  
  // YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    year = parseInt(isoMatch[1]);
    month = parseInt(isoMatch[2]);
    day = parseInt(isoMatch[3]);
  } else {
    // DD.MM.YYYY или DD/MM/YYYY или DD-MM-YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{4})$/);
    if (dmyMatch) {
      day = parseInt(dmyMatch[1]);
      month = parseInt(dmyMatch[2]);
      year = parseInt(dmyMatch[3]);
    } else {
      return null; // Неизвестный формат
    }
  }
  
  // Проверка диапазона года
  if (year < 1900 || year > 2100) return null;
  
  // Проверка месяца
  if (month < 1 || month > 12) return null;
  
  // Проверка дня
  if (day < 1) return null;
  
  // Определение максимального дня в месяце
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) return null;
  
  // Финальная проверка: создаём дату и проверяем, что она не нормализовалась
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null; // Дата нормализовалась — значит, была невалидной
  }
  
  // Возвращаем в формате YYYY-MM-DD
  const yyyy = year.toString().padStart(4, '0');
  const mm = month.toString().padStart(2, '0');
  const dd = day.toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Строгий парсер денежных значений
 * Возвращает сумму в копейках (integer) или null для некорректных значений
 * 
 * Поддерживаемые форматы:
 * - 100, 100.50, 100,50
 * - 1 234,56 (с пробелами как разделителями тысяч)
 * - 1.234,56 (европейский формат)
 * - 1,234.56 (английский формат)
 * 
 * Отклоняет:
 * - 100abc (текст после числа)
 * - Отрицательные значения
 * - NaN, Infinity
 * - Некорректные разделители
 */
export function parseAmountToCents(value: string): number | null {
  if (!value || typeof value !== 'string') return null;
  
  const trimmed = value.trim();
  if (!trimmed) return null;
  
  // Убираем валютные символы и текст "руб"
  let cleaned = trimmed
    .replace(/[₽$€£]/g, '')
    .replace(/руб\.?/gi, '')
    .trim();
  
  if (!cleaned) return null;
  
  // Определяем формат разделителей
  const hasDot = cleaned.includes('.');
  const hasComma = cleaned.includes(',');
  const hasSpace = /\s/.test(cleaned);
  
  // Убираем пробелы (разделители тысяч)
  cleaned = cleaned.replace(/\s+/g, '');
  
  // Определяем десятичный разделитель
  let decimalSeparator: '.' | ',' | null = null;
  let thousandsSeparator: '.' | ',' | null = null;
  
  if (hasDot && hasComma) {
    // Оба разделителя присутствуют
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    
    if (lastDot > lastComma) {
      // Формат: 1,234.56 (английский)
      decimalSeparator = '.';
      thousandsSeparator = ',';
    } else {
      // Формат: 1.234,56 (европейский)
      decimalSeparator = ',';
      thousandsSeparator = '.';
    }
  } else if (hasDot) {
    // Только точка
    const dotCount = (cleaned.match(/\./g) || []).length;
    if (dotCount === 1) {
      // Может быть десятичным разделителем или разделителем тысяч
      const afterDot = cleaned.split('.')[1];
      if (afterDot && afterDot.length <= 2) {
        decimalSeparator = '.';
      } else if (afterDot && afterDot.length === 3) {
        // Неоднозначно: 1.000 может быть 1000 или 1.000
        // Проверяем наличие цифр до точки
        const beforeDot = cleaned.split('.')[0];
        if (beforeDot.length <= 3) {
          decimalSeparator = '.';
        } else {
          thousandsSeparator = '.';
        }
      }
    } else {
      // Множественные точки - разделители тысяч
      thousandsSeparator = '.';
    }
  } else if (hasComma) {
    // Только запятая
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
      // Множественные запятые - разделители тысяч
      thousandsSeparator = ',';
    }
  }
  
  // Удаляем разделители тысяч
  if (thousandsSeparator) {
    cleaned = cleaned.split(thousandsSeparator).join('');
  }
  
  // Заменяем десятичный разделитель на точку
  if (decimalSeparator === ',') {
    cleaned = cleaned.replace(',', '.');
  }
  
  // Строгая проверка: только цифры и одна точка
  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    return null;
  }
  
  // Проверяем количество десятичных знаков (максимум 2 для копеек)
  const parts = cleaned.split('.');
  if (parts.length === 2 && parts[1].length > 2) {
    return null; // Слишком много десятичных знаков
  }
  
  const num = parseFloat(cleaned);
  
  // Проверка на NaN, Infinity, отрицательные значения
  if (isNaN(num) || !isFinite(num) || num < 0) {
    return null;
  }
  
  // Проверка на чрезмерно большие значения (максимум 1 триллион рублей)
  if (num > 1_000_000_000_000) {
    return null;
  }
  
  // Конвертируем в копейки (integer) для точности
  return Math.round(num * 100);
}

/**
 * Конвертирует копейки в рубли
 */
export function centsToRubles(cents: number): number {
  return cents / 100;
}

/**
 * Агрегирует данные по категориям задолженности
 */
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

/**
 * Простое хеширование пароля (для демо; в продакшене — bcrypt на сервере)
 */
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

/**
 * Проверка пароля
 */
export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

/**
 * Генерация уникального ID
 */
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}${prefix ? '-' : ''}${timestamp}-${random}`;
}

/**
 * Генерация documentKey для устойчивой идентификации
 * Ключ = контрагент + номер документа (lowercase, trimmed)
 */
export function generateDocumentKey(counterpartyName: string, docNumber: string): string {
  const normalized = `${counterpartyName.trim().toLowerCase()}|${docNumber.trim().toLowerCase()}`;
  return normalized;
}

/**
 * Хэширование файла для защиты от повторной загрузки
 */
export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
