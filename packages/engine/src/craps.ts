// The standard craps game module: the launch menu. Pass/come and don't
// pass/don't come with attached odds; place, buy and standalone lay bets on
// the box numbers; the field; hardways; and the one-roll propositions,
// including the horn. It owns the point puck, working status and per-bet
// working instructions, which wagers are contracts, commissions, and how one
// roll (one turn) settles.
//
// Standard craps is its own variant identity. Crapless craps (later) gets its
// own module; a strategy compatible with this one is not automatically
// compatible with it. Rules: #3 (Launch game rules) and spec #51.

import type { ActivityStateBase, CrapsPermittedView, DomainFact, GameCommand, GameModule, Step, Wager } from './activity';
import { rollDice } from './draws';
import { add, commission, compare, decodeMoney, encodeMoney, money, mul, neg, sub, type Money } from './money';
import { RandomStream } from './random';
import { BASE_WAGER_CEILING, hasExactKeys, isCount, isLimit, isWagerList, type Limit, type VersionedIdentity } from './shape';

export type OddsCap = '1x' | '2x' | '3-4-5x' | '5x' | '10x';
export type CrapsPoint = 4 | 5 | 6 | 8 | 9 | 10;
/** What a field 12 pays: triple (3:1, the default) or double (2:1). A field 2 always pays double. */
export type FieldPayout = 'triple-12' | 'double-12';
export type Hardway = 4 | 6 | 8 | 10;

export const ODDS_CAPS: readonly OddsCap[] = ['1x', '2x', '3-4-5x', '5x', '10x'];
export const CRAPS_POINTS: readonly CrapsPoint[] = [4, 5, 6, 8, 9, 10];
export const FIELD_PAYOUTS: readonly FieldPayout[] = ['triple-12', 'double-12'];
export const HARDWAYS: readonly Hardway[] = [4, 6, 8, 10];
/** The one-roll propositions besides the horn, in table order. */
export const PROPOSITIONS = ['any-seven', 'any-craps', 'prop-2', 'prop-3', 'prop-11', 'prop-12'] as const;
/** The horn's four parts: an equal share of its stake on each of these totals. */
export const HORN_PARTS = [2, 3, 11, 12] as const;

/**
 * The versioned capability description of the standard craps variant: what a
 * table of this variant offers, so strategies and presets can be checked
 * against it. A new wager family or rule option bumps the version.
 */
export const STANDARD_CRAPS = {
  id: 'standard-craps',
  version: 2,
  wagers: [
    'pass', 'dont-pass', 'come', 'dont-come', 'pass-odds', 'dont-pass-odds', 'come-odds', 'dont-come-odds',
    'place', 'buy', 'lay', 'field', 'hardway', 'any-seven', 'any-craps', 'prop-2', 'prop-3', 'prop-11', 'prop-12', 'horn',
  ],
  oddsCaps: ODDS_CAPS,
  fieldPayouts: FIELD_PAYOUTS,
  defaults: { odds: '3-4-5x', field: 'triple-12', comeOddsOnComeOut: 'off', placeAndBuyOnComeOut: 'off' },
  /** Don't bets push on this come-out total ("bar 12"). */
  dontBar: 12,
  /** Contracts: once their number is set, these bases can't be lowered or taken down. */
  contracts: ['pass', 'come'],
  /** Wagers that take a per-bet working instruction ("on" or "off"). Everything else always works. */
  switchable: ['place', 'buy', 'lay', 'hardway', 'come-odds', 'dont-come-odds'],
  /** Buy: 5% of the stake; standalone lay: 5% of the potential gross win. Only on a win, per bet, rounded up to a whole unit, minimum 1. Attached odds pay none. */
  commission: { rate: '1/20', buy: 'stake', lay: 'win', rounding: 'up', minimum: '1' },
} as const;

export interface CrapsRuleSet extends VersionedIdentity {
  readonly odds: OddsCap;
  readonly field: FieldPayout;
  readonly limits: {
    /** Per wager or number: pass, don't pass, come, don't come, place, buy, lay and field. */
    readonly flat: Limit;
    /** Per component: hardways and propositions (each horn part). */
    readonly props: Limit;
  };
}

export interface CrapsOutcome {
  readonly turn: number;
  readonly dice: readonly [number, number];
}

/** A per-bet working instruction: overrides the wager's default working status until it changes or the wager leaves the table. */
export interface WorkingInstruction {
  readonly target: string;
  readonly working: boolean;
}

export interface CrapsActivityState extends ActivityStateBase<'craps'> {
  /** The pinned rule content, not a pointer to current definitions. */
  readonly rules: Pick<CrapsRuleSet, 'odds' | 'field' | 'limits'>;
  /** The latest roll. */
  readonly outcome: CrapsOutcome | null;
  /** The point puck: null while it is off (the next roll is a come-out roll). */
  readonly point: CrapsPoint | null;
  /** Working instructions for wagers on the table, in table order. */
  readonly instructions: readonly WorkingInstruction[];
}

