// The common session protocol: the engine interface's create, advance, read
// permitted view and encode/decode checkpoint operations. Every operation is
// pure. The state is plain JSON-safe data (money as canonical strings), so the
// checkpoint is just its canonical JSON. Validate definitions and Explain
// prescription arrive with the strategy interpreter (#74).
//
// The protocol owns envelopes, sequences, receipts, phases and checkpoints.
// Everything game-specific (rules, legal targets, outcomes, settlement, the
// game's part of the view and of checkpoint validation) sits behind a
// GameModule, one per game, chosen by the activity's pinned game identity.

import { canonicalJson } from './canonical';
import { CRAPS, type CrapsActivityState, type CrapsDomainFact, type CrapsIllegalActionReason, type CrapsRuleSet, type CrapsTable, type CrapsOutcome } from './craps';
import type { RoulettePocket } from './draws';
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
import { add, decodeMoney, encodeMoney, type Money } from './money';
import { RANDOM_PROTOCOL_VERSION, RandomStream, type RandomStreamIdentity, type RandomStreamState } from './random';
import { ROULETTE, type RouletteActivityState, type RouletteRuleSet, type RouletteTable } from './roulette';
import { sha256Hex } from './sha256';
import { hasExactKeys, isCount, isIdentity, isRecord, isText, parseMoney, type VersionedIdentity } from './shape';
import { ENGINE_VERSION } from './version';

export type { Limit, VersionedIdentity } from './shape';

/** The state-schema version, kept apart from engine, rule and protocol identities. */
export const STATE_SCHEMA_VERSION = 2 as const;

/** Fields every activity specification has, whatever the game. */
interface SpecificationBase {
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

/** A roulette activity: the wheel and its limits. */
export interface RouletteActivitySpecification extends SpecificationBase {
  readonly game: 'roulette';
  readonly rules: RouletteRuleSet;
}

export interface CrapsActivitySpecification extends SpecificationBase {
  readonly game: 'craps';
  readonly rules: CrapsRuleSet;
}

/** Everything an activity pins at creation. */
export type ActivitySpecification = RouletteActivitySpecification | CrapsActivitySpecification;

export type GameId = ActivitySpecification['game'];

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

/** The state every game's activity has. A game adds its pinned rules, its outcome and any table state. */
export interface ActivityStateBase<G extends GameId> {
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
  /** Stakes on the table in layout order. */
  readonly wagers: readonly Wager[];
  readonly random: RandomStreamState;
  readonly receipts: readonly Receipt[];
}

export type ActivityState = RouletteActivityState | CrapsActivityState;

export type Command =
  /** Sets the stake on a target; amount "0" takes the wager down. */
  | { readonly kind: 'place-wager'; readonly target: string; readonly amount: string }
  /** A per-bet working instruction (craps): the wager works, or is off, until told otherwise. */
  | { readonly kind: 'set-working'; readonly target: string; readonly working: boolean }
  | { readonly kind: 'begin-turn' }
  /** The automatic settle step after the reveal; the controller issues it, never a tap. */
  | { readonly kind: 'settle-turn' }
  | { readonly kind: 'request-stop' }
  | { readonly kind: 'advance-final-settlement' }
  /** Adds funds to a practice-funding session while it waits for input. Never places or settles anything. */
  | { readonly kind: 'rebuy'; readonly amount: string };

/** The commands a game module applies; the protocol itself handles funding. */
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
  | CrapsIllegalActionReason;

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
      /** A push returns the stake with no win or loss (craps odds that are off). */
      readonly result: 'win' | 'loss' | 'push';
      /** Net result: payout on a win, minus the stake on a loss, 0 on a push. */
      readonly net: string;
      /** Paid back to the balance: stake plus payout, the stake on a push, or 0. A craps place, buy, lay or hardway win stays up, so only its net comes back. */
      readonly returned: string;
      /** A craps horn part (2, 3, 11 or 12): each part of one wager settles as its own bet. */
      readonly component?: number;
      /** Commission withheld from a winning craps buy or lay; already taken out of net. */
      readonly commission?: string;
    }
  | { readonly kind: 'stop-requested'; readonly phase: Phase }
  | { readonly kind: 'wager-returned'; readonly target: string; readonly amount: string }
  /** A rebuy: funds added, not a win. */
  | { readonly kind: 'funding-added'; readonly amount: string; readonly cumulative: string; readonly balance: string }
  | { readonly kind: 'activity-completed'; readonly balance: string }
  | CrapsDomainFact;

