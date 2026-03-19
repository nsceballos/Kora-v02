/**
 * Kora - Google Sheets API v4 Direct Service
 * Replaces the Apps Script proxy with direct REST API calls.
 */

import { googleAuth } from './googleAuth';

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

// Sheet names matching the backend.gs structure
const SHEET_NAMES = {
  TRANSACTIONS: 'Transacciones',
  ACCOUNTS: 'Cuentas',
  CATEGORIES: 'Categorias',
  BUDGETS: 'Presupuestos',
  USERS: 'Usuarios',
};

// Headers for each sheet
const SHEET_HEADERS: Record<string, string[]> = {
  [SHEET_NAMES.TRANSACTIONS]: ['ID', 'Fecha', 'Concepto', 'Monto', 'Moneda', 'Categoria', 'Subcategoria', 'Cuenta Origen', 'Cuenta Destino', 'Tipo', 'Compartido', 'Responsable', 'Saldado'],
  [SHEET_NAMES.ACCOUNTS]: ['ID', 'Nombre', 'Tipo', 'Saldo', 'Moneda', 'Cierre', 'Vencimiento'],
  [SHEET_NAMES.CATEGORIES]: ['Nombre'],
  [SHEET_NAMES.BUDGETS]: ['Categoria', 'Limite'],
  [SHEET_NAMES.USERS]: ['ID', 'Nombre', 'Email', 'Avatar', 'Color', 'PIN', 'FechaRegistro'],
};

// camelCase mapping (same as backend.gs toCamelCase)
const HEADER_MAP: Record<string, string> = {
  'ID': 'id', 'Fecha': 'date', 'Concepto': 'concept', 'Monto': 'amount',
  'Moneda': 'currency', 'Categoria': 'category', 'Subcategoria': 'subcategory',
  'Cuenta Origen': 'sourceAccount', 'Cuenta Destino': 'destinationAccount',
  'Tipo': 'type', 'Compartido': 'isShared', 'Responsable': 'paidBy',
  'Saldado': 'isSettled', 'Nombre': 'name', 'Saldo': 'balance',
  'Cierre': 'closingDate', 'Vencimiento': 'dueDate', 'Limite': 'limit',
  'Email': 'email', 'Avatar': 'avatar', 'Color': 'color', 'PIN': 'pin',
  'FechaRegistro': 'registeredAt',
};

function toCamelCase(header: string): string {
  return HEADER_MAP[header] || header.toLowerCase().replace(/\s/g, '');
}

async function apiRequest(url: string, options: RequestInit = {}): Promise<any> {
  const token = googleAuth.getAccessToken();
  if (!token) throw new Error('NO_AUTH');

  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 401) throw new Error('TOKEN_EXPIRED');
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets API Error ${res.status}: ${err}`);
  }

  return res.json();
}

function getBaseUrl(): string {
  const id = googleAuth.getSpreadsheetId();
  if (!id) throw new Error('NO_SPREADSHEET_ID');
  return `${SHEETS_API}/${id}`;
}

/** Ensure a sheet exists with proper headers, create if missing */
async function ensureSheet(sheetName: string): Promise<void> {
  const baseUrl = getBaseUrl();

  // Check if sheet exists by trying to read it
  try {
    await apiRequest(`${baseUrl}/values/${encodeURIComponent(sheetName)}!A1`);
    return; // Sheet exists
  } catch (e: any) {
    if (!e.message.includes('400') && !e.message.includes('Unable to parse range')) {
      throw e;
    }
  }

  // Create the sheet
  await apiRequest(`${baseUrl}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{
        addSheet: { properties: { title: sheetName } }
      }]
    }),
  });

  // Add headers
  const headers = SHEET_HEADERS[sheetName];
  if (headers) {
    await apiRequest(`${baseUrl}/values/${encodeURIComponent(sheetName)}!A1?valueInputOption=RAW`, {
      method: 'PUT',
      body: JSON.stringify({ values: [headers] }),
    });
  }
}

/** Read all rows from a sheet and return as array of objects */
async function readSheet(sheetName: string): Promise<any[]> {
  const baseUrl = getBaseUrl();

  try {
    const result = await apiRequest(`${baseUrl}/values/${encodeURIComponent(sheetName)}`);
    const values: string[][] = result.values || [];
    if (values.length <= 1) return [];

    const headers = values[0];
    return values.slice(1).map(row => {
      const obj: any = {};
      headers.forEach((h: string, i: number) => {
        let val: any = row[i] !== undefined ? row[i] : '';
        // Type conversions
        if (h === 'Monto' || h === 'Saldo' || h === 'Limite') {
          val = parseFloat(val) || 0;
        }
        if (h === 'Compartido' || h === 'Saldado') {
          val = val === 'SI' || val === true || val === 'true';
        }
        obj[toCamelCase(h)] = val;
      });
      return obj;
    });
  } catch (e: any) {
    if (e.message.includes('400') || e.message.includes('Unable to parse range')) {
      // Sheet doesn't exist yet
      await ensureSheet(sheetName);
      return [];
    }
    throw e;
  }
}

/** Find the row index (1-based) of a row by ID in column A */
async function findRowById(sheetName: string, id: string): Promise<number> {
  const baseUrl = getBaseUrl();
  const result = await apiRequest(`${baseUrl}/values/${encodeURIComponent(sheetName)}!A:A`);
  const col: string[][] = result.values || [];

  for (let i = 1; i < col.length; i++) {
    if (String(col[i][0]) === String(id)) return i + 1; // 1-based
  }
  return -1;
}

