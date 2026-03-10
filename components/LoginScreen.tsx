import React, { useState } from 'react';
import { UserConfig } from '../types';
import { Delete } from 'lucide-react';

interface Props {
  users: UserConfig[];
  onLogin: (user: UserConfig) => void;
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

const LoginScreen: React.FC<Props> = ({ users, onLogin }) => {
  const [selected, setSelected] = useState<UserConfig | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

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
      <div className="flex items-center gap-3 mb-14">
        <div className="w-11 h-11 kora-gradient rounded-2xl flex items-center justify-center font-black text-white text-lg">K</div>
        <h1 className="text-3xl font-black text-white tracking-tighter">Kora</h1>
      </div>

      {!selected ? (
        /* ── Selector de usuario ── */
        <>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mb-8">Selecciona tu perfil</p>
          <div className="flex gap-5 flex-wrap justify-center">
            {users.map(user => (
              <button
                key={user.id}
                onClick={() => handleSelectUser(user)}
                className="flex flex-col items-center gap-3 p-6 bg-white/5 hover:bg-white/10 active:bg-white/15 rounded-3xl border border-white/10 hover:border-white/20 transition-all hover:scale-105 active:scale-95 min-w-[130px]"
              >
                <div className={`w-16 h-16 rounded-2xl ${AVATAR_BG[user.color]} flex items-center justify-center text-white text-2xl font-black shadow-lg`}>
                  {user.name[0]?.toUpperCase() || '?'}
                </div>
                <span className="text-white font-bold text-sm">{user.name}</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">
                  {user.pin ? 'PIN requerido' : 'Sin PIN'}
                </span>
              </button>
            ))}
          </div>
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
            <div className={`w-16 h-16 rounded-2xl ${AVATAR_BG[selected.color]} flex items-center justify-center text-white text-2xl font-black shadow-lg`}>
              {selected.name[0]?.toUpperCase()}
            </div>
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
