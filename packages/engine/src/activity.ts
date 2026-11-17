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
import type { BlackjackDeviation, PlayExplanation, PlayMove } from './blackjack-strategy';
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

export const STATE_SCHEMA_VERSION = 8 as const;

interface SpecificationBase {
  readonly activityId: string;
  readonly owner: string;
  readonly device: string;
  readonly strategy: StrategySelection | null;
  readonly reference: VersionedIdentity | null;
  readonly fundingSource: FundingSource;
  readonly funding: string;
}

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

export type ActivitySpecification = RouletteActivitySpecification | CrapsActivitySpecification | BlackjackActivitySpecification;

export type GameId = ActivitySpecification['game'];

export type Phase =
  | 'open-decision'
  | 'correction'
  | 'revealing-outcome'
  | 'settled-outcome'
  | 'cycle-completion'
  | 'strategy-settlement'
  | 'final-settlement'
  | 'completed';

export interface Wager {
  readonly target: string;
  readonly amount: string;
}

export interface Receipt {
  readonly commandId: string;
  readonly sequence: number;
  readonly command: string;
  readonly disposition: 'applied' | 'assessed';
}

export interface BetCorrection {
  readonly id: string;
  readonly turn: number;
  readonly explanation: Explanation;
  readonly actual: readonly Wager[];
}

export interface PlayCorrection {
  readonly id: string;
  readonly turn: number;
  readonly decision: number;
  readonly explanation: PlayExplanation;
  readonly actual: PlayMove;
}

export type PendingCorrection = BetCorrection | PlayCorrection;

export const isPlayCorrection = (correction: PendingCorrection): correction is PlayCorrection => 'decision' in correction;

export type StrategyDeparture = PendingCorrection & { readonly resolution: 'retried' | 'overridden' };
export type CycleEnd = 'completed' | 'cap' | 'stop' | 'override' | 'collected' | 'envelope';

export interface CycleTurn {
  readonly turn: number;
  readonly wagers: readonly Wager[];
  readonly outcome: string;
  readonly net: string;
  readonly followed: boolean;
}

export interface AdherenceMeasure {
  readonly decisions: number;
  readonly followed: number;
}

export interface StrategyRun extends StrategySelection {
  readonly status: 'active' | 'cycle-ended' | 'stopped';
  readonly cycleEnd: CycleEnd | null;
  readonly progress: StrategyProgress;
  readonly deferred: { readonly turn: number; readonly progress: StrategyProgress } | null;
  readonly cycle: { readonly number: number; readonly turns: readonly CycleTurn[] };
  readonly coachedTurn: boolean;
  readonly correction: PendingCorrection | null;
  readonly departures: readonly StrategyDeparture[];
  readonly decisions: { readonly betting: number; readonly playing: number };
}

export interface PendingStrategyAction {
  readonly reason: PauseReason;
  readonly unavailable: readonly PrescribedBet[];
  readonly cap?: string;
  readonly turn?: number;
}

export interface StrategyView {
  readonly id: string;
  readonly revision: number;
  readonly name: string;
  readonly parameters: readonly { readonly id: string; readonly label: string; readonly value: string }[];
  readonly status: StrategyRun['status'];
  readonly cycleEnd: StrategyRun['cycleEnd'];
  readonly cycle: { readonly number: number; readonly net: string; readonly turns: readonly CycleTurn[] };
  readonly pending: PendingStrategyAction | null;
  readonly exhaustion: PendingStrategyAction | null;
  readonly correction: PendingCorrection | null;
  readonly departures: readonly StrategyDeparture[];
  readonly adherence: { readonly betting: AdherenceMeasure | null; readonly playing: AdherenceMeasure | null; readonly departures: number };
  readonly overrideAffected: boolean;
  readonly overrideEndsCycle: boolean;
}

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
  readonly sequence: number;
  readonly phase: Phase;
  readonly turn: number;
  readonly balance: string;
  readonly funding: Funding;
  readonly wagers: readonly Wager[];
  readonly strategy: StrategyRun | null;
  readonly random: RandomStreamState;
  readonly receipts: readonly Receipt[];
}

