import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area, PieChart, Pie, Legend } from 'recharts';
import { Transaction, Account, Budget, TransactionType, formatCurrency, Currency } from '../types';
import { Wallet, ArrowUpCircle, ArrowDownCircle, TrendingUp, DollarSign, Users, PieChart as PieChartIcon, AlertTriangle } from 'lucide-react';

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

  // Cálculo de evolución temporal real: parte del patrimonio actual y revierte
  // las transacciones futuras para reconstruir el saldo mes a mes.
  const historyData = useMemo(() => {
    const currentNetWorth = accounts.reduce((sum, acc) => sum + toArs(acc.balance, acc.currency), 0);
    const months = 6;
    return Array.from({ length: months }).map((_, i) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const label = d.toLocaleDateString('es-ES', { month: 'short' });
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

      // Revertir transacciones posteriores al fin de ese mes para reconstruir el saldo
      const futureTransactions = transactions.filter(t => new Date(t.date) > endOfMonth);
      let worth = currentNetWorth;
      futureTransactions.forEach(t => {
        const amount = toArs(t.amount, t.currency);
        if (t.type === TransactionType.INCOME) worth -= amount;
        if (t.type === TransactionType.EXPENSE) worth += amount;
      });
      return { name: label, worth };
    }).reverse();
  }, [transactions, accounts, usdRate]);

  // Datos para el gráfico de torta (Gastos por Categoría)
  const categoryData = useMemo(() => {
    const expenses = transactions.filter(t => t.type === TransactionType.EXPENSE);
    const groups: Record<string, number> = {};
    
    expenses.forEach(t => {
      const amount = toArs(t.amount, t.currency);
      const cat = t.category || 'Sin Categoría';
      groups[cat] = (groups[cat] || 0) + amount;
    });

    return Object.entries(groups)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value); // Ordenar de mayor a menor
  }, [transactions, usdRate]);

  const monthlyIncomeArs = transactions
    .filter(t => {
      const tDate = new Date(t.date);
      const now = new Date();
      return t.type === TransactionType.INCOME && 
             tDate.getMonth() === now.getMonth() && 
             tDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, t) => sum + toArs(t.amount, t.currency), 0);
    
  const monthlyExpensesArs = transactions
    .filter(t => {
      const tDate = new Date(t.date);
      const now = new Date();
      return t.type === TransactionType.EXPENSE && 
             tDate.getMonth() === now.getMonth() && 
             tDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, t) => sum + toArs(t.amount, t.currency), 0);

  const budgetProgress = useMemo(() => {
    const now = new Date();
    return budgets.map(b => {
      const spent = transactions
        .filter(t => {
          const tDate = new Date(t.date);
          return t.category === b.category &&
                 t.type === TransactionType.EXPENSE &&
                 tDate.getMonth() === now.getMonth() &&
                 tDate.getFullYear() === now.getFullYear();
        })
        .reduce((sum, t) => sum + toArs(t.amount, t.currency), 0);
      const percent = b.limit > 0 ? (spent / b.limit) * 100 : 0;
      return { ...b, spent, percent };
    });
  }, [transactions, budgets, usdRate]);

  const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#10b981', '#f59e0b', '#3b82f6', '#64748b'];

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
        <StatCard icon={ArrowUpCircle} label="Ingresos (Mes)" amount={monthlyIncomeArs} color="emerald" />
        <StatCard icon={ArrowDownCircle} label="Gastos (Mes)" amount={monthlyExpensesArs} color="rose" />
        <StatCard icon={TrendingUp} label="Balance (Mes)" amount={monthlyIncomeArs - monthlyExpensesArs} color="cyan" />
        <StatCard icon={Users} label="Social" amount={0} color="indigo" isSpecial />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Gráfico de Área (Evolución) - Ocupa 2 columnas */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
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
                <Tooltip 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Valor']}
                />
                <Area type="monotone" dataKey="worth" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorWorth)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico Circular (Gastos por Categoría) - Ocupa 1 columna */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-4">
             <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Consumo</h3>
             <PieChartIcon size={20} className="text-slate-300" />
          </div>
          <div className="flex-1 min-h-[250px] relative">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                     formatter={(value: number) => `$${value.toLocaleString()}`}
                     contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                  />
                  <Legend 
                    layout="horizontal" 
                    verticalAlign="bottom" 
                    align="center"
                    iconType="circle"
                    formatter={(value) => <span className="text-[10px] font-bold text-slate-500 ml-1">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-xs font-bold text-center">
                Sin datos de gastos
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Control de Presupuestos - Ancho completo */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Control de Presupuestos</h3>
          <span className="text-[10px] font-bold text-slate-400 uppercase">Mensual</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
          {budgetProgress.length === 0 ? (
            <p className="col-span-full text-center py-10 text-slate-400 text-sm">Configura presupuestos en Ajustes.</p>
          ) : (
            budgetProgress.map(bp => (
              <div key={bp.category} className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{bp.category}</span>
                  <span className="text-[10px] font-bold text-slate-400">
                    ${bp.spent.toLocaleString()} <span className="text-slate-200">/</span> ${bp.limit.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${bp.percent > 100 ? 'bg-rose-500' : bp.percent > 75 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                    style={{ width: `${Math.min(bp.percent, 100)}%` }}
                  />
                </div>
                {bp.percent > 100 && (
                  <div className="flex items-center gap-1 text-[9px] font-bold text-rose-500 uppercase animate-pulse">
                    <AlertTriangle size={10} /> Excedido
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  amount: number;
  color: string;
  isSpecial?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ icon: Icon, label, amount, color, isSpecial = false }) => (
  <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
    <div className={`p-3 bg-${color}-50 text-${color}-500 rounded-2xl w-fit mb-4 group-hover:scale-110 transition-transform`}>
      <Icon size={24} />
    </div>
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
    <p className={`text-xl font-bold text-slate-800`}>
      {isSpecial ? 'A Mano' : `$${formatCurrency(amount).split(' ')[0]}`}
    </p>
  </div>
);

export default Dashboard;