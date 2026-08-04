import React, { useState } from 'react';
import { Loader2, ArrowRight, Mail, Lock, User as UserIcon, AlertCircle } from 'lucide-react';

interface Props {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (name: string, email: string, password: string) => Promise<void>;
}

type Mode = 'login' | 'register';

/**
 * Pantalla de acceso: alterna entre iniciar sesión y crear una cuenta nueva.
 * Cada cuenta es independiente — sus gastos, cuentas y presupuestos no son
 * visibles para ningún otro usuario (ver README para el detalle técnico).
 */
const LoginScreen: React.FC<Props> = ({ onLogin, onRegister }) => {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'register') {
      if (!name.trim()) return setError('Ingresá tu nombre.');
      if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.');
      if (password !== confirmPassword) return setError('Las contraseñas no coinciden.');
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await onLogin(email.trim(), password);
      } else {
        await onRegister(name.trim(), email.trim(), password);
      }
    } catch (err: any) {
      setError(err?.message || 'Ocurrió un error. Intentá de nuevo.');
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

      <div className="w-full max-w-sm">
        {/* Tabs */}
        <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1 mb-6">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-all ${
              mode === 'login' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-all ${
              mode === 'register' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Crear cuenta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div className="relative">
              <UserIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Tu nombre"
                className="w-full pl-11 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
              />
            </div>
          )}

          <div className="relative">
            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="email"
              required
              autoFocus={mode === 'login'}
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full pl-11 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
            />
          </div>

          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="w-full pl-11 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
            />
          </div>

          {mode === 'register' && (
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repetir contraseña"
                className="w-full pl-11 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
              />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-rose-400 text-xs font-bold">
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full kora-gradient text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-xl hover:scale-[1.02] transition-transform active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>{mode === 'login' ? 'Entrar' : 'Crear cuenta'} <ArrowRight size={18} /></>
            )}
          </button>
        </form>
      </div>

      <p className="text-slate-700 text-[10px] mt-16 uppercase tracking-widest font-bold">
        Kora — Finanzas personales
      </p>
    </div>
  );
};

export default LoginScreen;
