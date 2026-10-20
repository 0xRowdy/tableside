// The standard craps game module: the line game. Pass/come and don't
// pass/don't come with attached odds, the point puck, working status, which
// wagers are contracts, and how one roll (one turn) settles. Place, buy, lay,
// field, hardways and propositions arrive with #71.
//
// Standard craps is its own variant identity. Crapless craps (later) gets its
// own module; a strategy compatible with this one is not automatically
// compatible with it. Rules: #3 (Launch game rules) and spec #51.

import type { ActivityStateBase, CrapsPermittedView, DomainFact, GameCommand, GameModule, Step, Wager } from './activity';
import { rollDice } from './draws';
import { add, compare, decodeMoney, encodeMoney, money, mul, neg, sub, type Money } from './money';
import { RandomStream } from './random';
import { BASE_WAGER_CEILING, hasExactKeys, isCount, isLimit, isWagerList, type Limit, type VersionedIdentity } from './shape';

export type OddsCap = '1x' | '2x' | '3-4-5x' | '5x' | '10x';
export type CrapsPoint = 4 | 5 | 6 | 8 | 9 | 10;

export const ODDS_CAPS: readonly OddsCap[] = ['1x', '2x', '3-4-5x', '5x', '10x'];
export const CRAPS_POINTS: readonly CrapsPoint[] = [4, 5, 6, 8, 9, 10];

/**
 * The versioned capability description of the standard craps variant: what a
 * table of this variant offers, so strategies and presets can be checked
 * against it. A new wager family or rule option bumps the version.
 */
export const STANDARD_CRAPS = {
  id: 'standard-craps',
  version: 1,
  wagers: ['pass', 'dont-pass', 'come', 'dont-come', 'pass-odds', 'dont-pass-odds', 'come-odds', 'dont-come-odds'],
  oddsCaps: ODDS_CAPS,
  defaults: { odds: '3-4-5x', comeOddsOnComeOut: 'off' },
  /** Don't bets push on this come-out total ("bar 12"). */
  dontBar: 12,
  /** Contracts: once their number is set, these bases can't be lowered or taken down. */
  contracts: ['pass', 'come'],
} as const;

export interface CrapsRuleSet extends VersionedIdentity {
  readonly odds: OddsCap;
  /** Pass, don't pass, come and don't come, per wager. */
  readonly limits: { readonly line: Limit };
}

export interface CrapsOutcome {
  readonly turn: number;
  readonly dice: readonly [number, number];
}

export interface CrapsActivityState extends ActivityStateBase<'craps'> {
  /** The pinned rule content, not a pointer to current definitions. */
  readonly rules: Pick<CrapsRuleSet, 'odds' | 'limits'>;
  /** The latest roll. */
  readonly outcome: CrapsOutcome | null;
  /** The point puck: null while it is off (the next roll is a come-out roll). */
  readonly point: CrapsPoint | null;
}

export type CrapsIllegalActionReason =
  /** A contract base (pass or come with its number set) can't be lowered or taken down; an established don't can only come down. */
  | 'committed-wager'
  /** The wager can't be made in this state of the game (pass after the point is set, come before, odds without a base). */
  | 'not-available-now'
  /** More odds than the table's odds cap allows behind this base. */
  | 'above-odds-cap'
  /** Odds must be a multiple that pays whole units. */
  | 'odds-increment';

export type CrapsDomainFact =
  | { readonly kind: 'dice-rolled'; readonly turn: number; readonly dice: readonly [number, number] }
  /** The puck moved: on at a point, or off (null). */
  | { readonly kind: 'point-changed'; readonly turn: number; readonly point: CrapsPoint | null }
  /** A come or don't come bet traveled to its number. */
  | { readonly kind: 'wager-moved'; readonly turn: number; readonly from: string; readonly to: string; readonly amount: string }
  /** A don't bet's bar-12 standoff: no money moves and the wager stays on the table. */
  | { readonly kind: 'wager-pushed'; readonly turn: number; readonly target: string; readonly stake: string };

export interface CrapsWagerStatus {
  readonly target: string;
  /** Whether the wager acts on the next roll ("ON") or is off. */
  readonly working: boolean;
  /** False for a contract: pass or come with its number set. */
  readonly removable: boolean;
}