export type CrapsIllegalActionReason =
  /** A contract base (pass or come with its number set) can't be lowered or taken down; an established don't can only come down. */
  | 'committed-wager'
  /** The wager can't be made in this state of the game (pass after the point is set, come before, odds without a base). */
  | 'not-available-now'
  /** More odds than the table's odds cap allows behind this base. */
  | 'above-odds-cap'
  /** Odds must be a multiple that pays whole units. */
  | 'odds-increment'
  /** Place, buy, lay and horn stakes go in their own multiples (place 6 and 8 in 6s, other place numbers in 5s, the horn in 4s). */
  | 'stake-increment'
  /** The balance left after the stake can't cover the commission a win would charge. */
  | 'commission-unfunded'
  /** This wager takes no working instruction: it always works. */
  | 'working-fixed';

export type CrapsDomainFact =
  | { readonly kind: 'dice-rolled'; readonly turn: number; readonly dice: readonly [number, number] }
  /** The puck moved: on at a point, or off (null). */
  | { readonly kind: 'point-changed'; readonly turn: number; readonly point: CrapsPoint | null }
  /** A come or don't come bet traveled to its number. */
  | { readonly kind: 'wager-moved'; readonly turn: number; readonly from: string; readonly to: string; readonly amount: string }
  /** A don't bet's bar-12 standoff: no money moves and the wager stays on the table. */
  | { readonly kind: 'wager-pushed'; readonly turn: number; readonly target: string; readonly stake: string }
  /** A working instruction was given: the wager now works (or is off) whatever the puck says. */
  | { readonly kind: 'working-changed'; readonly target: string; readonly working: boolean };

export interface CrapsWagerStatus {
  readonly target: string;
  /** Whether the wager acts on the next roll ("ON") or is off. */
  readonly working: boolean;
  /** The player's working instruction, or null when the default applies. */
  readonly instruction: boolean | null;
  /** Whether it takes a working instruction. */
  readonly switchable: boolean;
  /** False for a contract: pass or come with its number set. */
  readonly removable: boolean;
}

export type CrapsPlacementKind = 'line' | 'odds' | 'place' | 'buy' | 'lay' | 'field' | 'hardway' | 'proposition' | 'horn';

export interface CrapsPlacement {
  readonly target: string;
  readonly kind: CrapsPlacementKind;
  readonly min: string;
  readonly max: string;
  /** Stakes go in multiples of this. */
  readonly increment: string;
  /** Net payout ratio, profit to stake: "1:1", "6:5", "5:6". The field gives "1:1" (2 and 12 pay more); the horn gives its parts' "30:1/15:1". */
  readonly payout: string;
  /** What a win's commission is charged on: the stake (buy) or the gross win (lay). Absent when no commission applies. */
  readonly commission?: 'stake' | 'win';
}

export interface CrapsTable {
  readonly variant: VersionedIdentity;
  readonly odds: OddsCap;
  readonly field: FieldPayout;
  readonly point: CrapsPoint | null;
  readonly limits: CrapsRuleSet['limits'];
  /** Working status and removability of every wager on the table, in table order. */
  readonly wagers: readonly CrapsWagerStatus[];
  /** What can be placed or raised in the current state of the game. */
  readonly placements: readonly CrapsPlacement[];
}

// ---- targets ----------------------------------------------------------

type Line = 'pass' | 'come';

/** A line base or its attached odds. */
interface LineTarget {
  readonly family: 'line';
  readonly target: string;
  /** The base a wager belongs to (itself for a base). */
  readonly base: string;
  readonly odds: boolean;
  readonly dont: boolean;
  readonly line: Line;
  /** The fixed number of a come or don't come bet that has traveled; null for pass, don't pass and the come areas. */
  readonly number: CrapsPoint | null;
}

/** A place, buy or standalone lay bet on a box number. */
interface BoxTarget {
  readonly family: 'place' | 'buy' | 'lay';
  readonly target: string;
  readonly number: CrapsPoint;
}

interface HardTarget {
  readonly family: 'hardway';
  readonly target: string;
  readonly number: Hardway;
}

/** A one-roll bet: the field, a proposition or the horn. */
interface OneRollTarget {
  readonly family: 'field' | 'proposition' | 'horn';
  readonly target: string;
  /** Totals that win (the horn's parts each win on one of them). */
  readonly totals: readonly number[];
}

type TargetInfo = LineTarget | BoxTarget | HardTarget | OneRollTarget;

const info = (target: string, line: Line, dont: boolean, number: CrapsPoint | null, odds: boolean): LineTarget => ({
  family: 'line',
  target,
  base: odds ? target.slice(0, -'-odds'.length) : target,
  odds,
  dont,
  line,
  number,
});

