// ============================================================
// Сервис импорта CSV/XLSX — Этап 2
// С поддержкой повторного импорта и обновления записей
// ============================================================

import * as XLSX from 'xlsx';
import { ImportPreviewRow, ImportError, DebtRecord, ImportBatch, UUID, ImportChangeType } from '../types/models';
import { FIELD_ALIASES, REQUIRED_IMPORT_FIELDS, DEFAULT_CURRENCY, SUPPORTED_CURRENCIES, MAX_FILE_SIZE_BYTES } from './constants';
import { parseDate, parseAmountToCents, calculateOverdueDays, categorizeDebt, generateId, generateDocumentKey, hashFile } from './calculations';
import { debtStore, importStore } from './store';
import type { AuthSession } from '../types/models';

/**
 * Нормализует заголовок столбца к внутреннему имени поля
 */
function normalizeFieldName(header: string): string | null {
  const normalized = header.toLowerCase().trim();
  return FIELD_ALIASES[normalized] || null;
}

/**
 * Проверяет размер файла
 */
export function validateFileSize(file: File): string | null {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `Файл слишком большой. Максимум: ${Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024)} МБ`;
  }
  if (file.size === 0) {
    return 'Файл пустой';
  }
  return null;
}

/**
 * Проверяет расширение файла
 */
export function validateFileExtension(file: File): string | null {
  const ext = file.name.toLowerCase().split('.').pop();
  if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
    return 'Поддерживаются только файлы .csv, .xlsx, .xls';
  }
  return null;
}

/**
 * Парсит файл (CSV или XLSX) и возвращает сырые данные
 */
export function parseFile(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        let workbook: XLSX.WorkBook;
        
        if (file.name.endsWith('.csv')) {
          const text = typeof data === 'string' ? data : new TextDecoder('utf-8').decode(data as ArrayBuffer);
          workbook = XLSX.read(text, { type: 'string' });
        } else {
          workbook = XLSX.read(data, { type: 'array' });
        }
        
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { 
          defval: '',
          raw: false,
        });
        
        if (jsonData.length === 0) {
          reject(new Error('Файл не содержит данных (только заголовки или пустой)'));
          return;
        }
        
        const headers = Object.keys(jsonData[0]);
        resolve({ headers, rows: jsonData });
      } catch (err) {
        reject(new Error('Ошибка чтения файла: ' + (err as Error).message));
      }
    };
    
    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    
    if (file.name.endsWith('.csv')) {
      reader.readAsText(file, 'utf-8');
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
}

/**
 * Маппит заголовки файла на внутренние имена полей
 */
export function mapHeaders(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  
  for (const header of headers) {
    const fieldName = normalizeFieldName(header);
    if (fieldName) {
      mapping[header] = fieldName;
    }
  }
  
  return mapping;
}

/**
 * Валидирует одну строку данных
 */
function validateRow(
  row: Record<string, string>,
  headerMapping: Record<string, string>,
  rowNumber: number
): { valid: boolean; errors: ImportError[]; normalized: Record<string, string> } {
  const errors: ImportError[] = [];
  const normalized: Record<string, string> = {};
  
  // Маппим значения
  for (const [fileHeader, fieldName] of Object.entries(headerMapping)) {
    normalized[fieldName] = (row[fileHeader] || '').toString().trim();
  }
  
  // Проверяем обязательные поля
  for (const field of REQUIRED_IMPORT_FIELDS) {
    if (!normalized[field] || normalized[field] === '') {
      errors.push({
        row: rowNumber,
        field,
        message: `Обязательное поле не заполнено`,
        value: normalized[field],
      });
    }
  }
  
  // Валидация даты документа (опциональная)
  if (normalized.docDate) {
    const parsed = parseDate(normalized.docDate);
    if (!parsed) {
      errors.push({
        row: rowNumber,
        field: 'docDate',
        message: 'Некорректный формат даты документа',
        value: normalized.docDate,
      });
    } else {
      normalized.docDate = parsed;
    }
  }
  
  // Валидация срока оплаты (опциональная — может отсутствовать)
  if (normalized.dueDate) {
    const parsed = parseDate(normalized.dueDate);
    if (!parsed) {
      errors.push({
        row: rowNumber,
        field: 'dueDate',
        message: 'Некорректный формат срока оплаты',
        value: normalized.dueDate,
      });
    } else {
      normalized.dueDate = parsed;
    }
  }
  
  // Валидация суммы
  if (normalized.amountCents) {
    const parsed = parseAmountToCents(normalized.amountCents);
    if (parsed === null) {
      errors.push({
        row: rowNumber,
        field: 'amountCents',
        message: 'Некорректное значение суммы',
        value: normalized.amountCents,
      });
    } else if (parsed === 0) {
      errors.push({
        row: rowNumber,
        field: 'amountCents',
        message: 'Сумма задолженности не может быть нулевой',
        value: normalized.amountCents,
      });
    } else {
      normalized.amountCents = parsed.toString();
    }
  }
  
  // Валидация валюты
  const currency = normalized.currency || DEFAULT_CURRENCY;
  if (!SUPPORTED_CURRENCIES.includes(currency.toUpperCase())) {
    errors.push({
      row: rowNumber,
      field: 'currency',
      message: `Неподдерживаемая валюта "${currency}". Поддерживается только: ${SUPPORTED_CURRENCIES.join(', ')}`,
      value: currency,
    });
  } else {
    normalized.currency = currency.toUpperCase();
  }
  
  return { valid: errors.length === 0, errors, normalized };
}

