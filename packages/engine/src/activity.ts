// The common session protocol: the engine interface's create, advance, read
// permitted view and encode/decode checkpoint operations. Every operation is
// pure. The state is plain JSON-safe data (money as canonical strings), so the
// checkpoint is just its canonical JSON. Validate definitions and Explain
// prescription live in strategies.ts; a guided activity pins its strategy
// revision here and asks the interpreter before each spin.

import { canonicalJson } from './canonical';
import { spinRoulette, type RoulettePocket, type RouletteWheel } from './draws';
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
import { ROULETTE_VOCABULARY, type RouletteSituation } from './roulette-strategy';
import { sha256Hex } from './sha256';
import { strategyTableCompatibility, validateStrategy } from './strategies';
import {
  initialProgress,
  parameterProblem,
  prescribe,
  progressAfter,
  progressProblem,
  type Explanation,
  type PauseReason,
  type PrescribedBet,
  type StrategyDefinition,
  type StrategyProgress,
} from './strategy';
import { ENGINE_VERSION } from './version';

/** The state-schema version, kept apart from engine, rule and protocol identities. */
export const STATE_SCHEMA_VERSION = 3 as const;

/** Ceiling for configurable base-wager limits, in units. */
const BASE_WAGER_CEILING = 1_000_000n;
/** Longest accepted id or amount text; anything longer is malformed. */
const MAX_TEXT = 128;

export interface VersionedIdentity {
  readonly id: string;
  readonly version: number;
}

export interface Limit {
  /** Canonical whole-unit amounts. */
  readonly min: string;
  readonly max: string;
}

export interface RouletteRuleSet extends VersionedIdentity {
  readonly wheel: RouletteWheel;
  readonly limits: { readonly inside: Limit; readonly outside: Limit };
}

/** Everything an activity pins at creation. */
export interface ActivitySpecification {
  readonly activityId: string;
  /** Account owner; a local placeholder until accounts exist. */
  readonly owner: string;
  /** Originating device. */
  readonly device: string;
  readonly game: 'roulette';
  readonly rules: RouletteRuleSet;
  /** Null in free play; in guided practice, the pinned strategy revision and the choices made before the start. */
  readonly strategy: { readonly definition: StrategyDefinition; readonly parameters: Readonly<Record<string, string>> } | null;
  /** Null for games without a coaching reference. */
  readonly reference: VersionedIdentity | null;
  /** Practice funding (buy-in and rebuys) or the training bankroll (no rebuys). */
  readonly fundingSource: FundingSource;
  /** Opening balance (buy-in or training-bankroll allocation): canonical positive whole units within the funding ceiling. */
  readonly funding: string;
}

export type Phase =
  | 'open-decision'
  /** A departing move waits for retry or override before anything executes. */
  | 'correction'
  | 'revealing-outcome'
  | 'settled-outcome'
  /** A strategy cycle ended; another starts only explicitly. */
  | 'cycle-completion'
  | 'final-settlement'
  | 'completed';

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

/** A departing move held for retry or override. Its id becomes the departure's. */
export interface PendingCorrection {
  readonly id: string;
  /** The turn the move would begin. */
  readonly turn: number;
  readonly explanation: Explanation;
  /** The wagers the player submitted. */
  readonly actual: readonly Wager[];
}

/** A strategy departure: recorded once, never edited. */
export interface StrategyDeparture extends PendingCorrection {
  readonly resolution: 'retried' | 'overridden';
}

/** A guided activity's strategy: the pinned revision and where its cycle stands. */
export interface StrategyRun {
  readonly definition: StrategyDefinition;
  readonly parameters: Readonly<Record<string, string>>;
  /** "stopped": Stop strategy ended its bets; the practice session goes on uncoached. */
  readonly status: 'active' | 'cycle-ended' | 'stopped';
  /** Why the cycle ended, while it is ended. */
  readonly cycleEnd: 'override' | 'cap' | null;
  readonly progress: StrategyProgress;
  /** True while the current turn began as the strategy prescribed, so its result adjusts the progress. */
  readonly coachedTurn: boolean;
  readonly correction: PendingCorrection | null;
  /** The departure log, in order. */
  readonly departures: readonly StrategyDeparture[];
  /** Betting decisions assessed (spins begun under coaching). */
  readonly decisions: number;
}

