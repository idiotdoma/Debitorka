import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { userStore } from '../lib/store';
import { formatDate } from '../lib/calculations';
import { getRoleMetadata } from '../lib/permissions';
import { User, Team } from '../types/models';
import { User as UserIcon, Mail, Building2, Users, Shield, Calendar, Save, X } from 'lucide-react';

export default function ProfilePage() {
  const { user, organization, team, session } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || user?.name.split(' ')[0] || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [position, setPosition] = useState(user?.position || '');
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!user || !organization || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white/60">Загрузка...</p>
      </div>
    );
  }

  const roleMeta = getRoleMetadata(user.role);

  const handleSave = () => {
    if (!firstName.trim()) {
      setSaveMessage({ type: 'error', text: 'Имя не может быть пустым' });
      return;
    }

    try {
      const updatedUser: Partial<User> = {
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        position: position.trim() || undefined,
        name: `${firstName.trim()}${lastName.trim() ? ' ' + lastName.trim() : ''}`.trim(),
        updatedAt: new Date().toISOString(),
      };

      userStore.update(user.id, updatedUser);
      setIsEditing(false);
      setSaveMessage({ type: 'success', text: 'Профиль успешно обновлён' });
      
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      setSaveMessage({ type: 'error', text: 'Ошибка при сохранении' });
    }
  };

  const handleCancel = () => {
    setFirstName(user.firstName || user.name.split(' ')[0] || '');
    setLastName(user.lastName || '');
    setPosition(user.position || '');
    setIsEditing(false);
    setSaveMessage(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Мой профиль</h1>
        <p className="text-blue-200/60 mt-1">Личная информация и настройки</p>
      </div>

      {saveMessage && (
        <div className={`p-4 rounded-lg border ${
          saveMessage.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300' 
            : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
        }`}>
          {saveMessage.text}
        </div>
      )}

      {/* Основная информация */}
      <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-blue-400" />
            Основная информация
          </h2>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition"
            >
              Редактировать
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/60 mb-1">Имя</label>
              {isEditing ? (
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-white">{user.firstName || user.name.split(' ')[0]}</p>
              )}
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-1">Фамилия</label>
              {isEditing ? (
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-white">{user.lastName || '—'}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-1">Должность</label>
            {isEditing ? (
              <input
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="Например: Финансовый менеджер"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-white">{user.position || '—'}</p>
            )}
          </div>

          {isEditing && (
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm transition"
              >
                <Save className="w-4 h-4" />
                Сохранить
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm transition"
              >
                <X className="w-4 h-4" />
                Отмена
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Контактная информация */}
      <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <Mail className="w-5 h-5 text-blue-400" />
          Контактная информация
        </h2>

        <div className="space-y-3">
          <div>
            <p className="text-sm text-white/60 mb-1">Email</p>
            <p className="text-white">{user.email}</p>
          </div>

          <div>
            <p className="text-sm text-white/60 mb-1">Статус учётной записи</p>
            <p className={`text-sm ${user.isActive === false ? 'text-red-300' : 'text-green-300'}`}>
              {user.isActive === false ? 'Деактивирована' : 'Активна'}
            </p>
          </div>
        </div>
      </div>

      {/* Организационная информация */}
      <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-blue-400" />
          Организация
        </h2>

        <div className="space-y-3">
          <div>
            <p className="text-sm text-white/60 mb-1">Название организации</p>
            <p className="text-white">{organization.name}</p>
          </div>

          <div>
            <p className="text-sm text-white/60 mb-1">Команда</p>
            <p className="text-white">{team?.name || 'Не назначена'}</p>
          </div>

          <div>
            <p className="text-sm text-white/60 mb-1">Роль</p>
            <div className="flex items-center gap-2">
              <Shield className={`w-4 h-4 text-${roleMeta.color}-400`} />
              <span className={`text-sm font-medium text-${roleMeta.color}-300`}>
                {roleMeta.label}
              </span>
            </div>
            <p className="text-xs text-white/40 mt-1">{roleMeta.description}</p>
          </div>
        </div>
      </div>

      {/* Информация о безопасности */}
      <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-green-400" />
          Безопасность
        </h2>

        <div className="space-y-3">
          <div>
            <p className="text-sm text-white/60 mb-1">Последний вход</p>
            <p className="text-white">
              {user.lastLoginAt ? formatDate(user.lastLoginAt) : '—'}
            </p>
          </div>

          <div>
            <p className="text-sm text-white/60 mb-1">Дата регистрации</p>
            <p className="text-white">{formatDate(user.createdAt)}</p>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mt-4">
            <p className="text-yellow-200 text-xs">
              ⚠️ Для смены пароля обратитесь к администратору организации.
            </p>
          </div>
        </div>
      </div>

      {/* Информация о демо-режиме */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <p className="text-blue-200 text-sm">
          <strong>Демонстрационный режим:</strong> Данные профиля хранятся локально в браузере.
          Для полноценной работы с профилями необходима серверная часть с базой данных.
        </p>
      </div>
    </div>
  );
}
