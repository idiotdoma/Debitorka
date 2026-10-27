import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { userStore, teamStore, invitationStore, auditStore } from '../lib/store';
import { generateId, generateToken, hashToken, formatDate } from '../lib/calculations';
import { canManageUsers, canManageTeams, getRoleMetadata } from '../lib/permissions';
import { User, UserRole, Team, Invitation, ActivityAudit } from '../types/models';
import { Users, UserPlus, Building2, Settings, Shield, Edit2, Trash2, Check, X, History } from 'lucide-react';

type Tab = 'users' | 'teams' | 'settings' | 'audit';

export default function CompanyManagementPage() {
  const { user, organization, session } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [refreshKey, setRefreshKey] = useState(0);

  if (!user || !organization || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white/60">Загрузка...</p>
      </div>
    );
  }

  const canManageUsersAccess = canManageUsers(user.role);
  const canManageTeamsAccess = canManageTeams(user.role);

  const refresh = () => setRefreshKey(k => k + 1);

  const tabs = [
    { id: 'users' as Tab, label: 'Сотрудники', icon: Users, available: canManageUsersAccess },
    { id: 'teams' as Tab, label: 'Команды', icon: Building2, available: canManageTeamsAccess },
    { id: 'settings' as Tab, label: 'Настройки', icon: Settings, available: canManageUsersAccess },
    { id: 'audit' as Tab, label: 'Аудит', icon: History, available: canManageUsersAccess },
  ].filter(tab => tab.available);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Управление компанией</h1>
        <p className="text-blue-200/60 mt-1">Администрирование организации</p>
      </div>

      {/* Вкладки */}
      <div className="flex gap-2 border-b border-white/10">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition border-b-2 ${
                activeTab === tab.id
                  ? 'text-white border-blue-500'
                  : 'text-white/60 border-transparent hover:text-white hover:border-white/20'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Содержимое вкладок */}
      {activeTab === 'users' && <UsersTab organizationId={organization.id} session={session} refresh={refresh} refreshKey={refreshKey} />}
      {activeTab === 'teams' && <TeamsTab organizationId={organization.id} session={session} refresh={refresh} refreshKey={refreshKey} />}
      {activeTab === 'settings' && <SettingsTab organizationId={organization.id} session={session} />}
      {activeTab === 'audit' && <AuditTab organizationId={organization.id} session={session} refreshKey={refreshKey} />}
    </div>
  );
}

// === Вкладка "Сотрудники" ===

