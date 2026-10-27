import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import DebtListPage from './pages/DebtListPage';
import ImportPage from './pages/ImportPage';
import IntegrationsPage from './pages/IntegrationsPage';
import TasksPage from './pages/TasksPage';
import MyTasksPage from './pages/MyTasksPage';
import AIAssistantPage from './pages/AIAssistantPage';
import NotificationCenter from './pages/NotificationCenter';
import ActionsPage from './pages/ActionsPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import Layout from './components/Layout';
import { runNotificationChecks } from './lib/notificationService';

function AppContent() {
  const { user, organization, session, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [listFilters, setListFilters] = useState<Record<string, any> | undefined>(undefined);

  // Запуск проверки уведомлений при загрузке и каждые 5 минут
  useEffect(() => {
    if (!organization || !session) return;
    
    runNotificationChecks(organization.id);
    
    const interval = setInterval(() => {
      runNotificationChecks(organization.id);
    }, 5 * 60 * 1000); // 5 минут
    
    return () => clearInterval(interval);
  }, [organization, session]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white/60 animate-pulse">Загрузка...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const handleNavigate = (page: string, filters?: Record<string, any>) => {
    setCurrentPage(page);
    if (filters) {
      setListFilters(filters);
    } else {
      setListFilters(undefined);
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <DashboardPage onNavigate={handleNavigate} />;
      case 'debts': return <DebtListPage initialFilters={listFilters} />;
      case 'import': return <ImportPage />;
      case 'integrations': return <IntegrationsPage />;
      case 'tasks': return <TasksPage />;
      case 'my-tasks': return <MyTasksPage />;
      case 'ai-assistant': return <AIAssistantPage />;
      case 'notifications': return <NotificationCenter />;
      case 'actions': return <ActionsPage />;
      case 'history': return <HistoryPage />;
      case 'settings': return <SettingsPage />;
      default: return <DashboardPage onNavigate={handleNavigate} />;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={(page) => handleNavigate(page)}>
      {renderPage()}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
