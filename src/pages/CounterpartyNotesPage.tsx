import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { debtStore, noteStore } from '../lib/store';
import { formatDate, generateId } from '../lib/calculations';
import { CounterpartyNote } from '../types/models';
import { StickyNote, Plus, Edit2, Trash2, X, Check } from 'lucide-react';

export default function CounterpartyNotesPage() {
  const { session, organization, user } = useAuth();
  const [selectedCounterparty, setSelectedCounterparty] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingNote, setEditingNote] = useState<CounterpartyNote | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const counterparties = useMemo(() => {
    if (!session || !organization) return [];
    const debts = debtStore.getAll(organization.id, session);
    return Array.from(new Set(debts.map(d => d.counterpartyName))).sort();
  }, [session, organization, refreshKey]);

  const notes = useMemo(() => {
    if (!session || !organization || !selectedCounterparty) return [];
    return noteStore.getByCounterparty(selectedCounterparty, organization.id, session)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [session, organization, selectedCounterparty, refreshKey]);

  const refresh = () => setRefreshKey(k => k + 1);

  const handleAddNote = (note: string) => {
    if (!session || !organization || !user || !selectedCounterparty) return;
    
    const newNote: CounterpartyNote = {
      id: generateId('note'),
      organizationId: organization.id,
      counterpartyName: selectedCounterparty,
      note,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    noteStore.create(newNote);
    refresh();
  };

  const handleUpdateNote = (id: string, note: string) => {
    if (!session || !organization) return;
    
    noteStore.update(id, { note }, organization.id, session);
    setEditingNote(null);
    refresh();
  };

  const handleDeleteNote = (id: string) => {
    if (!session || !organization) return;
    if (!confirm('Удалить заметку?')) return;
    
    noteStore.delete(id, organization.id, session);
    refresh();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
          Заметки к контрагентам
        </h1>
        <p className="mt-1 text-gray-600 dark:text-blue-200/60">
          Быстрые заметки и комментарии по контрагентам
        </p>
      </div>

      {/* Выбор контрагента */}
      <div className="card p-6 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">
          Выберите контрагента
        </label>
        <select
          value={selectedCounterparty}
          onChange={(e) => setSelectedCounterparty(e.target.value)}
          className="w-full px-4 py-2 rounded-lg transition-colors bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white focus:border-blue-500"
        >
          <option value="">-- Выберите контрагента --</option>
          {counterparties.map(cp => (
            <option key={cp} value={cp} className="bg-white dark:bg-slate-800">
              {cp}
            </option>
          ))}
        </select>
      </div>

      {/* Заметки */}
      {selectedCounterparty && (
        <div className="card p-6 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
              <StickyNote className="w-5 h-5 text-yellow-500" />
              Заметки: {selectedCounterparty}
            </h3>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Добавить заметку
            </button>
          </div>

          {notes.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-white/40">
              <StickyNote className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Нет заметок для этого контрагента</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map(note => (
                <div
                  key={note.id}
                  className="p-4 rounded-lg border transition-all hover:shadow-md bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm whitespace-pre-wrap text-gray-900 dark:text-white">
                        {note.note}
                      </p>
                      <p className="text-xs mt-2 text-gray-500 dark:text-white/40">
                        {formatDate(note.createdAt)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingNote(note)}
                        className="p-2 rounded-lg transition-colors hover:bg-yellow-100 dark:hover:bg-yellow-900/30 text-gray-600 dark:text-white/60"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="p-2 rounded-lg transition-colors hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Модальное окно добавления заметки */}
      {showAddModal && (
        <NoteModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddNote}
        />
      )}

      {/* Модальное окно редактирования заметки */}
      {editingNote && (
        <NoteModal
          initialNote={editingNote.note}
          onClose={() => setEditingNote(null)}
          onSave={(note) => handleUpdateNote(editingNote.id, note)}
        />
      )}
    </div>
  );
}

function NoteModal({ initialNote = '', onClose, onSave }: {
  initialNote?: string;
  onClose: () => void;
  onSave: (note: string) => void;
}) {
  const [note, setNote] = useState(initialNote);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="card p-6 w-full max-w-md bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {initialNote ? 'Редактировать заметку' : 'Новая заметка'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-white/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Введите заметку..."
          rows={5}
          className="w-full px-4 py-3 rounded-lg resize-none transition-colors bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white focus:border-blue-500"
          autoFocus
        />
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => onSave(note)}
            disabled={!note.trim()}
            className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            Сохранить
          </button>
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
