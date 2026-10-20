// The common session protocol: the engine interface's create, advance, read
// permitted view and encode/decode checkpoint operations. Every operation is
// pure. The state is plain JSON-safe data (money as canonical strings), so the
// checkpoint is just its canonical JSON. Validate definitions and Explain
// prescription arrive with the strategy interpreter (#74).

import {
  applyBlackjack,
  BLACKJACK_RULES,
  blackjackDamage,
  blackjackLegal,
  blackjackTable,
  blackjackView,
  isBlackjackAction,
  isBlackjackRuleSet,
  type BlackjackAction,
  type BlackjackActivityState,
  type BlackjackPermittedView,
  type BlackjackRuleSet,
} from './blackjack';
import { canonicalJson } from './canonical';
import { spinRoulette, type Card, type RoulettePocket, type RouletteWheel } from './draws';
import {
  addRebuy,
  cumulativeFunding,
  FUNDING_CEILING,
  fundingDamage,
  fundingHeadroom,
  observeSessionValue,
  openFunding,
  rebuysOffered,
  rebuyRefusal,
  type Funding,
  type FundingSource,
} from './funding';
import { add, compare, decodeMoney, encodeMoney, money, sub, type Money } from './money';
import { RANDOM_PROTOCOL_VERSION, RandomStream, type RandomStreamIdentity, type RandomStreamState } from './random';
import {
  isPocket,
  netResult,
  placementFor,
  placementOrder,
  ROULETTE_RULE_SETS,
  rouletteLayout,
  type LimitClass,
  type PlacementKind,
  type RoulettePlacement,
} from './roulette';
import { sha256Hex } from './sha256';
import { BASE_WAGER_CEILING, hasExactKeys, isCount, isLimit, isRecord, isText, parseMoney, type Limit } from './shape';
import { ENGINE_VERSION } from './version';

/** The state-schema version, kept apart from engine, rule and protocol identities. */
export const STATE_SCHEMA_VERSION = 2 as const;

export interface VersionedIdentity {
  readonly id: string;
  readonly version: number;
}

export type { Limit };

/** The games this engine runs. */
export type GameId = 'roulette' | 'blackjack';

export interface RouletteRuleSet extends VersionedIdentity {
  readonly wheel: RouletteWheel;
  readonly limits: { readonly inside: Limit; readonly outside: Limit };
}

/** Everything an activity pins at creation. */
export type ActivitySpecification = RouletteActivitySpecification | BlackjackActivitySpecification;

export interface RouletteActivitySpecification extends SpecificationCommon {
  readonly game: 'roulette';
  readonly rules: RouletteRuleSet;
}

export interface BlackjackActivitySpecification extends SpecificationCommon {
  readonly game: 'blackjack';
  readonly rules: BlackjackRuleSet;
}

interface SpecificationCommon {
  readonly activityId: string;
  /** Account owner; a local placeholder until accounts exist. */
  readonly owner: string;
  /** Originating device. */
  readonly device: string;
  /** Null in free play. */
  readonly strategy: VersionedIdentity | null;
  /** Null for games without a coaching reference. */
  readonly reference: VersionedIdentity | null;
  /** Practice funding (buy-in and rebuys) or the training bankroll (no rebuys). */
  readonly fundingSource: FundingSource;
  /** Opening balance (buy-in or training-bankroll allocation): canonical positive whole units within the funding ceiling. */
  readonly funding: string;
}

export type Phase = 'open-decision' | 'revealing-outcome' | 'settled-outcome' | 'final-settlement' | 'completed';

export interface Wager {
  readonly target: string;
  readonly amount: string;
}

export interface Receipt {
  readonly commandId: string;
  /** The sequence the command was committed at. */
  readonly sequence: number;
  /** Canonical JSON of the command, so a reused id with a different command is caught. */
  readonly command: string;
  readonly disposition: 'applied' | 'assessed';
}

