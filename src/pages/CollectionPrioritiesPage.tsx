import React, { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { debtStore } from '../lib/store';
import { calculateCollectionPriorities } from '../lib/financialAnalytics';
import { formatCurrency, formatDate } from '../lib/calculations';
import { AlertTriangle, TrendingUp, Clock, CheckCircle } from 'lucide-react';

export default function CollectionPrioritiesPage() {
  const { session, organization } = useAuth();

  const priorities = useMemo(() => {
    if (!session || !organization) return [];
    const debts = debtStore.getAll(organization.id, session);
    return calculateCollectionPriorities(debts);
  }, [session, organization]);

  const criticalCount = priorities.filter(p => p.priority === 'critical').length;
  const highCount = priorities.filter(p => p.priority === 'high').length;
  const normalCount = priorities.filter(p => p.priority === 'normal').length;
  const reviewCount = priorities.filter(p => p.priority === 'needs_review').length;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'normal': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'needs_review': return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
      default: return 'bg-white/5 text-white/60 border-white/10';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'critical': return 'Критический';
      case 'high': return 'Высокий';
      case 'normal': return 'Обычный';
      case 'needs_review': return 'Требует уточнения';
      default: return priority;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Приоритеты взыскания</h1>
        <p className="text-blue-200/60 mt-1">Рабочая очередь для контроля задолженностей</p>
      </div>

      {/* Статистика приоритетов */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-sm text-red-300">Критический</span>
          </div>
          <p className="text-2xl font-bold text-white">{criticalCount}</p>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-orange-400" />
            <span className="text-sm text-orange-300">Высокий</span>
          </div>
          <p className="text-2xl font-bold text-white">{highCount}</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-yellow-400" />
            <span className="text-sm text-yellow-300">Обычный</span>
          </div>
          <p className="text-2xl font-bold text-white">{normalCount}</p>
        </div>
        <div className="bg-gray-500/10 border border-gray-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-300">Требует уточнения</span>
          </div>
          <p className="text-2xl font-bold text-white">{reviewCount}</p>
        </div>
      </div>

      {/* Правила приоритизации */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <p className="text-blue-200 text-sm mb-2"><strong>Как рассчитывается приоритет:</strong></p>
        <ul className="text-blue-200/70 text-xs space-y-1">
          <li>• Дни просрочки (до 40 баллов)</li>
          <li>• Сумма задолженности (до 30 баллов)</li>
          <li>• Отсутствие срока оплаты (20 баллов)</li>
          <li>• Устаревшие данные (10 баллов)</li>
        </ul>
        <p className="text-blue-200/50 text-xs mt-2">
          Приоритет — это инструмент планирования работы, а не прогноз платёжеспособности.
        </p>
      </div>

      {/* Список приоритетов */}
      <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">Приоритет</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">Контрагент</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">Документ</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">Сумма</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">Просрочка</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">Причины</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">Рекомендация</th>
              </tr>
            </thead>
            <tbody>
              {priorities.map(priority => (
                <tr key={priority.debtRecordId} className="border-b border-white/5 hover:bg-white/5 transition">
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${getPriorityColor(priority.priority)}`}>
                      {getPriorityLabel(priority.priority)}
                    </span>
                    <p className="text-white/40 text-xs mt-1">Баллы: {priority.priorityScore}</p>
                  </td>
                  <td className="px-4 py-3 text-white text-sm font-medium">{priority.counterpartyName}</td>
                  <td className="px-4 py-3 text-white/70 text-sm">{priority.documentNumber}</td>
                  <td className="px-4 py-3 text-right text-white font-medium">{formatCurrency(priority.amountCents)}</td>
                  <td className="px-4 py-3 text-center">
                    {priority.overdueDays !== null && priority.overdueDays > 0 ? (
                      <span className="text-red-300 text-sm">{priority.overdueDays} дн.</span>
                    ) : (
                      <span className="text-white/40 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ul className="text-white/60 text-xs space-y-1">
                      {priority.reasons.slice(0, 2).map((reason, i) => (
                        <li key={i}>• {reason}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-3 text-white/70 text-xs">{priority.recommendedAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Демо-режим предупреждение */}
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
        <p className="text-yellow-200 text-sm">
          <strong>Демонстрационный режим:</strong> Приоритеты рассчитываются на основе локальных данных.
          Система не использует машинное обучение и не предсказывает платёжеспособность.
        </p>
      </div>
    </div>
  );
}
