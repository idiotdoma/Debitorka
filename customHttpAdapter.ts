// ============================================================
// Адаптер пользовательского HTTP API
// Принимает данные в стандартизированном JSON-формате
// ============================================================

import {
  DataSourceType,
  FieldMapping,
  SourceDataPayload,
} from '../../../types/integration';
import {
  DataSourceAdapter,
  ConnectionTestResult,
  DiscoveredEntity,
} from './types';

const SUPPORTED_CURRENCIES_LIST = ['RUB'];

export class CustomHttpAdapter implements DataSourceAdapter {
  readonly type: DataSourceType = 'custom_http';
  readonly displayName = 'Пользовательский HTTP API';
  
  private defaultTimeout = 30000;
  private maxResponseSize = 50 * 1024 * 1024; // 50 МБ
  
  async testConnection(
    endpoint: string,
    credentials: Record<string, any>
  ): Promise<ConnectionTestResult> {
    try {
      // Валидация URL
      if (!this.isValidUrl(endpoint)) {
        return {
          success: false,
          error: 'invalid_url',
          message: 'Некорректный URL endpoint',
        };
      }
      
      // Защита от SSRF
      if (this.isBlockedUrl(endpoint)) {
        return {
          success: false,
          error: 'invalid_url',
          message: 'URL заблокирован политикой безопасности',
        };
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeout);
      
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: this.buildHeaders(credentials),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            return {
              success: false,
              error: 'auth_failed',
              message: `Ошибка авторизации (HTTP ${response.status})`,
            };
          }
          return {
            success: false,
            error: 'unknown',
            message: `HTTP ошибка: ${response.status}`,
          };
        }
        
