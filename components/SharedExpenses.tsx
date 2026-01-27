
import React from 'react';
import { Transaction, formatCurrency, Currency } from '../types';
import { Users, ArrowRightLeft, CheckCircle2 } from 'lucide-react';

interface Props {
  transactions: Transaction[];
  // Fix: Added missing usdRate prop to resolve type error in App.tsx line 206
  usdRate: number;
}

const SharedExpenses: React.FC<Props> = ({ transactions, usdRate }) => {
  // Helper to convert amounts to ARS for consistent shared calculation
  const toArs = (amount: number, currency: Currency) => {
    return currency === Currency.USD ? amount * usdRate : amount;
  };

  const sharedOnes = transactions.filter(t => t.isShared);
  
  const paidByMe = sharedOnes
    .filter(t => t.paidBy === 'Yo')
    .reduce((sum, t) => sum + toArs(t.amount, t.currency), 0);

  const paidByPartner = sharedOnes
    .filter(t => t.paidBy === 'Pareja')
    .reduce((sum, t) => sum + toArs(t.amount, t.currency), 0);

  const totalShared = paidByMe + paidByPartner;
  const eachShouldPay = totalShared / 2;

  const balance = paidByMe - eachShouldPay;
  const whoOwesWho = balance > 0 
    ? { debtor: 'Pareja', creditor: 'Yo', amount: balance }
    : balance < 0
    ? { debtor: 'Yo', creditor: 'Pareja', amount: Math.abs(balance) }
    : null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h2 className="text-3xl font-bold text-slate-800">Gastos Compartidos</h2>
        <p className="text-slate-500">Control de gastos en pareja (División 50/50) - Valuado en ARS</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center">
          <p className="text-sm text-slate-500 mb-1">Pagado por Mí (Eq. ARS)</p>
          <p className="text-2xl font-bold text-indigo-600">${formatCurrency(paidByMe)}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center">
          <p className="text-sm text-slate-500 mb-1">Pagado por Pareja (Eq. ARS)</p>
          <p className="text-2xl font-bold text-rose-500">${formatCurrency(paidByPartner)}</p>
        </div>
        <div className="bg-indigo-600 p-6 rounded-2xl shadow-xl shadow-indigo-100 text-center text-white">
          <p className="text-sm opacity-80 mb-1">Total Compartido (Eq. ARS)</p>
          <p className="text-2xl font-bold">${formatCurrency(totalShared)}</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4 mb-8 pb-8 border-b border-slate-50">
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
            <ArrowRightLeft size={32} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">Liquidación del Mes</h3>
            <p className="text-slate-500">Cálculo de deuda pendiente</p>
          </div>
        </div>

        {whoOwesWho ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <p className="text-lg text-slate-600 mb-2">
              <span className="font-bold text-indigo-600">{whoOwesWho.debtor}</span> le debe a <span className="font-bold text-emerald-600">{whoOwesWho.creditor}</span>
            </p>
            <p className="text-5xl font-black text-slate-800 mb-8 tracking-tight">${formatCurrency(whoOwesWho.amount)}</p>
            <button className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-8 rounded-2xl flex items-center gap-2 transition-all">
              <CheckCircle2 size={20} />
              Saldar Deuda
            </button>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-slate-400">Están a mano. No hay deudas pendientes.</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/50">
          <h4 className="font-bold text-slate-700 flex items-center gap-2">
            <Users size={16} />
            Desglose de Movimientos Compartidos
          </h4>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-slate-400 font-bold border-b border-slate-50">
              <th className="px-6 py-4">Concepto</th>
              <th className="px-6 py-4">Pagado por</th>
              <th className="px-6 py-4 text-right">Monto Original</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {sharedOnes.map(t => (
              <tr key={t.id} className="text-sm text-slate-600">
                <td className="px-6 py-4 font-medium">{t.concept}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                    t.paidBy === 'Yo' ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'
                  }`}>
                    {t.paidBy}
                  </span>
                </td>
                <td className="px-6 py-4 text-right font-bold">${formatCurrency(t.amount, t.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SharedExpenses;
