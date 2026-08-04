import { Transaction, Account, AppData, Budget, Settlement } from '../types';
import { authService } from './authService';

/**
 * Kora Sheet Service - Unified data access layer
 *
 * All persistence goes through the serverless endpoint `/api/sheets`, which is
 * backed by a Google service account configured via Vercel environment
 * variables. The browser never holds Google credentials. Every request
 * carries the user's session token (`Authorization: Bearer <token>`), and the
 * server uses it to scope every read/write to that user only — see
 * api/_handler.ts and api/_sheetsCore.ts.
 *
 * Layers:
 * 1. POST /api/sheets  (source of truth)
 * 2. localStorage cache (offline read fallback)
 * 3. offline write queue (retried on next successful connection)
 */

const API_URL = '/api/sheets';

/** Raised when the session token is missing, invalid or expired — caller should log out. */
export class UnauthorizedError extends Error {
  constructor() { super('UNAUTHORIZED'); this.name = 'UnauthorizedError'; }
}

// ── Offline queue ───────────────────────────────────────────────

const getQueue = (): any[] => {
  try {
    return JSON.parse(localStorage.getItem('kora_sync_queue') || '[]');
  } catch { return []; }
};

const addToQueue = (action: string, data: any) => {
  const queue = getQueue();
  queue.push({ action, data, timestamp: Date.now() });
  localStorage.setItem('kora_sync_queue', JSON.stringify(queue));
};

// ── API runner ──────────────────────────────────────────────────

/**
 * Call the serverless API. Read actions (`getAppData`) return null on
 * network failure so callers fall back to cache. Write actions get queued
 * for retry only on network/transient (5xx) failures. A deterministic
 * rejection from the server (validation error, 403, wrong password, etc.)
 * throws immediately and is never queued/retried, since retrying it would
 * just repeat the same failure.
 */
async function apiAction(action: string, data?: any, retries = 2): Promise<any> {
  const isRead = action === 'getAppData';
  const token = authService.getToken();
  if (!token) throw new UnauthorizedError();

  for (let i = 0; i <= retries; i++) {
    let response: Response;
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ action, data }),
      });
    } catch {
      // Network failure — retry, then fall back to cache/queue.
      if (i === retries) {
        if (!isRead) {
          addToQueue(action, data);
          return { success: true, queued: true };
        }
        return null;
      }
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
      continue;
    }

    if (response.status === 401) throw new UnauthorizedError();

    if (response.status >= 500) {
      // Transient server-side failure — retry, then fall back to cache/queue.
      if (i === retries) {
        if (!isRead) {
          addToQueue(action, data);
          return { success: true, queued: true };
        }
        return null;
      }
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
      continue;
    }

    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.error) {
      throw new Error(result?.error || `HTTP ${response.status}`);
    }
    return result;
  }
  return null;
}

// ── Unified Service ─────────────────────────────────────────────

export const sheetService = {
  async getAppData(): Promise<AppData> {
    const fallback: AppData = { transactions: [], accounts: [], categories: [], budgets: [], settlements: [], config: {} };

    let result: any;
    try {
      result = await apiAction('getAppData');
    } catch (e) {
      if (e instanceof UnauthorizedError) throw e;
      result = null;
    }

    if (result && Array.isArray(result.transactions) && Array.isArray(result.accounts)) {
      const data: AppData = {
        transactions: result.transactions.filter((t: any) =>
          t && typeof t.id === 'string' && typeof t.amount === 'number' && t.type
        ),
        accounts: result.accounts.filter((a: any) =>
          a && typeof a.id === 'string' && typeof a.balance === 'number'
        ),
        categories: Array.isArray(result.categories) ? result.categories.filter(Boolean) : [],
        budgets: Array.isArray(result.budgets) ? result.budgets : [],
        settlements: Array.isArray(result.settlements) ? result.settlements.filter((s: any) => s && s.id) : [],
        config: (result.config && typeof result.config === 'object') ? result.config : {},
      };
      localStorage.setItem('finance_arch_data', JSON.stringify(data));
      return data;
    }

    try {
      const stored = localStorage.getItem('finance_arch_data');
      if (stored) {
        const cached = JSON.parse(stored);
        return {
          ...fallback,
          ...cached,
          settlements: Array.isArray(cached.settlements) ? cached.settlements : [],
          config: (cached.config && typeof cached.config === 'object') ? cached.config : {},
        } as AppData;
      }
    } catch {
      console.warn("Caché local corrupta, usando estado vacío.");
    }
    return fallback;
  },

  async flushQueue() {
    const queue = getQueue();
    if (queue.length === 0) return;

    const newQueue: any[] = [];
    for (const item of queue) {
      try {
        const result = await apiAction(item.action, item.data, 1);
        if (!result || result.queued) newQueue.push(item);
      } catch {
        newQueue.push(item);
      }
    }
    localStorage.setItem('kora_sync_queue', JSON.stringify(newQueue));
  },

  async saveTransaction(t: Transaction): Promise<boolean> {
    const res = await apiAction('saveTransaction', t);
    return !!res;
  },

  async saveAccount(acc: Account): Promise<boolean> {
    const res = await apiAction('saveAccount', acc);
    return !!res;
  },

  async saveCategories(categories: string[]): Promise<boolean> {
    const res = await apiAction('saveCategories', categories);
    return !!res;
  },

  async saveBudgets(budgets: Budget[]): Promise<boolean> {
    const res = await apiAction('saveBudgets', budgets);
    return !!res;
  },

  async deleteTransaction(id: string): Promise<boolean> {
    const res = await apiAction('deleteTransaction', { id });
    return !!res;
  },

  async deleteAccount(id: string): Promise<boolean> {
    const res = await apiAction('deleteAccount', { id });
    return !!res;
  },

  async saveSettlement(s: Settlement): Promise<boolean> {
    const res = await apiAction('saveSettlement', s);
    return !!res;
  },

  async saveConfig(key: string, value: string): Promise<boolean> {
    const res = await apiAction('saveConfig', { key, value });
    return !!res;
  },

  /** Devuelve el usuario público actualizado (o null si falló) para refrescar la sesión local. */
  async updateProfile(name: string): Promise<{ id: string; name: string; email: string; color: string } | null> {
    const res = await apiAction('updateProfile', { name });
    return res?.user ?? null;
  },

  /** Lanza un Error (ej. "INVALID_PASSWORD") si la contraseña actual es incorrecta. */
  async changePassword(currentPassword: string, newPassword: string): Promise<boolean> {
    const res = await apiAction('changePassword', { currentPassword, newPassword });
    return !!res?.success;
  },
};
