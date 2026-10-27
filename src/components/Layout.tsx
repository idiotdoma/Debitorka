import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { canViewAllDebts, canCreateTasks, canManageUsers, canViewFinanceAnalytics, canUseAI } from '../lib/permissions';
import { LayoutDashboard, Upload, List, Target, LogOut, Shield, Users, History, Settings, CheckSquare, Bell, Sparkles, Menu, X, Sun, Moon } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { user, organization, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Дашборд', icon: LayoutDashboard, roles: ['owner', 'admin', 'manager', 'finance', 'employee', 'viewer'] },
    { id: 'manager-dashboard', label: 'Кабинет руководителя', icon: LayoutDashboard, roles: ['manager'] },
    { id: 'finance-dashboard', label: 'Финансовый кабинет', icon: LayoutDashboard, roles: ['finance'] },
    { id: 'financial-analytics', label: 'Финансовая аналитика', icon: LayoutDashboard, roles: ['owner', 'admin', 'finance'] },
    { id: 'payment-calendar', label: 'Платёжный календарь', icon: LayoutDashboard, roles: ['owner', 'admin', 'manager', 'finance'] },
    { id: 'collection-priorities', label: 'Приоритеты взыскания', icon: Target, roles: ['owner', 'admin', 'manager', 'finance', 'employee'] },
    { id: 'reports', label: 'Отчёты', icon: LayoutDashboard, roles: ['owner', 'admin', 'finance'] },
    { id: 'data-quality', label: 'Качество данных', icon: LayoutDashboard, roles: ['owner', 'admin', 'finance'] },
    { id: 'notes', label: 'Заметки', icon: Sparkles, roles: ['owner', 'admin', 'manager', 'finance', 'employee'] },
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

  const isLight = theme === 'light';

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isLight 
        ? 'bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50' 
        : 'bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900'
    }`}>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className={`md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg transition-colors ${
          isLight 
            ? 'bg-white shadow-md text-gray-700 hover:bg-gray-100' 
            : 'bg-slate-800 shadow-lg text-white hover:bg-slate-700'
        }`}
      >
        {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full w-64 flex flex-col z-40 transition-all duration-300 ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      } ${
        isLight
          ? 'bg-white border-r border-gray-200 shadow-lg'
          : 'bg-black/20 backdrop-blur-xl border-r border-white/10'
      }`}>
        {/* Logo */}
        <div className={`p-6 border-b ${isLight ? 'border-gray-200' : 'border-white/10'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${
              isLight 
                ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/30' 
                : 'bg-blue-600 shadow-blue-600/30'
            }`}>
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className={`font-bold text-lg leading-tight ${isLight ? 'text-gray-900' : 'text-white'}`}>
                Дебиторка
              </h1>
              <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-blue-200/40'}`}>
                Контроль B2B
              </p>
            </div>
          </div>
        </div>

        {/* Organization info */}
        <div className={`px-4 py-3 border-b ${isLight ? 'border-gray-200' : 'border-white/5'}`}>
          <div className="flex items-center gap-2 text-xs">
            <Users className={`w-3.5 h-3.5 ${isLight ? 'text-gray-400' : 'text-blue-300/50'}`} />
            <span className={`truncate ${isLight ? 'text-gray-600' : 'text-blue-200/60'}`}>
              {organization?.name}
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {visibleNavItems.map(item => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all ${
                  isActive
                    ? isLight
                      ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                      : 'bg-blue-600/30 text-white border border-blue-500/30'
                    : isLight
                      ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User info and theme toggle */}
        <div className={`p-4 border-t ${isLight ? 'border-gray-200' : 'border-white/10'}`}>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2 mb-3 rounded-lg text-xs transition-colors ${
              isLight
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            {isLight ? (
              <>
                <Moon className="w-4 h-4" />
                <span>Тёмная тема</span>
              </>
            ) : (
              <>
                <Sun className="w-4 h-4" />
                <span>Светлая тема</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-3 mb-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isLight ? 'bg-blue-100' : 'bg-blue-600/30'
            }`}>
              <span className={`text-xs font-medium ${isLight ? 'text-blue-700' : 'text-blue-300'}`}>
                {user?.name?.charAt(0) || '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm truncate ${isLight ? 'text-gray-900' : 'text-white'}`}>
                {user?.name}
              </p>
              <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-white/30'}`}>
                {user?.role}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${
              isLight
                ? 'text-red-600 hover:bg-red-50'
                : 'text-red-300/60 hover:text-red-300 hover:bg-red-500/10'
            }`}
          >
            <LogOut className="w-3.5 h-3.5" />
            Выйти
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="md:ml-64 p-4 md:p-8 pt-16 md:pt-8">
        {children}
      </main>
    </div>
  );
}