export type ActivityState = RouletteActivityState | CrapsActivityState | BlackjackActivityState;

export type StateOf<G extends GameId> = Extract<ActivityState, { readonly identities: { readonly game: G } }>;

// Spec 1 Amendment 6 §2, §5
export type StopCause = 'stop' | 'reset' | 'switch' | 'access-ended' | 'content-removed';

export const STOP_CAUSES: readonly StopCause[] = ['stop', 'reset', 'switch', 'access-ended', 'content-removed'];

export type Command =
  | { readonly kind: 'place-wager'; readonly target: string; readonly amount: string }
  | { readonly kind: 'set-working'; readonly target: string; readonly working: boolean }
  | { readonly kind: 'begin-turn' }
  | { readonly kind: 'play'; readonly action: BlackjackAction }
  | { readonly kind: 'settle-turn' }
  | { readonly kind: 'request-stop'; readonly cause?: StopCause }
  | { readonly kind: 'advance-final-settlement' }
  | { readonly kind: 'rebuy'; readonly amount: string }
  | { readonly kind: 'retry-correction' }
  | { readonly kind: 'override-correction' }
  | { readonly kind: 'restart-cycle' }
  | { readonly kind: 'collect-instead' }
  | { readonly kind: 'stop-strategy' }
  | { readonly kind: 'advance-strategy-settlement' };

export type StrategyCommandKind = 'retry-correction' | 'override-correction' | 'restart-cycle' | 'collect-instead' | 'stop-strategy' | 'advance-strategy-settlement';

export type GameCommand = Exclude<Command, { readonly kind: 'rebuy' | 'play' | 'set-working' | StrategyCommandKind }>;

export type CommandKind = Command['kind'];

export interface CommandEnvelope {
  readonly sequence: number;
  readonly commandId: string;
  readonly command: Command;
}

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
      readonly result: 'win' | 'loss' | 'push' | 'returned';
      readonly net: string;
      readonly returned: string;
      readonly component?: number;
      readonly commission?: string;
    }
  | { readonly kind: 'stop-requested'; readonly phase: Phase }
  | { readonly kind: 'wager-returned'; readonly target: string; readonly amount: string }
  | { readonly kind: 'funding-added'; readonly amount: string; readonly cumulative: string; readonly balance: string }
  | { readonly kind: 'activity-completed'; readonly balance: string }
  | ({ readonly kind: 'correction-offered'; readonly departureId: string; readonly turn: number } & (
      | { readonly explanation: Explanation; readonly actual: readonly Wager[] }
      | { readonly decision: number; readonly explanation: PlayExplanation; readonly actual: PlayMove }
    ))
  | { readonly kind: 'departure-recorded'; readonly departure: StrategyDeparture }
  | ({ readonly kind: 'strategy-paused' } & PendingStrategyAction)
  | { readonly kind: 'cycle-ended'; readonly reason: CycleEnd }
  | { readonly kind: 'strategy-resumed' }
  | { readonly kind: 'cycle-restarted' }
  | { readonly kind: 'strategy-stopped' }
  | CrapsDomainFact
  | BlackjackDomainFact;

export type RejectionReason = 'malformed' | 'stale' | 'not-legal-in-phase' | 'conflicting-command-id';

export type AdvanceResult<S extends ActivityState = ActivityState> =
  | { readonly status: 'committed'; readonly state: S; readonly facts: readonly DomainFact[]; readonly receipt: Receipt }
  | { readonly status: 'duplicate'; readonly receipt: Receipt }
  | { readonly status: 'rejected'; readonly reason: RejectionReason; readonly message: string };

