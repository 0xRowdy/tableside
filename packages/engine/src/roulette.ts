// The roulette game module: each wheel's layout of legal placements (which
// pockets each covers, its payout and limit class), settlement of one
// placement, and the one-spin outcome table. A layout enumerates its
// placements explicitly, zero-adjacent ones included; a number set that isn't
// on the layout is not a bet, however many pockets it covers.

import type { ActivityStateBase, DomainFact, GameCommand, GameModule, RoulettePermittedView, Step } from './activity';
import { roulettePockets, spinRoulette, type RoulettePocket, type RouletteWheel } from './draws';
import { add, compare, decodeMoney, encodeMoney, money, mul, neg, sub, type Money } from './money';
import { RandomStream } from './random';
import { BASE_WAGER_CEILING, hasExactKeys, isCount, isIdentity, isLimit, isWagerList, type Limit, type VersionedIdentity } from './shape';

/** The rule sets this engine can run, one per wheel. Rules are pinned by id and version. */
export const ROULETTE_RULE_SETS = {
  'single-zero': { id: 'roulette-single-zero', version: 1, wheel: 'single-zero' },
  'double-zero': { id: 'roulette-double-zero', version: 1, wheel: 'double-zero' },
} as const satisfies Record<RouletteWheel, { id: string; version: number; wheel: RouletteWheel }>;

/** Inside placements use the inside limits; outside placements the outside limits. */
export type LimitClass = 'inside' | 'outside';

export type PlacementKind =
  | 'straight'
  | 'split'
  | 'street'
  | 'trio'
  | 'corner'
  | 'first-four'
  | 'six-line'
  | 'basket'
  | 'red'
  | 'black'
  | 'odd'
  | 'even'
  | 'low'
  | 'high'
  | 'dozen'
  | 'column';

export interface RoulettePlacement {
  /**
   * Stable target id. Inside bets name their kind and pockets in wheel order
   * ("straight-17", "split-0-00", "corner-1-2-4-5", "basket-0-00-1-2-3");
   * outside bets name the area ("red", "low", "dozen-2", "column-3").
   */
  readonly target: string;
  readonly kind: PlacementKind;
  readonly limitClass: LimitClass;
  /** Covered pockets in wheel order. */
  readonly covers: readonly RoulettePocket[];
  /** Net payout per unit staked (35 for 35:1); the stake is returned separately. */
  readonly payout: bigint;
}

const PAYOUT: Record<PlacementKind, bigint> = {
  straight: 35n,
  split: 17n,
  street: 11n,
  trio: 11n,
  corner: 8n,
  'first-four': 8n,
  'six-line': 5n,
  basket: 6n,
  red: 1n,
  black: 1n,
  odd: 1n,
  even: 1n,
  low: 1n,
  high: 1n,
  dozen: 2n,
  column: 2n,
};

const RED: ReadonlySet<number> = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const NUMBERS = Array.from({ length: 36 }, (_, i) => i + 1);
/** The layout column (1-3) of a number. */
const columnOf = (n: number) => ((n - 1) % 3) + 1;

/**
 * Where the zero pockets meet the grid. On the single-zero layout 0 spans the
 * top of all three columns; on the double-zero layout 0 sits over 1 and 2, 00
 * over 2 and 3, with the 0-00 split between them.
 */
const ZERO_PLACEMENTS: Record<RouletteWheel, readonly (readonly [PlacementKind, readonly RoulettePocket[]])[]> = {
  'single-zero': [
    ['split', [0, 1]],
    ['split', [0, 2]],
    ['split', [0, 3]],
    ['trio', [0, 1, 2]],
    ['trio', [0, 2, 3]],
    ['first-four', [0, 1, 2, 3]],
  ],
  'double-zero': [
    ['split', [0, '00']],
    ['split', [0, 1]],
    ['split', [0, 2]],
    ['split', ['00', 2]],
    ['split', ['00', 3]],
    ['trio', [0, 1, 2]],
    ['trio', [0, '00', 2]],
    ['trio', ['00', 2, 3]],
    ['basket', [0, '00', 1, 2, 3]],
  ],
};

