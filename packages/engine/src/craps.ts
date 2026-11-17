// Spec 1 Game rules, Standard craps

import type { ActivityStateBase, Change, Command, CommandKind, CrapsPermittedView, DomainFact, GameCommand, GameModule, Step, Wager } from './activity';
import { rollDice } from './draws';
import { add, commission, compare, decodeMoney, encodeMoney, money, mul, neg, sub, type Money } from './money';
import { RandomStream } from './random';
import { BASE_WAGER_CEILING, hasExactKeys, isCount, isLimit, isWagerList, type Limit, type VersionedIdentity } from './shape';
import type { BetRequirement } from './strategy';

export type OddsCap = '1x' | '2x' | '3-4-5x' | '5x' | '10x';
export type CrapsPoint = 4 | 5 | 6 | 8 | 9 | 10;
export type FieldPayout = 'triple-12' | 'double-12';
export type Hardway = 4 | 6 | 8 | 10;

export const ODDS_CAPS: readonly OddsCap[] = ['1x', '2x', '3-4-5x', '5x', '10x'];
export const CRAPS_POINTS: readonly CrapsPoint[] = [4, 5, 6, 8, 9, 10];
export const FIELD_PAYOUTS: readonly FieldPayout[] = ['triple-12', 'double-12'];
export const HARDWAYS: readonly Hardway[] = [4, 6, 8, 10];
export const PROPOSITIONS = ['any-seven', 'any-craps', 'prop-2', 'prop-3', 'prop-11', 'prop-12'] as const;
export const HORN_PARTS = [2, 3, 11, 12] as const;

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
  dontBar: 12,
  contracts: ['pass', 'come'],
  switchable: ['place', 'buy', 'lay', 'hardway', 'come-odds', 'dont-come-odds'],
  commission: { rate: '1/20', buy: 'stake', lay: 'win', rounding: 'up', minimum: '1' },
} as const;

export interface CrapsRuleSet extends VersionedIdentity {
  readonly odds: OddsCap;
  readonly field: FieldPayout;
  readonly limits: {
    readonly flat: Limit;
    readonly props: Limit;
  };
}

export interface CrapsOutcome {
  readonly turn: number;
  readonly dice: readonly [number, number];
}

export interface WorkingInstruction {
  readonly target: string;
  readonly working: boolean;
}

export interface CrapsActivityState extends ActivityStateBase<'craps'> {
  readonly rules: Pick<CrapsRuleSet, 'odds' | 'field' | 'limits'>;
  readonly outcome: CrapsOutcome | null;
  readonly point: CrapsPoint | null;
  readonly instructions: readonly WorkingInstruction[];
}

export type CrapsIllegalActionReason =
  | 'committed-wager'
  | 'not-available-now'
  | 'above-odds-cap'
  | 'odds-increment'
  | 'stake-increment'
  | 'commission-unfunded'
  | 'working-fixed';

export type CrapsDomainFact =
  | { readonly kind: 'dice-rolled'; readonly turn: number; readonly dice: readonly [number, number] }
  | { readonly kind: 'point-changed'; readonly turn: number; readonly point: CrapsPoint | null }
  | { readonly kind: 'wager-moved'; readonly turn: number; readonly from: string; readonly to: string; readonly amount: string }
  | { readonly kind: 'wager-pushed'; readonly turn: number; readonly target: string; readonly stake: string }
  | { readonly kind: 'working-changed'; readonly target: string; readonly working: boolean };

export interface CrapsWagerStatus {
  readonly target: string;
  readonly working: boolean;
  readonly instruction: boolean | null;
  readonly switchable: boolean;
  readonly removable: boolean;
}

export type CrapsPlacementKind = 'line' | 'odds' | 'place' | 'buy' | 'lay' | 'field' | 'hardway' | 'proposition' | 'horn';

export interface CrapsPlacement {
  readonly target: string;
  readonly kind: CrapsPlacementKind;
  readonly min: string;
  readonly max: string;
  readonly increment: string;
  readonly payout: string;
  readonly commission?: 'stake' | 'win';
  readonly usualOnComeOut?: boolean;
}

export interface CrapsTable {
  readonly variant: VersionedIdentity;
  readonly odds: OddsCap;
  readonly field: FieldPayout;
  readonly point: CrapsPoint | null;
  readonly limits: CrapsRuleSet['limits'];
  readonly wagers: readonly CrapsWagerStatus[];
  readonly placements: readonly CrapsPlacement[];
}

type Line = 'pass' | 'come';

