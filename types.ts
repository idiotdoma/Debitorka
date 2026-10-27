// ============================================================
// Интерфейс адаптера источника данных
// Все адаптеры должны реализовывать этот интерфейс
// ============================================================

import {
  DataSourceType,
  FieldMapping,
  SourceDataPayload,
  IntegrationConnection,
} from '../../../types/integration';

// --- Результат проверки соединения ---

export type ConnectionTestResult =
  | { success: true; metadata?: Record<string, any> }
  | {
      success: false;
      error:
        | 'server_unreachable'
        | 'auth_failed'
        | 'insufficient_permissions'
        | 'metadata_unavailable'
        | 'unsupported_structure'
        | 'missing_outstanding_amount'
        | 'timeout'
        | 'invalid_url'
        | 'unknown';
      message: string;
    };

// --- Результат обнаружения сущностей ---

export interface DiscoveredEntity {
  name: string;
  displayName: string;
  fields: DiscoveredField[];
}

export interface DiscoveredField {
  name: string;
  displayName: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'reference';
  required: boolean;
}

// --- Интерфейс адаптера ---

export interface DataSourceAdapter {
  readonly type: DataSourceType;
  readonly displayName: string;
  
  /**
   * Проверка соединения с источником
   * НЕ должна сохранять секреты в логах
   */
  testConnection(
    endpoint: string,
    credentials: Record<string, any>
  ): Promise<ConnectionTestResult>;
  
  /**
   * Обнаружение доступных сущностей и полей
   * Вызывается только после успешной проверки соединения
   */
  discoverEntities(
    endpoint: string,
    credentials: Record<string, any>
  ): Promise<DiscoveredEntity[]>;
  
  /**
   * Получение данных для предпросмотра
   * Возвращает ограниченную выборку (не все данные)
   */
  fetchPreview(
    endpoint: string,
    credentials: Record<string, any>,
    mapping: FieldMapping,
    limit?: number
  ): Promise<SourceDataPayload>;
  
  /**
   * Получение полных данных для синхронизации
   * Поддерживает пагинацию и инкрементальную загрузку
   */
  fetchFullData(
    endpoint: string,
    credentials: Record<string, any>,
    mapping: FieldMapping,
    options?: {
      since?: string; // ISO datetime для инкрементальной загрузки
      pageSize?: number;
      timeout?: number;
    }
  ): AsyncGenerator<SourceDataPayload, void, unknown>;
  
  /**
   * Валидация сопоставления полей
   * Проверяет, что обязательные поля (особенно outstanding_amount) настроены
   */
  validateMapping(
    mapping: FieldMapping,
    availableEntities: DiscoveredEntity[]
  ): { valid: boolean; errors: string[] };
  
  /**
   * Получение описания обязательных полей для этого типа источника
   */
  getRequiredFields(): {
    counterparty: Array<{ key: keyof FieldMapping; label: string; required: boolean }>;
    receivable: Array<{ key: keyof FieldMapping; label: string; required: boolean }>;
  };
}

// --- Фабрика адаптеров ---

export class AdapterFactory {
  private adapters: Map<DataSourceType, DataSourceAdapter> = new Map();
  
  register(adapter: DataSourceAdapter): void {
    this.adapters.set(adapter.type, adapter);
  }
  
  get(type: DataSourceType): DataSourceAdapter | undefined {
    return this.adapters.get(type);
  }
  
  getAll(): DataSourceAdapter[] {
    return Array.from(this.adapters.values());
  }
  
  isSupported(type: string): boolean {
    return this.adapters.has(type as DataSourceType);
  }
}

// --- Singleton ---

export const adapterFactory = new AdapterFactory();
