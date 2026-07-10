import { Transaction, Account, AppData, Budget, UserConfig, DEFAULT_USERS, Settlement } from '../types';

/**
 * Kora Sheet Service - Unified data access layer
 *
 * All persistence goes through the serverless endpoint `/api/sheets`, which is
 * backed by a Google service account configured via Vercel environment
 * variables. The browser never holds Google credentials.
 *
 * Layers:
 * 1. POST /api/sheets  (source of truth)
 * 2. localStorage cache (offline read fallback)
 * 3. offline write queue (retried on next successful connection)
 */

const API_URL = '/api/sheets';
const ACCESS_TOKEN_KEY = 'kora_access_token';

/** Raised when the server requires an access token the client hasn't provided. */
export class UnauthorizedError extends Error {
  constructor() { super('UNAUTHORIZED'); this.name = 'UnauthorizedError'; }
}

export const accessToken = {
  get: () => localStorage.getItem(ACCESS_TOKEN_KEY) || '',
  set: (t: string) => localStorage.setItem(ACCESS_TOKEN_KEY, t.trim()),
  clear: () => localStorage.removeItem(ACCESS_TOKEN_KEY),
};

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
 * Call the serverless API. Read actions (`getAppData`, `getUsers`) return null
 * on failure so callers fall back to cache. Write actions get queued for retry
 * when the network fails, but surface UnauthorizedError immediately.
 */
async function apiAction(action: string, data?: any, retries = 2): Promise<any> {
  const isRead = action === 'getAppData' || action === 'getUsers';

  for (let i = 0; i <= retries; i++) {
    try {
      const token = accessToken.get();
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-kora-token': token } : {}),
        },
        body: JSON.stringify({ action, data }),
      });

      if (response.status === 401) throw new UnauthorizedError();

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (result && result.error) throw new Error(result.error);
      return result;
    } catch (e) {
      if (e instanceof UnauthorizedError) throw e;

      if (i === retries) {
        if (!isRead) {
          addToQueue(action, data);
          return { success: true, queued: true };
        }
        return null;
      }
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
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

  async getUsers(): Promise<UserConfig[]> {
    const VALID_COLORS = ['indigo', 'rose', 'emerald', 'amber', 'cyan', 'purple'];
    let result: any[] | null = null;
    try {
      result = await apiAction('getUsers');
    } catch (e) {
      if (e instanceof UnauthorizedError) throw e;
    }

    if (Array.isArray(result) && result.length > 0) {
      const users: UserConfig[] = result
        .filter((u: any) => u && typeof u.id === 'string' && typeof u.name === 'string' && u.name)
        .map((u: any): UserConfig => ({
          id: String(u.id),
          name: String(u.name),
          email: String(u.email || ''),
          avatar: String(u.avatar || ''),
          color: (VALID_COLORS.includes(u.color) ? u.color : 'indigo') as UserConfig['color'],
          pin: String(u.pin || ''),
          registeredAt: u.registeredAt || '',
        }));
      if (users.length > 0) {
        localStorage.setItem('kora_users_config', JSON.stringify(users));
        return users;
      }
    }

    try {
      const stored = localStorage.getItem('kora_users_config');
      if (stored) {
        const parsed: UserConfig[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_USERS;
  },

  async saveUser(user: UserConfig): Promise<boolean> {
    const res = await apiAction('saveUser', user);
    return !!res;
  },

  async deleteUser(id: string): Promise<boolean> {
    const res = await apiAction('deleteUser', { id });
    return !!res;
  },
};
