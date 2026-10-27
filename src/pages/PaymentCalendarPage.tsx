import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { debtStore, promiseStore } from '../lib/store';
import { getActualDebtRecord } from '../lib/debtCalculations';
import { formatCurrency, formatDate } from '../lib/calculations';
import { Calendar, Clock, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Table } from 'lucide-react';

type PeriodType = 'today' | 'week' | '2weeks' | 'month';
type ViewMode = 'table' | 'calendar';

export default function PaymentCalendarPage() {
  const { session, organization } = useAuth();
  const [period, setPeriod] = useState<PeriodType>('week');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [currentDate, setCurrentDate] = useState(new Date());

  const data = useMemo(() => {
    if (!session || !organization) return null;

    const allDebts = debtStore.getAll(organization.id, session);
    
    // Пересчитываем просрочку для всех записей
    const debts = allDebts.map(getActualDebtRecord);
    
    const promises = promiseStore.getAll(organization.id, session);

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let endDate = new Date(now);
    switch (period) {
      case 'today':
        break;
      case 'week':
        endDate.setDate(endDate.getDate() + 7);
        break;
      case '2weeks':
        endDate.setDate(endDate.getDate() + 14);
        break;
      case 'month':
        endDate.setDate(endDate.getDate() + 30);
        break;
    }

    // Документы со сроком оплаты в периоде
    const dueInPeriod = debts.filter(d => {
      if (!d.dueDate) return false;
      const dueDate = new Date(d.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate >= now && dueDate <= endDate;
    });

    // Просроченные документы (с актуальной просрочкой)
    const overdue = debts.filter(d => d.overdueDays !== null && d.overdueDays > 0);

    // Обещания оплаты в периоде
    const promisesInPeriod = promises.filter(p => {
      const promiseDate = new Date(p.promisedDate);
      promiseDate.setHours(0, 0, 0, 0);
      return promiseDate >= now && promiseDate <= endDate && p.status === 'expected';
    });

    // Обещания, требующие проверки
    const promisesToCheck = promises.filter(p => {
      const promiseDate = new Date(p.promisedDate);
      promiseDate.setHours(0, 0, 0, 0);
      return promiseDate <= now && p.status === 'expected';
    });

    // Документы без срока оплаты
    const noDueDate = debts.filter(d => !d.dueDate);

    // Сводка
    const summary = {
      dueInPeriodAmount: dueInPeriod.reduce((sum, d) => sum + d.amountCents, 0),
      dueInPeriodCount: dueInPeriod.length,
      promisesAmount: promisesInPeriod.reduce((sum, p) => sum + p.promisedAmountCents, 0),
      promisesCount: promisesInPeriod.length,
      promisesToCheckCount: promisesToCheck.length,
      overdueAmount: overdue.reduce((sum, d) => sum + d.amountCents, 0),
      noDueDateAmount: noDueDate.reduce((sum, d) => sum + d.amountCents, 0),
    };

    return {
      dueInPeriod,
      overdue,
      promisesInPeriod,
      promisesToCheck,
      noDueDate,
      summary,
      startDate: now,
      endDate,
      allDebts: debts,
      allPromises: promises,
    };
  }, [session, organization, period]);

  // Генерация календарной сетки для текущего месяца
  const calendarDays = useMemo(() => {
    if (!data) return [];

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Первый день месяца
    const firstDay = new Date(year, month, 1);
    // Последний день месяца
    const lastDay = new Date(year, month + 1, 0);
    
    // День недели первого дня (0 = воскресенье, 1 = понедельник, ...)
    const firstDayOfWeek = firstDay.getDay();
    // Смещение для начала недели (понедельник = 0)
    const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    
    const days = [];
    
    // Добавляем дни предыдущего месяца
    for (let i = startOffset - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({ date, isCurrentMonth: false });
    }
    
    // Добавляем дни текущего месяца
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      days.push({ date, isCurrentMonth: true });
    }
    
    // Добавляем дни следующего месяца до конца недели
    const remainingDays = 7 - (days.length % 7);
    if (remainingDays < 7) {
      for (let i = 1; i <= remainingDays; i++) {
        const date = new Date(year, month + 1, i);
        days.push({ date, isCurrentMonth: false });
      }
    }
    
    return days;
  }, [currentDate, data]);

  // Получение событий для конкретного дня
  const getEventsForDay = (date: Date) => {
    if (!data) return { dueDebts: [], promises: [], overdue: [] };

    const dateStr = date.toISOString().split('T')[0];
    
    const dueDebts = data.allDebts.filter(d => d.dueDate === dateStr);
    const promises = data.allPromises.filter(p => {
      const promiseDate = new Date(p.promisedDate);
      promiseDate.setHours(0, 0, 0, 0);
      return promiseDate.toISOString().split('T')[0] === dateStr && p.status === 'expected';
    });
    const overdue = data.allDebts.filter(d => {
      if (!d.dueDate) return false;
      const dueDate = new Date(d.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < date && d.overdueDays !== null && d.overdueDays > 0;
    });

    return { dueDebts, promises, overdue };
  };

  // Навигация по месяцам
  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white/60">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Платёжный календарь</h1>
          <p className="text-blue-200/60 mt-1">Планирование поступлений и контроль сроков</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition ${
              viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            <Table className="w-4 h-4" />
            Таблица
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition ${
              viewMode === 'calendar' ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Календарь
          </button>
        </div>
      </div>

      {/* Переключатель периода */}
      <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-4">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setPeriod('today')}
            className={`px-4 py-2 rounded-lg text-sm transition ${
              period === 'today' ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Сегодня
          </button>
          <button
            onClick={() => setPeriod('week')}
            className={`px-4 py-2 rounded-lg text-sm transition ${
              period === 'week' ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            7 дней
          </button>
          <button
            onClick={() => setPeriod('2weeks')}
            className={`px-4 py-2 rounded-lg text-sm transition ${
              period === '2weeks' ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            14 дней
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-4 py-2 rounded-lg text-sm transition ${
              period === 'month' ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            30 дней
          </button>
        </div>
      </div>

      {/* Сводка */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SummaryCard
          icon={<Calendar className="w-6 h-6" />}
          label="Срок оплаты в периоде"
          value={formatCurrency(data.summary.dueInPeriodAmount)}
          subtitle={`${data.summary.dueInPeriodCount} документов`}
          color="blue"
        />
        <SummaryCard
          icon={<CheckCircle className="w-6 h-6" />}
          label="Обещания оплаты"
          value={formatCurrency(data.summary.promisesAmount)}
          subtitle={`${data.summary.promisesCount} обещаний`}
          color="green"
        />
        <SummaryCard
          icon={<Clock className="w-6 h-6" />}
          label="Требуют проверки"
          value={data.summary.promisesToCheckCount.toString()}
          subtitle="обещаний с наступившей датой"
          color="yellow"
        />
        <SummaryCard
          icon={<AlertTriangle className="w-6 h-6" />}
          label="Просрочено"
          value={formatCurrency(data.summary.overdueAmount)}
          color="red"
        />
        <SummaryCard
          icon={<Calendar className="w-6 h-6" />}
          label="Без срока оплаты"
          value={formatCurrency(data.summary.noDueDateAmount)}
          color="gray"
        />
      </div>

      {/* Легенда */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <p className="text-blue-200 text-sm mb-2"><strong>Важно:</strong></p>
        <ul className="text-blue-200/70 text-xs space-y-1">
          <li>• <strong>Срок оплаты</strong> — договорная дата из документа</li>
          <li>• <strong>Обещание оплаты</strong> — дата, обещанная контрагентом (не гарантирована)</li>
          <li>• <strong>Требуют проверки</strong> — обещания с наступившей датой, статус не подтверждён</li>
          <li>• Обещания не являются подтверждёнными поступлениями</li>
        </ul>
      </div>

      {/* Табличный режим */}
      {viewMode === 'table' && (
      <div className="space-y-6">
          {/* Документы со сроком в периоде */}
          <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              Документы со сроком оплаты в периоде
            </h2>
            {data.dueInPeriod.length === 0 ? (
              <p className="text-white/40 text-sm">Нет документов со сроком оплаты в выбранном периоде</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">Контрагент</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">Документ</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">Срок оплаты</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.dueInPeriod.map(debt => (
                      <tr key={debt.id} className="border-b border-white/5 hover:bg-white/5 transition">
                        <td className="px-4 py-3 text-white text-sm">{debt.counterpartyName}</td>
                        <td className="px-4 py-3 text-white/70 text-sm">{debt.docNumber}</td>
                        <td className="px-4 py-3 text-white/70 text-sm">{formatDate(debt.dueDate)}</td>
                        <td className="px-4 py-3 text-right text-white font-medium">{formatCurrency(debt.amountCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Обещания оплаты */}
          <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              Обещания оплаты в периоде
            </h2>
            {data.promisesInPeriod.length === 0 ? (
              <p className="text-white/40 text-sm">Нет обещаний оплаты в выбранном периоде</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">Контрагент</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">Контакт</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">Обещанная дата</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.promisesInPeriod.map(promise => (
                      <tr key={promise.id} className="border-b border-white/5 hover:bg-white/5 transition">
                        <td className="px-4 py-3 text-white text-sm">{promise.counterpartyName}</td>
                        <td className="px-4 py-3 text-white/70 text-sm">{promise.contactName}</td>
                        <td className="px-4 py-3 text-white/70 text-sm">{formatDate(promise.promisedDate)}</td>
                        <td className="px-4 py-3 text-right text-white font-medium">{formatCurrency(promise.promisedAmountCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Обещания, требующие проверки */}
          {data.promisesToCheck.length > 0 && (
            <div className="bg-yellow-500/10 backdrop-blur rounded-2xl border border-yellow-500/20 p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-400" />
                Обещания, требующие проверки
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left px-4 py-3 text-xs font-medium text-yellow-200/60 uppercase">Контрагент</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-yellow-200/60 uppercase">Контакт</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-yellow-200/60 uppercase">Обещанная дата</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-yellow-200/60 uppercase">Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.promisesToCheck.map(promise => (
                      <tr key={promise.id} className="border-b border-white/5 hover:bg-white/5 transition">
                        <td className="px-4 py-3 text-white text-sm">{promise.counterpartyName}</td>
                        <td className="px-4 py-3 text-white/70 text-sm">{promise.contactName}</td>
                        <td className="px-4 py-3 text-white/70 text-sm">{formatDate(promise.promisedDate)}</td>
                        <td className="px-4 py-3 text-right text-white font-medium">{formatCurrency(promise.promisedAmountCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Календарный режим */}
      {viewMode === 'calendar' && (
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
          {/* Навигация по месяцам */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <h2 className="text-lg font-semibold text-white">
              {currentDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
            </h2>
            <button
              onClick={() => navigateMonth('next')}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition"
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Дни недели */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
              <div key={day} className="text-center text-xs font-medium text-white/60 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Календарная сетка */}
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((day, idx) => {
              const events = getEventsForDay(day.date);
              const isToday = day.date.toDateString() === new Date().toDateString();
              const hasEvents = events.dueDebts.length > 0 || events.promises.length > 0;
              
              return (
                <div
                  key={idx}
                  className={`min-h-[100px] p-2 rounded-lg border transition ${
                    day.isCurrentMonth
                      ? 'bg-white/5 border-white/10'
                      : 'bg-white/[0.02] border-white/5'
                  } ${isToday ? 'ring-2 ring-blue-500' : ''}`}
                >
                  <div className={`text-xs font-medium mb-1 ${
                    day.isCurrentMonth ? 'text-white' : 'text-white/40'
                  }`}>
                    {day.date.getDate()}
                  </div>
                  
                  {hasEvents && (
                    <div className="space-y-1">
                      {/* Срок оплаты */}
                      {events.dueDebts.slice(0, 2).map(debt => (
                        <div
                          key={debt.id}
                          className="text-xs bg-blue-500/20 text-blue-300 rounded px-1 py-0.5 truncate"
                          title={`${debt.counterpartyName}: ${formatCurrency(debt.amountCents)}`}
                        >
                          {debt.counterpartyName.substring(0, 15)}...
                        </div>
                      ))}
                      {events.dueDebts.length > 2 && (
                        <div className="text-xs text-white/40">
                          +{events.dueDebts.length - 2} ещё
                        </div>
                      )}
                      
                      {/* Обещания оплаты */}
                      {events.promises.slice(0, 2).map(promise => (
                        <div
                          key={promise.id}
                          className="text-xs bg-green-500/20 text-green-300 rounded px-1 py-0.5 truncate"
                          title={`${promise.counterpartyName}: ${formatCurrency(promise.promisedAmountCents)}`}
                        >
                          💰 {promise.counterpartyName.substring(0, 12)}...
                        </div>
                      ))}
                      {events.promises.length > 2 && (
                        <div className="text-xs text-white/40">
                          +{events.promises.length - 2} ещё
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Легенда календаря */}
          <div className="mt-6 flex gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500/20 border border-blue-500/30 rounded"></div>
              <span className="text-white/60">Срок оплаты</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500/20 border border-green-500/30 rounded"></div>
              <span className="text-white/60">Обещание оплаты</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 ring-2 ring-blue-500 rounded"></div>
              <span className="text-white/60">Сегодня</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, subtitle, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  color: 'blue' | 'red' | 'green' | 'yellow' | 'gray';
}) {
  const colorClasses = {
    blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    red: 'bg-red-500/20 text-red-300 border-red-500/30',
    green: 'bg-green-500/20 text-green-300 border-green-500/30',
    yellow: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    gray: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  };

  return (
    <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg border ${colorClasses[color]}`}>
          {icon}
        </div>
        <span className="text-sm text-blue-200/60">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {subtitle && <p className="text-xs text-white/40 mt-1">{subtitle}</p>}
    </div>
  );
}