interface LineTarget {
  readonly family: 'line';
  readonly target: string;
  readonly base: string;
  readonly odds: boolean;
  readonly dont: boolean;
  readonly line: Line;
  readonly number: CrapsPoint | null;
}

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

interface OneRollTarget {
  readonly family: 'field' | 'proposition' | 'horn';
  readonly target: string;
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

type Proposition = (typeof PROPOSITIONS)[number];

const PROPOSITION_TERMS: Record<Proposition, { readonly totals: readonly number[]; readonly pays: Money }> = {
  'any-seven': { totals: [7], pays: money(4n) },
  'any-craps': { totals: [2, 3, 12], pays: money(7n) },
  'prop-2': { totals: [2], pays: money(30n) },
  'prop-3': { totals: [3], pays: money(15n) },
  'prop-11': { totals: [11], pays: money(15n) },
  'prop-12': { totals: [12], pays: money(30n) },
};

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
  ...PROPOSITIONS.map((target): OneRollTarget => ({ family: 'proposition', target, totals: PROPOSITION_TERMS[target].totals })),
  { family: 'horn', target: 'horn', totals: HORN_PARTS },
];

const BY_TARGET = new Map(TARGETS.map((target, index) => [target.target, { target, index }]));
const targetInfo = (target: string) => BY_TARGET.get(target)?.target;
const targetOrder = (target: string): number => BY_TARGET.get(target)?.index ?? -1;
const known = (target: string) => targetInfo(target) as TargetInfo;
const lineInfo = (target: string) => targetInfo(target) as LineTarget;

const numberOf = (target: LineTarget, point: CrapsPoint | null): CrapsPoint | null =>
  target.line === 'pass' ? point : target.number;

const established = (target: LineTarget, point: CrapsPoint | null) => !target.odds && numberOf(target, point) !== null;

const isContract = (target: TargetInfo, point: CrapsPoint | null) => target.family === 'line' && !target.dont && established(target, point);

const isSwitchable = (target: TargetInfo) =>
  target.family === 'line' ? target.odds && target.number !== null : target.family !== 'field' && target.family !== 'proposition' && target.family !== 'horn';

function worksByDefault(target: TargetInfo, point: CrapsPoint | null): boolean {
  if (target.family === 'line') return !(target.odds && target.line === 'come' && !target.dont && point === null);
  if (target.family === 'place' || target.family === 'buy') return point !== null;
  return true;
}

const instructionOf = (state: Pick<State, 'instructions'>, target: string) => state.instructions.find((item) => item.target === target)?.working;

const isWorking = (state: Pick<State, 'instructions' | 'point'>, target: TargetInfo) =>
  instructionOf(state, target.target) ?? worksByDefault(target, state.point);

const TRUE_ODDS: Record<CrapsPoint, Money> = { 4: money(2n), 10: money(2n), 5: money(3n, 2n), 9: money(3n, 2n), 6: money(6n, 5n), 8: money(6n, 5n) };
const PLACE_PAYS: Record<CrapsPoint, Money> = { 4: money(9n, 5n), 10: money(9n, 5n), 5: money(7n, 5n), 9: money(7n, 5n), 6: money(7n, 6n), 8: money(7n, 6n) };
const HARD_PAYS: Record<Hardway, Money> = { 4: money(7n), 10: money(7n), 6: money(9n), 8: money(9n) };
const hornPartPays = (total: (typeof HORN_PARTS)[number]) => PROPOSITION_TERMS[`prop-${total}`].pays;
const fieldPays = (total: number, field: FieldPayout) => (total === 2 ? money(2n) : total === 12 ? money(field === 'triple-12' ? 3n : 2n) : money(1n));

const COMMISSION_RATE = decodeMoney(STANDARD_CRAPS.commission.rate);

function oddsMultiple(cap: OddsCap, n: CrapsPoint): bigint {
  if (cap === '3-4-5x') return n === 4 || n === 10 ? 3n : n === 5 || n === 9 ? 4n : 5n;
  return BigInt(cap.slice(0, -1));
}

const trueOddsPayout = (dont: boolean, n: CrapsPoint): Money => (dont ? money(TRUE_ODDS[n].d, TRUE_ODDS[n].n) : TRUE_ODDS[n]);

const wholeIncrement = (ratio: Money): bigint => ratio.d;

function oddsCap(cap: OddsCap, dont: boolean, n: CrapsPoint, base: Money): Money {
  const take = mul(base, money(oddsMultiple(cap, n)));
  return dont ? mul(take, TRUE_ODDS[n]) : take;
}