const PROPOSITION_TOTALS: Record<(typeof PROPOSITIONS)[number], readonly number[]> = {
  'any-seven': [7],
  'any-craps': [2, 3, 12],
  'prop-2': [2],
  'prop-3': [3],
  'prop-11': [11],
  'prop-12': [12],
};

/** Every target in table order. */
const TARGETS: readonly TargetInfo[] = [
  info('pass', 'pass', false, null, false),
  info('pass-odds', 'pass', false, null, true),
  info('dont-pass', 'pass', true, null, false),
  info('dont-pass-odds', 'pass', true, null, true),
  info('come', 'come', false, null, false),
  info('dont-come', 'come', true, null, false),
  ...CRAPS_POINTS.flatMap((n) => [
    info(`come-${n}`, 'come', false, n, false),
    info(`come-${n}-odds`, 'come', false, n, true),
    info(`dont-come-${n}`, 'come', true, n, false),
    info(`dont-come-${n}-odds`, 'come', true, n, true),
  ]),
  ...(['place', 'buy', 'lay'] as const).flatMap((family) => CRAPS_POINTS.map((number): BoxTarget => ({ family, target: `${family}-${number}`, number }))),
  { family: 'field', target: 'field', totals: [2, 3, 4, 9, 10, 11, 12] },
  ...HARDWAYS.map((number): HardTarget => ({ family: 'hardway', target: `hard-${number}`, number })),
  ...PROPOSITIONS.map((target): OneRollTarget => ({ family: 'proposition', target, totals: PROPOSITION_TOTALS[target] })),
  { family: 'horn', target: 'horn', totals: HORN_PARTS },
];

const BY_TARGET = new Map(TARGETS.map((target, index) => [target.target, { target, index }]));
const targetInfo = (target: string) => BY_TARGET.get(target)?.target;
const targetOrder = (target: string): number => BY_TARGET.get(target)?.index ?? -1;
/** Every stored target is known (placeWager and decode both check). */
const known = (target: string) => targetInfo(target) as TargetInfo;
const lineInfo = (target: string) => targetInfo(target) as LineTarget;

/** The number a base or its odds acts on: a traveled bet's own number, or the point for the pass line. */
const numberOf = (target: LineTarget, point: CrapsPoint | null): CrapsPoint | null =>
  target.line === 'pass' ? point : target.number;

/** A base whose number is set: it can carry odds. */
const established = (target: LineTarget, point: CrapsPoint | null) => !target.odds && numberOf(target, point) !== null;

/** Contracts can't be lowered or taken down once their number is set. */
const isContract = (target: TargetInfo, point: CrapsPoint | null) => target.family === 'line' && !target.dont && established(target, point);

/** Whether a wager takes a working instruction: place, buy, lay, hardways and the odds on traveled come and don't come bets. */
const isSwitchable = (target: TargetInfo) =>
  target.family === 'line' ? target.odds && target.number !== null : target.family !== 'field' && target.family !== 'proposition' && target.family !== 'horn';

/**
 * Working status without an instruction. Come odds, place and buy bets are off
 * on the come-out roll; everything else works on every roll.
 */
function worksByDefault(target: TargetInfo, point: CrapsPoint | null): boolean {
  if (target.family === 'line') return !(target.odds && target.line === 'come' && !target.dont && point === null);
  if (target.family === 'place' || target.family === 'buy') return point !== null;
  return true;
}

const instructionOf = (state: Pick<State, 'instructions'>, target: string) => state.instructions.find((item) => item.target === target)?.working;

const isWorking = (state: Pick<State, 'instructions' | 'point'>, target: TargetInfo) =>
  instructionOf(state, target.target) ?? worksByDefault(target, state.point);

// ---- payouts ----------------------------------------------------------

/** True odds when taking odds: profit per unit staked (2:1, 3:2, 6:5). Laying pays the inverse. */
const TRUE_ODDS: Record<CrapsPoint, Money> = { 4: money(2n), 10: money(2n), 5: money(3n, 2n), 9: money(3n, 2n), 6: money(6n, 5n), 8: money(6n, 5n) };
const PLACE_PAYS: Record<CrapsPoint, Money> = { 4: money(9n, 5n), 10: money(9n, 5n), 5: money(7n, 5n), 9: money(7n, 5n), 6: money(7n, 6n), 8: money(7n, 6n) };
const HARD_PAYS: Record<Hardway, Money> = { 4: money(7n), 10: money(7n), 6: money(9n), 8: money(9n) };
const PROPOSITION_PAYS: Record<(typeof PROPOSITIONS)[number], Money> = {
  'any-seven': money(4n),
  'any-craps': money(7n),
  'prop-2': money(30n),
  'prop-3': money(15n),
  'prop-11': money(15n),
  'prop-12': money(30n),
};
/** Each horn part pays as the individual proposition on its total. */
const hornPartPays = (total: number) => (total === 2 || total === 12 ? money(30n) : money(15n));
const fieldPays = (total: number, field: FieldPayout) => (total === 2 ? money(2n) : total === 12 ? money(field === 'triple-12' ? 3n : 2n) : money(1n));