export interface CrapsPlacement {
  readonly target: string;
  readonly kind: 'line' | 'odds';
  readonly min: string;
  readonly max: string;
  /** Stakes go in multiples of this. */
  readonly increment: string;
  /** Net payout ratio, profit to stake: "1:1", "6:5", "5:6". */
  readonly payout: string;
}

export interface CrapsTable {
  readonly variant: VersionedIdentity;
  readonly odds: OddsCap;
  readonly point: CrapsPoint | null;
  readonly limits: { readonly line: Limit };
  /** Working status and removability of every wager on the table, in table order. */
  readonly wagers: readonly CrapsWagerStatus[];
  /** What can be placed or raised in the current state of the game. */
  readonly placements: readonly CrapsPlacement[];
}

// ---- targets ----------------------------------------------------------

type Line = 'pass' | 'come';

interface TargetInfo {
  readonly target: string;
  /** The base a wager belongs to (itself for a base). */
  readonly base: string;
  readonly odds: boolean;
  readonly dont: boolean;
  readonly line: Line;
  /** The fixed number of a come or don't come bet that has traveled; null for pass, don't pass and the come areas. */
  readonly number: CrapsPoint | null;
}

const info = (target: string, line: Line, dont: boolean, number: CrapsPoint | null, odds: boolean): TargetInfo => ({
  target,
  base: odds ? target.slice(0, -'-odds'.length) : target,
  odds,
  dont,
  line,
  number,
});

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
];

const BY_TARGET = new Map(TARGETS.map((target, index) => [target.target, { target, index }]));
const targetInfo = (target: string) => BY_TARGET.get(target)?.target;
const targetOrder = (target: string): number => BY_TARGET.get(target)?.index ?? -1;

/** The number a base or its odds acts on: a traveled bet's own number, or the point for the pass line. */
const numberOf = (target: TargetInfo, point: CrapsPoint | null): CrapsPoint | null =>
  target.line === 'pass' ? point : target.number;

/** A base whose number is set: it can carry odds. */
const established = (target: TargetInfo, point: CrapsPoint | null) => !target.odds && numberOf(target, point) !== null;

/** Contracts can't be lowered or taken down once their number is set. */
const isContract = (target: TargetInfo, point: CrapsPoint | null) => !target.dont && established(target, point);

/** Come odds are off on the come-out roll by default; everything else in the line game works. */
const isWorking = (target: TargetInfo, point: CrapsPoint | null) => !(target.odds && target.line === 'come' && !target.dont && point === null);

// ---- odds -------------------------------------------------------------

/** True odds when taking odds: profit per unit staked (2:1, 3:2, 6:5). Laying pays the inverse. */
const TRUE_ODDS: Record<CrapsPoint, Money> = { 4: money(2n), 10: money(2n), 5: money(3n, 2n), 9: money(3n, 2n), 6: money(6n, 5n), 8: money(6n, 5n) };

/** Taking-odds multiple of the base. Under 3-4-5x it depends on the number. */
function oddsMultiple(cap: OddsCap, n: CrapsPoint): bigint {
  if (cap === '3-4-5x') return n === 4 || n === 10 ? 3n : n === 5 || n === 9 ? 4n : 5n;
  return BigInt(cap.slice(0, -1));
}

/** Profit per unit of odds stake. */
const oddsPayout = (dont: boolean, n: CrapsPoint): Money => (dont ? money(TRUE_ODDS[n].d, TRUE_ODDS[n].n) : TRUE_ODDS[n]);

/** The smallest stake that pays whole units: the payout ratio's denominator. */
const oddsIncrement = (dont: boolean, n: CrapsPoint): bigint => oddsPayout(dont, n).d;

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

// ---- module -----------------------------------------------------------

type State = CrapsActivityState;

const stakeOf = (wagers: readonly Wager[], target: string) => {
  const found = wagers.find((wager) => wager.target === target);
  return found ? decodeMoney(found.amount) : undefined;
};

const sorted = <T extends { target: string }>(items: T[]) => items.sort((a, b) => targetOrder(a.target) - targetOrder(b.target));

