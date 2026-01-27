
import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  Wallet, 
  TrendingUp, 
  Users, 
  BrainCircuit, 
  PlusCircle,
  Settings as SettingsIcon,
  RefreshCw,
  CloudCheck,
  CloudOff,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { Transaction, TransactionType, Account, AccountType, Budget, Currency } from './types';
import Dashboard from './components/Dashboard';
import TransactionsList from './components/TransactionsList';
import AccountsManager from './components/AccountsManager';
import SharedExpenses from './components/SharedExpenses';
import AIAdvisor from './components/AIAdvisor';
import TransactionForm from './components/TransactionForm';
import Settings from './components/Settings';
import { sheetService } from './services/sheetService';

const INITIAL_CATEGORIES = ['Alimentación', 'Vivienda', 'Ocio', 'Transporte', 'Salud', 'Educación', 'Servicios', 'Suscripciones', 'Otros'];

const KoraLogo = ({ size = 24, className = "" }) => (
  <div className={`relative ${className}`} style={{ width: size, height: size }}>
    <div className="absolute inset-0 kora-gradient rounded-lg rotate-12 opacity-20 animate-pulse"></div>
    <div className="absolute inset-0 kora-gradient rounded-lg flex items-center justify-center text-white font-black italic">
      K
    </div>
  </div>
);

