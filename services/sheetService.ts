import { Transaction, Account } from '../types';

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
 * Ejecuta una acción en el backend con lógica de reintento y validación.
 */
async function runAction(action: string, data?: any, retries = 2): Promise<any> {
  if (isGasEnv()) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler((res: any) => resolve(res))
        .withFailureHandler((err: any) => reject(err))[action](data);
    });
  } 
  
  const url = getWebAppUrl();
  if (!url || !url.startsWith('http')) return null;

  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' }, // GAS requiere text/plain para evitar preflight excesivo
        body: JSON.stringify({ action, data })
      });

      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      
      const result = await response.json();
      return result;
    } catch (e) {
      console.warn(`Intento ${i + 1} fallido para ${action}:`, e);
      if (i === retries) return null;
      await new Promise(r => setTimeout(r, 1000 * (i + 1))); // Exponential backoff simple
    }
  }
  return null;
}

export const sheetService = {
  async getAppData(): Promise<{ transactions: Transaction[], accounts: Account[], categories: string[] }> {
    const fallback = { transactions: [], accounts: [], categories: [] };
    
    try {
      const result = await runAction('getAppData');
      if (result && typeof result === 'object') {
        return {
          transactions: Array.isArray(result.transactions) ? result.transactions : [],
          accounts: Array.isArray(result.accounts) ? result.accounts : [],
          categories: Array.isArray(result.categories) ? result.categories : []
        };
      }
    } catch (e) {
      console.error("Error cargando de la nube:", e);
    }

    const stored = localStorage.getItem('finance_arch_data');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return {
          transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
          accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
          categories: Array.isArray(parsed.categories) ? parsed.categories : []
        };
      } catch (e) {
        console.error("Error parseando local storage:", e);
      }
    }
    
    return fallback;
  },

  async saveTransaction(t: Transaction): Promise<boolean> {
    const res = await runAction('saveTransaction', t);
    const current = await this.getAppData();
    
    const idx = current.transactions.findIndex(item => item.id === t.id);
    if (idx !== -1) current.transactions[idx] = t;
    else current.transactions.push(t);
    
    localStorage.setItem('finance_arch_data', JSON.stringify(current));
    return !!res;
  },

  async saveAccount(acc: Account): Promise<boolean> {
    const res = await runAction('saveAccount', acc);
    const current = await this.getAppData();
    
    const idx = current.accounts.findIndex(a => a.id === acc.id);
    if (idx !== -1) current.accounts[idx] = acc;
    else current.accounts.push(acc);
    
    localStorage.setItem('finance_arch_data', JSON.stringify(current));
    return !!res;
  },

  async saveCategories(categories: string[]): Promise<boolean> {
    const res = await runAction('saveCategories', categories);
    const current = await this.getAppData();
    current.categories = categories;
    localStorage.setItem('finance_arch_data', JSON.stringify(current));
    return !!res;
  }
};