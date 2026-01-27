import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { Transaction, TransactionType, AccountType, Account, Currency } from '../types';

interface Props {
  onClose: () => void;
  onSubmit: (t: Transaction) => void;
  accounts: Account[];
  categories: string[];
  editData?: Transaction;
}

const TransactionForm: React.FC<Props> = ({ onClose, onSubmit, accounts, categories, editData }) => {
  const [formData, setFormData] = useState<Partial<Transaction>>({
    date: new Date().toISOString().split('T')[0],
    concept: '',
    amount: 0,
    currency: Currency.ARS,
    category: categories[0] || 'Alimentación',
    subcategory: '',
    sourceAccount: accounts[0]?.name || '',
    destinationAccount: '',
    type: TransactionType.EXPENSE,
    isShared: false,
    paidBy: 'Yo'
  });

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editData) setFormData(editData);
  }, [editData]);

  useEffect(() => {
    const acc = accounts.find(a => a.name === formData.sourceAccount);
    if (acc) setFormData(prev => ({ ...prev, currency: acc.currency }));
  }, [formData.sourceAccount, accounts]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.concept) {
      setError("El concepto es obligatorio.");
      return;
    }

    if (!formData.amount || formData.amount <= 0) {
      setError("El monto debe ser mayor a cero.");
      return;
    }

    if ((formData.type === TransactionType.TRANSFER || formData.type === TransactionType.INVESTMENT) && !formData.destinationAccount) {
      setError("Debes seleccionar una cuenta destino.");
      return;
    }

    onSubmit({
      ...formData,
      id: editData?.id || Math.random().toString(36).substr(2, 9),
    } as Transaction);
    onClose();
  };

  const selectedAccount = accounts.find(a => a.name === formData.sourceAccount);
  const isCreditCard = selectedAccount?.type === AccountType.CREDIT;
  const isInternalMovement = formData.type === TransactionType.TRANSFER || formData.type === TransactionType.INVESTMENT;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-300">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-600 text-white">
          <h2 className="text-xl font-bold">{editData ? 'Editar Registro' : 'Nuevo Registro'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="bg-rose-50 text-rose-600 p-4 rounded-xl flex items-center gap-3 text-sm font-bold border border-rose-100 animate-in shake duration-300">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
            {Object.values(TransactionType).map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setFormData({ ...formData, type })}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  formData.type === type 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Concepto</label>
              <input
                autoFocus
                type="text"
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder={isInternalMovement ? "Ej: Transferencia entre mis cuentas" : "Ej: Supermercado o Almuerzo"}
                value={formData.concept}
                onChange={e => setFormData({ ...formData, concept: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Monto</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={formData.amount || ''}
                  onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Moneda</label>
              <select
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-indigo-600"
                value={formData.currency}
                onChange={e => setFormData({ ...formData, currency: e.target.value as Currency })}
              >
                <option value={Currency.ARS}>Pesos (ARS)</option>
                <option value={Currency.USD}>Dólares (USD)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Fecha</label>
              <input
                type="date"
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                {isInternalMovement ? 'Desde' : 'Cuenta Origen'}
              </label>
              <select
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={formData.sourceAccount}
                onChange={e => setFormData({ ...formData, sourceAccount: e.target.value })}
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.name}>{acc.name} ({acc.currency})</option>
                ))}
              </select>
            </div>

            {isInternalMovement && (
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Hacia</label>
                <select
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all border-indigo-200"
                  value={formData.destinationAccount}
                  onChange={e => setFormData({ ...formData, destinationAccount: e.target.value })}
                >
                  <option value="">Seleccionar cuenta destino...</option>
                  {accounts.filter(acc => acc.name !== formData.sourceAccount).map(acc => (
                    <option key={acc.id} value={acc.name}>{acc.name} ({acc.currency})</option>
                  ))}
                </select>
              </div>
            )}

            {!isInternalMovement && (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Categoría</label>
                <select
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {!isInternalMovement && (
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-700">Gasto Compartido</span>
                <span className="text-xs text-slate-500">Dividir 50/50</span>
              </div>
              <input
                type="checkbox"
                className="w-5 h-5 accent-indigo-600 rounded"
                checked={formData.isShared}
                onChange={e => setFormData({ ...formData, isShared: e.target.checked })}
              />
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-indigo-100"
            >
              <Save size={20} />
              {editData ? 'Actualizar Registro' : 'Guardar Transacción'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransactionForm;