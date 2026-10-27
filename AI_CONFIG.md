# Конфигурация ИИ-помощника

## Текущий статус

Приложение работает в **демонстрационном режиме** с mock-провайдером. Для production-использования необходима настройка реального backend с API-ключами.

## Архитектура

```
┌─────────────────┐
│   React UI      │
│ AIAssistantPage │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   AI Service    │
│  (aiService.ts) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AI Provider    │
│ (mockProvider)  │
└─────────────────┘
```

### Компоненты

1. **AIAssistantPage** — UI для взаимодействия с ИИ
2. **aiService** — центральный сервис, управляет провайдерами и обеспечивает безопасность
3. **AI Provider** — абстракция для разных ИИ-провайдеров (OpenAI, Anthropic, etc.)

## Безопасность

### Критические правила

1. **API-ключи НЕ должны храниться на клиенте**
   - ❌ Не в React-компонентах
   - ❌ Не в localStorage
   - ❌ Не в переменных окружения, попадающих в bundle
   - ✅ Только в серверных переменных окружения

2. **Все запросы к ИИ должны проходить через backend**
   - Backend проверяет авторизацию пользователя
   - Backend проверяет принадлежность данных организации
   - Backend формирует контекст из разрешённых данных
   - Backend вызывает ИИ-провайдер с серверным API-ключом

3. **Ограничения передаваемых данных**
   - Передавать только необходимый контекст
   - Не передавать пароли, токены, банковские реквизиты
   - Не передавать полные файлы импорта
   - Помечать заметки как недоверенные данные

## Настройка для production

### 1. Создайте backend API

Пример endpoint'а:

```typescript
// server/api/ai.ts
POST /api/ai/analyze
Headers: Authorization: Bearer <user-token>
Body: {
  "counterpartyName": "ООО Пример",
  "organizationId": "org-123"
}
```

### 2. Настройте переменные окружения

Создайте файл `.env` на сервере (НЕ коммитить в git!):

```bash
# AI Provider Configuration
AI_PROVIDER=openai  # или anthropic
OPENAI_API_KEY=sk-...  # только на сервере!
ANTHROPIC_API_KEY=sk-ant-...  # только на сервере!
AI_MODEL=gpt-4o-mini  # или claude-3-5-sonnet-20241022
AI_MAX_TOKENS=2000
AI_TEMPERATURE=0.7
AI_TIMEOUT=30000
```

### 3. Реализуйте AI Provider

Пример для OpenAI:

```typescript
// server/lib/ai/openaiProvider.ts
import OpenAI from 'openai';

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  
  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  
  async analyzeCounterparty(context: any): Promise<CounterpartyAnalysis> {
    const response = await this.client.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Ты — финансовый аналитик. Анализируй задолженности и давай рекомендации.
          Работай ТОЛЬКО с переданными данными. Не придумывай факты.
          Если данных недостаточно, укажи это.`,
        },
        {
          role: 'user',
          content: JSON.stringify(context),
        },
      ],
      max_tokens: parseInt(process.env.AI_MAX_TOKENS || '2000'),
      temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
    });
    
    // Парсинг и валидация ответа
    return this.parseResponse(response);
  }
}
```

### 4. Обновите aiService для использования backend

```typescript
// src/lib/ai/aiService.ts
class AIService {
  async analyzeCounterparty(...) {
    // В production: вызов backend API
    const response = await fetch('/api/ai/analyze', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        counterpartyName,
        organizationId,
      }),
    });
    
    return response.json();
  }
}
```

## Файл .env.example

Создайте файл `.env.example` для документации (без реальных ключей):

```bash
# AI Provider Configuration
# Выберите провайдера: mock, openai, anthropic
AI_PROVIDER=mock

# OpenAI Configuration (только для сервера!)
# OPENAI_API_KEY=sk-...
# AI_MODEL=gpt-4o-mini

# Anthropic Configuration (только для сервера!)
# ANTHROPIC_API_KEY=sk-ant-...
# AI_MODEL=claude-3-5-sonnet-20241022

# AI Settings
AI_MAX_TOKENS=2000
AI_TEMPERATURE=0.7
AI_TIMEOUT=30000
```

## Ограничения демонстрационного режима

1. **Mock-провайдер** — ответы генерируются локально, без реального ИИ
2. **Нет серверной авторизации** — tenant isolation на клиенте
3. **Нет реального API** — все данные в localStorage
4. **Ограниченная аналитика** — базовые шаблоны вместо полноценного ИИ

## Переход на production

### Чеклист

- [ ] Реализован backend API для ИИ
- [ ] Настроена серверная аутентификация
- [ ] API-ключи хранятся только на сервере
- [ ] Реализована проверка принадлежности данных организации
- [ ] Настроены ограничения запросов (rate limiting)
- [ ] Реализовано логирование (без конфиденциальных данных)
- [ ] Настроены переменные окружения
- [ ] Протестирована безопасность
- [ ] Обновлена документация

### Архитектурные блокеры

1. **Нет backend** — текущая архитектура полностью клиентская
2. **Нет серверной аутентификации** — нельзя безопасно хранить API-ключи
3. **Нет защиты данных** — localStorage не подходит для финансовых данных

**Вывод**: Для коммерческого использования необходима полная серверная архитектура.

## Тестирование

### Запуск тестов

```bash
npm run test
```

### Тесты ИИ-сервиса

- Анализ контрагента
- Генерация писем
- Объяснение приоритетов
- План на день
- Ответы на вопросы
- Безопасность (tenant isolation)
- Логирование

## Мониторинг

### Логи запросов

```typescript
const log = aiService.getRequestLog();
// [
//   {
//     timestamp: "2024-01-15T10:30:00Z",
//     operation: "analyze_counterparty",
//     duration: 1234,
//     success: true,
//   }
// ]
```

### Метрики

- Количество запросов
- Среднее время ответа
- Процент успешных запросов
- Использование токенов (если доступно)

## Поддержка провайдеров

### Текущие

- ✅ Mock (демонстрационный)

### Планируемые

- ⏳ OpenAI (GPT-4, GPT-4o)
- ⏳ Anthropic (Claude 3.5 Sonnet)
- ⏳ Google (Gemini)
- ⏳ Локальные модели (Ollama)

## Дополнительные ресурсы

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Anthropic API Documentation](https://docs.anthropic.com)
- [OWASP AI Security Guide](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
