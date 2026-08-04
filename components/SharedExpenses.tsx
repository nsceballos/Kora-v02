import React, { useEffect, useMemo, useState } from 'react';
import { Transaction, formatCurrency, Currency, Settlement, AuthUser, DEFAULT_SPLIT } from '../types';
import { Users, ArrowRightLeft, CheckCircle2, History, Percent, CalendarCheck, X, Scale, Info, CalendarClock } from 'lucide-react';

interface Props {
  transactions: Transaction[];
  usdRate: number;
  /** Recibe el cierre y los ids de los movimientos que abarca (solo los del período). */
  onSettle: (settlement: Settlement, transactionIds: string[]) => void;
  currentUser: AuthUser;
  /** Nombre de la persona con quien se comparten gastos. Es solo una etiqueta
   *  personal (no una cuenta real) — este resumen nunca es visible para nadie
   *  más que el usuario dueño de estos datos. */
  partnerName: string;
  settlements: Settlement[];
  myPercent: number;
  onUpdateSplit: (percent: number) => void;
}

const monthLabel = (isoDate: string): string => {
  const [y, m] = isoDate.split('-').map(Number);
  if (!y || !m) return isoDate;
  const label = new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

/** YYYY-MM-DD → DD/MM/AAAA */
const dayLabel = (isoDate: string): string => {
  const [y, m, d] = (isoDate || '').split('-');
  return y && m && d ? `${d}/${m}/${y}` : isoDate;
};

const todayIso = () => new Date().toLocaleDateString('sv-SE'); // sv-SE ya da YYYY-MM-DD local

/**
 * Movimientos compartidos que entran en el próximo cierre: los que siguen sin
 * saldar y tienen fecha hasta el corte, más recientes primero.
 *
 * No se filtra además por "posterior al último cierre" a propósito: un gasto
 * cargado en forma retroactiva después de haber cerrado seguiría sin saldar y,
 * con ese filtro, no aparecería nunca en ningún cierre.
 */
export function selectPending(transactions: Transaction[], cutoffDate: string): Transaction[] {
  return transactions
    .filter(t => t.isShared && !t.isSettled && t.date <= cutoffDate)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Etiqueta del período: "DD/MM/AAAA – DD/MM/AAAA", o solo el corte si no hay desde. */
export function buildPeriodLabel(
  lastSettlementDate: string | undefined,
  oldestPendingDate: string | undefined,
  cutoffDate: string,
): string {
  const from = lastSettlementDate ?? oldestPendingDate;
  return from ? `${dayLabel(from)} – ${dayLabel(cutoffDate)}` : dayLabel(cutoffDate);
}

const SharedExpenses: React.FC<Props> = ({
  transactions, usdRate, onSettle,
  currentUser, partnerName,
  settlements, myPercent: savedMyPercent, onUpdateSplit,
}) => {
  const toArs = (amount: number, currency: Currency) =>
    currency === Currency.USD ? amount * usdRate : amount;

  // ── Reparto (% de aporte) ─────────────────────────────────────
  const [myPercent, setMyPercent] = useState(savedMyPercent ?? DEFAULT_SPLIT);
  useEffect(() => { setMyPercent(savedMyPercent ?? DEFAULT_SPLIT); }, [savedMyPercent]);
  const partnerPercent = 100 - myPercent;

  const commitSplit = (value: number) => {
    onUpdateSplit(value);
  };

  // ── Período del cierre ────────────────────────────────────────
  /** Fecha del cierre más reciente: desde ahí se acumula lo que está pendiente. */
  const lastSettlement = useMemo(
    () => [...settlements].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null,
    [settlements]
  );

  /** Hasta qué día se incluyen los gastos en el próximo cierre. */
  const [cutoffDate, setCutoffDate] = useState(todayIso);

  // ── Cálculo de saldos pendientes ──────────────────────────────
  // Lo pendiente son los compartidos sin saldar con fecha hasta el corte. No se
  // filtra por "posterior al último cierre" para no esconder un gasto cargado
  // en forma retroactiva después de haber cerrado: seguiría sin saldar y no
  // aparecería nunca.
  const pendingTransactions = useMemo(
    () => selectPending(transactions, cutoffDate),
    [transactions, cutoffDate]
  );

  /** Compartidos sin saldar que quedan fuera por ser posteriores al corte. */
  const afterCutoffCount = useMemo(
    () => transactions.filter(t => t.isShared && !t.isSettled && t.date > cutoffDate).length,
    [transactions, cutoffDate]
  );

  const paidByMe = pendingTransactions
    .filter(t => t.paidBy === currentUser.name)
    .reduce((sum, t) => sum + toArs(t.amount, t.currency), 0);

  const paidByPartner = pendingTransactions
    .filter(t => t.paidBy !== currentUser.name)
    .reduce((sum, t) => sum + toArs(t.amount, t.currency), 0);

  const totalShared = paidByMe + paidByPartner;
  const myShare = totalShared * (myPercent / 100);
  const partnerShare = totalShared * (partnerPercent / 100);

  const balance = paidByMe - myShare;
  const whoOwesWho = balance > 0.01
    ? { debtor: partnerName, creditor: currentUser.name, amount: balance }
    : balance < -0.01
    ? { debtor: currentUser.name, creditor: partnerName, amount: Math.abs(balance) }
    : null;

  // ── Agrupación por mes ────────────────────────────────────────
  const pendingByMonth = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    pendingTransactions.forEach(t => {
      const key = t.date.slice(0, 7); // YYYY-MM
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    });
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [pendingTransactions]);

  const sortedSettlements = useMemo(
    () => [...settlements].sort((a, b) => b.date.localeCompare(a.date)),
    [settlements]
  );

  // ── Cierre mensual ────────────────────────────────────────────
  const [confirmingClose, setConfirmingClose] = useState(false);

  /**
   * Rango que abarca el cierre: desde el día siguiente al último cierre (o el
   * primer gasto pendiente, si es el primer cierre) hasta la fecha de corte.
   */
  const periodLabel = useMemo(
    () => buildPeriodLabel(
      lastSettlement?.date,
      pendingTransactions[pendingTransactions.length - 1]?.date,
      cutoffDate,
    ),
    [lastSettlement, pendingTransactions, cutoffDate]
  );

  const buildSettlement = (): Settlement => {
    return {
      id: crypto.randomUUID(),
      // El cierre queda fechado en el corte elegido, no en el día en que se
      // aprieta el botón: así el próximo período arranca donde termina este.
      date: cutoffDate,
      period: periodLabel,
      total: Math.round(totalShared * 100) / 100,
      userA: currentUser.name,
      paidA: Math.round(paidByMe * 100) / 100,
      percentA: myPercent,
      userB: partnerName,
      paidB: Math.round(paidByPartner * 100) / 100,
      percentB: partnerPercent,
      debtor: whoOwesWho?.debtor ?? '',
      creditor: whoOwesWho?.creditor ?? '',
      amount: whoOwesWho ? Math.round(whoOwesWho.amount * 100) / 100 : 0,
      txCount: pendingTransactions.length,
    };
  };

  const handleConfirmClose = () => {
    onSettle(buildSettlement(), pendingTransactions.map(t => t.id));
    setConfirmingClose(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h2 className="text-3xl font-bold text-slate-800">Gastos Compartidos</h2>
        <p className="text-slate-500">Reparto {myPercent}/{partnerPercent} · Período {periodLabel}</p>
      </header>

      {/* Período: último cierre y fecha de corte */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><CalendarClock size={18} /></div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm md:text-base">Período a saldar</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              Lo pendiente desde el último cierre
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Último cierre</p>
            {lastSettlement ? (
              <>
                <p className="text-lg font-black text-slate-800">{dayLabel(lastSettlement.date)}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {lastSettlement.amount > 0
                    ? `${lastSettlement.debtor} transfirió $${formatCurrency(lastSettlement.amount)}`
                    : 'Quedaron a mano'}
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-black text-slate-400">Sin cierres previos</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Este sería el primero</p>
              </>
            )}
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
              Nuevo cierre hasta
            </label>
            <input
              type="date"
              value={cutoffDate}
              onChange={e => setCutoffDate(e.target.value || todayIso())}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {cutoffDate !== todayIso() && (
              <button
                type="button"
                onClick={() => setCutoffDate(todayIso())}
                className="mt-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-700"
              >
                Volver a hoy
              </button>
            )}
          </div>
        </div>

        {afterCutoffCount > 0 && (
          <p className="mt-3 text-[11px] text-amber-600 flex items-center gap-1.5 font-bold">
            <Info size={12} className="shrink-0" />
            {afterCutoffCount} movimiento(s) compartido(s) posteriores al corte quedan para el próximo cierre.
          </p>
        )}
      </div>

      {/* Resumen de lo pagado */}
      <div className="grid grid-cols-3 gap-3 md:gap-6">
        <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[9px] md:text-[10px] font-black uppercase text-indigo-400 mb-1 md:mb-2 truncate">{currentUser.name} pagó</p>
          <p className="text-base md:text-2xl font-bold text-slate-800">${formatCurrency(paidByMe)}</p>
          <p className="text-[9px] md:text-[10px] text-slate-400 mt-1">Le corresponde ${formatCurrency(myShare)}</p>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[9px] md:text-[10px] font-black uppercase text-rose-400 mb-1 md:mb-2 truncate">{partnerName} pagó</p>
          <p className="text-base md:text-2xl font-bold text-slate-800">${formatCurrency(paidByPartner)}</p>
          <p className="text-[9px] md:text-[10px] text-slate-400 mt-1">Le corresponde ${formatCurrency(partnerShare)}</p>
        </div>
        <div className="kora-gradient p-4 md:p-6 rounded-2xl shadow-xl text-white">
          <p className="text-[9px] md:text-[10px] font-black uppercase opacity-60 mb-1 md:mb-2">Total pendiente</p>
          <p className="text-base md:text-2xl font-bold">${formatCurrency(totalShared)}</p>
          <p className="text-[9px] md:text-[10px] opacity-60 mt-1">{pendingTransactions.length} movimientos</p>
        </div>
      </div>

      {/* Ajuste del reparto */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-50 text-cyan-600 rounded-xl"><Percent size={18} /></div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm md:text-base">Reparto de aportes</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Predeterminado 50/50 · Sincronizado</p>
            </div>
          </div>
          {myPercent !== DEFAULT_SPLIT && (
            <button
              onClick={() => { setMyPercent(DEFAULT_SPLIT); commitSplit(DEFAULT_SPLIT); }}
              className="text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
            >
              <Scale size={12} /> Volver a 50/50
            </button>
          )}
        </div>

        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black text-indigo-600">{currentUser.name}: {myPercent}%</span>
          <span className="text-xs font-black text-rose-500">{partnerName}: {partnerPercent}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={myPercent}
          onChange={e => setMyPercent(parseInt(e.target.value, 10))}
          onMouseUp={() => commitSplit(myPercent)}
          onTouchEnd={() => commitSplit(myPercent)}
          className="w-full accent-indigo-600 cursor-pointer"
        />
        <p className="mt-3 text-[10px] text-slate-400 italic flex items-center gap-1">
          <Info size={10} /> Del total compartido, {currentUser.name} aporta el {myPercent}% y {partnerName} el {partnerPercent}%.
        </p>
      </div>

      {/* Balance y cierre */}
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
          ) : pendingTransactions.length > 0 ? (
            <p className="text-emerald-500 font-bold">Con el reparto {myPercent}/{partnerPercent} están a mano. Pueden cerrar el mes.</p>
          ) : (
            <p className="text-emerald-500 font-bold">¡Están totalmente al día!</p>
          )}
        </div>

        {pendingTransactions.length > 0 && !confirmingClose && (
          <button
            onClick={() => setConfirmingClose(true)}
            className="bg-slate-900 text-white font-bold py-3 px-10 rounded-2xl hover:bg-black transition-all shadow-lg flex items-center gap-2 mx-auto"
          >
            <CalendarCheck size={20} className="text-emerald-400" />
            Cerrar el mes y saldar
          </button>
        )}

        {confirmingClose && (
          <div className="max-w-md mx-auto bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4 text-left animate-in fade-in duration-200">
            <p className="text-sm font-bold text-slate-700 text-center">Confirmar cierre</p>
            <ul className="text-xs text-slate-500 space-y-1.5">
              <li className="flex justify-between"><span>Período</span><span className="font-bold text-slate-700">{periodLabel}</span></li>
              <li className="flex justify-between"><span>Movimientos a saldar</span><span className="font-bold text-slate-700">{pendingTransactions.length}</span></li>
              <li className="flex justify-between"><span>Total compartido</span><span className="font-bold text-slate-700">${formatCurrency(totalShared)}</span></li>
              <li className="flex justify-between"><span>Reparto aplicado</span><span className="font-bold text-slate-700">{myPercent}% / {partnerPercent}%</span></li>
              {whoOwesWho && (
                <li className="flex justify-between"><span>{whoOwesWho.debtor} transfiere a {whoOwesWho.creditor}</span><span className="font-black text-indigo-600">${formatCurrency(whoOwesWho.amount)}</span></li>
              )}
            </ul>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmingClose(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 text-xs font-bold hover:bg-slate-100 transition-colors flex items-center justify-center gap-1"
              >
                <X size={14} /> Cancelar
              </button>
              <button
                onClick={handleConfirmClose}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-colors shadow flex items-center justify-center gap-1"
              >
                <CheckCircle2 size={14} /> Confirmar cierre
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Desglose pendiente por mes */}
      <div className="space-y-4">
        <h4 className="font-bold text-slate-700 flex items-center gap-2 px-2">
          <Users size={16} className="text-indigo-500" />
          Desglose Pendiente
        </h4>
        {pendingByMonth.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center text-slate-400">
            No hay gastos compartidos pendientes.
          </div>
        ) : (
          pendingByMonth.map(([monthKey, txs]) => (
            <div key={monthKey} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
              <div className="px-4 sm:px-6 py-2.5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{monthLabel(`${monthKey}-01`)}</span>
                <span className="text-[10px] font-bold text-slate-400">
                  ${formatCurrency(txs.reduce((s, t) => s + toArs(t.amount, t.currency), 0))}
                </span>
              </div>
              <table className="w-full text-left">
                <tbody className="divide-y divide-slate-50">
                  {txs.map(t => (
                    <tr key={t.id} className="text-sm">
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <div className="font-bold text-slate-700">{t.concept}</div>
                        <div className="text-[10px] text-slate-400 uppercase font-bold">{t.date}</div>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                          t.paidBy === currentUser.name ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'
                        }`}>
                          Pagó {t.paidBy}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-right font-bold text-slate-800 whitespace-nowrap">
                        ${formatCurrency(t.amount, t.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>

      {/* Historial de cierres */}
      {sortedSettlements.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-bold text-slate-700 flex items-center gap-2 px-2">
            <History size={16} className="text-slate-400" />
            Historial de Cierres
          </h4>
          <div className="space-y-3">
            {sortedSettlements.map(s => (
              <div key={s.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-700 text-sm">{s.period || 'Cierre'}</p>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">
                    Cerrado el {s.date} · {s.txCount} movimientos · Reparto {s.percentA}/{s.percentB}
                  </p>
                </div>
                <div className="text-xs text-slate-500 sm:text-right">
                  <p>{s.userA} pagó <span className="font-bold text-slate-700">${formatCurrency(s.paidA)}</span></p>
                  <p>{s.userB} pagó <span className="font-bold text-slate-700">${formatCurrency(s.paidB)}</span></p>
                </div>
                <div className="sm:text-right sm:min-w-[180px]">
                  {s.amount > 0 ? (
                    <>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">{s.debtor} → {s.creditor}</p>
                      <p className="font-black text-indigo-600 text-lg">${formatCurrency(s.amount)}</p>
                    </>
                  ) : (
                    <p className="text-emerald-500 font-bold text-xs flex sm:justify-end items-center gap-1">
                      <CheckCircle2 size={14} /> Quedaron a mano
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SharedExpenses;