export interface PermittedViewBase {
  readonly activityId: string;
  readonly phase: Phase;
  readonly sequence: number;
  readonly turn: number;
  readonly balance: string;
  readonly wagers: readonly Wager[];
  readonly wagersCommitted: boolean;
  readonly legalCommands: readonly CommandKind[];
  readonly funding: {
    readonly source: FundingSource;
    readonly buyIn: string;
    readonly rebuys: readonly string[];
    readonly cumulative: string;
    readonly headroom: string;
  };
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
  readonly outcome: BlackjackRoundView | null;
  readonly table: BlackjackTableView;
  readonly playActions: readonly BlackjackAction[];
  readonly insuranceOffer: BlackjackInsuranceOffer | null;
  readonly shoe: BlackjackShoeView;
  readonly count: BlackjackCount | null;
  readonly deviations: readonly BlackjackDeviation[];
}

export type PermittedView = RoulettePermittedView | CrapsPermittedView | BlackjackPermittedView;

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

export class StrategySpecificationError extends ActivitySpecificationError {
  constructor(message: string) {
    super(message);
    this.name = 'StrategySpecificationError';
  }
}

export type Change<S extends ActivityState> = Partial<Omit<S, 'schema' | 'activity' | 'identities' | 'rules' | 'sequence' | 'receipts'>>;

export type Step<S extends ActivityState> = { change: Change<S>; facts: DomainFact[] } | { illegal: IllegalActionReason };

export interface GameModule<S extends ActivityState, V extends PermittedView, C extends Exclude<Command, { readonly kind: 'rebuy' }> = GameCommand> {
  readonly ruleSets: readonly VersionedIdentity[];
  readonly extra: Omit<S, keyof ActivityStateBase<GameId> | 'rules' | 'outcome'>;
  pinRules(rules: Record<string, unknown>): S['rules'] | string;
  legal?(state: S, common: readonly CommandKind[]): readonly CommandKind[];
  apply(state: S, command: C): Step<S>;
  idleTurn?(state: S): Step<S>;
  settleContracts?(state: S): { change: Change<S>; facts: DomainFact[] };
  view(state: S): Omit<V, keyof PermittedViewBase> & Partial<Pick<PermittedViewBase, 'wagersCommitted'>>;
  strategyView?(state: S, view: StrategyView): StrategyView;
  damage(value: Record<string, unknown>): string | undefined;
  // Spec 6 Benchmark profiles
  turnExposure(rules: S['rules']): { readonly stake: Money; readonly payout: Money };
  readonly ownBetTarget?: string;
}

type AnyModule = GameModule<ActivityState, PermittedView, Exclude<Command, { readonly kind: 'rebuy' }>>;

const GAMES: Record<GameId, AnyModule> = {
  roulette: ROULETTE as unknown as AnyModule,
  craps: CRAPS as unknown as AnyModule,
  blackjack: BLACKJACK as unknown as AnyModule,
};

const gameFor = (game: unknown): AnyModule | undefined =>
  typeof game === 'string' && Object.hasOwn(GAMES, game) ? GAMES[game as GameId] : undefined;

const moduleOf = (state: ActivityState) => GAMES[state.identities.game];

export const gameModule = (game: GameId): AnyModule => GAMES[game];

export function strategyPlay(state: ActivityState): Command | undefined {
  const run = state.strategy;
  return run ? gameStrategy(state).followPlay?.(state, run.definition) : undefined;
}

function legalCommands(state: ActivityState): readonly CommandKind[] {
  const legal = GUIDED_PHASES.has(state.phase) ? LEGAL[state.phase] : (moduleOf(state).legal?.(state, LEGAL[state.phase]) ?? LEGAL[state.phase]);
  const running = state.strategy !== null && state.strategy.status !== 'stopped';
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
  correction: ['retry-correction', 'override-correction', 'request-stop'],
  'revealing-outcome': ['settle-turn', 'stop-strategy', 'request-stop'],
  'settled-outcome': ['place-wager', 'begin-turn', 'collect-instead', 'stop-strategy', 'request-stop', 'rebuy'],
  'cycle-completion': ['restart-cycle', 'stop-strategy', 'request-stop', 'rebuy'],
  'strategy-settlement': ['advance-strategy-settlement', 'request-stop'],
  'final-settlement': ['advance-final-settlement'],
  completed: [],
};

