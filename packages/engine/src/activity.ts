// The common session protocol: the engine interface's create, advance, read
// permitted view and encode/decode checkpoint operations. Every operation is
// pure. The state is plain JSON-safe data (money as canonical strings), so the
// checkpoint is just its canonical JSON. Validate definitions and Explain
// prescription live in strategies.ts.
//
// Guided practice is part of the protocol, not of any game: an activity pins
// a strategy revision, and before a turn begins the protocol asks the
// strategy interpreter (through the game's registered strategy vocabulary)
// whether the submitted wagers follow it. A departing move waits in a
// correction for retry or override; settlement and the strategy's next
// adjustment stay separate steps.
//
// The protocol owns envelopes, sequences, receipts, phases and checkpoints.
// Everything game-specific (rules, legal targets, outcomes, settlement, the
// game's part of the view and of checkpoint validation) sits behind a
// GameModule, one per game, chosen by the activity's pinned game identity.

import {
  BLACKJACK,
  isBlackjackAction,
  type BlackjackAction,
  type BlackjackActivityState,
  type BlackjackCount,
  type BlackjackDomainFact,
  type BlackjackIllegalActionReason,
  type BlackjackInsuranceOffer,
  type BlackjackRoundView,
  type BlackjackRuleSet,
  type BlackjackShoeView,
  type BlackjackTableView,
} from './blackjack';
import { moveCommand, type PlayExplanation, type PlayMove } from './blackjack-strategy';
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
import { add, compare, decodeMoney, encodeMoney, type Money } from './money';
import { RANDOM_PROTOCOL_VERSION, RandomStream, type RandomStreamIdentity, type RandomStreamState } from './random';
import { ROULETTE, type RouletteActivityState, type RouletteRuleSet, type RouletteTable } from './roulette';
import { sha256Hex } from './sha256';
import { hasExactKeys, isCount, isIdentity, isRecord, isText, parseMoney, type VersionedIdentity } from './shape';
import { strategyGame, strategyTableCompatibility, validateStrategy } from './strategies';
import {
  cycleComplete,
  initialProgress,
  parameterProblem,
  prescribe,
  progressAfter,
  progressProblem,
  type Explanation,
  type HeldGroup,
  type PauseReason,
  type PlayAssessment,
  type PrescribedBet,
  type StrategyDefinition,
  type StrategyGame,
  type StrategyProgress,
  type StrategySelection,
  type TurnResult,
} from './strategy';
import { ENGINE_VERSION } from './version';

export type { Limit, VersionedIdentity } from './shape';

/** The state-schema version, kept apart from engine, rule and protocol identities. */
export const STATE_SCHEMA_VERSION = 5 as const;

