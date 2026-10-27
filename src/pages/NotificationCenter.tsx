import React, { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { notificationStore } from '../lib/store';
import { formatDate } from '../lib/calculations';
import { NotificationType } from '../types/models';
import { Bell, Check, CheckCheck } from 'lucide-react';

export default function NotificationCenter() {
  const { session, organization, user } = useAuth();
  const [showAll, setShowAll] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const data = useMemo(() => {
    if (!session || !organization || !user) return null;
    
    const all = notificationStore.getByRecipient(user.id, organization.id, session)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const unread = all.filter(n => !n.isRead);
    
    return {
      all: showAll ? all : all.slice(0, 50),
      unread,
      unreadCount: unread.length,
    };
  }, [session, organization, user, showAll, refreshKey]);

  const refresh = () => setRefreshKey(k => k + 1);

  const handleMarkRead = (id: string) => {
    if (!session || !organization || !user) return;
    notificationStore.markAsRead(id, user.id, organization.id, session);
    refresh();
  };

  const handleMarkAllRead = () => {
    if (!session || !organization || !user) return;
    notificationStore.markAllAsRead(user.id, organization.id, session);
    refresh();
  };

  const typeLabels: Record<NotificationType, string> = {
    task_due_soon: '⏰ Срок задачи приближается',
    task_overdue: '🔴 Задача просрочена',
    promise_due: '💰 Срок обещания наступил',
    promise_broken: '❌ Обещание нарушено',
    task_no_action: '⚠️ Нет действий по задаче',
    critical_task_escalation: '🚨 Критическая задача',
    new_task_assigned: '📋 Новая задача',
    promise_needs_check: '🔍 Обещание требует проверки',
  };

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell className="w-6 h-6" />
            Уведомления
          </h1>
          <p className="text-blue-200/60 mt-1">
            {data.unreadCount > 0 ? `${data.unreadCount} непрочитанных` : 'Все прочитано'}
          </p>
        </div>
        {data.unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm hover:bg-white/10 transition"
          >
            <CheckCheck className="w-4 h-4" /> Прочитать все
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setShowAll(false)}
          className={`px-4 py-2 rounded-xl text-sm transition ${!showAll ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/60'}`}
        >
          Непрочитанные
        </button>
        <button
          onClick={() => setShowAll(true)}
          className={`px-4 py-2 rounded-xl text-sm transition ${showAll ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/60'}`}
        >
          Все
        </button>
      </div>

      <div className="space-y-2">
        {data.all.length === 0 ? (
          <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-12 text-center">
            <Bell className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/40">Нет уведомлений</p>
          </div>
        ) : (
          data.all.map(notification => (
            <div
              key={notification.id}
              className={`bg-white/5 backdrop-blur rounded-xl border p-4 transition ${
                notification.isRead ? 'border-white/5 opacity-60' : 'border-blue-500/30'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-white/60">{typeLabels[notification.type]}</span>
                    {!notification.isRead && (
                      <span className="w-2 h-2 bg-blue-400 rounded-full" />
                    )}
                  </div>
                  <h3 className="text-white font-medium">{notification.title}</h3>
                  <p className="text-white/60 text-sm mt-1">{notification.message}</p>
                  <p className="text-white/30 text-xs mt-2">{formatDate(notification.createdAt)}</p>
                </div>
                {!notification.isRead && (
                  <button
                    onClick={() => handleMarkRead(notification.id)}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition"
                    title="Отметить как прочитанное"
                  >
                    <Check className="w-4 h-4 text-white" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
