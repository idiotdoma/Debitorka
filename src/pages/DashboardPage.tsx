import React, { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { debtStore, taskStore } from '../lib/store';
import { formatCurrency } from '../lib/utils';
import { canViewAllDebts } from '../lib/permissions';
import { DollarSign, AlertTriangle, Clock, CheckCircle } from 'lucide-react';

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
    
    return {
      totalDebtCents,
      overdueDebtCents,
      overdueCount: overdueDebts.length,
      totalDebts: debts.length,
      myTasks: myTasks.length,
      completedTasks: completedTasks.length,
    };
  }, [session, organization, user]);

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Дашборд</h1>
        <p className="text-blue-200/60 mt-1">Обзор дебиторской задолженности</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
    blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    red: 'bg-red-500/20 text-red-300 border-red-500/30',
    yellow: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    green: 'bg-green-500/20 text-green-300 border-green-500/30',
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
