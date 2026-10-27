import React, { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { debtStore, taskStore } from '../lib/store';
import { formatCurrency } from '../lib/calculations';
import { canViewAllDebts } from '../lib/permissions';
import { DollarSign, AlertTriangle, Clock, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

export default function DashboardPage() {
  const { session, organization, user } = useAuth();
  
  const data = useMemo(() => {
    if (!session || !organization || !user) return null;
    
    const debts = canViewAllDebts(user.role) 
      ? debtStore.getAll(organization.id, session)
      : [];
    
    const tasks = taskStore.getByAssignee(user.id, organization.id, session);
    
    const totalDebtCents = debts.reduce((sum, d) => sum + d.amountCents, 0);
    const overdueDebts = debts.filter(d => {
      if (!d.dueDate) return false;
      return new Date(d.dueDate) < new Date();
    });
    const overdueDebtCents = overdueDebts.reduce((sum, d) => sum + d.amountCents, 0);
    
    const myTasks = tasks;
    const completedTasks = tasks.filter(t => t.status === 'completed');
    
    // Данные для круговой диаграммы по категориям
    const categoryData = [
      { name: 'Не просрочено', value: debts.filter(d => d.category === 'not_overdue').reduce((s, d) => s + d.amountCents, 0), color: '#10b981' },
      { name: '1-7 дней', value: debts.filter(d => d.category === 'days_1_7').reduce((s, d) => s + d.amountCents, 0), color: '#f59e0b' },
      { name: '8-30 дней', value: debts.filter(d => d.category === 'days_8_30').reduce((s, d) => s + d.amountCents, 0), color: '#f97316' },
      { name: '31-60 дней', value: debts.filter(d => d.category === 'days_31_60').reduce((s, d) => s + d.amountCents, 0), color: '#ef4444' },
      { name: 'Более 60 дней', value: debts.filter(d => d.category === 'days_60_plus').reduce((s, d) => s + d.amountCents, 0), color: '#8b5cf6' },
    ].filter(d => d.value > 0);
    
    // Данные для столбчатой диаграммы топ-5 контрагентов
    const counterpartyMap = new Map<string, number>();
    debts.forEach(d => {
      const current = counterpartyMap.get(d.counterpartyName) || 0;
      counterpartyMap.set(d.counterpartyName, current + d.amountCents);
    });
    const topCounterparties = Array.from(counterpartyMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, amount]) => ({
        name: name.length > 20 ? name.substring(0, 20) + '...' : name,
        amount: amount / 100,
      }));
    
    return {
      totalDebtCents,
      overdueDebtCents,
      overdueCount: overdueDebts.length,
      totalDebts: debts.length,
      myTasks: myTasks.length,
      completedTasks: completedTasks.length,
      categoryData,
      topCounterparties,
    };
  }, [session, organization, user]);

  if (!data) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
          Дашборд
        </h1>
        <p className="mt-1 text-gray-600 dark:text-blue-200/60">
          Обзор дебиторской задолженности
        </p>
      </div>

      {/* KPI Cards - адаптивная сетка */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={<DollarSign className="w-5 h-5" />}
          label="Общая задолженность"
          value={formatCurrency(data.totalDebtCents)}
          color="blue"
        />
        <KPICard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Просрочено"
          value={formatCurrency(data.overdueDebtCents)}
          subtitle={`${data.overdueCount} документов`}
          color="red"
        />
        <KPICard
          icon={<Clock className="w-5 h-5" />}
          label="Мои задачи"
          value={data.myTasks.toString()}
          color="yellow"
        />
        <KPICard
          icon={<CheckCircle className="w-5 h-5" />}
          label="Выполнено"
          value={data.completedTasks.toString()}
          color="green"
        />
      </div>

      {/* Графики - адаптивная сетка */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Круговая диаграмма */}
        <div className="card p-6 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Распределение по категориям
          </h3>
          {data.categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {data.categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value * 100)}
                  contentStyle={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500 dark:text-white/40">
              Нет данных для отображения
            </div>
          )}
        </div>

        {/* Столбчатая диаграмма */}
        <div className="card p-6 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Топ-5 контрагентов
          </h3>
          {data.topCounterparties.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.topCounterparties}>
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value * 100)}
                  contentStyle={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                  }}
                />
                <Bar dataKey="amount" fill="var(--accent-blue)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500 dark:text-white/40">
              Нет данных для отображения
            </div>
          )}
        </div>
      </div>

      {/* Быстрые действия - мобильная адаптация */}
      <div className="card p-6 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Быстрые действия
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickAction
            icon={<TrendingUp className="w-5 h-5" />}
            label="Финансовая аналитика"
            color="blue"
          />
          <QuickAction
            icon={<AlertTriangle className="w-5 h-5" />}
            label="Просроченные задачи"
            color="red"
          />
          <QuickAction
            icon={<Clock className="w-5 h-5" />}
            label="Платёжный календарь"
            color="yellow"
          />
          <QuickAction
            icon={<CheckCircle className="w-5 h-5" />}
            label="Мои задачи"
            color="green"
          />
        </div>
      </div>
    </div>
  );
}

function KPICard({ icon, label, value, subtitle, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  color: 'blue' | 'red' | 'yellow' | 'green';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 border-red-200 dark:border-red-800',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-300 border-green-200 dark:border-green-800',
  };

  return (
    <div className="card p-5 transition-all hover:shadow-lg bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg border ${colorClasses[color]}`}>
          {icon}
        </div>
        <span className="text-sm text-gray-600 dark:text-blue-200/60">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">
        {value}
      </p>
      {subtitle && (
        <p className="text-xs mt-1 text-gray-500 dark:text-white/40">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function QuickAction({ icon, label, color }: {
  icon: React.ReactNode;
  label: string;
  color: 'blue' | 'red' | 'yellow' | 'green';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 border-red-200 dark:border-red-800',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30 border-green-200 dark:border-green-800',
  };

  return (
    <button className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${colorClasses[color]}`}>
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
