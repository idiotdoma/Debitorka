// Mock AI Provider для демонстрации
// В production должен быть заменён на реальный backend с API-ключом

import type {
  AIProvider,
  CounterpartyAnalysis,
  LetterDraft,
  PriorityExplanation,
  DailyPlanItem,
  HistorySummary,
} from '../../types/ai';

export class MockAIProvider implements AIProvider {
  name = 'mock';

  async analyzeCounterparty(context: any): Promise<CounterpartyAnalysis> {
    // Имитация задержки сети
    await this.delay(800);

    const { counterparty, debts, communications, promises, tasks } = context;

    const totalDebt = debts.reduce((sum: number, d: any) => sum + d.amountCents, 0);
    const overdueDebts = debts.filter((d: any) => d.overdueDays > 0);
    const overdueAmount = overdueDebts.reduce((sum: number, d: any) => sum + d.amountCents, 0);
    const maxOverdue = Math.max(...debts.map((d: any) => d.overdueDays || 0), 0);

    return {
      summary: `Контрагент ${counterparty.name} имеет общую задолженность ${this.formatMoney(totalDebt)}, из которых ${this.formatMoney(overdueAmount)} просрочено. Максимальная просрочка составляет ${maxOverdue} дней.`,
      facts: [
        {
          fact: `Общая задолженность: ${this.formatMoney(totalDebt)}`,
          sourceType: 'debt',
          sourceId: debts[0]?.id,
        },
        {
          fact: `Просроченная задолженность: ${this.formatMoney(overdueAmount)}`,
          sourceType: 'debt',
        },
        {
          fact: `Количество документов: ${debts.length}`,
          sourceType: 'debt',
        },
        {
          fact: `Максимальная просрочка: ${maxOverdue} дней`,
          sourceType: 'debt',
        },
        {
          fact: `Количество контактов: ${communications.length}`,
          sourceType: 'communication',
        },
        {
          fact: `Активных обещаний оплаты: ${promises.filter((p: any) => p.status === 'expected').length}`,
          sourceType: 'promise',
        },
      ],
      concerns: [
        maxOverdue > 30 ? `Критическая просрочка ${maxOverdue} дней требует немедленных действий` : null,
        overdueAmount > totalDebt * 0.5 ? 'Более 50% задолженности просрочено' : null,
        communications.length === 0 ? 'Отсутствует история контактов — необходимо установить связь' : null,
        promises.filter((p: any) => p.status === 'broken').length > 0 ? 'Есть нарушенные обещания оплаты' : null,
      ].filter(Boolean) as string[],
      agreements: promises
        .filter((p: any) => p.status === 'expected' || p.status === 'fulfilled')
        .map((p: any) => `Обещание оплаты ${this.formatMoney(p.promisedAmountCents)} на ${p.promisedDate}`),
      recommendedAction: {
        action: maxOverdue > 30
          ? 'Срочно связаться с контрагентом для уточнения статуса платежа'
          : communications.length === 0
          ? 'Установить первичный контакт с контрагентом'
          : 'Запросить подтверждение даты платежа',
        reason: maxOverdue > 30
          ? `Просрочка ${maxOverdue} дней превышает допустимые сроки`
          : 'Отсутствует информация о планах контрагента',
      },
      missingInformation: [
        communications.length === 0 ? 'Неизвестно, контактировали ли вы с контрагентом' : null,
        promises.length === 0 ? 'Нет зафиксированных обещаний оплаты' : null,
      ].filter(Boolean) as string[],
    };
  }

