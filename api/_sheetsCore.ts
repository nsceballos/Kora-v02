/**
 * Kora - Google Sheets core logic (server-side)
 *
 * Pure, dependency-injected implementation of every Sheets operation.
 * The access token, spreadsheet id and fetch implementation are injected so
 * this module can run inside a Vercel serverless function, a Vite dev
 * middleware, or a unit test with mocks — without touching the browser.
 */

export const SHEET_NAMES = {
  TRANSACTIONS: 'Transacciones',
  ACCOUNTS: 'Cuentas',
  CATEGORIES: 'Categorias',
  BUDGETS: 'Presupuestos',
  USERS: 'Usuarios',
  SETTLEMENTS: 'Cierres',
  CONFIG: 'Config',
} as const;

const SHEET_HEADERS: Record<string, string[]> = {
  [SHEET_NAMES.TRANSACTIONS]: ['ID', 'Fecha', 'Concepto', 'Monto', 'Moneda', 'Categoria', 'Subcategoria', 'Cuenta Origen', 'Cuenta Destino', 'Tipo', 'Compartido', 'Responsable', 'Saldado'],
  [SHEET_NAMES.ACCOUNTS]: ['ID', 'Nombre', 'Tipo', 'Saldo', 'Moneda', 'Cierre', 'Vencimiento'],
  [SHEET_NAMES.CATEGORIES]: ['Nombre'],
  [SHEET_NAMES.BUDGETS]: ['Categoria', 'Limite'],
  [SHEET_NAMES.USERS]: ['ID', 'Nombre', 'Email', 'Avatar', 'Color', 'PIN', 'FechaRegistro'],
  [SHEET_NAMES.SETTLEMENTS]: ['ID', 'Fecha', 'Periodo', 'Total', 'UsuarioA', 'PagoA', 'PorcentajeA', 'UsuarioB', 'PagoB', 'PorcentajeB', 'Deudor', 'Acreedor', 'Monto', 'Movimientos'],
  [SHEET_NAMES.CONFIG]: ['Clave', 'Valor'],
};

const HEADER_MAP: Record<string, string> = {
  'ID': 'id', 'Fecha': 'date', 'Concepto': 'concept', 'Monto': 'amount',
  'Moneda': 'currency', 'Categoria': 'category', 'Subcategoria': 'subcategory',
  'Cuenta Origen': 'sourceAccount', 'Cuenta Destino': 'destinationAccount',
  'Tipo': 'type', 'Compartido': 'isShared', 'Responsable': 'paidBy',
  'Saldado': 'isSettled', 'Nombre': 'name', 'Saldo': 'balance',
  'Cierre': 'closingDate', 'Vencimiento': 'dueDate', 'Limite': 'limit',
  'Email': 'email', 'Avatar': 'avatar', 'Color': 'color', 'PIN': 'pin',
  'FechaRegistro': 'registeredAt',
  'Periodo': 'period', 'Total': 'total', 'UsuarioA': 'userA', 'PagoA': 'paidA',
  'PorcentajeA': 'percentA', 'UsuarioB': 'userB', 'PagoB': 'paidB',
  'PorcentajeB': 'percentB', 'Deudor': 'debtor', 'Acreedor': 'creditor',
  'Movimientos': 'txCount', 'Clave': 'key', 'Valor': 'value',
};

const NUMERIC_HEADERS = ['Monto', 'Saldo', 'Limite', 'Total', 'PagoA', 'PorcentajeA', 'PagoB', 'PorcentajeB', 'Movimientos'];
const BOOL_HEADERS = ['Compartido', 'Saldado'];

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

function toCamelCase(header: string): string {
  return HEADER_MAP[header] || header.toLowerCase().replace(/\s/g, '');
}

export interface SheetsClientOptions {
  spreadsheetId: string;
  getToken: () => Promise<string>;
  fetchImpl?: typeof fetch;
}