/** The fields every game's activity state shares. */
export interface ActivityCommon<G extends GameId> {
  readonly schema: typeof STATE_SCHEMA_VERSION;
  readonly activity: { readonly id: string; readonly owner: string; readonly device: string };
  readonly identities: {
    readonly engine: string;
    readonly game: G;
    readonly rules: VersionedIdentity;
    readonly strategy: VersionedIdentity | null;
    readonly reference: VersionedIdentity | null;
    readonly random: RandomStreamIdentity;
  };
  /** The sequence the next command must carry. */
  readonly sequence: number;
  readonly phase: Phase;
  /** Turns begun so far; the current or latest turn's index. */
  readonly turn: number;
  /** Funds not on the table, canonical money. */
  readonly balance: string;
  /** Buy-in, rebuys and drawdown tracking (shared with every game). */
  readonly funding: Funding;
  /** Stakes on the table in layout order: removable in a decision, committed once a turn begins. */
  readonly wagers: readonly Wager[];
  readonly random: RandomStreamState;
  readonly receipts: readonly Receipt[];
}

export interface RouletteActivityState extends ActivityCommon<'roulette'> {
  /** The pinned rule content, not a pointer to current definitions. */
  readonly rules: Pick<RouletteRuleSet, 'wheel' | 'limits'>;
  /** The latest turn's generated outcome. */
  readonly outcome: { readonly turn: number; readonly pocket: RoulettePocket } | null;
}

export type ActivityState = RouletteActivityState | BlackjackActivityState;


export type Command =
  /** Sets the stake on a target; amount "0" takes the wager down. */
  | { readonly kind: 'place-wager'; readonly target: string; readonly amount: string }
  | { readonly kind: 'begin-turn' }
  /** A blackjack playing action for the hand awaiting a decision. */
  | { readonly kind: 'play'; readonly action: BlackjackAction }
  /** The automatic settle step after the reveal; the controller issues it, never a tap. */
  | { readonly kind: 'settle-turn' }
  | { readonly kind: 'request-stop' }
  | { readonly kind: 'advance-final-settlement' }
  /** Adds funds to a practice-funding session while it waits for input. Never places or settles anything. */
  | { readonly kind: 'rebuy'; readonly amount: string };

/** The commands a game module applies; the protocol handles rebuys for every game. */
export type GameCommand = Exclude<Command, { readonly kind: 'rebuy' }>;

export type CommandKind = Command['kind'];

export interface CommandEnvelope {
  readonly sequence: number;
  /** Idempotency id: resending it returns the original receipt. */
  readonly commandId: string;
  readonly command: Command;
}

/** Why a meaningful action failed legality. The attempt is still recorded. */
export type IllegalActionReason =
  | 'unknown-target'
  | 'not-whole-units'
  | 'below-minimum'
  | 'above-maximum'
  | 'insufficient-funds'
  | 'no-wager-to-remove'
  | 'no-wager'
  | 'over-funding-ceiling'
  /** The rules don't offer that action here (e.g. a double after the first two cards). */
  | 'action-not-available';

