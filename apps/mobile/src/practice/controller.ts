// Spec 1 Practice controller and session lifecycle
// docs/development.md Game rules spec 1 leaves open

import {
  advanceActivity,
  canonicalJson,
  ActivitySpecificationError,
  completedPracticeRecord,
  createActivity,
  decodeCheckpoint,
  encodeCheckpoint,
  INSURANCE_TARGET,
  isPlayCorrection,
  quarantineStatus,
  readPermittedView,
  stopCause,
  StrategySpecificationError,
  streamIdentityFromEntropy,
  type ActivitySpecification,
  type ActivityState,
  type BlackjackAction,
  type BlackjackActivityState,
  type BlackjackRuleSet,
  type Command,
  type CommandEnvelope,
  type DomainFact,
  type FieldPayout,
  type FundingSource,
  type GameId,
  type OddsCap,
  type PermittedView,
  type Phase,
  type CrapsRuleSet,
  type RouletteRuleSet,
  type RouletteWheel,
  type StopCause,
  type StrategySelection,
} from '@tableside/engine';
import { BLACKJACK_REFERENCE_IDENTITY, rouletteRules, standardCraps } from '@tableside/definitions';

import { PRACTICE_FUNDING_TERMS, type AccessDecision, type AccessDenial, type LifecycleEvent, type PhaseReport, type PracticeAdapters, type SetupTerms } from './adapters';
import type { AllowanceEffect, CommitOutcome, CommittedTransition, CompletedPracticeSession, IncompleteReason, NewActivity, StoredActivity } from './store';

export const REVEAL_MS = 1500;
export const ENDING_STEP_MS = 1000;
export const SAVE_RETRY_MS = 5000;
// Spec 1 Amendment 4 A4
export const TIME_CHECKPOINT_MS = 1000;
export const TIME_USAGE = 'time-usage';

export type StartProblem = 'invalid-buy-in' | 'strategy-incompatible' | 'save-failed' | 'access-denied' | 'access-uncertain';

// Spec 1 Amendment 5 §1
export const RECONNECT_TO_VERIFY = 'Reconnect to verify access';

export type SuspendCause = 'navigation' | 'app-lifecycle' | 'sign-out' | 'interrupted' | 'access';

export interface Suspension {
  readonly cause: SuspendCause;
  readonly kind: 'immediate' | 'turn-boundary';
  readonly reached: boolean;
  readonly reason: string | null;
  readonly resumeBlocked: string | null;
  // Spec 1 Amendment 5 §3
  readonly canEnd: boolean;
  readonly waitsForPlayer: boolean;
  readonly endBlocked: string | null;
}

export type ActivePracticeSnapshot = Extract<PracticeSnapshot, { status: 'active' }>;

// #80
export interface IncompleteSessionSummary {
  readonly game: GameId;
  readonly buyIn: string;
  readonly fundingSource: FundingSource;
  readonly turnsRecorded: number | null;
  readonly engine: string | null;
  readonly reason: IncompleteReason;
  readonly explanation: string | null;
}

export type PracticeSnapshot =
  | { readonly status: 'loading' }
  | {
      readonly status: 'none';
      readonly problem: StartProblem | null;
      readonly problemReason: string | null;
      readonly busy: boolean;
    }
  | {
      readonly status: 'active';
      readonly view: PermittedView;
      readonly facts: readonly DomainFact[];
      readonly busy: boolean;
      readonly save: 'saved' | 'failed';
      readonly suspension: Suspension | null;
      readonly ending: AccessStop | null;
    }
  | { readonly status: 'completed'; readonly result: CompletedPracticeSession }
  | { readonly status: 'incomplete'; readonly session: IncompleteSessionSummary }
  | { readonly status: 'needs-update'; readonly game: GameId };

export type ActiveSnapshot<V extends PermittedView = PermittedView> = Extract<PracticeSnapshot, { status: 'active' }> & { readonly view: V };

interface StartRequestBase {
  readonly buyIn: string;
  readonly fundingSource?: FundingSource;
  readonly strategy?: StrategySelection;
}

export type StartRequest =
  | (StartRequestBase & {
      readonly game: 'roulette';
      readonly wheel?: RouletteWheel;
      readonly limits?: RouletteRuleSet['limits'];
    })
  | (StartRequestBase & {
      readonly game: 'craps';
      readonly odds: OddsCap;
      readonly field?: FieldPayout;
      readonly limits?: CrapsRuleSet['limits'];
    })
  | (StartRequestBase & { readonly game: 'blackjack'; readonly rules: BlackjackRuleSet });