const GUIDED_PHASES: ReadonlySet<Phase> = new Set(['correction', 'cycle-completion', 'strategy-settlement']);

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
    case 'advance-strategy-settlement':
      return hasExactKeys(value, ['kind']);
    default:
      return false;
  }
}

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
    decisions: { betting: 0, playing: 0 },
  };
}

const reject = (reason: RejectionReason, message: string) => ({ status: 'rejected', reason, message }) as const;

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
    disposition: 'illegal' in step || guided?.assessed ? 'assessed' : 'applied',
  };
  const change = 'illegal' in step ? {} : step.change;
  const facts: DomainFact[] = 'illegal' in step ? [{ kind: 'illegal-action', command, reason: step.illegal }] : step.facts;
  const next = withDeferredResolved({ ...state, ...change } as S);
  const pending = pendingAction(next);
  const before = pendingAction(state);
  if (pending && canonicalJson(pending) !== canonicalJson(before)) facts.push({ kind: 'strategy-paused', ...pending });
  if (!pending && before && next.strategy?.status === 'active' && BETTING_DECISION_PHASES.has(next.phase)) facts.push({ kind: 'strategy-resumed' });
  return {
    status: 'committed',
    state: {
      ...next,
      funding: observeSessionValue(next.funding, sessionValue(next)),
      sequence: state.sequence + 1,
      receipts: [...state.receipts, receipt],
    },
    facts,
    receipt,
  };
}

function withDeferredResolved<S extends ActivityState>(state: S): S {
  const run = state.strategy;
  if (!run?.deferred || run.status !== 'active' || !BETTING_DECISION_PHASES.has(state.phase) || heldAction(state, run)) return state;
  return { ...state, strategy: { ...run, progress: run.deferred.progress, deferred: null } };
}

function resolveOutstanding(state: ActivityState, then: Phase): { change: Change<ActivityState>; facts: DomainFact[] } {
  const down = takeDown(state);
  const contracts = (down.change.wagers ?? []).length > 0;
  return { change: { ...down.change, phase: contracts ? 'strategy-settlement' : then }, facts: down.facts };
}

const settledNet = (facts: readonly DomainFact[]): Money =>
  facts.reduce((sum, fact) => (fact.kind === 'wager-settled' ? add(sum, decodeMoney(fact.net)) : sum), decodeMoney('0'));

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

type AnyStep = Step<ActivityState>;

const withStrategy = (step: AnyStep, strategy: StrategyRun, facts: DomainFact[] = []): AnyStep =>
  'illegal' in step ? step : { change: { ...step.change, strategy }, facts: [...facts, ...step.facts] };

