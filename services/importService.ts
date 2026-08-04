import { Transaction, TransactionType, Currency, Account, AccountType } from '../types';

/**
 * Kora Import Service - importación de movimientos desde un archivo .xlsx
 *
 * Estructura esperada (los encabezados se reconocen sin distinguir mayúsculas
 * ni acentos, y se aceptan algunos sinónimos):
 *
 *   Período | Cuentas | Categoría | Nota | Ingreso/Gasto | Importe | Moneda
 *
 * Convención especial: si la Nota **empieza con "X"** el movimiento se marca
 * como gasto compartido con la pareja. Para no confundir palabras que
 * simplemente empiezan con esa letra (ej. "Xiaomi"), la X debe estar sola o
 * seguida de un espacio o signo de puntuación.
 *
 * El parseo corre en el navegador; exceljs se carga de forma diferida para no
 * sumar ~940 KB al bundle de quienes nunca usan el importador.
 */

// ── Reconocimiento de encabezados ────────────────────────────────

type FieldName = 'date' | 'account' | 'category' | 'note' | 'type' | 'amount' | 'currency';

/** Minúsculas, sin acentos y sin espacios/puntuación, para comparar encabezados. */
function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const HEADER_ALIASES: Record<string, FieldName> = {
  periodo: 'date', fecha: 'date', fechamovimiento: 'date',
  cuentas: 'account', cuenta: 'account',
  categoria: 'category', categorias: 'category', rubro: 'category',
  nota: 'note', notas: 'note', concepto: 'note', detalle: 'note', descripcion: 'note',
  ingresogasto: 'type', gastoingreso: 'type', tipo: 'type', tipomovimiento: 'type',
  importe: 'amount', monto: 'amount', valor: 'amount',
  moneda: 'currency', divisa: 'currency',
};

const REQUIRED_FIELDS: FieldName[] = ['date', 'account', 'type', 'amount'];

const FIELD_LABELS: Record<FieldName, string> = {
  date: 'Período', account: 'Cuentas', category: 'Categoría', note: 'Nota',
  type: 'Ingreso/Gasto', amount: 'Importe', currency: 'Moneda',
};

// ── Parseo de valores ────────────────────────────────────────────

/** Días entre la época de Excel (1899-12-30) y la de Unix. */
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

/**
 * Devuelve YYYY-MM-DD, o '' si no se puede interpretar.
 * Acepta objetos Date (exceljs los devuelve en medianoche UTC, por eso se leen
 * con getters UTC: usar los locales restaría un día en Argentina), números de
 * serie de Excel y texto en formato argentino DD/MM/AAAA o ISO.
 */
export function parseDate(value: any): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return parseDate(new Date(EXCEL_EPOCH_MS + Math.round(value) * 86400000));
  }

  const text = String(value ?? '').trim();
  if (!text) return '';

  // ISO: 2026-07-15 (con o sin hora)
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // Formato argentino: 15/7/2026, 15-07-26
  const dmy = text.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return '';
}

/** Acepta 45300.5, "45.300,50", "$ 45.300,50" y "1,234.56". Siempre devuelve el valor absoluto. */
export function parseAmount(value: any): number {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.abs(value) : NaN;

  let text = String(value ?? '').trim().replace(/[^\d.,\-]/g, '');
  if (!text) return NaN;

  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');

  if (lastComma > lastDot) {
    // Formato argentino: la coma es el separador decimal.
    text = text.replace(/\./g, '').replace(',', '.');
  } else {
    // Formato inglés: la coma agrupa miles.
    text = text.replace(/,/g, '');
  }

  const parsed = parseFloat(text);
  return Number.isFinite(parsed) ? Math.abs(parsed) : NaN;
}

/** 'Gasto'/'Egreso' → EXPENSE, 'Ingreso' → INCOME. Devuelve null si no se reconoce. */
export function parseType(value: any): TransactionType | null {
  const key = normalizeKey(String(value ?? ''));
  if (!key) return null;
  if (key.startsWith('ingreso') || key.startsWith('credito') || key.startsWith('haber')) return TransactionType.INCOME;
  if (key.startsWith('gasto') || key.startsWith('egreso') || key.startsWith('debito') || key.startsWith('debe')) return TransactionType.EXPENSE;
  return null;
}

