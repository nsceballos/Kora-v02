import React, { useState, useEffect, useCallback } from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  Wallet, 
  Users, 
  BrainCircuit, 
  PlusCircle,
  Settings as SettingsIcon,
  RefreshCw,
  CheckCircle2,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Transaction, TransactionType, Account, Currency, Budget } from './types';
import Dashboard from './components/Dashboard';
import TransactionsList from './components/TransactionsList';
import AccountsManager from './components/AccountsManager';
import SharedExpenses from './components/SharedExpenses';
import AIAdvisor from './components/AIAdvisor';
import TransactionForm from './components/TransactionForm';
import Settings from './components/Settings';
import { sheetService } from './services/sheetService';

const INITIAL_CATEGORIES = ['Alimentación', 'Vivienda', 'Ocio', 'Transporte', 'Salud', 'Educación', 'Servicios', 'Suscripciones', 'Otros'];

const App: React.FC = () => {
  const [view, setView] = useState<'dashboard' | 'transactions' | 'accounts' | 'shared' | 'ai' | 'settings'>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<string[]>(INITIAL_CATEGORIES);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [usdRates, setUsdRates] = useState({ blue: 1240, official: 980 });
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState<string>('');
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const init = useCallback(async () => {
    try {
      setIsSyncing(true);
      setSyncError(null);
      
      // Intentar sincronizar cola offline primero
      await sheetService.flushQueue();
      
      const data = await sheetService.getAppData();
      setTransactions(data.transactions);
      setAccounts(data.accounts);
      if (data.categories?.length > 0) setCategories(data.categories);
      if (data.budgets?.length > 0) setBudgets(data.budgets);

      const savedRates = localStorage.getItem('finance_arch_rates');
      if (savedRates) setUsdRates(JSON.parse(savedRates));

      const savedWebhook = localStorage.getItem('finance_arch_n8n_webhook');
      if (savedWebhook) setN8nWebhookUrl(savedWebhook);
    } catch (e) {
      setSyncError("Error de conexión. Trabajando en modo local.");
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => { init(); }, [init]);

  const saveTransaction = async (newT: Transaction) => {
    setIsSyncing(true);
    let updatedTransactions = [...transactions];
    if (editingTransaction) {
      updatedTransactions = transactions.filter(t => t.id !== editingTransaction.id);
      updateBalanceLocal(editingTransaction, true);
    }
    updatedTransactions.push({ ...newT, synced: false });
    setTransactions(updatedTransactions);
    updateBalanceLocal(newT, false);
    setIsFormOpen(false);
    setEditingTransaction(null);

    try {
      const success = await sheetService.saveTransaction(newT);
      if (success) {
        setTransactions(prev => prev.map(t => t.id === newT.id ? { ...t, synced: true } : t));
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateBudgets = async (newBudgets: Budget[]) => {
    setBudgets(newBudgets);
    await sheetService.saveBudgets(newBudgets);
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

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions', label: 'Historial', icon: Receipt },
    { id: 'accounts', label: 'Cuentas', icon: Wallet },
    { id: 'shared', label: 'Gastos Pareja', icon: Users },
    { id: 'settings', label: 'Ajustes', icon: SettingsIcon },
    { id: 'ai', label: 'Kora AI', icon: BrainCircuit }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900">
        <Loader2 className="animate-spin text-cyan-400 mb-4" size={48} />
        <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">Cargando Kora...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f8fafc]">
      {/* Desktop Sidebar */}
      <nav className="hidden md:flex flex-col w-72 bg-slate-900 text-white p-8 shrink-0">
        <div className="flex items-center gap-4 mb-12">
          <div className="w-10 h-10 kora-gradient rounded-xl flex items-center justify-center font-black">K</div>
          <h1 className="text-2xl font-black tracking-tighter">Kora</h1>
        </div>
        
        <div className="space-y-2 flex-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id as any)}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all ${
                view === item.id ? 'bg-white/10 text-cyan-400 shadow-inner' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <item.icon size={20} />
              <span className="font-bold text-sm">{item.label}</span>
            </button>
          ))}
        </div>

        <button 
          onClick={() => setIsFormOpen(true)}
          className="w-full kora-gradient text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-xl hover:scale-[1.02] transition-transform active:scale-95"
        >
          <PlusCircle size={20} /> NUEVO REGISTRO
        </button>
      </nav>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="flex items-center justify-between px-6 md:px-12 py-6 bg-white border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-black text-slate-800 hidden md:block">
              {navItems.find(n => n.id === view)?.label}
            </h1>
            {isSyncing && (
              <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full animate-pulse">
                <RefreshCw size={12} className="animate-spin" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Sincronizando...</span>
              </div>
            )}
            {syncError && !isSyncing && (
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-600 rounded-full">
                <AlertCircle size={12} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Modo Local</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
             <div className="p-2 bg-slate-50 rounded-full text-slate-400 hover:bg-slate-100 transition-colors">
               <RefreshCw size={18} onClick={init} className={`cursor-pointer ${isSyncing ? 'animate-spin' : ''}`} />
             </div>
          </div>
        </header>

        <main className="flex-1 p-6 md:p-12 overflow-y-auto no-scrollbar pb-32">
          <div className="max-w-6xl mx-auto">
            {view === 'dashboard' && <Dashboard transactions={transactions} accounts={accounts} budgets={budgets} usdRate={usdRates.official} blueRate={usdRates.blue} />}
            {view === 'transactions' && <TransactionsList transactions={transactions} categories={categories} onEdit={(t) => { setEditingTransaction(t); setIsFormOpen(true); }} />}
            {view === 'accounts' && <AccountsManager accounts={accounts} onAddAccount={(a) => sheetService.saveAccount(a).then(init)} onUpdateAccount={(a) => sheetService.saveAccount(a).then(init)} />}
            {view === 'shared' && <SharedExpenses transactions={transactions} usdRate={usdRates.official} onSettle={init} />}
            {view === 'settings' && (
              <Settings 
                categories={categories} setCategories={(c) => sheetService.saveCategories(c).then(init)} 
                budgets={budgets} setBudgets={handleUpdateBudgets}
                usdRates={usdRates} onUpdateRates={setUsdRates} 
                n8nWebhookUrl={n8nWebhookUrl} onUpdateWebhookUrl={setN8nWebhookUrl} 
              />
            )}
            {view === 'ai' && <AIAdvisor transactions={transactions} budgets={budgets} accounts={accounts} webhookUrl={n8nWebhookUrl} />}
          </div>
        </main>
      </div>

      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 flex justify-around p-4 pb-8 z-50">
        {navItems.slice(0, 4).map(item => (
          <button key={item.id} onClick={() => setView(item.id as any)} className={`flex flex-col items-center gap-1 ${view === item.id ? 'text-indigo-600' : 'text-slate-400'}`}>
            <item.icon size={20} />
            <span className="text-[9px] font-bold uppercase">{item.label}</span>
          </button>
        ))}
        <button onClick={() => setIsFormOpen(true)} className="bg-indigo-600 text-white p-4 rounded-3xl -mt-12 shadow-2xl border-4 border-white active:scale-90 transition-transform"><PlusCircle size={24} /></button>
      </nav>

      {showToast && (
        <div className="fixed top-8 right-8 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right-10 z-[200]">
          <CheckCircle2 size={24} className="text-emerald-400" />
          <p className="text-xs font-bold uppercase tracking-widest">Sincronizado</p>
        </div>
      )}

      {(isFormOpen || editingTransaction) && (
        <TransactionForm onClose={() => { setIsFormOpen(false); setEditingTransaction(null); }} onSubmit={saveTransaction} accounts={accounts} categories={categories} editData={editingTransaction || undefined} />
      )}
    </div>
  );
};

export default App;