function apply(state: State, command: GameCommand): Step<State> {
  switch (command.kind) {
    case 'place-wager':
      return placeWager(state, command.target, decodeMoney(command.amount));
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

function placeWager(state: State, target: string, amount: Money): Step<State> {
  const placed = targetInfo(target);
  if (!placed) return { illegal: 'unknown-target' };
  if (amount.d !== 1n) return { illegal: 'not-whole-units' };
  const existing = stakeOf(state.wagers, target);
  if (amount.n === 0n && !existing) return { illegal: 'no-wager-to-remove' };
  const { point } = state;
  const changes: { target: string; amount: Money }[] = [{ target, amount }];

  if (!placed.odds) {
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
        const limit = state.rules.limits.line;
        if (compare(amount, decodeMoney(limit.min)) < 0) return { illegal: 'below-minimum' };
        if (compare(amount, decodeMoney(limit.max)) > 0) return { illegal: 'above-maximum' };
      }
    }
  } else if (amount.n !== 0n) {
    const base = targetInfo(placed.base) as TargetInfo;
    const baseStake = stakeOf(state.wagers, placed.base);
    const n = numberOf(base, point);
    if (!baseStake || n === null) return { illegal: 'not-available-now' };
    if (amount.n % oddsIncrement(placed.dont, n) !== 0n) return { illegal: 'odds-increment' };
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
  return { change: { phase: 'open-decision', balance: encodeMoney(balance), wagers: sorted(wagers) }, facts };
}

type Resolution = 'win' | 'loss' | 'stay' | 'bar' | { move: CrapsPoint };

/** What one roll total does to a base, given the puck before the roll. */
function resolveBase(target: TargetInfo, total: number, point: CrapsPoint | null): Resolution {
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

/** Settles the latest roll against every wager on the table and moves the puck. */
function settle(state: State): { change: { balance: string; wagers: Wager[]; point: CrapsPoint | null }; facts: DomainFact[] } {
  // Wagers are settled only after a roll, so an outcome exists.
  const { turn, dice } = state.outcome as CrapsOutcome;
  const total = dice[0] + dice[1];
  const { point } = state;
  let balance = decodeMoney(state.balance);
  const wagers: Wager[] = [];
  const facts: DomainFact[] = [];
  const pay = (wager: Wager, result: 'win' | 'loss' | 'push', net: Money) => {
    const stake = decodeMoney(wager.amount);
    const returned = result === 'loss' ? money(0n) : add(stake, net);
    balance = add(balance, returned);
    facts.push({ kind: 'wager-settled', turn, target: wager.target, stake: wager.amount, result, net: encodeMoney(net), returned: encodeMoney(returned) });
  };

  for (const wager of state.wagers) {
    // Every stored target is known (placeWager and decode both check).
    const target = targetInfo(wager.target) as TargetInfo;
    const stake = decodeMoney(wager.amount);
    if (!target.odds) {
      const resolution = resolveBase(target, total, point);
      if (resolution === 'win') pay(wager, 'win', stake);
      else if (resolution === 'loss') pay(wager, 'loss', neg(stake));
      else if (resolution === 'stay') wagers.push(wager);
      else if (resolution === 'bar') {
        wagers.push(wager);
        facts.push({ kind: 'wager-pushed', turn, target: wager.target, stake: wager.amount });
      } else {
        const to = `${wager.target}-${resolution.move}`;
        wagers.push({ target: to, amount: wager.amount });
        facts.push({ kind: 'wager-moved', turn, from: wager.target, to, amount: wager.amount });
      }
      continue;
    }
    // Odds act on their base's number and resolve with it.
    const n = numberOf(target, point) as CrapsPoint;
    const wins = target.dont ? total === 7 : total === n;
    const loses = target.dont ? total === n : total === 7;
    if (!wins && !loses) wagers.push(wager);
    else if (!isWorking(target, point)) pay(wager, 'push', money(0n));
    else if (wins) pay(wager, 'win', mul(stake, oddsPayout(target.dont, n)));
    else pay(wager, 'loss', neg(stake));
  }

  let next = point;
  if (point === null && CRAPS_POINTS.includes(total as CrapsPoint)) next = total as CrapsPoint;
  if (point !== null && (total === point || total === 7)) next = null;
  if (next !== point) facts.push({ kind: 'point-changed', turn, point: next });
  return { change: { balance: encodeMoney(balance), wagers: sorted(wagers), point: next }, facts };
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
    if (isContract(targetInfo(wager.target) as TargetInfo, current.point)) {
      kept.push(wager);
      continue;
    }
    balance = add(balance, decodeMoney(wager.amount));
    facts.push({ kind: 'wager-returned', target: wager.target, amount: wager.amount });
  }
  return { change: { phase: 'final-settlement', balance: encodeMoney(balance), wagers: kept, point: current.point }, facts };
}

function placements(state: State): CrapsPlacement[] {
  const { point, rules } = state;
  const line = (target: string): CrapsPlacement => ({ target, kind: 'line', min: rules.limits.line.min, max: rules.limits.line.max, increment: '1', payout: '1:1' });
  const out: CrapsPlacement[] = point === null ? [line('pass'), line('dont-pass')] : [line('come'), line('dont-come')];
  for (const wager of state.wagers) {
    const base = targetInfo(wager.target) as TargetInfo;
    const n = numberOf(base, point);
    if (base.odds || n === null) continue;
    const increment = oddsIncrement(base.dont, n);
    const cap = oddsCap(rules.odds, base.dont, n, decodeMoney(wager.amount));
    // The largest whole multiple of the increment within the cap.
    const max = (cap.n / cap.d / increment) * increment;
    if (max < increment) continue;
    out.push({
      target: `${wager.target}-odds`,
      kind: 'odds',
      min: increment.toString(),
      max: max.toString(),
      increment: increment.toString(),
      payout: ratioText(oddsPayout(base.dont, n)),
    });
  }
  return sorted(out);
}

const isRuleContent = (value: unknown): value is State['rules'] =>
  hasExactKeys(value, ['odds', 'limits']) &&
  ODDS_CAPS.includes(value.odds as OddsCap) &&
  hasExactKeys(value.limits, ['line']) &&
  isLimit(value.limits.line);

const isDice = (value: unknown): value is [number, number] =>
  Array.isArray(value) && value.length === 2 && value.every((die) => Number.isInteger(die) && die >= 1 && die <= 6);

function damage(value: Record<string, unknown>): string | undefined {
  const { rules, phase, turn, wagers, outcome, point } = value;
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
    const target = targetInfo(wager.target) as TargetInfo;
    if (decodeMoney(wager.amount).d !== 1n) return 'damaged wager';
    if (target.odds && !(stakeOf(wagers, target.base) && numberOf(targetInfo(target.base) as TargetInfo, puck) !== null)) {
      return 'odds without an established base';
    }
    if (target.line === 'come' && target.number === null && puck === null) return 'a come bet with the puck off';
    if (phase === 'final-settlement' && !isContract(target, puck)) return 'damaged final settlement';
  }
  if (phase === 'revealing-outcome' && wagers.length === 0) return 'a revealing roll has no committed wagers';
  if (phase === 'completed' && wagers.length > 0) return 'wagers remain after settlement';
  return undefined;
}