export type DomainFact =
  | { readonly kind: 'wager-changed'; readonly target: string; readonly amount: string; readonly previous: string }
  | { readonly kind: 'illegal-action'; readonly command: Command; readonly reason: IllegalActionReason }
  | { readonly kind: 'turn-began'; readonly turn: number; readonly wagers: readonly Wager[] }
  | { readonly kind: 'outcome-generated'; readonly turn: number; readonly pocket: RoulettePocket }
  | {
      readonly kind: 'wager-settled';
      readonly turn: number;
      readonly target: string;
      readonly stake: string;
      readonly result: 'win' | 'loss' | 'push';
      /** Net result: payout on a win, minus the stake on a loss, 0 on a push. */
      readonly net: string;
      /** Paid back to the balance: stake plus payout, or 0. */
      readonly returned: string;
    }
  | { readonly kind: 'stop-requested'; readonly phase: Phase }
  // Blackjack. A face-down card is dealt as null: facts never carry a concealed card.
  | { readonly kind: 'shoe-shuffled'; readonly cards: number; readonly cut: number }
  | { readonly kind: 'card-dealt'; readonly turn: number; readonly to: string; readonly card: Card | null }
  | { readonly kind: 'peeked'; readonly turn: number; readonly result: 'no-blackjack' | 'blackjack' }
  | { readonly kind: 'hole-card-revealed'; readonly turn: number; readonly card: Card }
  | { readonly kind: 'played'; readonly turn: number; readonly target: string; readonly action: BlackjackAction }
  | { readonly kind: 'wager-returned'; readonly target: string; readonly amount: string }
  /** A rebuy: funds added, not a win. */
  | { readonly kind: 'funding-added'; readonly amount: string; readonly cumulative: string; readonly balance: string }
  | { readonly kind: 'activity-completed'; readonly balance: string };

export type RejectionReason = 'malformed' | 'stale' | 'not-legal-in-phase' | 'conflicting-command-id';

export type AdvanceResult<S extends ActivityState = ActivityState> =
  | { readonly status: 'committed'; readonly state: S; readonly facts: readonly DomainFact[]; readonly receipt: Receipt }
  /** The command id was already committed; nothing changes and nothing is drawn. */
  | { readonly status: 'duplicate'; readonly receipt: Receipt }
  /** An invalid envelope: no transition, no receipt. */
  | { readonly status: 'rejected'; readonly reason: RejectionReason; readonly message: string };

export type PermittedView = RoulettePermittedView | BlackjackPermittedView;

/** Every game's funding lines in the view. */
export interface FundingView {
  readonly source: FundingSource;
  readonly buyIn: string;
  readonly rebuys: readonly string[];
  readonly cumulative: string;
  /** How much a rebuy may still add. */
  readonly headroom: string;
}

export interface RoulettePermittedView {
  readonly game: 'roulette';
  readonly activityId: string;
  readonly phase: Phase;
  readonly sequence: number;
  readonly turn: number;
  readonly balance: string;
  readonly wagers: readonly Wager[];
  /** True while stakes are committed to a turn and can't be changed or taken down. */
  readonly wagersCommitted: boolean;
  readonly outcome: { readonly turn: number; readonly pocket: RoulettePocket } | null;
  readonly legalCommands: readonly CommandKind[];
  readonly funding: FundingView;
  readonly table: {
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
  };
}

export type CheckpointResult =
  | { readonly ok: true; readonly state: ActivityState }
  | { readonly ok: false; readonly error: { readonly kind: 'damaged' | 'unsupported'; readonly message: string } };

export class ActivitySpecificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActivitySpecificationError';
  }
}

/** A game module's candidate change for one legal command, or why the action fails legality. */
export type Step<S> = { change: Partial<S>; facts: DomainFact[] } | { illegal: IllegalActionReason };

const LEGAL: Record<Phase, readonly CommandKind[]> = {
  'open-decision': ['place-wager', 'begin-turn', 'request-stop', 'rebuy'],
  'revealing-outcome': ['settle-turn', 'request-stop'],
  'settled-outcome': ['place-wager', 'begin-turn', 'request-stop', 'rebuy'],
  'final-settlement': ['advance-final-settlement'],
  completed: [],
};

// ---- shape checks -------------------------------------------------------

const isIdentity = (value: unknown): value is VersionedIdentity =>
  hasExactKeys(value, ['id', 'version']) && isText(value.id) && isCount(value.version);

const isWheel = (value: unknown): value is RouletteWheel => value === 'single-zero' || value === 'double-zero';

/** True when the id, version and wheel name one of the roulette rule sets this engine runs. */
const isRuleSet = (value: Record<string, unknown>): boolean =>
  isWheel(value.wheel) && value.id === ROULETTE_RULE_SETS[value.wheel].id && value.version === ROULETTE_RULE_SETS[value.wheel].version;