const COMMISSION_RATE = money(1n, 20n);

/** Taking-odds multiple of the base. Under 3-4-5x it depends on the number. */
function oddsMultiple(cap: OddsCap, n: CrapsPoint): bigint {
  if (cap === '3-4-5x') return n === 4 || n === 10 ? 3n : n === 5 || n === 9 ? 4n : 5n;
  return BigInt(cap.slice(0, -1));
}

/** Profit per unit of odds stake (or of a buy or lay stake): true odds, inverted when laying. */
const trueOddsPayout = (dont: boolean, n: CrapsPoint): Money => (dont ? money(TRUE_ODDS[n].d, TRUE_ODDS[n].n) : TRUE_ODDS[n]);

/** The smallest stake that pays whole units: the payout ratio's denominator. */
const wholeIncrement = (ratio: Money): bigint => ratio.d;

/**
 * The largest odds stake behind a base. Taking: the multiple times the base.
 * Laying: the cap is the amount to win, so the laid stake is that win at true
 * odds (6× the base on every number under 3-4-5x).
 */
function oddsCap(cap: OddsCap, dont: boolean, n: CrapsPoint, base: Money): Money {
  const take = mul(base, money(oddsMultiple(cap, n)));
  return dont ? mul(take, TRUE_ODDS[n]) : take;
}

const ratioText = (ratio: Money) => `${ratio.n.toString()}:${ratio.d.toString()}`;

/** Profit per unit staked on a non-line wager (the horn's parts aside). */
function payoutOf(target: Exclude<TargetInfo, LineTarget>, field: FieldPayout): Money {
  switch (target.family) {
    case 'place':
      return PLACE_PAYS[target.number];
    case 'buy':
      return trueOddsPayout(false, target.number);
    case 'lay':
      return trueOddsPayout(true, target.number);
    case 'hardway':
      return HARD_PAYS[target.number];
    case 'proposition':
      return PROPOSITION_PAYS[target.target as (typeof PROPOSITIONS)[number]];
    case 'field':
      return fieldPays(3, field);
    case 'horn':
      return money(15n);
  }
}

/** Stakes on a non-line wager go in multiples of this. */
function stakeIncrement(target: Exclude<TargetInfo, LineTarget>): bigint {
  switch (target.family) {
    case 'place':
      return target.number === 6 || target.number === 8 ? 6n : 5n;
    case 'buy':
    case 'lay':
      return wholeIncrement(payoutOf(target, 'triple-12'));
    case 'horn':
      return BigInt(HORN_PARTS.length);
    default:
      return 1n;
  }
}

/** The commission a winning buy or lay with this stake would charge; zero for every other wager. */
function commissionFor(target: TargetInfo, stake: Money): Money {
  if (target.family === 'buy') return commission(stake, COMMISSION_RATE);
  if (target.family === 'lay') return commission(mul(stake, payoutOf(target, 'triple-12')), COMMISSION_RATE);
  return money(0n);
}

/** Limits on a non-line wager's stake: whole multiples of its increment within the table limit (per part for the horn). */
function stakeLimits(target: Exclude<TargetInfo, LineTarget>, rules: State['rules']): { min: bigint; max: bigint; increment: bigint } {
  const props = target.family === 'hardway' || target.family === 'proposition' || target.family === 'horn';
  const limit = props ? rules.limits.props : rules.limits.flat;
  const increment = stakeIncrement(target);
  const parts = target.family === 'horn' ? increment : 1n;
  const low = BigInt(limit.min) * parts;
  const high = BigInt(limit.max) * parts;
  const step = target.family === 'horn' ? parts : increment;
  return { min: ((low + step - 1n) / step) * step, max: (high / step) * step, increment: step };
}

// ---- module -----------------------------------------------------------

type State = CrapsActivityState;

const stakeOf = (wagers: readonly Wager[], target: string) => {
  const found = wagers.find((wager) => wager.target === target);
  return found ? decodeMoney(found.amount) : undefined;
};

const sorted = <T extends { target: string }>(items: T[]) => items.sort((a, b) => targetOrder(a.target) - targetOrder(b.target));

/** Instructions belong to wagers on the table: they leave with them. */
const keptInstructions = (instructions: readonly WorkingInstruction[], wagers: readonly Wager[]) =>
  instructions.filter((item) => wagers.some((wager) => wager.target === item.target));

