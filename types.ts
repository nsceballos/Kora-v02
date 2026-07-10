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

export interface UserConfig {
  id: string;
  name: string;
  email: string;
  avatar: string;
  pin: string;
  color: 'indigo' | 'rose' | 'emerald' | 'amber' | 'cyan' | 'purple';
  registeredAt?: string;
}

export const USER_COLORS: UserConfig['color'][] = ['indigo', 'rose', 'emerald', 'amber', 'cyan', 'purple'];

export const DEFAULT_USERS: UserConfig[] = [
  { id: 'user1', name: 'Yo',     email: '', avatar: '', pin: '', color: 'indigo' },
  { id: 'user2', name: 'Pareja', email: '', avatar: '', pin: '', color: 'rose'   },
];

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

/** Porcentaje de aporte por usuario (id → %). Debe sumar 100. Default 50/50. */
export type SplitPercents = Record<string, number>;

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