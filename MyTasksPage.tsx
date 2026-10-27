import React, { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { taskStore, communicationStore, promiseStore } from '../lib/store';
import { formatDate } from '../lib/calculations';
import { Task, Communication, PaymentPromise } from '../types/models';
import { CheckCircle, Clock, AlertTriangle, Phone, MessageSquare } from 'lucide-react';

export default function MyTasksPage() {
  const { session, organization, user } = useAuth();

  const data = useMemo(() => {
    if (!session || !organization || !user) return null;

    const myTasks = taskStore.getByAssignee(user.id, organization.id, session);
    const myCommunications = communicationStore.getAll(organization.id, session)
      .filter(c => c.employeeId === user.id)
      .sort((a, b) => new Date(b.contactDate).getTime() - new Date(a.contactDate).getTime())
      .slice(0, 10);
    const myPromises = promiseStore.getAll(organization.id, session)
      .filter(p => p.employeeId === user.id && p.status === 'expected');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    const tasksToday = myTasks.filter(t => {
      if (t.status === 'completed' || t.status === 'cancelled') return false;
      const due = new Date(t.dueDate);
      due.setHours(0, 0, 0, 0);
      return due.getTime() === today.getTime();
    });

    const tasksOverdue = myTasks.filter(t => {
      if (t.status === 'completed' || t.status === 'cancelled') return false;
      return new Date(t.dueDate) < today;
    });

    const tasksThisWeek = myTasks.filter(t => {
      if (t.status === 'completed' || t.status === 'cancelled') return false;
      const due = new Date(t.dueDate);
      return due > today && due <= weekFromNow;
    });

    const promisesToCheck = myPromises.filter(p => {
      const due = new Date(p.promisedDate);
      return due <= today;
    });

    return {
      tasksToday,
      tasksOverdue,
      tasksThisWeek,
      promisesToCheck,
      myCommunications,
      totalOpenTasks: myTasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length,
    };
  }, [session, organization, user]);

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Мои задачи</h1>
        <p className="text-blue-200/60 mt-1">Рабочее место менеджера</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="На сегодня"
          value={data.tasksToday.length}
          color="blue"
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Просрочено"
          value={data.tasksOverdue.length}
          color="red"
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="На неделю"
          value={data.tasksThisWeek.length}
          color="yellow"
        />
        <StatCard
          icon={<CheckCircle className="w-5 h-5" />}
          label="Обещаний к проверке"
          value={data.promisesToCheck.length}
          color="green"
        />
      </div>

      {/* Overdue tasks */}
      {data.tasksOverdue.length > 0 && (
        <div className="bg-red-500/10 backdrop-blur rounded-2xl border border-red-500/20 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            Просроченные задачи
          </h3>
          <div className="space-y-2">
            {data.tasksOverdue.map(task => (
              <div key={task.id} className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">{task.title}</p>
                  <p className="text-white/40 text-xs">
                    Срок: {formatDate(task.dueDate)} • {task.counterpartyName || 'Без контрагента'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tasks today */}
      <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Задачи на сегодня</h3>
        {data.tasksToday.length === 0 ? (
          <p className="text-white/40 text-sm">Нет задач на сегодня</p>
        ) : (
          <div className="space-y-2">
            {data.tasksToday.map(task => (
              <div key={task.id} className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">{task.title}</p>
                  <p className="text-white/40 text-xs">{task.counterpartyName || 'Без контрагента'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Promises to check */}
      {data.promisesToCheck.length > 0 && (
        <div className="bg-yellow-500/10 backdrop-blur rounded-2xl border border-yellow-500/20 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-yellow-400" />
            Обещания к проверке
          </h3>
          <div className="space-y-2">
            {data.promisesToCheck.map(promise => (
              <div key={promise.id} className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">{promise.counterpartyName}</p>
                  <p className="text-white/40 text-xs">
                    Обещано: {formatDate(promise.promisedDate)} • {promise.contactName}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent communications */}
      <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-400" />
          Последние коммуникации
        </h3>
        {data.myCommunications.length === 0 ? (
          <p className="text-white/40 text-sm">Нет недавних коммуникаций</p>
        ) : (
          <div className="space-y-2">
            {data.myCommunications.map(comm => (
              <div key={comm.id} className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">{comm.counterpartyName}</p>
                  <p className="text-white/40 text-xs">
                    {formatDate(comm.contactDate)} • {comm.summary}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: number;
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
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  );
}