/** Cualquier variante de dólar → USD; el resto (incluido vacío) → ARS. */
export function parseCurrency(value: any): Currency {
  const key = normalizeKey(String(value ?? ''));
  return key === 'usd' || key === 'us' || key.includes('dolar') ? Currency.USD : Currency.ARS;
}

/**
 * Detecta la marca de gasto compartido: la Nota empieza con "X" sola o
 * seguida de espacio/puntuación. "X Cine" y "x-Taxi" sí; "Xiaomi" no.
 */
export function detectShared(note: string): boolean {
  return /^x($|[\s\-–—:.,;)\]])/i.test(note.trim());
}

/** Quita la "X" inicial (y su separador) de una nota marcada como compartida. */
export function stripSharedMarker(note: string): string {
  return note.trim().replace(/^x[\s\-–—:.,;)\]]*/i, '').trim();
}

// ── Resultado del parseo ─────────────────────────────────────────

export interface ParsedRow {
  /** Fila del Excel (1-based, incluyendo el encabezado) para poder señalarla en los errores. */
  rowNumber: number;
  date: string;
  account: string;
  category: string;
  concept: string;
  type: TransactionType;
  amount: number;
  currency: Currency;
  isShared: boolean;
}

export interface RowError {
  rowNumber: number;
  reason: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: RowError[];
  /** Valores presentes en el archivo que todavía no existen en la app. */
  unknownAccounts: string[];
  unknownCategories: string[];
}

export class ImportError extends Error {}

/**
 * Lee el .xlsx y devuelve las filas válidas, los errores por fila y los
 * valores de cuenta/categoría que no existen todavía en la app.
 */
export async function parseWorkbook(
  file: File,
  existingAccounts: string[],
  existingCategories: string[],
): Promise<ParseResult> {
  const ExcelJS = (await import('exceljs')).default;

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new ImportError('No se pudo leer el archivo. Verificá que sea un .xlsx válido.');
  }

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) {
    throw new ImportError('El archivo no tiene datos.');
  }

  // ── Mapear encabezados a columnas ──
  const columnOf = {} as Record<FieldName, number>;
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    const field = HEADER_ALIASES[normalizeKey(String(cell.value ?? ''))];
    if (field && columnOf[field] === undefined) columnOf[field] = colNumber;
  });

  const missing = REQUIRED_FIELDS.filter(f => columnOf[f] === undefined);
  if (missing.length > 0) {
    throw new ImportError(
      `Faltan columnas obligatorias en el archivo: ${missing.map(f => FIELD_LABELS[f]).join(', ')}.`
    );
  }

  // ── Recorrer las filas de datos ──
  const rows: ParsedRow[] = [];
  const errors: RowError[] = [];

  /**
   * Si el valor del archivo coincide con uno existente ignorando mayúsculas y
   * acentos, se adopta la grafía que ya usa la app ("santander" → "Santander").
   * La app vincula cuentas y categorías por nombre exacto, así que sin esto un
   * movimiento importado quedaría huérfano de su cuenta.
   */
  const canonicalize = (value: string, existing: string[]): string =>
    existing.find(e => normalizeKey(e) === normalizeKey(value)) ?? value;

  const cellText = (rowNumber: number, field: FieldName): string => {
    const col = columnOf[field];
    if (col === undefined) return '';
    const value = sheet.getRow(rowNumber).getCell(col).value;
    if (value === null || value === undefined) return '';
    // Las celdas con fórmula o texto enriquecido llegan como objeto.
    if (typeof value === 'object' && 'result' in value) return String((value as any).result ?? '').trim();
    if (typeof value === 'object' && 'richText' in value) {
      return (value as any).richText.map((t: any) => t.text).join('').trim();
    }
    return String(value).trim();
  };

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);

    const rawDate = row.getCell(columnOf.date).value;
    const account = cellText(rowNumber, 'account');
    const rawAmount = row.getCell(columnOf.amount).value;
    const rawType = cellText(rowNumber, 'type');

    // Fila totalmente vacía: se ignora en silencio.
    if (!rawDate && !account && !rawAmount && !rawType) continue;

    const date = parseDate(rawDate);
    if (!date) { errors.push({ rowNumber, reason: 'Fecha inválida o vacía' }); continue; }

    if (!account) { errors.push({ rowNumber, reason: 'Falta la cuenta' }); continue; }

    const type = parseType(rawType);
    if (!type) { errors.push({ rowNumber, reason: `No se entiende "${rawType}" en Ingreso/Gasto` }); continue; }

    const amount = parseAmount(rawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push({ rowNumber, reason: 'Importe inválido o cero' });
      continue;
    }

    const note = cellText(rowNumber, 'note');
    const isShared = detectShared(note);
    const category = canonicalize(cellText(rowNumber, 'category'), existingCategories);

    rows.push({
      rowNumber,
      date,
      account: canonicalize(account, existingAccounts),
      category,
      // Si la nota queda vacía tras sacar la marca, se usa la categoría como concepto.
      concept: (isShared ? stripSharedMarker(note) : note) || category || 'Movimiento importado',
      type,
      amount,
      currency: parseCurrency(cellText(rowNumber, 'currency')),
      isShared,
    });
  }

  if (rows.length === 0) {
    throw new ImportError('No se encontró ninguna fila válida para importar.');
  }

  // ── Detectar cuentas y categorías nuevas (comparación laxa) ──
  const knownAccounts = new Set(existingAccounts.map(normalizeKey));
  const knownCategories = new Set(existingCategories.map(normalizeKey));

  const unknownAccounts = [...new Set(rows.map(r => r.account))]
    .filter(name => !knownAccounts.has(normalizeKey(name)))
    .sort((a, b) => a.localeCompare(b, 'es'));

  const unknownCategories = [...new Set(rows.map(r => r.category).filter(Boolean))]
    .filter(name => !knownCategories.has(normalizeKey(name)))
    .sort((a, b) => a.localeCompare(b, 'es'));

  return { rows, errors, unknownAccounts, unknownCategories };
}

