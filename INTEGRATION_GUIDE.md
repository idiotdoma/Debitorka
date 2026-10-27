# Настройка интеграции с 1С и внешними источниками

## Текущий статус

Приложение работает в **демонстрационном режиме** с mock-адаптером. Для production-использования необходима настройка реального backend с безопасным хранением секретов.

## Архитектура интеграции

```
┌─────────────────┐
│   React UI      │
│ IntegrationsPage│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Sync Service   │
│ (syncService.ts)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Adapter Factory │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────────┐
│ Mock   │ │ Custom HTTP│
│ 1С     │ │ API        │
└────────┘ └────────────┘
```

### Компоненты

1. **IntegrationsPage** — UI для управления подключениями
2. **SyncService** — координация синхронизации
3. **DataSourceAdapter** — интерфейс для адаптеров источников
4. **MockOneCAdapter** — демонстрационный адаптер 1С
5. **CustomHttpAdapter** — адаптер для пользовательского HTTP API

## Поддерживаемые способы интеграции

### 1. 1С через OData REST (демонстрационный)

**Статус:** Mock-адаптер для тестирования UI

**Для production необходимо:**
- Настроить OData-интерфейс в 1С
- Реализовать серверный backend
- Настроить безопасное хранение учётных данных

**Пример настройки OData в 1С:**
1. Открыть консоль администрирования 1С
2. Выбрать базу данных
3. Свойства → Включить OData-интерфейс
4. Настроить публикацию на веб-сервере
5. Создать пользователя для интеграции

### 2. Пользовательский HTTP API

**Статус:** Реализован адаптер, требуется серверный backend

**Формат данных:**
```json
{
  "source": "custom_api",
  "exported_at": "2026-01-15T10:00:00Z",
  "currency": "RUB",
  "counterparties": [
    {
      "external_id": "cp-001",
      "name": "ООО Пример",
      "inn": "7700000000"
    }
  ],
  "receivables": [
    {
      "external_id": "rec-001",
      "counterparty_external_id": "cp-001",
      "document_number": "СЧ-001",
      "document_date": "2026-01-01",
      "due_date": "2026-01-15",
      "outstanding_amount": "125000.00",
      "currency": "RUB"
    }
  ]
}
```

**Обязательные поля:**
- `counterparties[].external_id` — уникальный идентификатор контрагента
- `counterparties[].name` — наименование
- `receivables[].external_id` — уникальный идентификатор записи
- `receivables[].counterparty_external_id` — ссылка на контрагента
- `receivables[].outstanding_amount` — **остаток задолженности** (обязательно!)
- `receivables[].document_number` — номер документа

**Опциональные поля:**
- `counterparties[].inn` — ИНН
- `receivables[].document_date` — дата документа
- `receivables[].due_date` — срок оплаты
- `receivables[].currency` — валюта (по умолчанию RUB)

### 3. Ручной импорт Excel/CSV

**Статус:** Полностью реализован и работает

**Использование:**
1. Перейдите в раздел "Импорт"
2. Загрузите файл Excel или CSV
3. Сопоставьте столбцы с полями приложения
4. Подтвердите импорт

## Настройка для production

### 1. Реализуйте backend API

Пример endpoint'ов:

```typescript
// POST /api/integrations/test
// Проверка соединения с источником
POST /api/integrations/test
Headers: Authorization: Bearer <user-token>
Body: {
  "connectionId": "int-123",
  "sourceType": "onec_odata",
  "endpoint": "https://1c.example.com/odata",
  "credentials": {
    "username": "integration_user",
    "password": "secure_password"
  }
}

// POST /api/integrations/sync
// Запуск синхронизации
POST /api/integrations/sync
Headers: Authorization: Bearer <user-token>
Body: {
  "connectionId": "int-123",
  "trigger": "manual"
}

// GET /api/integrations/:id/history
// Получение истории синхронизаций
GET /api/integrations/int-123/history
Headers: Authorization: Bearer <user-token>
```

### 2. Настройте переменные окружения

Создайте файл `.env` на сервере (НЕ коммитить в git!):

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/debitor

# Encryption key for secrets (generate with: openssl rand -hex 32)
SECRETS_ENCRYPTION_KEY=your-secure-encryption-key-here

# 1С Integration (optional)
ONEC_DEFAULT_TIMEOUT=30000
ONEC_MAX_PAGE_SIZE=100

# Custom HTTP API (optional)
CUSTOM_API_TIMEOUT=30000
CUSTOM_API_MAX_RESPONSE_SIZE=52428800

# Scheduler
SYNC_SCHEDULER_ENABLED=true
SYNC_DEFAULT_INTERVAL_HOURS=6
```

### 3. Реализуйте безопасное хранение секретов

Пример шифрования учётных данных:

```typescript
// server/lib/secrets.ts
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.SECRETS_ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';

