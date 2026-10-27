// ============================================================
// Сервис финансовой аналитики — Этап 7
// Детерминированные расчёты на основе реальных данных
// ============================================================

import { DebtRecord, DebtSnapshot, UUID, AuthSession } from '../types/models';
import { debtStore } from './store';
import { DEBT_CATEGORIES } from './constants';
import { recalculateOverdueDays } from './debtCalculations';

// --- Основные финансовые показатели ---

export interface FinancialMetrics {
  totalDebt: number;
  overdueDebt: number;
  overduePercentage: number;
  counterpartiesCount: number;
  overdueDocumentsCount: number;
  debtOver30Days: number;
  debtWithoutDueDate: number;
  lastUpdateDate?: string;
}

export function calculateFinancialMetrics(
  debts: DebtRecord[],
  lastImportDate?: string
): FinancialMetrics {
  const totalDebt = debts.reduce((sum, d) => sum + (d.amountCents || 0), 0);
  
  const overdueDebts = debts.filter(d => 
    d.overdueDays !== null && d.overdueDays > 0
  );
  const overdueDebt = overdueDebts.reduce((sum, d) => sum + (d.amountCents || 0), 0);
  
  const overduePercentage = totalDebt > 0 ? (overdueDebt / totalDebt) * 100 : 0;
  
  const counterpartiesCount = new Set(debts.map(d => d.counterpartyName)).size;
  
  const overdueDocumentsCount = overdueDebts.length;
  
  const debtOver30Days = debts
    .filter(d => d.overdueDays !== null && d.overdueDays > 30)
    .reduce((sum, d) => sum + (d.amountCents || 0), 0);
  
  const debtWithoutDueDate = debts
    .filter(d => !d.dueDate)
    .reduce((sum, d) => sum + (d.amountCents || 0), 0);
  
  return {
    totalDebt,
    overdueDebt,
    overduePercentage,
    counterpartiesCount,
    overdueDocumentsCount,
    debtOver30Days,
    debtWithoutDueDate,
    lastUpdateDate: lastImportDate,
  };
}

// --- Распределение по категориям просрочки ---

export interface CategoryDistribution {
  category: string;
  label: string;
  amount: number;
  count: number;
  percentage: number;
  color: string;
}

export function calculateCategoryDistribution(debts: DebtRecord[]): CategoryDistribution[] {
  const totalDebt = debts.reduce((sum, d) => sum + (d.amountCents || 0), 0);
  
  const categories = Object.keys(DEBT_CATEGORIES).map(key => {
    const categoryDebts = debts.filter(d => d.category === key);
    const amount = categoryDebts.reduce((sum, d) => sum + (d.amountCents || 0), 0);
    const count = categoryDebts.length;
    const percentage = totalDebt > 0 ? (amount / totalDebt) * 100 : 0;
    
    return {
      category: key,
      label: DEBT_CATEGORIES[key as keyof typeof DEBT_CATEGORIES].label,
      amount,
      count,
      percentage,
      color: DEBT_CATEGORIES[key as keyof typeof DEBT_CATEGORIES].color,
    };
  });
  
  return categories.filter(c => c.count > 0);
}

// --- Рейтинг контрагентов ---

export interface CounterpartyRating {
  counterpartyName: string;
  totalDebt: number;
  overdueDebt: number;
  oldestOverdueDays: number | null;
  documentsCount: number;
  overdueDocumentsCount: number;
  lastContactDate?: string;
  nextTaskDate?: string;
}

