import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { integrationStore, syncHistoryStore } from '../lib/store';
import { syncService } from '../lib/integration/syncService';
import { adapterFactory } from '../lib/integration/adapters';
import { formatCurrency, formatDate, generateId } from '../lib/calculations';
import {
  IntegrationConnection,
  SyncHistory,
  SyncPreview,
  DataSourceType,
  ConnectionStatus,
  CONNECTION_STATUS_LABELS,
  SYNC_STATUS_LABELS,
  SYNC_SCHEDULE_OPTIONS,
  DEFAULT_SYNC_INTERVAL_HOURS,
} from '../types/integration';
import {
  Plug,
  Plus,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Settings,
  Clock,
  AlertTriangle,
  Download,
} from 'lucide-react';

type ViewMode = 'list' | 'create' | 'edit' | 'preview' | 'history';

export default function IntegrationsPage() {
  const { session, organization, user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedConnection, setSelectedConnection] = useState<IntegrationConnection | null>(null);
  const [preview, setPreview] = useState<SyncPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const connections = useMemo(() => {
    if (!session || !organization) return [];
    return integrationStore.getAll(organization.id, session);
  }, [session, organization, refreshKey]);

  const syncHistories = useMemo(() => {
    if (!session || !organization || !selectedConnection) return [];
    return syncHistoryStore
      .getByConnection(selectedConnection.id, organization.id, session)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }, [session, organization, selectedConnection, refreshKey]);

  const refresh = () => setRefreshKey(k => k + 1);

  const handleTestConnection = async (connection: IntegrationConnection, credentials: Record<string, any>) => {
    setLoading(true);
    setError(null);
    try {
      const result = await syncService.testConnection(connection, credentials);
      if (result.success) {
        // Обновляем статус подключения
        if (session && organization) {
          integrationStore.update(connection.id, {
            status: 'ready_for_preview',
            credentialsStatus: 'set',
          }, organization.id, session);
          refresh();
        }
        return { success: true, message: 'Соединение успешно' };
      } else {
        if (session && organization) {
          integrationStore.update(connection.id, {
            status: 'verification_failed',
            lastErrorMessage: result.message,
          }, organization.id, session);
          refresh();
        }
        return { success: false, message: result.message };
      }
    } catch (err) {
      return { success: false, message: (err as Error).message };
    } finally {
      setLoading(false);
    }
  };

  const handleFetchPreview = async (connection: IntegrationConnection, credentials: Record<string, any>) => {
    if (!session || !organization) return;
    
    setLoading(true);
    setError(null);
    try {
      const result = await syncService.fetchPreview(connection, credentials, organization.id, session);
      setPreview(result);
      setViewMode('preview');
      
      integrationStore.update(connection.id, {
        status: 'ready_for_sync',
      }, organization.id, session);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteSync = async (connection: IntegrationConnection, credentials: Record<string, any>) => {
    if (!session || !organization || !user) return;
    
    setLoading(true);
    setError(null);
    try {
      const history = await syncService.executeSync(
        connection,
        credentials,
        organization.id,
        session,
        'manual',
        user.id
      );
      
      syncHistoryStore.create(history);
      
      if (history.status === 'success' || history.status === 'success_with_warnings') {
        integrationStore.update(connection.id, {
          lastSuccessfulSync: history.completedAt,
          lastSyncDurationMs: history.durationMs,
          status: 'ready_for_sync',
        }, organization.id, session);
      } else {
        integrationStore.update(connection.id, {
          lastAttemptAt: history.completedAt,
          lastErrorMessage: history.errorMessage,
          status: 'temporarily_unavailable',
        }, organization.id, session);
      }
      
      refresh();
      setViewMode('history');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Plug className="w-6 h-6" />
            Интеграции
          </h1>
          <p className="text-blue-200/60 mt-1">Подключение к внешним источникам данных</p>
        </div>
        {viewMode === 'list' && (
          <button
            onClick={() => setViewMode('create')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition"
          >
            <Plus className="w-4 h-4" /> Новое подключение
          </button>
        )}
      </div>

      {/* Предупреждение о демо-режиме */}
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
        <p className="text-yellow-200 text-sm">
          <AlertTriangle className="w-4 h-4 inline mr-1" />
          <strong>Демонстрационный режим:</strong> Реальное подключение к 1С требует серверной архитектуры. 
          Текущая реализация использует mock-адаптер для демонстрации возможностей.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {viewMode === 'list' && (
        <ConnectionsList
          connections={connections}
          onSelect={(c) => { setSelectedConnection(c); setViewMode('edit'); }}
          onViewHistory={(c) => { setSelectedConnection(c); setViewMode('history'); }}
        />
      )}

      {viewMode === 'create' && (
        <ConnectionForm
          onSubmit={async (connection, credentials) => {
            if (!session || !organization || !user) return;
            
            const newConnection: IntegrationConnection = {
              ...connection,
              id: generateId('int'),
              organizationId: organization.id,
              status: 'not_configured',
              credentialsStatus: 'not_set',
              syncPaused: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              createdBy: user.id,
            };
            
            integrationStore.create(newConnection);
            setSelectedConnection(newConnection);
            
            // Тестируем соединение
            const result = await handleTestConnection(newConnection, credentials);
            if (result.success) {
              await handleFetchPreview(newConnection, credentials);
            }
          }}
          onCancel={() => setViewMode('list')}
        />
      )}

      {viewMode === 'edit' && selectedConnection && (
        <ConnectionEdit
          connection={selectedConnection}
          onTest={async (credentials) => handleTestConnection(selectedConnection, credentials)}
          onPreview={async (credentials) => handleFetchPreview(selectedConnection, credentials)}
          onSync={async (credentials) => handleExecuteSync(selectedConnection, credentials)}
          onBack={() => { setViewMode('list'); setSelectedConnection(null); }}
        />
      )}

      {viewMode === 'preview' && preview && selectedConnection && (
        <SyncPreviewView
          preview={preview}
          connection={selectedConnection}
          onConfirm={async (credentials) => {
            await handleExecuteSync(selectedConnection, credentials);
            setPreview(null);
          }}
          onBack={() => { setViewMode('edit'); setPreview(null); }}
        />
      )}

      {viewMode === 'history' && selectedConnection && (
        <SyncHistoryView
          connection={selectedConnection}
          histories={syncHistories}
          onBack={() => { setViewMode('list'); setSelectedConnection(null); }}
        />
      )}

      {loading && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-white/10 rounded-2xl p-8 flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-white">Выполняется операция...</p>
          </div>
        </div>
      )}
    </div>
  );
}

// === Компоненты ===

function ConnectionsList({
  connections,
  onSelect,
  onViewHistory,
}: {
  connections: IntegrationConnection[];
  onSelect: (c: IntegrationConnection) => void;
  onViewHistory: (c: IntegrationConnection) => void;
}) {
  if (connections.length === 0) {
    return (
      <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-12 text-center">
        <Plug className="w-12 h-12 text-white/20 mx-auto mb-4" />
        <p className="text-white/40 mb-2">Нет настроенных подключений</p>
        <p className="text-white/30 text-sm">Создайте первое подключение к источнику данных</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {connections.map((conn) => (
        <div
          key={conn.id}
          className="bg-white/5 backdrop-blur rounded-xl border border-white/10 p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                conn.status === 'ready_for_sync' ? 'bg-green-500/20 text-green-300' :
                conn.status === 'verification_failed' ? 'bg-red-500/20 text-red-300' :
                'bg-yellow-500/20 text-yellow-300'
              }`}>
                <Plug className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-white font-medium">{conn.name}</h3>
                <p className="text-white/40 text-xs">
                  {conn.sourceType === 'onec_odata' ? '1С (OData)' : 
                   conn.sourceType === 'custom_http' ? 'HTTP API' : 'Ручной импорт'}
                  {' • '}{conn.endpoint}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded text-xs ${
                conn.status === 'ready_for_sync' ? 'bg-green-500/20 text-green-300' :
                conn.status === 'verification_failed' ? 'bg-red-500/20 text-red-300' :
                'bg-yellow-500/20 text-yellow-300'
              }`}>
                {CONNECTION_STATUS_LABELS[conn.status]}
              </span>
              <button
                onClick={() => onSelect(conn)}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition"
                title="Настроить"
              >
                <Settings className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={() => onViewHistory(conn)}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition"
                title="История"
              >
                <Clock className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
          {conn.lastSuccessfulSync && (
            <p className="text-white/40 text-xs mt-2">
              Последняя успешная синхронизация: {formatDate(conn.lastSuccessfulSync)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function ConnectionForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (connection: Omit<IntegrationConnection, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'createdBy'>, credentials: Record<string, any>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [sourceType, setSourceType] = useState<DataSourceType>('onec_odata');
  const [endpoint, setEndpoint] = useState('');
  const [authType, setAuthType] = useState<'basic' | 'bearer' | 'apikey'>('basic');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [scheduleInterval, setScheduleInterval] = useState(DEFAULT_SYNC_INTERVAL_HOURS);

  const handleSubmit = () => {
    if (!name || !endpoint) return;
    
    const credentials: Record<string, any> = {};
    if (authType === 'basic') {
      credentials.username = username;
      credentials.password = password;
    } else if (authType === 'bearer') {
      credentials.bearerToken = password;
    } else {
      credentials.apiKey = password;
    }
    
    onSubmit({
      name,
      sourceType,
      endpoint,
      scheduleIntervalHours: scheduleInterval,
      status: 'not_configured',
      config: {},
      syncPaused: false,
      credentialsStatus: 'not_set',
    }, credentials);
  };

  return (
    <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6 space-y-4">
      <h3 className="text-lg font-semibold text-white">Новое подключение</h3>
      
      <div>
        <label className="block text-sm text-white/60 mb-1">Название подключения</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Основная база 1С"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
        />
      </div>

      <div>
        <label className="block text-sm text-white/60 mb-1">Тип источника</label>
        <select
          value={sourceType}
          onChange={e => setSourceType(e.target.value as DataSourceType)}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
        >
          <option value="onec_odata" className="bg-slate-800">1С (OData REST)</option>
          <option value="custom_http" className="bg-slate-800">Пользовательский HTTP API</option>
        </select>
      </div>

      <div>
        <label className="block text-sm text-white/60 mb-1">Endpoint URL</label>
        <input
          value={endpoint}
          onChange={e => setEndpoint(e.target.value)}
          placeholder="https://1c.example.com/odata/standard.1c_exchange"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
        />
      </div>

      <div>
        <label className="block text-sm text-white/60 mb-1">Тип аутентификации</label>
        <select
          value={authType}
          onChange={e => setAuthType(e.target.value as any)}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
        >
          <option value="basic" className="bg-slate-800">Basic (логин/пароль)</option>
          <option value="bearer" className="bg-slate-800">Bearer Token</option>
          <option value="apikey" className="bg-slate-800">API Key</option>
        </select>
      </div>

      {authType === 'basic' ? (
        <>
          <div>
            <label className="block text-sm text-white/60 mb-1">Логин</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
            />
          </div>
        </>
      ) : (
        <div>
          <label className="block text-sm text-white/60 mb-1">
            {authType === 'bearer' ? 'Bearer Token' : 'API Key'}
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
          />
        </div>
      )}

      <div>
        <label className="block text-sm text-white/60 mb-1">Интервал синхронизации</label>
        <select
          value={scheduleInterval}
          onChange={e => setScheduleInterval(parseInt(e.target.value))}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
        >
          {SYNC_SCHEDULE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
        <p className="text-yellow-200 text-xs">
          <AlertTriangle className="w-3 h-3 inline mr-1" />
          Учётные данные хранятся только на сервере и не отображаются после сохранения.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-lg text-sm hover:bg-white/10 transition"
        >
          Отмена
        </button>
        <button
          onClick={handleSubmit}
          disabled={!name || !endpoint}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-lg text-sm transition"
        >
          Создать и проверить
        </button>
      </div>
    </div>
  );
}

function ConnectionEdit({
  connection,
  onTest,
  onPreview,
  onSync,
  onBack,
}: {
  connection: IntegrationConnection;
  onTest: (credentials: Record<string, any>) => Promise<{ success: boolean; message: string }>;
  onPreview: (credentials: Record<string, any>) => void;
  onSync: (credentials: Record<string, any>) => void;
  onBack: () => void;
}) {
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [password, setPassword] = useState('');

  const credentials = { password }; // В демо-режиме используем введённый пароль

  return (
    <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">{connection.name}</h3>
        <button
          onClick={onBack}
          className="text-white/60 hover:text-white text-sm"
        >
          ← Назад
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-white/40">Тип источника</p>
          <p className="text-white">{connection.sourceType === 'onec_odata' ? '1С (OData)' : 'HTTP API'}</p>
        </div>
        <div>
          <p className="text-white/40">Endpoint</p>
          <p className="text-white truncate">{connection.endpoint}</p>
        </div>
        <div>
          <p className="text-white/40">Статус</p>
          <p className="text-white">{CONNECTION_STATUS_LABELS[connection.status]}</p>
        </div>
        <div>
          <p className="text-white/40">Учётные данные</p>
          <p className="text-white">
            {connection.credentialsStatus === 'set' ? '✓ Сохранены' : 'Не установлены'}
          </p>
        </div>
      </div>

      <div>
        <label className="block text-sm text-white/60 mb-1">Пароль для операций</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Введите пароль для тестирования"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
        />
      </div>

      {testResult && (
        <div className={`p-3 rounded-lg ${
          testResult.success ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'
        }`}>
          <p className={`text-sm ${testResult.success ? 'text-green-300' : 'text-red-300'}`}>
            {testResult.success ? <CheckCircle className="w-4 h-4 inline mr-1" /> : <XCircle className="w-4 h-4 inline mr-1" />}
            {testResult.message}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={async () => {
            const result = await onTest(credentials);
            setTestResult(result);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white rounded-lg text-sm hover:bg-white/10 transition"
        >
          <CheckCircle className="w-4 h-4" /> Проверить соединение
        </button>
        <button
          onClick={() => onPreview(credentials)}
          disabled={connection.status !== 'ready_for_preview' && connection.status !== 'ready_for_sync'}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 text-blue-300 rounded-lg text-sm hover:bg-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <Download className="w-4 h-4" /> Предпросмотр
        </button>
        <button
          onClick={() => onSync(credentials)}
          disabled={connection.status !== 'ready_for_sync'}
          className="flex items-center gap-2 px-4 py-2 bg-green-600/20 text-green-300 rounded-lg text-sm hover:bg-green-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <RefreshCw className="w-4 h-4" /> Запустить синхронизацию
        </button>
      </div>
    </div>
  );
}

function SyncPreviewView({
  preview,
  connection,
  onConfirm,
  onBack,
}: {
  preview: SyncPreview;
  connection: IntegrationConnection;
  onConfirm: (credentials: Record<string, any>) => void;
  onBack: () => void;
}) {
  const [password, setPassword] = useState('');

  return (
    <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Предпросмотр синхронизации</h3>
        <button onClick={onBack} className="text-white/60 hover:text-white text-sm">← Назад</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox label="Контрагентов" value={preview.totalCounterparties} />
        <StatBox label="Записей задолженности" value={preview.totalReceivables} />
        <StatBox label="Новых" value={preview.newReceivables} color="green" />
        <StatBox label="Будет обновлено" value={preview.updatedReceivables} color="yellow" />
        <StatBox label="Без изменений" value={preview.unchangedReceivables} />
        <StatBox label="С ошибками" value={preview.errorRecords} color="red" />
        <StatBox label="Без срока оплаты" value={preview.noDueDateRecords} color="gray" />
        <StatBox
          label="Общая сумма"
          value={formatCurrency(preview.totalOutstandingAmountCents)}
          color="blue"
        />
      </div>

      {preview.errors.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <p className="text-red-300 text-sm font-medium mb-2">Ошибки ({preview.errors.length}):</p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {preview.errors.slice(0, 10).map((err, i) => (
              <p key={i} className="text-red-200/70 text-xs">
                {err.externalId && `[${err.externalId}] `}{err.message}
              </p>
            ))}
          </div>
        </div>
      )}

      {preview.warnings.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
          <p className="text-yellow-300 text-sm font-medium mb-2">Предупреждения:</p>
          <ul className="list-disc list-inside text-yellow-200/70 text-xs space-y-1">
            {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      <div>
        <p className="text-white/60 text-sm mb-2">Примеры контрагентов:</p>
        <div className="space-y-1">
          {preview.sampleCounterparties.slice(0, 5).map((cp, i) => (
            <div key={i} className="text-white/70 text-xs bg-white/5 rounded px-2 py-1">
              {cp.name} {cp.inn && `(ИНН: ${cp.inn})`}
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm text-white/60 mb-1">Пароль для подтверждения</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
        />
      </div>

      <button
        onClick={() => onConfirm({ password })}
        disabled={preview.errorRecords > 0 && preview.newReceivables === 0}
        className="w-full py-2 bg-green-600 hover:bg-green-500 disabled:bg-green-800 text-white rounded-lg text-sm transition"
      >
        Подтвердить синхронизацию
      </button>
    </div>
  );
}

function SyncHistoryView({
  connection,
  histories,
  onBack,
}: {
  connection: IntegrationConnection;
  histories: SyncHistory[];
  onBack: () => void;
}) {
  return (
    <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">История синхронизаций</h3>
        <button onClick={onBack} className="text-white/60 hover:text-white text-sm">← Назад</button>
      </div>

      {histories.length === 0 ? (
        <p className="text-white/40 text-sm">Нет истории синхронизаций</p>
      ) : (
        <div className="space-y-3">
          {histories.map((h) => (
            <div key={h.id} className="bg-white/5 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {h.status === 'success' && <CheckCircle className="w-4 h-4 text-green-400" />}
                  {h.status === 'failed' && <XCircle className="w-4 h-4 text-red-400" />}
                  {h.status === 'running' && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
                  <span className="text-white text-sm font-medium">
                    {SYNC_STATUS_LABELS[h.status]}
                  </span>
                  <span className="text-white/40 text-xs">
                    ({h.trigger === 'manual' ? 'вручную' : h.trigger === 'scheduled' ? 'планово' : 'первично'})
                  </span>
                </div>
                <span className="text-white/40 text-xs">{formatDate(h.startedAt)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-white/60">
                <div>Обработано: <span className="text-white">{h.totalRecords}</span></div>
                <div>Новых: <span className="text-green-300">{h.newRecords}</span></div>
                <div>Обновлено: <span className="text-yellow-300">{h.updatedRecords}</span></div>
                <div>Ошибок: <span className="text-red-300">{h.errorRecords}</span></div>
                <div>Сумма: <span className="text-white">{formatCurrency(h.totalOutstandingAmountCents)}</span></div>
                {h.durationMs && <div>Длительность: <span className="text-white">{(h.durationMs / 1000).toFixed(1)}с</span></div>}
              </div>
              {h.errorMessage && (
                <p className="text-red-300 text-xs mt-2">Ошибка: {h.errorMessage}</p>
              )}
              {h.summary && (
                <p className="text-white/60 text-xs mt-2">{h.summary}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color = 'white' }: { label: string; value: string | number; color?: string }) {
  const colorClasses: Record<string, string> = {
    white: 'text-white',
    green: 'text-green-300',
    yellow: 'text-yellow-300',
    red: 'text-red-300',
    blue: 'text-blue-300',
    gray: 'text-gray-300',
  };

  return (
    <div className="bg-white/5 rounded-lg p-3">
      <p className="text-white/40 text-xs mb-1">{label}</p>
      <p className={`text-lg font-bold ${colorClasses[color]}`}>{value}</p>
    </div>
  );
}