export function encryptSecret(data: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptSecret(encryptedData: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

### 4. Реализуйте фоновые задачи

Пример с использованием Bull (Redis):

```typescript
// server/workers/syncWorker.ts
import { Queue, Worker } from 'bull';
import { syncService } from '../lib/integration/syncService';

const syncQueue = new Queue('sync', process.env.REDIS_URL);

// Добавление задачи в очередь
export async function scheduleSync(connectionId: string, trigger: 'manual' | 'scheduled') {
  await syncQueue.add('sync', {
    connectionId,
    trigger,
  }, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  });
}

// Обработка задачи
const worker = new Worker('sync', async (job) => {
  const { connectionId, trigger } = job.data;
  
  const connection = await db.integration.findUnique({
    where: { id: connectionId },
  });
  
  if (!connection) {
    throw new Error('Connection not found');
  }
  
  // Расшифровка учётных данных
  const credentials = decryptSecret(connection.encryptedCredentials);
  
  // Выполнение синхронизации
  const history = await syncService.executeSync(
    connection,
    credentials,
    connection.organizationId,
    trigger,
    null // system user
  );
  
  return history;
});

// Планировщик для автоматической синхронизации
import cron from 'node-cron';

cron.schedule('0 */6 * * *', async () => {
  // Каждые 6 часов
  const connections = await db.integration.findMany({
    where: {
      syncPaused: false,
      status: 'ready_for_sync',
    },
  });
  
  for (const connection of connections) {
    await scheduleSync(connection.id, 'scheduled');
  }
});
```

### 5. Обновите клиент для работы с backend

```typescript
// src/lib/integration/syncService.ts
class SyncService {
  async testConnection(connection: IntegrationConnection, credentials: Record<string, any>) {
    const response = await fetch('/api/integrations/test', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        connectionId: connection.id,
        sourceType: connection.sourceType,
        endpoint: connection.endpoint,
        credentials,
      }),
    });
    
    return response.json();
  }
  
  async executeSync(connection: IntegrationConnection, trigger: 'manual' | 'scheduled') {
    const response = await fetch('/api/integrations/sync', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        connectionId: connection.id,
        trigger,
      }),
    });
    
    return response.json();
  }
}
```

## Файл .env.example

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/debitor

# Encryption key for secrets (generate with: openssl rand -hex 32)
SECRETS_ENCRYPTION_KEY=

# 1С Integration
ONEC_DEFAULT_TIMEOUT=30000
ONEC_MAX_PAGE_SIZE=100

# Custom HTTP API
CUSTOM_API_TIMEOUT=30000
CUSTOM_API_MAX_RESPONSE_SIZE=52428800

# Scheduler
SYNC_SCHEDULER_ENABLED=true
SYNC_DEFAULT_INTERVAL_HOURS=6

# Redis (for background jobs)
REDIS_URL=redis://localhost:6379
```

## Проверка подключения к реальной 1С

### Чеклист

- [ ] OData-интерфейс включён в 1С
- [ ] Веб-сервер настроен и доступен
- [ ] Пользователь для интеграции создан в 1С
- [ ] Права доступа настроены (только чтение)
- [ ] Серверный backend реализован
- [ ] База данных PostgreSQL настроена
- [ ] Шифрование секретов реализовано
- [ ] Фоновые задачи настроены
- [ ] Клиент обновлён для работы с backend
- [ ] Тестовая синхронизация выполнена успешно

### Тестирование

1. **Проверка соединения**
   - Нажмите "Проверить соединение"
   - Должен вернуться успешный статус
   - Проверьте логи сервера на наличие ошибок

2. **Предпросмотр данных**
   - Нажмите "Предпросмотр"
   - Убедитесь, что данные корректно получены из 1С
   - Проверьте наличие обязательных полей

3. **Первичная синхронизация**
   - Нажмите "Запустить синхронизацию"
   - Проверьте, что записи созданы в приложении
   - Убедитесь, что суммы корректны

4. **Повторная синхронизация**
   - Запустите синхронизацию повторно
   - Убедитесь, что дублирования нет
   - Проверьте, что обновлённые записи корректны

## Ограничения и известные проблемы

### Текущие ограничения

1. **Нет серверной части** — вся логика на клиенте
2. **Нет безопасного хранения секретов** — учётные данные не сохраняются
3. **Нет автоматической синхронизации** — только ручная
4. **Нет постоянного хранилища** — данные в localStorage
5. **Mock-адаптер** — не подключается к реальной 1С

### Решения для production

1. **Реализовать backend API** — Node.js/Express или аналог
2. **Настроить PostgreSQL** — постоянное хранилище данных
3. **Реализовать шифрование секретов** — AES-256-GCM
4. **Настроить фоновые задачи** — Bull + Redis или аналоги
5. **Протестировать с реальной 1С** — настройка OData-интерфейса

## Дополнительные ресурсы

- [1С: Предприятие - Публикация на веб-сервере](https://its.1c.ru/db/v8315doc)
- [1С: OData интерфейс](https://its.1c.ru/db/v8315doc#bookmark:dev:TI000000155)
- [Bull Queue Documentation](https://github.com/OptimalBits/bull)
- [Node-cron Documentation](https://github.com/node-cron/node-cron)

## Поддержка

Для вопросов по интеграции с 1С:
- Проверьте настройки OData-интерфейса в 1С
- Убедитесь в доступности веб-сервера
- Проверьте права доступа пользователя интеграции
- Изучите логи серверного backend

Для вопросов по архитектуре:
- См. `STAGE5_REPORT.md` — подробный отчёт о реализации
- См. `AI_CONFIG.md` — документация по ИИ-помощнику
- См. `README.md` — общая документация проекта
