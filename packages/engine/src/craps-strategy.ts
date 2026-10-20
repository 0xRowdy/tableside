// The standard craps strategy vocabulary (Amendment 2 A3): what a craps
// strategy can test (the puck, the point, which line bases are established
// and how many come bases are working), the targets it can bet (the whole
// standard menu), its table conditions (the odds caps it is written for and
// the table limits) and the situation of one betting decision. It is
// standard craps' own, so crapless craps can replace it. The interpreter
// itself is game-agnostic (strategy.ts).
//
// A craps prescription is the whole table the next roll should see: bases
// already established stay in it at their amounts (they can't change), and
// standing bets that stayed up after a win are prescribed again at the
// amounts the strategy's counters hold.

import {
  CRAPS_POINTS,
  crapsBetProblem,
  establishedBases,
  isBaseTarget,
  ODDS_CAPS,
  type CrapsActivityState,
  type CrapsBase,
  type CrapsPoint,
  type CrapsRuleSet,
  type FieldPayout,
  type OddsCap,
  FIELD_PAYOUTS,
} from './craps';
import { add, compare, decodeMoney, encodeMoney } from './money';
import { BASE_WAGER_CEILING, hasExactKeys, isWholeIn, limitGroupProblems, parseMoney } from './shape';
import type { StrategyGame, StrategyVocabulary } from './strategy';

type Limits = CrapsRuleSet['limits'];

/** A craps strategy's declared table conditions: the odds caps it is written for and the table limits. */
export interface CrapsStrategyTable {
  readonly odds: readonly OddsCap[];
  readonly limits: Limits;
}

/** One craps betting decision, as Explain prescription takes it. */
export interface CrapsSituation {
  readonly game: 'craps';
  readonly rules: { readonly odds: OddsCap; readonly field: FieldPayout; readonly limits: Limits };
  /** Funds for the next roll's wagers: the balance plus every stake on the table (bases included). Canonical money. */
  readonly balance: string;
  /** The point, or null while the puck is off. */
  readonly point: CrapsPoint | null;
  /** The line bases established on the table, in table order. */
  readonly bases: readonly CrapsBase[];
}

/** An actual table, as a situation states it: the declared shape plus the puck and the bases. */
interface CrapsTableNow extends CrapsStrategyTable {
  readonly point: CrapsPoint | null;
  readonly bases: readonly CrapsBase[];
}

const POINT_VALUES = CRAPS_POINTS.map(String);
const ON_OFF = ['on', 'off'];
const BASE_SUBJECTS = ['pass', 'dont-pass', ...CRAPS_POINTS.flatMap((n) => [`come-${n}`, `dont-come-${n}`])];

const SUBJECTS: Record<string, readonly string[]> = {
  puck: ON_OFF,
  point: ['none', ...POINT_VALUES],
  ...Object.fromEntries(BASE_SUBJECTS.map((subject) => [subject, ON_OFF])),
  /** Come bases that have traveled to a number (a come bet still in the come area is not one yet). */
  'come-bases': ['0', '1', '2', '3', '4', '5', '6'],
};

const limitsProblems = (limits: unknown, path: string) => limitGroupProblems(limits, ['flat', 'props'], path);

/** A canonical whole-unit amount within the base-wager ceiling. */
const whole = (value: unknown) => {
  const amount = parseMoney(value);
  return isWholeIn(amount, 1n, BASE_WAGER_CEILING) ? amount : undefined;
};

function situationProblem(situation: unknown): string | undefined {
  if (!hasExactKeys(situation, ['balance', 'bases', 'game', 'point', 'rules'])) return 'a craps situation has game, rules, balance, point and bases';
  if (situation.game !== 'craps') return 'not a craps situation';
  const rules = situation.rules;
  if (!hasExactKeys(rules, ['field', 'limits', 'odds']) || !ODDS_CAPS.includes(rules.odds as OddsCap) || !FIELD_PAYOUTS.includes(rules.field as FieldPayout)) {
    return 'unknown craps rules';
  }
  if (limitsProblems(rules.limits, '').length > 0) return 'the limits contradict the rules';
  const balance = parseMoney(situation.balance);
  if (!balance || balance.n < 0n || encodeMoney(balance) !== situation.balance) return 'the balance must be canonical money, not negative';
  const point = situation.point;
  if (point !== null && !CRAPS_POINTS.includes(point as CrapsPoint)) return `${String(point)} is not a point`;
  const bases = situation.bases;
  if (!Array.isArray(bases)) return 'bases are a list';
  const seen = new Set<string>();
  let staked = decodeMoney('0');
  for (const base of bases as unknown[]) {
    if (!hasExactKeys(base, ['amount', 'target']) || typeof base.target !== 'string') return 'a base has a target and an amount';
    if (!isBaseTarget(base.target, point as CrapsPoint | null) || seen.has(base.target)) return `${String(base.target)} can't be an established base here`;
    const amount = whole(base.amount);
    if (!amount || encodeMoney(amount) !== base.amount) return 'a base amount is whole units';
    if (crapsBetProblem(rules as unknown as CrapsRuleSet, base.target, amount)) return `${base.target} ${base.amount} is outside the table limits`;
    seen.add(base.target);
    staked = add(staked, amount);
  }
  if (compare(staked, balance) > 0) return 'the balance must include the stakes of the bases';
  return undefined;
}

