import type { RoulettePocket, RouletteWheel } from './draws';
import { add, compare, decodeMoney, encodeMoney } from './money';
import { isPocket, placementFor, pocketColor, type RouletteActivityState } from './roulette';
import { isRecord, limitGroupProblems, parseMoney } from './shape';
import type { BetRequirement, StrategyGame, StrategyVocabulary } from './strategy';

const WHEELS: readonly RouletteWheel[] = ['single-zero', 'double-zero'];

export interface RouletteLimits {
  readonly inside: { readonly min: string; readonly max: string };
  readonly outside: { readonly min: string; readonly max: string };
}

export interface RouletteStrategyTable {
  readonly wheels: readonly RouletteWheel[];
  readonly limits: RouletteLimits;
}

export interface RouletteSituation {
  readonly game: 'roulette';
  readonly rules: { readonly wheel: RouletteWheel; readonly limits: RouletteLimits };
  readonly balance: string;
  readonly lastPocket: RoulettePocket | null;
}

const limitsProblems = (limits: unknown, path: string) => limitGroupProblems(limits, ['inside', 'outside'], path);

function situationProblem(situation: unknown): string | undefined {
  if (!isRecord(situation) || Object.keys(situation).sort().join() !== 'balance,game,lastPocket,rules') return 'a roulette situation has game, rules, balance and lastPocket';
  if (situation.game !== 'roulette') return 'not a roulette situation';
  const rules = situation.rules;
  if (!isRecord(rules) || Object.keys(rules).sort().join() !== 'limits,wheel' || !WHEELS.includes(rules.wheel as RouletteWheel)) return 'unknown wheel';
  if (limitsProblems(rules.limits, '').length > 0) return 'the limits contradict the rules';
  const balance = parseMoney(situation.balance);
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
    const wheels = (declared as RouletteStrategyTable).wheels;
    return (actual as RouletteStrategyTable).wheels.every((wheel) => wheels.includes(wheel)) ? [] : [{ path: '/table/wheels', requirement: 'wheel' }];
  },
  situationProblem,
  tableOf: (situation) => ({ wheels: [situation.rules.wheel], limits: situation.rules.limits }),
  available: (situation) => decodeMoney(situation.balance),
  subject: (situation, name) => (name === 'last-pocket-color' && situation.lastPocket !== null ? pocketColor(situation.lastPocket) : 'none'),
};

export const ROULETTE_STRATEGY: StrategyGame<RouletteActivityState> = {
  vocabulary: ROULETTE_VOCABULARY as StrategyVocabulary,
  tableForRules: (rules) => {
    const { wheel, limits } = rules as { wheel: RouletteWheel; limits: RouletteLimits };
    return { wheels: [wheel], limits };
  },
  situation: (state): RouletteSituation => ({
    game: 'roulette',
    rules: { wheel: state.rules.wheel, limits: state.rules.limits },
    balance: encodeMoney(state.wagers.reduce((sum, wager) => add(sum, decodeMoney(wager.amount)), decodeMoney(state.balance))),
    lastPocket: state.outcome?.pocket ?? null,
  }),
  outcome: (state) => String(state.outcome?.pocket),
};