function UsersTab({ organizationId, session, refresh, refreshKey }: {
  organizationId: string;
  session: any;
  refresh: () => void;
  refreshKey: number;
}) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<User | null>(null);

  const users = useMemo(() => {
    let allUsers = userStore.getByOrganization(organizationId, session);
    
    if (search) {
      const q = search.toLowerCase();
      allUsers = allUsers.filter(u => 
        u.name.toLowerCase().includes(q) || 
        u.email.toLowerCase().includes(q)
      );
    }
    
    if (roleFilter !== 'all') {
      allUsers = allUsers.filter(u => u.role === roleFilter);
    }
    
    return allUsers;
  }, [organizationId, session, search, roleFilter, refreshKey]);

  const invitations = useMemo(() => {
    return invitationStore.getAll(organizationId, session);
  }, [organizationId, session, refreshKey]);

  return (
    <div className="space-y-6">
      {/* Панель действий */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-3 flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени или email..."
            className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
          >
            <option value="all" className="bg-slate-800">Все роли</option>
            <option value="owner" className="bg-slate-800">Владелец</option>
            <option value="admin" className="bg-slate-800">Администратор</option>
            <option value="manager" className="bg-slate-800">Руководитель</option>
            <option value="finance" className="bg-slate-800">Финансовый специалист</option>
            <option value="employee" className="bg-slate-800">Сотрудник</option>
            <option value="viewer" className="bg-slate-800">Наблюдатель</option>
          </select>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition"
        >
          <UserPlus className="w-4 h-4" />
          Пригласить
        </button>
      </div>

      {/* Список пользователей */}
      <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">Сотрудник</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">Роль</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">Статус</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => {
              const roleMeta = getRoleMetadata(user.role);
              return (
                <tr key={user.id} className="border-b border-white/5 hover:bg-white/5 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-600/30 rounded-lg flex items-center justify-center">
                        <span className="text-blue-300 font-medium">{user.name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{user.name}</p>
                        <p className="text-white/40 text-xs">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium bg-${roleMeta.color}-500/20 text-${roleMeta.color}-300 border border-${roleMeta.color}-500/30`}>
                      {roleMeta.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${user.isActive === false ? 'text-red-300' : 'text-green-300'}`}>
                      {user.isActive === false ? 'Деактивирован' : 'Активен'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setShowEditModal(user)}
                      className="p-2 hover:bg-white/10 rounded-lg transition"
                      title="Редактировать"
                    >
                      <Edit2 className="w-4 h-4 text-white/60" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Приглашения */}
      {invitations.length > 0 && (
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Активные приглашения</h3>
          <div className="space-y-2">
            {invitations.filter(i => i.status === 'pending').map(inv => (
              <div key={inv.id} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                <div>
                  <p className="text-white text-sm">{inv.email}</p>
                  <p className="text-white/40 text-xs">
                    {getRoleMetadata(inv.role).label} • Истекает {formatDate(inv.expiresAt)}
                  </p>
                </div>
                <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded text-xs">
                  Ожидает
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Модальные окна */}
      {showInviteModal && (
        <InviteModal
          organizationId={organizationId}
          onClose={() => setShowInviteModal(false)}
          onInvited={() => { setShowInviteModal(false); refresh(); }}
        />
      )}

      {showEditModal && (
        <EditUserModal
          user={showEditModal}
          organizationId={organizationId}
          session={session}
          onClose={() => setShowEditModal(null)}
          onSaved={() => { setShowEditModal(null); refresh(); }}
        />
      )}
    </div>
  );
}

// === Модальное окно приглашения ===

function InviteModal({ organizationId, onClose, onInvited }: {
  organizationId: string;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('employee');
  const [error, setError] = useState('');

  const handleInvite = () => {
    if (!email.trim()) {
      setError('Введите email');
      return;
    }

    const existingUser = userStore.getByEmail(email);
    if (existingUser && existingUser.organizationId === organizationId) {
      setError('Пользователь уже в организации');
      return;
    }

    const token = generateToken();
    const tokenHash = hashToken(token);
    
    const invitation: Invitation = {
      id: generateId('inv'),
      organizationId,
      email,
      role,
      token,
      tokenHash,
      status: 'pending',
      invitedBy: 'current-user', // В реальном приложении здесь был бы ID текущего пользователя
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(), // 72 часа
      createdAt: new Date().toISOString(),
    };

    invitationStore.create(invitation);
    
    // Добавляем в аудит
    auditStore.create({
      id: generateId('audit'),
      organizationId,
      entityType: 'user',
      entityId: invitation.id,
      action: 'invitation_created',
      changedBy: 'current-user',
      changedAt: new Date().toISOString(),
      newValue: { email, role },
    });

    onInvited();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-white/10 rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Пригласить сотрудника</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email сотрудника"
            type="email"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
          >
            <option value="employee" className="bg-slate-800">Сотрудник</option>
            <option value="manager" className="bg-slate-800">Руководитель</option>
            <option value="finance" className="bg-slate-800">Финансовый специалист</option>
            <option value="viewer" className="bg-slate-800">Наблюдатель</option>
            <option value="admin" className="bg-slate-800">Администратор</option>
          </select>
          {error && <p className="text-red-300 text-sm">{error}</p>}
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
            <p className="text-yellow-200 text-xs">
              ⚠️ В демо-режиме приглашение создаётся, но email не отправляется.
              Для реальной отправки необходима настройка почтового сервиса.
            </p>
          </div>
          <button
            onClick={handleInvite}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition"
          >
            Отправить приглашение
          </button>
        </div>
      </div>
    </div>
  );
}

// === Модальное окно редактирования пользователя ===

function EditUserModal({ user, organizationId, session, onClose, onSaved }: {
  user: User;
  organizationId: string;
  session: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [isActive, setIsActive] = useState(user.isActive !== false);
  const [error, setError] = useState('');

  const handleSave = () => {
    try {
      userStore.update(user.id, {
        role,
        isActive,
        updatedAt: new Date().toISOString(),
      });

      // Добавляем в аудит
      auditStore.create({
        id: generateId('audit'),
        organizationId,
        entityType: 'user',
        entityId: user.id,
        action: 'user_updated',
        changedBy: 'current-user',
        changedAt: new Date().toISOString(),
        oldValue: { role: user.role, isActive: user.isActive },
        newValue: { role, isActive },
      });

      onSaved();
    } catch (error) {
      setError('Ошибка при сохранении');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-white/10 rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Редактировать пользователя</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-white/60 mb-1">Сотрудник</p>
            <p className="text-white">{user.name}</p>
            <p className="text-white/40 text-xs">{user.email}</p>
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">Роль</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
            >
              <option value="owner" className="bg-slate-800">Владелец</option>
              <option value="admin" className="bg-slate-800">Администратор</option>
              <option value="manager" className="bg-slate-800">Руководитель</option>
              <option value="finance" className="bg-slate-800">Финансовый специалист</option>
              <option value="employee" className="bg-slate-800">Сотрудник</option>
              <option value="viewer" className="bg-slate-800">Наблюдатель</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="isActive" className="text-sm text-white">
              Активна
            </label>
          </div>
          {error && <p className="text-red-300 text-sm">{error}</p>}
          <button
            onClick={handleSave}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

// === Вкладка "Команды" ===

function TeamsTab({ organizationId, session, refresh, refreshKey }: {
  organizationId: string;
  session: any;
  refresh: () => void;
  refreshKey: number;
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);

  const teams = useMemo(() => {
    return teamStore.getAll(organizationId, session);
  }, [organizationId, session, refreshKey]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Команды</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition"
        >
          <Building2 className="w-4 h-4" />
          Создать команду
        </button>
      </div>

      {teams.length === 0 ? (
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-12 text-center">
          <Building2 className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/40">Нет команд</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teams.map(team => {
            const members = userStore.getByOrganization(organizationId, session)
              .filter(u => u.teamId === team.id);
            const manager = members.find(m => m.id === team.managerId);

            return (
              <div key={team.id} className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold">{team.name}</h3>
                  <span className="text-white/40 text-sm">{members.length} участников</span>
                </div>
                {team.description && (
                  <p className="text-white/60 text-sm mb-4">{team.description}</p>
                )}
                {manager && (
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="w-4 h-4 text-blue-400" />
                    <span className="text-white/60">Руководитель:</span>
                    <span className="text-white">{manager.name}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <CreateTeamModal
          organizationId={organizationId}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); refresh(); }}
        />
      )}
    </div>
  );
}

function CreateTeamModal({ organizationId, onClose, onCreated }: {
  organizationId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const handleCreate = () => {
    if (!name.trim()) {
      setError('Введите название команды');
      return;
    }

    const team: Team = {
      id: generateId('team'),
      organizationId,
      name: name.trim(),
      description: description.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    teamStore.create(team);

    // Добавляем в аудит
    auditStore.create({
      id: generateId('audit'),
      organizationId,
      entityType: 'team',
      entityId: team.id,
      action: 'team_created',
      changedBy: 'current-user',
      changedAt: new Date().toISOString(),
      newValue: { name: team.name },
    });

    onCreated();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-white/10 rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Создать команду</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название команды"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Описание (опционально)"
            rows={3}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
          />
          {error && <p className="text-red-300 text-sm">{error}</p>}
          <button
            onClick={handleCreate}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition"
          >
            Создать
          </button>
        </div>
      </div>
    </div>
  );
}

// === Вкладка "Настройки" ===

function SettingsTab({ organizationId, session }: {
  organizationId: string;
  session: any;
}) {
  const { organization } = useAuth();

  return (
    <div className="space-y-6">
      <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Настройки организации</h2>
        
        <div className="space-y-4">
          <div>
            <p className="text-sm text-white/60 mb-1">Название</p>
            <p className="text-white">{organization?.name}</p>
          </div>

          <div>
            <p className="text-sm text-white/60 mb-1">Часовой пояс</p>
            <p className="text-white">{organization?.timezone || 'Europe/Moscow'}</p>
          </div>

          <div>
            <p className="text-sm text-white/60 mb-1">Порог устаревания данных</p>
            <p className="text-white">{organization?.staleDataThresholdHours || 24} часов</p>
          </div>
        </div>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
        <p className="text-yellow-200 text-sm">
          ⚠️ В демо-режиме настройки организации хранятся локально.
          Для полноценного управления необходима серверная часть.
        </p>
      </div>
    </div>
  );
}

// === Вкладка "Аудит" ===

function AuditTab({ organizationId, session, refreshKey }: {
  organizationId: string;
  session: any;
  refreshKey: number;
}) {
  const audits = useMemo(() => {
    return auditStore.getAll(organizationId, session)
      .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
      .slice(0, 50);
  }, [organizationId, session, refreshKey]);

  const actionLabels: Record<string, string> = {
    invitation_created: 'Создано приглашение',
    user_updated: 'Обновлён пользователь',
    team_created: 'Создана команда',
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-white">Журнал действий</h2>

      {audits.length === 0 ? (
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-12 text-center">
          <History className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/40">Нет записей в журнале</p>
        </div>
      ) : (
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">Действие</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">Объект</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-blue-200/60 uppercase">Время</th>
              </tr>
            </thead>
            <tbody>
              {audits.map(audit => (
                <tr key={audit.id} className="border-b border-white/5">
                  <td className="px-4 py-3 text-white text-sm">
                    {actionLabels[audit.action] || audit.action}
                  </td>
                  <td className="px-4 py-3 text-white/60 text-sm">
                    {audit.entityType}
                  </td>
                  <td className="px-4 py-3 text-white/40 text-sm">
                    {formatDate(audit.changedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