export type RejectionReason = 'malformed' | 'stale' | 'not-legal-in-phase' | 'conflicting-command-id';

export type AdvanceResult =
  | { readonly status: 'committed'; readonly state: ActivityState; readonly facts: readonly DomainFact[]; readonly receipt: Receipt }
  /** The command id was already committed; nothing changes and nothing is drawn. */
  | { readonly status: 'duplicate'; readonly receipt: Receipt }
  /** An invalid envelope: no transition, no receipt. */
  | { readonly status: 'rejected'; readonly reason: RejectionReason; readonly message: string };

interface PermittedViewBase {
  readonly activityId: string;
  readonly phase: Phase;
  readonly sequence: number;
  readonly turn: number;
  readonly balance: string;
  readonly wagers: readonly Wager[];
  /** True while stakes are committed to a turn and can't be changed or taken down. */
  readonly wagersCommitted: boolean;
  readonly legalCommands: readonly CommandKind[];
  readonly funding: {
    readonly source: FundingSource;
    readonly buyIn: string;
    readonly rebuys: readonly string[];
    readonly cumulative: string;
    /** How much a rebuy may still add. */
    readonly headroom: string;
  };
}

export interface RoulettePermittedView extends PermittedViewBase {
  readonly game: 'roulette';
  readonly outcome: { readonly turn: number; readonly pocket: RoulettePocket } | null;
  readonly table: RouletteTable;
}

export interface CrapsPermittedView extends PermittedViewBase {
  readonly game: 'craps';
  readonly outcome: CrapsOutcome | null;
  readonly table: CrapsTable;
}

export type PermittedView = RoulettePermittedView | CrapsPermittedView;

export type CheckpointResult =
  | { readonly ok: true; readonly state: ActivityState }
  | { readonly ok: false; readonly error: { readonly kind: 'damaged' | 'unsupported'; readonly message: string } };

export class ActivitySpecificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActivitySpecificationError';
  }
}

// ---- game modules -------------------------------------------------------

/** The state fields a transition may change. */
export type Change<S extends ActivityState> = Partial<Omit<S, 'schema' | 'activity' | 'identities' | 'rules' | 'sequence' | 'receipts'>>;

/** A command's effect: a change with its facts, or the reason a meaningful action is illegal. */
export type Step<S extends ActivityState> = { change: Change<S>; facts: DomainFact[] } | { illegal: IllegalActionReason };

/** Everything the protocol needs from one game. */
export interface GameModule<S extends ActivityState, V extends PermittedView> {
  /** The rule sets this build runs, each pinned by id and version. */
  readonly ruleSets: readonly VersionedIdentity[];
  /** Game state fields beyond the common ones (and their initial values). */
  readonly extra: Omit<S, keyof ActivityStateBase<GameId> | 'rules' | 'outcome'>;
  /** The rule content to pin from a specification's rules, or why they can't run. */
  pinRules(rules: Record<string, unknown>): S['rules'] | string;
  /** Applies a command already known to be well formed and legal in the phase. */
  apply(state: S, command: GameCommand): Step<S>;
  /** The game's part of the permitted view. */
  view(state: S): Pick<V, 'game' | 'outcome' | 'table'>;
  /** The first problem with the game's part of a checkpoint (rules, wagers, outcome, table state), if any. */
  damage(value: Record<string, unknown>): string | undefined;
  /** True when the game takes per-bet working instructions (craps); set-working is offered only then. */
  readonly workingInstructions?: true;
}

