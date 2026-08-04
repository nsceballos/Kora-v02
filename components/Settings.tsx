import React, { useState, useEffect } from 'react';
import { Tags, X, DollarSign, Save, Network, Database, Target, AlertCircle, CheckCircle2, UserCircle, Heart, KeyRound, Loader2, RefreshCw } from 'lucide-react';
import { Budget, AuthUser, UsdRates } from '../types';

interface Props {
  categories: string[];
  setCategories: (cats: string[]) => void;
  budgets: Budget[];
  setBudgets: (budgets: Budget[]) => void;
  usdRates: UsdRates;
  onRefreshRates: () => void;
  ratesLoading: boolean;
  n8nWebhookUrl: string;
  onUpdateWebhookUrl: (url: string) => void;
  currentUser: AuthUser;
  onUpdateName: (name: string) => Promise<void>;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  partnerName: string;
  onUpdatePartnerName: (name: string) => void;
}

const Settings: React.FC<Props> = ({
  categories, setCategories,
  budgets, setBudgets,
  usdRates, onRefreshRates, ratesLoading,
  n8nWebhookUrl, onUpdateWebhookUrl,
  currentUser, onUpdateName, onChangePassword,
  partnerName, onUpdatePartnerName,
}) => {
  const [newCat, setNewCat] = useState('');
  const [localWebhook, setLocalWebhook] = useState(n8nWebhookUrl);
  const [localBudgets, setLocalBudgets] = useState<Budget[]>([]);
  const [localPartnerName, setLocalPartnerName] = useState(partnerName);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLocalBudgets(budgets);
  }, [budgets]);

  useEffect(() => {
    setLocalPartnerName(partnerName);
  }, [partnerName]);

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
    onUpdateWebhookUrl(localWebhook);
    setBudgets(localBudgets);
    if (localPartnerName !== partnerName) onUpdatePartnerName(localPartnerName);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
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
        <AccountSection currentUser={currentUser} onUpdateName={onUpdateName} onChangePassword={onChangePassword} />

        <section className="space-y-6">
          <SectionHeader icon={Heart} title="Gastos Compartidos" color="rose" />
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-3">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Nombre de la persona con quien compartís gastos
            </label>
            <input
              type="text"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-400 outline-none text-sm"
              value={localPartnerName}
              onChange={e => setLocalPartnerName(e.target.value)}
              placeholder="Ej: Mi pareja"
            />
            <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
              Es solo una etiqueta para tus propios registros de "Gastos Compartidos" — no crea ni vincula
              ninguna otra cuenta. Esta información es privada: solo vos podés verla.
            </p>
          </div>
        </section>

        <section className="space-y-6">
          <SectionHeader icon={Database} title="Google Sheets" color="emerald" />
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <p className="text-sm font-bold text-slate-700">Conectado vía cuenta de servicio</p>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Tus datos se guardan en una hoja de cálculo compartida, pero cada fila queda marcada con tu
              usuario: nadie más puede leerlos ni modificarlos, ni siquiera con acceso directo a la hoja
              sin pasar por esta app. Las credenciales de Google se configuran como variables de entorno
              en el servidor (Vercel):
              <span className="font-mono text-slate-500"> GOOGLE_SERVICE_ACCOUNT_EMAIL</span>,
              <span className="font-mono text-slate-500"> GOOGLE_PRIVATE_KEY</span> y
              <span className="font-mono text-slate-500"> GOOGLE_SHEET_ID</span>.
            </p>
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
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <RateCard label="Oficial" value={usdRates.official} />
              <RateCard label="Blue" value={usdRates.blue} />
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
              {usdRates.updatedAt ? (
                <p className="text-[11px] text-slate-400">
                  Actualizado {formatUpdatedAt(usdRates.updatedAt)}
                </p>
              ) : (
                <p className="text-[11px] text-amber-600 flex items-center gap-1.5 font-bold">
                  <AlertCircle size={12} /> Sin conexión con la API — valores de respaldo
                </p>
              )}
              <button
                type="button"
                onClick={onRefreshRates}
                disabled={ratesLoading}
                className="flex items-center gap-1.5 px-3 py-2 bg-cyan-50 text-cyan-700 text-[11px] font-bold rounded-xl hover:bg-cyan-100 transition-colors disabled:opacity-50 shrink-0"
              >
                <RefreshCw size={12} className={ratesLoading ? 'animate-spin' : ''} />
                Actualizar
              </button>
            </div>

            <p className="text-[10px] text-slate-400 italic">
              Cotización de venta, obtenida automáticamente de dolarapi.com. Se actualiza al abrir la app.
            </p>
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