function guidedStep(state: ActivityState, command: Exclude<Command, { readonly kind: 'rebuy' }>): { step: AnyStep; assessed: boolean } | undefined {
  const run = state.strategy;
  if (!run) return undefined;
  const game = moduleOf(state);
  const apply = (target: ActivityState, gameCommand: GameCommand) => game.apply(target, gameCommand);
  switch (command.kind) {
    case 'begin-turn': {
      if (run.status !== 'active' || leavesBetting(run.definition)) return undefined;
      const explanation = explain(state, run);
      if (state.wagers.length === 0) {
        if (explanation.prescription.status !== 'uncovered' || !game.idleTurn) return undefined;
        return { step: withStrategy(game.idleTurn(state), { ...run, coachedTurn: true, decisions: oneMoreDecision(run, 'betting') }), assessed: false };
      }
      if (!run.deferred && follows(explanation, state.wagers)) {
        return { step: withStrategy(apply(state, command), { ...run, coachedTurn: true, decisions: oneMoreDecision(run, 'betting') }), assessed: false };
      }
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
      if ('illegal' in applied) return { step: applied, assessed: false };
      if (assessment.follows) return { step: withStrategy(applied, { ...run, decisions: oneMoreDecision(run, 'playing') }), assessed: false };
      const correction: PlayCorrection = {
        id: `${state.activity.id}/departure/${state.sequence}`,
        turn: state.turn,
        decision: run.decisions.playing,
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
      const progression = overrideEndsCycle(run.definition);
      const strategy: StrategyRun = {
        ...run,
        progress: run.deferred?.progress ?? run.progress,
        deferred: null,
        status: progression ? 'cycle-ended' : 'active',
        cycleEnd: progression ? 'override' : null,
        coachedTurn: false,
        correction: null,
        departures: [...run.departures, departure],
        decisions: oneMoreDecision(run, 'betting'),
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
      const strategy: StrategyRun = { ...run, status: 'cycle-ended', cycleEnd: 'collected', deferred: null, coachedTurn: false };
      const outstanding = resolveOutstanding(state, 'cycle-completion');
      return {
        step: { change: { ...outstanding.change, strategy }, facts: [{ kind: 'cycle-ended', reason: 'collected' }, ...outstanding.facts] },
        assessed: false,
      };
    }
    case 'stop-strategy': {
      const strategy: StrategyRun = { ...run, status: 'stopped', cycleEnd: null, coachedTurn: false, deferred: null };
      const facts: DomainFact[] = [{ kind: 'strategy-stopped' }];
      // Spec 1 Amendment 9 §4
      let current = state;
      let settledChange: Change<ActivityState> = {};
      if (state.phase === 'revealing-outcome') {
        const settled = apply(state, { kind: 'settle-turn' });
        if ('illegal' in settled) return { step: settled, assessed: false };
        settledChange = settled.change;
        current = { ...state, ...settled.change } as ActivityState;
        facts.push(...settled.facts);
      }
      const outstanding = resolveOutstanding(current, current.phase === 'cycle-completion' ? 'settled-outcome' : current.phase);
      return { step: { change: { ...settledChange, ...outstanding.change, strategy }, facts: [...facts, ...outstanding.facts] }, assessed: false };
    }
    case 'advance-strategy-settlement': {
      const rolled = (game.settleContracts as NonNullable<AnyModule['settleContracts']>)(state);
      const after = { ...state, ...rolled.change } as ActivityState;
      let strategy = run;
      if (run.status === 'cycle-ended' && hasCycles(run.definition)) {
        const turn: CycleTurn = { turn: after.turn, wagers: state.wagers, outcome: gameStrategy(state).outcome(after), net: encodeMoney(settledNet(rolled.facts)), followed: true };
        strategy = { ...run, cycle: { ...run.cycle, turns: [...run.cycle.turns, turn] } };
      }
      const phase: Phase = after.wagers.length > 0 ? 'strategy-settlement' : run.status === 'cycle-ended' ? 'cycle-completion' : 'settled-outcome';
      return { step: { change: { ...rolled.change, phase, strategy }, facts: rolled.facts }, assessed: false };
    }
    case 'settle-turn': {
      const settled = apply(state, command);
      if ('illegal' in settled) return { step: settled, assessed: false };
      let strategy: StrategyRun = { ...run, coachedTurn: false };
      const net = settledNet(settled.facts);
      const after = { ...state, ...settled.change } as ActivityState;
      const overridden = run.status === 'cycle-ended' && run.cycleEnd === 'override';
      if (hasCycles(run.definition) && ((run.coachedTurn && run.status === 'active') || overridden)) {
        const turn: CycleTurn = { turn: state.turn, wagers: state.wagers, outcome: gameStrategy(state).outcome(after), net: encodeMoney(net), followed: !overridden };
        strategy = { ...strategy, cycle: { ...run.cycle, turns: [...run.cycle.turns, turn] } };
      }
      if (run.coachedTurn && run.status === 'active') {
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
          strategy = { ...strategy, deferred: { turn: state.turn, progress } };
        } else {
          strategy = { ...strategy, progress };
        }
      }
      if (strategy.status !== 'cycle-ended') return { step: { change: { ...settled.change, strategy }, facts: settled.facts }, assessed: false };
      const outstanding = resolveOutstanding(after, 'cycle-completion');
      return {
        step: { change: { ...settled.change, ...outstanding.change, strategy }, facts: [...settled.facts, ...outstanding.facts] },
        assessed: false,
      };
    }
    case 'request-stop':
      if (state.phase !== 'correction' && state.phase !== 'cycle-completion') return undefined;
      return { step: withStrategy(apply({ ...state, phase: 'open-decision' } as ActivityState, command), { ...run, correction: null }), assessed: false };
    default:
      return undefined;
  }
}

const oneMoreDecision = (run: StrategyRun, kind: keyof StrategyRun['decisions']) => ({ ...run.decisions, [kind]: run.decisions[kind] + 1 });

function wagerResults(wagers: readonly Wager[], facts: readonly DomainFact[]): Record<string, TurnResult> {
  const results: Record<string, TurnResult> = {};
  for (const wager of wagers) {
    let net: Money | undefined;
    for (const fact of facts) if (fact.kind === 'wager-settled' && fact.target === wager.target) net = add(net ?? decodeMoney('0'), decodeMoney(fact.net));
    results[wager.target] = net === undefined ? 'none' : net.n > 0n ? 'win' : net.n < 0n ? 'loss' : 'push';
  }
  return results;
}

const blocked = (action: PendingStrategyAction | null) => action !== null && (action.reason === 'unfunded-group' || action.reason === 'limit');

const leavesBetting = (definition: StrategyDefinition) => definition.instructions.length === 0;

function resolvePlay(state: ActivityState, run: StrategyRun, correction: PlayCorrection, resolution: StrategyDeparture['resolution']): AnyStep {
  const departure: StrategyDeparture = { ...correction, resolution };
  const move = resolution === 'retried' ? correction.explanation.prescribed : correction.actual;
  const applied = moduleOf(state).apply({ ...state, phase: 'open-decision' } as ActivityState, gameStrategy(state).playCommand?.(move) as GameCommand);
  const strategy: StrategyRun = { ...run, correction: null, departures: [...run.departures, departure], decisions: oneMoreDecision(run, 'playing') };
  return withStrategy(applied, strategy, [{ kind: 'departure-recorded', departure }]);
}

const gameStrategy = (state: ActivityState) => strategyGame(state.identities.game) as unknown as StrategyGame<ActivityState>;

// Spec 3 Lessons › Structure (worked examples); #155
export function explainStrategyBets(state: ActivityState): Explanation | null {
  return state.strategy ? explain(state, state.strategy) : null;
}

function explain(state: ActivityState, run: StrategyRun): Explanation {
  const game = gameStrategy(state);
  return prescribe(game.vocabulary, run, game.situation(state), run.deferred?.progress ?? run.progress);
}

function follows(explanation: Explanation, wagers: readonly Wager[]): boolean {
  const prescription = explanation.prescription;
  if (prescription.status !== 'prescribed') return wagers.length === 0;
  return (
    prescription.bets.length === wagers.length &&
    prescription.bets.every((bet) => wagers.some((wager) => wager.target === bet.target && compare(decodeMoney(wager.amount), decodeMoney(bet.amount)) === 0))
  );
}

const BETTING_DECISION_PHASES: ReadonlySet<Phase> = new Set(['open-decision', 'settled-outcome']);

function cycleEndAfter(state: ActivityState, definition: StrategyDefinition, progress: StrategyProgress): CycleEnd | null {
  const game = gameStrategy(state);
  if (cycleComplete(game.vocabulary, definition, game.situation(state), progress)) return 'completed';
  if (!overrideEndsCycle(definition)) return null;
  const prescription = explain(state, state.strategy as StrategyRun).prescription;
  return prescription.status === 'paused' && (prescription.reason === 'cap' || prescription.reason === 'stop') ? prescription.reason : null;
}

function pendingAction(state: ActivityState): PendingStrategyAction | null {
  const run = state.strategy;
  if (!run || run.status !== 'active' || leavesBetting(run.definition) || !BETTING_DECISION_PHASES.has(state.phase)) return null;
  if (gameStrategy(state).hidesPending?.(state)) return null;
  const held = heldAction(state, run);
  return held && run.deferred ? { ...held, turn: run.deferred.turn } : held;
}

export function strategyDecision(state: ActivityState): { readonly prescription: Explanation['prescription']; readonly held: PendingStrategyAction | null } | null {
  const run = state.strategy;
  if (!run) return null;
  return { prescription: explain(state, run).prescription, held: heldAction(state, run) };
}

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

const shownStrategy = (state: ActivityState, view: StrategyView): StrategyView => moduleOf(state).strategyView?.(state, view) ?? view;

function strategyView(state: ActivityState, run: StrategyRun): StrategyView {
  const { definition } = run;
  const departedTurns = new Set(run.departures.flatMap((departure) => (!isPlayCorrection(departure) && departure.turn <= state.turn ? [departure.turn] : [])));
  const departedPlays = new Set(run.departures.flatMap((departure) => (isPlayCorrection(departure) ? [departure.decision] : [])));
  const measure = (decisions: number, departed: number): AdherenceMeasure => ({ decisions, followed: decisions - departed });
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
    adherence: {
      betting: leavesBetting(definition) ? null : measure(run.decisions.betting, departedTurns.size),
      playing: definition.play === undefined ? null : measure(run.decisions.playing, departedPlays.size),
      departures: run.departures.length,
    },
    overrideAffected: run.departures.some((departure) => departure.resolution === 'overridden') || state.receipts.some((receipt) => receipt.command === COLLECT_INSTEAD),
    overrideEndsCycle: overrideEndsCycle(definition),
  };
}