export interface ActivityState {
  readonly schema: typeof STATE_SCHEMA_VERSION;
  readonly activity: { readonly id: string; readonly owner: string; readonly device: string };
  readonly identities: {
    readonly engine: string;
    readonly game: 'roulette';
    readonly rules: VersionedIdentity;
    readonly strategy: VersionedIdentity | null;
    readonly reference: VersionedIdentity | null;
    readonly random: RandomStreamIdentity;
  };
  /** The pinned rule content, not a pointer to current definitions. */
  readonly rules: Pick<RouletteRuleSet, 'wheel' | 'limits'>;
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
  /** The latest turn's generated outcome. */
  readonly outcome: { readonly turn: number; readonly pocket: RoulettePocket } | null;
  /** Null in free play. */
  readonly strategy: StrategyRun | null;
  readonly random: RandomStreamState;
  readonly receipts: readonly Receipt[];
}

export type Command =
  /** Sets the stake on a target; amount "0" takes the wager down. */
  | { readonly kind: 'place-wager'; readonly target: string; readonly amount: string }
  | { readonly kind: 'begin-turn' }
  /** The automatic settle step after the reveal; the controller issues it, never a tap. */
  | { readonly kind: 'settle-turn' }
  | { readonly kind: 'request-stop' }
  | { readonly kind: 'advance-final-settlement' }
  /** Adds funds to a practice-funding session while it waits for input. Never places or settles anything. */
  | { readonly kind: 'rebuy'; readonly amount: string }
  /** From a correction: take the move back and set the prescribed bets instead. */
  | { readonly kind: 'retry-correction' }
  /** From a correction: keep the move as submitted (a strategy override); it executes and the cycle ends. */
  | { readonly kind: 'override-correction' }
  /** Starts another strategy cycle from the current balance (never a refill). */
  | { readonly kind: 'restart-cycle' }
  /** Ends the strategy's bets: removable wagers come back, committed ones settle; the session stays open. */
  | { readonly kind: 'stop-strategy' };

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
  | 'over-funding-ceiling';

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
      readonly result: 'win' | 'loss';
      /** Net result: payout on a win, minus the stake on a loss. */
      readonly net: string;
      /** Paid back to the balance: stake plus payout, or 0. */
      readonly returned: string;
    }
  | { readonly kind: 'stop-requested'; readonly phase: Phase }
  | { readonly kind: 'wager-returned'; readonly target: string; readonly amount: string }
  /** A rebuy: funds added, not a win. */
  | { readonly kind: 'funding-added'; readonly amount: string; readonly cumulative: string; readonly balance: string }
  | { readonly kind: 'activity-completed'; readonly balance: string }
  /** A departing move was held before it executed. */
  | {
      readonly kind: 'correction-offered';
      readonly departureId: string;
      readonly turn: number;
      readonly explanation: Explanation;
      readonly actual: readonly Wager[];
    }
  | { readonly kind: 'departure-recorded'; readonly departure: StrategyDeparture }
  | { readonly kind: 'cycle-ended'; readonly reason: 'override' | 'cap' }
  | { readonly kind: 'cycle-restarted' }
  | { readonly kind: 'strategy-stopped' };

export type RejectionReason = 'malformed' | 'stale' | 'not-legal-in-phase' | 'conflicting-command-id';

export type AdvanceResult =
  | { readonly status: 'committed'; readonly state: ActivityState; readonly facts: readonly DomainFact[]; readonly receipt: Receipt }
  /** The command id was already committed; nothing changes and nothing is drawn. */
  | { readonly status: 'duplicate'; readonly receipt: Receipt }
  /** An invalid envelope: no transition, no receipt. */
  | { readonly status: 'rejected'; readonly reason: RejectionReason; readonly message: string };

