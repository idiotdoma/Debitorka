// ============================================================
// Сервис качества данных — Этап 7
// Диагностика проблем в финансовых данных
// ============================================================

import { DebtRecord, DataQualityIssue, UUID, AuthSession } from '../types/models';
import { debtStore, dataQualityStore } from './store';
import { generateId } from './calculations';

export interface QualityCheckResult {
  totalChecked: number;
  issuesFound: number;
  issues: DataQualityIssue[];
}

// --- Проверка качества данных ---

export function runQualityChecks(
  organizationId: UUID,
  session: AuthSession
): QualityCheckResult {
  const debts = debtStore.getAll(organizationId, session);
  const issues: DataQualityIssue[] = [];
  
  debts.forEach(debt => {
    // Проверка 1: Отсутствие срока оплаты
    if (!debt.dueDate) {
      issues.push({
        id: generateId('issue'),
        organizationId,
        type: 'missing_due_date',
        severity: 'warning',
        debtRecordId: debt.id,
        description: `Документ ${debt.docNumber} от ${debt.counterpartyName} не имеет срока оплаты`,
        detectedAt: new Date().toISOString(),
      });
    }
    
    // Проверка 2: Некорректная сумма
    if (debt.amountCents < 0) {
      issues.push({
        id: generateId('issue'),
        organizationId,
        type: 'invalid_amount',
        severity: 'error',
        debtRecordId: debt.id,
        description: `Документ ${debt.docNumber} имеет отрицательную сумму: ${debt.amountCents}`,
        detectedAt: new Date().toISOString(),
      });
    }
    
    if (debt.amountCents === 0) {
      issues.push({
        id: generateId('issue'),
        organizationId,
        type: 'invalid_amount',
        severity: 'info',
        debtRecordId: debt.id,
        description: `Документ ${debt.docNumber} имеет нулевую сумму`,
        detectedAt: new Date().toISOString(),
      });
    }
    
    // Проверка 3: Устаревшие данные
    if (debt.lastSourceUpdate) {
      const daysSinceUpdate = Math.floor(
        (Date.now() - new Date(debt.lastSourceUpdate).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceUpdate > 30) {
        issues.push({
          id: generateId('issue'),
          organizationId,
          type: 'outdated_data',
          severity: 'warning',
          debtRecordId: debt.id,
          description: `Данные документа ${debt.docNumber} не обновлялись ${daysSinceUpdate} дней`,
          detectedAt: new Date().toISOString(),
        });
      }
    }
    
    // Проверка 4: Неизвестная валюта
    if (debt.currency && debt.currency !== 'RUB') {
      issues.push({
        id: generateId('issue'),
        organizationId,
        type: 'unknown_currency',
        severity: 'error',
        debtRecordId: debt.id,
        description: `Документ ${debt.docNumber} имеет неподдерживаемую валюту: ${debt.currency}`,
        detectedAt: new Date().toISOString(),
      });
    }
  });
  
  // Проверка 5: Возможные дубликаты
  const seen = new Map<string, DebtRecord>();
  debts.forEach(debt => {
    const key = `${debt.counterpartyName}|${debt.docNumber}`;
    if (seen.has(key)) {
      issues.push({
        id: generateId('issue'),
        organizationId,
        type: 'duplicate',
        severity: 'error',
        debtRecordId: debt.id,
        description: `Возможный дубликат: ${debt.counterpartyName} / ${debt.docNumber}`,
        detectedAt: new Date().toISOString(),
      });
    } else {
      seen.set(key, debt);
    }
  });
  
  return {
    totalChecked: debts.length,
    issuesFound: issues.length,
    issues,
  };
}

// --- Сохранение результатов проверки ---

export function saveQualityCheckResults(
  organizationId: UUID,
  session: AuthSession,
  result: QualityCheckResult
): void {
  // Удаляем старые нерешённые проблемы того же типа для тех же документов
  const existingIssues = dataQualityStore.getAll(organizationId, session);
  existingIssues.forEach(issue => {
    if (!issue.resolvedAt && issue.debtRecordId) {
      const newIssue = result.issues.find(
        i => i.debtRecordId === issue.debtRecordId && i.type === issue.type
      );
      if (!newIssue) {
        // Проблема больше не существует - помечаем как решённую
        dataQualityStore.update(
          issue.id,
          {
            resolvedAt: new Date().toISOString(),
            resolution: 'Автоматически решено при повторной проверке',
          },
          organizationId,
          session
        );
      }
    }
  });
  
  // Сохраняем новые проблемы
  result.issues.forEach(issue => {
    const existing = existingIssues.find(
      i => i.debtRecordId === issue.debtRecordId && 
           i.type === issue.type && 
           !i.resolvedAt
    );
    if (!existing) {
      dataQualityStore.create(issue);
    }
  });
}

// --- Статистика качества ---

export interface QualityStats {
  totalIssues: number;
  unresolvedIssues: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  lastCheckDate?: string;
}

export function getQualityStats(
  organizationId: UUID,
  session: AuthSession
): QualityStats {
  const issues = dataQualityStore.getAll(organizationId, session);
  const unresolved = issues.filter(i => !i.resolvedAt);
  
  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = { error: 0, warning: 0, info: 0 };
  
  unresolved.forEach(issue => {
    byType[issue.type] = (byType[issue.type] || 0) + 1;
    bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
  });
  
  const lastCheckDate = issues.length > 0 
    ? issues.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())[0].detectedAt
    : undefined;
  
  return {
    totalIssues: issues.length,
    unresolvedIssues: unresolved.length,
    byType,
    bySeverity,
    lastCheckDate,
  };
}
