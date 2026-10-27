import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { canViewAllDebts, canCreateTasks, canManageUsers, canViewFinanceAnalytics, canUseAI } from '../lib/permissions';
import { LayoutDashboard, Upload, List, Target, LogOut, Shield, Users, History, Settings, CheckSquare, Bell, Sparkles } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { user, organization, logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Дашборд', icon: LayoutDashboard, roles: ['owner', 'admin', 'manager', 'finance', 'employee', 'viewer'] },
    { id: 'manager-dashboard', label: 'Кабинет руководителя', icon: LayoutDashboard, roles: ['manager'] },
    { id: 'finance-dashboard', label: 'Финансовый кабинет', icon: LayoutDashboard, roles: ['finance'] },
    { id: 'debts', label: 'Реестр', icon: List, roles: ['owner', 'admin', 'manager', 'finance'] },
    { id: 'import', label: 'Импорт', icon: Upload, roles: ['owner', 'admin', 'finance'] },
    { id: 'tasks', label: 'Задачи', icon: CheckSquare, roles: ['owner', 'admin', 'manager'] },
    { id: 'my-tasks', label: 'Мои задачи', icon: Target, roles: ['owner', 'admin', 'manager', 'finance', 'employee'] },
    { id: 'ai-assistant', label: 'ИИ-помощник', icon: Sparkles, roles: ['owner', 'admin', 'manager', 'finance', 'employee'] },
    { id: 'notifications', label: 'Уведомления', icon: Bell, roles: ['owner', 'admin', 'manager', 'finance', 'employee'] },
    { id: 'actions', label: 'Действия', icon: Target, roles: ['owner', 'admin', 'manager', 'finance', 'employee'] },
    { id: 'history', label: 'История', icon: History, roles: ['owner', 'admin', 'finance'] },
    { id: 'company', label: 'Управление компанией', icon: Users, roles: ['owner', 'admin'] },
    { id: 'users', label: 'Сотрудники', icon: Users, roles: ['owner', 'admin'] },
    { id: 'profile', label: 'Мой профиль', icon: Settings, roles: ['owner', 'admin', 'manager', 'finance', 'employee', 'viewer'] },
    { id: 'settings', label: 'Настройки', icon: Settings, roles: ['owner', 'admin'] },
  ];

  const visibleNavItems = navItems.filter(item => 
    user && item.roles.includes(user.role)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-black/20 backdrop-blur-xl border-r border-white/10 flex flex-col z-40">
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">Дебиторка</h1>
              <p className="text-blue-200/40 text-xs">Контроль B2B</p>
            </div>
          </div>
        </div>

        {/* Organization info */}
        <div className="px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2 text-xs">
            <Users className="w-3.5 h-3.5 text-blue-300/50" />
            <span className="text-blue-200/60 truncate">{organization?.name}</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {visibleNavItems.map(item => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition ${
                  isActive
                    ? 'bg-blue-600/30 text-white border border-blue-500/30'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User info */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-blue-600/30 rounded-lg flex items-center justify-center">
              <span className="text-blue-300 text-xs font-medium">
                {user?.name?.charAt(0) || '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm truncate">{user?.name}</p>
              <p className="text-white/30 text-xs">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 text-red-300/60 hover:text-red-300 hover:bg-red-500/10 rounded-lg text-xs transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            Выйти
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64 p-8">
        {children}
      </main>
    </div>
  );
}