  async generateLetter(context: any, options: any): Promise<LetterDraft> {
    await this.delay(1000);

    const { counterparty, debt, type } = context;
    const { tone, format } = options;

    const templates: Record<string, Record<string, string>> = {
      reminder_upcoming: {
        neutral: `Уважаемые партнёры!\n\nНапоминаем о предстоящем сроке оплаты по документу [номер документа] от [дата] в размере [сумма].\n\nПросим обеспечить оплату в установленный срок.\n\nС уважением,\n[Ваша компания]`,
        polite: `Уважаемые партнёры!\n\nБудем признательны, если вы сможете оплатить документ [номер документа] от [дата] в размере [сумма] в установленный срок.\n\nЕсли у вас возникли вопросы, пожалуйста, свяжитесь с нами.\n\nС уважением,\n[Ваша компания]`,
        firm: `Уважаемые партнёры!\n\nНапоминаем о необходимости оплаты документа [номер документа] от [дата] в размере [сумма] в установленный срок.\n\nПросим подтвердить дату платежа.\n\nС уважением,\n[Ваша компания]`,
      },
      reminder_overdue: {
        neutral: `Уважаемые партнёры!\n\nИнформируем о наличии просроченной задолженности по документу [номер документа] от [дата] в размере [сумма].\n\nСрок оплаты наступил [дата]. Просим срочно погасить задолженность.\n\nС уважением,\n[Ваша компания]`,
        polite: `Уважаемые партнёры!\n\nОбращаем ваше внимание на просроченную задолженность по документу [номер документа] от [дата] в размере [сумма].\n\nВозможно, оплата была отправлена, но ещё не поступила. Просим подтвердить статус платежа.\n\nС уважением,\n[Ваша компания]`,
        firm: `Уважаемые партнёры!\n\nНастоятельно напоминаем о просроченной задолженности по документу [номер документа] от [дата] в размере [сумма].\n\nСрок оплаты истёк. Просим немедленно погасить задолженность и сообщить дату платежа.\n\nС уважением,\n[Ваша компания]`,
      },
    };

    const templateType = type === 'reminder_upcoming' ? 'reminder_upcoming' : 'reminder_overdue';
    const body = templates[templateType]?.[tone] || templates.reminder_overdue.neutral;

    return {
      subject: `Напоминание о задолженности — ${counterparty.name}`,
      body,
      tone,
      format,
      placeholders: ['[номер документа]', '[дата]', '[сумма]', '[Ваша компания]'],
    };
  }

  async explainPriorities(context: any): Promise<PriorityExplanation[]> {
    await this.delay(900);

    const { debts } = context;

    return debts.slice(0, 5).map((debt: any) => {
      const priority = this.calculatePriority(debt);
      const reasons: string[] = [];

      if (debt.overdueDays > 60) reasons.push('Критическая просрочка (>60 дней)');
      else if (debt.overdueDays > 30) reasons.push('Значительная просрочка (>30 дней)');
      else if (debt.overdueDays > 0) reasons.push('Просрочка оплаты');

      if (debt.amountCents > 10000000) reasons.push('Крупная сумма задолженности');

      return {
        counterpartyId: debt.counterpartyName,
        counterpartyName: debt.counterpartyName,
        priority,
        reasons,
        facts: [
          {
            fact: `Сумма: ${this.formatMoney(debt.amountCents)}`,
            sourceType: 'debt',
            sourceId: debt.id,
          },
          {
            fact: `Просрочка: ${debt.overdueDays} дней`,
            sourceType: 'debt',
            sourceId: debt.id,
          },
        ],
        recommendedAction:
          debt.overdueDays > 60
            ? 'Срочно связаться с контрагентом'
            : debt.overdueDays > 30
            ? 'Запросить подтверждение даты платежа'
            : 'Отправить напоминание',
      };
    });
  }

  async generateDailyPlan(context: any): Promise<DailyPlanItem[]> {
    await this.delay(700);

    const { tasks, promises, debts } = context;
    const plan: DailyPlanItem[] = [];

    // Просроченные задачи
    tasks
      .filter((t: any) => t.status !== 'completed' && t.status !== 'cancelled' && new Date(t.dueDate) < new Date())
      .slice(0, 3)
      .forEach((task: any) => {
        plan.push({
          counterpartyName: task.counterpartyName || 'Не указан',
          task: task.title,
          reason: `Просрочена на ${Math.floor((Date.now() - new Date(task.dueDate).getTime()) / 86400000)} дней`,
          priority: 'high',
          relatedSourceId: task.id,
          estimatedTime: '30 мин',
        });
      });

    // Обещания, требующие проверки
    promises
      .filter((p: any) => p.status === 'expected' && new Date(p.promisedDate) <= new Date())
      .slice(0, 3)
      .forEach((promise: any) => {
        plan.push({
          counterpartyName: promise.counterpartyName,
          task: 'Проверить выполнение обещания оплаты',
          reason: `Обещанная дата ${promise.promisedDate} наступила`,
          priority: 'high',
          relatedSourceId: promise.id,
          estimatedTime: '15 мин',
        });
      });

    // Задачи на сегодня
    tasks
      .filter((t: any) => {
        const due = new Date(t.dueDate);
        const today = new Date();
        return (
          t.status !== 'completed' &&
          t.status !== 'cancelled' &&
          due.toDateString() === today.toDateString()
        );
      })
      .slice(0, 3)
      .forEach((task: any) => {
        plan.push({
          counterpartyName: task.counterpartyName || 'Не указан',
          task: task.title,
          reason: 'Срок выполнения сегодня',
          priority: 'medium',
          relatedSourceId: task.id,
          estimatedTime: '20 мин',
        });
      });

    return plan;
  }

