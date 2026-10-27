import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { debtStore, importStore } from '../lib/store';
import { getActualDebtRecord, filterValidDebts } from '../lib/debtCalculations';
import { formatCurrency, formatDate } from '../lib/calculations';
import { DEBT_CATEGORIES } from '../lib/constants';
import { DebtCategory, DebtRecord } from '../types/models';
import { FileText, Download, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';

type ReportType = 'registry' | 'overdue' | 'aging' | 'top_debtors' | 'no_due_date' | 'promises_check';

export default function ReportsPage() {
  const { session, organization } = useAuth();
  const [reportType, setReportType] = useState<ReportType>('registry');
  const [categoryFilter, setCategoryFilter] = useState<DebtCategory | 'all'>('all');
  const [counterpartyFilter, setCounterpartyFilter] = useState('');

  const getReportTitle = (type: ReportType): string => {
    const titles: Record<ReportType, string> = {
      registry: 'Общий реестр задолженности',
      overdue: 'Просроченная задолженность',
      aging: 'Возрастная структура задолженности',
      top_debtors: 'Крупнейшие должники',
      no_due_date: 'Задолженность без срока оплаты',
      promises_check: 'Обещания оплаты, требующие проверки',
    };
    return titles[type];
  };

  const reportData = useMemo(() => {
    if (!session || !organization) return { data: [], title: '', columns: [] };

    const allDebts = debtStore.getAll(organization.id, session);
    
    // Фильтруем некорректные данные и пересчитываем просрочку
    const { validDebts } = filterValidDebts(allDebts);
    let debts = validDebts.map(getActualDebtRecord);

    // Применение фильтров
    if (categoryFilter !== 'all') {
      debts = debts.filter(d => d.category === categoryFilter);
    }
    if (counterpartyFilter) {
      debts = debts.filter(d => 
        d.counterpartyName.toLowerCase().includes(counterpartyFilter.toLowerCase())
      );
    }

    // Фильтрация по типу отчёта
    switch (reportType) {
      case 'overdue':
        debts = debts.filter(d => d.overdueDays !== null && d.overdueDays > 0);
        break;
      case 'no_due_date':
        debts = debts.filter(d => !d.dueDate);
        break;
      case 'top_debtors':
        debts = debts.sort((a, b) => b.amountCents - a.amountCents).slice(0, 20);
        break;
      case 'aging':
        // Для возрастной структуры создаём агрегированные данные по категориям
        const agingData = Object.entries(DEBT_CATEGORIES).map(([key, config]) => {
          const categoryDebts = debts.filter(d => d.category === key);
          const totalAmount = categoryDebts.reduce((sum, d) => sum + d.amountCents, 0);
          return {
            category: key,
            categoryName: config.label,
            documentsCount: categoryDebts.length,
            totalAmount,
            percentage: debts.length > 0 ? (categoryDebts.length / debts.length * 100).toFixed(1) : '0',
          };
        }).filter(d => d.documentsCount > 0);
        
        const title = getReportTitle(reportType);
        return { 
          data: agingData, 
          title, 
          columns: [
            { key: 'categoryName', label: 'Категория' },
            { key: 'documentsCount', label: 'Количество документов' },
            { key: 'totalAmount', label: 'Общая сумма' },
            { key: 'percentage', label: 'Доля (%)' },
          ]
        };
    }

    const columns = [
      { key: 'counterpartyName', label: 'Контрагент' },
      { key: 'docNumber', label: 'Номер документа' },
      { key: 'docDate', label: 'Дата документа' },
      { key: 'dueDate', label: 'Срок оплаты' },
      { key: 'amountCents', label: 'Сумма' },
      { key: 'overdueDays', label: 'Просрочка (дни)' },
      { key: 'category', label: 'Категория' },
    ];

    const title = getReportTitle(reportType);

    return { data: debts, title, columns };
  }, [session, organization, reportType, categoryFilter, counterpartyFilter]);

  const exportToCSV = () => {
    if (!reportData.data.length) return;

    const headers = reportData.columns.map(c => c.label);
    const rows = reportData.data.map((debt: any) => 
      reportData.columns.map(col => {
        let value = debt[col.key];
        
        // Форматирование значений
        if (col.key === 'amountCents' || col.key === 'totalAmount') {
          value = (value / 100).toFixed(2);
        } else if (col.key === 'category') {
          value = DEBT_CATEGORIES[value as DebtCategory]?.label || value;
        } else if (col.key === 'docDate' || col.key === 'dueDate') {
          value = value ? formatDate(value) : '';
        } else if (col.key === 'percentage') {
          value = value + '%';
        }
        
        // Преобразование в строку
        let strValue = String(value ?? '');
        
        // Защита от формульных инъекций (CSV Formula Injection)
        // Проверяем начало строки с учётом возможных пробелов и управляющих символов
        const trimmed = strValue.trimStart();
        if (trimmed.startsWith('=') || trimmed.startsWith('+') || trimmed.startsWith('-') || 
            trimmed.startsWith('@') || trimmed.startsWith('\t') || trimmed.startsWith('\r')) {
          strValue = "'" + strValue;
        }
        
        // Экранирование двойных кавычек (удваиваем их)
        strValue = strValue.replace(/"/g, '""');
        
        return strValue;
      })
    );

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${reportType}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportToXLSX = () => {
    if (!reportData.data.length) return;

    const wsData = [
      reportData.columns.map(c => c.label),
      ...reportData.data.map((debt: any) => 
        reportData.columns.map(col => {
          let value = debt[col.key];
          if (col.key === 'amountCents') {
            value = value / 100;
          } else if (col.key === 'category') {
            value = DEBT_CATEGORIES[value as DebtCategory]?.label || value;
          }
          return value ?? '';
        })
      )
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Отчёт');
    XLSX.writeFile(wb, `${reportType}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Отчёты</h1>
        <p className="text-blue-200/60 mt-1">Конструктор финансовых отчётов</p>
      </div>

      {/* Выбор типа отчёта */}
      <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-4">
        <h3 className="text-sm font-medium text-white mb-3">Тип отчёта</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <button
            onClick={() => setReportType('registry')}
            className={`px-4 py-2 rounded-lg text-sm transition ${
              reportType === 'registry' ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Общий реестр
          </button>
          <button
            onClick={() => setReportType('overdue')}
            className={`px-4 py-2 rounded-lg text-sm transition ${
              reportType === 'overdue' ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Просроченная
          </button>
          <button
            onClick={() => setReportType('aging')}
            className={`px-4 py-2 rounded-lg text-sm transition ${
              reportType === 'aging' ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Возрастная структура
          </button>
          <button
            onClick={() => setReportType('top_debtors')}
            className={`px-4 py-2 rounded-lg text-sm transition ${
              reportType === 'top_debtors' ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Крупнейшие должники
          </button>
          <button
            onClick={() => setReportType('no_due_date')}
            className={`px-4 py-2 rounded-lg text-sm transition ${
              reportType === 'no_due_date' ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Без срока оплаты
          </button>
        </div>
      </div>

      {/* Фильтры */}
      <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-4">
        <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Фильтры
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </div>
      </div>

      {/* Кнопки экспорта */}
      <div className="flex gap-3">
        <button
          onClick={exportToCSV}
          disabled={!reportData.data.length}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:cursor-not-allowed text-white rounded-lg text-sm transition"
        >
          <Download className="w-4 h-4" />
          Экспорт в CSV
        </button>
        <button
          onClick={exportToXLSX}
          disabled={!reportData.data.length}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg text-sm transition"
        >
          <Download className="w-4 h-4" />
          Экспорт в Excel
        </button>
      </div>

      {/* Информация об отчёте */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <p className="text-blue-200 text-sm">
          <strong>Отчёт:</strong> {reportData.title}
        </p>
        <p className="text-blue-200/70 text-xs mt-1">
          Записей: {reportData.data.length} • Дата формирования: {formatDate(new Date().toISOString())}
        </p>
      </div>

      {/* Таблица отчёта */}
      <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                {reportData.columns.map(col => (
                  <th key={col.key} className="text-left px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reportData.data.length === 0 ? (
                <tr>
                  <td colSpan={reportData.columns.length} className="px-4 py-12 text-center text-white/40">
                    Нет данных для отображения
                  </td>
                </tr>
              ) : (
                reportData.data.map((debt: any, index) => (
                  <tr key={debt.id || index} className="border-b border-white/5 hover:bg-white/5 transition">
                    {reportData.columns.map(col => {
                      let value = debt[col.key];
                      if (col.key === 'amountCents') {
                        return <td key={col.key} className="px-4 py-3 text-right text-white font-medium">{formatCurrency(value)}</td>;
                      } else if (col.key === 'category') {
                        return <td key={col.key} className="px-4 py-3 text-white/70 text-sm">{DEBT_CATEGORIES[value as DebtCategory]?.label || value}</td>;
                      } else if (col.key === 'docDate' || col.key === 'dueDate') {
                        return <td key={col.key} className="px-4 py-3 text-white/70 text-sm">{value ? formatDate(value) : '—'}</td>;
                      } else if (col.key === 'overdueDays') {
                        return <td key={col.key} className="px-4 py-3 text-center text-white/70 text-sm">{value !== null ? `${value} дн.` : '—'}</td>;
                      }
                      return <td key={col.key} className="px-4 py-3 text-white/70 text-sm">{value || '—'}</td>;
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Демо-режим предупреждение */}
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
        <p className="text-yellow-200 text-sm">
          <strong>Демонстрационный режим:</strong> Отчёты формируются на основе локальных данных.
          Экспорт работает корректно, но сохранённые представления не синхронизируются между пользователями.
        </p>
      </div>
    </div>
  );
}
