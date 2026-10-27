// ============================================================
// Сервис синхронизации
// Координирует получение данных, валидацию и применение
// ============================================================

import {
  IntegrationConnection,
  SyncHistory,
  SyncPreview,
  SyncPreviewError,
  SyncReviewItem,
  SyncJobStatus,
  SyncTrigger,
  SourceDataPayload,
  SourceReceivable,
  FieldMapping,
} from '../../types/integration';
import { debtStore, importStore, userStore, orgStore } from '../store';
import { generateId, parseAmountToCents, parseDate, calculateOverdueDays, categorizeDebt, generateDocumentKey } from '../calculations';
import { adapterFactory, DataSourceAdapter } from './adapters';
import type { AuthSession, UUID, DebtRecord } from '../../types/models';

export class SyncService {
  /**
   * Проверка соединения с источником
   */
  async testConnection(connection: IntegrationConnection, credentials: Record<string, any>) {
    const adapter = adapterFactory.get(connection.sourceType);
    if (!adapter) {
      throw new Error(`Адаптер для типа ${connection.sourceType} не найден`);
    }
    
    return adapter.testConnection(connection.endpoint, credentials);
  }
  
  /**
   * Обнаружение доступных сущностей
   */
  async discoverEntities(connection: IntegrationConnection, credentials: Record<string, any>) {
    const adapter = adapterFactory.get(connection.sourceType);
    if (!adapter) {
      throw new Error(`Адаптер для типа ${connection.sourceType} не найден`);
    }
    
    return adapter.discoverEntities(connection.endpoint, credentials);
  }
  
  /**
   * Получение предпросмотра данных
   */
  async fetchPreview(
    connection: IntegrationConnection,
    credentials: Record<string, any>,
    organizationId: UUID,
    session: AuthSession
  ): Promise<SyncPreview> {
    const adapter = adapterFactory.get(connection.sourceType);
    if (!adapter) {
      throw new Error(`Адаптер для типа ${connection.sourceType} не найден`);
    }
    
    if (!connection.fieldMapping) {
      throw new Error('Сопоставление полей не настроено');
    }
    
    // Получаем данные от источника
    const sourceData = await adapter.fetchPreview(
      connection.endpoint,
      credentials,
      connection.fieldMapping,
      100
    );
    
    // Валидируем и анализируем
    return this.analyzeSourceData(sourceData, connection, organizationId, session);
  }
  
  /**
   * Выполнение синхронизации
   */
  async executeSync(
    connection: IntegrationConnection,
    credentials: Record<string, any>,
    organizationId: UUID,
    session: AuthSession,
    trigger: SyncTrigger,
    userId?: UUID
  ): Promise<SyncHistory> {
    const adapter = adapterFactory.get(connection.sourceType);
    if (!adapter) {
      throw new Error(`Адаптер для типа ${connection.sourceType} не найден`);
    }
    
    if (!connection.fieldMapping) {
      throw new Error('Сопоставление полей не настроено');
    }
    
    const startedAt = new Date().toISOString();
    const batchId = generateId('sync');
    
    const history: SyncHistory = {
      id: generateId('synchist'),
      organizationId,
      connectionId: connection.id,
      sourceType: connection.sourceType,
      trigger,
      status: 'running',
      startedAt,
      initiatedBy: userId,
      totalRecords: 0,
      newRecords: 0,
      updatedRecords: 0,
      unchangedRecords: 0,
      errorRecords: 0,
      requiresReviewRecords: 0,
      totalOutstandingAmountCents: 0,
      currency: 'RUB',
      warnings: [],
      batchId,
      createdAt: startedAt,
    };
    
    try {
      // Получаем все данные от источника
      let totalProcessed = 0;
      let totalAmount = 0;
      const warnings: string[] = [];
      
      for await (const page of adapter.fetchFullData(
        connection.endpoint,
        credentials,
        connection.fieldMapping,
        { pageSize: 100 }
      )) {
        const result = this.processPage(page, connection, organizationId, session, batchId);
        
        totalProcessed += page.receivables.length;
        totalAmount += result.amountCents;
        warnings.push(...result.warnings);
        
        history.newRecords += result.newRecords;
        history.updatedRecords += result.updatedRecords;
        history.unchangedRecords += result.unchangedRecords;
        history.errorRecords += result.errorRecords;
        history.requiresReviewRecords += result.requiresReviewRecords;
      }
      
      history.totalRecords = totalProcessed;
      history.totalOutstandingAmountCents = totalAmount;
      history.warnings = warnings;
      history.status = warnings.length > 0 ? 'success_with_warnings' : 'success';
      history.completedAt = new Date().toISOString();
      history.durationMs = Date.now() - new Date(startedAt).getTime();
      history.summary = `Синхронизация завершена. Обработано: ${totalProcessed}, новых: ${history.newRecords}, обновлено: ${history.updatedRecords}`;
      
    } catch (error) {
      history.status = 'failed';
      history.completedAt = new Date().toISOString();
      history.durationMs = Date.now() - new Date(startedAt).getTime();
      history.errorMessage = (error as Error).message;
    }
    
    return history;
  }
  
