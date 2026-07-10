import React, { useState } from 'react';
import { Lock, ArrowRight, Loader2 } from 'lucide-react';

interface Props {
  onUnlock: (token: string) => Promise<void>;
}

/**
 * Shown only when the backend has KORA_ACCESS_TOKEN configured and the client
 * hasn't provided a matching token yet. Acts as a lightweight shared-secret
 * gate so the Sheets data isn't world-readable through the public API.
 */
const UnlockScreen: React.FC<Props> = ({ onUnlock }) => {
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onUnlock(token.trim());
    } catch {
      setError('Código incorrecto. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-11 h-11 kora-gradient rounded-2xl flex items-center justify-center font-black text-white text-lg">K</div>
        <h1 className="text-3xl font-black text-white tracking-tighter">Kora</h1>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
        <div className="flex flex-col items-center gap-3 mb-2">
          <div className="p-3 bg-white/5 border border-white/10 rounded-2xl text-cyan-400">
            <Lock size={24} />
          </div>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em]">Acceso protegido</p>
        </div>

        <input
          type="password"
          autoFocus
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder="Código de acceso"
          className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all text-center tracking-widest"
        />

        {error && (
          <p className="text-rose-400 text-xs font-bold text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !token.trim()}
          className="w-full kora-gradient text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-xl hover:scale-[1.02] transition-transform active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <>Entrar <ArrowRight size={18} /></>}
        </button>
      </form>

      <p className="text-slate-600 text-[11px] mt-8 text-center max-w-xs leading-relaxed">
        Este código lo define quien configuró la app en la variable de entorno <span className="text-slate-500 font-mono">KORA_ACCESS_TOKEN</span>.
      </p>
    </div>
  );
};

export default UnlockScreen;
