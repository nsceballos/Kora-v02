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
  AlertCircle,
  LogOut,
} from 'lucide-react';
import { Transaction, TransactionType, Account, Currency, Budget, AuthUser, Settlement, DEFAULT_SPLIT } from './types';
import Dashboard from './components/Dashboard';
import TransactionsList from './components/TransactionsList';
import AccountsManager from './components/AccountsManager';
import SharedExpenses from './components/SharedExpenses';
import AIAdvisor from './components/AIAdvisor';
import TransactionForm from './components/TransactionForm';
import Settings from './components/Settings';
import { sheetService, UnauthorizedError } from './services/sheetService';
import { authService } from './services/authService';
import LoginScreen from './components/LoginScreen';

const INITIAL_CATEGORIES = ['Alimentación', 'Vivienda', 'Ocio', 'Transporte', 'Salud', 'Educación', 'Servicios', 'Suscripciones', 'Otros'];

const USER_AVATAR_COLORS: Record<string, string> = {
  indigo:  'bg-indigo-500',
  rose:    'bg-rose-500',
  emerald: 'bg-emerald-500',
  amber:   'bg-amber-500',
  cyan:    'bg-cyan-500',
  purple:  'bg-purple-500',
};

type AppView = 'dashboard' | 'transactions' | 'accounts' | 'shared' | 'ai' | 'settings';
type AppPhase = 'loading' | 'auth' | 'app';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<string[]>(INITIAL_CATEGORIES);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [partnerName, setPartnerName] = useState<string>('Pareja');
  const [myPercent, setMyPercent] = useState<number>(DEFAULT_SPLIT);
  const [usdRates, setUsdRates] = useState({ blue: 1240, official: 980 });
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState<string>('');

  // ── App Phase & Auth ────────────────────────────────────────
  const [phase, setPhase] = useState<AppPhase>('loading');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  // ── Bootstrap: restore a previous session, if any ───────────
  useEffect(() => {
    const token = authService.getToken();
    const storedUser = authService.getStoredUser();
    if (token && storedUser) {
      setCurrentUser(storedUser);
      setPhase('app');
    } else {
      setPhase('auth');
    }
  }, []);

  // ── Auth handlers ─────────────────────────────────────────────
  const handleLogin = async (email: string, password: string) => {
    const user = await authService.login(email, password);
    setCurrentUser(user);
    setPhase('app');
  };

  const handleRegister = async (name: string, email: string, password: string) => {
    const user = await authService.register(name, email, password);
    setCurrentUser(user);
    setPhase('app');
  };

  const resetAppState = () => {
    setTransactions([]);
    setAccounts([]);
    setCategories(INITIAL_CATEGORIES);
    setBudgets([]);
    setSettlements([]);
    setPartnerName('Pareja');
    setMyPercent(DEFAULT_SPLIT);
    setView('dashboard');
  };

  const handleLogout = () => {
    authService.clearSession();
    setCurrentUser(null);
    resetAppState();
    setIsLoading(true);
    setPhase('auth');
  };

  const handleUpdateName = async (name: string) => {
    const updated = await sheetService.updateProfile(name);
    if (updated) {
      setCurrentUser(prev => prev ? { ...prev, name: updated.name } : prev);
      authService.updateStoredUser(updated as AuthUser);
    }
  };

  const handleChangePassword = async (currentPassword: string, newPassword: string) => {
    await sheetService.changePassword(currentPassword, newPassword);
  };

  const handleUpdatePartnerName = async (name: string) => {
    const trimmed = name.trim() || 'Pareja';
    setPartnerName(trimmed);
    try {
      await sheetService.saveConfig('partner_name', trimmed);
    } catch (e) {
      console.error('Error guardando nombre de pareja:', e);
    }
  };

  // ── Data loading ────────────────────────────────────────────
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

      sheetService.flushQueue().catch(console.error);

      const data = await sheetService.getAppData();

      if (data && Array.isArray(data.transactions) && Array.isArray(data.accounts)) {
        setTransactions(data.transactions);
        setAccounts(data.accounts);
        if (data.categories?.length > 0) setCategories(data.categories);
        if (data.budgets?.length > 0) setBudgets(data.budgets);
        setSettlements(data.settlements ?? []);
        if (data.config?.partner_name) setPartnerName(data.config.partner_name);
        if (data.config?.split_my_percent) {
          const parsed = parseInt(data.config.split_my_percent, 10);
          if (!Number.isNaN(parsed)) setMyPercent(parsed);
        }
      }

      const savedRates = localStorage.getItem('finance_arch_rates');
      if (savedRates) setUsdRates(JSON.parse(savedRates));

      const savedWebhook = localStorage.getItem('finance_arch_n8n_webhook');
      if (savedWebhook) setN8nWebhookUrl(savedWebhook);
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        // Sesión inválida o expirada: hay que volver a iniciar sesión.
        authService.clearSession();
        setCurrentUser(null);
        resetAppState();
        setIsLoading(false);
        setIsSyncing(false);
        setPhase('auth');
        return;
      }
      console.error("Error init:", e);
      setSyncError("Modo Offline");
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => { if (phase === 'app' && currentUser) init(); }, [phase, currentUser, init]);

  const showSuccessToast = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const saveTransaction = async (newT: Transaction) => {
    let updatedTransactions = [...transactions];
    if (editingTransaction) {
      updatedTransactions = transactions.filter(t => t.id !== editingTransaction.id);
      updateBalanceLocal(editingTransaction, true);
    }

    const transactionToSave = { ...newT, synced: false };
    updatedTransactions.push(transactionToSave);

    setTransactions(updatedTransactions);
    updateBalanceLocal(newT, false);

    setIsFormOpen(false);
    setEditingTransaction(null);
    setIsSyncing(true);

    try {
      await sheetService.saveTransaction(newT);
      setTransactions(prev => prev.map(t => t.id === newT.id ? { ...t, synced: true } : t));
      showSuccessToast();
    } catch (e) {
      console.error("Error guardando transacción:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveAccount = async (acc: Account) => {
    const exists = accounts.find(a => a.id === acc.id);
    let newAccounts;

    if (exists) {
      newAccounts = accounts.map(a => a.id === acc.id ? acc : a);
    } else {
      newAccounts = [...accounts, acc];
    }

    setAccounts(newAccounts);
    setIsSyncing(true);

    try {
      await sheetService.saveAccount(acc);
      showSuccessToast();
    } catch (e) {
      console.error("Sync error accounts:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  /** Cierre mensual: marca los gastos compartidos pendientes como saldados y registra el cierre */
  const handleMonthlyClose = async (settlement: Settlement) => {
    const pendingShared = transactions.filter(t => t.isShared && !t.isSettled);
    if (pendingShared.length === 0) return;

    const settled = pendingShared.map(t => ({ ...t, isSettled: true }));
    setTransactions(prev => prev.map(t => settled.find(s => s.id === t.id) || t));
    setSettlements(prev => [settlement, ...prev]);
    setIsSyncing(true);

    try {
      await Promise.all([
        sheetService.saveSettlement(settlement),
        ...settled.map(t => sheetService.saveTransaction(t)),
      ]);
      showSuccessToast();
    } catch (e) {
      console.error("Error cerrando el mes:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  /** Actualiza el % de aporte del usuario actual a los gastos compartidos (persiste en Google Sheets) */
  const handleUpdateSplit = async (percent: number) => {
    setMyPercent(percent);
    try {
      await sheetService.saveConfig('split_my_percent', String(percent));
    } catch (e) {
      console.error("Error guardando reparto:", e);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    const t = transactions.find(tx => tx.id === id);
    if (!t) return;

    updateBalanceLocal(t, true);
    setTransactions(prev => prev.filter(tx => tx.id !== id));
    setIsSyncing(true);

    try {
      await sheetService.deleteTransaction(id);
    } catch (e) {
      console.error("Error eliminando transacción:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    setAccounts(prev => prev.filter(a => a.id !== id));
    setIsSyncing(true);
    try {
      await sheetService.deleteAccount(id);
    } catch (e) {
      console.error("Error eliminando cuenta:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateBudgets = async (newBudgets: Budget[]) => {
    setBudgets(newBudgets);
    setIsSyncing(true);
    try {
      await sheetService.saveBudgets(newBudgets);
    } finally {
      setIsSyncing(false);
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

  const navItems: { id: AppView; label: string; shortLabel: string; icon: typeof LayoutDashboard }[] = [
    { id: 'dashboard',    label: 'Dashboard',     shortLabel: 'Inicio',    icon: LayoutDashboard },
    { id: 'transactions', label: 'Historial',     shortLabel: 'Historial', icon: Receipt },
    { id: 'accounts',    label: 'Cuentas',        shortLabel: 'Cuentas',   icon: Wallet },
    { id: 'shared',      label: 'Gastos Pareja',  shortLabel: 'Pareja',    icon: Users },
    { id: 'settings',    label: 'Ajustes',        shortLabel: 'Ajustes',   icon: SettingsIcon },
    { id: 'ai',          label: 'Kora AI',        shortLabel: 'IA',        icon: BrainCircuit }
  ];

  // ── Phase: Loading ──────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 gap-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 kora-gradient rounded-2xl flex items-center justify-center font-black text-white text-lg">K</div>
          <h1 className="text-3xl font-black text-white tracking-tighter">Kora</h1>
        </div>
        <Loader2 className="animate-spin text-cyan-400" size={36} />
        <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px]">Conectando...</p>
      </div>
    );
  }

  // ── Phase: Auth (login / registro) ───────────────────────────
  if (phase === 'auth') {
    return <LoginScreen onLogin={handleLogin} onRegister={handleRegister} />;
  }

  // ── Phase: App (loading data) ───────────────────────────────
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
      <nav className="hidden md:flex flex-col w-60 lg:w-72 bg-slate-900 text-white p-6 lg:p-8 shrink-0">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-9 h-9 kora-gradient rounded-xl flex items-center justify-center font-black text-sm">K</div>
          <h1 className="text-xl lg:text-2xl font-black tracking-tighter">Kora</h1>
        </div>

        <div className="space-y-1 flex-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
                view === item.id ? 'bg-white/10 text-cyan-400 shadow-inner' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <item.icon size={18} />
              <span className="font-bold text-sm">{item.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setIsFormOpen(true)}
          className="w-full kora-gradient text-white font-bold py-3 lg:py-4 rounded-2xl flex items-center justify-center gap-2 shadow-xl hover:scale-[1.02] transition-transform active:scale-95 text-sm"
        >
          <PlusCircle size={18} /> NUEVO REGISTRO
        </button>
      </nav>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="flex items-center justify-between px-4 md:px-8 lg:px-12 py-4 md:py-5 bg-white border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-base md:text-xl font-black text-slate-800">
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
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-50 rounded-full text-slate-400 hover:bg-slate-100 transition-colors cursor-pointer" onClick={init}>
              <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
            </div>
            {/* Avatar + nombre del usuario activo */}
            <div className="flex items-center gap-2 pl-1">
              <div className={`w-7 h-7 rounded-lg ${USER_AVATAR_COLORS[currentUser?.color ?? 'indigo'] ?? 'bg-indigo-500'} flex items-center justify-center text-white text-xs font-black`}>
                {currentUser?.name[0]?.toUpperCase()}
              </div>
              <span className="text-sm font-bold text-slate-600 hidden sm:block">{currentUser?.name}</span>
              <button
                onClick={handleLogout}
                title="Cerrar sesión"
                className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 lg:p-12 overflow-y-auto no-scrollbar pb-28 md:pb-8">
          <div className="max-w-6xl mx-auto">
            {view === 'dashboard' && <Dashboard transactions={transactions} accounts={accounts} budgets={budgets} usdRate={usdRates.official} blueRate={usdRates.blue} />}
            {view === 'transactions' && <TransactionsList transactions={transactions} categories={categories} onEdit={(t) => { setEditingTransaction(t); setIsFormOpen(true); }} onDelete={handleDeleteTransaction} />}
            {view === 'accounts' && <AccountsManager accounts={accounts} onAddAccount={handleSaveAccount} onUpdateAccount={handleSaveAccount} onDeleteAccount={handleDeleteAccount} />}
            {view === 'shared' && currentUser && (
              <SharedExpenses
                transactions={transactions}
                usdRate={usdRates.official}
                onSettle={handleMonthlyClose}
                currentUser={currentUser}
                partnerName={partnerName}
                settlements={settlements}
                myPercent={myPercent}
                onUpdateSplit={handleUpdateSplit}
              />
            )}
            {view === 'settings' && currentUser && (
              <Settings
                categories={categories} setCategories={(c) => sheetService.saveCategories(c).then(init)}
                budgets={budgets} setBudgets={handleUpdateBudgets}
                usdRates={usdRates} onUpdateRates={setUsdRates}
                n8nWebhookUrl={n8nWebhookUrl} onUpdateWebhookUrl={setN8nWebhookUrl}
                currentUser={currentUser}
                onUpdateName={handleUpdateName}
                onChangePassword={handleChangePassword}
                partnerName={partnerName}
                onUpdatePartnerName={handleUpdatePartnerName}
              />
            )}
            {view === 'ai' && <AIAdvisor transactions={transactions} budgets={budgets} accounts={accounts} webhookUrl={n8nWebhookUrl} />}
          </div>
        </main>
      </div>

      {/* Mobile Nav — 3 items | FAB | 3 items */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 z-50">
        <div className="flex justify-around items-end px-1 pt-2" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          {navItems.slice(0, 3).map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 min-w-0 ${view === item.id ? 'text-indigo-600' : 'text-slate-400'}`}
            >
              <item.icon size={19} />
              <span className="text-[7px] font-bold uppercase tracking-tight leading-none">{item.shortLabel}</span>
            </button>
          ))}

          <button
            onClick={() => setIsFormOpen(true)}
            className="flex-shrink-0 bg-indigo-600 text-white p-3 rounded-2xl -mt-7 shadow-2xl border-[3px] border-white active:scale-90 transition-transform"
          >
            <PlusCircle size={22} />
          </button>

          {navItems.slice(3, 6).map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 min-w-0 ${view === item.id ? 'text-indigo-600' : 'text-slate-400'}`}
            >
              <item.icon size={19} />
              <span className="text-[7px] font-bold uppercase tracking-tight leading-none">{item.shortLabel}</span>
            </button>
          ))}
        </div>
      </nav>

      {showToast && (
        <div className="fixed top-8 right-8 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right-10 z-[200]">
          <CheckCircle2 size={24} className="text-emerald-400" />
          <p className="text-xs font-bold uppercase tracking-widest">Guardado</p>
        </div>
      )}

      {(isFormOpen || editingTransaction) && currentUser && (
        <TransactionForm
          onClose={() => { setIsFormOpen(false); setEditingTransaction(null); }}
          onSubmit={saveTransaction}
          accounts={accounts}
          categories={categories}
          editData={editingTransaction || undefined}
          currentUserName={currentUser.name}
          partnerName={partnerName}
        />
      )}
    </div>
  );
};

export default App;
