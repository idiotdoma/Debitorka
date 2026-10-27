import React, { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { parseFile, mapHeaders, createPreview, executeImport, downloadTemplate, validateFileSize, validateFileExtension, findMissingFromSource } from '../lib/importService';
import { ImportPreviewRow, ImportBatch } from '../types/models';
import { formatCurrency } from '../lib/calculations';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, ArrowRight, Download, RefreshCw } from 'lucide-react';

type ImportStep = 'upload' | 'mapping' | 'preview' | 'result';

export default function ImportPage() {
  const { session, organization, user } = useAuth();
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headerMapping, setHeaderMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<ImportPreviewRow[]>([]);
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [missingRecords, setMissingRecords] = useState<number>(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    
    setError('');
    
    const sizeError = validateFileSize(uploadedFile);
    if (sizeError) {
      setError(sizeError);
      return;
    }
    
    const extError = validateFileExtension(uploadedFile);
    if (extError) {
      setError(extError);
      return;
    }
    
    setLoading(true);
    
    try {
      const { headers, rows } = await parseFile(uploadedFile);
      setFile(uploadedFile);
      setHeaders(headers);
      setRows(rows);
      
      const mapping = mapHeaders(headers);
      setHeaderMapping(mapping);
      setStep('mapping');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleProceedToPreview = useCallback(() => {
    if (!session || !organization) return;
    
    const mappedFields = new Set(Object.values(headerMapping));
    const requiredFields = ['counterpartyName', 'docNumber', 'amountCents'];
    const missing = requiredFields.filter(f => !mappedFields.has(f));
    
    if (missing.length > 0) {
      const fieldNames: Record<string, string> = {
        counterpartyName: 'Контрагент',
        docNumber: 'Номер документа',
        amountCents: 'Сумма',
      };
      setError(`Не указаны обязательные поля: ${missing.map(f => fieldNames[f]).join(', ')}`);
      return;
    }
    
    const previewData = createPreview(rows, headerMapping, organization.id, session);
    setPreview(previewData);
    
    const missingFromSource = findMissingFromSource(previewData, organization.id, session);
    setMissingRecords(missingFromSource.length);
    
    setStep('preview');
    setError('');
  }, [rows, headerMapping, session, organization]);

  const handleExecuteImport = useCallback(() => {
    if (!session || !organization || !user || !file) return;
    
    setLoading(true);
    try {
      const result = executeImport(file, preview, organization.id, session, user.id);
      setBatch(result);
      setStep('result');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [file, preview, session, organization, user]);

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setHeaders([]);
    setRows([]);
    setHeaderMapping({});
    setPreview([]);
    setBatch(null);
    setMissingRecords(0);
    setError('');
  };

  const availableFields = [
    { value: '', label: '— пропустить —' },
    { value: 'counterpartyName', label: 'Контрагент *' },
    { value: 'counterpartyINN', label: 'ИНН' },
    { value: 'docNumber', label: 'Номер документа *' },
    { value: 'docDate', label: 'Дата документа' },
    { value: 'dueDate', label: 'Срок оплаты' },
    { value: 'amountCents', label: 'Сумма задолженности *' },
    { value: 'currency', label: 'Валюта' },
    { value: 'ownerEmail', label: 'Ответственный (email)' },
  ];

  const changeTypeLabels: Record<string, { label: string; color: string }> = {
    new: { label: 'Новый', color: 'text-green-300' },
    updated_amount: { label: 'Изменена сумма', color: 'text-yellow-300' },
    updated_due_date: { label: 'Изменён срок', color: 'text-blue-300' },
    unchanged: { label: 'Без изменений', color: 'text-white/40' },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Импорт задолженности</h1>
          <p className="text-blue-200/60 mt-1">Загрузите Excel или CSV файл с данными о дебиторской задолженности</p>
        </div>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm hover:bg-white/10 transition"
        >
          <Download className="w-4 h-4" />
          Скачать шаблон
        </button>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <p className="text-blue-200 text-sm font-medium mb-2">Инструкция по импорту:</p>
        <ul className="text-blue-200/70 text-xs space-y-1">
          <li>• Обязательные поля: Контрагент, Номер документа, Сумма задолженности</li>
          <li>• Формат дат: ГГГГ-ММ-ДД или ДД.ММ.ГГГГ</li>
          <li>• Сумма: число с точкой или запятой как десятичным разделителем</li>
          <li>• Срок оплаты — опционален (если отсутствует, документ получит категорию «Срок не указан»)</li>
          <li>• Поддерживается только RUB</li>
          <li>• Максимальный размер файла: 10 МБ</li>
        </ul>
      </div>

      <div className="flex items-center gap-2">
        {(['upload', 'mapping', 'preview', 'result'] as ImportStep[]).map((s, i) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
              step === s ? 'bg-blue-600 text-white' :
              (['upload', 'mapping', 'preview', 'result'].indexOf(step) > i) ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' :
              'bg-white/5 text-white/30'
            }`}>
              {i + 1}. {s === 'upload' ? 'Загрузка' : s === 'mapping' ? 'Соответствие' : s === 'preview' ? 'Предпросмотр' : 'Результат'}
            </div>
            {i < 3 && <ArrowRight className="w-4 h-4 text-white/20" />}
          </React.Fragment>
        ))}
      </div>

      {step === 'upload' && (
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-8">
          <div className="text-center">
            <Upload className="w-12 h-12 text-blue-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Загрузите файл</h3>
            <p className="text-white/40 text-sm mb-6">Поддерживаются форматы: .xlsx, .xls, .csv (макс. 10 МБ)</p>
            
            <label className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl cursor-pointer transition">
              <FileSpreadsheet className="w-5 h-5" />
              Выбрать файл
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            
            {loading && <p className="text-blue-300 mt-4">Чтение файла...</p>}
            {error && <p className="text-red-300 mt-4">{error}</p>}
          </div>
        </div>
      )}

      {step === 'mapping' && (
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
          <h3 className="text-lg font-medium text-white mb-4">Соответствие столбцов</h3>
          <p className="text-white/40 text-sm mb-4">
            Файл: <span className="text-white">{file?.name}</span> ({rows.length} строк)
          </p>
          
          <div className="space-y-3">
            {headers.map(header => (
              <div key={header} className="flex items-center gap-4">
                <div className="w-48 text-white/70 text-sm truncate" title={header}>
                  <span className="text-white/40">Столбец:</span> {header}
                </div>
                <ArrowRight className="w-4 h-4 text-white/20" />
                <select
                  value={headerMapping[header] || ''}
                  onChange={e => {
                    const newMapping = { ...headerMapping };
                    if (e.target.value) {
                      newMapping[header] = e.target.value;
                    } else {
                      delete newMapping[header];
                    }
                    setHeaderMapping(newMapping);
                  }}
                  className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableFields.map(f => (
                    <option key={f.value} value={f.value} className="bg-slate-800">{f.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {error && <p className="text-red-300 mt-4 text-sm">{error}</p>}

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => { setStep('upload'); setError(''); }}
              className="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition text-sm"
            >
              Назад
            </button>
            <button
              onClick={handleProceedToPreview}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition text-sm"
            >
              Предпросмотр →
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-white">Предпросмотр импорта</h3>
            <div className="flex gap-4 text-sm flex-wrap">
              <span className="text-green-300">✓ {preview.filter(p => p.valid && !p.existingRecordId).length} новых</span>
              <span className="text-yellow-300">↻ {preview.filter(p => p.valid && p.existingRecordId).length} обновлений</span>
              <span className="text-red-300">✗ {preview.filter(p => !p.valid).length} ошибок</span>
              {missingRecords > 0 && (
                <span className="text-orange-300">⚠ {missingRecords} отсутствуют в файле</span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-800/90 backdrop-blur">
                <tr>
                  <th className="text-left px-3 py-2 text-white/60">Строка</th>
                  <th className="text-left px-3 py-2 text-white/60">Контрагент</th>
                  <th className="text-left px-3 py-2 text-white/60">№ документа</th>
                  <th className="text-left px-3 py-2 text-white/60">Сумма</th>
                  <th className="text-left px-3 py-2 text-white/60">Статус</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 50).map((row, i) => (
                  <tr key={i} className={`border-b border-white/5 ${!row.valid ? 'bg-red-500/5' : ''}`}>
                    <td className="px-3 py-2 text-white/40">{row.rowNumber}</td>
                    <td className="px-3 py-2 text-white">{row.data.counterpartyName || '—'}</td>
                    <td className="px-3 py-2 text-white/70">{row.data.docNumber || '—'}</td>
                    <td className="px-3 py-2 text-white">{row.data.amountCents ? formatCurrency(parseInt(row.data.amountCents)) : '—'}</td>
                    <td className="px-3 py-2">
                      {row.valid ? (
                        row.changeType ? (
                          <span className={changeTypeLabels[row.changeType]?.color || 'text-white/40'}>
                            {changeTypeLabels[row.changeType]?.label || row.changeType}
                          </span>
                        ) : (
                          <span className="text-green-300 flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Новый
                          </span>
                        )
                      ) : (
                        <span className="text-red-300 flex items-center gap-1" title={row.errors.map(e => e.message).join('; ')}>
                          <XCircle className="w-3.5 h-3.5" /> {row.errors.length} ошиб.
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 50 && (
              <p className="text-white/40 text-xs text-center py-2">...и ещё {preview.length - 50} строк</p>
            )}
          </div>

          {missingRecords > 0 && (
            <div className="mt-4 bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
              <p className="text-orange-200 text-sm">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                {missingRecords} документов из предыдущей выгрузки отсутствуют в этом файле. 
                Они не будут удалены, но рекомендуется проверить.
              </p>
            </div>
          )}

          {error && <p className="text-red-300 mt-4 text-sm">{error}</p>}

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => { setStep('mapping'); setError(''); }}
              className="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition text-sm"
            >
              Назад
            </button>
            <button
              onClick={handleExecuteImport}
              disabled={loading || preview.filter(p => p.valid).length === 0}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:cursor-not-allowed text-white rounded-xl transition text-sm flex items-center gap-2"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Импорт...' : `Импортировать ${preview.filter(p => p.valid).length} записей`}
            </button>
          </div>
        </div>
      )}

      {step === 'result' && batch && (
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
          <div className="text-center mb-6">
            <CheckCircle className={`w-16 h-16 mx-auto mb-4 ${batch.status === 'completed' ? 'text-green-400' : 'text-red-400'}`} />
            <h3 className="text-xl font-bold text-white">
              {batch.status === 'completed' ? 'Импорт завершён' : 'Импорт не удался'}
            </h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-white">{batch.rowCount}</p>
              <p className="text-xs text-white/40">Всего строк</p>
            </div>
            <div className="bg-green-500/10 rounded-xl p-4 text-center border border-green-500/20">
              <p className="text-2xl font-bold text-green-300">{batch.newCount}</p>
              <p className="text-xs text-green-300/60">Новых</p>
            </div>
            <div className="bg-yellow-500/10 rounded-xl p-4 text-center border border-yellow-500/20">
              <p className="text-2xl font-bold text-yellow-300">{batch.updatedCount}</p>
              <p className="text-xs text-yellow-300/60">Обновлено</p>
            </div>
            <div className="bg-red-500/10 rounded-xl p-4 text-center border border-red-500/20">
              <p className="text-2xl font-bold text-red-300">{batch.errorCount}</p>
              <p className="text-xs text-red-300/60">Ошибки</p>
            </div>
            <div className="bg-orange-500/10 rounded-xl p-4 text-center border border-orange-500/20">
              <p className="text-2xl font-bold text-orange-300">{batch.missingFromSource}</p>
              <p className="text-xs text-orange-300/60">Отсутствуют в файле</p>
            </div>
          </div>

          {batch.errors.length > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mb-6">
              <h4 className="text-sm font-medium text-red-300 mb-2">Ошибки:</h4>
              <div className="max-h-[200px] overflow-y-auto space-y-1">
                {batch.errors.slice(0, 20).map((err, i) => (
                  <p key={i} className="text-xs text-red-200/70">
                    Строка {err.row}: {err.message} {err.value ? `(значение: "${err.value}")` : ''}
                  </p>
                ))}
                {batch.errors.length > 20 && (
                  <p className="text-xs text-red-200/50">...и ещё {batch.errors.length - 20} ошибок</p>
                )}
              </div>
            </div>
          )}

          <button
            onClick={handleReset}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition text-sm"
          >
            Импортировать ещё
          </button>
        </div>
      )}
    </div>
  );
}