interface Outbound {
  readonly envelope: CommandEnvelope;
  readonly effects: readonly AllowanceEffect[];
}

type Pending = ({ readonly kind: 'transition' } & Outbound) | { readonly kind: 'completion' };

type CommitResult = 'committed' | 'adopted' | 'not-saved' | 'rejected';

const settled = (result: CommitResult) => result === 'committed' || result === 'adopted';

const TURN_PHASES: ReadonlySet<Phase> = new Set(['revealing-outcome']);

const turnInProgress = (state: ActivityState): boolean =>
  TURN_PHASES.has(state.phase) ||
  (state.identities.game === 'blackjack' && (state.phase === 'open-decision' || state.phase === 'correction') && (state as BlackjackActivityState).outcome?.active != null);

// Spec 1 Amendment 4 A4
const TIMED_PHASES: ReadonlySet<Phase> = new Set(['open-decision', 'revealing-outcome', 'settled-outcome']);

const RESUMES_ON_RETURN: ReadonlySet<SuspendCause> = new Set(['navigation', 'app-lifecycle']);

const resumesOnReturn = (suspension: Pick<Suspension, 'cause'>): boolean => RESUMES_ON_RETURN.has(suspension.cause);

export type AccessStop = Extract<StopCause, 'access-ended' | 'content-removed'>;
const ACCESS_STOPS: ReadonlySet<StopCause> = new Set<AccessStop>(['access-ended', 'content-removed']);
const isAccessStop = (cause: StopCause | null): cause is AccessStop => cause !== null && ACCESS_STOPS.has(cause);

const UNANSWERED: AccessDenial = { status: 'uncertain', provenance: 'unanswered', disposition: 'suspend-at-turn-boundary' };

const CANT_RESUME = "This practice session can't resume right now.";
const CHECK_FAILED = "Couldn't check whether this practice session can end. Try again.";

export class PracticeController {
  private current: PracticeSnapshot = { status: 'loading' };
  private readonly listeners = new Set<() => void>();
  private activity: StoredActivity | null = null;
  private state: ActivityState | null = null;
  private facts: readonly DomainFact[] = [];
  private busy = false;
  private working: Promise<void> | null = null;
  private pending: Pending | null = null;
  private suspension: Suspension | null = null;
  private stopping: StopCause | null = null;
  private resumeQueued = false;
  private suspends = 0;
  private lastReport: string | null = null;
  private retryFor: Pending | readonly AllowanceEffect[] | null = null;
  private unacknowledgedStart: { request: StartRequest; activity: NewActivity } | null = null;
  private meter: { readonly activityId: string; readonly grant: string; since: number } | null = null;
  private timeIndex: number | null = null;
  private unsavedTime: readonly AllowanceEffect[] | null = null;

  constructor(private readonly adapters: PracticeAdapters) {}

  snapshot = (): PracticeSnapshot => this.current;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async load(): Promise<void> {
    await this.exclusive(async () => {
      const stored = await this.adapters.store.findUnfinished();
      if (!stored) return this.showNone(null);
      if (await this.openUnfinished(stored)) this.suspendNow('interrupted', null);
    });
  }

  async setupTerms(game: string): Promise<SetupTerms> {
    const { access } = this.adapters;
    if (!access.setupTerms) return PRACTICE_FUNDING_TERMS;
    return access.setupTerms({ game }).catch(() => PRACTICE_FUNDING_TERMS);
  }