/** Fields every activity specification has, whatever the game. */
interface SpecificationBase {
  readonly activityId: string;
  /** Account owner; a local placeholder until accounts exist. */
  readonly owner: string;
  /** Originating device. */
  readonly device: string;
  /** Null in free play; in guided practice, the strategy revision to pin and the choices made at setup. */
  readonly strategy: StrategySelection | null;
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

export interface BlackjackActivitySpecification extends SpecificationBase {
  readonly game: 'blackjack';
  readonly rules: BlackjackRuleSet;
}

/** Everything an activity pins at creation. */
export type ActivitySpecification = RouletteActivitySpecification | CrapsActivitySpecification | BlackjackActivitySpecification;

export type GameId = ActivitySpecification['game'];

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

/** A departing betting move held for retry or override. Its id becomes the departure's. */
export interface BetCorrection {
  readonly id: string;
  /** The turn the move would begin. */
  readonly turn: number;
  readonly explanation: Explanation;
  /** The wagers the player submitted. */
  readonly actual: readonly Wager[];
}

/** A departing playing move (blackjack) held before it executes. Its id becomes the departure's. */
export interface PlayCorrection {
  readonly id: string;
  /** The turn (round) the decision is in. */
  readonly turn: number;
  /** The decision's index among the strategy's assessed decisions. */
  readonly decision: number;
  readonly explanation: PlayExplanation;
  /** The move the player made. */
  readonly actual: PlayMove;
}

export type PendingCorrection = BetCorrection | PlayCorrection;

/** True for a playing decision's correction (blackjack); otherwise it holds a betting move. */
export const isPlayCorrection = (correction: PendingCorrection): correction is PlayCorrection => 'decision' in correction;

/** A strategy departure: recorded once, never edited. */
export type StrategyDeparture = PendingCorrection & { readonly resolution: 'retried' | 'overridden' };
/**
 * Why a strategy cycle ended: its completion rule matched; its next stake is
 * past a declared cap, or its stop rule matched (it is exhausted); a
 * progression was overridden; the player chose "Collect instead" at a pending
 * strategy action; or an adjustment left the strategy envelope.
 */
export type CycleEnd = 'completed' | 'cap' | 'stop' | 'override' | 'collected' | 'envelope';

/** One turn of a strategy cycle, for the cycle result. */
export interface CycleTurn {
  readonly turn: number;
  /** The stakes the turn began with. */
  readonly wagers: readonly Wager[];
  /** The game's outcome, in its own words (a roulette pocket). */
  readonly outcome: string;
  /** Net result of the turn's wagers. */
  readonly net: string;
  /** False for the overridden turn that ended the cycle. */
  readonly followed: boolean;
}

/** A guided activity's strategy: the pinned revision and where its cycle stands. */
export interface StrategyRun extends StrategySelection {
  /** "stopped": Stop strategy ended its bets; the practice session goes on uncoached. */
  readonly status: 'active' | 'cycle-ended' | 'stopped';
  /** Why the cycle ended, while it is ended. */
  readonly cycleEnd: CycleEnd | null;
  readonly progress: StrategyProgress;
  /**
   * An outcome's adjustment that can't execute yet (a press past the table
   * maximum, a next bet the balance can't cover). The turn's settlement is
   * final; the progress keeps its pre-adjustment values while this waits as a
   * pending strategy action, and the strategy prescribes from it. It takes
   * effect, paying nothing, once its prescription can execute.
   */
  readonly deferred: { readonly turn: number; readonly progress: StrategyProgress } | null;
  /** The current cycle: its number in the session (from 1) and its turns so far (for a strategy with cycles). */
  readonly cycle: { readonly number: number; readonly turns: readonly CycleTurn[] };
  /** True while the current turn began as the strategy prescribed, so its result adjusts the progress. */
  readonly coachedTurn: boolean;
  readonly correction: PendingCorrection | null;
  /** The departure log, in order. */
  readonly departures: readonly StrategyDeparture[];
  /** Decisions assessed: turns begun under betting instructions, and playing decisions. */
  readonly decisions: number;
}

/** A pending strategy action: what the strategy can't place now, and why. It places no new bets for it. */
export interface PendingStrategyAction {
  readonly reason: PauseReason;
  readonly unavailable: readonly PrescribedBet[];
  /** For a bet past its declared cap: that cap. */
  readonly cap?: string;
  /** For an outcome's adjustment that waits: the turn whose outcome it follows (already settled and paid). */
  readonly turn?: number;
}

export interface StrategyView {
  readonly id: string;
  readonly revision: number;
  readonly name: string;
  /** The choices fixed before the start, with their labels. */
  readonly parameters: readonly { readonly id: string; readonly label: string; readonly value: string }[];
  readonly status: StrategyRun['status'];
  readonly cycleEnd: StrategyRun['cycleEnd'];
  /** The current cycle and its result so far (the sum of its turns' net results). */
  readonly cycle: { readonly number: number; readonly net: string; readonly turns: readonly CycleTurn[] };
  readonly pending: PendingStrategyAction | null;
  /** While a cycle ended at its cap or stop rule: what the strategy could not place, which ended it. */
  readonly exhaustion: PendingStrategyAction | null;
  readonly correction: PendingCorrection | null;
  readonly departures: readonly StrategyDeparture[];
  /** Strategy adherence, kept apart from winnings. */
  readonly adherence: { readonly decisions: number; readonly followed: number; readonly departures: number };
  /** Any explicit override in the session; a cycle restart doesn't clear it. */
  readonly overrideAffected: boolean;
  /** True for a progression, whose cycle an override ends until an explicit restart. */
  readonly overrideEndsCycle: boolean;
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
  /** Null in free play. */
  readonly strategy: StrategyRun | null;
  readonly random: RandomStreamState;
  readonly receipts: readonly Receipt[];
}

export type ActivityState = RouletteActivityState | CrapsActivityState | BlackjackActivityState;

/** The state of one game's activity. */
export type StateOf<G extends GameId> = Extract<ActivityState, { readonly identities: { readonly game: G } }>;

/** Why the stop path ran: the player's stop, reset or switch, or an access-ended stop (which includes a content-removal stop). */
export type StopCause = 'stop' | 'reset' | 'switch' | 'access-ended';

export const STOP_CAUSES: readonly StopCause[] = ['stop', 'reset', 'switch', 'access-ended'];

export type Command =
  /** Sets the stake on a target; amount "0" takes the wager down. */
  | { readonly kind: 'place-wager'; readonly target: string; readonly amount: string }
  /**
   * A per-bet working instruction (craps), as the wager's status on a come-out
   * roll: place, buy and come odds can be told to work on the come-out (true),
   * lays, hardways and don't come odds to be off (false). The usual value clears it.
   */
  | { readonly kind: 'set-working'; readonly target: string; readonly working: boolean }
  | { readonly kind: 'begin-turn' }
  /** A blackjack playing action for the hand awaiting a decision. */
  | { readonly kind: 'play'; readonly action: BlackjackAction }
  /** The automatic settle step after the reveal; the controller issues it, never a tap. */
  | { readonly kind: 'settle-turn' }
  /** Starts the stop path. The cause (the player's stop when omitted) is kept in the receipt for the completed record. */
  | { readonly kind: 'request-stop'; readonly cause?: StopCause }
  | { readonly kind: 'advance-final-settlement' }
  /** Adds funds to a practice-funding session while it waits for input. Never places or settles anything. */
  | { readonly kind: 'rebuy'; readonly amount: string }
  /** From a correction: take the move back and set the prescribed bets instead. */
  | { readonly kind: 'retry-correction' }
  /** From a correction: keep the move as submitted (a strategy override); it executes now. */
  | { readonly kind: 'override-correction' }
  /** Starts another strategy cycle from the current balance (never a refill). */
  | { readonly kind: 'restart-cycle' }
  /**
   * At a pending strategy action: keep what has been paid and end the cycle
   * instead. Removable wagers come back, contracts stay to settle, and nothing
   * pending executes; another cycle starts only explicitly.
   */
  | { readonly kind: 'collect-instead' }
  /** Ends the strategy's bets: removable wagers come back, committed ones settle; the session stays open. */
  | { readonly kind: 'stop-strategy' };

/** Commands the protocol handles itself for guided practice. */
export type StrategyCommandKind = 'retry-correction' | 'override-correction' | 'restart-cycle' | 'collect-instead' | 'stop-strategy';

/**
 * The commands a game module applies; the protocol itself handles funding and
 * guided practice. Only blackjack takes playing actions and only craps working instructions.
 */
export type GameCommand = Exclude<Command, { readonly kind: 'rebuy' | 'play' | 'set-working' | StrategyCommandKind }>;

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
  | CrapsIllegalActionReason
  | BlackjackIllegalActionReason;

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
      /**
       * By net result after commission. A push is an outcome that nets 0 (a
       * blackjack tie); "returned" gives the stake back without an outcome (craps
       * odds that are off when their base resolves), so it is outside W/L/P.
       */
      readonly result: 'win' | 'loss' | 'push' | 'returned';
      /** Net result: payout on a win, minus the stake on a loss, 0 on a push or a return. */
      readonly net: string;
      /** Paid back to the balance: stake plus payout, the stake on a push or a return, or 0. A craps place, buy, lay or hardway win stays up, so only its net comes back. */
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
  /** A departing move was held before it executed. */
  | ({ readonly kind: 'correction-offered'; readonly departureId: string; readonly turn: number } & (
      | { readonly explanation: Explanation; readonly actual: readonly Wager[] }
      | { readonly decision: number; readonly explanation: PlayExplanation; readonly actual: PlayMove }
    ))
  | { readonly kind: 'departure-recorded'; readonly departure: StrategyDeparture }
  /** The strategy now holds a pending action (or a different one) and places no new bets for it. */
  | ({ readonly kind: 'strategy-paused' } & PendingStrategyAction)
  | { readonly kind: 'cycle-ended'; readonly reason: CycleEnd }
  /** A pending strategy action no longer holds (a rebuy covered it): the strategy prescribes again. */
  | { readonly kind: 'strategy-resumed' }
  | { readonly kind: 'cycle-restarted' }
  | { readonly kind: 'strategy-stopped' }
  | CrapsDomainFact
  | BlackjackDomainFact;

export type RejectionReason = 'malformed' | 'stale' | 'not-legal-in-phase' | 'conflicting-command-id';

export type AdvanceResult<S extends ActivityState = ActivityState> =
  | { readonly status: 'committed'; readonly state: S; readonly facts: readonly DomainFact[]; readonly receipt: Receipt }
  /** The command id was already committed; nothing changes and nothing is drawn. */
  | { readonly status: 'duplicate'; readonly receipt: Receipt }
  /** An invalid envelope: no transition, no receipt. */
  | { readonly status: 'rejected'; readonly reason: RejectionReason; readonly message: string };

export interface PermittedViewBase {
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
  /**
   * Null in free play. The next prescription is never in the view (it is the
   * reference answer); it appears only in a correction, after the player acts.
   */
  readonly strategy: StrategyView | null;
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

export interface BlackjackPermittedView extends PermittedViewBase {
  readonly game: 'blackjack';
  /** The current or latest round, exposed cards only. */
  readonly outcome: BlackjackRoundView | null;
  readonly table: BlackjackTableView;
  /** Actions the rules offer the hand awaiting a decision; funding is judged when one is submitted. */
  readonly playActions: readonly BlackjackAction[];
  /** The open insurance or even-money offer, before the peek; null otherwise. */
  readonly insuranceOffer: BlackjackInsuranceOffer | null;
  readonly shoe: BlackjackShoeView;
  /** The count, only where the pinned strategy has Tableside supply it (basic with deviations); null otherwise. */
  readonly count: BlackjackCount | null;
}

export type PermittedView = RoulettePermittedView | CrapsPermittedView | BlackjackPermittedView;

/** The permitted view of one game's activity. */
export type ViewOf<G extends GameId> = Extract<PermittedView, { readonly game: G }>;

export type CheckpointResult =
  | { readonly ok: true; readonly state: ActivityState }
  | { readonly ok: false; readonly error: { readonly kind: 'damaged' | 'unsupported'; readonly message: string } };

export class ActivitySpecificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActivitySpecificationError';
  }
}