const isLimits = (value: unknown): value is RouletteRuleSet['limits'] =>
  hasExactKeys(value, ['inside', 'outside']) && isLimit(value.inside) && isLimit(value.outside);

function isCommand(value: unknown): value is Command {
  if (!isRecord(value)) return false;
  switch (value.kind) {
    case 'place-wager': {
      const amount = parseMoney(value.amount);
      return hasExactKeys(value, ['kind', 'target', 'amount']) && isText(value.target) && amount !== undefined && amount.n >= 0n;
    }
    case 'play':
      return hasExactKeys(value, ['kind', 'action']) && isBlackjackAction(value.action);
    case 'rebuy': {
      const amount = parseMoney(value.amount);
      return hasExactKeys(value, ['kind', 'amount']) && amount !== undefined && amount.n > 0n;
    }
    case 'begin-turn':
    case 'settle-turn':
    case 'request-stop':
    case 'advance-final-settlement':
      return hasExactKeys(value, ['kind']);
    default:
      return false;
  }
}

// ---- create -------------------------------------------------------------

/**
 * Creates an activity from a complete pinned specification and an explicit
 * random stream identity. Grants no access and consumes no allowance.
 * Throws ActivitySpecificationError for an incomplete or unsupported specification.
 */
export function createActivity(spec: RouletteActivitySpecification, random: RandomStreamIdentity): RouletteActivityState;
export function createActivity(spec: BlackjackActivitySpecification, random: RandomStreamIdentity): BlackjackActivityState;
export function createActivity(spec: ActivitySpecification, random: RandomStreamIdentity): ActivityState;
export function createActivity(spec: ActivitySpecification, random: RandomStreamIdentity): ActivityState {
  const fail = (message: string): never => {
    throw new ActivitySpecificationError(message);
  };
  if (!isRecord(spec)) fail('the specification must be an object');
  if (!isText(spec.activityId) || !isText(spec.owner) || !isText(spec.device)) fail('activity id, owner and device are required');
  const game: unknown = spec.game;
  if (game !== 'roulette' && game !== 'blackjack') fail(`unsupported game ${String(game)}`);
  const rules: Record<string, unknown> | undefined = isRecord(spec.rules) ? spec.rules : undefined;
  if (spec.game === 'roulette') {
    if (!rules || !isRuleSet(rules)) fail('unsupported roulette rules');
    if (!isLimits(spec.rules.limits)) fail(`limits must be whole units from 1 to ${BASE_WAGER_CEILING} with min <= max`);
  } else {
    if (!rules || rules.id !== BLACKJACK_RULES.id || rules.version !== BLACKJACK_RULES.version) fail('unsupported blackjack rules');
    if (!isBlackjackRuleSet(rules)) {
      fail(`blackjack rules need six decks, S17 or H17, a penetration of 50-80% in 5% steps and whole-unit limits from 1 to ${BASE_WAGER_CEILING}`);
    }
  }
  if (spec.strategy !== null && !isIdentity(spec.strategy)) fail('strategy must be null or an id and version');
  if (spec.reference !== null && !isIdentity(spec.reference)) fail('reference must be null or an id and version');
  const funding = openFunding(spec.fundingSource, parseMoney(spec.funding));
  if (!funding) return fail(`funding must be practice funding or a training bankroll, in whole units from 1 to ${FUNDING_CEILING}`);
  let stream: RandomStream;
  try {
    stream = RandomStream.create(random);
  } catch (error) {
    return fail(`invalid random stream identity: ${error instanceof Error ? error.message : String(error)}`);
  }
  const position = stream.state();
  const common = {
    schema: STATE_SCHEMA_VERSION,
    activity: { id: spec.activityId, owner: spec.owner, device: spec.device },
    sequence: 0,
    phase: 'open-decision',
    turn: 0,
    balance: spec.funding,
    funding,
    wagers: [],
    random: position,
    receipts: [],
  } as const;
  const identities = {
    engine: ENGINE_VERSION,
    rules: { id: spec.rules.id, version: spec.rules.version },
    strategy: spec.strategy && { id: spec.strategy.id, version: spec.strategy.version },
    reference: spec.reference && { id: spec.reference.id, version: spec.reference.version },
    random: { protocol: position.protocol, key: position.key, session: position.session },
  };
  if (spec.game === 'blackjack') {
    return { ...common, identities: { ...identities, game: 'blackjack' }, rules: blackjackTable(spec.rules), shoe: null, round: null };
  }
  const { limits } = spec.rules;
  return {
    ...common,
    identities: { ...identities, game: 'roulette' },
    rules: {
      wheel: spec.rules.wheel,
      limits: {
        inside: { min: limits.inside.min, max: limits.inside.max },
        outside: { min: limits.outside.min, max: limits.outside.max },
      },
    },
    outcome: null,
  };
}

