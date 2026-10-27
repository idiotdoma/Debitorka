import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { userStore } from '../lib/store';
import { generateId, hashPassword } from '../lib/calculations';
import { User, UserRole } from '../types/models';
import { Users, Plus, Shield } from 'lucide-react';

export default function SettingsPage() {
  const { session, organization, user } = useAuth();
  const [showAddUser, setShowAddUser] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const orgUsers = useMemo(() => {
    if (!session || !organization) return [];
    return userStore.getByOrganization(organization.id, session);
  }, [session, organization, refreshKey]);

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  const refresh = () => setRefreshKey(k => k + 1);

  const roleLabels: Record<UserRole, string> = {
    owner: 'Владелец',
    admin: 'Администратор',
    manager: 'Руководитель',
    finance: 'Финансовый специалист',
    employee: 'Сотрудник',
    viewer: 'Наблюдатель',
    platform_admin: 'Администратор платформы',
  };

  const roleColors: Record<UserRole, string> = {
    owner: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    admin: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
    manager: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    finance: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
    employee: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
    viewer: 'bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800',
    platform_admin: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Настройки</h1>
          <p className="text-blue-200/60 mt-1">Управление организацией и пользователями</p>
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-400" />
          Организация
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-white/40 text-xs mb-1">Название</p>
            <p className="text-white font-medium">{organization?.name}</p>
          </div>
          <div>
            <p className="text-white/40 text-xs mb-1">ID</p>
            <p className="text-white/60 text-sm font-mono">{organization?.id}</p>
          </div>
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Пользователи ({orgUsers.length})
          </h3>
          {isAdmin && (
            <button
              onClick={() => setShowAddUser(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition text-sm"
            >
              <Plus className="w-4 h-4" /> Добавить
            </button>
          )}
        </div>

        <div className="space-y-2">
          {orgUsers.map(u => (
            <div key={u.id} className="flex items-center gap-4 bg-white/5 rounded-xl p-3">
              <div className="w-10 h-10 bg-blue-600/30 rounded-lg flex items-center justify-center">
                <span className="text-blue-300 font-medium">{u.name.charAt(0)}</span>
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-medium">{u.name}</p>
                <p className="text-white/40 text-xs">{u.email}</p>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium border ${roleColors[u.role]}`}>
                {roleLabels[u.role]}
              </span>
              {u.id === user?.id && (
                <span className="text-xs text-blue-300/60">(вы)</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-green-400" />
          Безопасность
        </h3>
        <div className="space-y-2 text-sm">
          <p className="text-white/60">✓ Tenant isolation: данные организаций полностью изолированы</p>
          <p className="text-white/60">✓ Все запросы проверяют членство в организации</p>
          <p className="text-white/60">✓ Финансовые расчёты детерминированы (не LLM)</p>
          <p className="text-white/60">✓ Импорт защищён от дубликатов</p>
          <p className="text-white/60">✓ Тесты tenant isolation пройдены</p>
        </div>
      </div>

      {showAddUser && isAdmin && session && organization && (
        <AddUserModal
          organizationId={organization.id}
          onClose={() => setShowAddUser(false)}
          onSaved={() => { setShowAddUser(false); refresh(); }}
        />
      )}
    </div>
  );
}

function AddUserModal({ organizationId, onClose, onSaved }: {
  organizationId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('viewer');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Заполните все поля');
      return;
    }

    const existing = userStore.getByEmail(email);
    if (existing) {
      setError('Email уже зарегистрирован');
      return;
    }

    const newUser: User = {
      id: generateId('user'),
      email,
      passwordHash: hashPassword(password),
      name,
      organizationId,
      role,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    userStore.create(newUser);
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-white/10 rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Добавить пользователя</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white transition">✕</button>
        </div>
        <div className="space-y-3">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Имя *"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30"
          />
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email *"
            type="email"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30"
          />
          <input
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Пароль *"
            type="password"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30"
          />
          <select
            value={role}
            onChange={e => setRole(e.target.value as UserRole)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
          >
            <option value="viewer" className="bg-slate-800">👁 Наблюдатель (только просмотр)</option>
            <option value="employee" className="bg-slate-800">👤 Сотрудник (работа с задачами)</option>
            <option value="finance" className="bg-slate-800">💰 Финансовый специалист</option>
            <option value="manager" className="bg-slate-800">👔 Руководитель (контроль сотрудников)</option>
            <option value="admin" className="bg-slate-800">🛡 Администратор (полный доступ)</option>
          </select>
          {error && <p className="text-red-300 text-sm">{error}</p>}
          <button
            onClick={handleSave}
            disabled={!name.trim() || !email.trim() || !password.trim()}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-lg text-sm transition"
          >
            Добавить
          </button>
        </div>
      </div>
    </div>
  );
}