// Spec 1 user story 51, Amendment 10 §2
const COLLECT_INSTEAD = canonicalJson({ kind: 'collect-instead' } satisfies Command);

const overrideEndsCycle = (definition: StrategyDefinition) =>
  definition.counters.length > 0 || (definition.lists ?? []).length > 0 || strategyGame(definition.game)?.vocabulary.overrideEndsCycle === true;

const hasCycles = (definition: StrategyDefinition) => overrideEndsCycle(definition) || definition.completeWhen != null;

const sessionValue = (state: Pick<ActivityState, 'balance' | 'wagers'>): Money =>
  state.wagers.reduce((sum, wager) => add(sum, decodeMoney(wager.amount)), decodeMoney(state.balance));

export function stopCause(state: ActivityState): StopCause {
  for (const receipt of [...state.receipts].reverse()) {
    const command = JSON.parse(receipt.command) as Command;
    if (command.kind === 'request-stop') return command.cause ?? 'stop';
  }
  return 'stop';
}

export function readPermittedView<S extends ActivityState>(state: S): ViewOf<S['identities']['game']>;
export function readPermittedView(state: ActivityState): PermittedView {
  return {
    activityId: state.activity.id,
    phase: state.phase,
    sequence: state.sequence,
    turn: state.turn,
    balance: state.balance,
    wagers: state.wagers.map((wager) => ({ target: wager.target, amount: wager.amount })),
    wagersCommitted: state.wagers.length > 0 && (state.phase === 'revealing-outcome' || state.phase === 'strategy-settlement' || state.phase === 'final-settlement'),
    legalCommands: [...legalCommands(state)],
    funding: {
      source: state.funding.source,
      buyIn: state.funding.buyIn,
      rebuys: [...state.funding.rebuys],
      cumulative: encodeMoney(cumulativeFunding(state.funding)),
      headroom: encodeMoney(fundingHeadroom(state.funding)),
    },
    strategy: state.strategy && shownStrategy(state, strategyView(state, state.strategy)),
    ...moduleOf(state).view(state),
  } as PermittedView;
}

