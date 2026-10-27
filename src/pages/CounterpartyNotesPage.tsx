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

  const isLight = document.documentElement.classList.contains('light');

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className={`text-2xl md:text-3xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
          Заметки к контрагентам
        </h1>
        <p className={`mt-1 ${isLight ? 'text-gray-600' : 'text-blue-200/60'}`}>
          Быстрые заметки и комментарии по контрагентам
        </p>
      </div>

      {/* Выбор контрагента */}
      <div className={`card p-6 ${isLight ? '' : 'bg-white/5 backdrop-blur border-white/10'}`}>
        <label className={`block text-sm font-medium mb-2 ${isLight ? 'text-gray-700' : 'text-white/80'}`}>
          Выберите контрагента
        </label>
        <select
          value={selectedCounterparty}
          onChange={(e) => setSelectedCounterparty(e.target.value)}
          className={`w-full px-4 py-2 rounded-lg transition-colors ${
            isLight
              ? 'bg-white border border-gray-300 text-gray-900 focus:border-blue-500'
              : 'bg-white/5 border border-white/10 text-white focus:border-blue-500'
          }`}
        >
          <option value="">-- Выберите контрагента --</option>
          {counterparties.map(cp => (
            <option key={cp} value={cp} className={isLight ? 'bg-white' : 'bg-slate-800'}>
              {cp}
            </option>
          ))}
        </select>
      </div>

      {/* Заметки */}
      {selectedCounterparty && (
        <div className={`card p-6 ${isLight ? '' : 'bg-white/5 backdrop-blur border-white/10'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-lg font-semibold flex items-center gap-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
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
            <div className={`text-center py-12 ${isLight ? 'text-gray-500' : 'text-white/40'}`}>
              <StickyNote className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Нет заметок для этого контрагента</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map(note => (
                <div
                  key={note.id}
                  className={`p-4 rounded-lg border transition-all hover:shadow-md ${
                    isLight
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-yellow-500/10 border-yellow-500/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className={`text-sm whitespace-pre-wrap ${isLight ? 'text-gray-900' : 'text-white'}`}>
                        {note.note}
                      </p>
                      <p className={`text-xs mt-2 ${isLight ? 'text-gray-500' : 'text-white/40'}`}>
                        {formatDate(note.createdAt)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingNote(note)}
                        className={`p-2 rounded-lg transition-colors ${
                          isLight
                            ? 'hover:bg-yellow-100 text-gray-600'
                            : 'hover:bg-yellow-500/20 text-white/60'
                        }`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          isLight
                            ? 'hover:bg-red-100 text-red-600'
                            : 'hover:bg-red-500/20 text-red-400'
                        }`}
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
          isLight={isLight}
        />
      )}

      {/* Модальное окно редактирования заметки */}
      {editingNote && (
        <NoteModal
          initialNote={editingNote.note}
          onClose={() => setEditingNote(null)}
          onSave={(note) => handleUpdateNote(editingNote.id, note)}
          isLight={isLight}
        />
      )}
    </div>
  );
}

function NoteModal({ initialNote = '', onClose, onSave, isLight }: {
  initialNote?: string;
  onClose: () => void;
  onSave: (note: string) => void;
  isLight: boolean;
}) {
  const [note, setNote] = useState(initialNote);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className={`card p-6 w-full max-w-md ${isLight ? '' : 'bg-slate-800 border-white/10'}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-lg font-semibold ${isLight ? 'text-gray-900' : 'text-white'}`}>
            {initialNote ? 'Редактировать заметку' : 'Новая заметка'}
          </h3>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isLight ? 'hover:bg-gray-100 text-gray-600' : 'hover:bg-white/10 text-white/60'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Введите заметку..."
          rows={5}
          className={`w-full px-4 py-3 rounded-lg resize-none transition-colors ${
            isLight
              ? 'bg-white border border-gray-300 text-gray-900 focus:border-blue-500'
              : 'bg-white/5 border border-white/10 text-white focus:border-blue-500'
          }`}
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
