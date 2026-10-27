// ============================================================
// Этап 0: Модель данных — детерминированные типы
// ============================================================

export type UUID = string;

// --- Организации и пользователи ---

export interface Organization {
  id: UUID;
  name: string;
  timezone: string; // например 'Europe/Moscow'
  staleDataThresholdHours: number; // порог устаревания данных (по умолчанию 24)
  createdAt: string; // ISO date
  updatedAt?: string;
}

// Расширенная ролевая модель (Этап 6)
export type UserRole = 
  | 'owner'           // Владелец организации
  | 'admin'           // Администратор организации
  | 'manager'         // Руководитель команды
  | 'finance'         // Финансовый специалист
  | 'employee'        // Сотрудник по работе с должниками
  | 'viewer'          // Наблюдатель (только чтение)
  | 'platform_admin'; // Администратор платформы (отдельная сущность)

// Система разрешений
export type Permission = 
  // Задолженность
  | 'debts:view_all'              // Просмотр всех задолженностей организации
  | 'debts:view_assigned'         // Просмотр только закреплённых задолженностей
  | 'debts:edit'                  // Редактирование задолженности
  
  // Задачи
  | 'tasks:view_all'              // Просмотр всех задач организации
  | 'tasks:view_team'             // Просмотр задач своей команды
  | 'tasks:view_own'              // Просмотр только своих задач
  | 'tasks:create'                // Создание задач
  | 'tasks:assign'                // Назначение задач другим
  | 'tasks:edit_own'              // Редактирование своих задач
  | 'tasks:edit_team'             // Редактирование задач команды
  | 'tasks:edit_all'              // Редактирование всех задач
  
  // Коммуникации и обещания
  | 'communications:create'       // Создание коммуникаций
  | 'promises:create'             // Создание обещаний оплаты
  | 'promises:edit_own'           // Редактирование своих обещаний
  | 'promises:edit_team'          // Редактирование обещаний команды
  
  // Интеграции
  | 'integrations:view'           // Просмотр настроек интеграции
  | 'integrations:manage'         // Управление интеграциями
  
  // Управление
  | 'users:invite'                // Приглашение пользователей
  | 'users:manage'                // Управление пользователями
  | 'teams:manage'                // Управление командами
  | 'organization:settings'       // Настройки организации
  | 'audit:view'                  // Просмотр журнала аудита
  
  // Финансы
  | 'finance:view_analytics'      // Просмотр финансовой аналитики
  | 'finance:view_reports'        // Просмотр отчётов
  | 'finance:export'              // Экспорт данных
  
  // ИИ
  | 'ai:use'                      // Использование ИИ-помощника
  | 'ai:manage';                  // Управление настройками ИИ

export interface User {
  id: UUID;
  email: string;
  passwordHash: string;
  name: string;
  firstName?: string;
  lastName?: string;
  position?: string; // Должность
  organizationId: UUID;
  role: UserRole;
  teamId?: UUID; // Принадлежность к команде
  isActive?: boolean; // Активна ли учётная запись (по умолчанию true)
  lastLoginAt?: string;
  createdAt: string;
  updatedAt?: string;
}

// Команда / подразделение
export interface Team {
  id: UUID;
  organizationId: UUID;
  name: string;
  description?: string;
  managerId?: UUID; // ID руководителя команды
  parentId?: UUID; // ID родительской команды (для иерархии)
  createdAt: string;
  updatedAt: string;
}

// Закрепление контрагентов за сотрудниками
export interface CounterpartyAssignment {
  id: UUID;
  organizationId: UUID;
  counterpartyName: string;
  assignedTo: UUID; // ID сотрудника
  assignedBy: UUID; // ID назначившего
  assignedAt: string;
}

// Приглашение
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface Invitation {
  id: UUID;
  organizationId: UUID;
  email: string;
  role: UserRole;
  teamId?: UUID;
  token: string; // Криптографически случайный токен
  tokenHash: string; // Хэш токена для безопасного хранения
  status: InvitationStatus;
  invitedBy: UUID;
  expiresAt: string;
  acceptedAt?: string;
  createdAt: string;
}

// Пользовательские предпочтения
export interface UserPreferences {
  userId: UUID;
  timezone?: string;
  language?: string;
  notificationSettings?: {
    email?: boolean;
    inApp?: boolean;
    taskReminders?: boolean;
    promiseReminders?: boolean;
  };
  dashboardLayout?: Record<string, any>;
}

// --- Быстрые заметки к контрагентам ---

export interface CounterpartyNote {
  id: UUID;
  organizationId: UUID;
  counterpartyName: string;
  note: string;
  createdBy: UUID;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  userId: UUID;
  organizationId: UUID;
  token: string;
  expiresAt: string;
}

// --- Дебиторская задолженность ---

