import { Transaction, Account, AppData, Budget, UserConfig, DEFAULT_USERS } from '../types';
import { googleAuth } from './googleAuth';
import { googleSheetsApi } from './googleSheetsApi';

declare const google: any;

/**
 * Kora Sheet Service - Unified data access layer
 *
 * Priority:
 * 1. Google Sheets API v4 (direct, when authenticated via OAuth)
 * 2. Google Apps Script Web App (legacy, via URL)
 * 3. localStorage cache (offline fallback)
 */

// ── Legacy GAS support ──────────────────────────────────────────

const getWebAppUrl = () => localStorage.getItem('finance_arch_google_webapp_url');

const isGasEnv = () => {
  try {
    return typeof google !== 'undefined' && google.script && google.script.run;
  } catch (e) {
    return false;
  }
};

const isGoogleApiMode = () => !!googleAuth.getAccessToken();

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

// ── Legacy GAS runner ───────────────────────────────────────────

async function runGasAction(action: string, data?: any, retries = 2): Promise<any> {
  if (isGasEnv()) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler((res: any) => resolve(res))
        .withFailureHandler((err: any) => reject(err))[action](data);
    });
  }

  const url = getWebAppUrl();
  if (!url || !url.startsWith('http')) {
    if (action !== 'getAppData') {
      addToQueue(action, data);
      return { success: true, offline: true };
    }
    return null;
  }

  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, data })
      });

      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      const text = await response.text();
      try {
        const result = JSON.parse(text);
        if (result.error) throw new Error(result.error);
        return result;
      } catch {
        return { success: true, warning: 'non-json-response' };
      }
    } catch (e) {
      if (i === retries) {
        if (action !== 'getAppData') {
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
    const fallback: AppData = { transactions: [], accounts: [], categories: [], budgets: [] };

    try {
      let result: any;

      if (isGoogleApiMode()) {
        result = await googleSheetsApi.getAppData();
      } else {
        result = await runGasAction('getAppData');
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
          budgets: Array.isArray(result.budgets) ? result.budgets : []
        };
        localStorage.setItem('finance_arch_data', JSON.stringify(data));
        return data;
      }
    } catch (e) {
      console.error("Error cargando de la nube, usando caché:", e);
    }

    try {
      const stored = localStorage.getItem('finance_arch_data');
      if (stored) return JSON.parse(stored) as AppData;
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
        if (isGoogleApiMode()) {
          // Route queued actions through Google API
          switch (item.action) {
            case 'saveTransaction': await googleSheetsApi.saveTransaction(item.data); break;
            case 'saveAccount': await googleSheetsApi.saveAccount(item.data); break;
            case 'saveCategories': await googleSheetsApi.saveCategories(item.data); break;
            case 'saveBudgets': await googleSheetsApi.saveBudgets(item.data); break;
            case 'deleteTransaction': await googleSheetsApi.deleteTransaction(item.data.id); break;
            case 'deleteAccount': await googleSheetsApi.deleteAccount(item.data.id); break;
            case 'saveUser': await googleSheetsApi.saveUser(item.data); break;
            case 'deleteUser': await googleSheetsApi.deleteUser(item.data.id); break;
            default: newQueue.push(item);
          }
        } else {
          const result = await runGasAction(item.action, item.data, 1);
          if (!result || result.queued) newQueue.push(item);
        }
      } catch {
        newQueue.push(item);
      }
    }
    localStorage.setItem('kora_sync_queue', JSON.stringify(newQueue));
  },

  async saveTransaction(t: Transaction): Promise<boolean> {
    if (isGoogleApiMode()) return googleSheetsApi.saveTransaction(t);
    const res = await runGasAction('saveTransaction', t);
    return !!res;
  },

  async saveAccount(acc: Account): Promise<boolean> {
    if (isGoogleApiMode()) return googleSheetsApi.saveAccount(acc);
    const res = await runGasAction('saveAccount', acc);
    return !!res;
  },

  async saveCategories(categories: string[]): Promise<boolean> {
    if (isGoogleApiMode()) return googleSheetsApi.saveCategories(categories);
    const res = await runGasAction('saveCategories', categories);
    return !!res;
  },

  async saveBudgets(budgets: Budget[]): Promise<boolean> {
    if (isGoogleApiMode()) return googleSheetsApi.saveBudgets(budgets);
    const res = await runGasAction('saveBudgets', budgets);
    return !!res;
  },

  async deleteTransaction(id: string): Promise<boolean> {
    if (isGoogleApiMode()) return googleSheetsApi.deleteTransaction(id);
    const res = await runGasAction('deleteTransaction', { id });
    return !!res;
  },

  async deleteAccount(id: string): Promise<boolean> {
    if (isGoogleApiMode()) return googleSheetsApi.deleteAccount(id);
    const res = await runGasAction('deleteAccount', { id });
    return !!res;
  },

  async getUsers(): Promise<UserConfig[]> {
    const VALID_COLORS = ['indigo', 'rose', 'emerald', 'amber', 'cyan', 'purple'];
    try {
      let result: any[];

      if (isGoogleApiMode()) {
        result = await googleSheetsApi.getUsers();
      } else {
        result = await runGasAction('getUsers');
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
    } catch (e) {
      console.error("Error cargando usuarios:", e);
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
    if (isGoogleApiMode()) return googleSheetsApi.saveUser(user);
    const res = await runGasAction('saveUser', user);
    return !!res;
  },

  async deleteUser(id: string): Promise<boolean> {
    if (isGoogleApiMode()) return googleSheetsApi.deleteUser(id);
    const res = await runGasAction('deleteUser', { id });
    return !!res;
  },

  /** Register or find a Google-authenticated user in the Usuarios sheet */
  async registerGoogleUser(googleUser: { id: string; email: string; name: string; picture: string }): Promise<UserConfig> {
    // Check if user already exists by email
    let existingUser: any = null;
    try {
      if (isGoogleApiMode()) {
        existingUser = await googleSheetsApi.findUserByEmail(googleUser.email);
      }
    } catch {}

    if (existingUser) {
      // Update name/avatar if changed
      const updated: UserConfig = {
        id: existingUser.id,
        name: existingUser.name || googleUser.name,
        email: googleUser.email,
        avatar: googleUser.picture || existingUser.avatar,
        color: existingUser.color || 'indigo',
        pin: existingUser.pin || '',
        registeredAt: existingUser.registeredAt,
      };
      await this.saveUser(updated);
      return updated;
    }

    // Create new user
    const colors: UserConfig['color'][] = ['indigo', 'rose', 'emerald', 'amber', 'cyan', 'purple'];
    const existingUsers = await this.getUsers();
    const usedColors = existingUsers.map(u => u.color);
    const availableColor = colors.find(c => !usedColors.includes(c)) || 'indigo';

    const newUser: UserConfig = {
      id: `google_${googleUser.id}`,
      name: googleUser.name,
      email: googleUser.email,
      avatar: googleUser.picture,
      color: availableColor,
      pin: '',
      registeredAt: new Date().toISOString().split('T')[0],
    };

    await this.saveUser(newUser);
    return newUser;
  },
};