export interface PermittedView {
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
  readonly funding: {
    readonly source: FundingSource;
    readonly buyIn: string;
    readonly rebuys: readonly string[];
    readonly cumulative: string;
    /** How much a rebuy may still add. */
    readonly headroom: string;
  };
  /**
   * Null in free play. The next prescription is never in the view (it is the
   * reference answer); it appears only in a correction, after the player acts.
   */
  readonly strategy: StrategyView | null;
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

export interface StrategyView {
  readonly id: string;
  readonly revision: number;
  readonly name: string;
  /** The choices fixed before the start, with their labels. */
  readonly parameters: readonly { readonly id: string; readonly label: string; readonly value: string }[];
  readonly status: StrategyRun['status'];
  readonly cycleEnd: StrategyRun['cycleEnd'];
  /** A pending strategy action: the strategy can't place its next group, so it places no new bets. */
  readonly pending: { readonly reason: PauseReason; readonly unavailable: readonly PrescribedBet[] } | null;
  readonly correction: PendingCorrection | null;
  readonly departures: readonly StrategyDeparture[];
  /** Strategy adherence, kept apart from winnings. */
  readonly adherence: { readonly decisions: number; readonly followed: number; readonly departures: number };
  /** Any explicit override in the session; a cycle restart doesn't clear it. */
  readonly overrideAffected: boolean;
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

/**
 * Rebuys are offered only while the activity waits for input, and only with
 * practice funding; Stop strategy only while a strategy still runs.
 */
const legalCommands = (state: ActivityState): readonly CommandKind[] =>
  LEGAL[state.phase].filter(
    (kind) => (kind !== 'rebuy' || rebuysOffered(state.funding)) && (kind !== 'stop-strategy' || (state.strategy !== null && state.strategy.status !== 'stopped')),
  );

const LEGAL: Record<Phase, readonly CommandKind[]> = {
  'open-decision': ['place-wager', 'begin-turn', 'stop-strategy', 'request-stop', 'rebuy'],
  correction: ['retry-correction', 'override-correction'],
  'revealing-outcome': ['settle-turn', 'stop-strategy', 'request-stop'],
  'settled-outcome': ['place-wager', 'begin-turn', 'stop-strategy', 'request-stop', 'rebuy'],
  'cycle-completion': ['restart-cycle', 'stop-strategy', 'request-stop', 'rebuy'],
  'final-settlement': ['advance-final-settlement'],
  completed: [],
};

// ---- shape checks -------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasExactKeys = (value: unknown, keys: readonly string[]): value is Record<string, unknown> =>
  isRecord(value) && Object.keys(value).sort().join() === [...keys].sort().join();

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= MAX_TEXT;

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const isIdentity = (value: unknown): value is VersionedIdentity =>
  hasExactKeys(value, ['id', 'version']) && isText(value.id) && isCount(value.version);

/** A canonical money value, or undefined. */
function parseMoney(value: unknown): Money | undefined {
  if (typeof value !== 'string' || value.length > MAX_TEXT) return undefined;
  try {
    return decodeMoney(value);
  } catch {
    return undefined;
  }
}

const isWholeIn = (amount: Money | undefined, low: bigint, high: bigint): amount is Money =>
  amount !== undefined && amount.d === 1n && amount.n >= low && amount.n <= high;

function isLimit(value: unknown): value is Limit {
  if (!hasExactKeys(value, ['min', 'max'])) return false;
  const min = parseMoney(value.min);
  const max = parseMoney(value.max);
  return isWholeIn(min, 1n, BASE_WAGER_CEILING) && isWholeIn(max, 1n, BASE_WAGER_CEILING) && compare(min, max) <= 0;
}

const isWheel = (value: unknown): value is RouletteWheel => value === 'single-zero' || value === 'double-zero';

/** True when the id, version and wheel name one of the rule sets this engine runs. */
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
    case 'rebuy': {
      const amount = parseMoney(value.amount);
      return hasExactKeys(value, ['kind', 'amount']) && amount !== undefined && amount.n > 0n;
    }
    case 'begin-turn':
    case 'settle-turn':
    case 'request-stop':
    case 'advance-final-settlement':
    case 'retry-correction':
    case 'override-correction':
    case 'restart-cycle':
    case 'stop-strategy':
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
  if (spec.game !== 'roulette') fail(`unsupported game ${String(spec.game)}`);
  const rules = spec.rules;
  if (!isRecord(rules) || !isRuleSet(rules)) fail('unsupported roulette rules');
  if (!isLimits(rules.limits)) fail(`limits must be whole units from 1 to ${BASE_WAGER_CEILING} with min <= max`);
  const strategy = spec.strategy === null ? null : strategyRun(spec.strategy, rules as unknown as RouletteRuleSet, fail);
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
      game: 'roulette',
      rules: { id: rules.id, version: rules.version },
      strategy: strategy && { id: strategy.definition.id, version: strategy.definition.revision },
      reference: spec.reference && { id: spec.reference.id, version: spec.reference.version },
      random: { protocol: position.protocol, key: position.key, session: position.session },
    },
    rules: {
      wheel: rules.wheel,
      limits: {
        inside: { min: rules.limits.inside.min, max: rules.limits.inside.max },
        outside: { min: rules.limits.outside.min, max: rules.limits.outside.max },
      },
    },
    sequence: 0,
    phase: 'open-decision',
    turn: 0,
    balance: spec.funding,
    funding,
    wagers: [],
    outcome: null,
    strategy,
    random: position,
    receipts: [],
  };
}

