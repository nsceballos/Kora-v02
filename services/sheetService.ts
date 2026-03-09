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

async function runAction(action: string, data?: any, retries = 1): Promise<any> {
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
    // Si no es una lectura de datos, lo encolamos para cuando el usuario ponga la URL
    if (action !== 'getAppData') {
      addToQueue(action, data);
      return { success: true, offline: true }; // Simulamos éxito
    }
    return null;
  }

  // 3. Intento de Fetch
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
        // Si el servidor devuelve 200 OK pero no es JSON (común en GAS con redirects), asumimos éxito.
        console.warn('Respuesta no-JSON recibida (asumiendo éxito por status 200):', text.substring(0, 50));
        return { success: true, warning: 'non-json-response' };
      }

    } catch (e) {
      console.warn(`Intento ${i + 1} fallido para ${action}:`, e);
      
      // Si fallan todos los intentos
      if (i === retries) {
        // Si NO es pedir datos (es guardar), lo guardamos en cola y devolvemos éxito falso al UI
        // para que la UI optimista no se preocupe.
        if (action !== 'getAppData') {
          console.log(`Guardando ${action} en cola offline.`);
          addToQueue(action, data);
          return { success: true, queued: true };
        }
        return null; // Si era getAppData, fallamos real.
      }
      
      await new Promise(r => setTimeout(r, 1000)); // Esperar 1s antes de reintentar
    }
  }
  return null;
}

export const sheetService = {
  async getAppData(): Promise<AppData> {
    const fallback: AppData = { transactions: [], accounts: [], categories: [], budgets: [] };
    
    try {
      const result = await runAction('getAppData');
      if (result && (result.transactions || result.accounts)) {
        const data = {
          transactions: Array.isArray(result.transactions) ? result.transactions : [],
          accounts: Array.isArray(result.accounts) ? result.accounts : [],
          categories: Array.isArray(result.categories) ? result.categories : [],
          budgets: Array.isArray(result.budgets) ? result.budgets : []
        };
        // Cachear datos exitosos
        localStorage.setItem('finance_arch_data', JSON.stringify(data));
        return data;
      }
    } catch (e) {
      console.error("Error cargando de la nube, usando caché:", e);
    }

    const stored = localStorage.getItem('finance_arch_data');
    return stored ? JSON.parse(stored) : fallback;
  },

  async flushQueue() {
    const queue = getQueue();
    if (queue.length === 0) return;
    
    console.log(`Sincronizando ${queue.length} acciones pendientes...`);
    
    // Procesamos la cola secuencialmente para mantener orden
    const newQueue = [];
    for (const item of queue) {
      try {
        const result = await runAction(item.action, item.data, 0); // 0 reintentos para no bloquear
        // Si runAction devuelve null (fallo total) lo mantenemos. Si devuelve objeto (éxito o queued), lo sacamos.
        // Pero espera, si devuelve queued=true es que falló de nuevo.
        if (!result || result.queued) {
           newQueue.push(item);
        }
      } catch {
        newQueue.push(item);
      }
    }
    
    // Actualizar cola con los que fallaron de nuevo
    if (newQueue.length !== queue.length) {
      localStorage.setItem('kora_sync_queue', JSON.stringify(newQueue));
    }
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