  async summarizeHistory(context: any): Promise<HistorySummary> {
    await this.delay(800);

    const { counterparty, debts, communications, promises, tasks } = context;

    const totalDebt = debts.reduce((sum: number, d: any) => sum + d.amountCents, 0);
    const overdueAmount = debts
      .filter((d: any) => d.overdueDays > 0)
      .reduce((sum: number, d: any) => sum + d.amountCents, 0);

    return {
      currentSituation: `Общая задолженность ${counterparty.name} составляет ${this.formatMoney(totalDebt)}, из которых ${this.formatMoney(overdueAmount)} просрочено.`,
      recentContacts: communications.slice(0, 5).map((c: any) => ({
        date: c.contactDate,
        type: c.type,
        summary: c.summary,
      })),
      agreements: promises
        .filter((p: any) => p.status === 'expected' || p.status === 'fulfilled')
        .map((p: any) => `${this.formatMoney(p.promisedAmountCents)} на ${p.promisedDate} (${p.status})`),
      completedTasks: tasks
        .filter((t: any) => t.status === 'completed')
        .map((t: any) => t.title),
      pendingTasks: tasks
        .filter((t: any) => t.status !== 'completed' && t.status !== 'cancelled')
        .map((t: any) => t.title),
      nextSteps: [
        communications.length === 0 ? 'Установить контакт с контрагентом' : null,
        promises.filter((p: any) => p.status === 'expected').length > 0
          ? 'Проверить выполнение обещаний оплаты'
          : null,
        tasks.filter((t: any) => t.status !== 'completed').length > 0
          ? 'Выполнить открытые задачи'
          : null,
      ].filter(Boolean) as string[],
      needsClarification: [
        communications.length === 0 ? 'Отсутствует информация о контактах' : null,
        promises.length === 0 ? 'Нет зафиксированных обещаний оплаты' : null,
      ].filter(Boolean) as string[],
    };
  }

  async answerQuestion(context: any, question: string): Promise<string> {
    await this.delay(600);

    const { debts, tasks, promises } = context;

    const totalDebt = debts.reduce((sum: number, d: any) => sum + d.amountCents, 0);
    const overdueDebts = debts.filter((d: any) => d.overdueDays > 0);
    const overdueAmount = overdueDebts.reduce((sum: number, d: any) => sum + d.amountCents, 0);

    const q = question.toLowerCase();

    if (q.includes('общая задолженность') || q.includes('всего')) {
      return `Общая задолженность составляет ${this.formatMoney(totalDebt)}.`;
    }

    if (q.includes('просрочен')) {
      return `Просроченная задолженность: ${this.formatMoney(overdueAmount)} (${overdueDebts.length} документов).`;
    }

    if (q.includes('задач') || q.includes('задачи')) {
      const openTasks = tasks.filter((t: any) => t.status !== 'completed' && t.status !== 'cancelled');
      return `Открытых задач: ${openTasks.length}. Просроченных: ${openTasks.filter((t: any) => new Date(t.dueDate) < new Date()).length}.`;
    }

    if (q.includes('обещан') || q.includes('оплат')) {
      const expectedPromises = promises.filter((p: any) => p.status === 'expected');
      const totalExpected = expectedPromises.reduce((sum: number, p: any) => sum + p.promisedAmountCents, 0);
      return `Ожидаемых обещаний оплаты: ${expectedPromises.length} на сумму ${this.formatMoney(totalExpected)}.`;
    }

    return 'К сожалению, я не могу ответить на этот вопрос. Попробуйте спросить о задолженности, задачах или обещаниях оплаты.';
  }

  private calculatePriority(debt: any): number {
    let priority = 0;

    if (debt.overdueDays > 60) priority += 50;
    else if (debt.overdueDays > 30) priority += 30;
    else if (debt.overdueDays > 0) priority += 10;

    if (debt.amountCents > 10000000) priority += 20;
    else if (debt.amountCents > 5000000) priority += 10;

    return Math.min(priority, 100);
  }

  private formatMoney(cents: number): string {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 2,
    }).format(cents / 100);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