/**
 * Создаёт предпросмотр импорта с определением изменений
 */
export function createPreview(
  rows: Record<string, string>[],
  headerMapping: Record<string, string>,
  organizationId: UUID,
  session: AuthSession
): ImportPreviewRow[] {
  const preview: ImportPreviewRow[] = [];
  
  // Получаем существующие записи для проверки дубликатов и обновлений
  const existingDebts = debtStore.getAll(organizationId, session);
  const existingByKey = new Map<string, DebtRecord>();
  for (const debt of existingDebts) {
    existingByKey.set(debt.documentKey, debt);
  }
  
  // Проверяем дубликаты внутри файла
  const seenInFile = new Set<string>();
  
  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2;
    const row = rows[i];
    
    const { valid, errors, normalized } = validateRow(row, headerMapping, rowNumber);
    
    let changeType: ImportChangeType | null = null;
    let existingRecordId: string | undefined;
    let previousAmount: number | undefined;
    let previousDueDate: string | undefined;
    
    if (valid && normalized.counterpartyName && normalized.docNumber) {
      const docKey = generateDocumentKey(normalized.counterpartyName, normalized.docNumber);
      
      // Проверяем дубликат внутри файла
      if (seenInFile.has(docKey)) {
        errors.push({
          row: rowNumber,
          field: 'docNumber',
          message: 'Дубликат внутри файла: тот же контрагент и номер документа',
          value: normalized.docNumber,
        });
      } else {
        seenInFile.add(docKey);
      }
      
      // Проверяем существующую запись
      const existing = existingByKey.get(docKey);
      if (existing) {
        existingRecordId = existing.id;
        previousAmount = existing.amountCents;
        previousDueDate = existing.dueDate;
        
        const newAmount = parseInt(normalized.amountCents);
        
        if (existing.amountCents !== newAmount && normalized.dueDate !== existing.dueDate) {
          changeType = 'updated_amount'; // приоритет — изменение суммы
        } else if (existing.amountCents !== newAmount) {
          changeType = 'updated_amount';
        } else if (normalized.dueDate && normalized.dueDate !== existing.dueDate) {
          changeType = 'updated_due_date';
        } else {
          changeType = 'unchanged';
        }
      }
    }
    
    const isValid = valid && errors.length === 0;
    
    preview.push({
      rowNumber,
      data: normalized,
      valid: isValid,
      errors,
      changeType,
      existingRecordId,
      previousAmount,
      previousDueDate,
    });
  }
  
  return preview;
}

/**
 * Получает список записей, отсутствующих в новой выгрузке
 */
export function findMissingFromSource(
  preview: ImportPreviewRow[],
  organizationId: UUID,
  session: AuthSession
): DebtRecord[] {
  const existingDebts = debtStore.getAll(organizationId, session);
  const importedKeys = new Set<string>();
  
  for (const row of preview) {
    if (row.valid && row.data.counterpartyName && row.data.docNumber) {
      importedKeys.add(generateDocumentKey(row.data.counterpartyName, row.data.docNumber));
    }
  }
  
  return existingDebts.filter(d => !importedKeys.has(d.documentKey));
}

/**
 * Выполняет импорт валидных строк с поддержкой обновления
 * ВАЖНО: необязательные поля сохраняются, если в новой выгрузке они пустые
 */
