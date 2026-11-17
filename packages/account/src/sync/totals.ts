// Spec 2 Totals

import { add, decodeMoney, encodeMoney, money } from '@tableside/engine';

import type { Contribution } from './registry';

export interface TotalsRow {
  readonly total: Contribution['total'];
  readonly game: string;
  readonly currency: string;
  readonly records: number;
  readonly net: string;
}

export function sumContributions(contributions: readonly Contribution[], base: readonly TotalsRow[] = []): TotalsRow[] {
  const rows = new Map<string, { total: Contribution['total']; game: string; currency: string; records: number; net: ReturnType<typeof money> }>();
  for (const { total, game, currency, records, net } of base) rows.set(JSON.stringify([total, game, currency]), { total, game, currency, records, net: decodeMoney(net) });
  for (const { total, game, currency, amount } of contributions) {
    const key = JSON.stringify([total, game, currency]);
    const row = rows.get(key) ?? { total, game, currency, records: 0, net: money(0n) };
    rows.set(key, { ...row, records: row.records + 1, net: add(row.net, decodeMoney(amount)) });
  }
  return [...rows.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, row]) => ({ ...row, net: encodeMoney(row.net) }));
}
