// ============================================================
// Модели интеграции с внешними источниками данных
// ============================================================

import { UUID } from './models';

// --- Типы источников данных ---

export type DataSourceType = 'onec_odata' | 'custom_http' | 'manual_import';

export type ConnectionStatus =
  | 'not_configured'
  | 'configured'
  | 'verification_failed'
  | 'ready_for_preview'
  | 'ready_for_sync'
  | 'temporarily_unavailable'
  | 'requires_admin_intervention';

export type SyncJobStatus =
  | 'queued'
  | 'running'
  | 'success'
  | 'success_with_warnings'
  | 'failed'
  | 'cancelled'
  | 'requires_manual_intervention';

export type SyncTrigger = 'manual' | 'scheduled' | 'initial';

// --- Подключение к источнику ---

export interface IntegrationConnection {
  id: UUID;
  organizationId: UUID;
  sourceType: DataSourceType;
  name: string;
  endpoint: string;
  status: ConnectionStatus;
  
  // Настройки (без секретов!)
  config: Record<string, any>;
  
  // Сопоставление полей
  fieldMapping?: FieldMapping;
  
  // Расписание
  scheduleIntervalHours?: number;
  nextScheduledSync?: string; // ISO datetime
  syncPaused: boolean;
  
  // Секреты (хранятся только на сервере, на клиенте — только статус)
  credentialsStatus: 'not_set' | 'set' | 'expired' | 'invalid';
  
  // Последняя синхронизация
  lastSuccessfulSync?: string; // ISO datetime
  lastAttemptAt?: string;
  lastSyncDurationMs?: number;
  lastErrorMessage?: string;
  
  // Метаданные
  createdAt: string;
  updatedAt: string;
  createdBy: UUID;
}

// --- Сопоставление полей ---

export interface FieldMapping {
  // Контрагент
  counterpartyExternalId?: string;
  counterpartyName?: string;
  counterpartyINN?: string;
  
  // Документ/задолженность
  receivableExternalId?: string;
  receivableCounterpartyRef?: string;
  documentNumber?: string;
  documentDate?: string;
  dueDate?: string;
  outstandingAmount?: string; // ОБЯЗАТЕЛЬНОЕ поле (но опционально в интерфейсе для гибкости)
  currency?: string;
  dataFreshnessDate?: string;
  
  // Дополнительные
  originalAmount?: string;
  paidAmount?: string;
  adjustedAmount?: string;
  responsibleManager?: string;
  documentStatus?: string;
}

// --- История синхронизаций ---

export interface SyncHistory {
  id: UUID;
  organizationId: UUID;
  connectionId: UUID;
  sourceType: DataSourceType;
  trigger: SyncTrigger;
  status: SyncJobStatus;
  
  // Временные метки
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  
  // Инициатор
  initiatedBy?: UUID; // null для scheduled
  
  // Статистика
  totalRecords: number;
  newRecords: number;
  updatedRecords: number;
  unchangedRecords: number;
  errorRecords: number;
  requiresReviewRecords: number;
  
  // Финансовая сводка (в копейках)
  totalOutstandingAmountCents: number;
  currency: string;
  
  // Отчёт
  summary?: string;
  errorMessage?: string;
  warnings: string[];
  
  // Идентификатор пакета (для повторной обработки)
  batchId?: string;
  
  createdAt: string;
}

// --- Внешние идентификаторы ---

export interface ExternalIdentifier {
  id: UUID;
  organizationId: UUID;
  connectionId: UUID;
  entityType: 'counterparty' | 'receivable';
  externalId: string; // ID из внешнего источника
  internalId: UUID; // ID в нашем приложении
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

// --- Данные от источника (для предпросмотра и синхронизации) ---

export interface SourceCounterparty {
  external_id: string;
  name: string;
  inn?: string;
}

export interface SourceReceivable {
  external_id: string;
  counterparty_external_id: string;
  document_number: string;
  document_date?: string;
  due_date?: string;
  outstanding_amount: string; // Строка для точности
  currency: string;
  original_amount?: string;
  paid_amount?: string;
  adjusted_amount?: string;
  data_freshness_date?: string;
}

export interface SourceDataPayload {
  source: string;
  exported_at: string;
  currency: string;
  counterparties: SourceCounterparty[];
  receivables: SourceReceivable[];
}

// --- Результат предпросмотра ---

export interface SyncPreview {
  connectionId: UUID;
  exportedAt: string;
  dataFreshnessDate?: string;
  
  // Статистика
  totalCounterparties: number;
  totalReceivables: number;
  newCounterparties: number;
  newReceivables: number;
  updatedReceivables: number;
  unchangedReceivables: number;
  errorRecords: number;
  duplicateRecords: number;
  requiresReviewRecords: number;
  noDueDateRecords: number;
  
  // Финансовая сводка
  totalOutstandingAmountCents: number;
  currency: string;
  
  // Примеры
  sampleCounterparties: SourceCounterparty[];
  sampleReceivables: SourceReceivable[];
  
  // Ошибки и предупреждения
  errors: SyncPreviewError[];
  warnings: string[];
  requiresReviewItems: SyncReviewItem[];
}

export interface SyncPreviewError {
  externalId?: string;
  row?: number;
  field?: string;
  message: string;
  value?: string;
}

export interface SyncReviewItem {
  externalId: string;
  reason: string;
  suggestedInternalId?: UUID;
  conflictingData?: Record<string, any>;
}

// --- Настройки расписания ---

export const SYNC_SCHEDULE_OPTIONS = [
  { value: 1, label: 'Каждый час' },
  { value: 6, label: 'Каждые 6 часов' },
  { value: 12, label: 'Каждые 12 часов' },
  { value: 24, label: 'Каждые 24 часа' },
] as const;

export const DEFAULT_SYNC_INTERVAL_HOURS = 6;

// --- Статусные сообщения ---

export const CONNECTION_STATUS_LABELS: Record<ConnectionStatus, string> = {
  not_configured: 'Не настроено',
  configured: 'Настроено',
  verification_failed: 'Проверка не пройдена',
  ready_for_preview: 'Готово к предпросмотру',
  ready_for_sync: 'Готово к синхронизации',
  temporarily_unavailable: 'Временно недоступно',
  requires_admin_intervention: 'Требуется вмешательство администратора',
};

export const SYNC_STATUS_LABELS: Record<SyncJobStatus, string> = {
  queued: 'В очереди',
  running: 'Выполняется',
  success: 'Успешно',
  success_with_warnings: 'Успешно с предупреждениями',
  failed: 'Неуспешно',
  cancelled: 'Отменено',
  requires_manual_intervention: 'Требуется ручное вмешательство',
};