export function executeImport(
  file: File,
  preview: ImportPreviewRow[],
  organizationId: UUID,
  session: AuthSession,
  userId: UUID,
  fileHash?: string
): ImportBatch {
  const now = new Date().toISOString();
  const batchId = generateId('batch');
  
  const validRows = preview.filter(p => p.valid);
  const errorRows = preview.filter(p => !p.valid);
  
  let newCount = 0;
  let updatedCount = 0;
  
  // Обрабатываем каждую валидную строку
  for (const row of validRows) {
    const docKey = generateDocumentKey(row.data.counterpartyName, row.data.docNumber);
    const amountCents = parseInt(row.data.amountCents);
    
    if (row.existingRecordId) {
      // Получаем существующую запись
      const existing = debtStore.getById(row.existingRecordId, organizationId, session);
      if (!existing) continue;
      
      // Обновляем только те поля, которые присутствуют в новой выгрузке
      // Пустые необязательные поля НЕ очищают существующие значения
      const updateData: Partial<DebtRecord> = {
        amountCents, // Обязательное поле — всегда обновляем
        lastSourceUpdate: now,
        importBatchId: batchId,
        updatedAt: now,
      };
      
      // Необязательные поля: обновляем только если в новой выгрузке есть значение
      if (row.data.dueDate) {
        updateData.dueDate = row.data.dueDate;
      }
      if (row.data.docDate) {
        updateData.docDate = row.data.docDate;
      }
      if (row.data.counterpartyINN) {
        updateData.counterpartyINN = row.data.counterpartyINN;
      }
      if (row.data.currency) {
        updateData.currency = row.data.currency;
      }
      if (row.data.ownerEmail) {
        updateData.ownerEmail = row.data.ownerEmail;
      }
      
      // Пересчитываем просрочку на основе актуального срока
      const dueDate = updateData.dueDate || existing.dueDate;
      const overdueDays = calculateOverdueDays(dueDate);
      const category = categorizeDebt(overdueDays);
      updateData.overdueDays = overdueDays;
      updateData.category = category;
      
      debtStore.update(row.existingRecordId, updateData, organizationId, session);
      updatedCount++;
    } else {
      // Создаём новую запись
      const dueDate = row.data.dueDate || undefined;
      const overdueDays = calculateOverdueDays(dueDate);
      const category = categorizeDebt(overdueDays);
      
      const record: DebtRecord = {
        id: generateId('debt'),
        organizationId,
        importBatchId: batchId,
        documentKey: docKey,
        counterpartyName: row.data.counterpartyName,
        counterpartyINN: row.data.counterpartyINN || undefined,
        docNumber: row.data.docNumber,
        docDate: row.data.docDate || undefined,
        dueDate,
        amountCents,
        currency: row.data.currency || DEFAULT_CURRENCY,
        ownerEmail: row.data.ownerEmail || undefined,
        category,
        overdueDays,
        lastSourceUpdate: now,
        createdAt: now,
        updatedAt: now,
      };
      debtStore.create(record);
      newCount++;
    }
  }
  
  // Считаем отсутствующие в источнике
  const missingFromSource = findMissingFromSource(preview, organizationId, session).length;
  
  const allErrors: ImportError[] = errorRows.flatMap(r => r.errors);
  
  const batch: ImportBatch = {
    id: batchId,
    organizationId,
    fileName: file.name,
    fileHash,
    rowCount: preview.length,
    successCount: validRows.length,
    errorCount: errorRows.length,
    duplicateCount: preview.filter(p => p.changeType === 'unchanged').length,
    updatedCount,
    newCount,
    missingFromSource,
    status: validRows.length > 0 ? 'completed' : 'failed',
    errors: allErrors,
    importedBy: userId,
    createdAt: now,
  };
  
  importStore.create(batch);
  
  return batch;
}

/**
 * Генерирует CSV-шаблон для скачивания
 */
export function generateTemplateCSV(): string {
  const headers = 'counterparty,inn,doc_no,doc_date,due_date,debt_amount,currency,owner_email';
  const rows = [
    'ООО Пример,7700000000,СЧ-1001,2026-09-01,2026-09-15,125000.00,RUB,user@example.com',
    'ООО Поставка,7800000000,СЧ-2088,2026-09-20,2026-10-20,84500.00,RUB,user@example.com',
    'ООО Без срока,,,2026-10-01,,19000.00,RUB,',
  ];
  return [headers, ...rows].join('\n');
}

/**
 * Скачивает CSV-шаблон
 */
export function downloadTemplate(): void {
  const csv = generateTemplateCSV();
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'template_debitor.csv';
  link.click();
  URL.revokeObjectURL(url);
}