/** Upsert a row (insert or update by ID in first column) */
async function upsertRow(sheetName: string, id: string, values: any[]): Promise<void> {
  const baseUrl = getBaseUrl();
  await ensureSheet(sheetName);

  const rowIdx = await findRowById(sheetName, id);

  if (rowIdx > 0) {
    // Update existing row
    const range = `${sheetName}!A${rowIdx}`;
    await apiRequest(`${baseUrl}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
      method: 'PUT',
      body: JSON.stringify({ values: [values] }),
    });
  } else {
    // Append new row
    await apiRequest(`${baseUrl}/values/${encodeURIComponent(sheetName)}!A:A:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: 'POST',
      body: JSON.stringify({ values: [values] }),
    });
  }
}

/** Delete a row by ID */
async function deleteRowById(sheetName: string, id: string): Promise<boolean> {
  const baseUrl = getBaseUrl();

  // Find the row
  const rowIdx = await findRowById(sheetName, id);
  if (rowIdx < 0) return false;

  // Get the sheet's gid (numeric ID)
  const spreadsheet = await apiRequest(baseUrl);
  const sheet = spreadsheet.sheets?.find((s: any) => s.properties?.title === sheetName);
  if (!sheet) return false;

  const sheetId = sheet.properties.sheetId;

  // Delete the row using batchUpdate
  await apiRequest(`${baseUrl}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowIdx - 1, // 0-based
            endIndex: rowIdx,
          }
        }
      }]
    }),
  });

  return true;
}

/** Initialize all sheets (called on first app load) */
async function setupDatabase(): Promise<void> {
  for (const name of Object.values(SHEET_NAMES)) {
    await ensureSheet(name);
  }
}

// ─── Public API ────────────────────────────────────────────────

export const googleSheetsApi = {
  SHEET_NAMES,

  setupDatabase,
  readSheet,

  /** Get all app data */
  async getAppData() {
    const [transactions, accounts, categories, budgets] = await Promise.all([
      readSheet(SHEET_NAMES.TRANSACTIONS),
      readSheet(SHEET_NAMES.ACCOUNTS),
      readSheet(SHEET_NAMES.CATEGORIES),
      readSheet(SHEET_NAMES.BUDGETS),
    ]);

    return {
      transactions: transactions.filter(t => t.id && t.amount !== undefined),
      accounts: accounts.filter(a => a.id && a.balance !== undefined),
      categories: categories.map(r => r.name || r.nombre).filter(Boolean),
      budgets,
    };
  },

  /** Save a transaction */
  async saveTransaction(t: any): Promise<boolean> {
    const vals = [
      t.id, t.date, t.concept, t.amount, t.currency,
      t.category || 'Varios', t.subcategory || '', t.sourceAccount,
      t.destinationAccount || '', t.type,
      t.isShared ? 'SI' : 'NO', t.paidBy || '',
      t.isSettled ? 'SI' : 'NO',
    ];
    await upsertRow(SHEET_NAMES.TRANSACTIONS, t.id, vals);
    return true;
  },

  /** Save an account */
  async saveAccount(acc: any): Promise<boolean> {
    const vals = [acc.id, acc.name, acc.type, acc.balance, acc.currency, acc.closingDate || '', acc.dueDate || ''];
    await upsertRow(SHEET_NAMES.ACCOUNTS, acc.id, vals);
    return true;
  },

  /** Save categories (replace all) */
  async saveCategories(categories: string[]): Promise<boolean> {
    const baseUrl = getBaseUrl();
    await ensureSheet(SHEET_NAMES.CATEGORIES);

    // Clear and rewrite
    const values = [['Nombre'], ...categories.filter(Boolean).map(c => [c])];
    await apiRequest(`${baseUrl}/values/${encodeURIComponent(SHEET_NAMES.CATEGORIES)}?valueInputOption=RAW`, {
      method: 'PUT',
      body: JSON.stringify({ range: SHEET_NAMES.CATEGORIES, values }),
    });
    return true;
  },

  /** Save budgets (replace all) */
  async saveBudgets(budgets: any[]): Promise<boolean> {
    const baseUrl = getBaseUrl();
    await ensureSheet(SHEET_NAMES.BUDGETS);

    const values = [['Categoria', 'Limite'], ...budgets.map(b => [b.category, b.limit])];
    await apiRequest(`${baseUrl}/values/${encodeURIComponent(SHEET_NAMES.BUDGETS)}?valueInputOption=RAW`, {
      method: 'PUT',
      body: JSON.stringify({ range: SHEET_NAMES.BUDGETS, values }),
    });
    return true;
  },

  /** Delete a transaction */
  async deleteTransaction(id: string): Promise<boolean> {
    return deleteRowById(SHEET_NAMES.TRANSACTIONS, id);
  },

  /** Delete an account */
  async deleteAccount(id: string): Promise<boolean> {
    return deleteRowById(SHEET_NAMES.ACCOUNTS, id);
  },

  // ─── Users ─────────────────────────────────────────────────

  /** Get all users from Usuarios sheet */
  async getUsers(): Promise<any[]> {
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

  /** Save/update a user */
  async saveUser(user: any): Promise<boolean> {
    const vals = [
      user.id, user.name, user.email || '', user.avatar || '',
      user.color || 'indigo', user.pin || '',
      user.registeredAt || new Date().toISOString().split('T')[0],
    ];
    await upsertRow(SHEET_NAMES.USERS, user.id, vals);
    return true;
  },

  /** Delete a user */
  async deleteUser(id: string): Promise<boolean> {
    return deleteRowById(SHEET_NAMES.USERS, id);
  },

  /** Find user by email */
  async findUserByEmail(email: string): Promise<any | null> {
    const users = await this.getUsers();
    return users.find(u => u.email === email) || null;
  },
};
