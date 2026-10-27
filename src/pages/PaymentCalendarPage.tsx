import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { debtStore, promiseStore } from '../lib/store';
import { getActualDebtRecord } from '../lib/debtCalculations';
import { formatCurrency, formatDate } from '../lib/calculations';
import { Calendar, Clock, AlertTriangle, CheckCircle } from 'lucide-react';

type PeriodType = 'today' | 'week' | '2weeks' | 'month';

export default function PaymentCalendarPage() {
  const { session, organization } = useAuth();
  const [period, setPeriod] = useState<PeriodType>('week');

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
    };
  }, [session, organization, period]);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white/60">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Платёжный календарь</h1>
        <p className="text-blue-200/60 mt-1">Планирование поступлений и контроль сроков</p>
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