// ---- advance ------------------------------------------------------------

/** The commands the state's phase (and game substate) allows. Rebuys only ever come with practice funding. */
function legalCommands(state: ActivityState): readonly CommandKind[] {
  const legal = moduleOf(state).legal(state);
  return rebuysOffered(state.funding) ? legal : legal.filter((kind) => kind !== 'rebuy');
}

const reject = (reason: RejectionReason, message: string) => ({ status: 'rejected', reason, message }) as const;

/**
 * Applies one command envelope. Pure: the same state and envelope always give
 * the same result, and nothing outside the returned state changes.
 */
export function advanceActivity<S extends ActivityState>(state: S, envelope: CommandEnvelope): AdvanceResult<S> {
  if (!hasExactKeys(envelope, ['sequence', 'commandId', 'command']) || !isCount(envelope.sequence) || !isText(envelope.commandId)) {
    return reject('malformed', 'an envelope needs a sequence, a command id and a command');
  }
  if (!isCommand(envelope.command)) return reject('malformed', 'unknown command or malformed command fields');
  const commandText = canonicalJson(envelope.command);
  const prior = state.receipts.find((receipt) => receipt.commandId === envelope.commandId);
  if (prior) {
    return prior.command === commandText && prior.sequence === envelope.sequence
      ? { status: 'duplicate', receipt: prior }
      : reject('conflicting-command-id', `command id ${envelope.commandId} was already used for a different command`);
  }
  if (envelope.sequence !== state.sequence) {
    return reject('stale', `expected sequence ${state.sequence}, got ${envelope.sequence}`);
  }
  const command = envelope.command;
  if (!legalCommands(state).includes(command.kind)) {
    return reject('not-legal-in-phase', `${command.kind} is not legal in ${state.phase}`);
  }

  const step = command.kind === 'rebuy' ? rebuy(state, command.amount) : moduleOf(state).apply(state, command);
  const receipt: Receipt = {
    commandId: envelope.commandId,
    sequence: state.sequence,
    command: commandText,
    disposition: 'illegal' in step ? 'assessed' : 'applied',
  };
  const change = 'illegal' in step ? {} : step.change;
  const facts: DomainFact[] = 'illegal' in step ? [{ kind: 'illegal-action', command, reason: step.illegal }] : step.facts;
  const next = { ...state, ...change } as S;
  return {
    status: 'committed',
    state: {
      ...next,
      // Drawdown is observed once per transition, so a turn's simultaneous settlements count together.
      funding: observeSessionValue(next.funding, sessionValue(next)),
      sequence: state.sequence + 1,
      receipts: [...state.receipts, receipt],
    },
    facts,
    receipt,
  };
}

