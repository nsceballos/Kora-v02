import React, { useState } from 'react';
import { UserConfig } from '../types';
import { Delete, LogIn, Loader2 } from 'lucide-react';

interface Props {
  users: UserConfig[];
  onLogin: (user: UserConfig) => void;
  onGoogleLogin: () => Promise<void>;
  isGoogleAuthEnabled: boolean;
}

const AVATAR_BG: Record<UserConfig['color'], string> = {
  indigo:  'bg-indigo-500',
  rose:    'bg-rose-500',
  emerald: 'bg-emerald-500',
  amber:   'bg-amber-500',
  cyan:    'bg-cyan-500',
  purple:  'bg-purple-500',
};

const BORDER_COLORS: Record<UserConfig['color'], string> = {
  indigo:  'border-indigo-400',
  rose:    'border-rose-400',
  emerald: 'border-emerald-400',
  amber:   'border-amber-400',
  cyan:    'border-cyan-400',
  purple:  'border-purple-400',
};

const LoginScreen: React.FC<Props> = ({ users, onLogin, onGoogleLogin, isGoogleAuthEnabled }) => {
  const [selected, setSelected] = useState<UserConfig | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await onGoogleLogin();
    } catch (e: any) {
      setLoginError(e.message || 'Error al iniciar sesión');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSelectUser = (user: UserConfig) => {
    if (!user.pin) {
      onLogin(user);
      return;
    }
    setSelected(user);
    setPin('');
    setError(false);
  };

  const handleDigit = (d: string) => {
    if (pin.length >= 4 || error) return;
    const newPin = pin + d;
    setPin(newPin);
    if (newPin.length === 4) {
      if (selected!.pin === newPin) {
        onLogin(selected!);
      } else {
        setError(true);
        setTimeout(() => { setPin(''); setError(false); }, 900);
      }
    }
  };

  const handleDelete = () => {
    if (!error) setPin(p => p.slice(0, -1));
  };

  const handleBack = () => {
    setSelected(null);
    setPin('');
    setError(false);
  };

  const NumKey = ({ label, onClick }: { label: React.ReactNode; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className="h-16 bg-white/5 hover:bg-white/15 active:bg-white/25 text-white text-xl font-bold rounded-2xl border border-white/10 flex items-center justify-center transition-all active:scale-95 select-none"
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div className="w-11 h-11 kora-gradient rounded-2xl flex items-center justify-center font-black text-white text-lg">K</div>
        <h1 className="text-3xl font-black text-white tracking-tighter">Kora</h1>
      </div>

      {/* Google Sign-In (primary method) */}
      {isGoogleAuthEnabled && !selected && (
        <div className="flex flex-col items-center gap-4 mb-8 w-full max-w-[320px]">
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 font-bold rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-60"
          >
            {isLoggingIn ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            {isLoggingIn ? 'Conectando...' : 'Iniciar sesión con Google'}
          </button>

          {loginError && (
            <p className="text-rose-400 text-xs font-bold text-center">{loginError}</p>
          )}

          {/* Divider */}
          {users.length > 0 && (
            <div className="flex items-center gap-4 w-full my-2">
              <div className="flex-1 h-px bg-slate-700"></div>
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">o elige perfil</span>
              <div className="flex-1 h-px bg-slate-700"></div>
            </div>
          )}
        </div>
      )}

      {!selected ? (
        /* ── Selector de usuario ── */
        <>
          {users.length > 0 && (
            <>
              {!isGoogleAuthEnabled && (
                <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mb-8">Selecciona tu perfil</p>
              )}
              <div className="flex gap-5 flex-wrap justify-center">
                {users.map(user => (
                  <button
                    key={user.id}
                    onClick={() => handleSelectUser(user)}
                    className="flex flex-col items-center gap-3 p-6 bg-white/5 hover:bg-white/10 active:bg-white/15 rounded-3xl border border-white/10 hover:border-white/20 transition-all hover:scale-105 active:scale-95 min-w-[130px]"
                  >
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name} className="w-16 h-16 rounded-2xl shadow-lg object-cover" />
                    ) : (
                      <div className={`w-16 h-16 rounded-2xl ${AVATAR_BG[user.color]} flex items-center justify-center text-white text-2xl font-black shadow-lg`}>
                        {user.name[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    <span className="text-white font-bold text-sm">{user.name}</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest">
                      {user.pin ? 'PIN requerido' : 'Sin PIN'}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        /* ── Entrada de PIN ── */
        <div className="flex flex-col items-center gap-6 w-full max-w-[260px]">
          <button
            onClick={handleBack}
            className="self-start text-slate-500 hover:text-slate-300 text-sm font-bold transition-colors"
          >
            ← Volver
          </button>

          {/* Avatar del usuario seleccionado */}
          <div className="flex flex-col items-center gap-2">
            {selected.avatar ? (
              <img src={selected.avatar} alt={selected.name} className="w-16 h-16 rounded-2xl shadow-lg object-cover" />
            ) : (
              <div className={`w-16 h-16 rounded-2xl ${AVATAR_BG[selected.color]} flex items-center justify-center text-white text-2xl font-black shadow-lg`}>
                {selected.name[0]?.toUpperCase()}
              </div>
            )}
            <p className="text-white font-bold">{selected.name}</p>
          </div>

          <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em]">Ingresá tu PIN</p>

          {/* Puntos del PIN */}
          <div className={`flex gap-4 transition-all ${error ? 'translate-x-0' : ''}`}
            style={{ animation: error ? 'shake 0.5s ease-in-out' : 'none' }}
          >
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                  pin.length > i
                    ? error
                      ? 'bg-rose-500 border-rose-500 scale-110'
                      : `${AVATAR_BG[selected.color]} ${BORDER_COLORS[selected.color]} scale-110`
                    : 'border-slate-600'
                }`}
              />
            ))}
          </div>

          {error && (
            <p className="text-rose-400 text-xs font-bold -mt-2">PIN incorrecto</p>
          )}

          {/* Teclado numérico */}
          <div className="grid grid-cols-3 gap-3 w-full">
            {['1','2','3','4','5','6','7','8','9'].map(d => (
              <NumKey key={d} label={d} onClick={() => handleDigit(d)} />
            ))}
            <div />
            <NumKey label="0" onClick={() => handleDigit('0')} />
            <NumKey
              label={<Delete size={20} className="text-slate-400" />}
              onClick={handleDelete}
            />
          </div>
        </div>
      )}

      <p className="text-slate-700 text-[10px] mt-16 uppercase tracking-widest font-bold">
        Kora — Finanzas personales
      </p>
    </div>
  );
};

export default LoginScreen;
