import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType, formatCurrency, Currency } from '../types';
import { Search, Filter, Edit3, X } from 'lucide-react';

interface Props {
  transactions: Transaction[];
  onEdit: (t: Transaction) => void;
  categories: string[];
}

const TransactionsList: React.FC<Props> = ({ transactions, onEdit, categories }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        const matchesSearch = t.concept.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            t.category.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = filterCategory === 'all' || t.category === filterCategory;
        const matchesType = filterType === 'all' || t.type === filterType;
        return matchesSearch && matchesCategory && matchesType;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, searchTerm, filterCategory, filterType]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Movimientos</h2>
          <p className="text-slate-500">Historial completo ({filteredTransactions.length} registros)</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar concepto..." 
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm text-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                <X size={14} />
              </button>
            )}
          </div>
          
          <select 
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none"
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
          >
            <option value="all">Categorías</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select 
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none"
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            <option value="all">Tipos</option>
            {Object.values(TransactionType).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </header>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <Filter className="mx-auto mb-4 opacity-20" size={48} />
            <p>No se encontraron movimientos con estos filtros.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-slate-400 font-bold border-b border-slate-50 bg-slate-50/30">
                  <th className="px-6 py-5">Fecha</th>
                  <th className="px-6 py-5">Concepto</th>
                  <th className="px-6 py-5">Categoría</th>
                  <th className="px-6 py-5 text-right">Monto</th>
                  <th className="px-6 py-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredTransactions.map(t => (
                  <tr key={t.id} className={`group hover:bg-slate-50/50 transition-colors ${t.isSettled ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-5 text-sm text-slate-500">
                      {new Date(t.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-700">{t.concept}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">{t.sourceAccount}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold">
                        {t.category}
                      </span>
                    </td>
                    <td className={`px-6 py-5 text-right font-bold ${
                      t.type === TransactionType.EXPENSE ? 'text-rose-500' : 
                      t.type === TransactionType.INCOME ? 'text-emerald-500' : 'text-slate-500'
                    }`}>
                      {t.type === TransactionType.EXPENSE ? '-' : t.type === TransactionType.INCOME ? '+' : ''}${formatCurrency(t.amount, t.currency)}
                    </td>
                    <td className="px-6 py-5 text-right">
                      {!t.isSettled && (
                        <button onClick={() => onEdit(t)} className="p-2 text-slate-300 hover:text-indigo-600">
                          <Edit3 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionsList;