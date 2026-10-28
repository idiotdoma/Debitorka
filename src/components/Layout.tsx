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

  return (
    <div className="min-h-screen transition-colors duration-300 bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-blue-900 dark:to-slate-900">
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg transition-colors bg-white dark:bg-slate-800 shadow-md dark:shadow-lg text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-700"
      >
        {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full w-64 flex flex-col z-40 transition-all duration-500 ease-out ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      } bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 shadow-lg animate-fade-in-left`}>
        {/* Logo */}
        <div className="p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-700 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
              <Shield className="w-5 h-5 text-white transition-transform duration-300 group-hover:scale-110" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight text-gray-900 dark:text-white">
                Дебиторка
              </h1>
              <p className="text-xs text-gray-500 dark:text-blue-200/60">
                Контроль B2B
              </p>
            </div>
          </div>
        </div>

        {/* Organization info */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-xs">
            <Users className="w-3.5 h-3.5 text-gray-400 dark:text-blue-300/50" />
            <span className="truncate text-gray-600 dark:text-blue-200/60">
              {organization?.name}
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setMobileMenuOpen(false);
                }}
                style={{ animationDelay: `${index * 0.03}s` }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all duration-300 stagger-item hover:translate-x-1 ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 shadow-sm scale-105'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-4 h-4 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                <span className="truncate font-medium">{item.label}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse-subtle" />
                )}
              </button>
            );
          })}
        </nav>

        {/* User info and theme toggle */}
        <div className="p-4 border-t border-gray-200 dark:border-slate-700">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 mb-3 rounded-lg text-xs transition-colors bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700"
          >
            {theme === 'light' ? (
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
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-100 dark:bg-blue-900/30">
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                {user?.name?.charAt(0) || '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate text-gray-900 dark:text-white">
                {user?.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {user?.role}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
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
      <main key={currentPage} className="md:ml-64 p-4 md:p-8 pt-16 md:pt-8 animate-fade-in">
        {children}
      </main>
    </div>
  );
}
