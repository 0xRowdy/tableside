// The roulette game module: the layout's legal placements, which pockets each
// covers, its payout and limit class, and how a spin settles. This tracer has
// the single-zero wheel's straight-up and red/black placements; the full
// layouts arrive with #62.

import type { ActivityStateBase, Command, DomainFact, GameModule, RoulettePermittedView, Step } from './activity';
import { spinRoulette, type RoulettePocket } from './draws';
import { add, compare, decodeMoney, encodeMoney, money, mul, neg, sub, type Money } from './money';
import { RandomStream } from './random';
import { BASE_WAGER_CEILING, hasExactKeys, isCount, isLimit, isWagerList, type Limit, type VersionedIdentity } from './shape';

/** The rule ids this engine can run. Rules are pinned by id and version. */
export const ROULETTE_RULES = { id: 'roulette-single-zero', version: 1, wheel: 'single-zero' } as const;

export interface RouletteRuleSet extends VersionedIdentity {
  readonly wheel: 'single-zero';
  readonly limits: { readonly inside: Limit; readonly outside: Limit };
}

export interface RouletteActivityState extends ActivityStateBase<'roulette'> {
  /** The pinned rule content, not a pointer to current definitions. */
  readonly rules: Pick<RouletteRuleSet, 'wheel' | 'limits'>;
  /** The latest turn's generated outcome. */
  readonly outcome: { readonly turn: number; readonly pocket: RoulettePocket } | null;
}

/** Inside placements use the inside limits; outside placements the outside limits. */
export type LimitClass = 'inside' | 'outside';

export interface RouletteTable {
  readonly wheel: 'single-zero';
  readonly placements: readonly { target: string; limitClass: LimitClass; min: string; max: string; payout: string }[];
}

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

/** A placement's net result for one pocket: stake × payout when it covers the pocket, else minus the stake. */
export const netResult = (placement: RoulettePlacement, stake: Money, pocket: RoulettePocket): Money =>
  placement.covers.includes(pocket) ? mul(stake, money(placement.payout)) : neg(stake);

export const isPocket = (value: unknown): value is RoulettePocket =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 36;

const isLimits = (value: unknown): value is RouletteRuleSet['limits'] =>
  hasExactKeys(value, ['inside', 'outside']) && isLimit(value.inside) && isLimit(value.outside);

type State = RouletteActivityState;

function apply(state: State, command: Command): Step<State> {
  switch (command.kind) {
    case 'place-wager':
      return placeWager(state, command.target, decodeMoney(command.amount));
    case 'begin-turn': {
      if (state.wagers.length === 0) return { illegal: 'no-wager' };
      const stream = RandomStream.restore(state.random);
      const pocket = spinRoulette(stream, state.rules.wheel);
      const turn = state.turn + 1;
      return {
        change: { phase: 'revealing-outcome', turn, outcome: { turn, pocket }, random: stream.state() },
        facts: [
          { kind: 'turn-began', turn, wagers: state.wagers },
          { kind: 'outcome-generated', turn, pocket },
        ],
      };
    }
    case 'settle-turn': {
      const { balance, facts } = settle(state);
      return { change: { phase: 'settled-outcome', balance, wagers: [] }, facts };
    }
    case 'request-stop': {
      const facts: DomainFact[] = [{ kind: 'stop-requested', phase: state.phase }];
      // A spin in progress keeps its committed wagers for final settlement;
      // otherwise every wager is still removable and goes back.
      if (state.phase === 'revealing-outcome') return { change: { phase: 'final-settlement' }, facts };
      let balance = decodeMoney(state.balance);
      for (const wager of state.wagers) {
        balance = add(balance, decodeMoney(wager.amount));
        facts.push({ kind: 'wager-returned', target: wager.target, amount: wager.amount });
      }
      return { change: { phase: 'final-settlement', balance: encodeMoney(balance), wagers: [] }, facts };
    }
    case 'advance-final-settlement': {
      const { balance, facts } = settle(state);
      facts.push({ kind: 'activity-completed', balance });
      return { change: { phase: 'completed', balance, wagers: [] }, facts };
    }
  }
}