/** The specification's strategy can't run at this table: not runnable, invalid choices, or incompatible. */
export class StrategySpecificationError extends ActivitySpecificationError {
  constructor(message: string) {
    super(message);
    this.name = 'StrategySpecificationError';
  }
}

// ---- game modules -------------------------------------------------------

/** The state fields a transition may change. */
export type Change<S extends ActivityState> = Partial<Omit<S, 'schema' | 'activity' | 'identities' | 'rules' | 'sequence' | 'receipts'>>;

/** A command's effect: a change with its facts, or the reason a meaningful action is illegal. */
export type Step<S extends ActivityState> = { change: Change<S>; facts: DomainFact[] } | { illegal: IllegalActionReason };

/** Everything the protocol needs from one game. */
export interface GameModule<S extends ActivityState, V extends PermittedView, C extends Exclude<Command, { readonly kind: 'rebuy' }> = GameCommand> {
  /** The rule sets this build runs, each pinned by id and version. */
  readonly ruleSets: readonly VersionedIdentity[];
  /** Game state fields beyond the common ones (and their initial values). */
  readonly extra: Omit<S, keyof ActivityStateBase<GameId> | 'rules' | 'outcome'>;
  /** The rule content to pin from a specification's rules, or why they can't run. */
  pinRules(rules: Record<string, unknown>): S['rules'] | string;
  /**
   * The commands the state allows, when the game refines the phase table (a
   * blackjack hand awaiting a decision takes only playing actions).
   */
  legal?(state: S, common: readonly CommandKind[]): readonly CommandKind[];
  /** Applies a command already known to be well formed and legal in the phase. */
  apply(state: S, command: C): Step<S>;
  /**
   * A turn with nothing at stake, for a game whose turns go on without the
   * player (craps: the dice roll and move the puck). Guided practice takes one
   * while the strategy places nothing yet, as a place-after-the-point strategy waits for a point.
   */
  idleTurn?(state: S): Step<S>;
  /** The game's part of the permitted view; it may refine when wagers count as committed. */
  view(state: S): Omit<V, keyof PermittedViewBase> & Partial<Pick<PermittedViewBase, 'wagersCommitted'>>;
  /** The first problem with the game's part of a checkpoint (rules, wagers, outcome, table state), if any. */
  damage(value: Record<string, unknown>): string | undefined;
}

// The registry casts each module to the union: a module only ever receives states of its own game.
type AnyModule = GameModule<ActivityState, PermittedView, Exclude<Command, { readonly kind: 'rebuy' }>>;

const GAMES: Record<GameId, AnyModule> = {
  roulette: ROULETTE as unknown as AnyModule,
  craps: CRAPS as unknown as AnyModule,
  blackjack: BLACKJACK as unknown as AnyModule,
};

const gameFor = (game: unknown): AnyModule | undefined =>
  typeof game === 'string' && Object.hasOwn(GAMES, game) ? GAMES[game as GameId] : undefined;

const moduleOf = (state: ActivityState) => GAMES[state.identities.game];

/**
 * Rebuys are offered only while the activity waits for input, and only with
 * practice funding; Stop strategy only while a strategy still runs; Collect
 * instead only at a pending strategy action.
 */
function legalCommands(state: ActivityState): readonly CommandKind[] {
  const legal = GUIDED_PHASES.has(state.phase) ? LEGAL[state.phase] : (moduleOf(state).legal?.(state, LEGAL[state.phase]) ?? LEGAL[state.phase]);
  const running = state.strategy !== null && state.strategy.status !== 'stopped';
  // A held playing move is part of a hand in play: the hand finishes before the session can stop.
  const midHand = state.phase === 'correction' && state.strategy?.correction != null && isPlayCorrection(state.strategy.correction);
  return legal.filter(
    (kind) =>
      (kind !== 'rebuy' || rebuysOffered(state.funding)) &&
      (kind !== 'stop-strategy' || running) &&
      (kind !== 'collect-instead' || pendingAction(state) !== null) &&
      !(midHand && kind === 'request-stop'),
  );
}