export const encodeCheckpoint = (state: ActivityState): string => canonicalJson(state);

export const checkpointHash = (state: ActivityState): string => sha256Hex(encodeCheckpoint(state));

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

function isCanonicalCommand(text: unknown): boolean {
  if (typeof text !== 'string') return false;
  try {
    const command: unknown = JSON.parse(text);
    return isCommand(command) && canonicalJson(command) === text;
  } catch {
    return false;
  }
}

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
  const gameDamage = game.damage(GUIDED_PHASES.has(phase as Phase) ? { ...value, phase: 'open-decision' } : value);
  if (gameDamage) return gameDamage;
  if ((value.outcome === null) !== (turn === 0)) return 'the outcome does not match the turn count';
  const strategy = strategyDamage(value as unknown as ActivityState, identities.strategy as VersionedIdentity | null);
  if (strategy) return strategy;
  if (phase === 'cycle-completion' && (value.wagers as unknown[]).length > 0) return 'damaged cycle completion';
  if (phase === 'strategy-settlement' && ((value.wagers as unknown[]).length === 0 || takeDown(value as unknown as ActivityState).facts.length > 0)) {
    return 'damaged strategy settlement';
  }
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

const isMove = (value: unknown): value is PlayMove =>
  hasExactKeys(value, ['action', 'amount']) &&
  (value.action === 'insure' ? parseMoney(value.amount) !== undefined : isBlackjackAction(value.action) && value.amount === null);