  // Spec 1 Durability step 1
  async start(requested: StartRequest): Promise<void> {
    const request = { ...requested, fundingSource: requested.fundingSource ?? 'practice-funding' };
    await this.exclusive(async () => {
      let unfinished: StoredActivity | null;
      try {
        unfinished = await this.adapters.store.findUnfinished();
      } catch {
        return this.showNone('save-failed');
      }
      if (unfinished) {
        this.unacknowledgedStart = null;
        if (!(await this.openUnfinished(unfinished))) return;
        this.suspendNow('interrupted', null);
        return this.resumeSuspended();
      }

      const access = await this.adapters.access.beforeActivity({ game: request.game }).catch((): AccessDenial => UNANSWERED);
      if (access.status !== 'allowed') {
        return access.status === 'uncertain' ? this.showNone('access-uncertain') : this.showNone('access-denied', access.reason ?? null);
      }
      const admission = {
        provenance: access.provenance,
        meteringBasis: access.meteringBasis,
        ...(access.allowancePolicyVersion === undefined ? {} : { allowancePolicyVersion: access.allowancePolicyVersion }),
        ...(access.timeGrant === undefined ? {} : { timeGrant: access.timeGrant }),
      };

      let activity: NewActivity;
      const retry = this.unacknowledgedStart;
      if (retry && sameRequest(retry.request, request) && sameAdmission(retry.activity.admission, admission)) {
        activity = retry.activity;
      } else {
        const activityId = this.adapters.newId();
        const random = streamIdentityFromEntropy(this.adapters.entropy);
        const base = {
          activityId,
          owner: this.adapters.owner,
          device: this.adapters.device,
          strategy: request.strategy ? { definition: request.strategy.definition, parameters: { ...request.strategy.parameters } } : null,
          reference: request.game === 'blackjack' && request.strategy ? { ...BLACKJACK_REFERENCE_IDENTITY } : null,
          fundingSource: request.fundingSource,
          funding: request.buyIn,
        };
        const specification = { ...base, ...rulesOf(request) } as ActivitySpecification;
        let initial: ActivityState;
        try {
          initial = createActivity(specification, random);
        } catch (error) {
          if (error instanceof StrategySpecificationError) return this.showNone('strategy-incompatible');
          if (error instanceof ActivitySpecificationError) return this.showNone('invalid-buy-in');
          throw error;
        }
        activity = { activityId, admission, specification, random, checkpoint: encodeCheckpoint(initial), createdAt: this.adapters.clock.now() };
      }

      let stored: StoredActivity | null;
      try {
        stored = await this.adapters.store.createActivity(activity);
      } catch {
        stored = await this.adapters.store.load(activity.activityId).catch(() => null);
      }
      if (!stored) {
        this.unacknowledgedStart = { request, activity };
        return this.showNone('save-failed');
      }
      this.unacknowledgedStart = null;
      this.adopt(stored, [], stored.sequence === 0 ? 0 : null);
    });
  }

  async placeWager(target: string, amount: string): Promise<void> {
    await this.exclusive(async () => {
      if (!this.playOpen()) return;
      if (settled(await this.send({ kind: 'place-wager', target, amount }))) await this.drive();
    });
  }

  async setWorking(target: string, working: boolean): Promise<void> {
    await this.exclusive(async () => {
      if (!this.playOpen()) return;
      if (settled(await this.send({ kind: 'set-working', target, working }))) await this.drive();
    });
  }

  async beginTurn(): Promise<void> {
    await this.exclusive(() => this.turnCommand({ kind: 'begin-turn' }));
  }

  async retryCorrection(): Promise<void> {
    if (this.heldPlay()) return this.handAction({ kind: 'retry-correction' });
    await this.exclusive(async () => {
      if (!this.playOpen()) return;
      if (settled(await this.send({ kind: 'retry-correction' }))) await this.drive();
    });
  }

  async overrideCorrection(): Promise<void> {
    if (this.heldPlay()) return this.handAction({ kind: 'override-correction' });
    await this.exclusive(() => this.turnCommand({ kind: 'override-correction' }));
  }

  private heldPlay(): boolean {
    const correction = this.state?.strategy?.correction;
    return this.state?.phase === 'correction' && correction != null && isPlayCorrection(correction);
  }

  async restartCycle(): Promise<void> {
    await this.exclusive(async () => {
      if (!this.playOpen()) return;
      if (settled(await this.send({ kind: 'restart-cycle' }))) await this.drive();
    });
  }

  async collectInstead(): Promise<void> {
    await this.exclusive(async () => {
      if (!this.playOpen()) return;
      if (settled(await this.send({ kind: 'collect-instead' }))) await this.drive();
    });
  }

  async stopStrategy(): Promise<void> {
    await this.exclusive(async () => {
      if (!this.playOpen()) return;
      if (settled(await this.send({ kind: 'stop-strategy' }))) await this.drive();
    });
  }

