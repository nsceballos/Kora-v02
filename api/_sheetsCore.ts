/**
 * Kora - Google Sheets core logic (server-side)
 *
 * Pure, dependency-injected implementation of every Sheets operation.
 * The access token, spreadsheet id and fetch implementation are injected so
 * this module can run inside a Vercel serverless function, a Vite dev
 * middleware, or a unit test with mocks — without touching the browser.
 *
 * Data isolation: every row in Transacciones/Cuentas/Categorias/Presupuestos/
 * Cierres carries a `UserId` column. Every read filters by the caller's
 * userId (resolved server-side from their session token, see api/_auth.ts)
 * and every write is stamped with that same userId — a user can never read
 * or overwrite another user's rows, even if they guess the row's ID.
 */

import { randomUUID } from 'node:crypto';
import { hashPassword, comparePassword } from './_auth.js';

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
  [SHEET_NAMES.TRANSACTIONS]: ['ID', 'UserId', 'Fecha', 'Concepto', 'Monto', 'Moneda', 'Categoria', 'Subcategoria', 'Cuenta Origen', 'Cuenta Destino', 'Tipo', 'Compartido', 'Responsable', 'Saldado'],
  [SHEET_NAMES.ACCOUNTS]: ['ID', 'UserId', 'Nombre', 'Tipo', 'Saldo', 'Moneda', 'Cierre', 'Vencimiento'],
  [SHEET_NAMES.CATEGORIES]: ['UserId', 'Nombre'],
  [SHEET_NAMES.BUDGETS]: ['UserId', 'Categoria', 'Limite'],
  [SHEET_NAMES.USERS]: ['ID', 'Nombre', 'Email', 'PasswordHash', 'Color', 'FechaRegistro'],
  [SHEET_NAMES.SETTLEMENTS]: ['ID', 'UserId', 'Fecha', 'Periodo', 'Total', 'UsuarioA', 'PagoA', 'PorcentajeA', 'UsuarioB', 'PagoB', 'PorcentajeB', 'Deudor', 'Acreedor', 'Monto', 'Movimientos'],
  [SHEET_NAMES.CONFIG]: ['Clave', 'Valor'],
};

const HEADER_MAP: Record<string, string> = {
  'ID': 'id', 'UserId': 'userId', 'Fecha': 'date', 'Concepto': 'concept', 'Monto': 'amount',
  'Moneda': 'currency', 'Categoria': 'category', 'Subcategoria': 'subcategory',
  'Cuenta Origen': 'sourceAccount', 'Cuenta Destino': 'destinationAccount',
  'Tipo': 'type', 'Compartido': 'isShared', 'Responsable': 'paidBy',
  'Saldado': 'isSettled', 'Nombre': 'name', 'Saldo': 'balance',
  'Cierre': 'closingDate', 'Vencimiento': 'dueDate', 'Limite': 'limit',
  'Email': 'email', 'PasswordHash': 'passwordHash', 'Color': 'color',
  'FechaRegistro': 'registeredAt',
  'Periodo': 'period', 'Total': 'total', 'UsuarioA': 'userA', 'PagoA': 'paidA',
  'PorcentajeA': 'percentA', 'UsuarioB': 'userB', 'PagoB': 'paidB',
  'PorcentajeB': 'percentB', 'Deudor': 'debtor', 'Acreedor': 'creditor',
  'Movimientos': 'txCount', 'Clave': 'key', 'Valor': 'value',
};

const NUMERIC_HEADERS = ['Monto', 'Saldo', 'Limite', 'Total', 'PagoA', 'PorcentajeA', 'PagoB', 'PorcentajeB', 'Movimientos'];
const BOOL_HEADERS = ['Compartido', 'Saldado'];

const AVATAR_COLORS = ['indigo', 'rose', 'emerald', 'amber', 'cyan', 'purple'];

