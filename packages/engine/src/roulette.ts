// The roulette game module: the layout's legal placements, which pockets each
// covers, its payout and limit class. This tracer has the single-zero wheel's
// straight-up and red/black placements; the full layouts arrive with #62.

import type { RoulettePocket } from './draws';

/** The rule ids this engine can run. Rules are pinned by id and version. */
export const ROULETTE_RULES = { id: 'roulette-single-zero', version: 1, wheel: 'single-zero' } as const;

/** Inside placements use the inside limits; outside placements the outside limits. */
export type LimitClass = 'inside' | 'outside';

export interface RoulettePlacement {
  /** Stable target id: "straight-0".."straight-36", "red", "black". */
  readonly target: string;
  readonly limitClass: LimitClass;
  readonly covers: readonly RoulettePocket[];
  /** Net payout per unit staked (35 for 35:1); the stake is returned separately. */
  readonly payout: bigint;
}

const RED: ReadonlySet<number> = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const NUMBERS = Array.from({ length: 36 }, (_, i) => i + 1);

/** Every legal placement on the single-zero layout, in canonical order. */
export const PLACEMENTS: readonly RoulettePlacement[] = [
  ...[0, ...NUMBERS].map((pocket) => ({ target: `straight-${pocket}`, limitClass: 'inside' as const, covers: [pocket], payout: 35n })),
  { target: 'red', limitClass: 'outside', covers: NUMBERS.filter((n) => RED.has(n)), payout: 1n },
  { target: 'black', limitClass: 'outside', covers: NUMBERS.filter((n) => !RED.has(n)), payout: 1n },
];

const BY_TARGET = new Map(PLACEMENTS.map((placement, index) => [placement.target, { placement, index }]));

export const placementFor = (target: string): RoulettePlacement | undefined => BY_TARGET.get(target)?.placement;

/** Canonical layout order, for keeping wagers sorted. */
export const placementOrder = (target: string): number => BY_TARGET.get(target)?.index ?? -1;

export const isPocket = (value: unknown): value is RoulettePocket =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 36;
