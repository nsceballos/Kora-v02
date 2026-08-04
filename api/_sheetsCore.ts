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
 *
 * Quota: every Kora user shares the SAME Google service account, so they all
 * share its per-minute Sheets API quota (60 read / 60 write requests per
 * minute by default). Every function here is written to spend as few
 * requests as possible — one read + one write per action is the target — and
 * caches sheet existence / sheet IDs across calls within the same warm
 * serverless instance instead of re-checking them on every request.
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

function mapRow(headers: string[], row: string[]): any {
  const obj: any = {};
  headers.forEach((h: string, i: number) => {
    let val: any = row[i] !== undefined ? row[i] : '';
    if (NUMERIC_HEADERS.includes(h)) val = parseFloat(val) || 0;
    if (BOOL_HEADERS.includes(h)) val = val === 'SI' || val === true || val === 'true';
    obj[toCamelCase(h)] = val;
  });
  return obj;
}

function isMissingSheetError(e: any): boolean {
  return e?.message?.includes('400') || e?.message?.includes('Unable to parse range');
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

  // Caches scoped to this client instance. A serverless function instance is
  // reused ("warm") across many requests, so these avoid re-doing metadata
  // lookups that don't change between calls — every one avoided is one less
  // request against the shared per-minute quota.
  const knownSheets = new Set<string>();
  let sheetIdCache: Record<string, number> | null = null;

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

  async function fetchSpreadsheetMeta(): Promise<Record<string, number>> {
    const spreadsheet = await apiRequest(baseUrl);
    const map: Record<string, number> = {};
    for (const s of spreadsheet.sheets || []) {
      map[s.properties.title] = s.properties.sheetId;
      knownSheets.add(s.properties.title);
    }
    sheetIdCache = map;
    return map;
  }

  /** sheetId numérico de una hoja, cacheado entre llamadas (1 sola lectura de metadata por instancia tibia, no una por borrado). */
  async function getSheetId(sheetName: string): Promise<number> {
    if (!sheetIdCache || !(sheetName in sheetIdCache)) await fetchSpreadsheetMeta();
    const id = sheetIdCache?.[sheetName];
    if (id === undefined) throw new Error(`Hoja no encontrada: ${sheetName}`);
    return id;
  }

  async function createSheet(sheetName: string): Promise<void> {
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
    knownSheets.add(sheetName);
    sheetIdCache = null; // el nuevo sheetId se resuelve la próxima vez que haga falta
  }

  /** Existencia de una hoja sin traer sus datos. Se saltea por completo si ya se confirmó antes en esta instancia. */
  async function ensureSheetExists(sheetName: string): Promise<void> {
    if (knownSheets.has(sheetName)) return;
    try {
      await apiRequest(`${baseUrl}/values/${encodeURIComponent(sheetName)}!A1`);
      knownSheets.add(sheetName);
    } catch (e: any) {
      if (!isMissingSheetError(e)) throw e;
      await createSheet(sheetName);
    }
  }

  /**
   * Lectura completa de una hoja, en bruto (sin mapear a objetos). Autocura:
   * si la hoja todavía no existe, la crea y devuelve vacío. Es la única
   * lectura que hace falta para leer, verificar dueño y ubicar la fila a
   * escribir/borrar — antes esas tres cosas eran 3 llamadas separadas.
   */
  async function readSheetRaw(sheetName: string): Promise<{ headers: string[]; dataRows: string[][] }> {
    try {
      const result = await apiRequest(`${baseUrl}/values/${encodeURIComponent(sheetName)}`);
      knownSheets.add(sheetName);
      const values: string[][] = result.values || [];
      return { headers: values[0] || SHEET_HEADERS[sheetName] || [], dataRows: values.slice(1) };
    } catch (e: any) {
      if (isMissingSheetError(e)) {
        await createSheet(sheetName);
        return { headers: SHEET_HEADERS[sheetName] || [], dataRows: [] };
      }
      throw e;
    }
  }

  async function readSheet(sheetName: string): Promise<any[]> {
    const { headers, dataRows } = await readSheetRaw(sheetName);
    return dataRows.map(row => mapRow(headers, row));
  }

  /** Rows belonging to `userId` only — the only view any per-user action is allowed to return. */
  async function readOwnRows(sheetName: string, userId: string): Promise<any[]> {
    const rows = await readSheet(sheetName);
    return rows.filter(r => String(r.userId) === String(userId));
  }

  /**
   * Trae varias hojas en UNA sola llamada a la API (values:batchGet), en vez
   * de una llamada por hoja. Si alguna hoja todavía no existe (spreadsheet
   * recién creado, antes de la primera escritura) batchGet falla entero;
   * en ese caso se cae a leerlas una por una, que sí autocura cada una.
   */
  async function batchReadSheets(sheetNames: string[]): Promise<Record<string, any[]>> {
    try {
      const params = sheetNames.map(n => `ranges=${encodeURIComponent(n)}`).join('&');
      const result = await apiRequest(`${baseUrl}/values:batchGet?${params}`);
      const out: Record<string, any[]> = {};
      (result.valueRanges || []).forEach((vr: any, i: number) => {
        const name = sheetNames[i];
        const values: string[][] = vr.values || [];
        const headers = values[0] || SHEET_HEADERS[name] || [];
        out[name] = values.slice(1).map(row => mapRow(headers, row));
        knownSheets.add(name);
      });
      return out;
    } catch {
      const out: Record<string, any[]> = {};
      await Promise.all(sheetNames.map(async name => { out[name] = await readSheet(name); }));
      return out;
    }
  }

  async function writeRow(sheetName: string, dataRowIndex: number, values: any[]): Promise<void> {
    // dataRowIndex es 0-based dentro de dataRows (sin encabezado); la fila real
    // de la hoja es +2 (1 por el encabezado, 1 porque Sheets es 1-based).
    const range = `${sheetName}!A${dataRowIndex + 2}`;
    await apiRequest(`${baseUrl}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
      method: 'PUT',
      body: JSON.stringify({ values: [values] }),
    });
  }

  async function appendRow(sheetName: string, values: any[]): Promise<void> {
    await appendRows(sheetName, [values]);
  }

  /** Igual que appendRow, pero para varias filas en una sola llamada (importación masiva). */
  async function appendRows(sheetName: string, rows: any[][]): Promise<void> {
    await apiRequest(`${baseUrl}/values/${encodeURIComponent(sheetName)}!A:A:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: 'POST',
      body: JSON.stringify({ values: rows }),
    });
  }

  /** Upsert por columna A (ID). Una sola lectura (ya autocurada) + una escritura. */
  async function upsertRow(sheetName: string, id: string, values: any[]): Promise<void> {
    const { dataRows } = await readSheetRaw(sheetName);
    const rowIndex = dataRows.findIndex(r => String(r[0]) === String(id));
    if (rowIndex >= 0) await writeRow(sheetName, rowIndex, values);
    else await appendRow(sheetName, values);
  }

  /**
   * Como upsertRow, pero primero verifica dueño: si la fila ya existe y su
   * columna UserId no coincide, rechaza la escritura. Sigue siendo una sola
   * lectura (antes: una lectura para el chequeo de dueño + otra separada solo
   * para ubicar la fila).
   */
  async function upsertOwnedRow(sheetName: string, id: string, userId: string, values: any[]): Promise<void> {
    const { headers, dataRows } = await readSheetRaw(sheetName);
    const userColIdx = headers.indexOf('UserId');
    const rowIndex = dataRows.findIndex(r => String(r[0]) === String(id));

    if (rowIndex >= 0) {
      if (String(dataRows[rowIndex][userColIdx]) !== String(userId)) throw new Error('FORBIDDEN');
      await writeRow(sheetName, rowIndex, values);
    } else {
      await appendRow(sheetName, values);
    }
  }

  /** Borra una fila propia. Una lectura (para ubicarla y verificar dueño) + el sheetId cacheado + una escritura. */
  async function deleteOwnedRow(sheetName: string, id: string, userId: string): Promise<boolean> {
    const { headers, dataRows } = await readSheetRaw(sheetName);
    const userColIdx = headers.indexOf('UserId');
    const rowIndex = dataRows.findIndex(r => String(r[0]) === String(id));
    if (rowIndex < 0) return false;
    if (String(dataRows[rowIndex][userColIdx]) !== String(userId)) throw new Error('FORBIDDEN');

    const sheetId = await getSheetId(sheetName);
    await apiRequest(`${baseUrl}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [{
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: rowIndex + 1, endIndex: rowIndex + 2 },
          },
        }],
      }),
    });
    return true;
  }

  async function overwriteSheet(sheetName: string, values: any[][]): Promise<void> {
    await apiRequest(`${baseUrl}/values/${encodeURIComponent(sheetName)}?valueInputOption=RAW`, {
      method: 'PUT',
      body: JSON.stringify({ range: sheetName, values }),
    });
    knownSheets.add(sheetName);
  }

  /**
   * Busca un usuario por id y además devuelve la posición de su fila, para
   * poder reescribirla sin una segunda lectura (updateProfile/changePassword
   * necesitan las dos cosas: los datos actuales del usuario y dónde escribir).
   */
  async function findUserRow(id: string): Promise<{ index: number; user: any } | null> {
    const { headers, dataRows } = await readSheetRaw(SHEET_NAMES.USERS);
    const index = dataRows.findIndex(r => String(r[0]) === String(id));
    if (index < 0) return null;
    return { index, user: mapRow(headers, dataRows[index]) };
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
      const sheets = await batchReadSheets([
        SHEET_NAMES.TRANSACTIONS, SHEET_NAMES.ACCOUNTS, SHEET_NAMES.CATEGORIES,
        SHEET_NAMES.BUDGETS, SHEET_NAMES.SETTLEMENTS, SHEET_NAMES.CONFIG,
      ]);
      const mine = (name: string) => sheets[name].filter((r: any) => String(r.userId) === String(userId));

      const config: Record<string, string> = {};
      const prefix = `${userId}::`;
      sheets[SHEET_NAMES.CONFIG].forEach((r: any) => {
        const key = String(r.key ?? '');
        if (key.startsWith(prefix)) config[key.slice(prefix.length)] = String(r.value ?? '');
      });

      return {
        transactions: mine(SHEET_NAMES.TRANSACTIONS).filter((t: any) => t.id && t.amount !== undefined),
        accounts: mine(SHEET_NAMES.ACCOUNTS).filter((a: any) => a.id && a.balance !== undefined),
        categories: mine(SHEET_NAMES.CATEGORIES).map((r: any) => r.name).filter(Boolean),
        budgets: mine(SHEET_NAMES.BUDGETS).map((b: any) => ({ category: b.category, limit: b.limit })),
        settlements: mine(SHEET_NAMES.SETTLEMENTS).filter((s: any) => s.id),
        config,
      };
    },

    async saveTransaction(userId: string, t: any) {
      if (!t || !t.id) return { error: 'Transacción inválida' };
      const vals = [
        t.id, userId, t.date, t.concept, t.amount, t.currency,
        t.category || 'Varios', t.subcategory || '', t.sourceAccount,
        t.destinationAccount || '', t.type,
        t.isShared ? 'SI' : 'NO', t.paidBy || '',
        t.isSettled ? 'SI' : 'NO',
      ];
      await upsertOwnedRow(SHEET_NAMES.TRANSACTIONS, t.id, userId, vals);
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

      await ensureSheetExists(SHEET_NAMES.TRANSACTIONS);

      const values = transactions.map(t => [
        randomUUID(), userId, t.date, t.concept, t.amount, t.currency,
        t.category || 'Varios', t.subcategory || '', t.sourceAccount,
        t.destinationAccount || '', t.type,
        t.isShared ? 'SI' : 'NO', t.paidBy || '',
        t.isSettled ? 'SI' : 'NO',
      ]);

      await appendRows(SHEET_NAMES.TRANSACTIONS, values);
      return { success: true, imported: values.length };
    },

    async saveAccount(userId: string, acc: any) {
      if (!acc || !acc.id) return { error: 'Cuenta inválida' };
      const vals = [acc.id, userId, acc.name, acc.type, acc.balance, acc.currency, acc.closingDate || '', acc.dueDate || ''];
      await upsertOwnedRow(SHEET_NAMES.ACCOUNTS, acc.id, userId, vals);
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
      const vals = [
        s.id, userId, s.date, s.period, s.total,
        s.userA, s.paidA, s.percentA,
        s.userB, s.paidB, s.percentB,
        s.debtor || '', s.creditor || '', s.amount, s.txCount,
      ];
      await upsertOwnedRow(SHEET_NAMES.SETTLEMENTS, s.id, userId, vals);
      return { success: true, id: s.id };
    },

    async saveConfig(userId: string, data: { key: string; value: string }) {
      if (!data || !data.key) return { error: 'Config inválida' };
      const compositeKey = `${userId}::${data.key}`;
      await upsertRow(SHEET_NAMES.CONFIG, compositeKey, [compositeKey, data.value ?? '']);
      return { success: true };
    },

    async deleteTransaction(userId: string, data: { id: string }) {
      const ok = await deleteOwnedRow(SHEET_NAMES.TRANSACTIONS, data.id, userId);
      return { success: ok };
    },

    async deleteAccount(userId: string, data: { id: string }) {
      const ok = await deleteOwnedRow(SHEET_NAMES.ACCOUNTS, data.id, userId);
      return { success: ok };
    },

    // ── Cuenta / perfil (Usuarios) ────────────────────────────────
    async updateProfile(userId: string, data: { name?: string }) {
      const found = await findUserRow(userId);
      if (!found) return { error: 'Usuario no encontrado' };
      const { user } = found;
      if (typeof data?.name === 'string' && data.name.trim()) {
        user.name = data.name.trim().slice(0, 60);
      }
      await writeRow(SHEET_NAMES.USERS, found.index, [user.id, user.name, user.email, user.passwordHash, user.color, user.registeredAt]);
      return { success: true, user: publicUser(user) };
    },

    async changePassword(userId: string, data: { currentPassword: string; newPassword: string }) {
      const found = await findUserRow(userId);
      if (!found) return { error: 'Usuario no encontrado' };
      const { user } = found;
      const ok = await comparePassword(data?.currentPassword || '', user.passwordHash);
      if (!ok) return { error: 'INVALID_PASSWORD' };
      if (!data?.newPassword || data.newPassword.length < 6) {
        return { error: 'La nueva contraseña debe tener al menos 6 caracteres' };
      }
      user.passwordHash = await hashPassword(data.newPassword);
      await writeRow(SHEET_NAMES.USERS, found.index, [user.id, user.name, user.email, user.passwordHash, user.color, user.registeredAt]);
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