// The registry casts each module to the union: a module only ever receives states of its own game.
const GAMES: Record<GameId, GameModule<ActivityState, PermittedView>> = {
  roulette: ROULETTE as unknown as GameModule<ActivityState, PermittedView>,
  craps: CRAPS as unknown as GameModule<ActivityState, PermittedView>,
};

const gameFor = (game: unknown): GameModule<ActivityState, PermittedView> | undefined =>
  typeof game === 'string' && Object.hasOwn(GAMES, game) ? GAMES[game as GameId] : undefined;

const moduleOf = (state: ActivityState) => GAMES[state.identities.game];

/**
 * Rebuys are offered only while the activity waits for input, and only with
 * practice funding; working instructions only in games that take them.
 */
const legalCommands = (state: ActivityState): readonly CommandKind[] =>
  LEGAL[state.phase].filter(
    (kind) => (kind !== 'rebuy' || rebuysOffered(state.funding)) && (kind !== 'set-working' || moduleOf(state).workingInstructions === true),
  );

const LEGAL: Record<Phase, readonly CommandKind[]> = {
  'open-decision': ['place-wager', 'set-working', 'begin-turn', 'request-stop', 'rebuy'],
  'revealing-outcome': ['settle-turn', 'request-stop'],
  'settled-outcome': ['place-wager', 'set-working', 'begin-turn', 'request-stop', 'rebuy'],
  'final-settlement': ['advance-final-settlement'],
  completed: [],
};

