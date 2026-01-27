import React, { useState, useEffect } from 'react';
import { Tags, Plus, X, DollarSign, Save, Network, Database } from 'lucide-react';

interface Props {
  categories: string[];
  setCategories: (cats: string[]) => void;
  usdRates: { blue: number; official: number };
  onUpdateRates: (rates: { blue: number; official: number }) => void;
  n8nWebhookUrl: string;
  onUpdateWebhookUrl: (url: string) => void;
}

const Settings: React.FC<Props> = ({ categories, setCategories, usdRates, onUpdateRates, n8nWebhookUrl, onUpdateWebhookUrl }) => {
  const [newCat, setNewCat] = useState('');
  const [localRates, setLocalRates] = useState(usdRates);
  const [localWebhook, setLocalWebhook] = useState(n8nWebhookUrl);
  const [googleWebAppUrl, setGoogleWebAppUrl] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('finance_arch_google_webapp_url');
    if (saved) setGoogleWebAppUrl(saved);
  }, []);

  const addCategory = () => {
    if (newCat && !categories.includes(newCat)) {
      setCategories([...categories, newCat]);
      setNewCat('');
    }
  };

  const removeCategory = (cat: string) => {
    setCategories(categories.filter(c => c !== cat));
  };

  const handleSaveRates = () => {
    onUpdateRates(localRates);
  };

  const handleSaveAI = () => {
    onUpdateWebhookUrl(localWebhook);
    alert("Configuración de IA actualizada.");
  };

  const handleSaveGoogleSheets = () => {
    localStorage.setItem('finance_arch_google_webapp_url', googleWebAppUrl);
    alert("URL de Google Sheets guardada.");
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-12">
      <header>
        <h2 className="text-3xl font-bold text-slate-800">Ajustes</h2>
        <p className="text-slate-500">Configuración global del sistema</p>
      </header>

      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
            <Database size={24} />
          </div>
          <h3 className="text-xl font-bold text-slate-800">Conexión con Google Sheets</h3>
        </div>
        
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm max-w-2xl space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Google Web App URL</label>
            <input 
              type="text"
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              value={googleWebAppUrl}
              onChange={e => setGoogleWebAppUrl(e.target.value)}
            />
            <p className="mt-2 text-xs text-slate-400 italic">
              Pega aquí la URL que obtienes al {"Implementar > Nueva implementación"} en Apps Script.
            </p>
          </div>
          <button 
            onClick={handleSaveGoogleSheets}
            className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
          >
            <Save size={20} />
            Sincronizar Google Sheets
          </button>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <Network size={24} />
          </div>
          <h3 className="text-xl font-bold text-slate-800">Configuración de IA (n8n)</h3>
        </div>
        
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm max-w-2xl space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">n8n Webhook URL</label>
            <input 
              type="text"
              placeholder="https://primary-production.n8n.cloud/webhook/..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              value={localWebhook}
              onChange={e => setLocalWebhook(e.target.value)}
            />
          </div>
          <button 
            onClick={handleSaveAI}
            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
          >
            <Save size={20} />
            Guardar Configuración IA
          </button>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <DollarSign size={24} />
          </div>
          <h3 className="text-xl font-bold text-slate-800">Tipos de Cambio (ARS/USD)</h3>
        </div>
        
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Dólar Oficial</label>
            <input 
              type="number"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              value={localRates.official}
              onChange={e => setLocalRates({...localRates, official: parseFloat(e.target.value)})}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Dólar Blue</label>
            <input 
              type="number"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              value={localRates.blue}
              onChange={e => setLocalRates({...localRates, blue: parseFloat(e.target.value)})}
            />
          </div>
          <button 
            onClick={handleSaveRates}
            className="sm:col-span-2 w-full bg-slate-800 text-white font-bold py-3 rounded-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-2"
          >
            <Save size={20} />
            Actualizar Monedas
          </button>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <Tags size={24} />
          </div>
          <h3 className="text-xl font-bold text-slate-800">Categorías</h3>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm max-w-2xl">
          <div className="flex gap-4 mb-8">
            <input 
              type="text" 
              placeholder="Nueva categoría..." 
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
            />
            <button 
              onClick={addCategory}
              className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2"
            >
              <Plus size={20} />
              Añadir
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {categories.map(cat => (
              <div key={cat} className="group flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-white transition-all">
                <span className="font-semibold text-slate-700">{cat}</span>
                <button 
                  onClick={() => removeCategory(cat)}
                  className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Settings;