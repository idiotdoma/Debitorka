import React, { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { importStore, userStore } from '../lib/store';
import { formatDate } from '../lib/calculations';
import { FileSpreadsheet, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

export default function HistoryPage() {
  const { session, organization } = useAuth();

  const imports = useMemo(() => {
    if (!session || !organization) return [];
    return importStore.getAll(organization.id, session).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [session, organization]);

  const users = useMemo(() => {
    if (!session || !organization) return [];
    return userStore.getByOrganization(organization.id, session);
  }, [session, organization]);

  const getUserName = (userId: string) => {
    return users.find(u => u.id === userId)?.name || 'Неизвестный';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">История импортов</h1>
        <p className="text-blue-200/60 mt-1">Журнал всех загрузок файлов</p>
      </div>

      {imports.length === 0 ? (
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-12 text-center">
          <FileSpreadsheet className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/40">Нет импортов. Загрузите первый файл на странице «Импорт».</p>
        </div>
      ) : (
        <div className="space-y-4">
          {imports.map(batch => (
            <div key={batch.id} className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    batch.status === 'completed' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                  }`}>
                    {batch.status === 'completed' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-white font-medium">{batch.fileName}</h3>
                    <p className="text-white/40 text-xs">
                      {formatDate(batch.createdAt)} • {getUserName(batch.importedBy)}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  batch.status === 'completed' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                }`}>
                  {batch.status === 'completed' ? 'Успешно' : 'Ошибка'}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-3 mb-3">
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-white">{batch.rowCount}</p>
                  <p className="text-xs text-white/40">Строк</p>
                </div>
                <div className="bg-green-500/10 rounded-lg p-3 text-center border border-green-500/20">
                  <p className="text-lg font-bold text-green-300">{batch.successCount}</p>
                  <p className="text-xs text-green-300/60">Импортировано</p>
                </div>
                <div className="bg-red-500/10 rounded-lg p-3 text-center border border-red-500/20">
                  <p className="text-lg font-bold text-red-300">{batch.errorCount}</p>
                  <p className="text-xs text-red-300/60">Ошибок</p>
                </div>
                <div className="bg-yellow-500/10 rounded-lg p-3 text-center border border-yellow-500/20">
                  <p className="text-lg font-bold text-yellow-300">{batch.duplicateCount}</p>
                  <p className="text-xs text-yellow-300/60">Дубликатов</p>
                </div>
              </div>

              {batch.errors.length > 0 && (
                <details className="mt-2">
                  <summary className="text-sm text-white/50 cursor-pointer hover:text-white/70 transition">
                    <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                    Показать ошибки ({batch.errors.length})
                  </summary>
                  <div className="mt-2 bg-red-500/5 border border-red-500/10 rounded-lg p-3 max-h-[200px] overflow-y-auto">
                    {batch.errors.map((err, i) => (
                      <p key={i} className="text-xs text-red-200/70 py-0.5">
                        Строка {err.row}: {err.message} {err.value ? `«${err.value}»` : ''}
                      </p>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