/** A fresh run of a runnable strategy that fits the rules, or a failure naming what is wrong. */
function strategyRun(value: unknown, rules: RouletteRuleSet, fail: (message: string) => never): StrategyRun {
  if (!hasExactKeys(value, ['definition', 'parameters'])) return fail('strategy must be null or a definition and its parameters');
  const definition = value.definition as StrategyDefinition;
  const validation = validateStrategy(definition);
  if (!validation.runnable) return fail(`the strategy is not runnable: ${validation.diagnostics.map((d) => `${d.category} ${d.path}`).join('; ')}`);
  if (definition.game !== 'roulette') return fail(`a ${definition.game} strategy can't run at roulette`);
  const problem = parameterProblem(definition, value.parameters);
  if (problem) return fail(problem);
  const parameters = value.parameters as Record<string, string>;
  const compatibility = strategyTableCompatibility(definition, parameters, rules);
  if (!compatibility.compatible) {
    return fail(`the strategy doesn't fit this table: ${compatibility.requirements.map((r) => `${r.requirement}${r.target ? ` on ${r.target}` : ''}${r.limit ? ` (${r.limit})` : ''}`).join('; ')}`);
  }
  return {
    definition,
    parameters: { ...parameters },
    status: 'active',
    cycleEnd: null,
    progress: initialProgress(definition),
    coachedTurn: false,
    correction: null,
    departures: [],
    decisions: 0,
  };
}

// ---- advance ------------------------------------------------------------

type Change = Partial<Pick<ActivityState, 'phase' | 'turn' | 'balance' | 'funding' | 'wagers' | 'outcome' | 'random' | 'strategy'>>;
/** A transition; "assessed" marks one that only records an assessment (a correction) with wagers unchanged. */
type Step = { change: Change; facts: DomainFact[]; assessed?: true } | { illegal: IllegalActionReason };

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

  const step = apply(state, command);
  const receipt: Receipt = {
    commandId: envelope.commandId,
    sequence: state.sequence,
    command: commandText,
    disposition: 'illegal' in step || step.assessed ? 'assessed' : 'applied',
  };
  const change = 'illegal' in step ? {} : step.change;
  const facts: DomainFact[] = 'illegal' in step ? [{ kind: 'illegal-action', command, reason: step.illegal }] : step.facts;
  const next = { ...state, ...change };
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

