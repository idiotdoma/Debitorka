import React, { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { debtStore } from '../lib/store';
import { formatCurrency, aggregateByCategory } from '../lib/calculations';
import { DEBT_CATEGORIES } from '../lib/constants';
import { DebtCategory } from '../types/models';
import { DollarSign, TrendingDown, Calendar, AlertCircle } from 'lucide-react';

export default function FinanceDashboardPage() {
  const { user, organization, session } = useAuth();

  const data = useMemo(() => {
    if (!user || !organization || !session) return null;

    const debts = debtStore.getAll(organization.id, session);

    // Общая статистика
    const totalDebt = debts.reduce((sum, d) => sum + d.amountCents, 0);
    const overdueDebts = debts.filter(d => d.overdueDays && d.overdueDays > 0);
    const overdueDebt = overdueDebts.reduce((sum, d) => sum + d.amountCents, 0);
    const noDueDateDebts = debts.filter(d => !d.dueDate);
    const noDueDateDebt = noDueDateDebts.reduce((sum, d) => sum + d.amountCents, 0);

    // Агрегация по категориям
    const byCategory = aggregateByCategory(debts);

    // Топ-10 контрагентов по сумме задолженности
    const byCounterparty = new Map<string, number>();
    debts.forEach(d => {
      const current = byCounterparty.get(d.counterpartyName) || 0;
      byCounterparty.set(d.counterpartyName, current + d.amountCents);
    });
    const topCounterparties = Array.from(byCounterparty.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Статистика по срокам
    const avgOverdueDays = overdueDebts.length > 0
      ? overdueDebts.reduce((sum, d) => sum + (d.overdueDays || 0), 0) / overdueDebts.length
      : 0;

    return {
      totalDebt,
      overdueDebt,
      overdueCount: overdueDebts.length,
      noDueDateDebt,
      noDueDateCount: noDueDateDebts.length,
      byCategory,
      topCounterparties,
      avgOverdueDays,
      totalDocuments: debts.length,
    };
  }, [user, organization, session]);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white/60">Загрузка...</p>
      </div>
    );
  }

  const categoryColors: Record<DebtCategory, string> = {
    not_overdue: 'bg-green-500/20 text-green-300 border-green-500/30',
    days_1_7: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    days_8_30: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    days_31_60: 'bg-red-500/20 text-red-300 border-red-500/30',
    days_60_plus: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    no_due_date: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Финансовый кабинет</h1>
        <p className="text-blue-200/60 mt-1">Аналитика дебиторской задолженности</p>
      </div>

      {/* KPI карточки */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 text-blue-400" />
            <span className="text-2xl font-bold text-white">{formatCurrency(data.totalDebt)}</span>
          </div>
          <p className="text-white/60 text-sm">Общая задолженность</p>
        </div>

        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-2">
            <TrendingDown className="w-8 h-8 text-red-400" />
            <span className="text-2xl font-bold text-white">{formatCurrency(data.overdueDebt)}</span>
          </div>
          <p className="text-white/60 text-sm">Просроченная задолженность</p>
          <p className="text-white/40 text-xs mt-1">{data.overdueCount} документов</p>
        </div>

        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-2">
            <Calendar className="w-8 h-8 text-yellow-400" />
            <span className="text-2xl font-bold text-white">{formatCurrency(data.noDueDateDebt)}</span>
          </div>
          <p className="text-white/60 text-sm">Без срока оплаты</p>
          <p className="text-white/40 text-xs mt-1">{data.noDueDateCount} документов</p>
        </div>

        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-2">
            <AlertCircle className="w-8 h-8 text-orange-400" />
            <span className="text-2xl font-bold text-white">{data.avgOverdueDays.toFixed(0)}</span>
          </div>
          <p className="text-white/60 text-sm">Средняя просрочка (дни)</p>
        </div>
      </div>

      {/* Распределение по категориям */}
      <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Распределение по категориям</h2>
        <div className="space-y-3">
          {(Object.entries(data.byCategory) as [DebtCategory, { count: number; totalAmountCents: number }][]).map(([category, info]) => (
            <div key={category} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded text-xs font-medium ${categoryColors[category]}`}>
                  {DEBT_CATEGORIES[category].label}
                </span>
                <span className="text-white/60 text-sm">{info.count} документов</span>
              </div>
              <span className="text-white font-medium">{formatCurrency(info.totalAmountCents)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Топ-10 контрагентов */}
      <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Топ-10 контрагентов по задолженности</h2>
        <div className="space-y-2">
          {data.topCounterparties.map(([name, amount], index) => (
            <div key={name} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
              <div className="flex items-center gap-3">
                <span className="text-white/40 text-sm font-mono w-6">{index + 1}.</span>
                <span className="text-white text-sm">{name}</span>
              </div>
              <span className="text-white font-medium">{formatCurrency(amount)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Демо-режим предупреждение */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <p className="text-blue-200 text-sm">
          <strong>Демонстрационный режим:</strong> Финансовая аналитика основана на локальном хранилище.
          Для полноценной работы необходима серверная часть с базой данных.
        </p>
      </div>
    </div>
  );
}
