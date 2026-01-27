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

export interface AppData {
  transactions: Transaction[];
  accounts: Account[];
  categories: string[];
  budgets: Budget[];
}

export const formatCurrency = (amount: number, currency: Currency = Currency.ARS) => {
  return amount.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + (currency === Currency.USD ? ' USD' : ' ARS');
};