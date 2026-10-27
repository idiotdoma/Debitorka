import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import DebtListPage from './pages/DebtListPage';
import ImportPage from './pages/ImportPage';
import TasksPage from './pages/TasksPage';
import MyTasksPage from './pages/MyTasksPage';
import NotificationCenter from './pages/NotificationCenter';
import ActionsPage from './pages/ActionsPage';
import AIAssistantPage from './pages/AIAssistantPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import UsersPage from './pages/UsersPage';
import Layout from './components/Layout';

function AppContent() {
  const { user, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

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

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <DashboardPage />;
      case 'debts': return <DebtListPage />;
      case 'import': return <ImportPage />;
      case 'tasks': return <TasksPage />;
      case 'my-tasks': return <MyTasksPage />;
      case 'notifications': return <NotificationCenter />;
      case 'actions': return <ActionsPage />;
      case 'ai-assistant': return <AIAssistantPage />;
      case 'history': return <HistoryPage />;
      case 'settings': return <SettingsPage />;
      case 'users': return <UsersPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
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
