// ============================================================
// Модели интеграции с внешними источниками данных
// ============================================================

import { UUID } from './models';

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

export interface IntegrationConnection {
  id: UUID;
  organizationId: UUID;
  sourceType: DataSourceType;
  name: string;
  endpoint: string;
  status: ConnectionStatus;
  config: Record<string, any>;
  fieldMapping?: FieldMapping;
  scheduleIntervalHours?: number;
  nextScheduledSync?: string;
  syncPaused: boolean;
  credentialsStatus: 'not_set' | 'set' | 'expired' | 'invalid';
  lastSuccessfulSync?: string;
  lastAttemptAt?: string;
  lastSyncDurationMs?: number;
  lastErrorMessage?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: UUID;
}

export interface FieldMapping {
  counterpartyExternalId?: string;
  counterpartyName?: string;
  counterpartyINN?: string;
  receivableExternalId?: string;
  receivableCounterpartyRef?: string;
  documentNumber?: string;
  documentDate?: string;
  dueDate?: string;
  outstandingAmount?: string;
  currency?: string;
  dataFreshnessDate?: string;
  originalAmount?: string;
  paidAmount?: string;
  adjustedAmount?: string;
  responsibleManager?: string;
  documentStatus?: string;
}

export interface SyncHistory {
  id: UUID;
  organizationId: UUID;
  connectionId: UUID;
  sourceType: DataSourceType;
  trigger: SyncTrigger;
  status: SyncJobStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  initiatedBy?: UUID;
  totalRecords: number;
  newRecords: number;
  updatedRecords: number;
  unchangedRecords: number;
  errorRecords: number;
  requiresReviewRecords: number;
  totalOutstandingAmountCents: number;
  currency: string;
  summary?: string;
  errorMessage?: string;
  warnings: string[];
  batchId?: string;
  createdAt: string;
}

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

export const SYNC_SCHEDULE_OPTIONS = [
  { value: 1, label: 'Каждый час' },
  { value: 6, label: 'Каждые 6 часов' },
  { value: 12, label: 'Каждые 12 часов' },
  { value: 24, label: 'Каждые 24 часа' },
] as const;

export const DEFAULT_SYNC_INTERVAL_HOURS = 6;
