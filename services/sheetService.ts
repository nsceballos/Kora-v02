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
const getQueue = (): any[] => JSON.parse(localStorage.getItem('kora_sync_queue') || '[]');
const addToQueue = (action: string, data: any) => {
  const queue = getQueue();
  queue.push({ action, data, timestamp: Date.now() });
  localStorage.setItem('kora_sync_queue', JSON.stringify(queue));
};

async function runAction(action: string, data?: any, retries = 3): Promise<any> {
  if (isGasEnv()) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler((res: any) => resolve(res))
        .withFailureHandler((err: any) => reject(err))[action](data);
    });
  } 
  
  const url = getWebAppUrl();
  if (!url || !url.startsWith('http')) {
    if (action !== 'getAppData') addToQueue(action, data);
    return null;
  }

  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        redirect: 'follow', // CRÍTICO: GAS siempre redirige a una URL de googleusercontent.com
        headers: { 
          'Content-Type': 'text/plain;charset=utf-8' 
        },
        body: JSON.stringify({ action, data })
      });

      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      
      const text = await response.text();
      try {
        const result = JSON.parse(text);
        if (result.error) throw new Error(result.error);
        return result;
      } catch (e) {
        console.warn('La respuesta no pudo ser procesada como JSON:', text);
        // Si no es JSON pero el status fue 200, asumimos éxito (a veces GAS devuelve HTML de redirección)
        return { success: true };
      }
    } catch (e) {
      console.warn(`Intento ${i + 1} fallido para ${action}:`, e);
      if (i === retries) {
        if (action !== 'getAppData') addToQueue(action, data);
        return null;
      }
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i))); // Retroceso exponencial
    }
  }
  return null;
}

export const sheetService = {
  async getAppData(): Promise<AppData> {
    const fallback: AppData = { transactions: [], accounts: [], categories: [], budgets: [] };
    
    try {
      const result = await runAction('getAppData');
      if (result && typeof result === 'object') {
        const data = {
          transactions: Array.isArray(result.transactions) ? result.transactions : [],
          accounts: Array.isArray(result.accounts) ? result.accounts : [],
          categories: Array.isArray(result.categories) ? result.categories : [],
          budgets: Array.isArray(result.budgets) ? result.budgets : []
        };
        localStorage.setItem('finance_arch_data', JSON.stringify(data));
        return data;
      }
    } catch (e) {
      console.error("Error cargando de la nube:", e);
    }

    const stored = localStorage.getItem('finance_arch_data');
    return stored ? JSON.parse(stored) : fallback;
  },

  async flushQueue() {
    const queue = getQueue();
    if (queue.length === 0) return;
    
    console.log(`Sincronizando ${queue.length} acciones pendientes...`);
    const remaining = [];
    for (const item of queue) {
      const success = await runAction(item.action, item.data, 1);
      if (!success) remaining.push(item);
    }
    localStorage.setItem('kora_sync_queue', JSON.stringify(remaining));
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
  }
};