export function createSheetsClient(opts: SheetsClientOptions) {
  const { spreadsheetId, getToken } = opts;
  const doFetch = opts.fetchImpl || fetch;
  const baseUrl = `${SHEETS_API}/${spreadsheetId}`;

  async function apiRequest(url: string, options: RequestInit = {}): Promise<any> {
    const token = await getToken();
    const res = await doFetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Sheets API Error ${res.status}: ${err}`);
    }
    return res.json();
  }

  async function ensureSheet(sheetName: string): Promise<void> {
    try {
      await apiRequest(`${baseUrl}/values/${encodeURIComponent(sheetName)}!A1`);
      return; // Sheet exists
    } catch (e: any) {
      if (!e.message.includes('400') && !e.message.includes('Unable to parse range')) {
        throw e;
      }
    }

    await apiRequest(`${baseUrl}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sheetName } } }] }),
    });

    const headers = SHEET_HEADERS[sheetName];
    if (headers) {
      await apiRequest(`${baseUrl}/values/${encodeURIComponent(sheetName)}!A1?valueInputOption=RAW`, {
        method: 'PUT',
        body: JSON.stringify({ values: [headers] }),
      });
    }
  }

  async function readSheet(sheetName: string): Promise<any[]> {
    try {
      const result = await apiRequest(`${baseUrl}/values/${encodeURIComponent(sheetName)}`);
      const values: string[][] = result.values || [];
      if (values.length <= 1) return [];

      const headers = values[0];
      return values.slice(1).map(row => {
        const obj: any = {};
        headers.forEach((h: string, i: number) => {
          let val: any = row[i] !== undefined ? row[i] : '';
          if (NUMERIC_HEADERS.includes(h)) val = parseFloat(val) || 0;
          if (BOOL_HEADERS.includes(h)) val = val === 'SI' || val === true || val === 'true';
          obj[toCamelCase(h)] = val;
        });
        return obj;
      });
    } catch (e: any) {
      if (e.message.includes('400') || e.message.includes('Unable to parse range')) {
        await ensureSheet(sheetName);
        return [];
      }
      throw e;
    }
  }

  async function findRowById(sheetName: string, id: string): Promise<number> {
    const result = await apiRequest(`${baseUrl}/values/${encodeURIComponent(sheetName)}!A:A`);
    const col: string[][] = result.values || [];
    for (let i = 1; i < col.length; i++) {
      if (col[i][0] !== undefined && String(col[i][0]) === String(id)) return i + 1;
    }
    return -1;
  }

  async function upsertRow(sheetName: string, id: string, values: any[]): Promise<void> {
    await ensureSheet(sheetName);
    const rowIdx = await findRowById(sheetName, id);

    if (rowIdx > 0) {
      const range = `${sheetName}!A${rowIdx}`;
      await apiRequest(`${baseUrl}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
        method: 'PUT',
        body: JSON.stringify({ values: [values] }),
      });
    } else {
      await apiRequest(`${baseUrl}/values/${encodeURIComponent(sheetName)}!A:A:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: 'POST',
        body: JSON.stringify({ values: [values] }),
      });
    }
  }

  async function deleteRowById(sheetName: string, id: string): Promise<boolean> {
    const rowIdx = await findRowById(sheetName, id);
    if (rowIdx < 0) return false;

    const spreadsheet = await apiRequest(baseUrl);
    const sheet = spreadsheet.sheets?.find((s: any) => s.properties?.title === sheetName);
    if (!sheet) return false;

    await apiRequest(`${baseUrl}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [{
          deleteDimension: {
            range: { sheetId: sheet.properties.sheetId, dimension: 'ROWS', startIndex: rowIdx - 1, endIndex: rowIdx },
          }
        }]
      }),
    });
    return true;
  }

  async function overwriteSheet(sheetName: string, values: any[][]): Promise<void> {
    await ensureSheet(sheetName);
    await apiRequest(`${baseUrl}/values/${encodeURIComponent(sheetName)}?valueInputOption=RAW`, {
      method: 'PUT',
      body: JSON.stringify({ range: sheetName, values }),
    });
  }

  return {
    async getAppData() {
      const [transactions, accounts, categories, budgets, settlements, configRows] = await Promise.all([
        readSheet(SHEET_NAMES.TRANSACTIONS),
        readSheet(SHEET_NAMES.ACCOUNTS),
        readSheet(SHEET_NAMES.CATEGORIES),
        readSheet(SHEET_NAMES.BUDGETS),
        readSheet(SHEET_NAMES.SETTLEMENTS),
        readSheet(SHEET_NAMES.CONFIG),
      ]);

      const config: Record<string, string> = {};
      configRows.forEach((r: any) => { if (r.key) config[String(r.key)] = String(r.value ?? ''); });

      return {
        transactions: transactions.filter(t => t.id && t.amount !== undefined),
        accounts: accounts.filter(a => a.id && a.balance !== undefined),
        categories: categories.map(r => r.name || r.nombre).filter(Boolean),
        budgets,
        settlements: settlements.filter(s => s.id),
        config,
      };
    },

    async saveTransaction(t: any) {
      const vals = [
        t.id, t.date, t.concept, t.amount, t.currency,
        t.category || 'Varios', t.subcategory || '', t.sourceAccount,
        t.destinationAccount || '', t.type,
        t.isShared ? 'SI' : 'NO', t.paidBy || '',
        t.isSettled ? 'SI' : 'NO',
      ];
      await upsertRow(SHEET_NAMES.TRANSACTIONS, t.id, vals);
      return { success: true, id: t.id };
    },

    async saveAccount(acc: any) {
      const vals = [acc.id, acc.name, acc.type, acc.balance, acc.currency, acc.closingDate || '', acc.dueDate || ''];
      await upsertRow(SHEET_NAMES.ACCOUNTS, acc.id, vals);
      return { success: true, id: acc.id };
    },

    async saveCategories(categories: string[]) {
      const values = [['Nombre'], ...(categories || []).filter(Boolean).map(c => [c])];
      await overwriteSheet(SHEET_NAMES.CATEGORIES, values);
      return { success: true };
    },

    async saveBudgets(budgets: any[]) {
      const values = [['Categoria', 'Limite'], ...(budgets || []).map(b => [b.category, b.limit])];
      await overwriteSheet(SHEET_NAMES.BUDGETS, values);
      return { success: true };
    },

    async saveSettlement(s: any) {
      const vals = [
        s.id, s.date, s.period, s.total,
        s.userA, s.paidA, s.percentA,
        s.userB, s.paidB, s.percentB,
        s.debtor || '', s.creditor || '', s.amount, s.txCount,
      ];
      await upsertRow(SHEET_NAMES.SETTLEMENTS, s.id, vals);
      return { success: true, id: s.id };
    },

    async saveConfig(data: { key: string; value: string }) {
      await upsertRow(SHEET_NAMES.CONFIG, data.key, [data.key, data.value]);
      return { success: true };
    },

    async deleteTransaction(data: { id: string }) {
      const ok = await deleteRowById(SHEET_NAMES.TRANSACTIONS, data.id);
      return { success: ok };
    },

    async deleteAccount(data: { id: string }) {
      const ok = await deleteRowById(SHEET_NAMES.ACCOUNTS, data.id);
      return { success: ok };
    },

    async getUsers() {
      const rows = await readSheet(SHEET_NAMES.USERS);
      return rows.filter(u => u.id && u.name).map(u => ({
        id: String(u.id),
        name: String(u.name),
        email: String(u.email || ''),
        avatar: String(u.avatar || ''),
        color: u.color || 'indigo',
        pin: String(u.pin || ''),
        registeredAt: u.registeredAt || '',
      }));
    },

    async saveUser(user: any) {
      if (!user || !user.id || !user.name) return { error: 'Usuario inválido' };
      const vals = [
        user.id, user.name, user.email || '', user.avatar || '',
        user.color || 'indigo', user.pin || '',
        user.registeredAt || new Date().toISOString().split('T')[0],
      ];
      await upsertRow(SHEET_NAMES.USERS, user.id, vals);
      return { success: true, id: user.id };
    },

    async deleteUser(data: { id: string }) {
      const ok = await deleteRowById(SHEET_NAMES.USERS, data.id);
      return { success: ok };
    },
  };
}

export type SheetsClient = ReturnType<typeof createSheetsClient>;

export type SheetAction =
  | 'getAppData' | 'saveTransaction' | 'saveAccount' | 'saveCategories'
  | 'saveBudgets' | 'saveSettlement' | 'saveConfig' | 'deleteTransaction'
  | 'deleteAccount' | 'getUsers' | 'saveUser' | 'deleteUser';

/** Route an action to the matching client method. Throws on unknown actions. */
export async function handleAction(client: SheetsClient, action: string, data: any): Promise<any> {
  switch (action as SheetAction) {
    case 'getAppData': return client.getAppData();
    case 'saveTransaction': return client.saveTransaction(data);
    case 'saveAccount': return client.saveAccount(data);
    case 'saveCategories': return client.saveCategories(data);
    case 'saveBudgets': return client.saveBudgets(data);
    case 'saveSettlement': return client.saveSettlement(data);
    case 'saveConfig': return client.saveConfig(data);
    case 'deleteTransaction': return client.deleteTransaction(data);
    case 'deleteAccount': return client.deleteAccount(data);
    case 'getUsers': return client.getUsers();
    case 'saveUser': return client.saveUser(data);
    case 'deleteUser': return client.deleteUser(data);
    default: throw new Error(`Acción no reconocida: ${action}`);
  }
}
