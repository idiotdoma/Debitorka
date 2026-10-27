// ============================================================
// Константы и конфигурация — Этап 2
// ============================================================

// Новые категории задолженности по дням просрочки (по ТЗ этапа 2)
export const DEBT_CATEGORIES = {
  not_overdue: { label: 'Не просрочено', minDays: 0, maxDays: 0, color: 'green' },
  days_1_7: { label: '1–7 дней', minDays: 1, maxDays: 7, color: 'yellow' },
  days_8_30: { label: '8–30 дней', minDays: 8, maxDays: 30, color: 'orange' },
  days_31_60: { label: '31–60 дней', minDays: 31, maxDays: 60, color: 'red' },
  days_60_plus: { label: 'Более 60 дней', minDays: 61, maxDays: Infinity, color: 'purple' },
  no_due_date: { label: 'Срок не указан', minDays: -1, maxDays: -1, color: 'gray' },
} as const;

// Обязательные поля для импорта (по ТЗ этапа 2)
export const REQUIRED_IMPORT_FIELDS = [
  'counterpartyName',
  'docNumber',
  'amountCents',
] as const;

// Маппинг русских/английских заголовков для импорта
export const FIELD_ALIASES: Record<string, string> = {
  // Контрагент
  'контрагент': 'counterpartyName',
  'counterparty': 'counterpartyName',
  'counterpartyname': 'counterpartyName',
  'наименование': 'counterpartyName',
  'название': 'counterpartyName',
  'organization': 'counterpartyName',
  'дебитор': 'counterpartyName',
  'debtor': 'counterpartyName',
  
  // ИНН
  'инн': 'counterpartyINN',
  'inn': 'counterpartyINN',
  
  // Номер документа (обязательный)
  'номер документа': 'docNumber',
  'номердокумента': 'docNumber',
  'docnumber': 'docNumber',
  'doc_no': 'docNumber',
  'doc no': 'docNumber',
  'документ': 'docNumber',
  'счёт': 'docNumber',
  'счет': 'docNumber',
  'invoice': 'docNumber',
  'invoiceNumber': 'docNumber',
  'номер счёта': 'docNumber',
  'номер счета': 'docNumber',
  
  // Дата документа
  'дата документа': 'docDate',
  'датдокумента': 'docDate',
  'docdate': 'docDate',
  'doc_date': 'docDate',
  'doc date': 'docDate',
  'дата счёта': 'docDate',
  'дата счета': 'docDate',
  'invoicedate': 'docDate',
  'invoice date': 'docDate',
  
  // Срок оплаты (опциональный)
  'дата оплаты': 'dueDate',
  'срок оплаты': 'dueDate',
  'duedate': 'dueDate',
  'due_date': 'dueDate',
  'due date': 'dueDate',
  'дата платежа': 'dueDate',
  'срок': 'dueDate',
  
  // Сумма (обязательная)
  'сумма': 'amountCents',
  'amount': 'amountCents',
  'debt_amount': 'amountCents',
  'debt amount': 'amountCents',
  'задолженность': 'amountCents',
  'сумма задолженности': 'amountCents',
  'сумма долга': 'amountCents',
  'остаток': 'amountCents',
  
  // Валюта
  'валюта': 'currency',
  'currency': 'currency',
  
  // Ответственный
  'ответственный': 'ownerEmail',
  'owner': 'ownerEmail',
  'owner_email': 'ownerEmail',
  'owner email': 'ownerEmail',
  'email ответственного': 'ownerEmail',
};

export const DEFAULT_CURRENCY = 'RUB';
export const SUPPORTED_CURRENCIES = ['RUB'];

// Демо-данные для быстрого старта
export const DEMO_ORG_A = {
  id: 'org-a-00000000-0000-0000-0000-000000000001',
  name: 'ООО «Альфа-Трейд»',
  timezone: 'Europe/Moscow',
  staleDataThresholdHours: 24,
};

export const DEMO_ORG_B = {
  id: 'org-b-00000000-0000-0000-0000-000000000002',
  name: 'АО «Бета-Поставка»',
  timezone: 'Europe/Moscow',
  staleDataThresholdHours: 24,
};

// Максимальный размер файла (10 МБ)
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