  private async turnCommand(command: Command): Promise<void> {
    {
      if (!this.playOpen() || this.pending) return;
      const state = this.requireState();
      const candidate = advanceActivity(state, { sequence: state.sequence, commandId: `${state.activity.id}/${state.sequence}`, command });
      if (candidate.status === 'committed' && candidate.state.turn === state.turn) {
        if (settled(await this.send(command))) await this.drive();
        return;
      }
      // Spec 1 Amendment 5 §1
      const access = await this.adapters.access.beforeTurn({ activityId: state.activity.id, turn: state.turn + 1, strategy: state.identities.strategy }).catch((): AccessDenial => UNANSWERED);
      if (access.status !== 'allowed') {
        this.applyDenial(access);
        return this.drive();
      }
      if (!this.playOpen()) return this.drive();
      // Spec 1 Amendment 4 A3
      const charge = access.turnCharge;
      const effects: AllowanceEffect[] = charge
        ? [{ effectId: { grant: charge.grant, activity: state.activity.id, sequence: state.sequence }, kind: 'turn-charge', amount: charge.amount }]
        : [];
      if (settled(await this.send(command, effects))) await this.drive();
    }
  }

  async rebuy(amount: string): Promise<void> {
    await this.exclusive(async () => {
      if (!this.playOpen()) return;
      if (settled(await this.send({ kind: 'rebuy', amount }))) await this.drive();
    });
  }

  spin = (): Promise<void> => this.beginTurn();

  async play(action: BlackjackAction): Promise<void> {
    await this.handAction({ kind: 'play', action });
  }

  async insure(amount: string): Promise<void> {
    await this.handAction({ kind: 'place-wager', target: INSURANCE_TARGET, amount });
  }

  private async handAction(command: Command): Promise<void> {
    await this.exclusive(async () => {
      if (this.suspension?.reached ?? false) return;
      if (this.suspension?.kind === 'immediate') return;
      if (settled(await this.send(command))) await this.drive();
    });
  }

  // Spec 1 Amendment 5 §3
  async endSession(cause: Exclude<StopCause, AccessStop> = 'stop'): Promise<void> {
    await this.exclusive(async () => {
      if (!this.state || this.current.status !== 'active') return;
      const suspension = this.suspension;
      if (suspension) {
        if (!suspension.canEnd) return;
        const gate = await this.adapters.access
          .beforeEndWhileSuspended({ activityId: this.state.activity.id })
          .catch(() => ({ status: 'blocked', reason: CHECK_FAILED }) as const);
        const now = this.suspension;
        if (!now?.canEnd) return this.publish();
        if (gate.status === 'blocked') {
          this.suspension = { ...now, endBlocked: gate.reason };
          return this.publish();
        }
        this.suspension = null;
      }
      if (this.state.phase === 'revealing-outcome') {
        if (!settled(await this.send(stopCommand(cause)))) return;
      } else {
        this.stopping ??= cause;
      }
      await this.drive();
    });
  }

  suspend(cause: 'navigation' | 'app-lifecycle' | 'sign-out' = 'navigation'): void {
    if (!this.state || this.current.status !== 'active') return;
    this.resumeQueued = false;
    this.suspends++;
    this.suspendNow(cause, null);
  }

  async resume(): Promise<void> {
    if (!this.suspension) return;
    if (this.busy) {
      this.resumeQueued = true;
      return;
    }
    await this.exclusive(() => this.resumeSuspended());
  }

  async resumeOnReturn(): Promise<void> {
    if (this.suspension && resumesOnReturn(this.suspension)) await this.resume();
  }

  async lifecycle(event: LifecycleEvent): Promise<void> {
    if (!this.state || this.current.status !== 'active') return;
    if (event === 'backgrounded') this.suspend('app-lifecycle');
    if (event === 'signed-out') this.suspend('sign-out');
    const activityId = this.state.activity.id;
    const decision = await this.adapters.access.onLifecycle({ activityId, event }).catch((): AccessDecision => ({ status: 'allowed', provenance: 'unanswered' }));
    if (decision.status === 'allowed' || this.state?.activity.id !== activityId || this.current.status !== 'active') return;
    this.applyDenial(decision);
    if (!this.busy) await this.exclusive(() => this.drive());
  }

  async accountSessionEnding(): Promise<void> {
    await this.lifecycle('signed-out');
    while (this.working) await this.working;
  }

  async retrySave(): Promise<void> {
    await this.exclusive(async () => {
      if (this.unsavedTime) {
        if (!(await this.retryTime())) return;
        if (!this.pending) return this.drive();
      }
      const pending = this.pending;
      if (!pending) return;
      if (pending.kind === 'completion') return this.complete();
      if (this.heldBack(pending)) {
        const recovered = await this.recover(pending);
        if (recovered !== 'not-saved') return this.drive();
        if (this.pendingIsUnknown) return;
        this.pending = null;
        const time = pending.effects.filter((effect) => effect.kind === TIME_USAGE);
        if (time.length > 0) await this.writeTime(time);
        this.publish();
        return this.drive();
      }
      if (settled(await this.retryTransition(pending))) await this.drive();
    });
  }

