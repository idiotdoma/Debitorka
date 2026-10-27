import React, { useState } from 'react';
import { aiService } from '../lib/ai/aiService';
import { useAuth } from '../contexts/AuthContext';
import { debtStore } from '../lib/store';
import type { CounterpartyAnalysis, LetterDraft, PriorityExplanation, DailyPlanItem, HistorySummary } from '../types/ai';
import { Sparkles, FileText, Target, Calendar, History, MessageCircle, Loader2, AlertCircle } from 'lucide-react';

type AIFunction = 'analyze' | 'letter' | 'priorities' | 'daily_plan' | 'history' | 'question';

export default function AIAssistantPage() {
  const { session, organization } = useAuth();
  const [activeFunction, setActiveFunction] = useState<AIFunction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  // Состояния для разных функций
  const [selectedCounterparty, setSelectedCounterparty] = useState('');
  const [selectedDebt, setSelectedDebt] = useState('');
  const [letterType, setLetterType] = useState('reminder_overdue');
  const [letterTone, setLetterTone] = useState<'neutral' | 'polite' | 'firm'>('neutral');
  const [letterFormat, setLetterFormat] = useState<'email' | 'message'>('email');
  const [question, setQuestion] = useState('');

  // Список контрагентов
  const counterparties = React.useMemo(() => {
    if (!session || !organization) return [];
    const debts = debtStore.getAll(organization.id, session);
    const unique = Array.from(new Set(debts.map((d) => d.counterpartyName)));
    return unique.sort();
  }, [session, organization]);

  const handleAnalyze = async () => {
    if (!selectedCounterparty || !session || !organization) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await aiService.analyzeCounterparty(
        selectedCounterparty,
        organization.id,
        session
      );

      if (response.success) {
        setResult(response.data);
      } else {
        setError(response.error || 'Ошибка анализа');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLetter = async () => {
    if (!selectedCounterparty || !selectedDebt || !session || !organization) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await aiService.generateLetter(
        selectedCounterparty,
        selectedDebt,
        letterType,
        { tone: letterTone, format: letterFormat },
        organization.id,
        session
      );

      if (response.success) {
        setResult(response.data);
      } else {
        setError(response.error || 'Ошибка генерации');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleExplainPriorities = async () => {
    if (!session || !organization) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await aiService.explainPriorities(organization.id, session);

      if (response.success) {
        setResult(response.data);
      } else {
        setError(response.error || 'Ошибка анализа приоритетов');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDailyPlan = async () => {
    if (!session || !organization) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await aiService.generateDailyPlan(
        session.userId,
        organization.id,
        session
      );

      if (response.success) {
        setResult(response.data);
      } else {
        setError(response.error || 'Ошибка генерации плана');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleHistorySummary = async () => {
    if (!selectedCounterparty || !session || !organization) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await aiService.summarizeHistory(
        selectedCounterparty,
        organization.id,
        session
      );

      if (response.success) {
        setResult(response.data);
      } else {
        setError(response.error || 'Ошибка генерации сводки');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuestion = async () => {
    if (!question.trim() || !session || !organization) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await aiService.answerQuestion(question, organization.id, session);

      if (response.success) {
        setResult(response.data);
      } else {
        setError(response.error || 'Ошибка ответа');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const functions = [
    { id: 'analyze' as AIFunction, label: 'Анализ контрагента', icon: Sparkles },
    { id: 'letter' as AIFunction, label: 'Подготовить письмо', icon: FileText },
    { id: 'priorities' as AIFunction, label: 'Объяснить приоритеты', icon: Target },
    { id: 'daily_plan' as AIFunction, label: 'План на день', icon: Calendar },
    { id: 'history' as AIFunction, label: 'Сводка истории', icon: History },
    { id: 'question' as AIFunction, label: 'Задать вопрос', icon: MessageCircle },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">ИИ-помощник</h1>
        <p className="text-blue-200/60 mt-1">
          Аналитика и рекомендации на основе данных о задолженности
        </p>
        <div className="mt-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-yellow-200 text-xs">
            ⚠️ Демонстрационный режим: используется mock-провайдер. Для production необходима настройка реального API.
          </p>
        </div>
      </div>

      {/* Выбор функции */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {functions.map((func) => {
          const Icon = func.icon;
          return (
            <button
              key={func.id}
              onClick={() => {
                setActiveFunction(func.id);
                setResult(null);
                setError(null);
              }}
              className={`p-4 rounded-xl border transition ${
                activeFunction === func.id
                  ? 'bg-blue-600/20 border-blue-500/50 text-white'
                  : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
              }`}
            >
              <Icon className="w-6 h-6 mx-auto mb-2" />
              <span className="text-xs text-center">{func.label}</span>
            </button>
          );
        })}
      </div>

      {/* Формы для разных функций */}
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
              <option key={cp} value={cp} className="bg-slate-800">
                {cp}
              </option>
            ))}
          </select>
          <button
            onClick={handleAnalyze}
            disabled={!selectedCounterparty || loading}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg transition flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Анализировать
          </button>
        </div>
      )}

      {activeFunction === 'letter' && (
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Подготовить письмо</h3>
          <select
            value={selectedCounterparty}
            onChange={(e) => setSelectedCounterparty(e.target.value)}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
          >
            <option value="">Выберите контрагента</option>
            {counterparties.map((cp) => (
              <option key={cp} value={cp} className="bg-slate-800">
                {cp}
              </option>
            ))}
          </select>
          <select
            value={letterType}
            onChange={(e) => setLetterType(e.target.value)}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
          >
            <option value="reminder_upcoming" className="bg-slate-800">Напоминание о предстоящем сроке</option>
            <option value="reminder_overdue" className="bg-slate-800">Напоминание о просрочке</option>
          </select>
          <div className="grid grid-cols-2 gap-3">
            <select
              value={letterTone}
              onChange={(e) => setLetterTone(e.target.value as any)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
            >
              <option value="neutral" className="bg-slate-800">Нейтральный тон</option>
              <option value="polite" className="bg-slate-800">Вежливый тон</option>
              <option value="firm" className="bg-slate-800">Настойчивый тон</option>
            </select>
            <select
              value={letterFormat}
              onChange={(e) => setLetterFormat(e.target.value as any)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
            >
              <option value="email" className="bg-slate-800">Email</option>
              <option value="message" className="bg-slate-800">Сообщение</option>
            </select>
          </div>
          <button
            onClick={handleGenerateLetter}
            disabled={!selectedCounterparty || loading}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg transition flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Сгенерировать письмо
          </button>
        </div>
      )}

      {activeFunction === 'priorities' && (
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Объяснить приоритеты</h3>
          <p className="text-white/60 text-sm">
            ИИ проанализирует задолженности и объяснит, какие требуют внимания в первую очередь.
          </p>
          <button
            onClick={handleExplainPriorities}
            disabled={loading}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg transition flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Анализировать приоритеты
          </button>
        </div>
      )}

      {activeFunction === 'daily_plan' && (
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">План на день</h3>
          <p className="text-white/60 text-sm">
            ИИ составит план работы на сегодня на основе ваших задач и обещаний оплаты.
          </p>
          <button
            onClick={handleDailyPlan}
            disabled={loading}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg transition flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Составить план
          </button>
        </div>
      )}

      {activeFunction === 'history' && (
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Сводка истории</h3>
          <select
            value={selectedCounterparty}
            onChange={(e) => setSelectedCounterparty(e.target.value)}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
          >
            <option value="">Выберите контрагента</option>
            {counterparties.map((cp) => (
              <option key={cp} value={cp} className="bg-slate-800">
                {cp}
              </option>
            ))}
          </select>
          <button
            onClick={handleHistorySummary}
            disabled={!selectedCounterparty || loading}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg transition flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Сформировать сводку
          </button>
        </div>
      )}

      {activeFunction === 'question' && (
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Задать вопрос</h3>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Например: Какая общая задолженность? Сколько просроченных документов?"
            rows={3}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30"
          />
          <button
            onClick={handleQuestion}
            disabled={!question.trim() || loading}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg transition flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Спросить
          </button>
        </div>
      )}

      {/* Ошибка */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-300 font-medium">Ошибка</p>
            <p className="text-red-200/70 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Результаты */}
      {result && activeFunction === 'analyze' && <AnalysisResult data={result} />}
      {result && activeFunction === 'letter' && <LetterResult data={result} />}
      {result && activeFunction === 'priorities' && <PrioritiesResult data={result} />}
      {result && activeFunction === 'daily_plan' && <DailyPlanResult data={result} />}
      {result && activeFunction === 'history' && <HistoryResult data={result} />}
      {result && activeFunction === 'question' && <QuestionResult data={result} />}
    </div>
  );
}

// Компоненты для отображения результатов

function AnalysisResult({ data }: { data: CounterpartyAnalysis }) {
  return (
    <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6 space-y-4">
      <h3 className="text-lg font-semibold text-white">Результат анализа</h3>
      <div className="space-y-3">
        <div>
          <p className="text-white/60 text-sm font-medium">Сводка</p>
          <p className="text-white">{data.summary}</p>
        </div>
        <div>
          <p className="text-white/60 text-sm font-medium">Факты</p>
          <ul className="list-disc list-inside text-white/80 text-sm space-y-1">
            {data.facts.map((fact, i) => (
              <li key={i}>{fact.fact}</li>
            ))}
          </ul>
        </div>
        {data.concerns.length > 0 && (
          <div>
            <p className="text-white/60 text-sm font-medium">Требует внимания</p>
            <ul className="list-disc list-inside text-yellow-300 text-sm space-y-1">
              {data.concerns.map((concern, i) => (
                <li key={i}>{concern}</li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <p className="text-white/60 text-sm font-medium">Рекомендуемое действие</p>
          <p className="text-white">{data.recommendedAction.action}</p>
          <p className="text-white/60 text-sm mt-1">Причина: {data.recommendedAction.reason}</p>
        </div>
      </div>
    </div>
  );
}

function LetterResult({ data }: { data: LetterDraft }) {
  return (
    <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6 space-y-4">
      <h3 className="text-lg font-semibold text-white">Черновик письма</h3>
      {data.subject && (
        <div>
          <p className="text-white/60 text-sm font-medium">Тема</p>
          <p className="text-white">{data.subject}</p>
        </div>
      )}
      <div>
        <p className="text-white/60 text-sm font-medium">Текст</p>
        <pre className="text-white/80 text-sm whitespace-pre-wrap bg-black/20 rounded-lg p-4">
          {data.body}
        </pre>
      </div>
      <div className="flex gap-2">
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition">
          Копировать
        </button>
        <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm transition">
          Редактировать
        </button>
      </div>
    </div>
  );
}

function PrioritiesResult({ data }: { data: PriorityExplanation[] }) {
  return (
    <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6 space-y-4">
      <h3 className="text-lg font-semibold text-white">Приоритеты задолженности</h3>
      <div className="space-y-3">
        {data.map((item, i) => (
          <div key={i} className="bg-white/5 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-white font-medium">{item.counterpartyName}</p>
              <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">
                Приоритет: {item.priority}
              </span>
            </div>
            <ul className="list-disc list-inside text-white/70 text-sm space-y-1">
              {item.reasons.map((reason, j) => (
                <li key={j}>{reason}</li>
              ))}
            </ul>
            <p className="text-green-300 text-sm mt-2">
              → {item.recommendedAction}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DailyPlanResult({ data }: { data: DailyPlanItem[] }) {
  return (
    <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6 space-y-4">
      <h3 className="text-lg font-semibold text-white">План на сегодня</h3>
      <div className="space-y-3">
        {data.map((item, i) => (
          <div key={i} className="bg-white/5 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-white font-medium">{item.counterpartyName}</p>
              <span className={`px-2 py-1 rounded text-xs ${
                item.priority === 'high' ? 'bg-red-500/20 text-red-300' :
                item.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                'bg-green-500/20 text-green-300'
              }`}>
                {item.priority === 'high' ? 'Высокий' : item.priority === 'medium' ? 'Средний' : 'Низкий'}
              </span>
            </div>
            <p className="text-white/80 text-sm">{item.task}</p>
            <p className="text-white/60 text-xs mt-1">{item.reason}</p>
            {item.estimatedTime && (
              <p className="text-white/40 text-xs mt-1">⏱ {item.estimatedTime}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function HistoryResult({ data }: { data: HistorySummary }) {
  return (
    <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6 space-y-4">
      <h3 className="text-lg font-semibold text-white">Сводка истории</h3>
      <div className="space-y-3">
        <div>
          <p className="text-white/60 text-sm font-medium">Текущая ситуация</p>
          <p className="text-white">{data.currentSituation}</p>
        </div>
        {data.recentContacts.length > 0 && (
          <div>
            <p className="text-white/60 text-sm font-medium">Последние контакты</p>
            <ul className="list-disc list-inside text-white/80 text-sm space-y-1">
              {data.recentContacts.map((contact, i) => (
                <li key={i}>{contact.date}: {contact.summary}</li>
              ))}
            </ul>
          </div>
        )}
        {data.pendingTasks.length > 0 && (
          <div>
            <p className="text-white/60 text-sm font-medium">Открытые задачи</p>
            <ul className="list-disc list-inside text-white/80 text-sm space-y-1">
              {data.pendingTasks.map((task, i) => (
                <li key={i}>{task}</li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <p className="text-white/60 text-sm font-medium">Следующие шаги</p>
          <ul className="list-disc list-inside text-green-300 text-sm space-y-1">
            {data.nextSteps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function QuestionResult({ data }: { data: { answer: string } }) {
  return (
    <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6 space-y-4">
      <h3 className="text-lg font-semibold text-white">Ответ</h3>
      <p className="text-white">{data.answer}</p>
    </div>
  );
}
