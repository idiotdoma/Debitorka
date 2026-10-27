import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { debtStore } from '../lib/store';
import { formatCurrency, formatDate } from '../lib/calculations';
import { DEBT_CATEGORIES } from '../lib/constants';
import { DebtCategory, DebtRecord } from '../types/models';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface DebtListPageProps {
  initialFilters?: Record<string, any>;
  onDebtClick?: (debt: DebtRecord) => void;
}

const PAGE_SIZE = 20;

export default function DebtListPage({ initialFilters, onDebtClick }: DebtListPageProps) {
  const { session, organization } = useAuth();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<DebtCategory | 'all'>('all');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [noDueDateOnly, setNoDueDateOnly] = useState(false);
  const [minOverdueDays, setMinOverdueDays] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'dueDate' | 'amountCents' | 'overdueDays' | 'counterpartyName'>('overdueDays');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (initialFilters) {
      if (initialFilters.category) setCategoryFilter(initialFilters.category);
      if (initialFilters.overdueOnly) setOverdueOnly(true);
      if (initialFilters.noDueDate) setNoDueDateOnly(true);
      if (initialFilters.minOverdueDays) setMinOverdueDays(initialFilters.minOverdueDays);
    }
  }, [initialFilters]);

  const allDebts = useMemo(() => {
    if (!session || !organization) return [];
    return debtStore.getAll(organization.id, session);
  }, [session, organization]);

  const filteredDebts = useMemo(() => {
    let records = [...allDebts];
    
    if (search) {
      const q = search.toLowerCase();
      records = records.filter(r =>
        (r.counterpartyName || '').toLowerCase().includes(q) ||
        (r.docNumber || '').toLowerCase().includes(q) ||
        (r.counterpartyINN || '').toLowerCase().includes(q)
      );
    }
    
    if (categoryFilter !== 'all') {
      records = records.filter(r => r.category === categoryFilter);
    }
    
    if (overdueOnly) {
      records = records.filter(r => r.overdueDays !== null && r.overdueDays > 0);
    }
    
    if (noDueDateOnly) {
      records = records.filter(r => r.overdueDays === null);
    }
    
    if (minOverdueDays !== null) {
      records = records.filter(r => r.overdueDays !== null && r.overdueDays >= minOverdueDays);
    }
    
    records.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'dueDate') {
        const aDate = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        const bDate = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        cmp = aDate - bDate;
      } else if (sortBy === 'amountCents') {
        cmp = (a.amountCents || 0) - (b.amountCents || 0);
      } else if (sortBy === 'overdueDays') {
        cmp = (a.overdueDays || 0) - (b.overdueDays || 0);
      } else {
        cmp = a.counterpartyName.localeCompare(b.counterpartyName);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    
    return records;
  }, [allDebts, search, categoryFilter, overdueOnly, noDueDateOnly, minOverdueDays, sortBy, sortDir]);

  const totalPages = Math.ceil(filteredDebts.length / PAGE_SIZE);
  const paginatedDebts = filteredDebts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const categoryBadge = (category: DebtCategory) => {
    const colors: Record<DebtCategory, string> = {
      not_overdue: 'bg-green-500/20 text-green-700 dark:text-green-300',
      days_1_7: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300',
      days_8_30: 'bg-orange-500/20 text-orange-700 dark:text-orange-300',
      days_31_60: 'bg-red-500/20 text-red-700 dark:text-red-300',
      days_60_plus: 'bg-purple-500/20 text-purple-700 dark:text-purple-300',
      no_due_date: 'bg-gray-500/20 text-gray-700 dark:text-gray-300',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[category]}`}>
        {DEBT_CATEGORIES[category].label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Реестр задолженностей</h1>
          <p className="text-blue-200/60 mt-1">
            {filteredDebts.length} из {allDebts.length} записей
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Поиск по контрагенту, номеру документа, ИНН..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        
        <select
          value={categoryFilter}
          onChange={e => { setCategoryFilter(e.target.value as DebtCategory | 'all'); setPage(1); }}
          className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all" className="bg-slate-800">Все категории</option>
          {Object.entries(DEBT_CATEGORIES).map(([key, val]) => (
            <option key={key} value={key} className="bg-slate-800">{val.label}</option>
          ))}
        </select>

        <label className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={e => { setOverdueOnly(e.target.checked); setPage(1); }}
            className="rounded"
          />
          Только просроченные
        </label>

        <label className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={noDueDateOnly}
            onChange={e => { setNoDueDateOnly(e.target.checked); setPage(1); }}
            className="rounded"
          />
          Без срока
        </label>
        
        <select
          value={`${sortBy}-${sortDir}`}
          onChange={e => {
            const [by, dir] = e.target.value.split('-');
            setSortBy(by as any);
            setSortDir(dir as 'asc' | 'desc');
          }}
          className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="overdueDays-desc" className="bg-slate-800">Просрочка ↓</option>
          <option value="overdueDays-asc" className="bg-slate-800">Просрочка ↑</option>
          <option value="amountCents-desc" className="bg-slate-800">Сумма ↓</option>
          <option value="amountCents-asc" className="bg-slate-800">Сумма ↑</option>
          <option value="dueDate-asc" className="bg-slate-800">Срок ↑</option>
          <option value="dueDate-desc" className="bg-slate-800">Срок ↓</option>
          <option value="counterpartyName-asc" className="bg-slate-800">Контрагент А-Я</option>
        </select>
      </div>

      <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">Контрагент</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">№-doc</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-blue-200/60 uppercase hidden md:table-cell">Дата doc</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">Срок оплаты</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">Сумма</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">Просрочка</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-blue-200/60 uppercase hidden lg:table-cell">Категория</th>
              </tr>
            </thead>
            <tbody>
              {paginatedDebts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-white/40">
                    {allDebts.length === 0 ? 'Нет данных. Импортируйте файл с задолженностями.' : 'Нет записей по выбранным фильтрам'}
                  </td>
                </tr>
              ) : (
                paginatedDebts.map(debt => (
                  <tr 
                    key={debt.id} 
                    className="border-b border-white/5 hover:bg-white/5 transition cursor-pointer"
                    onClick={() => onDebtClick?.(debt)}
                  >
                    <td className="px-4 py-3">
                      <div className="text-white font-medium text-sm">{debt.counterpartyName}</div>
                      {debt.counterpartyINN && (
                        <div className="text-white/40 text-xs">ИНН: {debt.counterpartyINN}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/70 text-sm">{debt.docNumber || '—'}</td>
                    <td className="px-4 py-3 text-white/70 text-sm hidden md:table-cell">{debt.docDate ? formatDate(debt.docDate) : '—'}</td>
                    <td className="px-4 py-3 text-white/70 text-sm">{debt.dueDate ? formatDate(debt.dueDate) : '—'}</td>
                    <td className="px-4 py-3 text-right text-white font-medium text-sm">{formatCurrency(debt.amountCents || 0)}</td>
                    <td className="px-4 py-3 text-center">
                      {debt.overdueDays === null ? (
                        <span className="text-gray-400 text-xs">Не указан</span>
                      ) : debt.overdueDays > 0 ? (
                        <span className={`inline-flex items-center gap-1 text-sm font-medium ${
                          debt.overdueDays > 60 ? 'text-red-300' : debt.overdueDays > 30 ? 'text-orange-300' : debt.overdueDays > 7 ? 'text-yellow-300' : 'text-blue-300'
                        }`}>
                          {debt.overdueDays} дн.
                        </span>
                      ) : (
                        <span className="text-green-300 text-sm">В срок</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">{categoryBadge(debt.category)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-white/40 text-sm">
            Страница {page} из {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 transition flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Назад
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 transition flex items-center gap-1"
            >
              Вперёд <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
