
import React from 'react';
import { Transaction, TransactionType, formatCurrency } from '../types';
import { Search, Filter, Calendar, Tag, CreditCard as CardIcon, Edit3, ArrowRightLeft } from 'lucide-react';

interface Props {
  transactions: Transaction[];
  onEdit: (t: Transaction) => void;
}

const TransactionsList: React.FC<Props> = ({ transactions, onEdit }) => {
  const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Movimientos</h2>
          <p className="text-slate-500">Historial completo multi-moneda</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar..." 
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all w-full md:w-64 shadow-sm"
            />
          </div>
        </div>
      </header>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {sortedTransactions.length === 0 ? (
          <div className="py-20 text-center text-slate-400">No hay transacciones registradas.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-slate-400 font-bold border-b border-slate-50 bg-slate-50/30">
                  <th className="px-6 py-5">Fecha</th>
                  <th className="px-6 py-5">Concepto</th>
                  <th className="px-6 py-5">Categoría</th>
                  <th className="px-6 py-5">Cuentas</th>
                  <th className="px-6 py-5 text-right">Monto</th>
                  <th className="px-6 py-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedTransactions.map(t => (
                  <tr key={t.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-5 text-sm text-slate-500">
                      {new Date(t.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="px-6 py-5 font-semibold text-slate-700">{t.concept}</td>
                    <td className="px-6 py-5">
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold">
                        {t.category}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-xs text-slate-500">
                      {t.sourceAccount} {t.destinationAccount && ` → ${t.destinationAccount}`}
                    </td>
                    <td className={`px-6 py-5 text-right font-bold ${
                      t.type === TransactionType.EXPENSE ? 'text-rose-500' : 'text-emerald-500'
                    }`}>
                      {t.type === TransactionType.EXPENSE ? '-' : '+'}${formatCurrency(t.amount, t.currency)}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button onClick={() => onEdit(t)} className="p-2 text-slate-300 hover:text-indigo-600"><Edit3 size={16} /></button>
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