function apply(state: State, command: GameCommand): Step<State> {
  switch (command.kind) {
    case 'place-wager':
      return placeWager(state, command.target, decodeMoney(command.amount));
    case 'set-working':
      return setWorking(state, command.target, command.working);
    case 'begin-turn': {
      if (state.wagers.length === 0) return { illegal: 'no-wager' };
      return roll(state);
    }
    case 'settle-turn': {
      const settled = settle(state);
      return { change: { phase: 'settled-outcome', ...settled.change }, facts: settled.facts };
    }
    case 'request-stop':
      return requestStop(state);
    case 'advance-final-settlement': {
      if (state.wagers.length === 0) return { change: { phase: 'completed' }, facts: [{ kind: 'activity-completed', balance: state.balance }] };
      // Further rolls resolve only the contracts already on the table.
      const rolled = roll(state) as Extract<Step<State>, { change: unknown }>;
      const next = { ...state, ...rolled.change } as State;
      const settled = settle(next);
      const facts = [...rolled.facts, ...settled.facts];
      const done = settled.change.wagers.length === 0;
      if (done) facts.push({ kind: 'activity-completed', balance: settled.change.balance });
      return { change: { ...rolled.change, ...settled.change, phase: done ? 'completed' : 'final-settlement' }, facts };
    }
  }
}

/** One roll of the dice from the random protocol: one turn. */
function roll(state: State): Step<State> {
  const stream = RandomStream.restore(state.random);
  const dice = rollDice(stream);
  const turn = state.turn + 1;
  return {
    change: { phase: 'revealing-outcome', turn, outcome: { turn, dice }, random: stream.state() },
    facts: [{ kind: 'turn-began', turn, wagers: state.wagers }, { kind: 'dice-rolled', turn, dice }],
  };
}

/** A legal per-bet working instruction. Giving the default status clears the instruction. */
function setWorking(state: State, target: string, working: boolean): Step<State> {
  const placed = targetInfo(target);
  if (!placed) return { illegal: 'unknown-target' };
  if (!isSwitchable(placed)) return { illegal: 'working-fixed' };
  if (!stakeOf(state.wagers, target)) return { illegal: 'not-available-now' };
  const others = state.instructions.filter((item) => item.target !== target);
  const instructions = working === worksByDefault(placed, state.point) ? others : sorted([...others, { target, working }]);
  return { change: { phase: 'open-decision', instructions }, facts: [{ kind: 'working-changed', target, working }] };
}

function placeWager(state: State, target: string, amount: Money): Step<State> {
  const placed = targetInfo(target);
  if (!placed) return { illegal: 'unknown-target' };
  if (amount.d !== 1n) return { illegal: 'not-whole-units' };
  const existing = stakeOf(state.wagers, target);
  if (amount.n === 0n && !existing) return { illegal: 'no-wager-to-remove' };
  const { point } = state;
  const changes: { target: string; amount: Money }[] = [{ target, amount }];

  if (placed.family !== 'line') {
    if (amount.n !== 0n) {
      const limits = stakeLimits(placed, state.rules);
      if (amount.n % limits.increment !== 0n) return { illegal: 'stake-increment' };
      if (amount.n < limits.min) return { illegal: 'below-minimum' };
      if (amount.n > limits.max) return { illegal: 'above-maximum' };
    }
  } else if (!placed.odds) {
    if (established(placed, point)) {
      // Pass and come are contracts once their number is set. An established
      // don't bet may come down (with its odds) but can't be raised or lowered.
      if (!existing) return { illegal: 'not-available-now' };
      if (!placed.dont || amount.n !== 0n) return { illegal: 'committed-wager' };
      const odds = stakeOf(state.wagers, `${target}-odds`);
      if (odds) changes.push({ target: `${target}-odds`, amount: money(0n) });
    } else {
      // Pass and don't pass are made before a come-out roll; come and don't come once a point is on.
      const open = placed.line === 'pass' ? point === null : point !== null;
      if (!open) return { illegal: 'not-available-now' };
      if (amount.n !== 0n) {
        const limit = state.rules.limits.flat;
        if (compare(amount, decodeMoney(limit.min)) < 0) return { illegal: 'below-minimum' };
        if (compare(amount, decodeMoney(limit.max)) > 0) return { illegal: 'above-maximum' };
      }
    }
  } else if (amount.n !== 0n) {
    const base = lineInfo(placed.base);
    const baseStake = stakeOf(state.wagers, placed.base);
    const n = numberOf(base, point);
    if (!baseStake || n === null) return { illegal: 'not-available-now' };
    if (amount.n % wholeIncrement(trueOddsPayout(placed.dont, n)) !== 0n) return { illegal: 'odds-increment' };
    if (compare(amount, oddsCap(state.rules.odds, placed.dont, n, baseStake)) > 0) return { illegal: 'above-odds-cap' };
  }

  let balance = decodeMoney(state.balance);
  let wagers = [...state.wagers];
  const facts: DomainFact[] = [];
  for (const change of changes) {
    const previous = stakeOf(wagers, change.target) ?? money(0n);
    balance = sub(balance, sub(change.amount, previous));
    wagers = wagers.filter((wager) => wager.target !== change.target);
    if (change.amount.n !== 0n) wagers.push({ target: change.target, amount: encodeMoney(change.amount) });
    facts.push({ kind: 'wager-changed', target: change.target, amount: encodeMoney(change.amount), previous: encodeMoney(previous) });
  }
  if (balance.n < 0n) return { illegal: 'insufficient-funds' };
  // A buy or lay must be able to pay its commission on top of the stake.
  if (amount.n !== 0n && compare(balance, commissionFor(placed, amount)) < 0) return { illegal: 'commission-unfunded' };
  return {
    change: { phase: 'open-decision', balance: encodeMoney(balance), wagers: sorted(wagers), instructions: keptInstructions(state.instructions, wagers) },
    facts,
  };
}