/** Tope por importación, para no exceder los límites de la API de Sheets en una sola llamada. */
const MAX_IMPORT_ROWS = 2000;

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

  /** Rows belonging to `userId` only — the only view any per-user action is allowed to return. */
  async function readOwnRows(sheetName: string, userId: string): Promise<any[]> {
    const rows = await readSheet(sheetName);
    return rows.filter(r => String(r.userId) === String(userId));
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

  /**
   * Guards updates to an existing id-keyed row: if the row already exists and
   * belongs to a different user, refuse the write instead of overwriting it.
   * New rows (no existing id) are always allowed — they'll be stamped with
   * the caller's own userId by the calling method.
   */
  async function assertOwnedOrNew(sheetName: string, id: string, userId: string): Promise<void> {
    const rows = await readSheet(sheetName);
    const existing = rows.find(r => String(r.id) === String(id));
    if (existing && String(existing.userId) !== String(userId)) {
      throw new Error('FORBIDDEN');
    }
  }

  async function deleteOwnedRowById(sheetName: string, id: string, userId: string): Promise<boolean> {
    const rows = await readSheet(sheetName);
    const existing = rows.find(r => String(r.id) === String(id));
    if (!existing) return false;
    if (String(existing.userId) !== String(userId)) throw new Error('FORBIDDEN');
    return deleteRowById(sheetName, id);
  }

  async function findUserRawById(id: string): Promise<any | null> {
    const rows = await readSheet(SHEET_NAMES.USERS);
    return rows.find(u => String(u.id) === String(id)) ?? null;
  }

  function publicUser(u: any) {
    return {
      id: String(u.id),
      name: String(u.name),
      email: String(u.email),
      color: AVATAR_COLORS.includes(u.color) ? u.color : 'indigo',
    };
  }

  return {
    // ── Datos personales (aislados por usuario) ──────────────────
    async getAppData(userId: string) {
      const [transactions, accounts, categories, budgets, settlements, configRows] = await Promise.all([
        readOwnRows(SHEET_NAMES.TRANSACTIONS, userId),
        readOwnRows(SHEET_NAMES.ACCOUNTS, userId),
        readOwnRows(SHEET_NAMES.CATEGORIES, userId),
        readOwnRows(SHEET_NAMES.BUDGETS, userId),
        readOwnRows(SHEET_NAMES.SETTLEMENTS, userId),
        readSheet(SHEET_NAMES.CONFIG),
      ]);

      const config: Record<string, string> = {};
      const prefix = `${userId}::`;
      configRows.forEach((r: any) => {
        const key = String(r.key ?? '');
        if (key.startsWith(prefix)) config[key.slice(prefix.length)] = String(r.value ?? '');
      });

      return {
        transactions: transactions.filter(t => t.id && t.amount !== undefined),
        accounts: accounts.filter(a => a.id && a.balance !== undefined),
        categories: categories.map(r => r.name).filter(Boolean),
        budgets: budgets.map(b => ({ category: b.category, limit: b.limit })),
        settlements: settlements.filter(s => s.id),
        config,
      };
    },

    async saveTransaction(userId: string, t: any) {
      if (!t || !t.id) return { error: 'Transacción inválida' };
      await assertOwnedOrNew(SHEET_NAMES.TRANSACTIONS, t.id, userId);
      const vals = [
        t.id, userId, t.date, t.concept, t.amount, t.currency,
        t.category || 'Varios', t.subcategory || '', t.sourceAccount,
        t.destinationAccount || '', t.type,
        t.isShared ? 'SI' : 'NO', t.paidBy || '',
        t.isSettled ? 'SI' : 'NO',
      ];
      await upsertRow(SHEET_NAMES.TRANSACTIONS, t.id, vals);
      return { success: true, id: t.id };
    },

    /**
     * Alta masiva de movimientos (importación desde .xlsx).
     *
     * Escribe todas las filas en una sola llamada a Sheets: guardarlas una por
     * una costaría 3+ llamadas por fila y con unos cientos de movimientos
     * chocaría contra los límites de la API. Los IDs se generan acá y no se
     * toman del cliente, para que no pueda colisionar con filas existentes.
     */
    async importTransactions(userId: string, transactions: any[]) {
      if (!Array.isArray(transactions) || transactions.length === 0) {
        return { success: true, imported: 0 };
      }
      if (transactions.length > MAX_IMPORT_ROWS) {
        throw new Error('IMPORT_TOO_LARGE');
      }

      await ensureSheet(SHEET_NAMES.TRANSACTIONS);

      const values = transactions.map(t => [
        randomUUID(), userId, t.date, t.concept, t.amount, t.currency,
        t.category || 'Varios', t.subcategory || '', t.sourceAccount,
        t.destinationAccount || '', t.type,
        t.isShared ? 'SI' : 'NO', t.paidBy || '',
        t.isSettled ? 'SI' : 'NO',
      ]);

      await apiRequest(
        `${baseUrl}/values/${encodeURIComponent(SHEET_NAMES.TRANSACTIONS)}!A:A:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        { method: 'POST', body: JSON.stringify({ values }) },
      );

      return { success: true, imported: values.length };
    },

    async saveAccount(userId: string, acc: any) {
      if (!acc || !acc.id) return { error: 'Cuenta inválida' };
      await assertOwnedOrNew(SHEET_NAMES.ACCOUNTS, acc.id, userId);
      const vals = [acc.id, userId, acc.name, acc.type, acc.balance, acc.currency, acc.closingDate || '', acc.dueDate || ''];
      await upsertRow(SHEET_NAMES.ACCOUNTS, acc.id, vals);
      return { success: true, id: acc.id };
    },

    async saveCategories(userId: string, categories: string[]) {
      const rows = await readSheet(SHEET_NAMES.CATEGORIES);
      const others = rows.filter(r => String(r.userId) !== String(userId));
      const mine = (categories || []).filter(Boolean).map(name => ({ userId, name }));
      const values = [
        SHEET_HEADERS[SHEET_NAMES.CATEGORIES],
        ...others.map(r => [r.userId, r.name]),
        ...mine.map(r => [r.userId, r.name]),
      ];
      await overwriteSheet(SHEET_NAMES.CATEGORIES, values);
      return { success: true };
    },

    async saveBudgets(userId: string, budgets: any[]) {
      const rows = await readSheet(SHEET_NAMES.BUDGETS);
      const others = rows.filter(r => String(r.userId) !== String(userId));
      const mine = (budgets || []).map(b => ({ userId, category: b.category, limit: b.limit }));
      const values = [
        SHEET_HEADERS[SHEET_NAMES.BUDGETS],
        ...others.map(r => [r.userId, r.category, r.limit]),
        ...mine.map(r => [r.userId, r.category, r.limit]),
      ];
      await overwriteSheet(SHEET_NAMES.BUDGETS, values);
      return { success: true };
    },

    async saveSettlement(userId: string, s: any) {
      if (!s || !s.id) return { error: 'Cierre inválido' };
      await assertOwnedOrNew(SHEET_NAMES.SETTLEMENTS, s.id, userId);
      const vals = [
        s.id, userId, s.date, s.period, s.total,
        s.userA, s.paidA, s.percentA,
        s.userB, s.paidB, s.percentB,
        s.debtor || '', s.creditor || '', s.amount, s.txCount,
      ];
      await upsertRow(SHEET_NAMES.SETTLEMENTS, s.id, vals);
      return { success: true, id: s.id };
    },

    async saveConfig(userId: string, data: { key: string; value: string }) {
      if (!data || !data.key) return { error: 'Config inválida' };
      const compositeKey = `${userId}::${data.key}`;
      await upsertRow(SHEET_NAMES.CONFIG, compositeKey, [compositeKey, data.value ?? '']);
      return { success: true };
    },

    async deleteTransaction(userId: string, data: { id: string }) {
      const ok = await deleteOwnedRowById(SHEET_NAMES.TRANSACTIONS, data.id, userId);
      return { success: ok };
    },

    async deleteAccount(userId: string, data: { id: string }) {
      const ok = await deleteOwnedRowById(SHEET_NAMES.ACCOUNTS, data.id, userId);
      return { success: ok };
    },

    // ── Cuenta / perfil (Usuarios) ────────────────────────────────
    async updateProfile(userId: string, data: { name?: string }) {
      const user = await findUserRawById(userId);
      if (!user) return { error: 'Usuario no encontrado' };
      if (typeof data?.name === 'string' && data.name.trim()) {
        user.name = data.name.trim().slice(0, 60);
      }
      await upsertRow(SHEET_NAMES.USERS, user.id, [user.id, user.name, user.email, user.passwordHash, user.color, user.registeredAt]);
      return { success: true, user: publicUser(user) };
    },

    async changePassword(userId: string, data: { currentPassword: string; newPassword: string }) {
      const user = await findUserRawById(userId);
      if (!user) return { error: 'Usuario no encontrado' };
      const ok = await comparePassword(data?.currentPassword || '', user.passwordHash);
      if (!ok) return { error: 'INVALID_PASSWORD' };
      if (!data?.newPassword || data.newPassword.length < 6) {
        return { error: 'La nueva contraseña debe tener al menos 6 caracteres' };
      }
      user.passwordHash = await hashPassword(data.newPassword);
      await upsertRow(SHEET_NAMES.USERS, user.id, [user.id, user.name, user.email, user.passwordHash, user.color, user.registeredAt]);
      return { success: true };
    },

    // ── Registro / login (usadas solo por api/_authHandler.ts, no expuestas
    //    como acción genérica de /api/sheets) ──────────────────────
    async findUserByEmail(email: string) {
      const rows = await readSheet(SHEET_NAMES.USERS);
      const normalized = email.trim().toLowerCase();
      return rows.find(u => String(u.email || '').trim().toLowerCase() === normalized) ?? null;
    },

    async createUser(data: { name: string; email: string; passwordHash: string }) {
      const id = randomUUID();
      const email = data.email.trim().toLowerCase();
      const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
      const registeredAt = new Date().toISOString().split('T')[0];
      await upsertRow(SHEET_NAMES.USERS, id, [id, data.name.trim().slice(0, 60), email, data.passwordHash, color, registeredAt]);
      return publicUser({ id, name: data.name.trim().slice(0, 60), email, color });
    },

    publicUser,
  };
}

export type SheetsClient = ReturnType<typeof createSheetsClient>;

export type SheetAction =
  | 'getAppData' | 'saveTransaction' | 'importTransactions' | 'saveAccount' | 'saveCategories'
  | 'saveBudgets' | 'saveSettlement' | 'saveConfig' | 'deleteTransaction'
  | 'deleteAccount' | 'updateProfile' | 'changePassword';

/** Route an action to the matching client method. Throws on unknown actions. */
export async function handleAction(client: SheetsClient, action: string, userId: string, data: any): Promise<any> {
  switch (action as SheetAction) {
    case 'getAppData': return client.getAppData(userId);
    case 'saveTransaction': return client.saveTransaction(userId, data);
    case 'importTransactions': return client.importTransactions(userId, data);
    case 'saveAccount': return client.saveAccount(userId, data);
    case 'saveCategories': return client.saveCategories(userId, data);
    case 'saveBudgets': return client.saveBudgets(userId, data);
    case 'saveSettlement': return client.saveSettlement(userId, data);
    case 'saveConfig': return client.saveConfig(userId, data);
    case 'deleteTransaction': return client.deleteTransaction(userId, data);
    case 'deleteAccount': return client.deleteAccount(userId, data);
    case 'updateProfile': return client.updateProfile(userId, data);
    case 'changePassword': return client.changePassword(userId, data);
    default: throw new Error(`Acción no reconocida: ${action}`);
  }
}
