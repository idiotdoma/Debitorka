// AI Service — центральный сервис для работы с ИИ
// Обеспечивает безопасность, кэширование и управление провайдерами

import type {
  AIConfig,
  AIProvider,
  AIRequest,
  AIResponse,
  CounterpartyAnalysis,
  LetterDraft,
  PriorityExplanation,
  DailyPlanItem,
  HistorySummary,
} from '../../types/ai';
import { MockAIProvider } from './mockProvider';
import { debtStore, communicationStore, promiseStore, taskStore } from '../store';
import type { AuthSession, UUID } from '../../types/models';

class AIService {
  private provider: AIProvider;
  private config: AIConfig;
  private requestLog: Array<{
    timestamp: string;
    operation: string;
    duration: number;
    success: boolean;
    error?: string;
  }> = [];

  constructor() {
    // По умолчанию используем mock-провайдер
    this.config = {
      provider: 'mock',
      maxTokens: 2000,
      temperature: 0.7,
      timeout: 30000,
    };
    this.provider = new MockAIProvider();
  }

  /**
   * Конфигурация провайдера
   * ВАЖНО: API-ключи должны храниться только на сервере!
   */
  configure(config: Partial<AIConfig>): void {
    this.config = { ...this.config, ...config };

    // В production здесь должна быть логика выбора провайдера
    // и инициализация с серверными переменными окружения
    if (config.provider === 'mock') {
      this.provider = new MockAIProvider();
    }
    // else if (config.provider === 'openai') {
    //   this.provider = new OpenAIProvider(config);
    // }
  }

  /**
   * Анализ контрагента
   */
  async analyzeCounterparty(
    counterpartyName: string,
    organizationId: UUID,
    session: AuthSession
  ): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      // Проверка доступа
      this.assertTenantAccess(organizationId, session);

      // Сбор контекста из разрешённых данных
      const context = await this.buildCounterpartyContext(counterpartyName, organizationId, session);

      // Вызов провайдера
      const result = await this.provider.analyzeCounterparty(context);

      // Формирование ответа с источниками
      const response: AIResponse = {
        success: true,
        operation: 'analyze_counterparty',
        data: result,
        sources: this.extractSources(result),
        timestamp: new Date().toISOString(),
        model: this.provider.name,
      };

