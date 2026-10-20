// The roulette module's strategy vocabulary: the targets a roulette strategy
// can bet (every placement on the declared wheels' layouts), its table
// conditions (wheels and inside/outside limits), and the situation of one
// betting decision. The interpreter itself is game-agnostic (strategy.ts).

import type { RoulettePocket, RouletteWheel } from './draws';
import { compare, decodeMoney, type Money } from './money';
import { isPocket, placementFor } from './roulette';
import type { BetRequirement, StrategyVocabulary } from './strategy';

const BASE_WAGER_CEILING = 1_000_000n;
const WHEELS: readonly RouletteWheel[] = ['single-zero', 'double-zero'];

export interface RouletteLimits {
  readonly inside: { readonly min: string; readonly max: string };
  readonly outside: { readonly min: string; readonly max: string };
}

/** A roulette strategy's declared table conditions: the wheels it is written for and their limits. */
export interface RouletteStrategyTable {
  readonly wheels: readonly RouletteWheel[];
  readonly limits: RouletteLimits;
}

/** One roulette betting decision, as Explain prescription takes it. */
export interface RouletteSituation {
  readonly game: 'roulette';
  readonly rules: { readonly wheel: RouletteWheel; readonly limits: RouletteLimits };
  /** Funds the player can commit: the balance plus any stakes still removable. Canonical money. */
  readonly balance: string;
  /** The previous spin's pocket, or null before the first spin. */
  readonly lastPocket: RoulettePocket | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function parse(value: unknown): Money | undefined {
  if (typeof value !== 'string' || value.length > 64) return undefined;
  try {
    return decodeMoney(value);
  } catch {
    return undefined;
  }
}

const whole = (value: unknown) => {
  const amount = parse(value);
  return amount !== undefined && amount.d === 1n && amount.n >= 1n && amount.n <= BASE_WAGER_CEILING ? amount : undefined;
};

function limitsProblems(limits: unknown, path: string): { path: string; message: string }[] {
  if (!isRecord(limits) || Object.keys(limits).sort().join() !== 'inside,outside') return [{ path, message: 'inside and outside limits are required' }];
  const problems: { path: string; message: string }[] = [];
  for (const kind of ['inside', 'outside'] as const) {
    const limit = limits[kind];
    const min = isRecord(limit) ? whole(limit.min) : undefined;
    const max = isRecord(limit) ? whole(limit.max) : undefined;
    if (!isRecord(limit) || Object.keys(limit).sort().join() !== 'max,min' || !min || !max || compare(min, max) > 0) {
      problems.push({ path: `${path}/${kind}`, message: `${kind} limits are whole units from 1 to ${BASE_WAGER_CEILING} with min <= max` });
    }
  }
  return problems;
}

const RED: ReadonlySet<number> = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

const pocketColor = (pocket: RoulettePocket | null) =>
  pocket === null ? 'none' : typeof pocket !== 'number' || pocket === 0 ? 'green' : RED.has(pocket) ? 'red' : 'black';

function situationProblem(situation: unknown): string | undefined {
  if (!isRecord(situation) || Object.keys(situation).sort().join() !== 'balance,game,lastPocket,rules') return 'a roulette situation has game, rules, balance and lastPocket';
  if (situation.game !== 'roulette') return 'not a roulette situation';
  const rules = situation.rules;
  if (!isRecord(rules) || Object.keys(rules).sort().join() !== 'limits,wheel' || !WHEELS.includes(rules.wheel as RouletteWheel)) return 'unknown wheel';
  if (limitsProblems(rules.limits, '').length > 0) return 'the limits contradict the rules';
  const balance = parse(situation.balance);
  if (!balance || balance.n < 0n) return 'the balance must be canonical money, not negative';
  if (situation.lastPocket !== null && !isPocket(rules.wheel as RouletteWheel, situation.lastPocket)) return `${String(situation.lastPocket)} is not a pocket on this wheel`;
  return undefined;
}

export const ROULETTE_VOCABULARY: StrategyVocabulary<RouletteSituation> = {
  game: 'roulette',
  subjects: { 'last-pocket-color': ['red', 'black', 'green', 'none'] },
  tableProblems(table) {
    if (!isRecord(table) || Object.keys(table).sort().join() !== 'limits,wheels') return [{ path: '', message: 'declare the wheels and limits the strategy is written for' }];
    const wheels = table.wheels;
    const problems = limitsProblems(table.limits, '/limits');
    if (!Array.isArray(wheels) || wheels.length === 0 || new Set(wheels).size !== wheels.length || !wheels.every((wheel) => WHEELS.includes(wheel))) {
      problems.unshift({ path: '/wheels', message: 'declare one or both wheels, once each' });
    }
    return problems;
  },
  betRequirement(table, target, amount) {
    const { wheels, limits } = table as RouletteStrategyTable;
    let limitClass: 'inside' | 'outside' | undefined;
    for (const wheel of wheels) {
      const placement = placementFor(wheel, target);
      if (!placement) return { requirement: 'not-on-layout' as BetRequirement };
      limitClass = placement.limitClass;
    }
    const limit = limits[limitClass as 'inside' | 'outside'];
    if (amount.d !== 1n) return { requirement: 'not-whole-units' };
    if (compare(amount, decodeMoney(limit.min)) < 0) return { requirement: 'below-minimum', limit: limit.min };
    if (compare(amount, decodeMoney(limit.max)) > 0) return { requirement: 'above-maximum', limit: limit.max };
    return undefined;
  },
  tableMismatch(declared, actual) {
    const wheel = (actual as RouletteStrategyTable).wheels[0] as RouletteWheel;
    return (declared as RouletteStrategyTable).wheels.includes(wheel) ? [] : [{ path: '/table/wheels', requirement: 'wheel' }];
  },
  situationProblem,
  tableOf: (situation) => ({ wheels: [situation.rules.wheel], limits: situation.rules.limits }),
  available: (situation) => decodeMoney(situation.balance),
  subject: (situation, name) => (name === 'last-pocket-color' ? pocketColor(situation.lastPocket) : 'none'),
};