export function crapsTurnExposure(rules: Pick<CrapsRuleSet, 'odds' | 'limits'>): { readonly stake: Money; readonly payout: Money } {
  const flat = decodeMoney(rules.limits.flat.max);
  const props = decodeMoney(rules.limits.props.max);
  const points = CRAPS_POINTS.length;
  const flatTargets = 4 + points * 5 + 1;
  const bases = 2 + points * 2;
  const odds = CRAPS_POINTS.reduce((most, n) => {
    const largest = [false, true].map((dont) => oddsCap(rules.odds, dont, n, flat)).reduce((a, b) => (compare(a, b) >= 0 ? a : b));
    return compare(largest, most) > 0 ? largest : most;
  }, money(0n));
  const components = HARDWAYS.length + PROPOSITIONS.length + HORN_PARTS.length;
  const stake = add(add(mul(flat, money(BigInt(flatTargets))), mul(odds, money(BigInt(bases)))), mul(props, money(BigInt(components))));
  const payouts = [...PROPOSITIONS.map((target) => PROPOSITION_TERMS[target].pays), ...Object.values(HARD_PAYS), ...Object.values(PLACE_PAYS), ...Object.values(TRUE_ODDS), money(3n)];
  return { stake, payout: payouts.reduce((a, b) => (compare(a, b) >= 0 ? a : b)) };
}

const ratioText = (ratio: Money) => `${ratio.n.toString()}:${ratio.d.toString()}`;

function standingPayout(target: BoxTarget | HardTarget): Money {
  switch (target.family) {
    case 'place':
      return PLACE_PAYS[target.number];
    case 'buy':
      return trueOddsPayout(false, target.number);
    case 'lay':
      return trueOddsPayout(true, target.number);
    case 'hardway':
      return HARD_PAYS[target.number];
  }
}

function statedPayout(target: Exclude<TargetInfo, LineTarget>): string {
  if (!('totals' in target)) return ratioText(standingPayout(target));
  if (target.family === 'horn') return '30:1/15:1';
  if (target.family === 'field') return '1:1';
  return ratioText(PROPOSITION_TERMS[target.target as Proposition].pays);
}

function stakeIncrement(target: Exclude<TargetInfo, LineTarget>): bigint {
  switch (target.family) {
    case 'place':
      return target.number === 6 || target.number === 8 ? 6n : 5n;
    case 'buy':
    case 'lay':
      return wholeIncrement(standingPayout(target));
    case 'horn':
      return BigInt(HORN_PARTS.length);
    default:
      return 1n;
  }
}

const commissionsDue = (wagers: readonly Wager[]): Money =>
  wagers.reduce((sum, wager) => {
    const target = targetInfo(wager.target);
    return target ? add(sum, commissionFor(target, decodeMoney(wager.amount))) : sum;
  }, money(0n));

function commissionFor(target: TargetInfo, stake: Money): Money {
  if (target.family === 'buy') return commission(stake, COMMISSION_RATE);
  if (target.family === 'lay') return commission(mul(stake, standingPayout(target)), COMMISSION_RATE);
  return money(0n);
}

function stakeLimits(target: Exclude<TargetInfo, LineTarget>, rules: State['rules']): { min: bigint; max: bigint; increment: bigint } {
  const props = target.family === 'hardway' || target.family === 'proposition' || target.family === 'horn';
  const limit = props ? rules.limits.props : rules.limits.flat;
  const increment = stakeIncrement(target);
  const parts = target.family === 'horn' ? BigInt(HORN_PARTS.length) : 1n;
  const low = BigInt(limit.min) * parts;
  const high = BigInt(limit.max) * parts;
  return { min: ((low + increment - 1n) / increment) * increment, max: (high / increment) * increment, increment };
}

type State = CrapsActivityState;

const stakeOf = (wagers: readonly Wager[], target: string) => {
  const found = wagers.find((wager) => wager.target === target);
  return found ? decodeMoney(found.amount) : undefined;
};

const sorted = <T extends { target: string }>(items: T[]) => items.sort((a, b) => targetOrder(a.target) - targetOrder(b.target));

const keptInstructions = (instructions: readonly WorkingInstruction[], wagers: readonly Wager[]) =>
  instructions.filter((item) => wagers.some((wager) => wager.target === item.target));

type CrapsCommand = GameCommand | Extract<Command, { readonly kind: 'set-working' }>;