  private heldBack(pending: Outbound): boolean {
    if (this.suspension?.kind === 'immediate' || this.suspension?.reached) return true;
    if (!this.suspension && !isAccessStop(this.stopping)) return false;
    const state = this.requireState();
    const candidate = advanceActivity(state, pending.envelope);
    return candidate.status === 'committed' && candidate.state.turn !== state.turn;
  }

  dismissIncomplete(): void {
    if (this.current.status === 'incomplete') this.showNone(null);
  }

  dismissResult(): void {
    if (this.current.status !== 'completed' || this.busy) return;
    const { result } = this.current;
    this.activity = null;
    this.state = null;
    this.lastReport = null;
    this.showNone(null);
    this.adapters.leftFreshResult?.(result);
  }

  private async exclusive(run: () => Promise<unknown>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.publish();
    const working = run();
    this.working = working.then(
      () => undefined,
      () => undefined,
    );
    try {
      await working;
    } finally {
      this.working = null;
      this.busy = false;
      this.publish();
      // Spec 1 S1-09
      if (this.current.status === 'completed') this.notify();
      if (this.pending || this.unsavedTime) this.scheduleRetry();
      if (this.resumeQueued) {
        this.resumeQueued = false;
        void this.resume();
      }
    }
  }

  private playOpen(): boolean {
    return this.suspension === null && this.stopping === null;
  }

  private suspendNow(cause: SuspendCause, reason: string | null, kind: Suspension['kind'] = 'immediate'): void {
    const previous = this.suspension;
    if (previous) {
      if (kind === 'turn-boundary') return;
      if (resumesOnReturn({ cause })) {
        if (previous.kind === 'immediate') return;
        cause = previous.cause;
        reason = previous.reason;
      }
    }
    this.suspension = { cause, kind, reached: false, reason, resumeBlocked: null, canEnd: false, endBlocked: null, waitsForPlayer: false };
    this.refreshSuspension();
  }

  private refreshSuspension(): void {
    const suspension = this.suspension;
    if (!suspension || !this.state) return;
    const betweenTurns = !turnInProgress(this.state);
    const reached = suspension.kind === 'immediate' || betweenTurns;
    // Spec 1 Amendment 5 §3
    const canEnd = reached && betweenTurns;
    const waitsForPlayer = reached && (!resumesOnReturn(suspension) || suspension.resumeBlocked !== null);
    if (reached !== suspension.reached || canEnd !== suspension.canEnd || waitsForPlayer !== suspension.waitsForPlayer) {
      this.suspension = { ...suspension, reached, canEnd, waitsForPlayer };
    }
    this.publish();
  }

  private applyDenial(denial: AccessDenial): void {
    switch (denial.disposition) {
      case 'stop':
        this.stopping = denial.stopCause ?? 'access-ended';
        return this.publish();
      case 'suspend':
        return this.suspendNow('access', denial.reason ?? null);
      case 'suspend-at-turn-boundary':
        return this.suspendNow('access', denial.reason ?? null, 'turn-boundary');
    }
  }

  // Spec 1 Amendment 5 §2
  private async resumeSuspended(): Promise<void> {
    const suspension = this.suspension;
    const state = this.state;
    if (!suspension || !state) return;
    const suspends = this.suspends;
    const decision = await this.adapters.access
      .beforeResume({ activityId: state.activity.id, phase: state.phase })
      .catch((): AccessDecision => UNANSWERED);
    if (this.suspension !== suspension || this.suspends !== suspends) return;
    if (decision.status !== 'allowed') {
      const resumeBlocked = decision.status === 'uncertain' ? RECONNECT_TO_VERIFY : (decision.reason ?? CANT_RESUME);
      this.suspension = { ...suspension, resumeBlocked };
      if (decision.disposition === 'stop') this.stopping = decision.stopCause ?? 'access-ended';
      return this.refreshSuspension();
    }
    this.suspension = null;
    this.publish();
    await this.drive();
  }

  private scheduleRetry(): void {
    const failed = this.pending ?? this.unsavedTime;
    if (!failed || this.retryFor === failed) return;
    this.retryFor = failed;
    void this.adapters.clock
      .sleep(SAVE_RETRY_MS)
      .then(() => {
        if (this.retryFor !== failed) return;
        this.retryFor = null;
        return this.retrySave();
      })
      .catch(() => undefined);
  }