      this.logRequest('analyze_counterparty', Date.now() - startTime, true);
      return response;
    } catch (error) {
      this.logRequest('analyze_counterparty', Date.now() - startTime, false, (error as Error).message);
      return this.handleError(error, 'analyze_counterparty');
    }
  }

  /**
   * Генерация письма
   */
  async generateLetter(
    counterpartyName: string,
    debtId: UUID,
    letterType: string,
    options: { tone: 'neutral' | 'polite' | 'firm'; format: 'email' | 'message' },
    organizationId: UUID,
    session: AuthSession
  ): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      this.assertTenantAccess(organizationId, session);

      const context = await this.buildLetterContext(counterpartyName, debtId, letterType, organizationId, session);

      const result = await this.provider.generateLetter(context, options);

      const response: AIResponse = {
        success: true,
        operation: 'generate_letter',
        data: result,
        timestamp: new Date().toISOString(),
        model: this.provider.name,
      };

      this.logRequest('generate_letter', Date.now() - startTime, true);
      return response;
    } catch (error) {
      this.logRequest('generate_letter', Date.now() - startTime, false, (error as Error).message);
      return this.handleError(error, 'generate_letter');
    }
  }

  /**
   * Объяснение приоритетов
   */
  async explainPriorities(
    organizationId: UUID,
    session: AuthSession
  ): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      this.assertTenantAccess(organizationId, session);

      const context = await this.buildPriorityContext(organizationId, session);

      const result = await this.provider.explainPriorities(context);

      const response: AIResponse = {
        success: true,
        operation: 'explain_priorities',
        data: result,
        sources: result.flatMap((r: any) => r.facts.map((f: any) => ({
          type: f.sourceType,
          id: f.sourceId || '',
          label: f.fact,
        }))),
        timestamp: new Date().toISOString(),
        model: this.provider.name,
      };

      this.logRequest('explain_priorities', Date.now() - startTime, true);
      return response;
    } catch (error) {
      this.logRequest('explain_priorities', Date.now() - startTime, false, (error as Error).message);
      return this.handleError(error, 'explain_priorities');
    }
  }

  /**
   * План на день
   */
  async generateDailyPlan(
    userId: UUID,
    organizationId: UUID,
    session: AuthSession
  ): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      this.assertTenantAccess(organizationId, session);

      const context = await this.buildDailyPlanContext(userId, organizationId, session);

      const result = await this.provider.generateDailyPlan(context);

      const response: AIResponse = {
        success: true,
        operation: 'daily_plan',
        data: result,
        timestamp: new Date().toISOString(),
        model: this.provider.name,
      };

      this.logRequest('daily_plan', Date.now() - startTime, true);
      return response;
    } catch (error) {
      this.logRequest('daily_plan', Date.now() - startTime, false, (error as Error).message);
      return this.handleError(error, 'daily_plan');
    }
  }

  /**
   * Сводка истории
   */
  async summarizeHistory(
    counterpartyName: string,
    organizationId: UUID,
    session: AuthSession
  ): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      this.assertTenantAccess(organizationId, session);

      const context = await this.buildCounterpartyContext(counterpartyName, organizationId, session);

      const result = await this.provider.summarizeHistory(context);

      const response: AIResponse = {
        success: true,
        operation: 'history_summary',
        data: result,
        timestamp: new Date().toISOString(),
        model: this.provider.name,
      };

      this.logRequest('history_summary', Date.now() - startTime, true);
      return response;
    } catch (error) {
      this.logRequest('history_summary', Date.now() - startTime, false, (error as Error).message);
      return this.handleError(error, 'history_summary');
    }
  }

  /**
   * Ответ на вопрос
   */
  async answerQuestion(
    question: string,
    organizationId: UUID,
    session: AuthSession
  ): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      this.assertTenantAccess(organizationId, session);

      // Ограничиваем контекст только разрешёнными данными
      const context = await this.buildQuestionContext(organizationId, session);

      const result = await this.provider.answerQuestion(context, question);

      const response: AIResponse = {
        success: true,
        operation: 'ask_question',
        data: { answer: result },
        timestamp: new Date().toISOString(),
        model: this.provider.name,
      };

      this.logRequest('ask_question', Date.now() - startTime, true);
      return response;
    } catch (error) {
      this.logRequest('ask_question', Date.now() - startTime, false, (error as Error).message);
      return this.handleError(error, 'ask_question');
    }
  }

  /**
   * Получение логов запросов
   */
  getRequestLog() {
    return this.requestLog;
  }

  // === Приватные методы ===

  private assertTenantAccess(organizationId: UUID, session: AuthSession): void {
    if (!session) {
      throw new Error('UNAUTHORIZED: Требуется авторизация');
    }
    if (session.organizationId !== organizationId) {
      throw new Error('FORBIDDEN: Доступ к данным другой организации запрещён');
    }
  }

  private async buildCounterpartyContext(
    counterpartyName: string,
    organizationId: UUID,
    session: AuthSession
  ) {
    const debts = debtStore.getAll(organizationId, session).filter(
      (d) => d.counterpartyName === counterpartyName
    );
    const communications = communicationStore.getByCounterparty(counterpartyName, organizationId, session);
    const promises = promiseStore.getAll(organizationId, session).filter(
      (p) => p.counterpartyName === counterpartyName
    );
    const tasks = taskStore.getByCounterparty(counterpartyName, organizationId, session);

    return {
      counterparty: { name: counterpartyName },
      debts,
      communications,
      promises,
      tasks,
    };
  }

  private async buildLetterContext(
    counterpartyName: string,
    debtId: UUID,
    letterType: string,
    organizationId: UUID,
    session: AuthSession
  ) {
    const debt = debtStore.getById(debtId, organizationId, session);
    if (!debt) {
      throw new Error('Документ не найден');
    }

    return {
      counterparty: { name: counterpartyName },
      debt,
      type: letterType,
    };
  }

  private async buildPriorityContext(organizationId: UUID, session: AuthSession) {
    const debts = debtStore.getAll(organizationId, session);

    // Сортируем по приоритету (просрочка + сумма)
    const sortedDebts = debts.sort((a, b) => {
      const priorityA = (a.overdueDays || 0) * 10 + a.amountCents / 1000000;
      const priorityB = (b.overdueDays || 0) * 10 + b.amountCents / 1000000;
      return priorityB - priorityA;
    });

    return { debts: sortedDebts.slice(0, 10) };
  }

  private async buildDailyPlanContext(
    userId: UUID,
    organizationId: UUID,
    session: AuthSession
  ) {
    const tasks = taskStore.getByAssignee(userId, organizationId, session);
    const promises = promiseStore.getAll(organizationId, session).filter(
      (p) => p.employeeId === userId
    );
    const debts = debtStore.getAll(organizationId, session);

    return { tasks, promises, debts };
  }

  private async buildQuestionContext(organizationId: UUID, session: AuthSession) {
    const debts = debtStore.getAll(organizationId, session);
    const tasks = taskStore.getAll(organizationId, session);
    const promises = promiseStore.getAll(organizationId, session);

    return { debts, tasks, promises };
  }

  private extractSources(analysis: CounterpartyAnalysis) {
    return analysis.facts
      .filter((f) => f.sourceId)
      .map((f) => ({
        type: f.sourceType,
        id: f.sourceId!,
        label: f.fact,
      }));
  }

  private handleError(error: unknown, operation: string): AIResponse {
    return {
      success: false,
      operation: operation as any,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      timestamp: new Date().toISOString(),
    };
  }

  private logRequest(operation: string, duration: number, success: boolean, error?: string) {
    this.requestLog.push({
      timestamp: new Date().toISOString(),
      operation,
      duration,
      success,
      error,
    });

    // Ограничиваем размер лога
    if (this.requestLog.length > 100) {
      this.requestLog = this.requestLog.slice(-100);
    }
  }
}

// Singleton instance
export const aiService = new AIService();
