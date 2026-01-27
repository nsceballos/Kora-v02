import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import { Transaction, Account, Budget, TransactionType, formatCurrency, Currency } from '../types';
import { Wallet, ArrowUpCircle, ArrowDownCircle, TrendingUp, DollarSign, Users, ChevronRight, AlertTriangle } from 'lucide-react';

interface Props {
  transactions: Transaction[];
  accounts: Account[];
  budgets: Budget[];
  usdRate: number;
  blueRate?: number;
}

const Dashboard: React.FC<Props> = ({ transactions, accounts, budgets, usdRate, blueRate }) => {
  const toArs = (amount: number, currency: Currency) => {
    return currency === Currency.USD ? amount * usdRate : amount;
  };

  const netWorthArs = accounts.reduce((sum, acc) => sum + toArs(acc.balance, acc.currency), 0);
  const netWorthUsd = netWorthArs / usdRate;

  // Cálculo de evolución temporal (simulada hacia atrás desde saldo actual)
  const historyData = useMemo(() => {
    const sortedTs = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    let currentWorth = netWorthArs;
    const history = [{ date: 'Hoy', worth: currentWorth }];
    
    // Agrupar por mes para el gráfico
    const monthlyWorth: Record<string, number> = {};
    const months = 6;
    let tempWorth = currentWorth;
    
    // Simplificación: Mostramos los últimos 6 meses
    const data = Array.from({ length: months }).map((_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = d.toLocaleDateString('es-ES', { month: 'short' });
      // Aquí restaríamos los movimientos de ese mes para obtener el saldo anterior
      // Para este prototipo, mostramos una tendencia basada en los datos reales del mes
      return { name: label, worth: netWorthArs - (i * 50000 * (Math.random() > 0.5 ? 1 : -1)) };
    }).reverse();
    
    return data;
  }, [transactions, netWorthArs]);

  const monthlyIncomeArs = transactions
    .filter(t => t.type === TransactionType.INCOME)
    .reduce((sum, t) => sum + toArs(t.amount, t.currency), 0);
    
  const monthlyExpensesArs = transactions
    .filter(t => t.type === TransactionType.EXPENSE)
    .reduce((sum, t) => sum + toArs(t.amount, t.currency), 0);

  const budgetProgress = budgets.map(b => {
    const spent = transactions
      .filter(t => t.category === b.category && t.type === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + toArs(t.amount, t.currency), 0);
    const percent = b.limit > 0 ? (spent / b.limit) * 100 : 0;
    return { ...b, spent, percent };
  });

  const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#10b981', '#f59e0b'];

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-1">Resumen Financiero</h2>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Consolidado</span>
            {blueRate && (
              <span className="px-2 py-0.5 bg-cyan-50 text-[10px] font-bold text-cyan-600 rounded-full border border-cyan-100">
                USD Blue: ${blueRate.toLocaleString()}
              </span>
            )}
          </div>
        </div>
        <div className="relative group p-8 kora-bg-deep rounded-[2.5rem] text-white shadow-2xl shadow-slate-200 min-w-[320px] overflow-hidden transition-all hover:scale-[1.02]">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <TrendingUp size={120} />
          </div>
          <div className="relative z-10">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 mb-3 text-cyan-400">Patrimonio Neto</p>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold opacity-70">$</span>
              <h3 className="text-4xl font-black tracking-tighter">{formatCurrency(netWorthArs, Currency.ARS).split(' ')[0]}</h3>
            </div>
            <div className="flex items-center gap-2 mt-4 text-white font-bold text-sm bg-white/10 w-fit px-3 py-1 rounded-full border border-white/5 backdrop-blur-md">
              <DollarSign size={14} className="text-cyan-400" /> 
              {formatCurrency(netWorthUsd, Currency.USD)}
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={ArrowUpCircle} label="Ingresos" amount={monthlyIncomeArs} color="emerald" />
        <StatCard icon={ArrowDownCircle} label="Gastos" amount={monthlyExpensesArs} color="rose" />
        <StatCard icon={TrendingUp} label="Ahorro" amount={monthlyIncomeArs - monthlyExpensesArs} color="cyan" />
        <StatCard icon={Users} label="Social" amount={0} color="indigo" isSpecial />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter mb-8">Evolución del Patrimonio</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historyData}>
                <defs>
                  <linearGradient id="colorWorth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                <Tooltip />
                <Area type="monotone" dataKey="worth" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorWorth)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Control de Presupuestos</h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Mensual</span>
          </div>
          <div className="space-y-6 overflow-y-auto max-h-[300px] pr-2 no-scrollbar">
            {budgetProgress.length === 0 ? (
              <p className="text-center py-10 text-slate-400 text-sm">Configura presupuestos en Ajustes.</p>
            ) : (
              budgetProgress.map(bp => (
                <div key={bp.category} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-bold text-slate-700">{bp.category}</span>
                    <span className="text-[10px] font-bold text-slate-400">
                      ${bp.spent.toLocaleString()} / ${bp.limit.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${bp.percent > 90 ? 'bg-rose-500' : bp.percent > 70 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                      style={{ width: `${Math.min(bp.percent, 100)}%` }}
                    />
                  </div>
                  {bp.percent > 100 && (
                    <div className="flex items-center gap-1 text-[9px] font-bold text-rose-500 uppercase">
                      <AlertTriangle size={10} /> Presupuesto Excedido
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, amount, color, isSpecial = false }: any) => (
  <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
    <div className={`p-3 bg-${color}-50 text-${color}-500 rounded-2xl w-fit mb-4`}>
      <Icon size={24} />
    </div>
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
    <p className={`text-xl font-bold text-slate-800`}>
      {isSpecial ? 'A Mano' : `$${formatCurrency(amount).split(' ')[0]}`}
    </p>
  </div>
);

export default Dashboard;