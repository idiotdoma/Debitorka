// Утилиты для актуального пересчёта просрочки
import { DebtRecord, DebtCategory } from '../types/models';
import { DEBT_CATEGORIES } from './constants';

/**
 * Пересчитывает overdueDays на основе текущей даты
 */
export function recalculateOverdueDays(dueDate?: string): number | null {
  if (!dueDate) return null;
  
  const due = new Date(dueDate);
  const now = new Date();
  
  // Нормализуем к началу дня
  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  
  const diffMs = now.getTime() - due.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
}

/**
 * Пересчитывает категорию на основе актуальных дней просрочки
 */
export function recalculateCategory(overdueDays: number | null): DebtCategory {
  if (overdueDays === null) return 'no_due_date';
  if (overdueDays === 0) return 'not_overdue';
  if (overdueDays <= 7) return 'days_1_7';
  if (overdueDays <= 30) return 'days_8_30';
  if (overdueDays <= 60) return 'days_31_60';
  return 'days_60_plus';
}

/**
 * Возвращает актуальную версию записи с пересчитанной просрочкой
 */
export function getActualDebtRecord(debt: DebtRecord): DebtRecord {
  const actualOverdueDays = recalculateOverdueDays(debt.dueDate);
  const actualCategory = recalculateCategory(actualOverdueDays);
  
  return {
    ...debt,
    overdueDays: actualOverdueDays,
    category: actualCategory,
  };
}

/**
 * Фильтрует записи по поддерживаемой валюте и положительным суммам
 */
export function filterValidDebts(debts: DebtRecord[]): {
  validDebts: DebtRecord[];
  unsupportedCurrencyDebts: DebtRecord[];
  negativeDebts: DebtRecord[];
} {
  const validDebts: DebtRecord[] = [];
  const unsupportedCurrencyDebts: DebtRecord[] = [];
  const negativeDebts: DebtRecord[] = [];
  
  for (const debt of debts) {
    // Проверяем валюту
    if (debt.currency && debt.currency !== 'RUB') {
      unsupportedCurrencyDebts.push(debt);
      continue;
    }
    
    // Проверяем сумму
    if (debt.amountCents < 0) {
      negativeDebts.push(debt);
      continue;
    }
    
    validDebts.push(debt);
  }
  
  return { validDebts, unsupportedCurrencyDebts, negativeDebts };
}

/**
 * Пересчитывает все записи с актуальной просрочкой и фильтрацией
 */
export function prepareDebtsForAnalytics(debts: DebtRecord[]): {
  actualDebts: DebtRecord[];
  unsupportedCurrencyDebts: DebtRecord[];
  negativeDebts: DebtRecord[];
} {
  const { validDebts, unsupportedCurrencyDebts, negativeDebts } = filterValidDebts(debts);
  const actualDebts = validDebts.map(getActualDebtRecord);
  
  return { actualDebts, unsupportedCurrencyDebts, negativeDebts };
}