const legal = (_state: State, common: readonly CommandKind[]): readonly CommandKind[] =>
  common.flatMap((kind): CommandKind[] => (kind === 'place-wager' ? ['place-wager', 'set-working'] : [kind]));

function apply(state: State, command: CrapsCommand): Step<State> {
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
      const { change, facts } = settleContracts(state);
      const done = change.wagers.length === 0;
      if (done) facts.push({ kind: 'activity-completed', balance: change.balance });
      return { change: { ...change, phase: done ? 'completed' : 'final-settlement' }, facts };
    }
  }
}

function settleContracts(state: State): { change: Change<State> & Settled['change']; facts: DomainFact[] } {
  const rolled = roll(state) as Extract<Step<State>, { change: unknown }>;
  const settled = settle({ ...state, ...rolled.change } as State);
  return { change: { ...rolled.change, ...settled.change }, facts: [...rolled.facts, ...settled.facts] };
}

function roll(state: State): Step<State> {
  const stream = RandomStream.restore(state.random);
  const dice = rollDice(stream);
  const turn = state.turn + 1;
  return {
    change: { phase: 'revealing-outcome', turn, outcome: { turn, dice }, random: stream.state() },
    facts: [{ kind: 'turn-began', turn, wagers: state.wagers }, { kind: 'dice-rolled', turn, dice }],
  };
}

function setWorking(state: State, target: string, working: boolean): Step<State> {
  const placed = targetInfo(target);
  if (!placed) return { illegal: 'unknown-target' };
  if (!isSwitchable(placed)) return { illegal: 'working-fixed' };
  if (!stakeOf(state.wagers, target)) return { illegal: 'not-available-now' };
  const others = state.instructions.filter((item) => item.target !== target);
  const usual = working === worksByDefault(placed, null) && working === worksByDefault(placed, state.point);
  const instructions = usual ? others : sorted([...others, { target, working }]);
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
      if (!existing) return { illegal: 'not-available-now' };
      if (!placed.dont || amount.n !== 0n) return { illegal: 'committed-wager' };
      const odds = stakeOf(state.wagers, `${target}-odds`);
      if (odds) changes.push({ target: `${target}-odds`, amount: money(0n) });
    } else {
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
  if (amount.n !== 0n && compare(balance, commissionsDue(wagers)) < 0) return { illegal: 'commission-unfunded' };
  return {
    change: { phase: 'open-decision', balance: encodeMoney(balance), wagers: sorted(wagers), instructions: keptInstructions(state.instructions, wagers) },
    facts,
  };
}

type Resolution = 'win' | 'loss' | 'stay' | 'bar' | { move: CrapsPoint };

function resolveBase(target: LineTarget, total: number, point: CrapsPoint | null): Resolution {
  const n = numberOf(target, point);
  if (n !== null) {
    if (total === 7) return target.dont ? 'win' : 'loss';
    if (total === n) return target.dont ? 'loss' : 'win';
    return 'stay';
  }
  if (total === 7 || total === 11) return target.dont ? 'loss' : 'win';
  if (total === 2 || total === 3) return target.dont ? 'win' : 'loss';
  if (total === 12) return target.dont ? 'bar' : 'loss';
  return target.line === 'come' ? { move: total as CrapsPoint } : 'stay';
}

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

