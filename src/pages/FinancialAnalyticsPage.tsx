import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { debtStore, importStore } from '../lib/store';
import { 
  calculateFinancialMetrics, 
  calculateCategoryDistribution, 
  calculateCounterpartyRating 
} from '../lib/financialAnalytics';
import { formatCurrency, formatDate } from '../lib/calculations';
import { DEBT_CATEGORIES } from '../lib/constants';
import { DebtCategory } from '../types/models';
import { TrendingUp, TrendingDown, AlertCircle, DollarSign, Users, FileText, Calendar } from 'lucide-react';

export default function FinancialAnalyticsPage() {
  const { session, organization } = useAuth();
  const [categoryFilter, setCategoryFilter] = useState<DebtCategory | 'all'>('all');
  const [counterpartyFilter, setCounterpartyFilter] = useState<string>('');
  const [ratingSortBy, setRatingSortBy] = useState<'totalDebt' | 'overdueDebt' | 'oldestOverdue' | 'overdueDocuments'>('totalDebt');

  const data = useMemo(() => {
    if (!session || !organization) return null;

    let debts = debtStore.getAll(organization.id, session);

    // Применение фильтров
    if (categoryFilter !== 'all') {
      debts = debts.filter(d => d.category === categoryFilter);
    }
    if (counterpartyFilter) {
      debts = debts.filter(d => 
        d.counterpartyName.toLowerCase().includes(counterpartyFilter.toLowerCase())
      );
    }

    // Получаем дату последнего импорта
    const imports = importStore.getAll(organization.id, session);
    const lastImport = imports.length > 0 
      ? imports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
      : null;

    const metrics = calculateFinancialMetrics(debts, lastImport?.createdAt);
    const categoryDistribution = calculateCategoryDistribution(debts);
    const counterpartyRating = calculateCounterpartyRating(debts, ratingSortBy);

    return {
      metrics,
      categoryDistribution,
      counterpartyRating,
      debtsCount: debts.length,
    };
  }, [session, organization, categoryFilter, counterpartyFilter, ratingSortBy]);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white/60">Загрузка...</p>
      </div>
    );
  }

  const { metrics, categoryDistribution, counterpartyRating } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Финансовая аналитика</h1>
        <p className="text-blue-200/60 mt-1">Центр финансовой аналитики и контроля</p>
      </div>

      {/* Фильтры */}
      <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-white/60 mb-1">Категория просрочки</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
            >
              <option value="all" className="bg-slate-800">Все категории</option>
              {Object.entries(DEBT_CATEGORIES).map(([key, val]) => (
                <option key={key} value={key} className="bg-slate-800">{val.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">Контрагент</label>
            <input
              type="text"
              value={counterpartyFilter}
              onChange={(e) => setCounterpartyFilter(e.target.value)}
              placeholder="Поиск по названию..."
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30"
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">Сортировка рейтинга</label>
            <select
              value={ratingSortBy}
              onChange={(e) => setRatingSortBy(e.target.value as any)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
            >
              <option value="totalDebt" className="bg-slate-800">По общей сумме</option>
              <option value="overdueDebt" className="bg-slate-800">По сумме просрочки</option>
              <option value="oldestOverdue" className="bg-slate-800">По старости просрочки</option>
              <option value="overdueDocuments" className="bg-slate-800">По количеству просроченных</option>
            </select>
          </div>
        </div>
      </div>

      {/* Основные показатели */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={<DollarSign className="w-6 h-6" />}
          label="Общая задолженность"
          value={formatCurrency(metrics.totalDebt)}
          color="blue"
        />
        <MetricCard
          icon={<TrendingDown className="w-6 h-6" />}
          label="Просроченная задолженность"
          value={formatCurrency(metrics.overdueDebt)}
          subtitle={`${metrics.overduePercentage.toFixed(1)}% от общей`}
          color="red"
        />
        <MetricCard
          icon={<Users className="w-6 h-6" />}
          label="Контрагентов с долгами"
          value={metrics.counterpartiesCount.toString()}
          color="green"
        />
        <MetricCard
          icon={<FileText className="w-6 h-6" />}
          label="Просроченных документов"
          value={metrics.overdueDocumentsCount.toString()}
          color="yellow"
        />
      </div>

      {/* Дополнительные показатели */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-6 h-6 text-orange-400" />
            <span className="text-sm text-white/60">Долг с просрочкой &gt;30 дней</span>
          </div>
          <p className="text-2xl font-bold text-white">{formatCurrency(metrics.debtOver30Days)}</p>
        </div>
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-6 h-6 text-gray-400" />
            <span className="text-sm text-white/60">Без срока оплаты</span>
          </div>
          <p className="text-2xl font-bold text-white">{formatCurrency(metrics.debtWithoutDueDate)}</p>
        </div>
      </div>

      {/* Дата последнего обновления */}
      {metrics.lastUpdateDate && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
          <p className="text-blue-200 text-sm">
            <strong>Последнее обновление данных:</strong> {formatDate(metrics.lastUpdateDate)}
          </p>
        </div>
      )}

      {/* Распределение по категориям */}
      <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Распределение по категориям просрочки</h2>
        <div className="space-y-3">
          {categoryDistribution.map((cat) => (
            <div key={cat.category} className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <span className={`px-3 py-1 rounded text-xs font-medium bg-${cat.color}-500/20 text-${cat.color}-300 border border-${cat.color}-500/30`}>
                  {cat.label}
                </span>
                <span className="text-white/60 text-sm">{cat.count} документов</span>
                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-${cat.color}-500`}
                    style={{ width: `${cat.percentage}%` }}
                  />
                </div>
                <span className="text-white/40 text-xs w-16 text-right">{cat.percentage.toFixed(1)}%</span>
              </div>
              <span className="text-white font-medium ml-4">{formatCurrency(cat.amount)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Рейтинг контрагентов */}
      <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Крупнейшие должники</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">Контрагент</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">Общий долг</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">Просрочено</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">Макс. просрочка</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">Документов</th>
              </tr>
            </thead>
            <tbody>
              {counterpartyRating.slice(0, 10).map((cp, index) => (
                <tr key={cp.counterpartyName} className="border-b border-white/5 hover:bg-white/5 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-white/40 text-xs font-mono w-6">{index + 1}.</span>
                      <span className="text-white text-sm font-medium">{cp.counterpartyName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-white font-medium">{formatCurrency(cp.totalDebt)}</td>
                  <td className="px-4 py-3 text-right text-red-300">{formatCurrency(cp.overdueDebt)}</td>
                  <td className="px-4 py-3 text-center">
                    {cp.oldestOverdueDays !== null ? (
                      <span className="text-orange-300">{cp.oldestOverdueDays} дн.</span>
                    ) : (
                      <span className="text-white/40">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-white/60">{cp.documentsCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Демо-режим предупреждение */}
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
        <p className="text-yellow-200 text-sm">
          <strong>Демонстрационный режим:</strong> Финансовая аналитика работает на основе локальных данных.
          Для полноценной работы с исторической динамикой необходима серверная часть с базой данных.
        </p>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, subtitle, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  color: 'blue' | 'red' | 'green' | 'yellow' | 'orange';
}) {
  const colorClasses = {
    blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    red: 'bg-red-500/20 text-red-300 border-red-500/30',
    green: 'bg-green-500/20 text-green-300 border-green-500/30',
    yellow: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    orange: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
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