type Resolution = 'win' | 'loss' | 'stay' | 'bar' | { move: CrapsPoint };

/** What one roll total does to a base, given the puck before the roll. */
function resolveBase(target: LineTarget, total: number, point: CrapsPoint | null): Resolution {
  const n = numberOf(target, point);
  if (n !== null) {
    if (total === 7) return target.dont ? 'win' : 'loss';
    if (total === n) return target.dont ? 'loss' : 'win';
    return 'stay';
  }
  // A come-out roll for this bet: pass/don't pass with the puck off, or a bet in the come area.
  if (total === 7 || total === 11) return target.dont ? 'loss' : 'win';
  if (total === 2 || total === 3) return target.dont ? 'win' : 'loss';
  if (total === 12) return target.dont ? 'bar' : 'loss';
  return target.line === 'come' ? { move: total as CrapsPoint } : 'stay';
}

/** What one roll does to a box or hardway bet that is working. */
function resolveStanding(target: BoxTarget | HardTarget, dice: readonly [number, number]): 'win' | 'loss' | 'stay' {
  const total = dice[0] + dice[1];
  if (target.family === 'hardway') {
    if (total === 7 || (total === target.number && dice[0] !== dice[1])) return 'loss';
    return total === target.number ? 'win' : 'stay';
  }
  const hits = total === target.number;
  const sevens = total === 7;
  if (target.family === 'lay') return sevens ? 'win' : hits ? 'loss' : 'stay';
  return hits ? 'win' : sevens ? 'loss' : 'stay';
}

interface Settled {
  change: { balance: string; wagers: Wager[]; point: CrapsPoint | null; instructions: WorkingInstruction[] };
  facts: DomainFact[];
}

/** Settles the latest roll against every wager on the table and moves the puck. */
function settle(state: State): Settled {
  // Wagers are settled only after a roll, so an outcome exists.
  const { turn, dice } = state.outcome as CrapsOutcome;
  const total = dice[0] + dice[1];
  const { point } = state;
  let balance = decodeMoney(state.balance);
  const wagers: Wager[] = [];
  const facts: DomainFact[] = [];
  const pay = (
    target: string,
    stake: Money,
    result: 'win' | 'loss' | 'push',
    gross: Money,
    extra: { component?: number; fee?: Money; staysUp?: boolean } = {},
  ) => {
    const fee = extra.fee ?? money(0n);
    const net = result === 'loss' ? neg(stake) : sub(gross, fee);
    // A standing bet that wins stays up: only the win comes back.
    const returned = result === 'loss' ? money(0n) : extra.staysUp ? net : add(stake, net);
    balance = add(balance, returned);
    facts.push({
      kind: 'wager-settled',
      turn,
      target,
      stake: encodeMoney(stake),
      result,
      net: encodeMoney(net),
      returned: encodeMoney(returned),
      ...(extra.component === undefined ? {} : { component: extra.component }),
      ...(fee.n === 0n ? {} : { commission: encodeMoney(fee) }),
    });
  };

  for (const wager of state.wagers) {
    const target = known(wager.target);
    const stake = decodeMoney(wager.amount);
    switch (target.family) {
      case 'line': {
        if (!target.odds) {
          const resolution = resolveBase(target, total, point);
          if (resolution === 'win') pay(wager.target, stake, 'win', stake);
          else if (resolution === 'loss') pay(wager.target, stake, 'loss', money(0n));
          else if (resolution === 'stay') wagers.push(wager);
          else if (resolution === 'bar') {
            wagers.push(wager);
            facts.push({ kind: 'wager-pushed', turn, target: wager.target, stake: wager.amount });
          } else {
            const to = `${wager.target}-${resolution.move}`;
            wagers.push({ target: to, amount: wager.amount });
            facts.push({ kind: 'wager-moved', turn, from: wager.target, to, amount: wager.amount });
          }
          break;
        }
        // Odds act on their base's number and resolve with it; odds that are off come back.
        const n = numberOf(target, point) as CrapsPoint;
        const wins = target.dont ? total === 7 : total === n;
        const loses = target.dont ? total === n : total === 7;
        if (!wins && !loses) wagers.push(wager);
        else if (!isWorking(state, target)) pay(wager.target, stake, 'push', money(0n));
        else if (wins) pay(wager.target, stake, 'win', mul(stake, trueOddsPayout(target.dont, n)));
        else pay(wager.target, stake, 'loss', money(0n));
        break;
      }
      case 'place':
      case 'buy':
      case 'lay':
      case 'hardway': {
        // A wager that is off takes no action and stays on the table. A win is
        // paid and the bet stays up, as at the table; the player takes it down.
        const resolution = isWorking(state, target) ? resolveStanding(target, dice) : 'stay';
        if (resolution === 'loss') pay(wager.target, stake, 'loss', money(0n));
        else wagers.push(wager);
        if (resolution === 'win') pay(wager.target, stake, 'win', mul(stake, payoutOf(target, state.rules.field)), { fee: commissionFor(target, stake), staysUp: true });
        break;
      }
      case 'field':
        if (target.totals.includes(total)) pay(wager.target, stake, 'win', mul(stake, fieldPays(total, state.rules.field)));
        else pay(wager.target, stake, 'loss', money(0n));
        break;
      case 'proposition':
        if (target.totals.includes(total)) pay(wager.target, stake, 'win', mul(stake, payoutOf(target, state.rules.field)));
        else pay(wager.target, stake, 'loss', money(0n));
        break;
      case 'horn': {
        // Four equal parts, each settled as its own bet.
        const part = mul(stake, money(1n, BigInt(HORN_PARTS.length)));
        for (const component of HORN_PARTS) {
          if (total === component) pay(wager.target, part, 'win', mul(part, hornPartPays(component)), { component });
          else pay(wager.target, part, 'loss', money(0n), { component });
        }
        break;
      }
    }
  }

  let next = point;
  if (point === null && CRAPS_POINTS.includes(total as CrapsPoint)) next = total as CrapsPoint;
  if (point !== null && (total === point || total === 7)) next = null;
  if (next !== point) facts.push({ kind: 'point-changed', turn, point: next });
  return {
    change: { balance: encodeMoney(balance), wagers: sorted(wagers), point: next, instructions: keptInstructions(state.instructions, wagers) },
    facts,
  };
}

/**
 * Stopping finishes a roll already revealed, returns every removable wager
 * and leaves only contracts, which further rolls settle automatically.
 */
function requestStop(state: State): Step<State> {
  const facts: DomainFact[] = [{ kind: 'stop-requested', phase: state.phase }];
  let current = state;
  if (state.phase === 'revealing-outcome') {
    const settled = settle(state);
    facts.push(...settled.facts);
    current = { ...state, ...settled.change };
  }
  let balance = decodeMoney(current.balance);
  const kept: Wager[] = [];
  for (const wager of current.wagers) {
    if (isContract(known(wager.target), current.point)) {
      kept.push(wager);
      continue;
    }
    balance = add(balance, decodeMoney(wager.amount));
    facts.push({ kind: 'wager-returned', target: wager.target, amount: wager.amount });
  }
  return { change: { phase: 'final-settlement', balance: encodeMoney(balance), wagers: kept, point: current.point, instructions: [] }, facts };
}

function placements(state: State): CrapsPlacement[] {
  const { point, rules } = state;
  const line = (target: string): CrapsPlacement => ({ target, kind: 'line', min: rules.limits.flat.min, max: rules.limits.flat.max, increment: '1', payout: '1:1' });
  const out: CrapsPlacement[] = point === null ? [line('pass'), line('dont-pass')] : [line('come'), line('dont-come')];
  for (const wager of state.wagers) {
    const base = known(wager.target);
    if (base.family !== 'line') continue;
    const n = numberOf(base, point);
    if (base.odds || n === null) continue;
    const ratio = trueOddsPayout(base.dont, n);
    const increment = wholeIncrement(ratio);
    const cap = oddsCap(rules.odds, base.dont, n, decodeMoney(wager.amount));
    // The largest whole multiple of the increment within the cap.
    const max = (cap.n / cap.d / increment) * increment;
    if (max < increment) continue;
    out.push({ target: `${wager.target}-odds`, kind: 'odds', min: increment.toString(), max: max.toString(), increment: increment.toString(), payout: ratioText(ratio) });
  }
  // Every other wager can be made, changed or taken down whenever bets are open.
  for (const target of TARGETS) {
    if (target.family === 'line') continue;
    const limits = stakeLimits(target, rules);
    const kind: CrapsPlacementKind = target.family;
    out.push({
      target: target.target,
      kind,
      min: limits.min.toString(),
      max: limits.max.toString(),
      increment: limits.increment.toString(),
      payout: target.family === 'horn' ? '30:1/15:1' : ratioText(payoutOf(target, rules.field)),
      ...(target.family === 'buy' ? { commission: 'stake' as const } : target.family === 'lay' ? { commission: 'win' as const } : {}),
    });
  }
  return sorted(out);
}

const isRuleContent = (value: unknown): value is State['rules'] =>
  hasExactKeys(value, ['odds', 'field', 'limits']) &&
  ODDS_CAPS.includes(value.odds as OddsCap) &&
  FIELD_PAYOUTS.includes(value.field as FieldPayout) &&
  hasExactKeys(value.limits, ['flat', 'props']) &&
  isLimit(value.limits.flat) &&
  isLimit(value.limits.props);

