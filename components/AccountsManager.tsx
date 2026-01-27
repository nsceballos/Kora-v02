
import React, { useState } from 'react';
import { Account, AccountType, formatCurrency, Currency } from '../types';
import { CreditCard, Wallet, Landmark, TrendingUp, Plus, X, Edit3 } from 'lucide-react';

interface Props {
  accounts: Account[];
  onAddAccount: (acc: Account) => void;
  onUpdateAccount: (acc: Account) => void;
}

const AccountsManager: React.FC<Props> = ({ accounts, onAddAccount, onUpdateAccount }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Account>>({
    name: '',
    type: AccountType.DEBIT,
    balance: 0,
    currency: Currency.ARS,
    closingDate: '01',
    dueDate: '10'
  });

  const getIcon = (type: AccountType) => {
    switch (type) {
      case AccountType.CREDIT: return <CreditCard size={24} />;
      case AccountType.DEBIT: return <Landmark size={24} />;
      case AccountType.INVESTMENT: return <TrendingUp size={24} />;
      default: return <Wallet size={24} />;
    }
  };

  const getStyle = (type: AccountType) => {
    switch (type) {
      case AccountType.CREDIT: return 'bg-rose-50 text-rose-600 border-rose-100';
      case AccountType.DEBIT: return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      case AccountType.INVESTMENT: return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  const handleEdit = (acc: Account) => {
    setEditingId(acc.id);
    setFormData(acc);
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ name: '', type: AccountType.DEBIT, balance: 0, currency: Currency.ARS, closingDate: '01', dueDate: '10' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    if (editingId) {
      onUpdateAccount({ ...formData, id: editingId } as Account);
    } else {
      onAddAccount({ ...formData, id: Math.random().toString(36).substr(2, 9) } as Account);
    }
    resetForm();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Mis Cuentas</h2>
          <p className="text-slate-500">Gestión de activos en ARS y USD</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-indigo-600 text-white p-3 rounded-full hover:bg-indigo-700 shadow-lg transition-all"
        >
          <Plus size={24} />
        </button>
      </header>

      {showForm && (
        <div className="bg-white p-6 rounded-3xl border-2 border-indigo-100 shadow-xl mb-8 animate-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-xl">{editingId ? 'Editar Cuenta' : 'Nueva Cuenta'}</h3>
            <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-400 uppercase">Nombre</label>
              <input 
                type="text" 
                className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-400 uppercase">Moneda</label>
              <select 
                className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl"
                value={formData.currency}
                onChange={e => setFormData({...formData, currency: e.target.value as Currency})}
              >
                <option value={Currency.ARS}>Pesos (ARS)</option>
                <option value={Currency.USD}>Dólares (USD)</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-400 uppercase">Tipo</label>
              <select 
                className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl"
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value as AccountType})}
              >
                {Object.values(AccountType).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-400 uppercase">Saldo Inicial</label>
              <input 
                type="number" 
                className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl"
                value={formData.balance ?? ''}
                onChange={e => setFormData({...formData, balance: parseFloat(e.target.value)})}
              />
            </div>

            {formData.type === AccountType.CREDIT && (
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Día Cierre</label>
                  <input type="text" className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" value={formData.closingDate || ''} onChange={e => setFormData({...formData, closingDate: e.target.value})} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Día Vence</label>
                  <input type="text" className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" value={formData.dueDate || ''} onChange={e => setFormData({...formData, dueDate: e.target.value})} />
                </div>
              </>
            )}

            <button type="submit" className="md:col-span-2 lg:col-span-3 bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-all mt-2">
              {editingId ? 'Actualizar Cuenta' : 'Crear Cuenta'}
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map(acc => (
          <div key={acc.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group relative">
            <button 
              onClick={() => handleEdit(acc)}
              className="absolute top-4 right-4 p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
            >
              <Edit3 size={18} />
            </button>

            <div className="flex justify-between items-start mb-8">
              <div className={`p-3 rounded-2xl border ${getStyle(acc.type)}`}>
                {getIcon(acc.type)}
              </div>
              <div className="text-right pr-8">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{acc.type}</span>
                <p className="font-bold text-slate-800 truncate max-w-[120px]">{acc.name}</p>
              </div>
            </div>
            
            <div>
              <p className="text-sm text-slate-400 font-medium">Saldo Actual</p>
              <p className={`text-3xl font-black ${acc.balance < 0 ? 'text-rose-500' : 'text-slate-800'}`}>
                ${formatCurrency(acc.balance, acc.currency)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AccountsManager;
