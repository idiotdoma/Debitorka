// ============================================================
// Mock-адаптер для демонстрации и тестирования
// Симулирует ответы от 1С с контролируемыми данными
// ============================================================

import {
  DataSourceType,
  FieldMapping,
  SourceDataPayload,
  SourceCounterparty,
  SourceReceivable,
} from '../../../types/integration';
import {
  DataSourceAdapter,
  ConnectionTestResult,
  DiscoveredEntity,
} from './types';

export class MockOneCAdapter implements DataSourceAdapter {
  readonly type: DataSourceType = 'onec_odata';
  readonly displayName = '1С (демонстрационный)';
  
  // Контролируемые ответы для тестирования
  private shouldFailConnection = false;
  private shouldFailAuth = false;
  private shouldReturnEmpty = false;
  private simulatedDelay = 500;
  
  async testConnection(
    endpoint: string,
    credentials: Record<string, any>
  ): Promise<ConnectionTestResult> {
    await this.delay(this.simulatedDelay);
    
    if (this.shouldFailConnection) {
      return {
        success: false,
        error: 'server_unreachable',
        message: 'Сервер недоступен (демонстрационная ошибка)',
      };
    }
    
    if (this.shouldFailAuth) {
      return {
        success: false,
        error: 'auth_failed',
        message: 'Ошибка авторизации (демонстрационная ошибка)',
      };
    }
    
    if (!endpoint || !endpoint.startsWith('http')) {
      return {
        success: false,
        error: 'invalid_url',
        message: 'Некорректный URL',
      };
    }
    
    return {
      success: true,
      metadata: {
        version: '8.3',
        configuration: 'Управление торговлей',
      },
    };
  }
  
  async discoverEntities(
    endpoint: string,
    credentials: Record<string, any>
  ): Promise<DiscoveredEntity[]> {
    await this.delay(this.simulatedDelay);
    
    // Возвращаем типичную структуру 1С
    return [
      {
        name: 'Catalog_Контрагенты',
        displayName: 'Контрагенты',
        fields: [
          { name: 'Ref_Key', displayName: 'Уникальный идентификатор', type: 'string', required: true },
          { name: 'Description', displayName: 'Наименование', type: 'string', required: true },
          { name: 'ИНН', displayName: 'ИНН', type: 'string', required: false },
        ],
      },
      {
        name: 'InformationRegister_Взаиморасчеты',
        displayName: 'Взаиморасчёты (остатки)',
        fields: [
          { name: 'ДоговорКонтрагента', displayName: 'Договор контрагента', type: 'reference', required: true },
          { name: 'Контрагент', displayName: 'Контрагент', type: 'reference', required: true },
          { name: 'СуммаДолга', displayName: 'Сумма долга', type: 'number', required: true },
          { name: 'Валюта', displayName: 'Валюта', type: 'string', required: false },
          { name: 'СрокПлатежа', displayName: 'Срок платежа', type: 'date', required: false },
        ],
      },
      {
        name: 'Document_РеализацияТоваровУслуг',
        displayName: 'Реализации товаров и услуг',
        fields: [
          { name: 'Ref_Key', displayName: 'Уникальный идентификатор', type: 'string', required: true },
          { name: 'Number', displayName: 'Номер', type: 'string', required: true },
          { name: 'Date', displayName: 'Дата', type: 'date', required: true },
          { name: 'Контрагент', displayName: 'Контрагент', type: 'reference', required: true },
          { name: 'СуммаДокумента', displayName: 'Сумма документа', type: 'number', required: true },
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
    await this.delay(this.simulatedDelay);
    
    if (this.shouldReturnEmpty) {
      return {
        source: '1c_mock',
        exported_at: new Date().toISOString(),
        currency: 'RUB',
        counterparties: [],
        receivables: [],
      };
    }
    
    return this.generateMockData(limit);
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
    const pageSize = options?.pageSize || 100;
    const totalRecords = 250; // Симулируем 250 записей
    const pages = Math.ceil(totalRecords / pageSize);
    
    for (let page = 0; page < pages; page++) {
      await this.delay(this.simulatedDelay);
      
      const offset = page * pageSize;
      const limit = Math.min(pageSize, totalRecords - offset);
      
      yield this.generateMockData(limit, offset);
    }
  }
  
  validateMapping(
    mapping: FieldMapping,
    availableEntities: DiscoveredEntity[]
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!mapping.outstandingAmount) {
      errors.push('Не указано поле остатка задолженности (outstanding_amount)');
    }
    
    if (!mapping.counterpartyExternalId) {
      errors.push('Не указан внешний идентификатор контрагента');
    }
    
    if (!mapping.counterpartyName) {
      errors.push('Не указано наименование контрагента');
    }
    
    if (!mapping.receivableExternalId) {
      errors.push('Не указан внешний идентификатор документа');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  getRequiredFields() {
    return {
      counterparty: [
        { key: 'counterpartyExternalId' as const, label: 'Внешний идентификатор', required: true },
        { key: 'counterpartyName' as const, label: 'Наименование', required: true },
        { key: 'counterpartyINN' as const, label: 'ИНН', required: false },
      ],
      receivable: [
        { key: 'receivableExternalId' as const, label: 'Внешний идентификатор', required: true },
        { key: 'receivableCounterpartyRef' as const, label: 'Ссылка на контрагента', required: true },
        { key: 'documentNumber' as const, label: 'Номер документа', required: false },
        { key: 'documentDate' as const, label: 'Дата документа', required: false },
        { key: 'dueDate' as const, label: 'Срок оплаты', required: false },
        { key: 'outstandingAmount' as const, label: 'Остаток задолженности', required: true },
        { key: 'currency' as const, label: 'Валюта', required: false },
      ],
    };
  }
  
  // --- Методы для управления поведением в тестах ---
  
  setFailConnection(shouldFail: boolean): void {
    this.shouldFailConnection = shouldFail;
  }
  
  setFailAuth(shouldFail: boolean): void {
    this.shouldFailAuth = shouldFail;
  }
  
  setReturnEmpty(shouldReturnEmpty: boolean): void {
    this.shouldReturnEmpty = shouldReturnEmpty;
  }
  
  setSimulatedDelay(ms: number): void {
    this.simulatedDelay = ms;
  }
  
  // --- Генерация тестовых данных ---
  
  private generateMockData(limit: number, offset: number = 0): SourceDataPayload {
    const counterparties: SourceCounterparty[] = [];
    const receivables: SourceReceivable[] = [];
    
    const numCounterparties = Math.min(5, limit);
    
    for (let i = 0; i < numCounterparties; i++) {
      const cpIndex = offset + i + 1;
      counterparties.push({
        external_id: `cp-${cpIndex}`,
        name: `ООО Контрагент ${cpIndex}`,
        inn: `77000000${cpIndex.toString().padStart(2, '0')}`,
      });
      
      // Для каждого контрагента создаём 1-3 документа
      const numDocs = 1 + (i % 3);
      for (let j = 0; j < numDocs; j++) {
        const docIndex = offset * 3 + i * 3 + j + 1;
        const daysOverdue = (docIndex % 5) * 15; // 0, 15, 30, 45, 60 дней
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() - daysOverdue);
        
        receivables.push({
          external_id: `rec-${docIndex}`,
          counterparty_external_id: `cp-${cpIndex}`,
          document_number: `СЧ-${docIndex.toString().padStart(4, '0')}`,
          document_date: new Date(dueDate.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          due_date: dueDate.toISOString().split('T')[0],
          outstanding_amount: ((docIndex * 10000 + 5000) / 100).toFixed(2),
          currency: 'RUB',
        });
      }
    }
    
    return {
      source: '1c_mock',
      exported_at: new Date().toISOString(),
      currency: 'RUB',
      counterparties,
      receivables,
    };
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