const App: React.FC = () => {
  const [view, setView] = useState<'dashboard' | 'transactions' | 'accounts' | 'shared' | 'ai' | 'settings'>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<string[]>(INITIAL_CATEGORIES);
  const [usdRates, setUsdRates] = useState({ blue: 1240, official: 980 });
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState<string>('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const init = async () => {
    try {
      setIsLoading(true);
      const data = await sheetService.getAppData();
      setTransactions(data.transactions);
      setAccounts(data.accounts);
      if (data.categories?.length > 0) setCategories(data.categories);
      
      const webAppUrl = localStorage.getItem('finance_arch_google_webapp_url');
      setIsConnected(!!webAppUrl);

      const savedRates = localStorage.getItem('finance_arch_rates');
      if (savedRates) setUsdRates(JSON.parse(savedRates));

      const savedWebhook = localStorage.getItem('finance_arch_n8n_webhook');
      if (savedWebhook) setN8nWebhookUrl(savedWebhook);

    } catch (error) {
      console.error("Error inicializando Kora:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    init();
  }, []);

  const saveTransaction = async (newT: Transaction) => {
    let updatedTransactions = [...transactions];
    if (editingTransaction) {
      updatedTransactions = transactions.filter(t => t.id !== editingTransaction.id);
      updateBalanceLocal(editingTransaction, true);
    }
    updatedTransactions.push(newT);
    setTransactions(updatedTransactions);
    updateBalanceLocal(newT, false);
    setEditingTransaction(null);
    setIsFormOpen(false);

    try {
      const synced = await sheetService.saveTransaction(newT);
      if (synced) {
        const affected = accounts.filter(a => a.name === newT.sourceAccount || a.name === newT.destinationAccount);
        for (const acc of affected) await sheetService.saveAccount(acc);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }
    } catch (e) {
      console.warn("Fallo sincronización, se mantiene local.");
    }
  };

  const updateBalanceLocal = (t: Transaction, reverse: boolean) => {
    const m = reverse ? -1 : 1;
    setAccounts(prev => prev.map(acc => {
      if (acc.name === t.sourceAccount) {
        let impact = 0;
        if (t.type === TransactionType.EXPENSE) impact = -t.amount;
        if (t.type === TransactionType.INCOME) impact = t.amount;
        if (t.type === TransactionType.TRANSFER || t.type === TransactionType.INVESTMENT) impact = -t.amount;
        return { ...acc, balance: acc.balance + (impact * m) };
      }
      if ((t.type === TransactionType.TRANSFER || t.type === TransactionType.INVESTMENT) && acc.name === t.destinationAccount) {
        return { ...acc, balance: acc.balance + (t.amount * m) };
      }
      return acc;
    }));
  };

  const currentMonthTransactions = useMemo(() => {
    const now = new Date();
    return transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }, [transactions]);

  const navItems = [
    { id: 'dashboard', label: 'Resumen', icon: LayoutDashboard },
    { id: 'transactions', label: 'Historial', icon: Receipt },
    { id: 'accounts', label: 'Billetera', icon: Wallet },
    { id: 'shared', label: 'Social', icon: Users },
    { id: 'settings', label: 'Ajustes', icon: SettingsIcon },
    { id: 'ai', label: 'Kora AI', icon: BrainCircuit }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 space-y-6">
        <KoraLogo size={80} className="animate-bounce" />
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="animate-spin text-cyan-400" size={24} />
          <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Cargando Kora</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f8fafc]">
      {/* Sidebar (Desktop) */}
      <nav className="hidden md:flex flex-col w-72 bg-slate-900 text-white p-8">
        <div className="flex items-center gap-4 mb-12">
          <KoraLogo size={40} />
          <div>
            <h1 className="text-2xl font-black tracking-tighter">Kora</h1>
            <p className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest">Smart Finance</p>
          </div>
        </div>
        
        <div className="space-y-2 flex-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id as any)}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 ${
                view === item.id 
                  ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-400 shadow-inner' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <item.icon size={22} className={view === item.id ? 'text-cyan-400' : ''} />
              <span className="font-bold text-sm tracking-tight">{item.label}</span>
              {item.id === 'ai' && <Sparkles size={12} className="ml-auto text-purple-400" />}
            </button>
          ))}
        </div>

        <div className="mt-auto space-y-4">
          <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest border border-white/5 bg-white/5 ${isConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
            <div className={`w-2 h-2 rounded-full animate-pulse ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'}`}></div>
            {isConnected ? 'Sync: Online' : 'Sync: Local'}
          </div>
          <button 
            onClick={() => { setEditingTransaction(null); setIsFormOpen(true); }}
            className="w-full kora-gradient hover:brightness-110 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-cyan-500/10 active:scale-95"
          >
            <PlusCircle size={20} />
            NUEVO REGISTRO
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-12 overflow-y-auto pb-32 no-scrollbar">
        <div className="max-w-6xl mx-auto">
          {view === 'dashboard' && <Dashboard transactions={currentMonthTransactions} accounts={accounts} budgets={categories.map(c => ({category: c, limit: 100000}))} usdRate={usdRates.official} blueRate={usdRates.blue} />}
          {view === 'transactions' && <TransactionsList transactions={transactions} onEdit={(t) => { setEditingTransaction(t); setIsFormOpen(true); }} />}
          {view === 'accounts' && <AccountsManager accounts={accounts} onAddAccount={(a) => sheetService.saveAccount(a).then(init)} onUpdateAccount={(a) => sheetService.saveAccount(a).then(init)} />}
          {view === 'shared' && <SharedExpenses transactions={transactions} usdRate={usdRates.official} />}
          {view === 'settings' && <Settings categories={categories} setCategories={(c) => sheetService.saveCategories(c).then(init)} usdRates={usdRates} onUpdateRates={setUsdRates} n8nWebhookUrl={n8nWebhookUrl} onUpdateWebhookUrl={setN8nWebhookUrl} />}
          {view === 'ai' && <AIAdvisor transactions={transactions} budgets={categories.map(c => ({category: c, limit: 100000}))} accounts={accounts} webhookUrl={n8nWebhookUrl} />}
        </div>
      </main>

      {/* Mobile Tab Bar (iOS Refined) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-100 flex justify-around items-center px-4 pb-8 pt-4 z-50">
        {navItems.slice(0, 5).map(item => (
          <button 
            key={item.id} 
            onClick={() => setView(item.id as any)} 
            className={`flex flex-col items-center gap-1.5 transition-all duration-300 relative ${view === item.id ? 'text-[#00d2ff]' : 'text-slate-400'}`}
          >
            <item.icon size={22} strokeWidth={view === item.id ? 2.5 : 2} />
            <span className="text-[10px] font-bold tracking-tight">{item.label}</span>
            {view === item.id && <div className="absolute -top-1 w-1 h-1 bg-cyan-400 rounded-full"></div>}
          </button>
        ))}
        <button 
          onClick={() => setIsFormOpen(true)} 
          className="kora-gradient text-white p-4 rounded-3xl -mt-16 shadow-2xl border-4 border-white active:scale-90 transition-transform"
        >
          <PlusCircle size={26} />
        </button>
      </nav>

      {/* Success Toast */}
      {showToast && (
        <div className="fixed top-6 right-6 left-6 md:left-auto kora-bg-deep text-white px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-top-6 z-[200] border border-white/10">
          <div className="bg-emerald-400/20 p-2 rounded-xl text-emerald-400">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="font-black text-xs uppercase tracking-widest">Kora Cloud</p>
            <p className="text-[11px] text-slate-400 font-medium">Sincronización finalizada.</p>
          </div>
        </div>
      )}

      {(isFormOpen || editingTransaction) && (
        <TransactionForm 
          onClose={() => { setIsFormOpen(false); setEditingTransaction(null); }} 
          onSubmit={saveTransaction} 
          accounts={accounts}
          categories={categories}
          editData={editingTransaction || undefined}
        />
      )}
    </div>
  );
};

export default App;