const isDice = (value: unknown): value is [number, number] =>
  Array.isArray(value) && value.length === 2 && value.every((die) => Number.isInteger(die) && die >= 1 && die <= 6);

function instructionDamage(value: unknown, wagers: readonly Wager[]): string | undefined {
  if (!Array.isArray(value)) return 'damaged working instructions';
  let last = -1;
  for (const item of value as unknown[]) {
    if (!hasExactKeys(item, ['target', 'working']) || typeof item.target !== 'string' || typeof item.working !== 'boolean') return 'damaged working instructions';
    const target = targetInfo(item.target);
    const index = targetOrder(item.target);
    if (!target || !isSwitchable(target) || index <= last || !stakeOf(wagers, item.target)) return 'damaged working instructions';
    last = index;
  }
  return undefined;
}

function damage(value: Record<string, unknown>): string | undefined {
  const { rules, phase, turn, wagers, outcome, point, instructions } = value;
  if (!isRuleContent(rules)) return 'damaged rules';
  if (point !== null && !CRAPS_POINTS.includes(point as CrapsPoint)) return 'damaged point';
  const puck = point as CrapsPoint | null;
  if (outcome !== null && !(hasExactKeys(outcome, ['turn', 'dice']) && isCount(outcome.turn) && outcome.turn >= 1 && outcome.turn === turn && isDice(outcome.dice))) {
    return 'damaged outcome';
  }
  if ((outcome === null) !== (turn === 0)) return 'the outcome does not match the turn count';
  if (outcome === null && puck !== null) return 'the point is set before any roll';
  if (!isWagerList(wagers, targetOrder)) return 'damaged wager';
  for (const wager of wagers) {
    const target = known(wager.target);
    const amount = decodeMoney(wager.amount);
    if (amount.d !== 1n) return 'damaged wager';
    if (target.family !== 'line') {
      if (amount.n % stakeLimits(target, rules).increment !== 0n) return 'damaged wager';
    } else {
      if (target.odds && !(stakeOf(wagers, target.base) && numberOf(lineInfo(target.base), puck) !== null)) return 'odds without an established base';
      if (target.line === 'come' && target.number === null && puck === null) return 'a come bet with the puck off';
    }
    if (phase === 'final-settlement' && !isContract(target, puck)) return 'damaged final settlement';
  }
  const instructionProblem = instructionDamage(instructions, wagers);
  if (instructionProblem) return instructionProblem;
  if (phase === 'revealing-outcome' && wagers.length === 0) return 'a revealing roll has no committed wagers';
  if (phase === 'completed' && wagers.length > 0) return 'wagers remain after settlement';
  return undefined;
}

/** Standard craps behind the session protocol. */
export const CRAPS: GameModule<CrapsActivityState, CrapsPermittedView> = {
  ruleSets: [{ id: STANDARD_CRAPS.id, version: STANDARD_CRAPS.version }],
  extra: { point: null, instructions: [] },
  pinRules: (rules) => {
    if (rules.id !== STANDARD_CRAPS.id || rules.version !== STANDARD_CRAPS.version) return 'unsupported craps rules';
    if (!ODDS_CAPS.includes(rules.odds as OddsCap)) return `odds must be one of ${ODDS_CAPS.join(', ')}`;
    if (!FIELD_PAYOUTS.includes(rules.field as FieldPayout)) return `the field payout must be one of ${FIELD_PAYOUTS.join(', ')}`;
    const limits = rules.limits;
    if (!hasExactKeys(limits, ['flat', 'props']) || !isLimit(limits.flat) || !isLimit(limits.props)) {
      return `flat and proposition limits must be whole units from 1 to ${BASE_WAGER_CEILING} with min <= max`;
    }
    return {
      odds: rules.odds as OddsCap,
      field: rules.field as FieldPayout,
      limits: { flat: { min: limits.flat.min, max: limits.flat.max }, props: { min: limits.props.min, max: limits.props.max } },
    };
  },
  apply,
  workingInstructions: true,
  view: (state) => ({
    game: 'craps',
    outcome: state.outcome && { turn: state.outcome.turn, dice: [state.outcome.dice[0], state.outcome.dice[1]] },
    table: {
      variant: { id: STANDARD_CRAPS.id, version: STANDARD_CRAPS.version },
      odds: state.rules.odds,
      field: state.rules.field,
      point: state.point,
      limits: { flat: { ...state.rules.limits.flat }, props: { ...state.rules.limits.props } },
      wagers: state.wagers.map((wager) => {
        const target = known(wager.target);
        return {
          target: wager.target,
          working: isWorking(state, target),
          instruction: instructionOf(state, wager.target) ?? null,
          switchable: isSwitchable(target),
          removable: !isContract(target, state.point),
        };
      }),
      placements: placements(state),
    },
  }),
  damage,
};