function placeWager(state: State, target: string, amount: Money): Step<State> {
  const placement = placementFor(target);
  if (!placement) return { illegal: 'unknown-target' };
  const existing = state.wagers.find((wager) => wager.target === target);
  const previous = existing ? decodeMoney(existing.amount) : money(0n);
  if (amount.n === 0n && !existing) return { illegal: 'no-wager-to-remove' };
  if (amount.n !== 0n) {
    const limit = state.rules.limits[placement.limitClass];
    if (amount.d !== 1n) return { illegal: 'not-whole-units' };
    if (compare(amount, decodeMoney(limit.min)) < 0) return { illegal: 'below-minimum' };
    if (compare(amount, decodeMoney(limit.max)) > 0) return { illegal: 'above-maximum' };
  }
  const balance = sub(decodeMoney(state.balance), sub(amount, previous));
  if (balance.n < 0n) return { illegal: 'insufficient-funds' };
  const others = state.wagers.filter((wager) => wager.target !== target);
  const wagers = amount.n === 0n ? others : [...others, { target, amount: encodeMoney(amount) }];
  wagers.sort((a, b) => placementOrder(a.target) - placementOrder(b.target));
  return {
    change: { phase: 'open-decision', balance: encodeMoney(balance), wagers },
    facts: [{ kind: 'wager-changed', target, amount: encodeMoney(amount), previous: encodeMoney(previous) }],
  };
}

/** Settles every committed wager against the latest outcome. With no wagers, nothing is settled. */
function settle(state: State): { balance: string; facts: DomainFact[] } {
  let balance = decodeMoney(state.balance);
  const facts: DomainFact[] = [];
  if (state.wagers.length === 0) return { balance: state.balance, facts };
  // Wagers exist outside a decision only once a turn has generated its outcome.
  const outcome = state.outcome as NonNullable<State['outcome']>;
  for (const wager of state.wagers) {
    // Every stored target is a layout placement (placeWager and decode both check).
    const placement = placementFor(wager.target) as RoulettePlacement;
    const stake = decodeMoney(wager.amount);
    const net = netResult(placement, stake, outcome.pocket);
    const won = net.n > 0n;
    const returned = won ? add(stake, net) : money(0n);
    balance = add(balance, returned);
    facts.push({
      kind: 'wager-settled',
      turn: outcome.turn,
      target: wager.target,
      stake: wager.amount,
      result: won ? 'win' : 'loss',
      net: encodeMoney(net),
      returned: encodeMoney(returned),
    });
  }
  return { balance: encodeMoney(balance), facts };
}

const payoutText = (payout: bigint) => `${payout.toString()}:1`;

function damage(value: Record<string, unknown>): string | undefined {
  const { rules, phase, turn, wagers, outcome } = value;
  if (!hasExactKeys(rules, ['wheel', 'limits']) || rules.wheel !== ROULETTE_RULES.wheel || !isLimits(rules.limits)) return 'damaged rules';
  if (!isWagerList(wagers, placementOrder)) return 'damaged wager';
  if (outcome !== null && !(hasExactKeys(outcome, ['turn', 'pocket']) && isCount(outcome.turn) && outcome.turn >= 1 && outcome.turn === turn && isPocket(outcome.pocket))) {
    return 'damaged outcome';
  }
  if ((outcome === null) !== (turn === 0)) return 'the outcome does not match the turn count';
  const committed = phase === 'revealing-outcome' || (phase === 'final-settlement' && wagers.length > 0 && outcome !== null);
  if (phase === 'revealing-outcome' && wagers.length === 0) return 'a revealing turn has no committed wagers';
  if ((phase === 'settled-outcome' || phase === 'completed') && wagers.length > 0) return 'wagers remain after settlement';
  if (phase === 'final-settlement' && wagers.length > 0 && !committed) return 'damaged final settlement';
  return undefined;
}

/** Single-zero roulette behind the session protocol. */
export const ROULETTE: GameModule<RouletteActivityState, RoulettePermittedView> = {
  rules: { id: ROULETTE_RULES.id, version: ROULETTE_RULES.version },
  extra: {},
  pinRules: (rules) => {
    if (rules.id !== ROULETTE_RULES.id || rules.version !== ROULETTE_RULES.version || rules.wheel !== ROULETTE_RULES.wheel) {
      return 'unsupported roulette rules';
    }
    if (!isLimits(rules.limits)) return `limits must be whole units from 1 to ${BASE_WAGER_CEILING} with min <= max`;
    const { inside, outside } = rules.limits;
    return { wheel: ROULETTE_RULES.wheel, limits: { inside: { min: inside.min, max: inside.max }, outside: { min: outside.min, max: outside.max } } };
  },
  apply,
  view: (state) => ({
    game: 'roulette',
    outcome: state.outcome && { turn: state.outcome.turn, pocket: state.outcome.pocket },
    table: {
      wheel: state.rules.wheel,
      placements: PLACEMENTS.map((placement) => ({
        target: placement.target,
        limitClass: placement.limitClass,
        min: state.rules.limits[placement.limitClass].min,
        max: state.rules.limits[placement.limitClass].max,
        payout: payoutText(placement.payout),
      })),
    },
  }),
  damage,
};