const RUN_KEYS = ['definition', 'parameters', 'status', 'cycleEnd', 'progress', 'deferred', 'cycle', 'coachedTurn', 'correction', 'departures', 'decisions'];

const CYCLE_ENDS: readonly unknown[] = ['completed', 'cap', 'stop', 'override', 'collected', 'envelope'];

const isCanonicalMoney = (value: unknown) => {
  const amount = parseMoney(value);
  return amount !== undefined && encodeMoney(amount) === value;
};

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
  if (state.phase === 'strategy-settlement' && status === 'active') return 'damaged strategy settlement';
  const progress = progressProblem(definition, run.progress);
  if (progress) return progress;
  const deferred = run.deferred;
  const playedTurn = (turn: unknown) => isCount(turn) && turn >= 1 && turn <= state.turn;
  if (deferred !== null && (status !== 'active' || !hasExactKeys(deferred, ['turn', 'progress']) || !playedTurn(deferred.turn) || progressProblem(definition, deferred.progress))) {
    return 'damaged strategy adjustment';
  }
  const cycle = cycleDamage(state, definition, run.cycle);
  if (cycle) return cycle;
  if (typeof run.coachedTurn !== 'boolean' || (run.coachedTurn && !(status === 'active' && (state.phase === 'revealing-outcome' || state.phase === 'final-settlement')))) {
    return 'damaged strategy turn';
  }
  if (!hasExactKeys(run.decisions, ['betting', 'playing']) || !isCount(run.decisions.betting) || !isCount(run.decisions.playing)) return 'damaged strategy decisions';
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
    const actual = run.correction.actual;
    if (status !== 'active' || !isMove(actual)) return 'damaged correction';
    const assessment = gameStrategy(state).assessPlay?.(state, definition, gameStrategy(state).playCommand?.(actual)) as PlayAssessment<PlayExplanation, PlayMove, Command> | undefined;
    if (!assessment || assessment.follows) return 'damaged correction';
    const held: PlayCorrection = { id: `${state.activity.id}/departure/${state.sequence - 1}`, turn: state.turn, decision: (run.decisions as StrategyRun['decisions']).playing, explanation: assessment.explanation, actual: assessment.actual };
    return canonicalJson(run.correction) !== canonicalJson(held) || ids.has(held.id) ? 'damaged correction' : undefined;
  }
  const expected: PendingCorrection = {
    id: `${state.activity.id}/departure/${state.sequence - 1}`,
    turn: state.turn + 1,
    explanation: explain(state, run as unknown as StrategyRun),
    actual: state.wagers,
  };
  if (status !== 'active' || canonicalJson(run.correction) !== canonicalJson(expected) || ids.has(expected.id)) return 'damaged correction';
  return undefined;
}
