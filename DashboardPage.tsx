import React, { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { debtStore, importStore } from '../lib/store';
import { aggregateByCategory, formatCurrency, formatDate } from '../lib/calculations';
import { DEBT_CATEGORIES } from '../lib/constants';
import { DebtCategory } from '../types/models';
import { TrendingUp, AlertTriangle, Clock, DollarSign, FileWarning, Calendar } from 'lucide-react';

interface DashboardPageProps {
  onNavigate?: (page: string, filters?: Record<string, any>) => void;
}

export default function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { session, organization } = useAuth();
  
  const data = useMemo(() => {
    if (!session || !organization) return null;
    
    const debts = debtStore.getAll(organization.id, session);
    const imports = importStore.getAll(organization.id, session);
    
    const totalDebtCents = debts.reduce((sum, d) => sum + (d.amountCents || 0), 0);
    const overdueDebts = debts.filter(d => d.overdueDays !== null && d.overdueDays > 0);
    const overdueDebtCents = overdueDebts.reduce((sum, d) => sum + (d.amountCents || 0), 0);
    const overdue30Plus = debts.filter(d => d.overdueDays !== null && d.overdueDays > 30);
    const overdue30PlusCents = overdue30Plus.reduce((sum, d) => sum + (d.amountCents || 0), 0);
    const noDueDate = debts.filter(d => d.overdueDays === null);
    const noDueDateCents = noDueDate.reduce((sum, d) => sum + (d.amountCents || 0), 0);
    
    const byCategory = aggregateByCategory(debts.map(d => ({ category: d.category, amountCents: d.amountCents || 0 })));
    
    const lastImport = imports.length > 0 
      ? imports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
      : null;
    
    const thresholdHours = organization.staleDataThresholdHours ?? 24;
    const isDataStale = lastImport 
      ? (Date.now() - new Date(lastImport.createdAt).getTime()) > (thresholdHours * 60 * 60 * 1000)
      : false;
    
    // Топ-10 контрагентов по сумме
    const byCounterparty = new Map<string, { name: string; totalCents: number }>();
    for (const d of debts) {
      const existing = byCounterparty.get(d.counterpartyName) || { name: d.counterpartyName, totalCents: 0 };
      existing.totalCents += (d.amountCents || 0);
      byCounterparty.set(d.counterpartyName, existing);
    }
    const topCounterparties = Array.from(byCounterparty.values())
      .sort((a, b) => b.totalCents - a.totalCents)
      .slice(0, 10);
    
    // Топ-10 наиболее старых просрочек
    const topOverdue = debts
      .filter(d => d.overdueDays !== null && d.overdueDays > 0)
      .sort((a, b) => (b.overdueDays || 0) - (a.overdueDays || 0))
      .slice(0, 10);
    
    return {
      totalDebts: debts.length,
      totalDebtCents,
      overdueDebtCents,
      overdueCount: overdueDebts.length,
      overdue30PlusCents,
      noDueDateCents,
      noDueDateCount: noDueDate.length,
      byCategory,
      lastImport,
      isDataStale,
      topCounterparties,
      topOverdue,
      noDueDateRecords: noDueDate,
    };
  }, [session, organization]);

  if (!data) return null;

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
        <h1 className="text-2xl font-bold text-white">Финансовый дашборд</h1>
        <p className="text-blue-200/60 mt-1">Обзор дебиторской задолженности</p>
      </div>

      {/* Предупреждения */}
      {!data.lastImport && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-300" />
          <p className="text-yellow-200 text-sm">Данные ещё не импортированы. Загрузите файл с задолженностью.</p>
        </div>
      )}
      {data.isDataStale && data.lastImport && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 flex items-center gap-3">
          <Clock className="w-5 h-5 text-orange-300" />
          <p className="text-orange-200 text-sm">
            Данные устарели. Последняя выгрузка: {formatDate(data.lastImport.createdAt)}. 
            Рекомендуется обновить данные.
          </p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard
          icon={<DollarSign className="w-5 h-5" />}
          label="Общая задолженность"
          value={formatCurrency(data.totalDebtCents)}
          color="blue"
          onClick={() => onNavigate?.('debts')}
        />
        <KPICard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Просроченная задолженность"
          value={formatCurrency(data.overdueDebtCents)}
          subtitle={`${data.overdueCount} документов`}
          color="red"
          onClick={() => onNavigate?.('debts', { overdueOnly: true })}
        />
        <KPICard
          icon={<Clock className="w-5 h-5" />}
          label="Просрочка более 30 дней"
          value={formatCurrency(data.overdue30PlusCents)}
          color="orange"
          onClick={() => onNavigate?.('debts', { minOverdueDays: 31 })}
        />
        <KPICard
          icon={<FileWarning className="w-5 h-5" />}
          label="Без указанного срока"
          value={formatCurrency(data.noDueDateCents)}
          subtitle={`${data.noDueDateCount} документов`}
          color="gray"
          onClick={() => onNavigate?.('debts', { noDueDate: true })}
        />
        <KPICard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Всего документов"
          value={data.totalDebts.toString()}
          color="green"
        />
        <KPICard
          icon={<Calendar className="w-5 h-5" />}
          label="Последняя выгрузка"
          value={data.lastImport ? formatDate(data.lastImport.createdAt) : '—'}
          subtitle={data.lastImport ? `${data.lastImport.newCount} новых, ${data.lastImport.updatedCount} обновлено` : undefined}
          color="blue"
        />
      </div>

      {/* Category Breakdown */}
      <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Распределение по категориям просрочки</h2>
        <div className="space-y-3">
          {(Object.entries(data.byCategory) as [DebtCategory, { count: number; totalAmountCents: number }][]).map(([category, info]) => (
            <button
              key={category}
              onClick={() => onNavigate?.('debts', { category })}
              className="flex items-center gap-4 w-full hover:bg-white/5 rounded-lg p-2 -m-2 transition"
            >
              <div className={`px-3 py-1 rounded-lg border text-sm font-medium ${categoryColors[category]}`}>
                {DEBT_CATEGORIES[category].label}
              </div>
              <div className="flex-1">
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      category === 'not_overdue' ? 'bg-green-500' :
                      category === 'days_1_7' ? 'bg-yellow-500' :
                      category === 'days_8_30' ? 'bg-orange-500' :
                      category === 'days_31_60' ? 'bg-red-500' :
                      category === 'days_60_plus' ? 'bg-purple-500' : 'bg-gray-500'
                    }`}
                    style={{ width: `${data.totalDebtCents > 0 ? (info.totalAmountCents / data.totalDebtCents * 100) : 0}%` }}
                  />
                </div>
              </div>
              <div className="text-right min-w-[140px]">
                <span className="text-white font-medium">{info.count}</span>
                <span className="text-white/40 ml-2 text-sm">{formatCurrency(info.totalAmountCents)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Top Counterparties */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Топ-10 контрагентов по сумме</h3>
          {data.topCounterparties.length === 0 ? (
            <p className="text-white/40 text-sm">Нет данных</p>
          ) : (
            <div className="space-y-2">
              {data.topCounterparties.map((cp, i) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <span className="text-white/70 text-sm truncate flex-1">{cp.name}</span>
                  <span className="text-white font-medium text-sm ml-2">{formatCurrency(cp.totalCents)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Топ-10 наиболее старых просрочек</h3>
          {data.topOverdue.length === 0 ? (
            <p className="text-white/40 text-sm">Нет просроченных задолженностей</p>
          ) : (
            <div className="space-y-2">
              {data.topOverdue.map((debt, i) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <span className="text-white/70 text-sm truncate flex-1">{debt.counterpartyName}</span>
                  <span className="text-red-300 font-medium text-sm ml-2">{debt.overdueDays} дн.</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* No Due Date List */}
      {data.noDueDateRecords.length > 0 && (
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FileWarning className="w-5 h-5 text-gray-400" />
            Документы без указанного срока оплаты
          </h3>
          <div className="space-y-2">
            {data.noDueDateRecords.slice(0, 5).map(debt => (
              <div key={debt.id} className="flex items-center justify-between py-1">
                <span className="text-white/70 text-sm">{debt.counterpartyName} — {debt.docNumber}</span>
                <span className="text-white font-medium text-sm">{formatCurrency(debt.amountCents)}</span>
              </div>
            ))}
            {data.noDueDateRecords.length > 5 && (
              <p className="text-white/40 text-xs">...и ещё {data.noDueDateRecords.length - 5}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KPICard({ icon, label, value, subtitle, color, onClick }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  color: 'blue' | 'red' | 'orange' | 'green' | 'gray';
  onClick?: () => void;
}) {
  const colorClasses = {
    blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    red: 'bg-red-500/20 text-red-300 border-red-500/30',
    orange: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    green: 'bg-green-500/20 text-green-300 border-green-500/30',
    gray: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  };

  return (
    <button
      onClick={onClick}
      className={`bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-5 text-left transition ${onClick ? 'hover:bg-white/10 cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg border ${colorClasses[color]}`}>
          {icon}
        </div>
        <span className="text-sm text-blue-200/60">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {subtitle && <p className="text-xs text-white/40 mt-1">{subtitle}</p>}
    </button>
  );
}