  /**
   * Анализ данных источника для предпросмотра
   */
  private analyzeSourceData(
    sourceData: SourceDataPayload,
    connection: IntegrationConnection,
    organizationId: UUID,
    session: AuthSession
  ): SyncPreview {
    const errors: SyncPreviewError[] = [];
    const warnings: string[] = [];
    const requiresReview: SyncReviewItem[] = [];
    
    // Проверяем обязательные поля
    if (!sourceData.exported_at) {
      warnings.push('Источник не предоставил дату актуальности данных');
    }
    
    // Анализируем контрагентов
    const counterpartyMap = new Map<string, string>();
    for (const cp of sourceData.counterparties) {
      if (!cp.external_id || !cp.name) {
        errors.push({
          externalId: cp.external_id,
          message: 'Контрагент без обязательных полей',
        });
        continue;
      }
      counterpartyMap.set(cp.external_id, cp.name);
    }
    
    // Анализируем задолженности
    let newCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;
    let noDueDateCount = 0;
    let totalAmount = 0;
    
    const existingDebts = debtStore.getAll(organizationId, session);
    const existingByDocKey = new Map<string, DebtRecord>();
    for (const d of existingDebts) {
      existingByDocKey.set(d.documentKey, d);
    }
    
    const seenExternalIds = new Set<string>();
    
    for (const rec of sourceData.receivables) {
      // Проверка дубликатов в источнике
      if (seenExternalIds.has(rec.external_id)) {
        errors.push({
          externalId: rec.external_id,
          message: 'Дублирующийся внешний идентификатор в источнике',
        });
        duplicateCount++;
        continue;
      }
      seenExternalIds.add(rec.external_id);
      
      // Проверка обязательных полей
      if (!rec.outstanding_amount) {
        errors.push({
          externalId: rec.external_id,
          field: 'outstanding_amount',
          message: 'Отсутствует обязательное поле остатка задолженности',
        });
        errorCount++;
        continue;
      }
      
      // Парсинг суммы
      const amountCents = parseAmountToCents(rec.outstanding_amount);
      if (amountCents === null) {
        errors.push({
          externalId: rec.external_id,
          field: 'outstanding_amount',
          message: 'Некорректный формат суммы',
          value: rec.outstanding_amount,
        });
        errorCount++;
        continue;
      }
      
      // Проверка валюты
      if (rec.currency && rec.currency !== 'RUB') {
        errors.push({
          externalId: rec.external_id,
          field: 'currency',
          message: `Неподдерживаемая валюта: ${rec.currency}`,
          value: rec.currency,
        });
        errorCount++;
        continue;
      }
      
      // Проверка контрагента
      const cpName = counterpartyMap.get(rec.counterparty_external_id);
      if (!cpName) {
        errors.push({
          externalId: rec.external_id,
          message: `Контрагент не найден: ${rec.counterparty_external_id}`,
        });
        errorCount++;
        continue;
      }
      
      // Проверка срока оплаты
      if (!rec.due_date) {
        noDueDateCount++;
      }
      
      // Проверка соответствия существующим записям
      const docKey = generateDocumentKey(cpName, rec.document_number);
      const existing = existingByDocKey.get(docKey);
      
      if (existing) {
        if (existing.amountCents !== amountCents) {
          updatedCount++;
        } else {
          unchangedCount++;
        }
      } else {
        newCount++;
      }
      
      totalAmount += amountCents;
    }
    
    return {
      connectionId: connection.id,
      exportedAt: sourceData.exported_at,
      dataFreshnessDate: sourceData.exported_at,
      totalCounterparties: sourceData.counterparties.length,
      totalReceivables: sourceData.receivables.length,
      newCounterparties: sourceData.counterparties.filter(cp => 
        !existingDebts.some(d => d.counterpartyName === cp.name)
      ).length,
      newReceivables: newCount,
      updatedReceivables: updatedCount,
      unchangedReceivables: unchangedCount,
      errorRecords: errorCount,
      duplicateRecords: duplicateCount,
      requiresReviewRecords: requiresReview.length,
      noDueDateRecords: noDueDateCount,
      totalOutstandingAmountCents: totalAmount,
      currency: sourceData.currency || 'RUB',
      sampleCounterparties: sourceData.counterparties.slice(0, 5),
      sampleReceivables: sourceData.receivables.slice(0, 10),
      errors,
      warnings,
      requiresReviewItems: requiresReview,
    };
  }
  
