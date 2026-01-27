
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { Transaction, Account, Budget, TransactionType, formatCurrency, Currency } from '../types';
import { Wallet, ArrowUpCircle, ArrowDownCircle, AlertCircle, DollarSign, TrendingUp, ChevronRight, Users, ArrowRightLeft } from 'lucide-react';

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

  const monthlyIncomeArs = transactions
    .filter(t => t.type === TransactionType.INCOME)
    .reduce((sum, t) => sum + toArs(t.amount, t.currency), 0);
    
  const monthlyExpensesArs = transactions
    .filter(t => t.type === TransactionType.EXPENSE)
    .reduce((sum, t) => sum + toArs(t.amount, t.currency), 0);

  // Lógica de Gastos Compartidos para el Dashboard
  const sharedTransactions = transactions.filter(t => t.isShared);
  const paidByMe = sharedTransactions
    .filter(t => t.paidBy === 'Yo')
    .reduce((sum, t) => sum + toArs(t.amount, t.currency), 0);
  const paidByPartner = sharedTransactions
    .filter(t => t.paidBy === 'Pareja')
    .reduce((sum, t) => sum + toArs(t.amount, t.currency), 0);
  
  const totalShared = paidByMe + paidByPartner;
  const balanceShared = paidByMe - (totalShared / 2);

  const categoryData = budgets.map(b => {
    const spentArs = transactions
      .filter(t => t.category === b.category && t.type === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + toArs(t.amount, t.currency), 0);
    return { name: b.category, spent: spentArs, limit: b.limit };
  });

  const COLORS = ['#00d2ff', '#9d50bb', '#6366f1', '#10b981', '#f59e0b'];

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-1 text-balance">Hola de nuevo</h2>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Patrimonio consolidado</span>
            {blueRate && (
              <span className="px-2 py-0.5 bg-cyan-50 text-[10px] font-bold text-cyan-600 rounded-full border border-cyan-100">
                Blue: ${blueRate.toLocaleString()}
              </span>
            )}
          </div>
        </div>
        <div className="relative group p-8 kora-bg-deep rounded-[2.5rem] text-white shadow-2xl shadow-slate-200 min-w-[300px] overflow-hidden">
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

      {/* Grid Principal de Estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
          <div className="p-3 bg-emerald-50 text-emerald-500 rounded-2xl w-fit mb-4">
            <ArrowUpCircle size={24} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Ingresos Mes</p>
          <p className="text-xl font-bold text-slate-800">${formatCurrency(monthlyIncomeArs, Currency.ARS).split(' ')[0]}</p>
        </div>
        
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
          <div className="p-3 bg-rose-50 text-rose-500 rounded-2xl w-fit mb-4">
            <ArrowDownCircle size={24} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Gastos Mes</p>
          <p className="text-xl font-bold text-slate-800">${formatCurrency(monthlyExpensesArs, Currency.ARS).split(' ')[0]}</p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
          <div className="p-3 bg-cyan-50 text-cyan-500 rounded-2xl w-fit mb-4">
            <TrendingUp size={24} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Ahorro Neto</p>
          <p className="text-xl font-bold text-slate-800">${formatCurrency(monthlyIncomeArs - monthlyExpensesArs, Currency.ARS).split(' ')[0]}</p>
        </div>

        {/* Widget de Gastos Compartidos */}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-[2rem] border border-indigo-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
          <div className="p-3 bg-white text-indigo-600 rounded-2xl w-fit mb-4 shadow-sm">
            <Users size={24} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">Balance Social</p>
          {balanceShared === 0 ? (
            <p className="text-xl font-bold text-indigo-800 italic tracking-tight">Están a mano</p>
          ) : (
            <div className="flex flex-col">
              <p className={`text-xl font-black ${balanceShared > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {balanceShared > 0 ? 'Te deben' : 'Debes'} ${Math.abs(balanceShared).toLocaleString('es-ES', {maximumFractionDigits: 0})}
              </p>
              <p className="text-[9px] font-bold text-indigo-300 uppercase mt-1">Saldar este mes</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Gastos por Categoría</h3>
            <div className="p-2 bg-slate-50 rounded-xl text-slate-400">
               <ChevronRight size={16} />
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                />
                <Bar dataKey="spent" radius={[0, 10, 10, 0]} barSize={16}>
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col items-center">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter self-start mb-8">Distribución de Gastos</h3>
          <div className="h-80 w-full relative">
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mayor Gasto</p>
              <p className="text-lg font-black kora-text-gradient">{categoryData.sort((a,b)=>b.spent-a.spent)[0]?.name || 'N/A'}</p>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData.filter(d => d.spent > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={100}
                  paddingAngle={8}
                  dataKey="spent"
                  stroke="none"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