// Новые категории по ТЗ этапа 2
export type DebtCategory = 
  | 'not_overdue'    // Не просрочено
  | 'days_1_7'       // 1–7 дней
  | 'days_8_30'      // 8–30 дней
  | 'days_31_60'     // 31–60 дней
  | 'days_60_plus'   // Более 60 дней
  | 'no_due_date';   // Срок не указан

export interface DebtRecord {
  id: UUID;
  organizationId: UUID;
  importBatchId: UUID;
  
  // Устойчивый ключ для идентификации документа (контрагент + номер документа)
  documentKey: string;
  
  // Данные контрагента
  counterpartyName: string;
  counterpartyINN?: string;
  
  // Документ
  docNumber: string; // Номер документа (обязательный)
  docDate?: string; // Дата документа (ISO date, опционально)
  dueDate?: string; // Срок оплаты (ISO date, опционально — может отсутствовать)
  
  // Финансовые данные
  amountCents: number; // сумма задолженности в копейках для точности
  currency: string; // 'RUB'
  
  // Ответственный
  ownerEmail?: string;
  
  // Вычисляемые поля (детерминированные)
  category: DebtCategory;
  overdueDays: number | null; // null если срок не указан, 0 если не просрочено
  
  // Метаданные
  notes?: string;
  lastSourceUpdate: string; // дата последнего обновления из источника (ISO)
  createdAt: string;
  updatedAt: string;
}

// --- Контактная информация ---

export interface ContactInfo {
  id: UUID;
  debtRecordId: UUID;
  organizationId: UUID;
  contactName: string;
  position?: string;
  phone?: string;
  email?: string;
  comment?: string;
  createdAt: string;
}

// --- Коммуникации (журнал контактов) ---

export type CommunicationType = 
  | 'outgoing_call'
  | 'incoming_call'
  | 'outgoing_email'
  | 'incoming_email'
  | 'messenger'
  | 'meeting'
  | 'other';

export type CommunicationDirection = 'incoming' | 'outgoing' | 'neutral';

export type CommunicationResult =
  | 'confirmed_payment'
  | 'promised_payment'
  | 'documents_requested'
  | 'failed_to_contact'
  | 'disputes_debt'
  | 'payment_not_approved'
  | 'needs_follow_up'
  | 'other';

export interface Communication {
  id: UUID;
  organizationId: UUID;
  counterpartyName: string; // Устойчивый идентификатор контрагента
  debtRecordId?: UUID; // Необязательная связь с документом
  type: CommunicationType;
  direction: CommunicationDirection;
  contactDate: string; // Фактическая дата и время контакта (ISO)
  employeeId: UUID; // Сотрудник, который провёл контакт
  summary: string; // Краткое содержание
  result?: CommunicationResult;
  resultComment?: string; // Результат разговора
  nextContactDate?: string; // Дата следующего контакта
  createdBy: UUID;
  createdAt: string; // Дата создания записи
  updatedAt: string;
}

// --- Обещания оплаты ---

export type PromiseStatus = 
  | 'expected'           // Ожидается
  | 'fulfilled'          // Выполнено
  | 'partially_fulfilled' // Выполнено частично
  | 'broken'             // Нарушено
  | 'cancelled';         // Отменено

export type PromiseSource = 'call' | 'email' | 'messenger' | 'meeting' | 'other';

export interface PaymentPromise {
  id: UUID;
  organizationId: UUID;
  counterpartyName: string; // Устойчивый идентификатор контрагента
  debtRecordId?: UUID; // Необязательная связь с документом
  promisedDate: string;
  promisedAmountCents: number; // Точная сумма в копейках
  currency: string; // 'RUB'
  status: PromiseStatus;
  source: PromiseSource; // Источник обещания
  contactName: string; // Кто обещал
  employeeId: UUID; // Сотрудник, зафиксировавший обещание
  comment?: string;
  actualReceivedCents?: number; // Фактически полученная сумма (для частичного выполнения)
  lastCheckDate?: string; // Дата последней проверки
  transferHistory?: PromiseTransfer[]; // История переносов
  cancellationReason?: string; // Причина отмены
  createdBy: UUID;
  createdAt: string;
  updatedAt: string;
}

export interface PromiseTransfer {
  from: string; // Дата
  to: string; // Дата
  reason: string;
  transferredAt: string;
  transferredBy: UUID;
}

// --- Задачи ---

export type TaskType =
  | 'call_counterparty'       // Позвонить контрагенту
  | 'send_payment_reminder'   // Отправить напоминание об оплате
  | 'check_payment_status'    // Уточнить статус платежа
  | 'verify_promise'          // Проверить обещанный платёж
  | 'prepare_claim_docs'      // Подготовить документы для претензии
  | 'internal_review'         // Провести внутреннюю проверку
  | 'other';

