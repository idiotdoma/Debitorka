import React, { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { userStore, taskStore, debtStore } from '../lib/store';
import { formatCurrency } from '../lib/calculations';
import { Users, CheckCircle, Clock, AlertTriangle, TrendingUp } from 'lucide-react';

export default function ManagerDashboardPage() {
  const { user, organization, session, team } = useAuth();

  const data = useMemo(() => {
    if (!user || !organization || !session || !team) return null;

    // Получаем всех пользователей в команде
    const allUsers = userStore.getByOrganization(organization.id, session);
    const teamMembers = allUsers.filter(u => u.teamId === team.id);

    // Получаем задачи команды
    const teamTasks = taskStore.getAll(organization.id, session).filter(t => 
      teamMembers.some(m => m.id === t.assignedTo)
    );

    // Получаем задолженности команды
    // Примечание: в текущей модели DebtRecord нет ownerId, используем все задолженности организации
    const teamDebts = debtStore.getAll(organization.id, session);

    // Статистика задач
    const totalTasks = teamTasks.length;
    const completedTasks = teamTasks.filter(t => t.status === 'completed').length;
    const overdueTasks = teamTasks.filter(t => 
      t.status !== 'completed' && t.status !== 'cancelled' && new Date(t.dueDate) < new Date()
    ).length;

    // Статистика задолженностей
    const totalDebt = teamDebts.reduce((sum, d) => sum + d.amountCents, 0);
    const overdueDebt = teamDebts
      .filter(d => d.overdueDays && d.overdueDays > 0)
      .reduce((sum, d) => sum + d.amountCents, 0);

    // Производительность команды
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    return {
      teamMembers: teamMembers.length,
      totalTasks,
      completedTasks,
      overdueTasks,
      totalDebt,
      overdueDebt,
      completionRate,
      teamName: team.name,
    };
  }, [user, organization, session, team]);

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
        <h1 className="text-2xl font-bold text-white">Кабинет руководителя</h1>
        <p className="text-blue-200/60 mt-1">Команда: {data.teamName}</p>
      </div>

      {/* KPI карточки */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 text-blue-400" />
            <span className="text-3xl font-bold text-white">{data.teamMembers}</span>
          </div>
          <p className="text-white/60 text-sm">Сотрудников в команде</p>
        </div>

        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-8 h-8 text-green-400" />
            <span className="text-3xl font-bold text-white">{data.completionRate.toFixed(0)}%</span>
          </div>
          <p className="text-white/60 text-sm">Выполнение задач</p>
        </div>

        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-8 h-8 text-yellow-400" />
            <span className="text-3xl font-bold text-white">{data.overdueTasks}</span>
          </div>
          <p className="text-white/60 text-sm">Просроченных задач</p>
        </div>

        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-8 h-8 text-purple-400" />
            <span className="text-3xl font-bold text-white">{data.totalTasks}</span>
          </div>
          <p className="text-white/60 text-sm">Всего задач</p>
        </div>
      </div>

      {/* Финансовая статистика */}
      <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Финансовые показатели</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-white/60 text-sm mb-2">Общая задолженность команды</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(data.totalDebt)}</p>
          </div>
          <div>
            <p className="text-white/60 text-sm mb-2">Просроченная задолженность</p>
            <p className="text-2xl font-bold text-red-400">{formatCurrency(data.overdueDebt)}</p>
          </div>
        </div>
      </div>

      {/* Предупреждения */}
      {data.overdueTasks > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <div>
              <p className="text-red-300 font-medium">Внимание!</p>
              <p className="text-red-200/70 text-sm">
                {data.overdueTasks} {data.overdueTasks === 1 ? 'задача просрочена' : 'задач просрочено'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Демо-режим предупреждение */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <p className="text-blue-200 text-sm">
          <strong>Демонстрационный режим:</strong> Данные кабинета руководителя основаны на локальном хранилище.
          Для полноценной работы необходима серверная часть с базой данных.
        </p>
      </div>
    </div>
  );
}
