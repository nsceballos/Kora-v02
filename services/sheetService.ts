import { Transaction, Account, AppData, Budget } from '../types';

declare const google: any;

const getWebAppUrl = () => localStorage.getItem('finance_arch_google_webapp_url');

const isGasEnv = () => {
  try {
    return typeof google !== 'undefined' && google.script && google.script.run;
  } catch (e) {
    return false;
  }
};

/**
 * Cola de sincronización para soporte offline-first
 */
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

async function runAction(action: string, data?: any, retries = 2): Promise<any> {
  // 1. Entorno nativo GAS (si se ejecutara dentro de Sheets/Sidebar)
  if (isGasEnv()) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler((res: any) => resolve(res))
        .withFailureHandler((err: any) => reject(err))[action](data);
    });
  }

  // 2. Validación de URL
  const url = getWebAppUrl();
  if (!url || !url.startsWith('http')) {
    console.warn("Kora: No hay URL configurada o es inválida.");
    if (action !== 'getAppData') {
      addToQueue(action, data);
      return { success: true, offline: true };
    }
    return null;
  }

  // 3. Intento de Fetch con backoff exponencial
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
      } catch (jsonError) {
        // GAS a veces devuelve 200 OK sin JSON válido (redirects), asumimos éxito.
        console.warn('Respuesta no-JSON recibida (asumiendo éxito por status 200):', text.substring(0, 50));
        return { success: true, warning: 'non-json-response' };
      }

    } catch (e) {
      console.warn(`Intento ${i + 1}/${retries + 1} fallido para ${action}:`, e);

      if (i === retries) {
        if (action !== 'getAppData') {
          console.log(`Guardando ${action} en cola offline.`);
          addToQueue(action, data);
          return { success: true, queued: true };
        }
        return null;
      }

      // Backoff exponencial: 1s, 2s, 4s
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
  return null;
}

export const sheetService = {
  async getAppData(): Promise<AppData> {
    const fallback: AppData = { transactions: [], accounts: [], categories: [], budgets: [] };

    try {
      const result = await runAction('getAppData');
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
        // Cachear datos exitosos
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

    console.log(`Sincronizando ${queue.length} acciones pendientes...`);

    // Procesamos la cola secuencialmente para mantener orden
    const newQueue: any[] = [];
    for (const item of queue) {
      try {
        // 1 reintento con backoff para el flush
        const result = await runAction(item.action, item.data, 1);
        if (!result || result.queued) {
          newQueue.push(item);
        }
      } catch {
        newQueue.push(item);
      }
    }

    localStorage.setItem('kora_sync_queue', JSON.stringify(newQueue));
  },

  async saveTransaction(t: Transaction): Promise<boolean> {
    const res = await runAction('saveTransaction', t);
    return !!res;
  },

  async saveAccount(acc: Account): Promise<boolean> {
    const res = await runAction('saveAccount', acc);
    return !!res;
  },

  async saveCategories(categories: string[]): Promise<boolean> {
    const res = await runAction('saveCategories', categories);
    return !!res;
  },

  async saveBudgets(budgets: Budget[]): Promise<boolean> {
    const res = await runAction('saveBudgets', budgets);
    return !!res;
  },

  async deleteTransaction(id: string): Promise<boolean> {
    const res = await runAction('deleteTransaction', { id });
    return !!res;
  },

  async deleteAccount(id: string): Promise<boolean> {
    const res = await runAction('deleteAccount', { id });
    return !!res;
  }
};