const LEGAL: Record<Phase, readonly CommandKind[]> = {
  'open-decision': ['place-wager', 'begin-turn', 'collect-instead', 'stop-strategy', 'request-stop', 'rebuy'],
  // The stop path may end a session holding a correction: the held move never executes.
  correction: ['retry-correction', 'override-correction', 'request-stop'],
  'revealing-outcome': ['settle-turn', 'stop-strategy', 'request-stop'],
  'settled-outcome': ['place-wager', 'begin-turn', 'collect-instead', 'stop-strategy', 'request-stop', 'rebuy'],
  'cycle-completion': ['restart-cycle', 'stop-strategy', 'request-stop', 'rebuy'],
  'final-settlement': ['advance-final-settlement'],
  completed: [],
};

/** Phases only guided practice reaches; the protocol, not the game, decides what they allow. */
const GUIDED_PHASES: ReadonlySet<Phase> = new Set(['correction', 'cycle-completion']);

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
    case 'play':
      return hasExactKeys(value, ['kind', 'action']) && isBlackjackAction(value.action);
    case 'request-stop':
    {
      const { cause } = value as Record<string, unknown>;
      return hasExactKeys(value, cause === undefined ? ['kind'] : ['kind', 'cause']) && (cause === undefined || STOP_CAUSES.includes(cause as StopCause));
    }
    case 'begin-turn':
    case 'settle-turn':
    case 'advance-final-settlement':
    case 'retry-correction':
    case 'override-correction':
    case 'restart-cycle':
    case 'collect-instead':
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
export function createActivity<G extends GameId>(spec: Extract<ActivitySpecification, { readonly game: G }>, random: RandomStreamIdentity): StateOf<G>;
export function createActivity(spec: ActivitySpecification, random: RandomStreamIdentity): ActivityState;
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
  const strategy = spec.strategy === null ? null : strategyRun(spec.game, spec.strategy, rules);
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
      strategy: strategy && { id: strategy.definition.id, version: strategy.definition.revision },
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
    strategy,
    random: position,
    receipts: [],
    ...game.extra,
  } as ActivityState;
}

/** A fresh run of a runnable strategy that fits the pinned rules; throws StrategySpecificationError naming what is wrong. */
function strategyRun(game: GameId, value: unknown, rules: unknown): StrategyRun {
  const fail = (message: string): never => {
    throw new StrategySpecificationError(message);
  };
  if (!hasExactKeys(value, ['definition', 'parameters'])) return fail('strategy must be null or a definition and its parameters');
  const definition = value.definition as StrategyDefinition;
  if (!strategyGame(game) || !isRecord(definition) || definition.game !== game) return fail(`no ${game} strategy can run here`);
  const validation = validateStrategy(definition);
  if (!validation.runnable) return fail(`the strategy is not runnable: ${validation.diagnostics.map((d) => `${d.category} ${d.path}`).join('; ')}`);
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
    deferred: null,
    cycle: { number: 1, turns: [] },
    coachedTurn: false,
    correction: null,
    departures: [],
    decisions: 0,
  };
}

// ---- advance ------------------------------------------------------------

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

  const guided = command.kind === 'rebuy' ? undefined : guidedStep(state, command);
  const step = command.kind === 'rebuy' ? rebuy(state, command.amount) : guided ? guided.step : moduleOf(state).apply(state, command as GameCommand);
  const receipt: Receipt = {
    commandId: envelope.commandId,
    sequence: state.sequence,
    command: commandText,
    // A correction is an assessment: it is recorded, and changes no wager.
    disposition: 'illegal' in step || guided?.assessed ? 'assessed' : 'applied',
  };
  const change = 'illegal' in step ? {} : step.change;
  const facts: DomainFact[] = 'illegal' in step ? [{ kind: 'illegal-action', command, reason: step.illegal }] : step.facts;
  const next = withDeferredResolved({ ...state, ...change } as S);
  // A pending strategy action is explicit: it is announced when it begins or changes.
  // After any input (a rebuy, say) the pending action is checked again against current funds.
  const pending = pendingAction(next);
  const before = pendingAction(state);
  if (pending && canonicalJson(pending) !== canonicalJson(before)) facts.push({ kind: 'strategy-paused', ...pending });
  if (!pending && before && next.strategy?.status === 'active' && WAITING.has(next.phase)) facts.push({ kind: 'strategy-resumed' });
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

/**
 * A deferred adjustment takes effect once its prescription can execute (a
 * rebuy covered it): the progress moves on and nothing is paid again.
 */
function withDeferredResolved<S extends ActivityState>(state: S): S {
  const run = state.strategy;
  if (!run?.deferred || run.status !== 'active' || !WAITING.has(state.phase) || heldAction(state, run)) return state;
  return { ...state, strategy: { ...run, progress: run.deferred.progress, deferred: null } };
}

/**
 * Takes down every wager the game lets come down now, as wager-returned facts;
 * contracts (craps pass and come bases with their number set) stay to settle.
 * The game applies each removal itself, so its own table state stays whole.
 */