  /**
   * Обработка одной страницы данных
   */
  private processPage(
    page: SourceDataPayload,
    connection: IntegrationConnection,
    organizationId: UUID,
    session: AuthSession,
    batchId: string
  ): {
    newRecords: number;
    updatedRecords: number;
    unchangedRecords: number;
    errorRecords: number;
    requiresReviewRecords: number;
    amountCents: number;
    warnings: string[];
  } {
    let newRecords = 0;
    let updatedRecords = 0;
    let unchangedRecords = 0;
    let errorRecords = 0;
    let requiresReviewRecords = 0;
    let amountCents = 0;
    const warnings: string[] = [];
    
    const counterpartyMap = new Map<string, string>();
    for (const cp of page.counterparties) {
      counterpartyMap.set(cp.external_id, cp.name);
    }
    
    const existingDebts = debtStore.getAll(organizationId, session);
    const existingByDocKey = new Map<string, DebtRecord>();
    for (const d of existingDebts) {
      existingByDocKey.set(d.documentKey, d);
    }
    
    const now = new Date().toISOString();
    
    for (const rec of page.receivables) {
      try {
        const cpName = counterpartyMap.get(rec.counterparty_external_id);
        if (!cpName) {
          errorRecords++;
          continue;
        }
        
        const amount = parseAmountToCents(rec.outstanding_amount);
        if (amount === null) {
          errorRecords++;
          continue;
        }
        
        const docKey = generateDocumentKey(cpName, rec.document_number);
        const existing = existingByDocKey.get(docKey);
        
        const dueDate = rec.due_date ? parseDate(rec.due_date) : undefined;
        const overdueDays = calculateOverdueDays(dueDate);
        const category = categorizeDebt(overdueDays);
        
        if (existing) {
          // Обновляем существующую запись
          if (existing.amountCents !== amount || existing.dueDate !== dueDate) {
            const parsedDocDate = rec.document_date ? parseDate(rec.document_date) : null;
            debtStore.update(existing.id, {
              amountCents: amount,
              dueDate: dueDate ?? undefined,
              docDate: parsedDocDate ?? existing.docDate,
              category,
              overdueDays,
              lastSourceUpdate: now,
              importBatchId: batchId,
            }, organizationId, session);
            updatedRecords++;
          } else {
            unchangedRecords++;
          }
        } else {
          // Создаём новую запись
          const parsedDocDate = rec.document_date ? parseDate(rec.document_date) : null;
          const record: DebtRecord = {
            id: generateId('debt'),
            organizationId,
            importBatchId: batchId,
            documentKey: docKey,
            counterpartyName: cpName,
            docNumber: rec.document_number,
            docDate: parsedDocDate ?? undefined,
            dueDate: dueDate ?? undefined,
            amountCents: amount,
            currency: rec.currency || 'RUB',
            category,
            overdueDays,
            lastSourceUpdate: now,
            createdAt: now,
            updatedAt: now,
          };
          debtStore.create(record);
          newRecords++;
        }
        
        amountCents += amount;
      } catch (err) {
        errorRecords++;
        warnings.push(`Ошибка обработки записи ${rec.external_id}: ${(err as Error).message}`);
      }
    }
    
    return {
      newRecords,
      updatedRecords,
      unchangedRecords,
      errorRecords,
      requiresReviewRecords,
      amountCents,
      warnings,
    };
  }
}

// Singleton
export const syncService = new SyncService();