function apply(state: ActivityState, command: Command): Step {
  switch (command.kind) {
    case 'place-wager':
      return placeWager(state, command.target, decodeMoney(command.amount));
    case 'begin-turn': {
      if (state.wagers.length === 0) return { illegal: 'no-wager' };
      const strategy = state.strategy;
      if (!strategy || strategy.status !== 'active') return beginTurn(state, strategy, []);
      const explanation = explain(state, strategy);
      if (follows(explanation, state.wagers)) return beginTurn(state, { ...strategy, coachedTurn: true, decisions: strategy.decisions + 1 }, []);
      // A departing move: hold it, before anything executes or is drawn.
      const correction: PendingCorrection = { id: `${state.activity.id}/departure/${state.sequence}`, turn: state.turn + 1, explanation, actual: state.wagers };
      return {
        change: { phase: 'correction', strategy: { ...strategy, correction } },
        facts: [{ kind: 'correction-offered', departureId: correction.id, turn: correction.turn, explanation, actual: correction.actual }],
        assessed: true,
      };
    }
    case 'retry-correction': {
      const strategy = state.strategy as StrategyRun;
      const correction = strategy.correction as PendingCorrection;
      const departure: StrategyDeparture = { ...correction, resolution: 'retried' };
      const prescription = correction.explanation.prescription;
      const wanted = prescription.status === 'prescribed' ? prescription.bets.map((bet) => ({ target: bet.target, amount: bet.amount })) : [];
      const { wagers, balance, facts } = replaceWagers(state, wanted);
      return {
        change: { phase: 'open-decision', wagers, balance, strategy: { ...strategy, correction: null, departures: [...strategy.departures, departure] } },
        facts: [{ kind: 'departure-recorded', departure }, ...facts],
      };
    }
    case 'override-correction': {
      const strategy = state.strategy as StrategyRun;
      const departure: StrategyDeparture = { ...(strategy.correction as PendingCorrection), resolution: 'overridden' };
      // A betting-strategy override ends the cycle: the move executes, and the strategy waits for an explicit restart.
      const run: StrategyRun = {
        ...strategy,
        status: 'cycle-ended',
        cycleEnd: 'override',
        coachedTurn: false,
        correction: null,
        departures: [...strategy.departures, departure],
        decisions: strategy.decisions + 1,
      };
      return beginTurn(state, run, [
        { kind: 'departure-recorded', departure },
        { kind: 'cycle-ended', reason: 'override' },
      ]);
    }
    case 'restart-cycle': {
      const strategy = state.strategy as StrategyRun;
      return {
        change: { phase: 'open-decision', strategy: { ...strategy, status: 'active', cycleEnd: null, progress: initialProgress(strategy.definition) } },
        facts: [{ kind: 'cycle-restarted' }],
      };
    }
    case 'stop-strategy': {
      const strategy: StrategyRun = { ...(state.strategy as StrategyRun), status: 'stopped', cycleEnd: null, coachedTurn: false };
      const facts: DomainFact[] = [{ kind: 'strategy-stopped' }];
      // A spin in progress keeps its committed wagers; they settle as usual.
      if (state.phase === 'revealing-outcome') return { change: { strategy }, facts };
      const returned = returnWagers(state);
      return {
        change: { phase: state.phase === 'cycle-completion' ? 'settled-outcome' : state.phase, strategy, balance: returned.balance, wagers: [] },
        facts: [...facts, ...returned.facts],
      };
    }
    case 'settle-turn': {
      const { balance, facts } = settle(state);
      let strategy = state.strategy;
      if (strategy?.coachedTurn && strategy.status === 'active') {
        const net = facts.reduce((sum, fact) => (fact.kind === 'wager-settled' ? add(sum, decodeMoney(fact.net)) : sum), money(0n));
        const result = net.n > 0n ? 'win' : net.n < 0n ? 'loss' : 'push';
        const progress = progressAfter(strategy.definition, strategy.progress, result);
        strategy = progress
          ? { ...strategy, progress, coachedTurn: false }
          : { ...strategy, status: 'cycle-ended', cycleEnd: 'cap', coachedTurn: false };
        if (!progress) facts.push({ kind: 'cycle-ended', reason: 'cap' });
      } else if (strategy?.coachedTurn) {
        strategy = { ...strategy, coachedTurn: false };
      }
      const phase = strategy?.status === 'cycle-ended' ? 'cycle-completion' : 'settled-outcome';
      return { change: { phase, balance, wagers: [], strategy }, facts };
    }
    case 'request-stop': {
      const facts: DomainFact[] = [{ kind: 'stop-requested', phase: state.phase }];
      // A spin in progress keeps its committed wagers for final settlement;
      // otherwise every wager is still removable and goes back.
      if (state.phase === 'revealing-outcome') return { change: { phase: 'final-settlement' }, facts };
      const returned = returnWagers(state);
      return { change: { phase: 'final-settlement', balance: returned.balance, wagers: [] }, facts: [...facts, ...returned.facts] };
    }
    case 'advance-final-settlement': {
      const { balance, facts } = settle(state);
      facts.push({ kind: 'activity-completed', balance });
      return { change: { phase: 'completed', balance, wagers: [] }, facts };
    }
    case 'rebuy': {
      const amount = decodeMoney(command.amount);
      const refusal = rebuyRefusal(state.funding, amount);
      if (refusal) return { illegal: refusal };
      const funding = addRebuy(state.funding, amount);
      const balance = encodeMoney(add(decodeMoney(state.balance), amount));
      return {
        change: { balance, funding },
        facts: [{ kind: 'funding-added', amount: command.amount, cumulative: encodeMoney(cumulativeFunding(funding)), balance }],
      };
    }
  }
}