        // Проверяем размер ответа
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > this.maxResponseSize) {
          return {
            success: false,
            error: 'unknown',
            message: 'Ответ слишком большой',
          };
        }
        
        return { success: true };
      } catch (err) {
        clearTimeout(timeoutId);
        
        if ((err as Error).name === 'AbortError') {
          return {
            success: false,
            error: 'timeout',
            message: 'Превышено время ожидания соединения',
          };
        }
        
        return {
          success: false,
          error: 'server_unreachable',
          message: 'Сервер недоступен',
        };
      }
    } catch (err) {
      return {
        success: false,
        error: 'unknown',
        message: (err as Error).message,
      };
    }
  }
  
  async discoverEntities(
    endpoint: string,
    credentials: Record<string, any>
  ): Promise<DiscoveredEntity[]> {
    // Для пользовательского HTTP API структура фиксирована
    return [
      {
        name: 'counterparties',
        displayName: 'Контрагенты',
        fields: [
          { name: 'external_id', displayName: 'Внешний ID', type: 'string', required: true },
          { name: 'name', displayName: 'Наименование', type: 'string', required: true },
          { name: 'inn', displayName: 'ИНН', type: 'string', required: false },
        ],
      },
      {
        name: 'receivables',
        displayName: 'Задолженности',
        fields: [
          { name: 'external_id', displayName: 'Внешний ID', type: 'string', required: true },
          { name: 'counterparty_external_id', displayName: 'Ссылка на контрагента', type: 'string', required: true },
          { name: 'document_number', displayName: 'Номер документа', type: 'string', required: true },
          { name: 'document_date', displayName: 'Дата документа', type: 'date', required: false },
          { name: 'due_date', displayName: 'Срок оплаты', type: 'date', required: false },
          { name: 'outstanding_amount', displayName: 'Остаток задолженности', type: 'number', required: true },
          { name: 'currency', displayName: 'Валюта', type: 'string', required: true },
        ],
      },
    ];
  }
  
  async fetchPreview(
    endpoint: string,
    credentials: Record<string, any>,
    mapping: FieldMapping,
    limit: number = 10
  ): Promise<SourceDataPayload> {
    const data = await this.fetchData(endpoint, credentials);
    
    // Ограничиваем выборку для предпросмотра
    return {
      ...data,
      counterparties: data.counterparties.slice(0, limit),
      receivables: data.receivables.slice(0, limit * 3),
    };
  }
  
  async *fetchFullData(
    endpoint: string,
    credentials: Record<string, any>,
    mapping: FieldMapping,
    options?: {
      since?: string;
      pageSize?: number;
      timeout?: number;
    }
  ): AsyncGenerator<SourceDataPayload, void, unknown> {
    const data = await this.fetchData(endpoint, credentials, options?.timeout);
    
    // Валидация данных
    this.validatePayload(data);
    
    yield data;
  }
  
  validateMapping(
    mapping: FieldMapping,
    availableEntities: DiscoveredEntity[]
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Для пользовательского HTTP API сопоставление фиксировано
    // Проверяем только наличие обязательных полей в настройках
    if (!mapping.outstandingAmount || mapping.outstandingAmount !== 'outstanding_amount') {
      errors.push('Поле остатка задолженности должно быть outstanding_amount');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  getRequiredFields() {
    return {
      counterparty: [
        { key: 'counterpartyExternalId' as const, label: 'external_id', required: true },
        { key: 'counterpartyName' as const, label: 'name', required: true },
        { key: 'counterpartyINN' as const, label: 'inn', required: false },
      ],
      receivable: [
        { key: 'receivableExternalId' as const, label: 'external_id', required: true },
        { key: 'receivableCounterpartyRef' as const, label: 'counterparty_external_id', required: true },
        { key: 'documentNumber' as const, label: 'document_number', required: true },
        { key: 'documentDate' as const, label: 'document_date', required: false },
        { key: 'dueDate' as const, label: 'due_date', required: false },
        { key: 'outstandingAmount' as const, label: 'outstanding_amount', required: true },
        { key: 'currency' as const, label: 'currency', required: true },
      ],
    };
  }
  
  // --- Приватные методы ---
  
  private async fetchData(
    endpoint: string,
    credentials: Record<string, any>,
    timeout?: number
  ): Promise<SourceDataPayload> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      timeout || this.defaultTimeout
    );
    
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: this.buildHeaders(credentials),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data as SourceDataPayload;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }
  
  private buildHeaders(credentials: Record<string, any>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    
    if (credentials.apiKey) {
      headers['X-API-Key'] = credentials.apiKey;
    }
    
    if (credentials.bearerToken) {
      headers['Authorization'] = `Bearer ${credentials.bearerToken}`;
    }
    
    if (credentials.customHeaders) {
      Object.assign(headers, credentials.customHeaders);
    }
    
    return headers;
  }
  
  private validatePayload(data: SourceDataPayload): void {
    if (!data.source || !data.exported_at || !data.currency) {
      throw new Error('Отсутствуют обязательные поля в ответе источника');
    }
    
    if (!Array.isArray(data.counterparties) || !Array.isArray(data.receivables)) {
      throw new Error('Некорректная структура данных: ожидаются массивы counterparties и receivables');
    }
    
    if (!SUPPORTED_CURRENCIES_LIST.includes(data.currency)) {
      throw new Error(`Неподдерживаемая валюта: ${data.currency}. Поддерживается только: ${SUPPORTED_CURRENCIES_LIST.join(', ')}`);
    }
    
    // Валидация контрагентов
    for (const cp of data.counterparties) {
      if (!cp.external_id || !cp.name) {
        throw new Error(`Контрагент без обязательных полей: external_id или name`);
      }
    }
    
    // Валидация задолженностей
    for (const rec of data.receivables) {
      if (!rec.external_id || !rec.counterparty_external_id || !rec.outstanding_amount) {
        throw new Error(`Задолженность без обязательных полей: external_id, counterparty_external_id или outstanding_amount`);
      }
      
      // Проверяем, что сумма — валидное число
      const amount = parseFloat(rec.outstanding_amount);
      if (isNaN(amount) || amount < 0) {
        throw new Error(`Некорректная сумма задолженности: ${rec.outstanding_amount}`);
      }
      
      // Проверяем ссылочную целостность
      const cpExists = data.counterparties.some(cp => cp.external_id === rec.counterparty_external_id);
      if (!cpExists) {
        throw new Error(`Задолженность ссылается на несуществующего контрагента: ${rec.counterparty_external_id}`);
      }
    }
    
    // Проверка на дубликаты
    const externalIds = new Set<string>();
    for (const rec of data.receivables) {
      if (externalIds.has(rec.external_id)) {
        throw new Error(`Дублирующийся внешний идентификатор: ${rec.external_id}`);
      }
      externalIds.add(rec.external_id);
    }
  }
  
  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
  
  private isBlockedUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();
      
      // Блокируем приватные IP и localhost в production
      // (в демо-режиме разрешаем для тестирования)
      const blockedPatterns = [
        /^localhost$/i,
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2\d|3[01])\./,
        /^192\.168\./,
        /^0\.0\.0\.0$/,
        /^::1$/,
      ];
      
      // В демо-режиме не блокируем
      if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        return false;
      }
      
      return blockedPatterns.some(pattern => pattern.test(hostname));
    } catch {
      return true;
    }
  }
}