/** A rebuy, for every game: funds added while the activity waits for input; never a win. */
function rebuy(state: ActivityState, amountText: string): Step<ActivityState> {
  const amount = decodeMoney(amountText);
  const refusal = rebuyRefusal(state.funding, amount);
  if (refusal) return { illegal: refusal };
  const funding = addRebuy(state.funding, amount);
  const balance = encodeMoney(add(decodeMoney(state.balance), amount));
  return {
    change: { balance, funding },
    facts: [{ kind: 'funding-added', amount: amountText, cumulative: encodeMoney(cumulativeFunding(funding)), balance }],
  };
}

/** Funds off the table plus outstanding stakes at their original value. */
const sessionValue = (state: Pick<ActivityState, 'balance' | 'wagers'>): Money =>
  state.wagers.reduce((sum, wager) => add(sum, decodeMoney(wager.amount)), decodeMoney(state.balance));

/** Every game's funding lines in the view. */
const fundingView = (funding: Funding): FundingView => ({
  source: funding.source,
  buyIn: funding.buyIn,
  rebuys: [...funding.rebuys],
  cumulative: encodeMoney(cumulativeFunding(funding)),
  headroom: encodeMoney(fundingHeadroom(funding)),
});

function apply(state: RouletteActivityState, command: GameCommand): Step<RouletteActivityState> {
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
    case 'play':
      // Never reached: no roulette phase allows a playing action.
      return { illegal: 'action-not-available' };
  }
}

function placeWager(state: RouletteActivityState, target: string, amount: Money): Step<RouletteActivityState> {
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
function settle(state: RouletteActivityState): { balance: string; facts: DomainFact[] } {
  let balance = decodeMoney(state.balance);
  const facts: DomainFact[] = [];
  if (state.wagers.length === 0) return { balance: state.balance, facts };
  // Wagers exist outside a decision only once a turn has generated its outcome.
  const outcome = state.outcome as NonNullable<RouletteActivityState['outcome']>;
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

// ---- read permitted view ------------------------------------------------

const payoutText = (payout: bigint) => `${payout.toString()}:1`;

/**
 * What the stored phase permits the player to see. It never contains random
 * state or an outcome that hasn't been generated; there is no override flag.
 */
export function readPermittedView(state: RouletteActivityState): RoulettePermittedView;
export function readPermittedView(state: BlackjackActivityState): BlackjackPermittedView;
export function readPermittedView(state: ActivityState): PermittedView;
export function readPermittedView(state: ActivityState): PermittedView {
  return moduleOf(state).view(state);
}

function rouletteView(state: RouletteActivityState): RoulettePermittedView {
  return {
    game: 'roulette',
    activityId: state.activity.id,
    phase: state.phase,
    sequence: state.sequence,
    turn: state.turn,
    balance: state.balance,
    wagers: state.wagers.map((wager) => ({ target: wager.target, amount: wager.amount })),
    wagersCommitted: state.wagers.length > 0 && (state.phase === 'revealing-outcome' || state.phase === 'final-settlement'),
    outcome: state.outcome && { turn: state.outcome.turn, pocket: state.outcome.pocket },
    legalCommands: [...legalCommands(state)],
    funding: fundingView(state.funding),
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
  };
}

// ---- checkpoints --------------------------------------------------------

/** The canonical checkpoint: the full state as canonical JSON. */
export const encodeCheckpoint = (state: ActivityState): string => canonicalJson(state);

/** SHA-256 of the canonical checkpoint, for cross-runtime trace comparison. */
export const checkpointHash = (state: ActivityState): string => sha256Hex(encodeCheckpoint(state));

/** Decodes a checkpoint. Damaged, non-canonical or unsupported input returns an explicit recovery error. */
export function decodeCheckpoint(text: string): CheckpointResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, error: { kind: 'damaged', message: 'the checkpoint is not JSON' } };
  }
  const unsupported = unsupportedVersion(value);
  if (unsupported) return { ok: false, error: { kind: 'unsupported', message: unsupported } };
  const damage = stateDamage(value);
  if (damage) return { ok: false, error: { kind: 'damaged', message: damage } };
  const state = value as ActivityState;
  if (encodeCheckpoint(state) !== text) return { ok: false, error: { kind: 'damaged', message: 'the checkpoint is not canonical' } };
  return { ok: true, state };
}