/** Standard craps behind the session protocol. */
export const CRAPS: GameModule<CrapsActivityState, CrapsPermittedView> = {
  ruleSets: [{ id: STANDARD_CRAPS.id, version: STANDARD_CRAPS.version }],
  extra: { point: null },
  pinRules: (rules) => {
    if (rules.id !== STANDARD_CRAPS.id || rules.version !== STANDARD_CRAPS.version) return 'unsupported craps rules';
    if (!ODDS_CAPS.includes(rules.odds as OddsCap)) return `odds must be one of ${ODDS_CAPS.join(', ')}`;
    const limits = rules.limits;
    if (!hasExactKeys(limits, ['line']) || !isLimit(limits.line)) {
      return `line limits must be whole units from 1 to ${BASE_WAGER_CEILING} with min <= max`;
    }
    return { odds: rules.odds as OddsCap, limits: { line: { min: limits.line.min, max: limits.line.max } } };
  },
  apply,
  view: (state) => ({
    game: 'craps',
    outcome: state.outcome && { turn: state.outcome.turn, dice: [state.outcome.dice[0], state.outcome.dice[1]] },
    table: {
      variant: { id: STANDARD_CRAPS.id, version: STANDARD_CRAPS.version },
      odds: state.rules.odds,
      point: state.point,
      limits: { line: { ...state.rules.limits.line } },
      wagers: state.wagers.map((wager) => {
        const target = targetInfo(wager.target) as TargetInfo;
        return { target: wager.target, working: isWorking(target, state.point), removable: !isContract(target, state.point) };
      }),
      placements: placements(state),
    },
  }),
  damage,
};