/** Begins a turn with the wagers on the table: the spin is drawn now. */
function beginTurn(state: ActivityState, strategy: StrategyRun | null, facts: DomainFact[]): Step {
  const stream = RandomStream.restore(state.random);
  const pocket = spinRoulette(stream, state.rules.wheel);
  const turn = state.turn + 1;
  return {
    change: { phase: 'revealing-outcome', turn, outcome: { turn, pocket }, random: stream.state(), strategy },
    facts: [...facts, { kind: 'turn-began', turn, wagers: state.wagers }, { kind: 'outcome-generated', turn, pocket }],
  };
}

/** Every removable wager back to the balance. */
function returnWagers(state: ActivityState): { balance: string; facts: DomainFact[] } {
  let balance = decodeMoney(state.balance);
  const facts: DomainFact[] = [];
  for (const wager of state.wagers) {
    balance = add(balance, decodeMoney(wager.amount));
    facts.push({ kind: 'wager-returned', target: wager.target, amount: wager.amount });
  }
  return { balance: encodeMoney(balance), facts };
}

/** Replaces the removable wagers with others, in layout order, with a wager-changed fact for each difference. */
function replaceWagers(state: ActivityState, wanted: readonly Wager[]): { wagers: Wager[]; balance: string; facts: DomainFact[] } {
  const wheel = state.rules.wheel;
  const amountOf = (list: readonly Wager[], target: string) => list.find((wager) => wager.target === target)?.amount ?? '0';
  const targets = [...new Set([...state.wagers, ...wanted].map((wager) => wager.target))].sort((a, b) => placementOrder(wheel, a) - placementOrder(wheel, b));
  const facts: DomainFact[] = [];
  for (const target of targets) {
    const [previous, amount] = [amountOf(state.wagers, target), amountOf(wanted, target)];
    if (previous !== amount) facts.push({ kind: 'wager-changed', target, amount, previous });
  }
  const wagers = [...wanted].sort((a, b) => placementOrder(wheel, a.target) - placementOrder(wheel, b.target));
  const balance = sub(sessionValue(state), wagers.reduce((sum, wager) => add(sum, decodeMoney(wager.amount)), money(0n)));
  return { wagers, balance: encodeMoney(balance), facts };
}

/** The betting situation the strategy sees: every stake on the table is still removable, so all of it is available. */
const situationOf = (state: ActivityState): RouletteSituation => ({
  game: 'roulette',
  rules: { wheel: state.rules.wheel, limits: state.rules.limits },
  balance: encodeMoney(sessionValue(state)),
  lastPocket: state.outcome?.pocket ?? null,
});

/** What the strategy prescribes for the decision the activity waits on (the same function Explain prescription runs). */
const explain = (state: ActivityState, strategy: StrategyRun): Explanation =>
  prescribe(ROULETTE_VOCABULARY, strategy.definition, strategy.parameters, situationOf(state), strategy.progress);

/** True when the wagers are exactly the prescribed group. A paused or uncovered prescription places no new bets. */
function follows(explanation: Explanation, wagers: readonly Wager[]): boolean {
  const prescription = explanation.prescription;
  if (prescription.status !== 'prescribed') return wagers.length === 0;
  return (
    prescription.bets.length === wagers.length &&
    prescription.bets.every((bet) => wagers.some((wager) => wager.target === bet.target && compare(decodeMoney(wager.amount), decodeMoney(bet.amount)) === 0))
  );
}

/** Funds off the table plus outstanding stakes at their original value. */
const sessionValue = (state: Pick<ActivityState, 'balance' | 'wagers'>): Money =>
  state.wagers.reduce((sum, wager) => add(sum, decodeMoney(wager.amount)), decodeMoney(state.balance));