/** A message when the checkpoint names a schema, engine, game, rules or protocol this build can't run. */
function unsupportedVersion(value: unknown): string | undefined {
  if (!isRecord(value) || !isRecord(value.identities)) return undefined;
  const { identities } = value;
  if (typeof value.schema === 'number' && value.schema !== STATE_SCHEMA_VERSION) return `unsupported state schema ${value.schema}`;
  if (typeof identities.engine === 'string' && identities.engine !== ENGINE_VERSION) return `unsupported engine ${identities.engine}`;
  const game = identities.game;
  if (typeof game === 'string' && !isGame(game)) return `unsupported game ${game}`;
  const rules = identities.rules;
  const supported = GAMES[isGame(game) ? game : 'roulette'].rules;
  if (isIdentity(rules) && !supported.some((set) => set.id === rules.id && set.version === rules.version)) {
    return `unsupported rules ${rules.id} v${rules.version}`;
  }
  const random = identities.random;
  if (isRecord(random) && typeof random.protocol === 'number' && random.protocol !== RANDOM_PROTOCOL_VERSION) {
    return `unsupported random protocol ${random.protocol}`;
  }
  return undefined;
}

const COMMON_KEYS = ['schema', 'activity', 'identities', 'rules', 'sequence', 'phase', 'turn', 'balance', 'funding', 'wagers', 'random', 'receipts'];

/** True for the canonical JSON of a valid command, as receipts store it. */
function isCanonicalCommand(text: unknown): boolean {
  if (typeof text !== 'string') return false;
  try {
    const command: unknown = JSON.parse(text);
    return isCommand(command) && canonicalJson(command) === text;
  } catch {
    return false;
  }
}

/** A description of the first structural or invariant problem, if any. */
function stateDamage(value: unknown): string | undefined {
  const named = isRecord(value) && isRecord(value.identities) ? value.identities.game : undefined;
  const game: GameId = isGame(named) ? named : 'roulette';
  if (!hasExactKeys(value, [...COMMON_KEYS, ...GAMES[game].keys])) return 'the checkpoint does not have the state fields';
  if (value.schema !== STATE_SCHEMA_VERSION) return 'missing state schema';
  const { activity, identities } = value;
  if (!hasExactKeys(activity, ['id', 'owner', 'device']) || !isText(activity.id) || !isText(activity.owner) || !isText(activity.device)) {
    return 'damaged activity identity';
  }
  if (!hasExactKeys(identities, ['engine', 'game', 'rules', 'strategy', 'reference', 'random'])) return 'damaged identities';
  if (identities.engine !== ENGINE_VERSION || identities.game !== game || !isIdentity(identities.rules)) return 'damaged identities';
  if (identities.strategy !== null && !isIdentity(identities.strategy)) return 'damaged strategy identity';
  if (identities.reference !== null && !isIdentity(identities.reference)) return 'damaged reference identity';
  if (!hasExactKeys(identities.random, ['protocol', 'key', 'session'])) return 'damaged random identity';

  let random: RandomStreamState;
  try {
    random = RandomStream.restore(value.random as RandomStreamState).state();
  } catch {
    return 'damaged random stream position';
  }
  if (!hasExactKeys(value.random, Object.keys(random))) return 'damaged random stream position';
  if (canonicalJson(identities.random) !== canonicalJson({ protocol: random.protocol, key: random.key, session: random.session })) {
    return 'the random stream does not match its recorded identity';
  }

  const { sequence, phase, turn, wagers, receipts } = value;
  if (!isCount(sequence) || !isCount(turn)) return 'damaged sequence or turn';
  if (typeof phase !== 'string' || !Object.keys(LEGAL).includes(phase)) return 'unknown phase';
  const balance = parseMoney(value.balance);
  if (balance === undefined || balance.n < 0n) return 'damaged balance';
  const funding = fundingDamage(value.funding, parseMoney);
  if (funding) return funding;
  if (!Array.isArray(wagers)) return 'damaged wagers';
  for (const wager of wagers as unknown[]) {
    if (!hasExactKeys(wager, ['target', 'amount']) || typeof wager.target !== 'string') return 'damaged wager';
    const amount = parseMoney(wager.amount);
    if (amount === undefined || amount.n <= 0n) return 'damaged wager';
  }
  const gameDamage = GAMES[game].damage(value);
  if (gameDamage) return gameDamage;
  if (!Array.isArray(receipts) || receipts.length !== sequence) return 'receipts do not match the sequence';
  const ids = new Set<string>();
  for (const [index, receipt] of (receipts as unknown[]).entries()) {
    if (
      !hasExactKeys(receipt, ['commandId', 'sequence', 'command', 'disposition']) ||
      !isText(receipt.commandId) ||
      receipt.sequence !== index ||
      !isCanonicalCommand(receipt.command) ||
      (receipt.disposition !== 'applied' && receipt.disposition !== 'assessed') ||
      ids.has(receipt.commandId)
    ) {
      return 'damaged receipt';
    }
    ids.add(receipt.commandId);
  }
  return undefined;
}