/** Kinds in canonical layout order. */
const KIND_ORDER: readonly PlacementKind[] = [
  'straight', 'split', 'street', 'trio', 'corner', 'first-four', 'six-line', 'basket',
  'red', 'black', 'odd', 'even', 'low', 'high', 'dozen', 'column',
];

const isInside = (kind: PlacementKind) => KIND_ORDER.indexOf(kind) < KIND_ORDER.indexOf('red');

function buildLayout(wheel: RouletteWheel): RoulettePlacement[] {
  const zeros = roulettePockets(wheel).filter((pocket) => pocket === 0 || pocket === '00');
  const sets: (readonly [kind: PlacementKind, covers: readonly RoulettePocket[], target?: string])[] = [];
  for (const pocket of [...zeros, ...NUMBERS]) sets.push(['straight', [pocket]]);
  for (const n of NUMBERS) {
    if (columnOf(n) < 3) sets.push(['split', [n, n + 1]]);
    if (n <= 33) sets.push(['split', [n, n + 3]]);
    if (columnOf(n) === 1) sets.push(['street', [n, n + 1, n + 2]]);
    if (columnOf(n) < 3 && n <= 32) sets.push(['corner', [n, n + 1, n + 3, n + 4]]);
    if (columnOf(n) === 1 && n <= 31) sets.push(['six-line', [n, n + 1, n + 2, n + 3, n + 4, n + 5]]);
  }
  sets.push(...ZERO_PLACEMENTS[wheel]);
  const outside: [PlacementKind, (n: number) => boolean, string?][] = [
    ['red', (n) => RED.has(n)],
    ['black', (n) => !RED.has(n)],
    ['odd', (n) => n % 2 === 1],
    ['even', (n) => n % 2 === 0],
    ['low', (n) => n <= 18],
    ['high', (n) => n >= 19],
    ...[1, 2, 3].map((d): [PlacementKind, (n: number) => boolean, string] => ['dozen', (n) => Math.ceil(n / 12) === d, `dozen-${d}`]),
    ...[1, 2, 3].map((c): [PlacementKind, (n: number) => boolean, string] => ['column', (n) => columnOf(n) === c, `column-${c}`]),
  ];
  for (const [kind, covered, target] of outside) sets.push([kind, NUMBERS.filter(covered), target ?? kind]);

  const pocketIndex = new Map(roulettePockets(wheel).map((pocket, index) => [pocket, index]));
  const rank = (covers: readonly RoulettePocket[]) => covers.map((pocket) => pocketIndex.get(pocket) as number);
  const placements = sets.map(([kind, pockets, target]): RoulettePlacement => {
    const covers = [...pockets].sort((a, b) => (pocketIndex.get(a) as number) - (pocketIndex.get(b) as number));
    return {
      target: target ?? `${kind}-${covers.join('-')}`,
      kind,
      limitClass: isInside(kind) ? 'inside' : 'outside',
      covers,
      payout: PAYOUT[kind],
    };
  });
  // Canonical order: by kind, then inside bets by their pockets in wheel order.
  const compareCovers = (a: readonly RoulettePocket[], b: readonly RoulettePocket[]) => {
    const [x, y] = [rank(a), rank(b)];
    for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return (x[i] as number) - (y[i] as number);
    return x.length - y.length;
  };
  return placements.sort(
    (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || (a.limitClass === 'inside' ? compareCovers(a.covers, b.covers) : 0),
  );
}

interface Layout {
  readonly placements: readonly RoulettePlacement[];
  readonly byTarget: ReadonlyMap<string, { readonly placement: RoulettePlacement; readonly index: number }>;
}

const LAYOUTS: Record<RouletteWheel, Layout> = (() => {
  const layout = (wheel: RouletteWheel): Layout => {
    const placements = buildLayout(wheel);
    return { placements, byTarget: new Map(placements.map((placement, index) => [placement.target, { placement, index }])) };
  };
  return { 'single-zero': layout('single-zero'), 'double-zero': layout('double-zero') };
})();

/** Every legal placement on the wheel's layout, in canonical order. */
export const rouletteLayout = (wheel: RouletteWheel): readonly RoulettePlacement[] => LAYOUTS[wheel].placements;

export const placementFor = (wheel: RouletteWheel, target: string): RoulettePlacement | undefined =>
  LAYOUTS[wheel].byTarget.get(target)?.placement;

/** Canonical layout order, for keeping wagers sorted; -1 for a target not on the layout. */
export const placementOrder = (wheel: RouletteWheel, target: string): number => LAYOUTS[wheel].byTarget.get(target)?.index ?? -1;

/** A placement's net result for one pocket: stake × payout when it covers the pocket, else minus the stake. */
export const netResult = (placement: RoulettePlacement, stake: Money, pocket: RoulettePocket): Money =>
  placement.covers.includes(pocket) ? mul(stake, money(placement.payout)) : neg(stake);

export const isPocket = (wheel: RouletteWheel, value: unknown): value is RoulettePocket =>
  (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 36) || (wheel === 'double-zero' && value === '00');

export interface OneSpinOutcome {
  /** The pockets giving this net result, in wheel order. */
  readonly pockets: readonly RoulettePocket[];
  /** Exact probability of landing in one of them, canonical money encoding ("18/37"). */
  readonly probability: string;
  /** The layout's net result for the spin, canonical money. */
  readonly net: string;
}

/**
 * The one-spin outcome table for a fixed layout of wagers on a wheel: every
 * pocket grouped by the layout's net result, with each group's exact
 * probability. Groups are ordered by their first pocket in wheel order. Pure:
 * it makes no draws. Throws RangeError for a target not on the wheel's
 * layout, a repeated target, or a stake that isn't positive canonical money.
 */
export function oneSpinOutcomeTable(wagers: readonly { readonly target: string; readonly amount: string }[], wheel: RouletteWheel): OneSpinOutcome[] {
  const seen = new Set<string>();
  const placed = wagers.map(({ target, amount }) => {
    const placement = placementFor(wheel, target);
    if (!placement) throw new RangeError(`${target} is not a placement on the ${wheel} layout`);
    if (seen.has(target)) throw new RangeError(`${target} appears more than once`);
    seen.add(target);
    let stake: Money;
    try {
      stake = decodeMoney(amount);
    } catch {
      throw new RangeError(`${amount} is not a canonical amount`);
    }
    if (stake.n <= 0n) throw new RangeError(`the stake on ${target} must be positive`);
    return { placement, stake };
  });
  const pockets = roulettePockets(wheel);
  const groups = new Map<string, RoulettePocket[]>();
  for (const pocket of pockets) {
    const net = encodeMoney(placed.reduce((sum, { placement, stake }) => add(sum, netResult(placement, stake, pocket)), money(0n)));
    const group = groups.get(net);
    if (group) group.push(pocket);
    else groups.set(net, [pocket]);
  }
  return [...groups].map(([net, members]) => ({
    pockets: members,
    probability: encodeMoney(money(BigInt(members.length), BigInt(pockets.length))),
    net,
  }));
}

// ---- the game module ----------------------------------------------------

export interface RouletteRuleSet extends VersionedIdentity {
  readonly wheel: RouletteWheel;
  readonly limits: { readonly inside: Limit; readonly outside: Limit };
}

export interface RouletteActivityState extends ActivityStateBase<'roulette'> {
  /** The pinned rule content, not a pointer to current definitions. */
  readonly rules: Pick<RouletteRuleSet, 'wheel' | 'limits'>;
  /** The latest turn's generated outcome. */
  readonly outcome: { readonly turn: number; readonly pocket: RoulettePocket } | null;
}

export interface RouletteTable {
  readonly wheel: RouletteWheel;
  /** Every legal placement on the layout, in canonical order. */
  readonly placements: readonly {
    target: string;
    kind: PlacementKind;
    covers: readonly RoulettePocket[];
    limitClass: LimitClass;
    min: string;
    max: string;
    payout: string;
  }[];
}

const isWheel = (value: unknown): value is RouletteWheel => value === 'single-zero' || value === 'double-zero';

/** True when the id, version and wheel name one of the rule sets this engine runs. */
const isRuleSet = (value: Record<string, unknown>): boolean =>
  isWheel(value.wheel) && value.id === ROULETTE_RULE_SETS[value.wheel].id && value.version === ROULETTE_RULE_SETS[value.wheel].version;

const isLimits = (value: unknown): value is RouletteRuleSet['limits'] =>
  hasExactKeys(value, ['inside', 'outside']) && isLimit(value.inside) && isLimit(value.outside);

type State = RouletteActivityState;

function apply(state: State, command: GameCommand): Step<State> {
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
  const wheel = state.rules.wheel;
  const placement = placementFor(wheel, target);
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
  wagers.sort((a, b) => placementOrder(wheel, a.target) - placementOrder(wheel, b.target));
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
    const placement = placementFor(state.rules.wheel, wager.target) as RoulettePlacement;
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
  const { rules, identities, phase, turn, wagers, outcome } = value;
  if (!hasExactKeys(rules, ['wheel', 'limits']) || !isWheel(rules.wheel) || !isLimits(rules.limits)) return 'damaged rules';
  const recorded = (identities as Record<string, unknown>).rules;
  if (!isIdentity(recorded) || !isRuleSet({ ...recorded, wheel: rules.wheel })) return 'the rules do not match their recorded identity';
  const wheel = rules.wheel;
  if (!isWagerList(wagers, (target) => placementOrder(wheel, target))) return 'damaged wager';
  if (outcome !== null && !(hasExactKeys(outcome, ['turn', 'pocket']) && isCount(outcome.turn) && outcome.turn >= 1 && outcome.turn === turn && isPocket(wheel, outcome.pocket))) {
    return 'damaged outcome';
  }
  if ((outcome === null) !== (turn === 0)) return 'the outcome does not match the turn count';
  const committed = phase === 'revealing-outcome' || (phase === 'final-settlement' && wagers.length > 0 && outcome !== null);
  if (phase === 'revealing-outcome' && wagers.length === 0) return 'a revealing turn has no committed wagers';
  if ((phase === 'settled-outcome' || phase === 'completed') && wagers.length > 0) return 'wagers remain after settlement';
  if (phase === 'final-settlement' && wagers.length > 0 && !committed) return 'damaged final settlement';
  return undefined;
}

/** Single- and double-zero roulette behind the session protocol. */
export const ROULETTE: GameModule<RouletteActivityState, RoulettePermittedView> = {
  ruleSets: Object.values(ROULETTE_RULE_SETS).map(({ id, version }) => ({ id, version })),
  extra: {},
  pinRules: (rules) => {
    if (!isRuleSet(rules)) return 'unsupported roulette rules';
    if (!isLimits(rules.limits)) return `limits must be whole units from 1 to ${BASE_WAGER_CEILING} with min <= max`;
    const { inside, outside } = rules.limits;
    return { wheel: rules.wheel as RouletteWheel, limits: { inside: { min: inside.min, max: inside.max }, outside: { min: outside.min, max: outside.max } } };
  },
  apply,
  view: (state) => ({
    game: 'roulette',
    outcome: state.outcome && { turn: state.outcome.turn, pocket: state.outcome.pocket },
    table: {
      wheel: state.rules.wheel,
      placements: rouletteLayout(state.rules.wheel).map((placement) => ({
        target: placement.target,
        kind: placement.kind,
        covers: [...placement.covers],
        limitClass: placement.limitClass,
        min: state.rules.limits[placement.limitClass].min,
        max: state.rules.limits[placement.limitClass].max,
        payout: payoutText(placement.payout),
      })),
    },
  }),
  damage,
};