export function calculateCounterpartyRating(
  debts: DebtRecord[],
  sortBy: 'totalDebt' | 'overdueDebt' | 'oldestOverdue' | 'overdueDocuments' = 'totalDebt'
): CounterpartyRating[] {
  const byCounterparty = new Map<string, DebtRecord[]>();
  
  debts.forEach(debt => {
    const existing = byCounterparty.get(debt.counterpartyName) || [];
    existing.push(debt);
    byCounterparty.set(debt.counterpartyName, existing);
  });
  
  const ratings: CounterpartyRating[] = Array.from(byCounterparty.entries()).map(([name, records]) => {
    const totalDebt = records.reduce((sum, d) => sum + (d.amountCents || 0), 0);
    const overdueRecords = records.filter(d => d.overdueDays !== null && d.overdueDays > 0);
    const overdueDebt = overdueRecords.reduce((sum, d) => sum + (d.amountCents || 0), 0);
    const oldestOverdueDays = overdueRecords.length > 0
      ? Math.max(...overdueRecords.map(d => d.overdueDays || 0))
      : null;
    
    return {
      counterpartyName: name,
      totalDebt,
      overdueDebt,
      oldestOverdueDays,
      documentsCount: records.length,
      overdueDocumentsCount: overdueRecords.length,
    };
  });
  
  // Сортировка
  switch (sortBy) {
    case 'totalDebt':
      ratings.sort((a, b) => b.totalDebt - a.totalDebt);
      break;
    case 'overdueDebt':
      ratings.sort((a, b) => b.overdueDebt - a.overdueDebt);
      break;
    case 'oldestOverdue':
      ratings.sort((a, b) => (b.oldestOverdueDays || 0) - (a.oldestOverdueDays || 0));
      break;
    case 'overdueDocuments':
      ratings.sort((a, b) => b.overdueDocumentsCount - a.overdueDocumentsCount);
      break;
  }
  
  return ratings;
}

// --- Приоритеты взыскания ---

export type PriorityLevel = 'critical' | 'high' | 'normal' | 'needs_review';

export interface CollectionPriority {
  debtRecordId: UUID;
  counterpartyName: string;
  documentNumber: string;
  amountCents: number;
  overdueAmount: number;
  overdueDays: number | null;
  priority: PriorityLevel;
  priorityScore: number;
  reasons: string[];
  recommendedAction: string;
}