  private async drive(): Promise<void> {
    for (;;) {
      if (this.pending) return;
      const phase = this.requireState().phase;
      if (this.suspension) {
        this.refreshSuspension();
        if (this.suspension.reached) return;
      }
      if (phase === 'revealing-outcome') {
        await this.adapters.clock.sleep(REVEAL_MS);
        if (this.suspension?.kind === 'immediate') return;
        if (!settled(await this.send({ kind: 'settle-turn' }))) return;
      } else if (phase === 'final-settlement') {
        await this.adapters.clock.sleep(ENDING_STEP_MS);
        if (this.suspension) return;
        if (!settled(await this.send({ kind: 'advance-final-settlement' }))) return;
      } else if (phase === 'completed') {
        await this.complete();
        return;
      } else if (this.stopping && !turnInProgress(this.requireState())) {
        if (!settled(await this.send(stopCommand(this.stopping)))) return;
      } else if (phase === 'strategy-settlement') {
        await this.adapters.clock.sleep(ENDING_STEP_MS);
        if (this.suspension) return;
        if (!settled(await this.send({ kind: 'advance-strategy-settlement' }))) return;
      } else {
        return;
      }
    }
  }

  // Spec 1 Durability steps 2–4
  private async send(command: Command, effects: readonly AllowanceEffect[] = []): Promise<CommitResult> {
    if (this.pending || this.unsavedTime) return 'not-saved';
    const state = this.requireState();
    const time = this.takeTime();
    return this.commit({ envelope: { sequence: state.sequence, commandId: `${state.activity.id}/${state.sequence}`, command }, effects: time ? [...effects, time] : effects });
  }

  private async commit(outbound: Outbound): Promise<CommitResult> {
    const state = this.requireState();
    const result = advanceActivity(state, outbound.envelope);
    if (result.status !== 'committed') return 'rejected';
    let outcome: CommitOutcome;
    try {
      outcome = await this.adapters.store.commitTransition({
        activityId: state.activity.id,
        priorSequence: state.sequence,
        checkpoint: encodeCheckpoint(result.state),
        receipt: result.receipt,
        facts: result.facts,
        effects: outbound.effects,
      });
    } catch {
      return this.recover(outbound);
    }
    if (outcome.status === 'sequence-conflict') return this.adoptStored(outbound);
    if (outcome.status === 'already-committed') return this.acceptStored(outbound, outcome.transition);
    this.accept(result.state, result.facts);
    return 'committed';
  }

  private async retryTransition(outbound: Outbound): Promise<CommitResult> {
    const recovered = await this.recover(outbound);
    if (recovered !== 'not-saved' || this.pendingIsUnknown) return recovered;
    return this.commit(outbound);
  }

  private pendingIsUnknown = false;

  private async recover(outbound: Outbound): Promise<CommitResult> {
    const { store } = this.adapters;
    const activityId = this.requireState().activity.id;
    let found: CommittedTransition | null;
    try {
      found = await store.readReceipt(activityId, outbound.envelope.commandId);
      this.pendingIsUnknown = false;
    } catch {
      found = null;
      this.pendingIsUnknown = true;
    }
    if (found === null) {
      this.pending = { kind: 'transition', ...outbound };
      this.publish();
      return 'not-saved';
    }
    return this.acceptStored(outbound, found);
  }

  private async acceptStored(outbound: Outbound, found: CommittedTransition): Promise<CommitResult> {
    const state = this.requireState();
    const activityId = state.activity.id;
    const candidate = advanceActivity(state, outbound.envelope);
    if (candidate.status !== 'committed' || found.receipt.command !== candidate.receipt.command) return this.adoptStored(outbound);
    const decoded = decodeCheckpoint(found.checkpoint);
    if (!decoded.ok) throw new Error(`activity ${activityId} has a damaged checkpoint: ${decoded.error.message}`);
    this.accept(decoded.state, found.facts);
    return 'committed';
  }

  private async adoptStored(outbound: Outbound): Promise<CommitResult> {
    const stored = await this.adapters.store.load(this.requireState().activity.id).catch(() => null);
    if (!stored) {
      this.pending = { kind: 'transition', ...outbound };
      this.pendingIsUnknown = true;
      this.publish();
      return 'not-saved';
    }
    const { suspension, stopping } = this;
    this.adopt(stored, []);
    this.suspension = suspension;
    this.stopping ??= stopping;
    this.refreshSuspension();
    return 'adopted';
  }

