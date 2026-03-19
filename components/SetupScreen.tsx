import React, { useState } from 'react';
import { Settings, ExternalLink, Database, Key, ArrowRight, AlertCircle } from 'lucide-react';

interface Props {
  onSave: (config: { clientId: string; spreadsheetId: string }) => void;
  initialConfig?: { clientId: string; spreadsheetId: string } | null;
}

const SetupScreen: React.FC<Props> = ({ onSave, initialConfig }) => {
  const [clientId, setClientId] = useState(initialConfig?.clientId || '');
  const [spreadsheetId, setSpreadsheetId] = useState(initialConfig?.spreadsheetId || '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedClient = clientId.trim();
    const trimmedSheet = spreadsheetId.trim();

    if (!trimmedClient) {
      setError('El Client ID de Google es obligatorio');
      return;
    }
    if (!trimmedSheet) {
      setError('El ID de la hoja de Google Sheets es obligatorio');
      return;
    }

    // Extract spreadsheet ID from URL if pasted full URL
    let finalSheetId = trimmedSheet;
    const urlMatch = trimmedSheet.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatch) {
      finalSheetId = urlMatch[1];
    }

    onSave({ clientId: trimmedClient, spreadsheetId: finalSheetId });
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 kora-gradient rounded-2xl flex items-center justify-center font-black text-white text-lg">K</div>
        <h1 className="text-3xl font-black text-white tracking-tighter">Kora</h1>
      </div>

      <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mb-8">Configuración inicial</p>

      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6">
        {/* Google Client ID */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-white text-sm font-bold">
            <Key size={16} className="text-cyan-400" />
            Google OAuth Client ID
          </label>
          <input
            type="text"
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            placeholder="123456789-xxxxxxxxx.apps.googleusercontent.com"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
          />
          <p className="text-slate-500 text-[11px]">
            Crealo en{' '}
            <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:underline inline-flex items-center gap-1">
              Google Cloud Console <ExternalLink size={10} />
            </a>
          </p>
        </div>

        {/* Spreadsheet ID */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-white text-sm font-bold">
            <Database size={16} className="text-emerald-400" />
            Google Sheets ID o URL
          </label>
          <input
            type="text"
            value={spreadsheetId}
            onChange={e => setSpreadsheetId(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/abc123... o solo el ID"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all"
          />
          <p className="text-slate-500 text-[11px]">
            Pega la URL completa o solo el ID de tu hoja de cálculo de Google Sheets.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-bold">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        <button
          type="submit"
          className="w-full kora-gradient text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-xl hover:scale-[1.02] transition-transform active:scale-95"
        >
          Conectar con Google Sheets
          <ArrowRight size={18} />
        </button>

        {/* Help section */}
        <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-3">
          <p className="text-white text-xs font-bold flex items-center gap-2">
            <Settings size={14} className="text-slate-400" />
            Pasos para configurar:
          </p>
          <ol className="text-slate-400 text-[11px] space-y-2 list-decimal list-inside">
            <li>Ve a <span className="text-cyan-400">Google Cloud Console</span> y crea un proyecto</li>
            <li>Habilita la <span className="text-cyan-400">Google Sheets API</span></li>
            <li>Crea credenciales <span className="text-cyan-400">OAuth 2.0</span> (tipo: Aplicación web)</li>
            <li>Agrega <span className="text-cyan-400">{typeof window !== 'undefined' ? window.location.origin : 'tu-dominio'}</span> como origen autorizado</li>
            <li>Crea una <span className="text-emerald-400">hoja de Google Sheets</span> vacía</li>
            <li>Copia el Client ID y el ID/URL de la hoja aquí</li>
          </ol>
        </div>
      </form>

      <p className="text-slate-700 text-[10px] mt-12 uppercase tracking-widest font-bold">
        Kora — Finanzas personales
      </p>
    </div>
  );
};

export default SetupScreen;
