import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { runQualityChecks, saveQualityCheckResults, getQualityStats } from '../lib/dataQuality';
import { dataQualityStore } from '../lib/store';
import { formatDate } from '../lib/calculations';
import { DataQualityIssue } from '../types/models';
import { AlertCircle, AlertTriangle, Info, CheckCircle, Search } from 'lucide-react';

export default function DataQualityPage() {
  const { session, organization } = useAuth();
  const [showResolved, setShowResolved] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const stats = useMemo(() => {
    if (!session || !organization) return null;
    return getQualityStats(organization.id, session);
  }, [session, organization, refreshKey]);

  const issues = useMemo(() => {
    if (!session || !organization) return [];
    let allIssues = dataQualityStore.getAll(organization.id, session);
    if (!showResolved) {
      allIssues = allIssues.filter(i => !i.resolvedAt);
    }
    return allIssues;
  }, [session, organization, showResolved, refreshKey]);

  const handleRunCheck = () => {
    if (!session || !organization) return;
    const result = runQualityChecks(organization.id, session);
    saveQualityCheckResults(organization.id, session, result);
    setRefreshKey(k => k + 1);
  };

  const handleResolve = (issueId: string, resolution: string) => {
    if (!session || !organization) return;
    dataQualityStore.update(
      issueId,
      {
        resolvedAt: new Date().toISOString(),
        resolvedBy: session.userId,
        resolution,
      },
      organization.id,
      session
    );
    setRefreshKey(k => k + 1);
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <AlertCircle className="w-5 h-5 text-red-400" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      case 'info': return <Info className="w-5 h-5 text-blue-400" />;
      default: return null;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      missing_due_date: 'Отсутствует срок оплаты',
      duplicate: 'Возможный дубликат',
      missing_counterparty: 'Отсутствует контрагент',
      invalid_amount: 'Некорректная сумма',
      invalid_date: 'Некорректная дата',
      unknown_currency: 'Неизвестная валюта',
      outdated_data: 'Устаревшие данные',
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Качество данных</h1>
          <p className="text-blue-200/60 mt-1">Диагностика проблем в финансовых данных</p>
        </div>
        <button
          onClick={handleRunCheck}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition"
        >
          <Search className="w-4 h-4" />
          Запустить проверку
        </button>
      </div>

      {/* Статистика */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
            <p className="text-white/60 text-sm mb-2">Всего проблем</p>
            <p className="text-3xl font-bold text-white">{stats.totalIssues}</p>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
            <p className="text-red-300 text-sm mb-2">Нерешённых</p>
            <p className="text-3xl font-bold text-white">{stats.unresolvedIssues}</p>
          </div>
          <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
            <p className="text-white/60 text-sm mb-2">Последняя проверка</p>
            <p className="text-lg font-medium text-white">
              {stats.lastCheckDate ? formatDate(stats.lastCheckDate) : 'Не проводилась'}
            </p>
          </div>
        </div>
      )}

      {/* Статистика по типам */}
      {stats && Object.keys(stats.byType).length > 0 && (
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Проблемы по типам</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(stats.byType).map(([type, count]) => (
              <div key={type} className="bg-white/5 rounded-lg p-3">
                <p className="text-white/60 text-xs mb-1">{getTypeLabel(type)}</p>
                <p className="text-xl font-bold text-white">{count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Переключатель */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowResolved(false)}
          className={`px-4 py-2 rounded-lg text-sm transition ${
            !showResolved ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/60'
          }`}
        >
          Активные проблемы
        </button>
        <button
          onClick={() => setShowResolved(true)}
          className={`px-4 py-2 rounded-lg text-sm transition ${
            showResolved ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/60'
          }`}
        >
          Все (включая решённые)
        </button>
      </div>

      {/* Список проблем */}
      <div className="space-y-3">
        {issues.length === 0 ? (
          <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-12 text-center">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <p className="text-white/60">
              {showResolved ? 'Нет проблем' : 'Нет активных проблем'}
            </p>
          </div>
        ) : (
          issues.map(issue => (
            <div
              key={issue.id}
              className={`bg-white/5 backdrop-blur rounded-xl border p-4 ${
                issue.resolvedAt ? 'border-green-500/20 opacity-60' : 'border-white/10'
              }`}
            >
              <div className="flex items-start gap-3">
                {getSeverityIcon(issue.severity)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-medium text-sm">
                      {getTypeLabel(issue.type)}
                    </span>
                    {issue.resolvedAt && (
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-300 rounded text-xs">
                        Решено
                      </span>
                    )}
                  </div>
                  <p className="text-white/70 text-sm mb-2">{issue.description}</p>
                  <p className="text-white/40 text-xs">
                    Обнаружено: {formatDate(issue.detectedAt)}
                  </p>
                  {issue.resolvedAt && issue.resolution && (
                    <p className="text-green-300/70 text-xs mt-1">
                      Решение: {issue.resolution}
                    </p>
                  )}
                </div>
                {!issue.resolvedAt && (
                  <button
                    onClick={() => {
                      const resolution = prompt('Опишите решение проблемы:');
                      if (resolution) {
                        handleResolve(issue.id, resolution);
                      }
                    }}
                    className="px-3 py-1 bg-green-600/20 text-green-300 rounded-lg text-xs hover:bg-green-600/30 transition"
                  >
                    Отметить решённым
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Демо-режим предупреждение */}
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
        <p className="text-yellow-200 text-sm">
          <strong>Демонстрационный режим:</strong> Проверка качества данных работает на основе локальных данных.
          Результаты проверок сохраняются в браузере и не синхронизируются между пользователями.
        </p>
      </div>
    </div>
  );
}
