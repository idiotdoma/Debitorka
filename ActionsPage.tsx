import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { debtStore, contactStore } from '../lib/store';
import { formatCurrency, formatDate, generateId } from '../lib/calculations';
import { DebtRecord, ContactInfo } from '../types/models';
import { Phone, Mail, User, Plus, Target, ArrowRight } from 'lucide-react';

export default function ActionsPage() {
  const { session, organization, user } = useAuth();
  const [selectedDebt, setSelectedDebt] = React.useState<DebtRecord | null>(null);
  const [showContactForm, setShowContactForm] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const debts = React.useMemo(() => {
    if (!session || !organization) return [];
    return debtStore.getAll(organization.id, session).filter(d => d.overdueDays !== null && d.overdueDays > 0);
  }, [session, organization, refreshKey]);

  const contacts = React.useMemo(() => {
    if (!session || !organization || !selectedDebt) return [];
    return contactStore.getByDebt(selectedDebt.id, organization.id, session);
  }, [session, organization, selectedDebt, refreshKey]);

  const refresh = () => setRefreshKey(k => k + 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Контакты по задолженностям</h1>
        <p className="text-blue-200/60 mt-1">Управление контактами по просроченным задолженностям</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Debt selector */}
        <div className="lg:col-span-1">
          <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-4">
            <h3 className="text-sm font-medium text-white mb-3">Просроченные записи</h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {debts.length === 0 ? (
                <p className="text-white/40 text-sm">Нет просроченных задолженностей</p>
              ) : (
                debts.map(debt => (
                  <button
                    key={debt.id}
                    onClick={() => setSelectedDebt(debt)}
                    className={`w-full text-left p-3 rounded-xl transition ${
                      selectedDebt?.id === debt.id ? 'bg-blue-600/30 border border-blue-500/50' : 'bg-white/5 hover:bg-white/10 border border-transparent'
                    }`}
                  >
                    <p className="text-white text-sm font-medium truncate">{debt.counterpartyName}</p>
                    <p className="text-white/40 text-xs">{formatCurrency(debt.amountCents)} • {debt.overdueDays} дн. просрочки</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedDebt ? (
            <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-12 text-center">
              <Target className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/40">Выберите запись для управления контактами</p>
            </div>
          ) : (
            <>
              {/* Debt info */}
              <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-medium">{selectedDebt.counterpartyName}</h3>
                    <p className="text-white/40 text-sm">
                      {formatCurrency(selectedDebt.amountCents)} • Просрочка: {selectedDebt.overdueDays} дн. • Документ: {selectedDebt.docNumber}
                    </p>
                  </div>
                </div>
              </div>

              {/* Contacts */}
              <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-white flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-400" /> Контакты
                  </h3>
                  <button
                    onClick={() => setShowContactForm(true)}
                    className="text-xs px-2 py-1 bg-blue-600/20 text-blue-300 rounded-lg hover:bg-blue-600/30 transition"
                  >
                    <Plus className="w-3 h-3 inline mr-1" />Добавить
                  </button>
                </div>
                {contacts.length === 0 ? (
                  <p className="text-white/30 text-xs">Нет контактов</p>
                ) : (
                  <div className="space-y-2">
                    {contacts.map(c => (
                      <div key={c.id} className="flex items-center gap-3 bg-white/5 rounded-lg p-2">
                        <div className="flex-1">
                          <p className="text-white text-sm">{c.contactName} {c.position && <span className="text-white/40">({c.position})</span>}</p>
                          <div className="flex gap-3 text-xs text-white/40">
                            {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                            {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Contact form modal */}
      {showContactForm && selectedDebt && session && organization && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Добавить контакт</h3>
              <button onClick={() => setShowContactForm(false)} className="text-white/40 hover:text-white transition">✕</button>
            </div>
            <ContactFormInner
              debtRecordId={selectedDebt.id}
              organizationId={organization.id}
              onSaved={() => { setShowContactForm(false); refresh(); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ContactFormInner({ debtRecordId, organizationId, onSaved }: {
  debtRecordId: string; organizationId: string; onSaved: () => void;
}) {
  const [name, setName] = React.useState('');
  const [position, setPosition] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');

  const handleSave = () => {
    if (!name.trim()) return;
    const contact: ContactInfo = {
      id: generateId('contact'),
      debtRecordId,
      organizationId,
      contactName: name,
      position: position || undefined,
      phone: phone || undefined,
      email: email || undefined,
      createdAt: new Date().toISOString(),
    };
    contactStore.create(contact);
    onSaved();
  };

  return (
    <div className="space-y-3">
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Имя контакта *" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30" />
      <input value={position} onChange={e => setPosition(e.target.value)} placeholder="Должность" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30" />
      <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Телефон" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30" />
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30" />
      <button onClick={handleSave} disabled={!name.trim()} className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-lg text-sm transition">Сохранить</button>
    </div>
  );
}