function isCommand(value: unknown): value is Command {
  if (!isRecord(value)) return false;
  switch (value.kind) {
    case 'place-wager': {
      const amount = parseMoney(value.amount);
      return hasExactKeys(value, ['kind', 'target', 'amount']) && isText(value.target) && amount !== undefined && amount.n >= 0n;
    }
    case 'set-working':
      return hasExactKeys(value, ['kind', 'target', 'working']) && isText(value.target) && typeof value.working === 'boolean';
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
export function createActivity(spec: ActivitySpecification, random: RandomStreamIdentity): ActivityState {
  const fail = (message: string): never => {
    throw new ActivitySpecificationError(message);
  };
  if (!isRecord(spec)) fail('the specification must be an object');
  if (!isText(spec.activityId) || !isText(spec.owner) || !isText(spec.device)) fail('activity id, owner and device are required');
  const game = gameFor(spec.game) ?? fail(`unsupported game ${String(spec.game)}`);
  if (!isRecord(spec.rules)) fail('rules are required');
  const rules = game.pinRules(spec.rules as unknown as Record<string, unknown>);
  if (typeof rules === 'string') return fail(rules);
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
  return {
    schema: STATE_SCHEMA_VERSION,
    activity: { id: spec.activityId, owner: spec.owner, device: spec.device },
    identities: {
      engine: ENGINE_VERSION,
      game: spec.game,
      // pinRules accepted these, so they name one of the game's rule sets.
      rules: { id: spec.rules.id, version: spec.rules.version },
      strategy: spec.strategy && { id: spec.strategy.id, version: spec.strategy.version },
      reference: spec.reference && { id: spec.reference.id, version: spec.reference.version },
      random: { protocol: position.protocol, key: position.key, session: position.session },
    },
    rules,
    sequence: 0,
    phase: 'open-decision',
    turn: 0,
    balance: spec.funding,
    funding,
    wagers: [],
    outcome: null,
    random: position,
    receipts: [],
    ...game.extra,
  } as ActivityState;
}

// ---- advance ------------------------------------------------------------

const reject = (reason: RejectionReason, message: string): AdvanceResult => ({ status: 'rejected', reason, message });

/**
 * Applies one command envelope. Pure: the same state and envelope always give
 * the same result, and nothing outside the returned state changes.
 */
export function advanceActivity(state: ActivityState, envelope: CommandEnvelope): AdvanceResult {
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
  const next = { ...state, ...change } as ActivityState;
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

/** A rebuy adds funds without placing or settling anything, whatever the game. */
function rebuy(state: ActivityState, text: string): Step<ActivityState> {
  const amount = decodeMoney(text);
  const refusal = rebuyRefusal(state.funding, amount);
  if (refusal) return { illegal: refusal };
  const funding = addRebuy(state.funding, amount);
  const balance = encodeMoney(add(decodeMoney(state.balance), amount));
  return {
    change: { balance, funding },
    facts: [{ kind: 'funding-added', amount: text, cumulative: encodeMoney(cumulativeFunding(funding)), balance }],
  };
}

/** Funds off the table plus outstanding stakes at their original value. */
const sessionValue = (state: Pick<ActivityState, 'balance' | 'wagers'>): Money =>
  state.wagers.reduce((sum, wager) => add(sum, decodeMoney(wager.amount)), decodeMoney(state.balance));

// ---- read permitted view ------------------------------------------------

/**
 * What the stored phase permits the player to see. It never contains random
 * state or an outcome that hasn't been generated; there is no override flag.
 */
export function readPermittedView(state: ActivityState): PermittedView {
  return {
    activityId: state.activity.id,
    phase: state.phase,
    sequence: state.sequence,
    turn: state.turn,
    balance: state.balance,
    wagers: state.wagers.map((wager) => ({ target: wager.target, amount: wager.amount })),
    wagersCommitted: state.wagers.length > 0 && (state.phase === 'revealing-outcome' || state.phase === 'final-settlement'),
    legalCommands: [...legalCommands(state)],
    funding: {
      source: state.funding.source,
      buyIn: state.funding.buyIn,
      rebuys: [...state.funding.rebuys],
      cumulative: encodeMoney(cumulativeFunding(state.funding)),
      headroom: encodeMoney(fundingHeadroom(state.funding)),
    },
    ...moduleOf(state).view(state),
  } as PermittedView;
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
  const game = gameFor(identities.game);
  if (typeof identities.game === 'string' && !game) return `unsupported game ${identities.game}`;
  const rules = identities.rules;
  if (game && isIdentity(rules) && !game.ruleSets.some((set) => set.id === rules.id && set.version === rules.version)) {
    return `unsupported rules ${rules.id} v${rules.version}`;
  }
  const random = identities.random;
  if (isRecord(random) && typeof random.protocol === 'number' && random.protocol !== RANDOM_PROTOCOL_VERSION) {
    return `unsupported random protocol ${random.protocol}`;
  }
  return undefined;
}

const STATE_KEYS = ['schema', 'activity', 'identities', 'rules', 'sequence', 'phase', 'turn', 'balance', 'funding', 'wagers', 'outcome', 'random', 'receipts'];

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
  const game = isRecord(value) && isRecord(value.identities) ? gameFor(value.identities.game) : undefined;
  if (!game) return 'damaged identities';
  if (!hasExactKeys(value, [...STATE_KEYS, ...Object.keys(game.extra)])) return 'the checkpoint does not have the state fields';
  if (value.schema !== STATE_SCHEMA_VERSION) return 'missing state schema';
  const { activity, identities } = value as Record<string, Record<string, unknown>>;
  if (!hasExactKeys(activity, ['id', 'owner', 'device']) || !isText(activity.id) || !isText(activity.owner) || !isText(activity.device)) {
    return 'damaged activity identity';
  }
  if (!hasExactKeys(identities, ['engine', 'game', 'rules', 'strategy', 'reference', 'random'])) return 'damaged identities';
  if (identities.engine !== ENGINE_VERSION || !isIdentity(identities.rules)) return 'damaged identities';
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

  const { sequence, phase, turn, receipts } = value;
  if (!isCount(sequence) || !isCount(turn)) return 'damaged sequence or turn';
  if (typeof phase !== 'string' || !Object.keys(LEGAL).includes(phase)) return 'unknown phase';
  const balance = parseMoney(value.balance);
  if (balance === undefined || balance.n < 0n) return 'damaged balance';
  const funding = fundingDamage(value.funding, parseMoney);
  if (funding) return funding;
  const gameDamage = game.damage(value);
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