// ── Resolución de cuentas/categorías desconocidas ────────────────

export type Resolution =
  | { action: 'create' }
  | { action: 'map'; target: string }
  | { action: 'skip' };

export type ResolutionMap = Record<string, Resolution>;

export interface BuildResult {
  transactions: Omit<Transaction, 'id'>[];
  /** Cuentas nuevas a crear antes de importar. */
  newAccounts: Account[];
  /** Categorías nuevas a agregar antes de importar. */
  newCategories: string[];
  /** Filas descartadas porque el usuario eligió omitir su cuenta/categoría. */
  skippedCount: number;
}

/**
 * Aplica las decisiones del usuario sobre cuentas/categorías desconocidas y
 * arma los movimientos definitivos. El `id` lo asigna el servidor al importar.
 */
export function buildTransactions(
  rows: ParsedRow[],
  accountResolutions: ResolutionMap,
  categoryResolutions: ResolutionMap,
  currentUserName: string,
): BuildResult {
  const transactions: Omit<Transaction, 'id'>[] = [];
  const newAccountNames = new Set<string>();
  const newCategoryNames = new Set<string>();
  let skippedCount = 0;

  /** Devuelve el nombre final, o null si la fila debe omitirse. */
  const resolve = (value: string, map: ResolutionMap, isNew: Set<string>): string | null => {
    const resolution = map[value];
    if (!resolution) return value; // ya existía en la app
    if (resolution.action === 'skip') return null;
    if (resolution.action === 'map') return resolution.target;
    isNew.add(value);
    return value;
  };

  for (const row of rows) {
    const account = resolve(row.account, accountResolutions, newAccountNames);
    if (account === null) { skippedCount++; continue; }

    let category: string | null = row.category;
    if (row.category) {
      category = resolve(row.category, categoryResolutions, newCategoryNames);
      if (category === null) { skippedCount++; continue; }
    }

    transactions.push({
      date: row.date,
      concept: row.concept,
      amount: row.amount,
      currency: row.currency,
      category: category || 'Otros',
      subcategory: '',
      sourceAccount: account,
      destinationAccount: '',
      type: row.type,
      isShared: row.isShared,
      paidBy: currentUserName,
      isSettled: false,
    });
  }

  // Las cuentas nuevas se crean en la moneda que predomina en sus filas y con
  // saldo 0: el importador no toca saldos (ver nota en ImportModal).
  const newAccounts: Account[] = [...newAccountNames].map(name => {
    const usesUsd = rows.some(r => r.account === name && r.currency === Currency.USD);
    return {
      id: crypto.randomUUID(),
      name,
      type: AccountType.DEBIT,
      balance: 0,
      currency: usesUsd ? Currency.USD : Currency.ARS,
    };
  });

  return { transactions, newAccounts, newCategories: [...newCategoryNames], skippedCount };
}