  private accept(state: ActivityState, facts: readonly DomainFact[]): void {
    this.pending = null;
    this.pendingIsUnknown = false;
    this.state = state;
    this.facts = facts;
    this.publish();
  }

  // Spec 1 Durability step 5
  private async complete(): Promise<boolean> {
    const state = this.requireState();
    const activity = this.activity;
    if (!activity) throw new Error('no practice session is active');
    let record: CompletedPracticeSession;
    try {
      const transitions = await this.adapters.store.readTransitions(activity.activityId);
      record = completedPracticeRecord(
        state,
        transitions.flatMap((transition) => transition.facts),
        {
          startedAt: activity.createdAt,
          endedAt: this.adapters.clock.now(),
          meteringBasis: activity.admission.meteringBasis,
          allowancePolicyVersion: activity.admission.allowancePolicyVersion ?? null,
        },
      );
    } catch {
      this.pending = { kind: 'completion' };
      this.publish();
      return false;
    }
    let result: CompletedPracticeSession | null;
    try {
      result = await this.adapters.store.complete(record);
    } catch {
      result = (await this.adapters.store.load(record.activityId).catch(() => null))?.completion ?? null;
    }
    if (!result) {
      this.pending = { kind: 'completion' };
      this.publish();
      return false;
    }
    this.pending = null;
    this.suspension = null;
    this.stopping = null;
    this.current = { status: 'completed', result };
    this.report({ activityId: result.activityId, phase: 'completed', suspended: false, timed: false });
    this.notify();
    return true;
  }

  // #80
  private async openUnfinished(stored: StoredActivity): Promise<boolean> {
    const decoded = decodeCheckpoint(stored.checkpoint);
    const game = stored.specification.game;
    this.activity = null;
    this.state = null;
    if (!decoded.ok && decoded.error.kind === 'unsupported') {
      this.current = { status: 'needs-update', game };
      this.notify();
      return false;
    }
    const quarantine = decoded.ok ? quarantineStatus(decoded.state, this.adapters.quarantine) : null;
    const reason: IncompleteReason | null = !decoded.ok
      ? { kind: 'damaged', detail: decoded.error.message }
      : quarantine?.quarantined
        ? { kind: 'quarantined', entry: quarantine.entry, listVersion: this.adapters.quarantine.version }
        : null;
    if (!reason) {
      this.adopt(stored, []);
      return true;
    }
    const marked = (await this.adapters.store.markIncomplete(stored.activityId, reason).catch(() => null))?.incomplete ?? reason;
    this.current = {
      status: 'incomplete',
      session: {
        game,
        buyIn: stored.specification.funding,
        fundingSource: stored.specification.fundingSource,
        turnsRecorded: decoded.ok ? decoded.state.turn : null,
        engine: decoded.ok ? decoded.state.identities.engine : null,
        reason: marked,
        explanation: this.explanationOf(marked),
      },
    };
    this.notify();
    return false;
  }

  private explanationOf(reason: IncompleteReason): string | null {
    if (reason.kind !== 'quarantined') return null;
    return this.adapters.quarantine.entries.find((entry) => entry.id === reason.entry)?.explanation ?? null;
  }

  private adopt(stored: StoredActivity, facts: readonly DomainFact[], timeIndex: number | null = null): void {
    const decoded = decodeCheckpoint(stored.checkpoint);
    if (!decoded.ok) throw new Error(`activity ${stored.activityId} can't be resumed: ${decoded.error.message}`);
    if (this.activity?.activityId !== stored.activityId) {
      this.meter = null;
      this.unsavedTime = null;
      this.timeIndex = timeIndex;
    }
    this.activity = stored;
    this.state = decoded.state;
    this.facts = facts;
    this.pending = null;
    this.suspension = null;
    this.stopping = decoded.state.phase === 'final-settlement' ? stopCause(decoded.state) : null;
    this.publish();
  }

  // Spec 1 Amendment 4 A4
  private timeWhile(timed: boolean): void {
    const admission = this.activity?.admission;
    const grant = admission?.meteringBasis === 'time' ? admission.timeGrant : undefined;
    if (timed && grant && this.activity && !this.meter) {
      const meter = { activityId: this.activity.activityId, grant, since: this.adapters.clock.now() };
      this.meter = meter;
      void this.checkpointEvery(meter);
    } else if (!timed && this.meter) {
      const time = this.takeTime();
      this.meter = null;
      if (time) void this.writeTime([time]);
    }
  }

