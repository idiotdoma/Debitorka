import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, Upload, List, Target, LogOut, Shield, Users, History, Settings, CheckSquare, Bell, Sparkles, Plug } from 'lucide-react';
import { notificationStore } from '../lib/store';
import DemoModeWarning from './DemoModeWarning';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { user, organization, session, logout } = useAuth();

  // Получаем количество непрочитанных уведомлений
  const unreadCount = React.useMemo(() => {
    if (!session || !organization || !user) return 0;
    return notificationStore.getUnread(user.id, organization.id, session).length;
  }, [session, organization, user, currentPage]);

  const navItems = [
    { id: 'dashboard', label: 'Дашборд', icon: LayoutDashboard },
    { id: 'debts', label: 'Реестр', icon: List },
    { id: 'import', label: 'Импорт', icon: Upload },
    { id: 'integrations', label: 'Интеграции', icon: Plug },
    { id: 'tasks', label: 'Задачи', icon: CheckSquare },
    { id: 'my-tasks', label: 'Мои задачи', icon: Target },
    { id: 'ai-assistant', label: 'ИИ-помощник', icon: Sparkles },
    { id: 'notifications', label: 'Уведомления', icon: Bell, badge: unreadCount },
    { id: 'actions', label: 'Действия', icon: Target },
    { id: 'history', label: 'История', icon: History },
    { id: 'settings', label: 'Настройки', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Demo Mode Warning */}
      <DemoModeWarning />
      
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
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            const badge = (item as any).badge;
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
                <span className="flex-1 text-left">{item.label}</span>
                {badge > 0 && (
                  <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    {badge}
                  </span>
                )}
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
