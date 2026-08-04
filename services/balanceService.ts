import { Account, Currency, Transaction, TransactionType } from '../types';

/**
 * Kora Balance Service - impacto de los movimientos sobre el saldo de las cuentas.
 *
 * Lógica pura y compartida por la carga manual, el borrado y la importación
 * masiva, para que todas apliquen exactamente el mismo criterio:
 *
 *   Gasto          → resta de la cuenta origen
 *   Ingreso        → suma a la cuenta origen
 *   Transferencia  → resta del origen y suma al destino
 *   Inversión      → ídem transferencia
 */

/** Lo mínimo que hace falta de un movimiento para calcular su impacto. */
export type BalanceMovement = Pick<
  Transaction,
  'type' | 'amount' | 'currency' | 'sourceAccount' | 'destinationAccount'
>;

/**
 * Lleva un importe a la moneda de la cuenta usando el dólar oficial (venta).
 * Si no hay cotización válida se devuelve el importe sin convertir, para no
 * corromper el saldo con una división por cero.
 */
export function convertAmount(
  amount: number,
  from: Currency,
  to: Currency,
  usdRate: number,
): number {
  if (from === to) return amount;
  if (!Number.isFinite(usdRate) || usdRate <= 0) return amount;
  return from === Currency.USD ? amount * usdRate : amount / usdRate;
}

/** Evita que la suma de muchos movimientos arrastre error de punto flotante. */
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface BalanceUpdate {
  /** Todas las cuentas, con los saldos ya ajustados. */
  accounts: Account[];
  /** Solo las cuentas cuyo saldo cambió — las que hay que persistir. */
  changed: Account[];
}

/**
 * Aplica el impacto de `movements` sobre los saldos de `accounts`.
 *
 * `sign` en -1 revierte los movimientos (se usa al borrar o al editar, para
 * deshacer el efecto del movimiento anterior antes de aplicar el nuevo).
 * Los movimientos cuya cuenta no existe se ignoran.
 */
export function applyToBalances(
  accounts: Account[],
  movements: BalanceMovement[],
  usdRate: number,
  sign: 1 | -1 = 1,
): BalanceUpdate {
  const deltaByName = new Map<string, number>();

  const addDelta = (accountName: string | undefined, amount: number, currency: Currency) => {
    if (!accountName) return;
    const account = accounts.find(a => a.name === accountName);
    if (!account) return; // movimiento de una cuenta que ya no existe
    const inAccountCurrency = convertAmount(amount, currency, account.currency, usdRate);
    deltaByName.set(accountName, (deltaByName.get(accountName) ?? 0) + inAccountCurrency * sign);
  };

  for (const movement of movements) {
    const { type, amount, currency } = movement;
    if (!Number.isFinite(amount)) continue;

    if (type === TransactionType.EXPENSE) {
      addDelta(movement.sourceAccount, -amount, currency);
    } else if (type === TransactionType.INCOME) {
      addDelta(movement.sourceAccount, amount, currency);
    } else if (type === TransactionType.TRANSFER || type === TransactionType.INVESTMENT) {
      addDelta(movement.sourceAccount, -amount, currency);
      addDelta(movement.destinationAccount, amount, currency);
    }
  }

  const changed: Account[] = [];
  const updated = accounts.map(account => {
    const delta = deltaByName.get(account.name);
    if (!delta) return account;
    const next = { ...account, balance: round2(account.balance + delta) };
    changed.push(next);
    return next;
  });

  return { accounts: updated, changed };
}
