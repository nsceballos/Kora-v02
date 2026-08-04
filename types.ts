export enum TransactionType {
  EXPENSE = 'Gasto',
  INCOME = 'Ingreso',
  TRANSFER = 'Transferencia',
  INVESTMENT = 'Inversión'
}

export enum AccountType {
  DEBIT = 'Débito',
  CREDIT = 'Crédito',
  INVESTMENT = 'Inversión',
  CASH = 'Efectivo'
}

export enum Currency {
  ARS = 'ARS',
  USD = 'USD'
}

export type AvatarColor = 'indigo' | 'rose' | 'emerald' | 'amber' | 'cyan' | 'purple';

/**
 * Usuario autenticado. Cada AuthUser es una cuenta independiente: sus
 * transacciones, cuentas, categorías, presupuestos y cierres viven en filas
 * de Google Sheets marcadas con su `id` y nunca se exponen a otros usuarios.
 */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  color: AvatarColor;
}

export interface Transaction {
  id: string;
  date: string;
  concept: string;
  amount: number;
  currency: Currency;
  category: string;
  subcategory: string;
  sourceAccount: string;
  destinationAccount?: string;
  type: TransactionType;
  isShared: boolean;
  paidBy: string;
  isSettled?: boolean;
  synced?: boolean;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: Currency;
  closingDate?: string;
  dueDate?: string;
}

export interface Budget {
  category: string;
  limit: number;
}

/**
 * Cotización del dólar (valor de venta, en ARS). Se obtiene automáticamente
 * de una API pública; `updatedAt` vacío significa que todavía no se pudo
 * traer ninguna cotización real y se están usando los valores de respaldo.
 */
export interface UsdRates {
  official: number;
  blue: number;
  /** Timestamp ISO de la última actualización exitosa ('' si nunca se actualizó). */
  updatedAt: string;
}

/** Registro de un cierre mensual de gastos compartidos */
export interface Settlement {
  id: string;
  /** Fecha en que se realizó el cierre (YYYY-MM-DD) */
  date: string;
  /** Período que abarca, ej. "Julio 2026" o "2026-07" */
  period: string;
  /** Total de gastos compartidos (en ARS) incluidos en el cierre */
  total: number;
  userA: string;
  paidA: number;
  percentA: number;
  userB: string;
  paidB: number;
  percentB: number;
  /** Quién debía transferir */
  debtor: string;
  /** Quién recibía la transferencia */
  creditor: string;
  /** Monto transferido (en ARS). 0 si quedaron a mano. */
  amount: number;
  /** Cantidad de movimientos saldados en este cierre */
  txCount: number;
}

/** % que aporta el usuario actual a los gastos compartidos (el resto es del/de la partner). Default 50/50. */
export const DEFAULT_SPLIT = 50;

export interface AppData {
  transactions: Transaction[];
  accounts: Account[];
  categories: string[];
  budgets: Budget[];
  settlements: Settlement[];
  config: Record<string, string>;
}

export const formatCurrency = (amount: number, currency: Currency = Currency.ARS) => {
  return amount.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + (currency === Currency.USD ? ' USD' : ' ARS');
};