function takeDown(state: ActivityState): { change: Change<ActivityState>; facts: DomainFact[] } {
  const game = moduleOf(state);
  let current = state;
  const facts: DomainFact[] = [];
  for (const wager of state.wagers) {
    if (!current.wagers.some((item) => item.target === wager.target)) continue;
    const removed = game.apply(current, { kind: 'place-wager', target: wager.target, amount: '0' });
    if ('illegal' in removed) continue;
    current = { ...current, ...removed.change } as ActivityState;
    for (const fact of removed.facts) {
      if (fact.kind === 'wager-changed' && fact.amount === '0') facts.push({ kind: 'wager-returned', target: fact.target, amount: fact.previous });
    }
  }
  const extra = Object.fromEntries(Object.keys(game.extra).map((key) => [key, current[key as keyof ActivityState]]));
  return { change: { ...extra, balance: current.balance, wagers: current.wagers } as Change<ActivityState>, facts };
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

// ---- guided practice ----------------------------------------------------

type AnyStep = Step<ActivityState>;

const withStrategy = (step: AnyStep, strategy: StrategyRun, facts: DomainFact[] = []): AnyStep =>
  'illegal' in step ? step : { change: { ...step.change, strategy }, facts: [...facts, ...step.facts] };

/**
 * The protocol's part of a command in guided practice, or undefined when the
 * game applies it alone. "assessed" marks a correction: recorded, with wagers unchanged.
 */
function guidedStep(state: ActivityState, command: Exclude<Command, { readonly kind: 'rebuy' }>): { step: AnyStep; assessed: boolean } | undefined {
  const run = state.strategy;
  if (!run) return undefined;
  const game = moduleOf(state);
  const apply = (target: ActivityState, gameCommand: GameCommand) => game.apply(target, gameCommand);
  switch (command.kind) {
    case 'begin-turn': {
      // Without betting instructions the player chooses the wagers; only the play is assessed.
      if (run.status !== 'active' || leavesBetting(run.definition)) return undefined;
      const explanation = explain(state, run);
      if (state.wagers.length === 0) {
        // Nothing at stake and nothing prescribed yet (a place bet waits for a point): a game whose turns go on without the player takes one.
        if (explanation.prescription.status !== 'uncovered' || !game.idleTurn) return undefined;
        return { step: withStrategy(game.idleTurn(state), { ...run, coachedTurn: true, decisions: run.decisions + 1 }), assessed: false };
      }
      // While an outcome's adjustment waits, no roll follows the strategy: it waits on the player's choice.
      if (!run.deferred && follows(explanation, state.wagers)) {
        return { step: withStrategy(apply(state, command), { ...run, coachedTurn: true, decisions: run.decisions + 1 }), assessed: false };
      }
      // A departing move: hold it, before anything executes or is drawn.
      const correction: PendingCorrection = { id: `${state.activity.id}/departure/${state.sequence}`, turn: state.turn + 1, explanation, actual: state.wagers };
      return {
        step: {
          change: { phase: 'correction', strategy: { ...run, correction } },
          facts: [{ kind: 'correction-offered', departureId: correction.id, turn: correction.turn, explanation, actual: correction.actual }],
        },
        assessed: true,
      };
    }
    case 'play':
    case 'place-wager': {
      if (run.status !== 'active') return undefined;
      const assessment = gameStrategy(state).assessPlay?.(state, run.definition, command) as PlayAssessment<PlayExplanation, PlayMove, Command> | undefined;
      if (!assessment) return undefined;
      const applied = apply(state, command as GameCommand);
      // An illegal move is an attempt, recorded as such; it is no decision.
      if ('illegal' in applied) return { step: applied, assessed: false };
      if (assessment.follows) return { step: withStrategy(applied, { ...run, decisions: run.decisions + 1 }), assessed: false };
      // A departing move: hold it, before anything executes or is dealt.
      const correction: PlayCorrection = {
        id: `${state.activity.id}/departure/${state.sequence}`,
        turn: state.turn,
        decision: run.decisions,
        explanation: assessment.explanation,
        actual: assessment.actual,
      };
      const { explanation, actual, decision } = correction;
      return {
        step: { change: { phase: 'correction', strategy: { ...run, correction } }, facts: [{ kind: 'correction-offered', departureId: correction.id, turn: correction.turn, decision, explanation, actual }] },
        assessed: true,
      };
    }
    case 'retry-correction': {
      const correction = run.correction as PendingCorrection;
      if (isPlayCorrection(correction)) return { step: resolvePlay(state, run, correction, 'retried'), assessed: false };
      const departure: StrategyDeparture = { ...correction, resolution: 'retried' };
      const prescription = correction.explanation.prescription;
      const wanted = prescription.status === 'prescribed' ? prescription.bets : [];
      // The game places the prescribed bets in place of the player's, one wager at a time: removals first.
      const amountOf = (list: readonly Wager[], target: string) => list.find((wager) => wager.target === target)?.amount;
      const changes = [
        ...state.wagers.filter((wager) => amountOf(wanted, wager.target) === undefined).map((wager) => ({ target: wager.target, amount: '0' })),
        ...wanted.filter((bet) => amountOf(state.wagers, bet.target) !== bet.amount),
      ];
      let current: ActivityState = state;
      const facts: DomainFact[] = [{ kind: 'departure-recorded', departure }];
      for (const { target, amount } of changes) {
        const placed = apply(current, { kind: 'place-wager', target, amount });
        if ('illegal' in placed) return { step: placed, assessed: false };
        current = { ...current, ...placed.change } as ActivityState;
        facts.push(...placed.facts);
      }
      const strategy: StrategyRun = { ...run, correction: null, departures: [...run.departures, departure] };
      return { step: { change: { phase: 'open-decision', balance: current.balance, wagers: current.wagers, strategy }, facts }, assessed: false };
    }
    case 'override-correction': {
      const held = run.correction as PendingCorrection;
      if (isPlayCorrection(held)) return { step: resolvePlay(state, run, held, 'overridden'), assessed: false };
      const departure: StrategyDeparture = { ...held, resolution: 'overridden' };
      // Overriding a progression ends its cycle until an explicit restart; a flat strategy just goes on.
      const progression = overrideEndsCycle(run.definition);
      const strategy: StrategyRun = {
        ...run,
        // A waiting adjustment is the outcome's own: it stands, and nothing waits on it any more.
        progress: run.deferred?.progress ?? run.progress,
        deferred: null,
        status: progression ? 'cycle-ended' : 'active',
        cycleEnd: progression ? 'override' : null,
        coachedTurn: false,
        correction: null,
        departures: [...run.departures, departure],
        decisions: run.decisions + 1,
      };
      const facts: DomainFact[] = [{ kind: 'departure-recorded', departure }];
      if (progression) facts.push({ kind: 'cycle-ended', reason: 'override' });
      return { step: withStrategy(apply({ ...state, phase: 'open-decision' } as ActivityState, { kind: 'begin-turn' }), strategy, facts), assessed: false };
    }
    case 'restart-cycle':
      return {
        step: {
          change: {
            phase: 'open-decision',
            strategy: {
              ...run,
              status: 'active',
              cycleEnd: null,
              progress: initialProgress(run.definition),
              deferred: null,
              cycle: { number: run.cycle.number + 1, turns: [] },
            },
          },
          facts: [{ kind: 'cycle-restarted' }],
        },
        assessed: false,
      };
    case 'collect-instead': {
      // The pending action is dropped, never executed: what was paid stays paid, and nothing pays again.
      const strategy: StrategyRun = { ...run, status: 'cycle-ended', cycleEnd: 'collected', deferred: null, coachedTurn: false };
      const down = takeDown(state);
      return {
        step: { change: { ...down.change, phase: 'cycle-completion', strategy }, facts: [{ kind: 'cycle-ended', reason: 'collected' }, ...down.facts] },
        assessed: false,
      };
    }
    case 'stop-strategy': {
      const strategy: StrategyRun = { ...run, status: 'stopped', cycleEnd: null, coachedTurn: false, deferred: null };
      const facts: DomainFact[] = [{ kind: 'strategy-stopped' }];
      // A turn in progress keeps its committed wagers; they settle as usual.
      if (state.phase === 'revealing-outcome') return { step: { change: { strategy }, facts }, assessed: false };
      // Between turns, removable stakes come back; committed contracts are never refunded and settle as the game goes on.
      const down = takeDown(state);
      const phase = state.phase === 'cycle-completion' ? 'settled-outcome' : state.phase;
      return { step: { change: { ...down.change, phase, strategy }, facts: [...facts, ...down.facts] }, assessed: false };
    }
    case 'settle-turn': {
      const settled = apply(state, command);
      if ('illegal' in settled) return { step: settled, assessed: false };
      let strategy: StrategyRun = { ...run, coachedTurn: false };
      const net = settled.facts.reduce((sum, fact) => (fact.kind === 'wager-settled' ? add(sum, decodeMoney(fact.net)) : sum), decodeMoney('0'));
      const after = { ...state, ...settled.change } as ActivityState;
      // The turn joins the cycle's record: a coached turn, or the overridden one that ends the cycle.
      const overridden = run.status === 'cycle-ended' && run.cycleEnd === 'override';
      if (hasCycles(run.definition) && ((run.coachedTurn && run.status === 'active') || overridden)) {
        const turn: CycleTurn = { turn: state.turn, wagers: state.wagers, outcome: gameStrategy(state).outcome(after), net: encodeMoney(net), followed: !overridden };
        strategy = { ...strategy, cycle: { ...run.cycle, turns: [...run.cycle.turns, turn] } };
      }
      if (run.coachedTurn && run.status === 'active') {
        // The strategy's adjustment is its own step after settlement: settlement is already final.
        const staked = state.wagers.reduce((sum, wager) => add(sum, decodeMoney(wager.amount)), decodeMoney('0'));
        const result = net.n > 0n ? 'win' : net.n < 0n ? 'loss' : 'push';
        const progress = progressAfter(run.definition, run.progress, result, staked, wagerResults(state.wagers, settled.facts));
        const adjusted = { ...after, strategy: { ...strategy, progress, deferred: null } } as ActivityState;
        const end = progress ? cycleEndAfter(adjusted, run.definition, progress) : 'envelope';
        if (end || !progress) {
          const reason = end ?? 'envelope';
          strategy = { ...strategy, ...(progress ? { progress } : {}), status: 'cycle-ended', cycleEnd: reason };
          settled.facts.push({ kind: 'cycle-ended', reason });
        } else if (blocked(heldAction(adjusted, adjusted.strategy as StrategyRun))) {
          // The adjustment can't execute yet: it waits, tied to this outcome, and the progress keeps its values until it can.
          strategy = { ...strategy, deferred: { turn: state.turn, progress } };
        } else {
          strategy = { ...strategy, progress };
        }
      }
      if (strategy.status !== 'cycle-ended') return { step: { change: { ...settled.change, strategy }, facts: settled.facts }, assessed: false };
      // The cycle is over: its outstanding wagers resolve. Removable ones come back; contracts stay to settle.
      const down = takeDown(after);
      return {
        step: { change: { ...settled.change, ...down.change, phase: 'cycle-completion', strategy }, facts: [...settled.facts, ...down.facts] },
        assessed: false,
      };
    }
    case 'request-stop':
      // A held correction is dropped: its move never executes, and it was never resolved into a departure.
      if (state.phase !== 'correction' && state.phase !== 'cycle-completion') return undefined;
      return { step: withStrategy(apply({ ...state, phase: 'open-decision' } as ActivityState, command), { ...run, correction: null }), assessed: false };
    default:
      return undefined;
  }
}

/** Each wager on the table for a turn, by target: its own net result once settled, or "none" while it stays unresolved. */
function wagerResults(wagers: readonly Wager[], facts: readonly DomainFact[]): Record<string, TurnResult> {
  const results: Record<string, TurnResult> = {};
  for (const wager of wagers) {
    let net: Money | undefined;
    for (const fact of facts) if (fact.kind === 'wager-settled' && fact.target === wager.target) net = add(net ?? decodeMoney('0'), decodeMoney(fact.net));
    results[wager.target] = net === undefined ? 'none' : net.n > 0n ? 'win' : net.n < 0n ? 'loss' : 'push';
  }
  return results;
}

/** A pending action the funds or the table limits block (not the strategy's own cap or stop rule). */
const blocked = (action: PendingStrategyAction | null) => action !== null && (action.reason === 'unfunded-group' || action.reason === 'limit');

/** A strategy without betting instructions leaves the wagers to the player (blackjack's playing policies): betting isn't assessed. */
const leavesBetting = (definition: StrategyDefinition) => definition.instructions.length === 0;

/**
 * A held playing move resolved: the departure is recorded once and the
 * decision is made now, with the prescribed play (retry) or the player's own
 * (override). A blackjack override applies to that one decision; the strategy
 * coaches the next.
 */
function resolvePlay(state: ActivityState, run: StrategyRun, correction: PlayCorrection, resolution: StrategyDeparture['resolution']): AnyStep {
  const departure: StrategyDeparture = { ...correction, resolution };
  const move = resolution === 'retried' ? correction.explanation.prescribed : correction.actual;
  const applied = moduleOf(state).apply({ ...state, phase: 'open-decision' } as ActivityState, moveCommand(move) as GameCommand);
  const strategy: StrategyRun = { ...run, correction: null, departures: [...run.departures, departure], decisions: run.decisions + 1 };
  return withStrategy(applied, strategy, [{ kind: 'departure-recorded', departure }]);
}

const gameStrategy = (state: ActivityState) => strategyGame(state.identities.game) as unknown as StrategyGame<ActivityState>;

/** What the strategy prescribes for the decision the activity waits on (the same function Explain prescription runs). */
function explain(state: ActivityState, run: StrategyRun): Explanation {
  const game = gameStrategy(state);
  return prescribe(game.vocabulary, run.definition, run.parameters, game.situation(state), run.deferred?.progress ?? run.progress);
}

/** True when the wagers are exactly the prescribed groups. A paused or uncovered prescription places no new bets. */
function follows(explanation: Explanation, wagers: readonly Wager[]): boolean {
  const prescription = explanation.prescription;
  if (prescription.status !== 'prescribed') return wagers.length === 0;
  return (
    prescription.bets.length === wagers.length &&
    prescription.bets.every((bet) => wagers.some((wager) => wager.target === bet.target && compare(decodeMoney(wager.amount), decodeMoney(bet.amount)) === 0))
  );
}

/** Phases that wait on a betting decision. */
const WAITING: ReadonlySet<Phase> = new Set(['open-decision', 'settled-outcome']);

/**
 * Whether a coached turn's settlement ends the cycle, and why: its completion
 * rule matches, or (for a progression) its next stake is past a declared cap
 * or its stop rule matches, so the cycle is exhausted. A shortfall or a table
 * limit is not an end: it is a pending strategy action.
 */
function cycleEndAfter(state: ActivityState, definition: StrategyDefinition, progress: StrategyProgress): CycleEnd | null {
  const game = gameStrategy(state);
  if (cycleComplete(game.vocabulary, definition, game.situation(state), progress)) return 'completed';
  if (!overrideEndsCycle(definition)) return null;
  const prescription = explain(state, state.strategy as StrategyRun).prescription;
  return prescription.status === 'paused' && (prescription.reason === 'cap' || prescription.reason === 'stop') ? prescription.reason : null;
}

/** The strategy's pending action while it waits on a betting decision, if it holds one. */
function pendingAction(state: ActivityState): PendingStrategyAction | null {
  const run = state.strategy;
  if (!run || run.status !== 'active' || leavesBetting(run.definition) || !WAITING.has(state.phase)) return null;
  const held = heldAction(state, run);
  return held && run.deferred ? { ...held, turn: run.deferred.turn } : held;
}

/** What the strategy can't place now, and why, if anything. */
function heldAction(state: ActivityState, run: StrategyRun): PendingStrategyAction | null {
  const prescription = explain(state, run).prescription;
  const capOf = (cap: string | undefined) => (cap === undefined ? {} : { cap });
  if (prescription.status === 'paused') return { reason: prescription.reason, unavailable: prescription.unavailable, ...capOf(prescription.cap) };
  if (prescription.status === 'prescribed' && prescription.held.length > 0) {
    const [first] = prescription.held as [HeldGroup];
    return { reason: first.reason, unavailable: prescription.held.flatMap((group) => group.unavailable), ...capOf(first.cap) };
  }
  return null;
}

function strategyView(state: ActivityState, run: StrategyRun): StrategyView {
  const { definition } = run;
  // A betting departure at a turn still waiting to begin isn't a decision yet; each playing departure is its own decision.
  const departedDecisions = new Set(
    run.departures.flatMap((departure) => (isPlayCorrection(departure) ? [`play ${departure.decision}`] : departure.turn <= state.turn ? [`turn ${departure.turn}`] : [])),
  );
  return {
    id: definition.id,
    revision: definition.revision,
    name: definition.name,
    parameters: definition.parameters.map((param) => ({ id: param.id, label: param.label, value: run.parameters[param.id] as string })),
    status: run.status,
    cycleEnd: run.cycleEnd,
    cycle: {
      number: run.cycle.number,
      net: encodeMoney(run.cycle.turns.reduce((sum, turn) => add(sum, decodeMoney(turn.net)), decodeMoney('0'))),
      turns: run.cycle.turns,
    },
    pending: pendingAction(state),
    exhaustion: run.status === 'cycle-ended' && (run.cycleEnd === 'cap' || run.cycleEnd === 'stop') ? heldAction(state, run) : null,
    correction: run.correction,
    departures: run.departures,
    adherence: { decisions: run.decisions, followed: run.decisions - departedDecisions.size, departures: run.departures.length },
    overrideAffected: run.departures.some((departure) => departure.resolution === 'overridden'),
    overrideEndsCycle: overrideEndsCycle(definition),
  };
}

/**
 * A strategy with progression state (counters or lists) is a betting
 * progression: an override ends its cycle. So does any strategy in a game
 * whose vocabulary says so (craps, where wagers persist across rolls).
 */
const overrideEndsCycle = (definition: StrategyDefinition) =>
  definition.counters.length > 0 || (definition.lists ?? []).length > 0 || strategyGame(definition.game)?.vocabulary.overrideEndsCycle === true;

/** A strategy whose cycles can end (a progression, or one with a completion rule) keeps a record of each cycle's turns. */
const hasCycles = (definition: StrategyDefinition) => overrideEndsCycle(definition) || definition.completeWhen != null;

/** Funds off the table plus outstanding stakes at their original value. */
const sessionValue = (state: Pick<ActivityState, 'balance' | 'wagers'>): Money =>
  state.wagers.reduce((sum, wager) => add(sum, decodeMoney(wager.amount)), decodeMoney(state.balance));

/** The cause the latest request-stop carried, read from its receipt; the player's stop when it named none. */
export function stopCause(state: ActivityState): StopCause {
  for (const receipt of [...state.receipts].reverse()) {
    const command = JSON.parse(receipt.command) as Command;
    if (command.kind === 'request-stop') return command.cause ?? 'stop';
  }
  return 'stop';
}

// ---- read permitted view ------------------------------------------------

/**
 * What the stored phase permits the player to see. It never contains random
 * state or an outcome that hasn't been generated; there is no override flag.
 */
export function readPermittedView<S extends ActivityState>(state: S): ViewOf<S['identities']['game']>;
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
    strategy: state.strategy && strategyView(state, state.strategy),
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
  if (GUIDED_PHASES.has(phase as Phase) && value.strategy === null) return 'a guided phase without a strategy';
  if (phase === 'correction' && (value.wagers as unknown[]).length === 0) return 'damaged correction';
  // A game judges its own part as of the decision a guided phase waits on.
  const gameDamage = game.damage(GUIDED_PHASES.has(phase as Phase) ? { ...value, phase: 'open-decision' } : value);
  if (gameDamage) return gameDamage;
  const strategy = strategyDamage(value as unknown as ActivityState, identities.strategy as VersionedIdentity | null);
  if (strategy) return strategy;
  // A cycle's outstanding wagers resolved when it ended: only contracts can still be on the table.
  if (phase === 'cycle-completion' && takeDown(value as unknown as ActivityState).facts.length > 0) return 'damaged cycle completion';
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

/** A stored playing move: an action, or insuring with an amount. */
const isMove = (value: unknown): value is PlayMove =>
  hasExactKeys(value, ['action', 'amount']) &&
  (value.action === 'insure' ? parseMoney(value.amount) !== undefined : isBlackjackAction(value.action) && value.amount === null);

const RUN_KEYS = ['definition', 'parameters', 'status', 'cycleEnd', 'progress', 'deferred', 'cycle', 'coachedTurn', 'correction', 'departures', 'decisions'];

const CYCLE_ENDS: readonly unknown[] = ['completed', 'cap', 'stop', 'override', 'collected', 'envelope'];

const isCanonicalMoney = (value: unknown) => {
  const amount = parseMoney(value);
  return amount !== undefined && encodeMoney(amount) === value;
};

/** The problem with a stored cycle record, if any: turns already played, in order, with canonical amounts. */
function cycleDamage(state: ActivityState, definition: StrategyDefinition, cycle: unknown): string | undefined {
  if (!hasExactKeys(cycle, ['number', 'turns']) || !isCount(cycle.number) || cycle.number < 1 || !Array.isArray(cycle.turns)) return 'damaged strategy cycle';
  if (cycle.turns.length > 0 && !hasCycles(definition)) return 'damaged strategy cycle';
  let previous = 0;
  for (const turn of cycle.turns as unknown[]) {
    if (!hasExactKeys(turn, ['turn', 'wagers', 'outcome', 'net', 'followed']) || !isCount(turn.turn) || turn.turn <= previous || turn.turn > state.turn) return 'damaged strategy cycle';
    if (!isText(turn.outcome) || typeof turn.followed !== 'boolean' || !isCanonicalMoney(turn.net)) return 'damaged strategy cycle';
    const wagers = turn.wagers;
    if (!Array.isArray(wagers) || !wagers.every((wager) => hasExactKeys(wager, ['target', 'amount']) && isText(wager.target) && isCanonicalMoney(wager.amount))) {
      return 'damaged strategy cycle';
    }
    previous = turn.turn;
  }
  return undefined;
}

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
  if (run === null) return identity === null ? undefined : 'the strategy does not match its recorded identity';
  if (!hasExactKeys(run, RUN_KEYS) || !isPlain(run)) return 'damaged strategy';
  const definition = run.definition as StrategyDefinition;
  if (!isRecord(definition) || definition.game !== state.identities.game || !validateStrategy(definition).runnable) return 'the pinned strategy is not runnable';
  if (!identity || identity.id !== definition.id || identity.version !== definition.revision) return 'the strategy does not match its recorded identity';
  if (parameterProblem(definition, run.parameters)) return 'damaged strategy parameters';
  if (!strategyTableCompatibility(definition, run.parameters, state.rules).compatible) return 'the strategy does not fit the pinned rules';
  const { status, cycleEnd } = run;
  if (status !== 'active' && status !== 'cycle-ended' && status !== 'stopped') return 'damaged strategy status';
  const ended = CYCLE_ENDS.includes(cycleEnd);
  if ((status === 'cycle-ended') !== ended || (!ended && cycleEnd !== null)) return 'damaged strategy cycle';
  if (state.phase === 'cycle-completion' && status !== 'cycle-ended') return 'damaged strategy cycle';
  const progress = progressProblem(definition, run.progress);
  if (progress) return progress;
  const deferred = run.deferred;
  // A waiting adjustment belongs to an active strategy and to a turn already played.
  const playedTurn = (turn: unknown) => isCount(turn) && turn >= 1 && turn <= state.turn;
  if (deferred !== null && (status !== 'active' || !hasExactKeys(deferred, ['turn', 'progress']) || !playedTurn(deferred.turn) || progressProblem(definition, deferred.progress))) {
    return 'damaged strategy adjustment';
  }
  const cycle = cycleDamage(state, definition, run.cycle);
  if (cycle) return cycle;
  if (typeof run.coachedTurn !== 'boolean' || (run.coachedTurn && !(status === 'active' && (state.phase === 'revealing-outcome' || state.phase === 'final-settlement')))) {
    return 'damaged strategy turn';
  }
  if (!isCount(run.decisions)) return 'damaged strategy decisions';
  const ids = new Set<string>();
  if (!Array.isArray(run.departures)) return 'damaged departure log';
  for (const departure of run.departures as unknown[]) {
    const play = isRecord(departure) && 'decision' in departure;
    const keys = ['id', 'turn', 'explanation', 'actual', 'resolution', ...(play ? ['decision'] : [])];
    if (!hasExactKeys(departure, keys) || !isText(departure.id) || ids.has(departure.id)) return 'damaged departure log';
    if (!isCount(departure.turn) || !isRecord(departure.explanation) || !(play ? isCount(departure.decision) && isMove(departure.actual) : Array.isArray(departure.actual))) return 'damaged departure log';
    if (departure.resolution !== 'retried' && departure.resolution !== 'overridden') return 'damaged departure log';
    ids.add(departure.id);
  }
  if (state.phase !== 'correction') return run.correction === null ? undefined : 'damaged correction';
  if (isRecord(run.correction) && 'decision' in run.correction) {
    // A held playing move is exactly what the pinned policy says about this decision.
    const actual = run.correction.actual;
    if (status !== 'active' || !isMove(actual)) return 'damaged correction';
    const assessment = gameStrategy(state).assessPlay?.(state, definition, moveCommand(actual)) as PlayAssessment<PlayExplanation, PlayMove, Command> | undefined;
    if (!assessment || assessment.follows) return 'damaged correction';
    const held: PlayCorrection = { id: `${state.activity.id}/departure/${state.sequence - 1}`, turn: state.turn, decision: run.decisions as number, explanation: assessment.explanation, actual: assessment.actual };
    return canonicalJson(run.correction) !== canonicalJson(held) || ids.has(held.id) ? 'damaged correction' : undefined;
  }
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
