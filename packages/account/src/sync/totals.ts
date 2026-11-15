// Lifetime totals from contributions (spec 2, *Totals*): exact money, one
// figure per total, game and currency. The server keeps the account's own
// in `private.account_totals`, by the same rule.

import { add, decodeMoney, encodeMoney, money } from '@tableside/engine';

import type { Contribution } from './registry';

export interface TotalsRow {
  readonly total: Contribution['total'];
  readonly game: string;
  readonly currency: string;
  /** How many records it counts. */
  readonly records: number;
  /** Their net result, as exact money text. */
  readonly net: string;
}

/** Sums contributions, ordered by total, game and currency. Throws on an amount that isn't canonical money. */
export function sumContributions(contributions: readonly Contribution[]): TotalsRow[] {
  const rows = new Map<string, { total: Contribution['total']; game: string; currency: string; records: number; net: ReturnType<typeof money> }>();
  for (const { total, game, currency, amount } of contributions) {
    const key = JSON.stringify([total, game, currency]);
    const row = rows.get(key) ?? { total, game, currency, records: 0, net: money(0n) };
    rows.set(key, { ...row, records: row.records + 1, net: add(row.net, decodeMoney(amount)) });
  }
  return [...rows.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, row]) => ({ ...row, net: encodeMoney(row.net) }));
}
