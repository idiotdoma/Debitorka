import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { taskStore, userStore } from '../lib/store';
import { formatDate, generateId } from '../lib/calculations';
import { Task, TaskType, TaskPriority, TaskStatus } from '../types/models';
import { Plus, Filter, CheckCircle, Clock, AlertTriangle, XCircle } from 'lucide-react';

export default function TasksPage() {
  const { session, organization, user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [refreshKey, setRefreshKey] = useState(0);

  const orgUsers = useMemo(() => {
    if (!session || !organization) return [];
    return userStore.getByOrganization(organization.id, session);
  }, [session, organization]);

  const tasks = useMemo(() => {
    if (!session || !organization) return [];
    let allTasks = taskStore.getAll(organization.id, session);
    
    if (statusFilter !== 'all') {
      allTasks = allTasks.filter(t => t.status === statusFilter);
    }
    if (priorityFilter !== 'all') {
      allTasks = allTasks.filter(t => t.priority === priorityFilter);
    }
    
    return allTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [session, organization, statusFilter, priorityFilter, refreshKey]);

  const refresh = () => setRefreshKey(k => k + 1);

  const isOverdue = (task: Task) => {
    if (task.status === 'completed' || task.status === 'cancelled') return false;
    return new Date(task.dueDate) < new Date();
  };

  const priorityColors: Record<TaskPriority, string> = {
    low: 'text-gray-400',
    normal: 'text-blue-400',
    high: 'text-orange-400',
    critical: 'text-red-400',
  };

  const statusIcons: Record<TaskStatus, React.ReactNode> = {
    new: <Clock className="w-4 h-4 text-blue-400" />,
    in_progress: <Clock className="w-4 h-4 text-yellow-400" />,
    waiting: <Clock className="w-4 h-4 text-purple-400" />,
    completed: <CheckCircle className="w-4 h-4 text-green-400" />,
    cancelled: <XCircle className="w-4 h-4 text-gray-400" />,
  };

  const statusLabels: Record<TaskStatus, string> = {
    new: 'Новая',
    in_progress: 'В работе',
    waiting: 'Ожидает',
    completed: 'Выполнена',
    cancelled: 'Отменена',
  };

  const typeLabels: Record<TaskType, string> = {
    call_counterparty: 'Позвонить',
    send_payment_reminder: 'Напоминание',
    check_payment_status: 'Проверить платёж',
    verify_promise: 'Проверить обещание',
    prepare_claim_docs: 'Претензия',
    internal_review: 'Внутренняя проверка',
    other: 'Другое',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Задачи</h1>
          <p className="text-blue-200/60 mt-1">{tasks.length} задач</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition"
        >
          <Plus className="w-4 h-4" /> Создать задачу
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as any)}
          className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm"
        >
          <option value="all" className="bg-slate-800">Все статусы</option>
          <option value="new" className="bg-slate-800">Новые</option>
          <option value="in_progress" className="bg-slate-800">В работе</option>
          <option value="waiting" className="bg-slate-800">Ожидают</option>
          <option value="completed" className="bg-slate-800">Выполнены</option>
          <option value="cancelled" className="bg-slate-800">Отменены</option>
        </select>
        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value as any)}
          className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm"
        >
          <option value="all" className="bg-slate-800">Все приоритеты</option>
          <option value="low" className="bg-slate-800">Низкий</option>
          <option value="normal" className="bg-slate-800">Обычный</option>
          <option value="high" className="bg-slate-800">Высокий</option>
          <option value="critical" className="bg-slate-800">Критический</option>
        </select>
      </div>

      {/* Tasks list */}
      <div className="space-y-3">
        {tasks.length === 0 ? (
          <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-12 text-center">
            <p className="text-white/40">Нет задач</p>
          </div>
        ) : (
          tasks.map(task => {
            const assignee = orgUsers.find(u => u.id === task.assignedTo);
            const overdue = isOverdue(task);
            
            return (
              <div
                key={task.id}
                className={`bg-white/5 backdrop-blur rounded-xl border p-4 ${
                  overdue ? 'border-red-500/30' : 'border-white/10'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">{statusIcons[task.status]}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-medium">{task.title}</h3>
                      <span className={`text-xs ${priorityColors[task.priority]}`}>
                        {task.priority === 'critical' && '🔴'}
                        {task.priority === 'high' && '🟠'}
                        {task.priority === 'normal' && '🔵'}
                        {task.priority === 'low' && '⚪'}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-white/60 text-sm mb-2">{task.description}</p>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs text-white/40">
                      <span>{typeLabels[task.type]}</span>
                      {task.counterpartyName && <span>• {task.counterpartyName}</span>}
                      <span>• {assignee?.name || 'Не назначен'}</span>
                      <span className={overdue ? 'text-red-300' : ''}>
                        • Срок: {formatDate(task.dueDate)} {overdue && '(просрочено)'}
                      </span>
                    </div>
                    {task.result && (
                      <p className="text-green-300/70 text-xs mt-2">Результат: {task.result}</p>
                    )}
                  </div>
                  <select
                    value={task.status}
                    onChange={e => {
                      if (!session || !organization) return;
                      const newStatus = e.target.value as TaskStatus;
                      const updateData: Partial<Task> = { status: newStatus };
                      if (newStatus === 'completed') {
                        updateData.completedAt = new Date().toISOString();
                      }
                      taskStore.update(task.id, updateData, organization.id, session);
                      refresh();
                    }}
                    className="text-xs px-2 py-1 bg-white/5 border border-white/10 rounded text-white"
                  >
                    <option value="new" className="bg-slate-800">Новая</option>
                    <option value="in_progress" className="bg-slate-800">В работе</option>
                    <option value="waiting" className="bg-slate-800">Ожидает</option>
                    <option value="completed" className="bg-slate-800">Выполнена</option>
                    <option value="cancelled" className="bg-slate-800">Отменена</option>
                  </select>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create task modal */}
      {showCreateModal && session && organization && user && (
        <CreateTaskModal
          organizationId={organization.id}
          userId={user.id}
          orgUsers={orgUsers}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); refresh(); }}
        />
      )}
    </div>
  );
}

function CreateTaskModal({ organizationId, userId, orgUsers, onClose, onCreated }: {
  organizationId: string;
  userId: string;
  orgUsers: { id: string; name: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TaskType>('call_counterparty');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [assignedTo, setAssignedTo] = useState(userId);
  const [dueDate, setDueDate] = useState('');
  const [counterpartyName, setCounterpartyName] = useState('');

  const handleCreate = () => {
    if (!title.trim() || !dueDate) return;
    
    const task: Task = {
      id: generateId('task'),
      organizationId,
      title,
      description: description || undefined,
      type,
      priority,
      status: 'new',
      counterpartyName: counterpartyName || undefined,
      assignedTo,
      createdBy: userId,
      dueDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    taskStore.create(task);
    onCreated();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-white/10 rounded-2xl p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Создать задачу</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white">✕</button>
        </div>
        <div className="space-y-3">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Название задачи *"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
          />
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Описание"
            rows={3}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
          />
          <select
            value={type}
            onChange={e => setType(e.target.value as TaskType)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
          >
            <option value="call_counterparty" className="bg-slate-800">Позвонить контрагенту</option>
            <option value="send_payment_reminder" className="bg-slate-800">Отправить напоминание</option>
            <option value="check_payment_status" className="bg-slate-800">Уточнить статус платежа</option>
            <option value="verify_promise" className="bg-slate-800">Проверить обещанный платёж</option>
            <option value="prepare_claim_docs" className="bg-slate-800">Подготовить претензию</option>
            <option value="internal_review" className="bg-slate-800">Внутренняя проверка</option>
            <option value="other" className="bg-slate-800">Другое</option>
          </select>
          <select
            value={priority}
            onChange={e => setPriority(e.target.value as TaskPriority)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
          >
            <option value="low" className="bg-slate-800">Низкий приоритет</option>
            <option value="normal" className="bg-slate-800">Обычный приоритет</option>
            <option value="high" className="bg-slate-800">Высокий приоритет</option>
            <option value="critical" className="bg-slate-800">Критический приоритет</option>
          </select>
          <select
            value={assignedTo}
            onChange={e => setAssignedTo(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
          >
            {orgUsers.map(u => (
              <option key={u.id} value={u.id} className="bg-slate-800">{u.name}</option>
            ))}
          </select>
          <input
            value={counterpartyName}
            onChange={e => setCounterpartyName(e.target.value)}
            placeholder="Контрагент (опционально)"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
          />
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
          />
          <button
            onClick={handleCreate}
            disabled={!title.trim() || !dueDate}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-lg text-sm transition"
          >
            Создать задачу
          </button>
        </div>
      </div>
    </div>
  );
}