/** The first roulette-specific problem in a checkpoint whose common fields are sound. */
function rouletteDamage(value: Record<string, unknown>): string | undefined {
  const { rules, phase, turn, outcome } = value;
  const identities = value.identities as Record<string, unknown>;
  const wagers = value.wagers as Wager[];
  if (!hasExactKeys(rules, ['wheel', 'limits']) || !isWheel(rules.wheel) || !isLimits(rules.limits)) return 'damaged rules';
  if (!isRuleSet({ ...(identities.rules as VersionedIdentity), wheel: rules.wheel })) return 'the rules do not match their recorded identity';
  const wheel = rules.wheel;
  let order = -1;
  for (const wager of wagers) {
    if (placementOrder(wheel, wager.target) <= order) return 'damaged wager';
    order = placementOrder(wheel, wager.target);
  }
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

// ---- game modules -------------------------------------------------------

/** What the session protocol needs from a game module. A new game adds one entry to GAMES. */
interface GameModule<S extends ActivityState> {
  /** The rule identities the module runs. */
  readonly rules: readonly VersionedIdentity[];
  /** State fields beyond the common ones. */
  readonly keys: readonly string[];
  legal(state: S): readonly CommandKind[];
  apply(state: S, command: GameCommand): Step<S>;
  view(state: S): PermittedView;
  /** The first game-specific problem in a checkpoint whose common fields are sound. */
  damage(value: Record<string, unknown>): string | undefined;
}

type StateOf<G extends GameId> = Extract<ActivityState, { readonly identities: { readonly game: G } }>;

const GAMES: { readonly [G in GameId]: GameModule<StateOf<G>> } = {
  roulette: {
    rules: Object.values(ROULETTE_RULE_SETS),
    keys: ['outcome'],
    legal: (state) => LEGAL[state.phase],
    apply,
    view: rouletteView,
    damage: rouletteDamage,
  },
  blackjack: {
    rules: [BLACKJACK_RULES],
    keys: ['shoe', 'round'],
    legal: blackjackLegal,
    apply: applyBlackjack,
    view: (state) => blackjackView(state, legalCommands(state), fundingView(state.funding)),
    damage: blackjackDamage,
  },
};

const isGame = (value: unknown): value is GameId => typeof value === 'string' && Object.hasOwn(GAMES, value);

/** The state's game module. Each state's game names its own module, so widening the type is sound. */
const moduleOf = (state: ActivityState) => GAMES[state.identities.game] as unknown as GameModule<ActivityState>;