interface AccountSectionProps {
  currentUser: AuthUser;
  onUpdateName: (name: string) => Promise<void>;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AccountSection: React.FC<AccountSectionProps> = ({ currentUser, onUpdateName, onChangePassword }) => {
  const [name, setName] = useState(currentUser.name);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => setName(currentUser.name), [currentUser.name]);

  const handleSaveName = async () => {
    if (!name.trim() || name.trim() === currentUser.name) return;
    setNameSaving(true);
    try {
      await onUpdateName(name.trim());
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2500);
    } finally {
      setNameSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);

    if (newPassword.length < 6) return setPwError('La nueva contraseña debe tener al menos 6 caracteres.');
    if (newPassword !== confirmPassword) return setPwError('Las contraseñas no coinciden.');

    setPwSaving(true);
    try {
      await onChangePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 2500);
    } catch (err: any) {
      setPwError(err?.message === 'INVALID_PASSWORD' ? 'La contraseña actual es incorrecta.' : (err?.message || 'No se pudo cambiar la contraseña.'));
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <SectionHeader icon={UserCircle} title="Mi Cuenta" color="indigo" />
      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email</label>
          <p className="text-sm text-slate-500 px-1">{currentUser.email}</p>
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nombre</label>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <button
              type="button"
              onClick={handleSaveName}
              disabled={nameSaving || !name.trim() || name.trim() === currentUser.name}
              className={`px-4 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 ${nameSaved ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
            >
              {nameSaving ? <Loader2 size={14} className="animate-spin" /> : nameSaved ? <CheckCircle2 size={14} /> : 'Guardar'}
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <KeyRound size={14} className="text-slate-400" />
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Cambiar contraseña</label>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-3">
            <input
              type="password"
              placeholder="Contraseña actual"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Nueva contraseña"
              minLength={6}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Repetir nueva contraseña"
              minLength={6}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
            {pwError && (
              <p className="flex items-center gap-1.5 text-rose-500 text-xs font-bold"><AlertCircle size={12} /> {pwError}</p>
            )}
            <button
              type="submit"
              disabled={pwSaving}
              className={`w-full py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 ${pwSaved ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-white hover:bg-black'}`}
            >
              {pwSaving ? <Loader2 size={14} className="animate-spin mx-auto" /> : pwSaved ? 'Contraseña actualizada' : 'Actualizar contraseña'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};

interface SectionHeaderProps {
  icon: React.ElementType;
  title: string;
  color: string;
}

const SECTION_COLORS: Record<string, string> = {
  emerald: 'bg-emerald-50 text-emerald-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  cyan: 'bg-cyan-50 text-cyan-600',
  rose: 'bg-rose-50 text-rose-600',
  slate: 'bg-slate-50 text-slate-600',
};

const SectionHeader: React.FC<SectionHeaderProps> = ({ icon: Icon, title, color }) => (
  <div className="flex items-center gap-3">
    <div className={`p-2 rounded-xl ${SECTION_COLORS[color] ?? SECTION_COLORS.slate}`}>
      <Icon size={20} />
    </div>
    <h3 className="text-lg font-bold text-slate-800">{title}</h3>
  </div>
);

/** "hace 5 min" / "hace 2 h" / fecha corta si es de otro día. */
const formatUpdatedAt = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;

  const minutes = Math.floor((Date.now() - then) / 60000);
  if (minutes < 1) return 'recién';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return new Date(then).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const RateCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
    <p className="text-xl font-black text-slate-800 tracking-tight">
      ${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </p>
  </div>
);

export default Settings;
