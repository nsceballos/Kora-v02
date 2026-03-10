import React, { useState, useEffect } from 'react';
import { Tags, Plus, X, DollarSign, Save, Network, Database, Target, AlertCircle, CheckCircle2, Users as UsersIcon, UserPlus, Trash2 } from 'lucide-react';
import { Budget, UserConfig, USER_COLORS } from '../types';

interface Props {
  categories: string[];
  setCategories: (cats: string[]) => void;
  budgets: Budget[];
  setBudgets: (budgets: Budget[]) => void;
  usdRates: { blue: number; official: number };
  onUpdateRates: (rates: { blue: number; official: number }) => void;
  n8nWebhookUrl: string;
  onUpdateWebhookUrl: (url: string) => void;
  users: UserConfig[];
  onUpdateUsers: (users: UserConfig[]) => void;
  currentUserId: string;
}

const COLOR_BG: Record<UserConfig['color'], string> = {
  indigo: 'bg-indigo-500', rose: 'bg-rose-500', emerald: 'bg-emerald-500',
  amber: 'bg-amber-500', cyan: 'bg-cyan-500', purple: 'bg-purple-500',
};
const COLOR_RING: Record<UserConfig['color'], string> = {
  indigo: 'ring-indigo-500', rose: 'ring-rose-500', emerald: 'ring-emerald-500',
  amber: 'ring-amber-500', cyan: 'ring-cyan-500', purple: 'ring-purple-500',
};