  private async checkpointEvery(meter: NonNullable<PracticeController['meter']>): Promise<void> {
    while (this.meter === meter) {
      await this.adapters.clock.sleep(TIME_CHECKPOINT_MS);
      if (this.meter !== meter) return;
      if (this.timeIndex === null) {
        const recorded = await this.adapters.store.readEffects(meter.activityId).catch(() => null);
        if (recorded && this.timeIndex === null) this.timeIndex = recorded.filter((effect) => effect.kind === TIME_USAGE).length;
      }
      const time = this.takeTime();
      if (time) await this.writeTime([time]);
    }
  }

  private takeTime(): AllowanceEffect | null {
    const meter = this.meter;
    if (!meter || this.timeIndex === null) return null;
    const now = this.adapters.clock.now();
    const amount = now - meter.since;
    if (amount <= 0) return null;
    meter.since = now;
    const sequence = this.timeIndex++;
    return { effectId: { grant: meter.grant, activity: meter.activityId, sequence }, kind: TIME_USAGE, amount: String(amount) };
  }

  private async writeTime(effects: readonly AllowanceEffect[]): Promise<void> {
    const activityId = effects[0]?.effectId.activity;
    if (!activityId) return;
    try {
      await this.adapters.store.recordEffects(activityId, effects);
    } catch {
      if (this.activity?.activityId !== activityId) return;
      this.unsavedTime = [...(this.unsavedTime ?? []), ...effects];
      this.publish();
      if (!this.busy) this.scheduleRetry();
    }
  }

  private async retryTime(): Promise<boolean> {
    const unsaved = this.unsavedTime;
    const activityId = unsaved?.[0]?.effectId.activity;
    if (!unsaved || !activityId) return true;
    try {
      await this.adapters.store.recordEffects(activityId, unsaved);
    } catch {
      return false;
    }
    if (this.unsavedTime === unsaved) this.unsavedTime = null;
    this.publish();
    return true;
  }

  private requireState(): ActivityState {
    if (!this.state) throw new Error('no practice session is active');
    return this.state;
  }

  private showNone(problem: StartProblem | null, problemReason: string | null = null): void {
    this.current = { status: 'none', problem, problemReason, busy: this.busy };
    this.notify();
  }

  private publish(): void {
    if (this.current.status === 'completed') return;
    if (!this.state || !this.activity) {
      if (this.current.status === 'none') this.showNone(this.current.problem, this.current.problemReason);
      return;
    }
    const view = readPermittedView(this.state);
    this.current = {
      status: 'active',
      view,
      facts: this.facts,
      busy: this.busy,
      save: this.pending || this.unsavedTime ? 'failed' : 'saved',
      suspension: this.suspension,
      ending: isAccessStop(this.stopping) ? this.stopping : null,
    };
    const suspended = this.suspension?.reached ?? false;
    this.report({
      activityId: this.state.activity.id,
      phase: this.state.phase,
      suspended,
      timed: TIMED_PHASES.has(this.state.phase) && !view.strategy?.pending && !suspended && !this.pending && !this.unsavedTime && this.stopping === null,
    });
    this.notify();
  }

  private report(report: PhaseReport): void {
    this.timeWhile(report.timed);
    const key = JSON.stringify(report);
    if (key === this.lastReport) return;
    this.lastReport = key;
    this.adapters.access.phaseChanged(report);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

const sameAdmission = (a: NewActivity['admission'], b: NewActivity['admission']) =>
  a.provenance === b.provenance && a.meteringBasis === b.meteringBasis && a.allowancePolicyVersion === b.allowancePolicyVersion && a.timeGrant === b.timeGrant;

const stopCommand = (cause: StopCause): Command => (cause === 'stop' ? { kind: 'request-stop' } : { kind: 'request-stop', cause });

function rulesOf(request: StartRequest): Pick<ActivitySpecification, 'game' | 'rules'> {
  switch (request.game) {
    case 'craps':
      return { game: 'craps', rules: standardCraps(request.odds, request.field, request.limits) };
    case 'blackjack':
      return { game: 'blackjack', rules: request.rules };
    case 'roulette':
      return { game: 'roulette', rules: rouletteRules(request.wheel ?? 'single-zero', request.limits) };
  }
}

function sameRequest(a: StartRequest, b: StartRequest): boolean {
  if (a.buyIn !== b.buyIn || a.fundingSource !== b.fundingSource) return false;
  if (canonicalJson(a.strategy ?? null) !== canonicalJson(b.strategy ?? null)) return false;
  return canonicalJson(rulesOf(a)) === canonicalJson(rulesOf(b));
}