function placeWager(state: ActivityState, target: string, amount: Money): Step {
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
function settle(state: ActivityState): { balance: string; facts: DomainFact[] } {
  let balance = decodeMoney(state.balance);
  const facts: DomainFact[] = [];
  if (state.wagers.length === 0) return { balance: state.balance, facts };
  // Wagers exist outside a decision only once a turn has generated its outcome.
  const outcome = state.outcome as NonNullable<ActivityState['outcome']>;
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
export function readPermittedView(state: ActivityState): PermittedView {
  return {
    activityId: state.activity.id,
    phase: state.phase,
    sequence: state.sequence,
    turn: state.turn,
    balance: state.balance,
    wagers: state.wagers.map((wager) => ({ target: wager.target, amount: wager.amount })),
    wagersCommitted: state.wagers.length > 0 && (state.phase === 'revealing-outcome' || state.phase === 'final-settlement'),
    outcome: state.outcome && { turn: state.outcome.turn, pocket: state.outcome.pocket },
    legalCommands: [...legalCommands(state)],
    funding: {
      source: state.funding.source,
      buyIn: state.funding.buyIn,
      rebuys: [...state.funding.rebuys],
      cumulative: encodeMoney(cumulativeFunding(state.funding)),
      headroom: encodeMoney(fundingHeadroom(state.funding)),
    },
    strategy: state.strategy && strategyView(state, state.strategy),
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

function strategyView(state: ActivityState, run: StrategyRun): StrategyView {
  const { definition } = run;
  const waiting = run.status === 'active' && (state.phase === 'open-decision' || state.phase === 'settled-outcome');
  const prescription = waiting ? explain(state, run).prescription : null;
  // A departure at a turn still waiting to begin isn't a decision yet.
  const departedTurns = [...new Set(run.departures.map((departure) => departure.turn))].filter((turn) => turn <= state.turn);
  return {
    id: definition.id,
    revision: definition.revision,
    name: definition.name,
    parameters: definition.parameters.map((param) => ({ id: param.id, label: param.label, value: run.parameters[param.id] as string })),
    status: run.status,
    cycleEnd: run.cycleEnd,
    pending: prescription?.status === 'paused' ? { reason: prescription.reason, unavailable: prescription.unavailable.map((bet) => ({ ...bet })) } : null,
    correction: run.correction,
    departures: run.departures,
    adherence: { decisions: run.decisions, followed: run.decisions - departedTurns.length, departures: run.departures.length },
    overrideAffected: run.departures.some((departure) => departure.resolution === 'overridden'),
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
  if (typeof identities.game === 'string' && identities.game !== 'roulette') return `unsupported game ${identities.game}`;
  const rules = identities.rules;
  if (isIdentity(rules) && !Object.values(ROULETTE_RULE_SETS).some((set) => set.id === rules.id && set.version === rules.version)) {
    return `unsupported rules ${rules.id} v${rules.version}`;
  }
  const random = identities.random;
  if (isRecord(random) && typeof random.protocol === 'number' && random.protocol !== RANDOM_PROTOCOL_VERSION) {
    return `unsupported random protocol ${random.protocol}`;
  }
  return undefined;
}

const STATE_KEYS = ['schema', 'activity', 'identities', 'rules', 'sequence', 'phase', 'turn', 'balance', 'funding', 'wagers', 'outcome', 'strategy', 'random', 'receipts'];

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
  if (!hasExactKeys(value, STATE_KEYS)) return 'the checkpoint does not have the state fields';
  if (value.schema !== STATE_SCHEMA_VERSION) return 'missing state schema';
  const { activity, identities, rules } = value;
  if (!hasExactKeys(activity, ['id', 'owner', 'device']) || !isText(activity.id) || !isText(activity.owner) || !isText(activity.device)) {
    return 'damaged activity identity';
  }
  if (!hasExactKeys(identities, ['engine', 'game', 'rules', 'strategy', 'reference', 'random'])) return 'damaged identities';
  if (identities.engine !== ENGINE_VERSION || identities.game !== 'roulette' || !isIdentity(identities.rules)) return 'damaged identities';
  if (identities.strategy !== null && !isIdentity(identities.strategy)) return 'damaged strategy identity';
  if ((identities.strategy === null) !== (value.strategy === null)) return 'the strategy does not match its recorded identity';
  if (identities.reference !== null && !isIdentity(identities.reference)) return 'damaged reference identity';
  if (!hasExactKeys(identities.random, ['protocol', 'key', 'session'])) return 'damaged random identity';
  if (!hasExactKeys(rules, ['wheel', 'limits']) || !isWheel(rules.wheel) || !isLimits(rules.limits)) return 'damaged rules';
  if (!isRuleSet({ ...identities.rules, wheel: rules.wheel })) return 'the rules do not match their recorded identity';
  const wheel = rules.wheel;

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

  const { sequence, phase, turn, wagers, outcome, receipts } = value;
  if (!isCount(sequence) || !isCount(turn)) return 'damaged sequence or turn';
  if (typeof phase !== 'string' || !Object.keys(LEGAL).includes(phase)) return 'unknown phase';
  const balance = parseMoney(value.balance);
  if (balance === undefined || balance.n < 0n) return 'damaged balance';
  const funding = fundingDamage(value.funding, parseMoney);
  if (funding) return funding;
  if (!Array.isArray(wagers)) return 'damaged wagers';
  let order = -1;
  for (const wager of wagers as unknown[]) {
    if (!hasExactKeys(wager, ['target', 'amount']) || typeof wager.target !== 'string') return 'damaged wager';
    const amount = parseMoney(wager.amount);
    if (amount === undefined || amount.n <= 0n || placementOrder(wheel, wager.target) <= order) return 'damaged wager';
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
  if (phase === 'correction' && (value.strategy === null || wagers.length === 0)) return 'damaged correction';
  if (phase === 'cycle-completion' && (value.strategy === null || wagers.length > 0)) return 'damaged cycle completion';
  const strategy = strategyDamage(value as unknown as ActivityState, identities.strategy as VersionedIdentity | null);
  if (strategy) return strategy;
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

const RUN_KEYS = ['definition', 'parameters', 'status', 'cycleEnd', 'progress', 'coachedTurn', 'correction', 'departures', 'decisions'];
const isPlain = (value: unknown) => {
  try {
    canonicalJson(value);
    return true;
  } catch {
    return false;
  }
};

/** A description of what is wrong with a stored strategy run, if anything. Other state fields are already checked. */
function strategyDamage(state: ActivityState, identity: VersionedIdentity | null): string | undefined {
  const run: unknown = state.strategy;
  if (run === null) return undefined;
  if (!hasExactKeys(run, RUN_KEYS) || !isPlain(run)) return 'damaged strategy';
  const definition = run.definition as StrategyDefinition;
  if (!validateStrategy(definition).runnable || definition.game !== 'roulette') return 'the pinned strategy is not runnable';
  if (!identity || identity.id !== definition.id || identity.version !== definition.revision) return 'the strategy does not match its recorded identity';
  if (parameterProblem(definition, run.parameters)) return 'damaged strategy parameters';
  if (!strategyTableCompatibility(definition, run.parameters, state.rules).compatible) return 'the strategy does not fit the pinned rules';
  const { status, cycleEnd } = run;
  if (status !== 'active' && status !== 'cycle-ended' && status !== 'stopped') return 'damaged strategy status';
  if ((status === 'cycle-ended') !== (cycleEnd === 'override' || cycleEnd === 'cap') || (status !== 'cycle-ended' && cycleEnd !== null)) return 'damaged strategy cycle';
  if (state.phase === 'cycle-completion' && status !== 'cycle-ended') return 'damaged strategy cycle';
  const progress = progressProblem(definition, run.progress);
  if (progress) return progress;
  if (typeof run.coachedTurn !== 'boolean' || (run.coachedTurn && !(status === 'active' && (state.phase === 'revealing-outcome' || state.phase === 'final-settlement')))) {
    return 'damaged strategy turn';
  }
  if (!isCount(run.decisions)) return 'damaged strategy decisions';
  const ids = new Set<string>();
  if (!Array.isArray(run.departures)) return 'damaged departure log';
  for (const departure of run.departures as unknown[]) {
    if (!hasExactKeys(departure, ['id', 'turn', 'explanation', 'actual', 'resolution']) || !isText(departure.id) || ids.has(departure.id)) return 'damaged departure log';
    if (!isCount(departure.turn) || !isRecord(departure.explanation) || !Array.isArray(departure.actual)) return 'damaged departure log';
    if (departure.resolution !== 'retried' && departure.resolution !== 'overridden') return 'damaged departure log';
    ids.add(departure.id);
  }
  if (state.phase !== 'correction') return run.correction === null ? undefined : 'damaged correction';
  // A held move is exactly what the pinned strategy says about this state.
  const expected: PendingCorrection = {
    id: `${state.activity.id}/departure/${state.sequence - 1}`,
    turn: state.turn + 1,
    explanation: explain(state, run as unknown as StrategyRun),
    actual: state.wagers,
  };
  if (status !== 'active' || canonicalJson(run.correction) !== canonicalJson(expected) || ids.has(expected.id)) return 'damaged correction';
  return undefined;
}