const Settings: React.FC<Props> = ({
  categories, setCategories,
  budgets, setBudgets,
  usdRates, onUpdateRates,
  n8nWebhookUrl, onUpdateWebhookUrl,
  users, onUpdateUsers,
  currentUserId,
}) => {
  const [newCat, setNewCat] = useState('');
  const [localRates, setLocalRates] = useState(usdRates);
  const [localWebhook, setLocalWebhook] = useState(n8nWebhookUrl);
  const [googleWebAppUrl, setGoogleWebAppUrl] = useState('');
  const [localBudgets, setLocalBudgets] = useState<Budget[]>([]);
  const [localUsers, setLocalUsers] = useState<UserConfig[]>(users);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('finance_arch_google_webapp_url');
    if (saved) setGoogleWebAppUrl(saved);
    setLocalBudgets(budgets);
  }, [budgets]);

  const addCategory = () => {
    if (newCat && !categories.includes(newCat)) {
      setCategories([...categories, newCat]);
      setNewCat('');
    }
  };

  const removeCategory = (cat: string) => {
    setCategories(categories.filter(c => c !== cat));
    setLocalBudgets(localBudgets.filter(b => b.category !== cat));
  };

  const updateBudget = (category: string, limit: number) => {
    const exists = localBudgets.find(b => b.category === category);
    let newBudgets;
    if (exists) {
      newBudgets = localBudgets.map(b => b.category === category ? { ...b, limit } : b);
    } else {
      newBudgets = [...localBudgets, { category, limit }];
    }
    setLocalBudgets(newBudgets);
  };

  const handleSaveAll = () => {
    onUpdateRates(localRates);
    onUpdateWebhookUrl(localWebhook);
    setBudgets(localBudgets);
    onUpdateUsers(localUsers);
    localStorage.setItem('finance_arch_google_webapp_url', googleWebAppUrl.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const updateUser = (id: string, patch: Partial<UserConfig>) => {
    setLocalUsers(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));
  };

  const addUser = () => {
    const newUser: UserConfig = {
      id: crypto.randomUUID(),
      name: '',
      pin: '',
      color: USER_COLORS[localUsers.length % USER_COLORS.length],
    };
    setLocalUsers(prev => [...prev, newUser]);
  };

  const removeUser = (id: string) => {
    setLocalUsers(prev => prev.filter(u => u.id !== id));
  };

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-500 pb-20">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Ajustes</h2>
          <p className="text-slate-500 text-sm">Personalización y conectividad del sistema</p>
        </div>
        <button
          onClick={handleSaveAll}
          className={`font-bold py-3 px-8 rounded-2xl transition-all shadow-xl flex items-center gap-2 ${
            saved ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:bg-black'
          }`}
        >
          {saved ? <CheckCircle2 size={20} /> : <Save size={20} />}
          {saved ? 'Guardado' : 'Guardar Todo'}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-10">
        <section className="space-y-6">
          <SectionHeader icon={Database} title="Google Sheets" color="emerald" />
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Google Web App URL</label>
              <input 
                type="text"
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-xs"
                value={googleWebAppUrl}
                onChange={e => setGoogleWebAppUrl(e.target.value)}
              />
              <p className="mt-2 text-[10px] text-slate-400 italic flex items-center gap-1">
                <AlertCircle size={10} /> Pegar la URL de implementación de Apps Script.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <SectionHeader icon={Network} title="Kora AI (n8n)" color="indigo" />
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">n8n Webhook URL</label>
              <input 
                type="text"
                placeholder="https://primary-production.n8n.cloud/webhook/..."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                value={localWebhook}
                onChange={e => setLocalWebhook(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <SectionHeader icon={DollarSign} title="Tipos de Cambio" color="cyan" />
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm grid grid-cols-2 gap-4">
            <RateField label="Oficial" value={localRates.official} onChange={v => setLocalRates({...localRates, official: v})} />
            <RateField label="Blue" value={localRates.blue} onChange={v => setLocalRates({...localRates, blue: v})} />
          </div>
        </section>

        <section className="space-y-6">
          <SectionHeader icon={Target} title="Presupuestos por Categoría" color="rose" />
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-4 max-h-[400px] overflow-y-auto no-scrollbar">
            {categories.map(cat => (
              <div key={cat} className="flex items-center justify-between gap-4 p-3 bg-slate-50 rounded-2xl">
                <span className="text-xs font-bold text-slate-700">{cat}</span>
                <div className="relative w-32">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">$</span>
                  <input 
                    type="number"
                    className="w-full pl-6 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500"
                    value={localBudgets.find(b => b.category === cat)?.limit || 0}
                    onChange={e => updateBudget(cat, parseFloat(e.target.value))}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Usuarios ── */}
        <section className="space-y-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <UsersIcon size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Usuarios</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Sincronizado con Google Sheets</p>
              </div>
            </div>
            <button
              type="button"
              onClick={addUser}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors"
            >
              <UserPlus size={14} /> Añadir usuario
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {localUsers.map((user, i) => {
              const isCurrentUser = user.id === currentUserId;
              const isOnlyUser = localUsers.length === 1;
              return (
                <div key={user.id} className={`bg-white p-6 rounded-3xl border shadow-sm space-y-4 ${isCurrentUser ? 'border-indigo-200 ring-1 ring-indigo-200' : 'border-slate-100'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl ${COLOR_BG[user.color]} flex items-center justify-center text-white font-black text-lg`}>
                        {user.name[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Usuario {i + 1}</span>
                        {isCurrentUser && (
                          <span className="ml-2 px-1.5 py-0.5 bg-indigo-100 text-indigo-600 text-[9px] font-black uppercase rounded-full">Tú</span>
                        )}
                      </div>
                    </div>
                    {!isCurrentUser && !isOnlyUser && (
                      <button
                        type="button"
                        onClick={() => removeUser(user.id)}
                        className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                        title="Eliminar usuario"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nombre</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={user.name}
                      onChange={e => updateUser(user.id, { name: e.target.value })}
                      placeholder="Tu nombre"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">PIN (4 dígitos, opcional)</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono tracking-[0.4em] focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={user.pin}
                      onChange={e => updateUser(user.id, { pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                      placeholder="Sin PIN"
                    />
                    <p className="mt-1 text-[10px] text-slate-400 italic">Si está vacío, no se requiere PIN para ingresar.</p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Color del perfil</label>
                    <div className="flex gap-2">
                      {USER_COLORS.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => updateUser(user.id, { color: c })}
                          className={`w-7 h-7 rounded-full ${COLOR_BG[c]} transition-all ${user.color === c ? `ring-2 ring-offset-2 ${COLOR_RING[c]} scale-110` : 'opacity-50 hover:opacity-80'}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-6 lg:col-span-2">
          <SectionHeader icon={Tags} title="Gestión de Categorías" color="slate" />
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex gap-4 mb-8">
              <input 
                type="text" 
                placeholder="Nueva categoría..." 
                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-400"
                value={newCat}
                onChange={e => setNewCat(e.target.value)}
              />
              <button onClick={addCategory} className="bg-slate-800 text-white px-8 py-3 rounded-xl font-bold hover:bg-black">Añadir</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {categories.map(cat => (
                <div key={cat} className="group flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-white transition-all">
                  <span className="text-xs font-bold text-slate-600">{cat}</span>
                  <button onClick={() => removeCategory(cat)} className="p-1 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100"><X size={14}/></button>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

interface SectionHeaderProps {
  icon: React.ElementType;
  title: string;
  color: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ icon: Icon, title, color }) => (
  <div className="flex items-center gap-3">
    <div className={`p-2 bg-${color}-50 text-${color}-600 rounded-xl`}>
      <Icon size={20} />
    </div>
    <h3 className="text-lg font-bold text-slate-800">{title}</h3>
  </div>
);

interface RateFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

const RateField: React.FC<RateFieldProps> = ({ label, value, onChange }) => (
  <div>
    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</label>
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
      <input 
        type="number"
        className="w-full pl-6 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
      />
    </div>
  </div>
);

export default Settings;