export function calculateCollectionPriorities(debts: DebtRecord[]): CollectionPriority[] {
  return debts.map(debt => {
    let score = 0;
    const reasons: string[] = [];
    
    // Фактор 1: Дни просрочки (максимум 40 баллов)
    if (debt.overdueDays !== null && debt.overdueDays > 0) {
      if (debt.overdueDays > 60) {
        score += 40;
        reasons.push('Критическая просрочка (>60 дней)');
      } else if (debt.overdueDays > 30) {
        score += 30;
        reasons.push('Значительная просрочка (>30 дней)');
      } else if (debt.overdueDays > 7) {
        score += 20;
        reasons.push('Умеренная просрочка (>7 дней)');
      } else {
        score += 10;
        reasons.push('Небольшая просрочка');
      }
    }
    
    // Фактор 2: Сумма задолженности (максимум 30 баллов)
    if (debt.amountCents > 10000000) { // > 100 000 руб
      score += 30;
      reasons.push('Крупная сумма задолженности');
    } else if (debt.amountCents > 5000000) { // > 50 000 руб
      score += 20;
      reasons.push('Значительная сумма');
    } else if (debt.amountCents > 1000000) { // > 10 000 руб
      score += 10;
    }
    
    // Фактор 3: Отсутствие срока оплаты (20 баллов)
    if (!debt.dueDate) {
      score += 20;
      reasons.push('Отсутствует срок оплаты');
    }
    
    // Фактор 4: Устаревшие данные (10 баллов)
    // Отсутствие lastSourceUpdate означает, что актуальность не подтверждена
    const daysSinceUpdate = debt.lastSourceUpdate
      ? Math.floor((Date.now() - new Date(debt.lastSourceUpdate).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    
    if (daysSinceUpdate === null) {
      // Нет данных о последнем обновлении - требуется уточнение
      score += 15;
      reasons.push('Актуальность данных не подтверждена');
    } else if (daysSinceUpdate > 7) {
      score += 10;
      reasons.push('Данные устарели (>7 дней)');
    }
    
    // Определение уровня приоритета
    let priority: PriorityLevel;
    if (score >= 70) {
      priority = 'critical';
    } else if (score >= 40) {
      priority = 'high';
    } else if (score >= 20) {
      priority = 'normal';
    } else {
      priority = 'needs_review';
    }
    
    // Рекомендуемое действие
    let recommendedAction = '';
    if (!debt.dueDate) {
      recommendedAction = 'Уточнить срок оплаты у контрагента';
    } else if (debt.overdueDays !== null && debt.overdueDays > 60) {
      recommendedAction = 'Срочно связаться с контрагентом, рассмотреть претензию';
    } else if (debt.overdueDays !== null && debt.overdueDays > 30) {
      recommendedAction = 'Отправить напоминание об оплате';
    } else if (daysSinceUpdate === null) {
      recommendedAction = 'Проверить актуальность данных из источника';
    } else if (daysSinceUpdate > 7) {
      recommendedAction = 'Обновить данные из источника';
    } else {
      recommendedAction = 'Продолжать мониторинг';
    }
    
    return {
      debtRecordId: debt.id,
      counterpartyName: debt.counterpartyName,
      documentNumber: debt.docNumber,
      amountCents: debt.amountCents,
      overdueAmount: debt.overdueDays && debt.overdueDays > 0 ? debt.amountCents : 0,
      overdueDays: debt.overdueDays,
      priority,
      priorityScore: score,
      reasons,
      recommendedAction,
    };
  }).sort((a, b) => b.priorityScore - a.priorityScore);
}

// --- Создание снимка задолженности ---

export function createDebtSnapshot(
  organizationId: UUID,
  importBatchId?: UUID
): DebtSnapshot {
  const session: AuthSession = {
    userId: 'system',
    organizationId,
    token: 'system',
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  };
  
  const allDebts = debtStore.getAll(organizationId, session);
  
  // Фильтруем только валидные данные (RUB, положительные суммы)
  const debts = allDebts.filter(d => 
    (!d.currency || d.currency === 'RUB') && d.amountCents >= 0
  );
  
  // Пересчитываем просрочку на текущую дату
  const actualDebts = debts.map(d => {
    const overdueDays = d.dueDate ? recalculateOverdueDays(d.dueDate) : null;
    return { ...d, overdueDays };
  });
  
  const totalDebt = actualDebts.reduce((sum, d) => sum + (d.amountCents || 0), 0);
  const overdueDebts = actualDebts.filter(d => d.overdueDays !== null && d.overdueDays > 0);
  const overdueDebt = overdueDebts.reduce((sum, d) => sum + (d.amountCents || 0), 0);
  
  return {
    id: `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    organizationId,
    snapshotDate: new Date().toISOString(),
    importBatchId,
    totalDebt,
    overdueDebt,
    documentsCount: actualDebts.length,
    overdueDocumentsCount: overdueDebts.length,
    data: actualDebts.map(d => ({
      documentKey: d.documentKey, // Устойчивый ключ для сравнения
      counterpartyName: d.counterpartyName,
      documentNumber: d.docNumber,
      amountCents: d.amountCents,
      currency: d.currency || 'RUB',
      dueDate: d.dueDate,
      overdueDays: d.overdueDays,
    })),
  };
}

// --- Сравнение снимков ---

export interface SnapshotComparison {
  date1: string;
  date2: string;
  totalDebtChange: number;
  overdueDebtChange: number;
  documentsCountChange: number;
  newDocuments: number;
  removedDocuments: number;
  changedDocuments: number;
}

export function compareSnapshots(snapshot1: DebtSnapshot, snapshot2: DebtSnapshot): SnapshotComparison {
  const totalDebtChange = snapshot2.totalDebt - snapshot1.totalDebt;
  const overdueDebtChange = snapshot2.overdueDebt - snapshot1.overdueDebt;
  const documentsCountChange = snapshot2.documentsCount - snapshot1.documentsCount;
  
  // Использование устойчивого ключа documentKey для сравнения
  const keys1 = new Set(snapshot1.data.map(d => d.documentKey));
  const keys2 = new Set(snapshot2.data.map(d => d.documentKey));
  
  const newDocuments = snapshot2.data.filter(d => !keys1.has(d.documentKey)).length;
  const removedDocuments = snapshot1.data.filter(d => !keys2.has(d.documentKey)).length;
  
  // Подсчёт изменённых документов
  let changedDocuments = 0;
  snapshot1.data.forEach(d1 => {
    const d2 = snapshot2.data.find(d => d.documentKey === d1.documentKey);
    if (d2 && (d1.amountCents !== d2.amountCents || d1.dueDate !== d2.dueDate)) {
      changedDocuments++;
    }
  });
  
  return {
    date1: snapshot1.snapshotDate,
    date2: snapshot2.snapshotDate,
    totalDebtChange,
    overdueDebtChange,
    documentsCountChange,
    newDocuments,
    removedDocuments,
    changedDocuments,
  };
}