export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

export type TaskStatus = 
  | 'new'             // Новая
  | 'in_progress'     // В работе
  | 'waiting'         // Ожидает ответа
  | 'completed'       // Выполнена
  | 'cancelled';      // Отменена

export interface Task {
  id: UUID;
  organizationId: UUID;
  title: string;
  description?: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  counterpartyName?: string; // Связь с контрагентом
  debtRecordId?: UUID; // Необязательная связь с документом
  assignedTo: UUID; // Ответственный сотрудник
  createdBy: UUID; // Автор создания
  dueDate: string; // Срок выполнения
  completedAt?: string; // Дата завершения
  result?: string; // Комментарий о результате
  cancellationReason?: string; // Причина отмены
  createdAt: string;
  updatedAt: string;
}

// --- Уведомления ---

export type NotificationType =
  | 'task_due_soon'          // Приближается срок задачи
  | 'task_overdue'           // Просрочена задача
  | 'promise_due'            // Наступил срок обещания
  | 'promise_broken'         // Нарушено обещание
  | 'task_no_action'         // Долго нет действий по задаче
  | 'critical_task_escalation' // Эскалация критической задачи
  | 'new_task_assigned'      // Назначена новая задача
  | 'promise_needs_check';   // Обещание требует проверки

export interface Notification {
  id: UUID;
  organizationId: UUID;
  recipientId: UUID; // Получатель
  type: NotificationType;
  title: string;
  message: string;
  relatedTaskId?: UUID;
  relatedPromiseId?: UUID;
  relatedDebtId?: UUID;
  relatedCounterparty?: string;
  isRead: boolean;
  createdAt: string;
  idempotencyKey: string; // Ключ для предотвращения дубликатов
}

// --- Аудит активности ---

export interface ActivityAudit {
  id: UUID;
  organizationId: UUID;
  entityType: 'task' | 'communication' | 'promise' | 'debt' | 'user' | 'team' | 'organization';
  entityId: UUID;
  action: string; // 'created' | 'updated' | 'status_changed' | 'assigned' | etc.
  changedBy: UUID;
  changedAt: string;
  oldValue?: any;
  newValue?: any;
  comment?: string;
}

// --- Импорт ---

export type ImportChangeType = 'new' | 'updated_amount' | 'updated_due_date' | 'unchanged' | 'possible_duplicate';

export interface ImportBatch {
  id: UUID;
  organizationId: UUID;
  fileName: string;
  fileHash?: string; // хэш файла для защиты от повторной загрузки
  rowCount: number;
  successCount: number;
  errorCount: number;
  duplicateCount: number;
  updatedCount: number; // количество обновлённых записей
  newCount: number; // количество новых записей
  missingFromSource: number; // записей, отсутствующих в новой выгрузке
  status: 'preview' | 'completed' | 'failed';
  errors: ImportError[];
  importedBy: UUID;
  createdAt: string;
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
  value?: string;
}

export interface ImportPreviewRow {
  rowNumber: number;
  data: Record<string, string>;
  valid: boolean;
  errors: ImportError[];
  changeType: ImportChangeType | null; // null если новая запись
  existingRecordId?: UUID; // ID существующей записи (для обновления)
  previousAmount?: number;
  previousDueDate?: string;
}

// --- Этап 7: Исторические снимки ---

export interface DebtSnapshot {
  id: UUID;
  organizationId: UUID;
  snapshotDate: string;
  importBatchId?: UUID;
  totalDebt: number;
  overdueDebt: number;
  documentsCount: number;
  overdueDocumentsCount: number;
  data: {
    documentKey: string; // Устойчивый ключ для сравнения
    counterpartyName: string;
    documentNumber: string;
    amountCents: number;
    currency: string;
    dueDate?: string;
    overdueDays: number | null;
  }[];
}

// --- Этап 7: Качество данных ---

export type DataQualityIssueType = 
  | 'missing_due_date'
  | 'duplicate'
  | 'missing_counterparty'
  | 'invalid_amount'
  | 'invalid_date'
  | 'unknown_currency'
  | 'outdated_data';

export type DataQualitySeverity = 'error' | 'warning' | 'info';

export interface DataQualityIssue {
  id: UUID;
  organizationId: UUID;
  type: DataQualityIssueType;
  severity: DataQualitySeverity;
  debtRecordId?: UUID;
  description: string;
  detectedAt: string;
  resolvedAt?: string;
  resolvedBy?: UUID;
  resolution?: string;
}

// --- Этап 7: Сохранённые представления отчётов ---

export interface SavedReportView {
  id: UUID;
  organizationId: UUID;
  userId: UUID;
  name: string;
  filters: Record<string, any>;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  createdAt: string;
  updatedAt: string;
}
