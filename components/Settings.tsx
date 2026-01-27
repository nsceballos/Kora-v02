import React, { useState, useEffect } from 'react';
import { Tags, Plus, X, DollarSign, Save, Network, Database, Target, AlertCircle } from 'lucide-react';
import { Budget } from '../types';

interface Props {
  categories: string[];
  setCategories: (cats: string[]) => void;
  budgets: Budget[];
  setBudgets: (budgets: Budget[]) => void;
  usdRates: { blue: number; official: number };
  onUpdateRates: (rates: { blue: number; official: number }) => void;
  n8nWebhookUrl: string;
  onUpdateWebhookUrl: (url: string) => void;
}

const Settings: React.FC<Props> = ({ 
  categories, setCategories, 
  budgets, setBudgets,
  usdRates, onUpdateRates, 
  n8nWebhookUrl, onUpdateWebhookUrl 
}) => {
  const [newCat, setNewCat] = useState('');
  const [localRates, setLocalRates] = useState(usdRates);
  const [localWebhook, setLocalWebhook] = useState(n8nWebhookUrl);
  const [googleWebAppUrl, setGoogleWebAppUrl] = useState('');
  const [localBudgets, setLocalBudgets] = useState<Budget[]>([]);

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
    localStorage.setItem('finance_arch_google_webapp_url', googleWebAppUrl.trim());
    alert("Configuración guardada correctamente.");
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-20">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Ajustes</h2>
          <p className="text-slate-500 text-sm">Personalización y conectividad del sistema</p>
        </div>
        <button 
          onClick={handleSaveAll}
          className="bg-slate-900 text-white font-bold py-3 px-8 rounded-2xl hover:bg-black transition-all shadow-xl flex items-center gap-2"
        >
          <Save size={20} />
          Guardar Todo
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
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

const SectionHeader = ({ icon: Icon, title, color }: any) => (
  <div className="flex items-center gap-3">
    <div className={`p-2 bg-${color}-50 text-${color}-600 rounded-xl`}>
      <Icon size={20} />
    </div>
    <h3 className="text-lg font-bold text-slate-800">{title}</h3>
  </div>
);

const RateField = ({ label, value, onChange }: any) => (
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