import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { debtStore, taskStore, promiseStore } from '../lib/store';
import { formatCurrency, formatDate } from '../lib/calculations';
import { Sparkles, FileText, Target, Calendar, History, MessageCircle, AlertCircle } from 'lucide-react';

type AIFunction = 'analyze' | 'priorities' | 'daily_plan' | 'question';

export default function AIAssistantPage() {
  const { session, organization } = useAuth();
  const [activeFunction, setActiveFunction] = useState<AIFunction | null>(null);
  const [selectedCounterparty, setSelectedCounterparty] = useState('');
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<any>(null);

  const debts = useMemo(() => {
    if (!session || !organization) return [];
    return debtStore.getAll(organization.id, session);
  }, [session, organization]);

  const tasks = useMemo(() => {
    if (!session || !organization) return [];
    return taskStore.getAll(organization.id, session);
  }, [session, organization]);

  const promises = useMemo(() => {
    if (!session || !organization) return [];
    return promiseStore.getAll(organization.id, session);
  }, [session, organization]);

  const counterparties = useMemo(() => {
    return Array.from(new Set(debts.map(d => d.counterpartyName))).sort();
  }, [debts]);

  const handleAnalyze = () => {
    if (!selectedCounterparty) return;
    
    const cpDebts = debts.filter(d => d.counterpartyName === selectedCounterparty);
    const totalDebt = cpDebts.reduce((sum, d) => sum + d.amountCents, 0);
    const overdueDebts = cpDebts.filter(d => d.overdueDays !== null && d.overdueDays > 0);
    const maxOverdue = Math.max(...cpDebts.map(d => d.overdueDays || 0), 0);
    
    setResult({
      type: 'analysis',
      counterparty: selectedCounterparty,
      totalDebt,
      documentsCount: cpDebts.length,
      overdueCount: overdueDebts.length,
      maxOverdueDays: maxOverdue,
      recommendation: maxOverdue > 60 
        ? 'Критическая просрочка. Рекомендуется срочный контакт с контрагентом.'
        : maxOverdue > 30
        ? 'Значительная просрочка. Рекомендуется отправить напоминание.'
        : maxOverdue > 0
        ? 'Есть просрочка. Рекомендуется уточнить статус платежа.'
        : 'Задолженность в норме. Продолжайте мониторинг.',
    });
  };

  const handlePriorities = () => {
    const prioritized = debts
      .filter(d => d.overdueDays !== null && d.overdueDays > 0)
      .sort((a, b) => (b.overdueDays || 0) - (a.overdueDays || 0))
      .slice(0, 5);
    
    setResult({
      type: 'priorities',
      items: prioritized.map(d => ({
        counterparty: d.counterpartyName,
        amount: d.amountCents,
        overdueDays: d.overdueDays,
        reason: (d.overdueDays || 0) > 60 ? 'Критическая просрочка' : 
                (d.overdueDays || 0) > 30 ? 'Значительная просрочка' : 'Просрочка',
        action: (d.overdueDays || 0) > 60 ? 'Срочный контакт' : 'Отправить напоминание',
      })),
    });
  };

  const handleDailyPlan = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const overdueTasks = tasks.filter(t => 
      t.status !== 'completed' && t.status !== 'cancelled' && new Date(t.dueDate) < today
    );
    
    const todayTasks = tasks.filter(t => {
      if (t.status === 'completed' || t.status === 'cancelled') return false;
      const due = new Date(t.dueDate);
      due.setHours(0, 0, 0, 0);
      return due.getTime() === today.getTime();
    });
    
    const promisesToCheck = promises.filter(p => 
      p.status === 'expected' && new Date(p.promisedDate) <= today
    );
    
    setResult({
      type: 'daily_plan',
      overdueTasks: overdueTasks.length,
      todayTasks: todayTasks.length,
      promisesToCheck: promisesToCheck.length,
      items: [
        ...overdueTasks.map(t => ({
          type: 'task',
          title: t.title,
          counterparty: t.counterpartyName || '—',
          priority: 'high',
          reason: `Просрочена на ${Math.floor((today.getTime() - new Date(t.dueDate).getTime()) / 86400000)} дн.`,
        })),
        ...todayTasks.map(t => ({
          type: 'task',
          title: t.title,
          counterparty: t.counterpartyName || '—',
          priority: 'medium',
          reason: 'Срок выполнения сегодня',
        })),
        ...promisesToCheck.map(p => ({
          type: 'promise',
          title: `Проверить обещание от ${p.contactName}`,
          counterparty: p.counterpartyName,
          priority: 'high',
          reason: `Обещанная дата ${formatDate(p.promisedDate)} наступила`,
        })),
      ],
    });
  };

  const handleQuestion = () => {
    if (!question.trim()) return;
    
    const totalDebt = debts.reduce((sum, d) => sum + d.amountCents, 0);
    const overdueDebts = debts.filter(d => d.overdueDays !== null && d.overdueDays > 0);
    const overdueAmount = overdueDebts.reduce((sum, d) => sum + d.amountCents, 0);
    const openTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
    const expectedPromises = promises.filter(p => p.status === 'expected');
    
    const q = question.toLowerCase();
    let answer = '';
    
    if (q.includes('общая') || q.includes('всего') || q.includes('задолженность')) {
      answer = `Общая задолженность: ${formatCurrency(totalDebt)}. Просрочено: ${formatCurrency(overdueAmount)} (${overdueDebts.length} документов).`;
    } else if (q.includes('просроч')) {
      answer = `Просроченная задолженность: ${formatCurrency(overdueAmount)} в ${overdueDebts.length} документах.`;
    } else if (q.includes('задач')) {
      answer = `Открытых задач: ${openTasks.length}. Просроченных: ${openTasks.filter(t => new Date(t.dueDate) < new Date()).length}.`;
    } else if (q.includes('обещан') || q.includes('оплат')) {
      const totalExpected = expectedPromises.reduce((sum, p) => sum + p.promisedAmountCents, 0);
      answer = `Ожидаемых обещаний оплаты: ${expectedPromises.length} на сумму ${formatCurrency(totalExpected)}.`;
    } else {
      answer = 'Я могу ответить на вопросы о задолженности, задачах и обещаниях оплаты. Попробуйте спросить: "Какая общая задолженность?" или "Сколько просроченных документов?"';
    }
    
    setResult({ type: 'question', answer });
  };

  const functions = [
    { id: 'analyze' as AIFunction, label: 'Анализ контрагента', icon: Sparkles },
    { id: 'priorities' as AIFunction, label: 'Приоритеты', icon: Target },
    { id: 'daily_plan' as AIFunction, label: 'План на день', icon: Calendar },
    { id: 'question' as AIFunction, label: 'Задать вопрос', icon: MessageCircle },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">ИИ-помощник</h1>
        <p className="text-blue-200/60 mt-1">Аналитика и рекомендации на основе данных</p>
        <div className="mt-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-yellow-200 text-xs">
            ⚠️ Демонстрационный режим: аналитика основана на правилах. Для production необходима настройка LLM API.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {functions.map((func) => {
          const Icon = func.icon;
          return (
            <button
              key={func.id}
              onClick={() => { setActiveFunction(func.id); setResult(null); }}
              className={`p-4 rounded-xl border transition ${
                activeFunction === func.id
                  ? 'bg-blue-600/20 border-blue-500/50 text-white'
                  : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
              }`}
            >
              <Icon className="w-6 h-6 mx-auto mb-2" />
              <span className="text-xs text-center block">{func.label}</span>
            </button>
          );
        })}
      </div>

      {activeFunction === 'analyze' && (
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Анализ контрагента</h3>
          <select
            value={selectedCounterparty}
            onChange={(e) => setSelectedCounterparty(e.target.value)}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
          >
            <option value="">Выберите контрагента</option>
            {counterparties.map((cp) => (
              <option key={cp} value={cp} className="bg-slate-800">{cp}</option>
            ))}
          </select>
          <button
            onClick={handleAnalyze}
            disabled={!selectedCounterparty}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg transition"
          >
            Анализировать
          </button>
        </div>
      )}

      {activeFunction === 'priorities' && (
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Приоритеты задолженности</h3>
          <button
            onClick={handlePriorities}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition"
          >
            Показать приоритеты
          </button>
        </div>
      )}

      {activeFunction === 'daily_plan' && (
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">План на день</h3>
          <button
            onClick={handleDailyPlan}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition"
          >
            Составить план
          </button>
        </div>
      )}

      {activeFunction === 'question' && (
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Задать вопрос</h3>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Например: Какая общая задолженность?"
            rows={3}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30"
          />
          <button
            onClick={handleQuestion}
            disabled={!question.trim()}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-lg transition"
          >
            Спросить
          </button>
        </div>
      )}

      {result && result.type === 'analysis' && (
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Результат анализа: {result.counterparty}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-lg p-3">
              <p className="text-white/40 text-xs">Общая задолженность</p>
              <p className="text-white font-bold">{formatCurrency(result.totalDebt)}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <p className="text-white/40 text-xs">Документов</p>
              <p className="text-white font-bold">{result.documentsCount}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <p className="text-white/40 text-xs">Просрочено</p>
              <p className="text-white font-bold">{result.overdueCount}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <p className="text-white/40 text-xs">Макс. просрочка</p>
              <p className="text-white font-bold">{result.maxOverdueDays} дн.</p>
            </div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <p className="text-blue-200 text-sm font-medium mb-1">Рекомендация:</p>
            <p className="text-white text-sm">{result.recommendation}</p>
          </div>
        </div>
      )}

      {result && result.type === 'priorities' && (
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Приоритеты</h3>
          {result.items.length === 0 ? (
            <p className="text-white/40">Нет просроченных задолженностей</p>
          ) : (
            <div className="space-y-3">
              {result.items.map((item: any, i: number) => (
                <div key={i} className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-white font-medium">{item.counterparty}</p>
                    <span className="text-red-300 text-sm">{item.overdueDays} дн.</span>
                  </div>
                  <p className="text-white/60 text-sm">{formatCurrency(item.amount)} — {item.reason}</p>
                  <p className="text-green-300 text-sm mt-1">→ {item.action}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {result && result.type === 'daily_plan' && (
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">План на сегодня</h3>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-red-500/10 rounded-lg p-3 text-center border border-red-500/20">
              <p className="text-2xl font-bold text-red-300">{result.overdueTasks}</p>
              <p className="text-xs text-red-300/60">Просрочено</p>
            </div>
            <div className="bg-blue-500/10 rounded-lg p-3 text-center border border-blue-500/20">
              <p className="text-2xl font-bold text-blue-300">{result.todayTasks}</p>
              <p className="text-xs text-blue-300/60">На сегодня</p>
            </div>
            <div className="bg-yellow-500/10 rounded-lg p-3 text-center border border-yellow-500/20">
              <p className="text-2xl font-bold text-yellow-300">{result.promisesToCheck}</p>
              <p className="text-xs text-yellow-300/60">Обещаний</p>
            </div>
          </div>
          {result.items.length === 0 ? (
            <p className="text-white/40">Нет задач на сегодня</p>
          ) : (
            <div className="space-y-2">
              {result.items.map((item: any, i: number) => (
                <div key={i} className="bg-white/5 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-white text-sm font-medium">{item.title}</p>
                    <span className={`text-xs ${
                      item.priority === 'high' ? 'text-red-300' : 'text-yellow-300'
                    }`}>
                      {item.priority === 'high' ? '🔴' : '🟡'}
                    </span>
                  </div>
                  <p className="text-white/40 text-xs">{item.counterparty} • {item.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {result && result.type === 'question' && (
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Ответ</h3>
          <p className="text-white">{result.answer}</p>
        </div>
      )}
    </div>
  );
}