const subjectOf = (situation: CrapsSituation, name: string): string => {
  const { point, bases } = situation;
  if (name === 'puck') return point === null ? 'off' : 'on';
  if (name === 'point') return point === null ? 'none' : String(point);
  if (name === 'come-bases') return String(bases.filter((base) => base.target.startsWith('come-')).length);
  return bases.some((base) => base.target === name) ? 'on' : 'off';
};

export const CRAPS_VOCABULARY: StrategyVocabulary<CrapsSituation> = {
  game: 'craps',
  subjects: SUBJECTS,
  overrideEndsCycle: true,
  tableProblems(table) {
    if (!hasExactKeys(table, ['limits', 'odds'])) return [{ path: '', message: 'declare the odds caps and limits the strategy is written for' }];
    const problems = limitsProblems(table.limits, '/limits');
    const odds = table.odds;
    if (!Array.isArray(odds) || odds.length === 0 || new Set(odds).size !== odds.length || !odds.every((cap) => ODDS_CAPS.includes(cap))) {
      problems.unshift({ path: '/odds', message: 'declare one or more odds caps, once each' });
    }
    return problems;
  },
  betRequirement(table, target, amount) {
    const { odds, limits, point, bases } = table as CrapsTableNow;
    // Judged under the first declared cap for a declared table: amounts that hold on every roll don't depend on it.
    const rules = { odds: odds[0] as OddsCap, limits };
    const requirement = crapsBetProblem(rules, target, amount, point === undefined ? undefined : { point, bases });
    if (!requirement) return undefined;
    const limit = requirement === 'below-minimum' || requirement === 'above-maximum' ? limitFor(target, limits, requirement) : undefined;
    return { requirement, ...(limit === undefined ? {} : { limit }) };
  },
  tableMismatch(declared, actual) {
    const odds = (declared as CrapsStrategyTable).odds;
    return (actual as CrapsStrategyTable).odds.every((cap) => odds.includes(cap)) ? [] : [{ path: '/table/odds', requirement: 'odds' }];
  },
  situationProblem,
  tableOf: (situation): CrapsTableNow => ({ odds: [situation.rules.odds], limits: situation.rules.limits, point: situation.point, bases: situation.bases }),
  available: (situation) => decodeMoney(situation.balance),
  subject: subjectOf,
};

/** The table limit a bet fails: proposition limits for hardways and one-roll bets, flat limits otherwise (the horn's are per part). */
function limitFor(target: string, limits: Limits, requirement: 'below-minimum' | 'above-maximum'): string {
  const props = /^(hard-|prop-|any-)/.test(target) || target === 'horn';
  const limit = props ? limits.props : limits.flat;
  return requirement === 'below-minimum' ? limit.min : limit.max;
}

/** Craps' part of guided practice: its vocabulary, its table conditions, and the betting situation of a state. */
export const CRAPS_STRATEGY: StrategyGame<CrapsActivityState> = {
  vocabulary: CRAPS_VOCABULARY as StrategyVocabulary,
  tableForRules: (rules) => {
    const { odds, limits } = rules as Pick<CrapsRuleSet, 'odds' | 'limits'>;
    return { odds: [odds], limits };
  },
  // Every stake on the table counts toward the funds for the next roll: the prescription restates the bases at their amounts.
  situation: (state): CrapsSituation => ({
    game: 'craps',
    rules: { odds: state.rules.odds, field: state.rules.field, limits: state.rules.limits },
    balance: encodeMoney(state.wagers.reduce((sum, wager) => add(sum, decodeMoney(wager.amount)), decodeMoney(state.balance))),
    point: state.point,
    bases: establishedBases(state),
  }),
  outcome: (state) => (state.outcome ? `${state.outcome.dice[0]}+${state.outcome.dice[1]}` : 'none'),
};