function settle(state: State): Settled {
  const { turn, dice } = state.outcome as CrapsOutcome;
  const total = dice[0] + dice[1];
  const { point } = state;
  let balance = decodeMoney(state.balance);
  const wagers: Wager[] = [];
  const facts: DomainFact[] = [];
  const pay = (
    target: string,
    stake: Money,
    result: 'win' | 'loss' | 'returned',
    gross: Money,
    extra: { component?: number; fee?: Money; staysUp?: boolean } = {},
  ) => {
    const fee = extra.fee ?? money(0n);
    const net = result === 'loss' ? neg(stake) : sub(gross, fee);
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
        const n = numberOf(target, point) as CrapsPoint;
        const wins = target.dont ? total === 7 : total === n;
        const loses = target.dont ? total === n : total === 7;
        if (!wins && !loses) wagers.push(wager);
        else if (!isWorking(state, target)) pay(wager.target, stake, 'returned', money(0n));
        else if (wins) pay(wager.target, stake, 'win', mul(stake, trueOddsPayout(target.dont, n)));
        else pay(wager.target, stake, 'loss', money(0n));
        break;
      }
      case 'place':
      case 'buy':
      case 'lay':
      case 'hardway': {
        const resolution = isWorking(state, target) ? resolveStanding(target, dice) : 'stay';
        if (resolution === 'loss') pay(wager.target, stake, 'loss', money(0n));
        else wagers.push(wager);
        if (resolution === 'win') pay(wager.target, stake, 'win', mul(stake, standingPayout(target)), { fee: commissionFor(target, stake), staysUp: true });
        break;
      }
      case 'field':
        if (target.totals.includes(total)) pay(wager.target, stake, 'win', mul(stake, fieldPays(total, state.rules.field)));
        else pay(wager.target, stake, 'loss', money(0n));
        break;
      case 'proposition':
        if (target.totals.includes(total)) pay(wager.target, stake, 'win', mul(stake, PROPOSITION_TERMS[target.target as Proposition].pays));
        else pay(wager.target, stake, 'loss', money(0n));
        break;
      case 'horn': {
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
    const max = (cap.n / cap.d / increment) * increment;
    if (max < increment) continue;
    const odds = lineInfo(`${wager.target}-odds`);
    out.push({
      target: odds.target,
      kind: 'odds',
      min: increment.toString(),
      max: max.toString(),
      increment: increment.toString(),
      payout: ratioText(ratio),
      ...(isSwitchable(odds) ? { usualOnComeOut: worksByDefault(odds, null) } : {}),
    });
  }
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
      payout: statedPayout(target),
      ...(target.family === 'buy' ? { commission: 'stake' as const } : target.family === 'lay' ? { commission: 'win' as const } : {}),
      ...(isSwitchable(target) ? { usualOnComeOut: worksByDefault(target, null) } : {}),
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
  if (phase === 'revealing-outcome' && wagers.length === 0 && value.strategy === null) return 'a revealing roll has no committed wagers';
  if (phase === 'completed' && wagers.length > 0) return 'wagers remain after settlement';
  return undefined;
}

export interface CrapsBase {
  readonly target: string;
  readonly amount: string;
}

export function establishedBases(state: Pick<State, 'wagers' | 'point'>): CrapsBase[] {
  return state.wagers
    .filter((wager) => {
      const target = known(wager.target);
      return target.family === 'line' && established(target, state.point);
    })
    .map((wager) => ({ target: wager.target, amount: wager.amount }));
}

export const isBaseTarget = (target: string, point: CrapsPoint | null): boolean => {
  const placed = targetInfo(target);
  return placed?.family === 'line' && !placed.odds && (placed.line === 'pass' ? point !== null : placed.number !== null);
};

export function crapsBetProblem(
  rules: Pick<CrapsRuleSet, 'odds' | 'limits'>,
  target: string,
  amount: Money,
  now?: { readonly point: CrapsPoint | null; readonly bases: readonly CrapsBase[] },
): BetRequirement | undefined {
  const placed = targetInfo(target);
  if (!placed) return 'not-on-layout';
  if (amount.d !== 1n) return 'not-whole-units';
  if (placed.family !== 'line') {
    const limits = stakeLimits(placed, rules as State['rules']);
    if (amount.n % limits.increment !== 0n) return 'stake-increment';
    if (amount.n < limits.min) return 'below-minimum';
    if (amount.n > limits.max) return 'above-maximum';
    return undefined;
  }
  if (!placed.odds) {
    if (compare(amount, decodeMoney(rules.limits.flat.min)) < 0) return 'below-minimum';
    if (compare(amount, decodeMoney(rules.limits.flat.max)) > 0) return 'above-maximum';
  }
  if (!now) return undefined;
  const base = now.bases.find((item) => item.target === placed.base);
  if (!placed.odds) {
    if (base) return compare(amount, decodeMoney(base.amount)) === 0 ? undefined : 'committed-wager';
    if (placed.number !== null) return 'not-available-now';
    return (placed.line === 'pass') === (now.point === null) ? undefined : 'not-available-now';
  }
  const n = base ? numberOf(lineInfo(placed.base), now.point) : null;
  if (!base || n === null) return 'not-available-now';
  if (amount.n % wholeIncrement(trueOddsPayout(placed.dont, n)) !== 0n) return 'odds-increment';
  if (compare(amount, oddsCap(rules.odds, placed.dont, n, decodeMoney(base.amount))) > 0) return 'above-odds-cap';
  return undefined;
}

export const CRAPS: GameModule<CrapsActivityState, CrapsPermittedView, CrapsCommand> = {
  ruleSets: [{ id: STANDARD_CRAPS.id, version: STANDARD_CRAPS.version }],
  turnExposure: crapsTurnExposure,
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
  legal,
  apply,
  idleTurn: roll,
  settleContracts,
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
