import { AuthUser } from '../types';

/**
 * Kora Auth Service - registro, login y manejo de la sesión en el cliente.
 *
 * El token de sesión (JWT) se guarda en localStorage y se reenvía como
 * `Authorization: Bearer <token>` en cada request a /api/sheets. El servidor
 * es quien realmente decide qué usuario es cada request (ver api/_auth.ts) —
 * el objeto de usuario guardado acá es solo para pintar la UI al instante.
 */

const API_URL = '/api/auth';
const TOKEN_KEY = 'kora_session_token';
const USER_KEY = 'kora_session_user';

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

async function call(action: 'register' | 'login', data: any): Promise<{ token: string; user: AuthUser }> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, data }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AuthError(result?.error || `HTTP ${response.status}`, response.status);
  }
  return result;
}

export const authService = {
  async register(name: string, email: string, password: string): Promise<AuthUser> {
    const { token, user } = await call('register', { name, email, password });
    authService.setSession(token, user);
    return user;
  },

  async login(email: string, password: string): Promise<AuthUser> {
    const { token, user } = await call('login', { email, password });
    authService.setSession(token, user);
    return user;
  },

  setSession(token: string, user: AuthUser) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  updateStoredUser(user: AuthUser) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  getStoredUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};
