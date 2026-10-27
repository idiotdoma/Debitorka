import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { userStore, invitationStore, teamStore } from '../lib/store';
import { generateId, generateToken, hashToken } from '../lib/utils';
import { canInviteUsers, canManageUsers, getRoleMetadata } from '../lib/permissions';
import { User, UserRole, Invitation } from '../types/models';
import { Users, Plus, Mail, Shield } from 'lucide-react';

export default function UsersPage() {
  const { session, organization, user } = useAuth();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const users = useMemo(() => {
    if (!session || !organization) return [];
    return userStore.getByOrganization(organization.id, session);
  }, [session, organization, refreshKey]);

  const invitations = useMemo(() => {
    if (!session || !organization) return [];
    return invitationStore.getAll(organization.id, session);
  }, [session, organization, refreshKey]);

  const refresh = () => setRefreshKey(k => k + 1);

  const canInvite = user && canInviteUsers(user.role);
  const canManage = user && canManageUsers(user.role);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Сотрудники</h1>
          <p className="text-blue-200/60 mt-1">{users.length} сотрудников</p>
        </div>
        {canInvite && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition"
          >
            <Plus className="w-4 h-4" /> Пригласить
          </button>
        )}
      </div>

      <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-400" />
          Команда
        </h3>
        <div className="space-y-2">
          {users.map(u => {
            const meta = getRoleMetadata(u.role);
            return (
              <div key={u.id} className="flex items-center gap-4 bg-white/5 rounded-xl p-3">
                <div className="w-10 h-10 bg-blue-600/30 rounded-lg flex items-center justify-center">
                  <span className="text-blue-300 font-medium">{(u.firstName || u.name || '?').charAt(0)}</span>
                </div>
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">{u.firstName} {u.lastName}</p>
                  <p className="text-white/40 text-xs">{u.email}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium bg-${meta.color}-500/20 text-${meta.color}-300 border border-${meta.color}-500/30`}>
                  {meta.label}
                </span>
                {u.id === user?.id && (
                  <span className="text-xs text-blue-300/60">(вы)</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {invitations.length > 0 && (
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5 text-yellow-400" />
            Приглашения
          </h3>
          <div className="space-y-2">
            {invitations.map(inv => (
              <div key={inv.id} className="flex items-center gap-4 bg-white/5 rounded-xl p-3">
                <Mail className="w-5 h-5 text-yellow-400" />
                <div className="flex-1">
                  <p className="text-white text-sm">{inv.email}</p>
                  <p className="text-white/40 text-xs">{getRoleMetadata(inv.role).label}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${
                  inv.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                  inv.status === 'accepted' ? 'bg-green-500/20 text-green-300' :
                  'bg-red-500/20 text-red-300'
                }`}>
                  {inv.status === 'pending' ? 'Ожидает' : inv.status === 'accepted' ? 'Принято' : 'Отклонено'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showInviteModal && session && organization && user && (
        <InviteModal
          organizationId={organization.id}
          invitedBy={user.id}
          onClose={() => setShowInviteModal(false)}
          onInvited={() => { setShowInviteModal(false); refresh(); }}
        />
      )}
    </div>
  );
}

function InviteModal({ organizationId, invitedBy, onClose, onInvited }: {
  organizationId: string;
  invitedBy: string;
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
    if (existingUser) {
      setError('Пользователь с таким email уже существует');
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
      invitedBy,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    };

    invitationStore.create(invitation);
    onInvited();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-white/10 rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Пригласить сотрудника</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white">✕</button>
        </div>
        <div className="space-y-3">
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email сотрудника"
            type="email"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
          />
          <select
            value={role}
            onChange={e => setRole(e.target.value as UserRole)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
          >
            <option value="employee" className="bg-slate-800">Сотрудник</option>
            <option value="manager" className="bg-slate-800">Руководитель</option>
            <option value="finance" className="bg-slate-800">Финансовый специалист</option>
            <option value="viewer" className="bg-slate-800">Наблюдатель</option>
          </select>
          {error && <p className="text-red-300 text-sm">{error}</p>}
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
