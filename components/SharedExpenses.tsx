import React from 'react';
import { Transaction, formatCurrency, Currency, TransactionType } from '../types';
import { Users, ArrowRightLeft, CheckCircle2, History } from 'lucide-react';

interface Props {
  transactions: Transaction[];
  usdRate: number;
  onSettle: () => void;
  currentUserName: string;
  partnerName: string;
}

const SharedExpenses: React.FC<Props> = ({ transactions, usdRate, onSettle, currentUserName, partnerName }) => {
  const toArs = (amount: number, currency: Currency) => {
    return currency === Currency.USD ? amount * usdRate : amount;
  };

  // Solo consideramos gastos compartidos que NO han sido saldados
  const pendingTransactions = transactions.filter(t => t.isShared && !t.isSettled);
  const settledTransactions = transactions.filter(t => t.isShared && t.isSettled);

  const paidByMe = pendingTransactions
    .filter(t => t.paidBy === currentUserName)
    .reduce((sum, t) => sum + toArs(t.amount, t.currency), 0);

  const paidByPartner = pendingTransactions
    .filter(t => t.paidBy === partnerName)
    .reduce((sum, t) => sum + toArs(t.amount, t.currency), 0);

  const totalShared = paidByMe + paidByPartner;
  const eachShouldPay = totalShared / 2;

  const balance = paidByMe - eachShouldPay;
  const whoOwesWho = balance > 0
    ? { debtor: partnerName, creditor: currentUserName, amount: balance }
    : balance < 0
    ? { debtor: currentUserName, creditor: partnerName, amount: Math.abs(balance) }
    : null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h2 className="text-3xl font-bold text-slate-800">Gastos Compartidos</h2>
        <p className="text-slate-500">Liquidación 50/50 de gastos pendientes</p>
      </header>

      <div className="grid grid-cols-3 gap-3 md:gap-6">
        <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[9px] md:text-[10px] font-black uppercase text-indigo-400 mb-1 md:mb-2 truncate">{currentUserName} pagó</p>
          <p className="text-base md:text-2xl font-bold text-slate-800">${formatCurrency(paidByMe)}</p>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[9px] md:text-[10px] font-black uppercase text-rose-400 mb-1 md:mb-2 truncate">{partnerName} pagó</p>
          <p className="text-base md:text-2xl font-bold text-slate-800">${formatCurrency(paidByPartner)}</p>
        </div>
        <div className="kora-gradient p-4 md:p-6 rounded-2xl shadow-xl text-white">
          <p className="text-[9px] md:text-[10px] font-black uppercase opacity-60 mb-1 md:mb-2">Total</p>
          <p className="text-base md:text-2xl font-bold">${formatCurrency(totalShared)}</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm text-center">
        <div className="flex flex-col items-center gap-4 mb-6">
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full">
            <ArrowRightLeft size={32} />
          </div>
          {whoOwesWho ? (
            <div>
              <p className="text-slate-600 mb-1">
                <span className="font-bold">{whoOwesWho.debtor}</span> debe transferir a <span className="font-bold">{whoOwesWho.creditor}</span>
              </p>
              <p className="text-4xl font-black text-slate-800 tracking-tighter">${formatCurrency(whoOwesWho.amount)}</p>
            </div>
          ) : (
            <p className="text-emerald-500 font-bold">¡Están totalmente al día!</p>
          )}
        </div>

        {whoOwesWho && (
          <button 
            onClick={onSettle}
            className="bg-slate-900 text-white font-bold py-3 px-10 rounded-2xl hover:bg-black transition-all shadow-lg flex items-center gap-2 mx-auto"
          >
            <CheckCircle2 size={20} className="text-emerald-400" />
            Marcar todo como Saldado
          </button>
        )}
      </div>

      <div className="space-y-4">
        <h4 className="font-bold text-slate-700 flex items-center gap-2 px-2">
          <Users size={16} className="text-indigo-500" />
          Desglose Pendiente
        </h4>
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <tbody className="divide-y divide-slate-50">
              {pendingTransactions.length === 0 ? (
                <tr><td className="p-10 text-center text-slate-400">No hay gastos compartidos pendientes.</td></tr>
              ) : (
                pendingTransactions.map(t => (
                  <tr key={t.id} className="text-sm">
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="font-bold text-slate-700">{t.concept}</div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">{t.date}</div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                        t.paidBy === 'Yo' ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'
                      }`}>
                        Pagó {t.paidBy}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-right font-bold text-slate-800 whitespace-nowrap">
                      ${formatCurrency(t.amount, t.currency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {settledTransactions.length > 0 && (
        <div className="space-y-4 opacity-50 grayscale">
          <h4 className="font-bold text-slate-400 flex items-center gap-2 px-2">
            <History size={16} />
            Historial de Saldados
          </h4>
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
             <div className="p-4 text-xs text-slate-400 italic text-center">Se han saldado {settledTransactions.length} movimientos anteriormente.</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SharedExpenses;