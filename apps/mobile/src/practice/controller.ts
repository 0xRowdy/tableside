// The practice controller: the only thing that advances a practice session.
// It asks the engine for each transition, commits it through the store port,
// and publishes the engine's permitted view only after the commit. It never
// decides legality, payouts or settlement; the engine does. Automatic steps
// (settling a revealed spin, final settlement, completion) are driven here,
// never by a tap or an animation callback.
//
// Access: the supervisor port is asked before a new activity, before each turn,
// before resuming and on lifecycle events. Its dispositions and the direct
// suspend live here, outside the engine, so suspending never adds a command:
// a suspended-then-resumed session commits exactly the trace it would have.
//
// Guided practice: the engine assesses each turn against the pinned strategy.
// A correction, a pending strategy action and a cycle completion all wait for
// the player; access is asked, and a turn charged, only for a transition that
// really begins a turn (a correction begins nothing).

import {
  advanceActivity,
  canonicalJson,
  ActivitySpecificationError,
  completedPracticeRecord,
  createActivity,
  decodeCheckpoint,
  encodeCheckpoint,
  readPermittedView,
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
  type FundingSource,
  type OddsCap,
  type PermittedView,
  type Phase,
  type RouletteWheel,
  type StopCause,
  type StrategySelection,
} from '@tableside/engine';
import { ROULETTE_PRESETS, standardCraps } from '@tableside/definitions';

import type { AccessDecision, AccessDenial, LifecycleEvent, PhaseReport, PracticeAdapters } from './adapters';
import type { AllowanceEffect, CommitOutcome, CommittedTransition, CompletedPracticeSession, NewActivity, StoredActivity } from './store';

/** How long the landed ball or the dice stay on screen before the automatic settle step. */
export const REVEAL_MS = 1500;
/** The pause between the ending steps, so each is seen and announced. */
export const ENDING_STEP_MS = 1000;
/** How long play stays paused after a failed save before it retries by itself. */
export const SAVE_RETRY_MS = 5000;

export type StartProblem = 'invalid-buy-in' | 'strategy-incompatible' | 'save-failed' | 'access-denied' | 'access-uncertain';

/** Shown whenever access can't be confirmed at a start or a resume (Amendment 5 A1). */
export const RECONNECT_TO_VERIFY = 'Reconnect to verify access';

/**
 * Why the session is suspended. "navigation", "app-lifecycle" and "sign-out"
 * are the direct suspend; "interrupted" is a session found unfinished at
 * launch; "access" is a supervisor disposition.
 */
export type SuspendCause = 'navigation' | 'app-lifecycle' | 'sign-out' | 'interrupted' | 'access';

export interface Suspension {
  readonly cause: SuspendCause;
  /** "immediate": paused in the committed phase. "turn-boundary": a turn in progress finishes first. */
  readonly kind: 'immediate' | 'turn-boundary';
  /** False while a turn-boundary suspend waits for the turn in progress to finish. */
  readonly reached: boolean;
  /** The supervisor's reason, for an access suspension. */
  readonly reason: string | null;
  /** Why the last resume was blocked; the activity is unchanged. */
  readonly resumeBlocked: string | null;
  /** End session works from here: suspended between turns, never mid-round (Amendment 5 A3). */
  readonly canEnd: boolean;
  /** The session waits for the player: coming back to the table won't lift this by itself, or a resume was refused. */
  readonly waitsForPlayer: boolean;
  /** Why the last End session was refused (spec 2's gate states). */
  readonly endBlocked: string | null;
}

export type ActivePracticeSnapshot = Extract<PracticeSnapshot, { status: 'active' }>;

export type PracticeSnapshot =
  | { readonly status: 'loading' }
  | {
      readonly status: 'none';
      readonly problem: StartProblem | null;
      /** The supervisor's reason for a denied start, if it gave one. */
      readonly problemReason: string | null;
      readonly busy: boolean;
    }
  | {
      readonly status: 'active';
      readonly view: PermittedView;
      /** Facts of the latest committed transition, for announcements. */
      readonly facts: readonly DomainFact[];
      /** True while a command or an automatic step is in flight; input waits. */
      readonly busy: boolean;
      /** "failed": the last transition isn't saved and play is paused until a retry succeeds. */
      readonly save: 'saved' | 'failed';
      /** Null while play is open. */
      readonly suspension: Suspension | null;
      /** "access-ended": the stop path runs because access or allowance ended. */
      readonly ending: 'access-ended' | null;
    }
  /** The result just produced and durably saved in this process. */
  | { readonly status: 'completed'; readonly result: CompletedPracticeSession };

export type ActiveSnapshot<V extends PermittedView = PermittedView> = Extract<PracticeSnapshot, { status: 'active' }> & { readonly view: V };

interface StartRequestBase {
  /** Whole units, as canonical decimal text: the buy-in, or the whole training bankroll allocated to the session. */
  readonly buyIn: string;
  /** Practice funding unless spec 5 starts the session from the training bankroll. */
  readonly fundingSource?: FundingSource;
  /** Guided practice: the strategy revision to pin, with the choices made at setup. Free play when omitted. */
  readonly strategy?: StrategySelection;
}

export type StartRequest =
  | (StartRequestBase & {
      readonly game: 'roulette';
      /** The wheel's rule preset; single zero when omitted. */
      readonly wheel?: RouletteWheel;
    })
  | (StartRequestBase & { readonly game: 'craps'; readonly odds: OddsCap })
  | (StartRequestBase & { readonly game: 'blackjack'; /** The chosen preset and penetration. */ readonly rules: BlackjackRuleSet });

/** A command as sent to the store, with the allowance effects that commit with it. */
interface Outbound {
  readonly envelope: CommandEnvelope;
  readonly effects: readonly AllowanceEffect[];
}

type Pending = ({ readonly kind: 'transition' } & Outbound) | { readonly kind: 'completion' };

/**
 * How a command ended. "committed": this command is durable and published.
 * "adopted": the store already held a later committed state, now shown instead.
 * "not-saved": nothing is known to be durable, so play pauses for a retry.
 * "rejected": the engine refused the envelope; nothing changed.
 */
type CommitResult = 'committed' | 'adopted' | 'not-saved' | 'rejected';

/** Whether automatic steps may carry on after a command. */
const settled = (result: CommitResult) => result === 'committed' || result === 'adopted';

/**
 * Phases in which a turn is under way: it finishes before a turn boundary is
 * reached, and a session suspended in one can't end until it resumes. A
 * roulette spin and a craps roll both run begin-turn → revealing-outcome →
 * settle-turn, so this one phase covers both; each game that adds phases (a
 * blackjack round) must list its mid-turn ones here.
 */
const TURN_PHASES: ReadonlySet<Phase> = new Set(['revealing-outcome']);

/**
 * True while a turn is under way. Roulette's turn is the spin (a TURN_PHASES
 * phase); a blackjack round is under way from the deal until it settles,
 * including while a hand awaits the player's decision in the open-decision phase.
 */
const turnInProgress = (state: ActivityState): boolean =>
  TURN_PHASES.has(state.phase) ||
  (state.identities.game === 'blackjack' && state.phase === 'open-decision' && (state as BlackjackActivityState).outcome?.active != null);

/** Phases whose time counts as active training (Amendment 4 A4); every other phase is excluded. */
const TIMED_PHASES: ReadonlySet<Phase> = new Set(['open-decision', 'revealing-outcome', 'settled-outcome']);

/** Suspensions that end by themselves when the player comes back to the table. */
const RESUMES_ON_RETURN: ReadonlySet<SuspendCause> = new Set(['navigation', 'app-lifecycle']);

/** Whether coming back to the table lifts this suspension by itself (it still asks the supervisor). */
const resumesOnReturn = (suspension: Pick<Suspension, 'cause'>): boolean => RESUMES_ON_RETURN.has(suspension.cause);

/** A supervisor question that failed to answer counts as uncertain access. */
const UNANSWERED: AccessDenial = { status: 'uncertain', provenance: 'unanswered', disposition: 'suspend-at-turn-boundary' };

const CANT_RESUME = "This session can't resume right now.";
const CHECK_FAILED = "Couldn't check whether this session can end. Try again.";

export class PracticeController {
  private current: PracticeSnapshot = { status: 'loading' };
  private readonly listeners = new Set<() => void>();
  private activity: StoredActivity | null = null;
  private state: ActivityState | null = null;
  private facts: readonly DomainFact[] = [];
  private busy = false;
  private pending: Pending | null = null;
  private suspension: Suspension | null = null;
  /** Set once the stop path must run, with its cause: the player's stop, reset or switch, or access ending. */
  private stopping: StopCause | null = null;
  /** A resume asked for while other work was in flight; it runs when that work ends. */
  private resumeQueued = false;
  /** Counts direct suspends, so a resume still being asked notices the player left again. */
  private suspends = 0;
  /** The last report given to the timed-metering hook, so only changes are reported. */
  private lastReport: string | null = null;
  /** The failed save the pending automatic retry is for, if one is waiting. */
  private retryFor: Pending | null = null;
  /** A start whose creation wasn't acknowledged, reused by the retry so it recovers the same activity. */
  private unacknowledgedStart: { request: StartRequest; activity: NewActivity } | null = null;

  constructor(private readonly adapters: PracticeAdapters) {}

  snapshot = (): PracticeSnapshot => this.current;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Finds the unfinished session, if any. It waits, suspended in its committed phase, until resumed. */
  async load(): Promise<void> {
    await this.exclusive(async () => {
      const stored = await this.adapters.store.findUnfinished();
      if (!stored) return this.showNone(null);
      this.adopt(stored, []);
      this.suspendNow('interrupted', null);
    });
  }

  /** Durability step 1: creates the activity and its random identity, then shows the table. */
  async start(requested: StartRequest): Promise<void> {
    const request = { ...requested, fundingSource: requested.fundingSource ?? 'practice-funding' };
    await this.exclusive(async () => {
      // One unfinished practice session at a time: resume it rather than start another.
      let unfinished: StoredActivity | null;
      try {
        unfinished = await this.adapters.store.findUnfinished();
      } catch {
        return this.showNone('save-failed');
      }
      if (unfinished) {
        this.unacknowledgedStart = null;
        this.adopt(unfinished, []);
        this.suspendNow('interrupted', null);
        return this.resumeSuspended();
      }

      // Uncertain or denied: nothing is created, drawn or charged.
      const access = await this.adapters.access.beforeActivity({ game: request.game }).catch((): AccessDenial => UNANSWERED);
      if (access.status !== 'allowed') {
        return access.status === 'uncertain' ? this.showNone('access-uncertain') : this.showNone('access-denied', access.reason ?? null);
      }
      const admission = {
        provenance: access.provenance,
        meteringBasis: access.meteringBasis,
        ...(access.allowancePolicyVersion === undefined ? {} : { allowancePolicyVersion: access.allowancePolicyVersion }),
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
          reference: null,
          fundingSource: request.fundingSource,
          funding: request.buyIn,
        };
        const specification: ActivitySpecification =
          request.game === 'craps'
            ? { ...base, game: 'craps', rules: standardCraps(request.odds) }
            : request.game === 'blackjack'
              ? { ...base, game: 'blackjack', rules: request.rules }
              : { ...base, game: 'roulette', rules: ROULETTE_PRESETS[wheelOf(request)] };
        let initial: ActivityState;
        try {
          initial = createActivity(specification, random);
        } catch (error) {
          // The engine judges whether the strategy runs at this table; setup explains why it doesn't.
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
      this.adopt(stored, []);
    });
  }

  /** Sets the total stake on a target; "0" takes the wager down. The engine judges legality. */
  async placeWager(target: string, amount: string): Promise<void> {
    await this.exclusive(async () => {
      if (!this.playOpen()) return;
      // A wager never starts an automatic step itself, but an adopted later state may.
      if (settled(await this.send({ kind: 'place-wager', target, amount }))) await this.drive();
    });
  }

  /**
   * Begins a turn (a spin, a roll or a deal); a turn that needs no decision
   * settles automatically after the reveal. In guided practice a departing
   * move stops at a correction instead.
   */
  async beginTurn(): Promise<void> {
    await this.exclusive(() => this.turnCommand({ kind: 'begin-turn' }));
  }

  /** From a correction: takes the move back and sets the strategy's bets. */
  async retryCorrection(): Promise<void> {
    await this.exclusive(async () => {
      if (!this.playOpen()) return;
      if (settled(await this.send({ kind: 'retry-correction' }))) await this.drive();
    });
  }

  /** From a correction: keeps the move (a strategy override), which begins the turn at once. */
  async overrideCorrection(): Promise<void> {
    await this.exclusive(() => this.turnCommand({ kind: 'override-correction' }));
  }

  /** Starts another strategy cycle with the remaining balance. */
  async restartCycle(): Promise<void> {
    await this.exclusive(async () => {
      if (!this.playOpen()) return;
      if (settled(await this.send({ kind: 'restart-cycle' }))) await this.drive();
    });
  }

  /** Stops the strategy's bets; the practice session stays open. */
  async stopStrategy(): Promise<void> {
    await this.exclusive(async () => {
      if (!this.playOpen()) return;
      if (settled(await this.send({ kind: 'stop-strategy' }))) await this.drive();
    });
  }

  /**
   * Sends a command that may begin a turn. The supervisor is asked, and a turn
   * charge committed with it, only when the engine's transition begins one.
   */
  private async turnCommand(command: Command): Promise<void> {
    {
      if (!this.playOpen() || this.pending) return;
      const state = this.requireState();
      const candidate = advanceActivity(state, { sequence: state.sequence, commandId: `${state.activity.id}/${state.sequence}`, command });
      if (candidate.status === 'committed' && candidate.state.turn === state.turn) {
        // Nothing begins (a correction, or an illegal attempt): no access question, no charge.
        if (settled(await this.send(command))) await this.drive();
        return;
      }
      // Unanswered mid-activity: uncertain, so no new turn (Amendment 5 A1).
      const access = await this.adapters.access.beforeTurn({ activityId: state.activity.id, turn: state.turn + 1 }).catch((): AccessDenial => UNANSWERED);
      if (access.status !== 'allowed') {
        // No turn starts: the stop path runs, or the session suspends here, at the boundary.
        this.applyDenial(access);
        return this.drive();
      }
      // Left the table while the supervisor answered: no turn starts.
      if (!this.playOpen()) return this.drive();
      // A turn charge (spec 5) commits atomically with the transition that begins the turn.
      const charge = access.turnCharge;
      const effects: AllowanceEffect[] = charge
        ? [{ effectId: { grant: charge.grant, activity: state.activity.id, sequence: state.sequence }, kind: 'turn-charge', amount: charge.amount }]
        : [];
      if (settled(await this.send(command, effects))) await this.drive();
    }
  }

  /**
   * Adds funds while the table waits for input. The engine refuses it beyond the
   * funding headroom or under a training bankroll; it never places a wager itself.
   */
  async rebuy(amount: string): Promise<void> {
    await this.exclusive(async () => {
      if (!this.playOpen()) return;
      if (settled(await this.send({ kind: 'rebuy', amount }))) await this.drive();
    });
  }

  /** Spins the wheel: a roulette turn. */
  spin = (): Promise<void> => this.beginTurn();

  /**
   * A blackjack playing action. The hand in play always finishes: actions stay
   * open on the stop path and before a turn-boundary suspension is reached.
   * Once the hand is done the round settles automatically after the reveal.
   */
  async play(action: BlackjackAction): Promise<void> {
    await this.exclusive(async () => {
      if (this.suspension?.reached ?? false) return;
      if (this.suspension?.kind === 'immediate') return;
      if (settled(await this.send({ kind: 'play', action }))) await this.drive();
    });
  }

  /**
   * Ends the session: removable wagers come back, committed ones settle
   * automatically, then one final result. While suspended it works only between
   * turns and when the gate states allow it (Amendment 5 A3); it then runs
   * offline and never asks for access. A session suspended mid-round must resume
   * to finish the round first.
   */
  async endSession(cause: Exclude<StopCause, 'access-ended'> = 'stop'): Promise<void> {
    await this.exclusive(async () => {
      if (!this.state || this.current.status !== 'active') return;
      const suspension = this.suspension;
      if (suspension) {
        if (!suspension.canEnd) return;
        const gate = await this.adapters.access
          .beforeEndWhileSuspended({ activityId: this.state.activity.id })
          .catch(() => ({ status: 'blocked', reason: CHECK_FAILED }) as const);
        // Changed while asking (another suspension): judge ending against the one now in place.
        const now = this.suspension;
        if (!now?.canEnd) return this.publish();
        if (gate.status === 'blocked') {
          this.suspension = { ...now, endBlocked: gate.reason };
          return this.publish();
        }
        this.suspension = null;
      }
      // Mid-reveal, the engine keeps the committed wagers for final settlement. Anywhere
      // else the stop path runs between turns, after a blackjack hand in play finishes.
      if (this.state.phase === 'revealing-outcome') {
        if (!settled(await this.send(stopCommand(cause)))) return;
      } else {
        this.stopping ??= cause;
      }
      await this.drive();
    });
  }

  /**
   * The direct suspend, for leaving the table, app lifecycle and sign-out. It
   * takes effect at once, even while a command is saving: that commit finishes,
   * then nothing further is revealed, settled, drawn or charged until a resume.
   */
  suspend(cause: 'navigation' | 'app-lifecycle' | 'sign-out' = 'navigation'): void {
    if (!this.state || this.current.status !== 'active') return;
    this.resumeQueued = false;
    this.suspends++;
    this.suspendNow(cause, null);
  }

  /** Asks the supervisor, then resumes the exact committed phase. A blocked resume changes nothing. */
  async resume(): Promise<void> {
    if (!this.suspension) return;
    if (this.busy) {
      this.resumeQueued = true;
      return;
    }
    await this.exclusive(() => this.resumeSuspended());
  }

  /** Coming back to the table: resumes a suspension that came from leaving it, and no other. */
  async resumeOnReturn(): Promise<void> {
    if (this.suspension && resumesOnReturn(this.suspension)) await this.resume();
  }

  /**
   * An app lifecycle or access event. Backgrounding and sign-out suspend at once;
   * every event is put to the supervisor, and its denial is applied.
   */
  async lifecycle(event: LifecycleEvent): Promise<void> {
    if (!this.state || this.current.status !== 'active') return;
    if (event === 'backgrounded') this.suspend('app-lifecycle');
    if (event === 'signed-out') this.suspend('sign-out');
    const activityId = this.state.activity.id;
    // An event the supervisor couldn't answer tells it nothing new; the next turn or resume asks again.
    const decision = await this.adapters.access.onLifecycle({ activityId, event }).catch((): AccessDecision => ({ status: 'allowed', provenance: 'unanswered' }));
    if (decision.status === 'allowed' || this.state?.activity.id !== activityId || this.current.status !== 'active') return;
    this.applyDenial(decision);
    // Work in flight picks the disposition up at its next step; otherwise apply it now.
    if (!this.busy) await this.exclusive(() => this.drive());
  }

  /** Retries the save that failed, then carries on with any automatic steps. */
  async retrySave(): Promise<void> {
    await this.exclusive(async () => {
      const pending = this.pending;
      if (!pending) return;
      if (pending.kind === 'completion') return this.complete();
      if (settled(await this.retryTransition(pending))) await this.drive();
    });
  }

  /** Leaves a completed session's result; Play then offers setup. */
  dismissResult(): void {
    if (this.current.status !== 'completed' || this.busy) return;
    const { result } = this.current;
    this.activity = null;
    this.state = null;
    this.lastReport = null;
    this.showNone(null);
    // Only a result produced (and durably saved) in this process reaches here.
    this.adapters.leftFreshResult?.(result);
  }

  // ---- internals ----------------------------------------------------------

  /** Runs one operation at a time; input that arrives meanwhile is ignored, never queued. */
  private async exclusive(run: () => Promise<unknown>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.publish();
    try {
      await run();
    } finally {
      this.busy = false;
      this.publish();
      if (this.pending) this.scheduleRetry();
      if (this.resumeQueued) {
        this.resumeQueued = false;
        void this.resume();
      }
    }
  }

  /** Interactive play is open: not suspended and not ending. */
  private playOpen(): boolean {
    return this.suspension === null && this.stopping === null;
  }

  private suspendNow(cause: SuspendCause, reason: string | null, kind: Suspension['kind'] = 'immediate'): void {
    const previous = this.suspension;
    if (previous) {
      // A turn-boundary suspend never loosens one already in place.
      if (kind === 'turn-boundary') return;
      if (resumesOnReturn({ cause })) {
        if (previous.kind === 'immediate') return;
        // Leaving the table makes a waiting access suspension immediate but keeps its cause, so return can't lift it.
        cause = previous.cause;
        reason = previous.reason;
      }
    }
    this.suspension = { cause, kind, reached: false, reason, resumeBlocked: null, canEnd: false, endBlocked: null, waitsForPlayer: false };
    this.refreshSuspension();
  }

  /**
   * Recomputes what the suspension allows in the committed phase (reached at
   * once, or when no turn is under way; whether it can end; whether it waits for
   * the player), then publishes.
   */
  private refreshSuspension(): void {
    const suspension = this.suspension;
    if (!suspension || !this.state) return;
    const betweenTurns = !turnInProgress(this.state);
    const reached = suspension.kind === 'immediate' || betweenTurns;
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
        this.stopping = 'access-ended';
        return this.publish();
      case 'suspend':
        return this.suspendNow('access', denial.reason ?? null);
      case 'suspend-at-turn-boundary':
        return this.suspendNow('access', denial.reason ?? null, 'turn-boundary');
    }
  }

  /** The resume question (Amendment 5 A2): allowed resumes the committed phase; anything else changes nothing. */
  private async resumeSuspended(): Promise<void> {
    const suspension = this.suspension;
    const state = this.state;
    if (!suspension || !state) return;
    const suspends = this.suspends;
    const decision = await this.adapters.access
      .beforeResume({ activityId: state.activity.id, phase: state.phase })
      .catch((): AccessDecision => UNANSWERED);
    // Suspended again while asking (the player left again, or a disposition arrived): stay suspended.
    if (this.suspension !== suspension || this.suspends !== suspends) return;
    if (decision.status !== 'allowed') {
      const resumeBlocked = decision.status === 'uncertain' ? RECONNECT_TO_VERIFY : (decision.reason ?? CANT_RESUME);
      this.suspension = { ...suspension, resumeBlocked };
      // Access ended: play never reopens, so ending runs (and says it runs) the access-ended stop path.
      if (decision.disposition === 'stop') this.stopping = 'access-ended';
      return this.refreshSuspension();
    }
    this.suspension = null;
    this.publish();
    await this.drive();
  }

  /**
   * While a save is failing, retries it SAVE_RETRY_MS after each failure until
   * it succeeds. A wait for a failure that has since been retried is dropped.
   */
  private scheduleRetry(): void {
    const failed = this.pending;
    if (!failed || this.retryFor === failed) return;
    this.retryFor = failed;
    void this.adapters.clock
      .sleep(SAVE_RETRY_MS)
      .then(() => {
        if (this.retryFor !== failed) return;
        this.retryFor = null;
        // If other input is in flight, it schedules the next retry when it ends.
        return this.retrySave();
      })
      // A retry that throws leaves play paused; the player can still retry by hand.
      .catch(() => undefined);
  }

  /**
   * The automatic, no-tap steps: settle a revealed spin or roll, run the stop
   * path and final settlement (craps rolls on, one committed step per roll,
   * until its contracts settle), complete. A suspension stops them where it applies.
   */
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
        // Suspended during the reveal: the settle waits for the resume.
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
        // The stop path, between turns: removable wagers come back, then final settlement.
        // A blackjack hand still in play finishes first; the player's actions stay open.
        if (!settled(await this.send(stopCommand(this.stopping)))) return;
      } else {
        return;
      }
    }
  }

  /** Durability steps 2-4 for one command, identified by the sequence it was issued at. */
  private async send(command: Command, effects: readonly AllowanceEffect[] = []): Promise<CommitResult> {
    if (this.pending) return 'not-saved';
    const state = this.requireState();
    return this.commit({ envelope: { sequence: state.sequence, commandId: `${state.activity.id}/${state.sequence}`, command }, effects });
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
      // An uncertain acknowledgement: the receipt says whether it committed.
      return this.recover(outbound);
    }
    if (outcome.status === 'sequence-conflict') return this.adoptStored(outbound);
    // Delivered twice: show the transition the store holds, not the candidate.
    if (outcome.status === 'already-committed') return this.acceptStored(outbound, outcome.transition);
    this.accept(result.state, result.facts);
    return 'committed';
  }

  /** A failed save's retry: recover it if it did commit after all, otherwise commit it again. */
  private async retryTransition(outbound: Outbound): Promise<CommitResult> {
    const recovered = await this.recover(outbound);
    // No receipt (and the read worked): it never committed, so commit it now.
    if (recovered !== 'not-saved' || this.pendingIsUnknown) return recovered;
    return this.commit(outbound);
  }

  /** True when the last receipt read failed, so it is still unknown whether the pending command committed. */
  private pendingIsUnknown = false;

  /**
   * Reads the receipt for a command whose acknowledgement was lost and returns
   * the committed result from the store, never the candidate computed here.
   */
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

  /** Accepts a committed transition read back from the store for this command. */
  private async acceptStored(outbound: Outbound, found: CommittedTransition): Promise<CommitResult> {
    const state = this.requireState();
    const activityId = state.activity.id;
    const candidate = advanceActivity(state, outbound.envelope);
    // The id names "the command at this sequence"; a different command there means the activity moved on.
    if (candidate.status !== 'committed' || found.receipt.command !== candidate.receipt.command) return this.adoptStored(outbound);
    const decoded = decodeCheckpoint(found.checkpoint);
    if (!decoded.ok) throw new Error(`activity ${activityId} has a damaged checkpoint: ${decoded.error.message}`);
    this.accept(decoded.state, found.facts);
    return 'committed';
  }

  /** The stored activity moved past this command (another writer): show what is durably there. */
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
    // Another writer moved the activity on; this session's suspension and stop still hold.
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

  /** Durability step 5: one final result and one outgoing synchronization record. */
  private async complete(): Promise<boolean> {
    const state = this.requireState();
    const activity = this.activity;
    if (!activity) throw new Error('no practice session is active');
    let record: CompletedPracticeSession;
    try {
      // The record is built from every durably committed fact, so a recovered completion builds the same one.
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

  private adopt(stored: StoredActivity, facts: readonly DomainFact[]): void {
    const decoded = decodeCheckpoint(stored.checkpoint);
    if (!decoded.ok) throw new Error(`activity ${stored.activityId} can't be resumed: ${decoded.error.message}`);
    this.activity = stored;
    this.state = decoded.state;
    this.facts = facts;
    this.pending = null;
    this.suspension = null;
    // Final settlement already started: the stop path is under way and play never reopens.
    this.stopping = decoded.state.phase === 'final-settlement' ? (this.stopping ?? 'stop') : null;
    this.publish();
  }

  private requireState(): ActivityState {
    if (!this.state) throw new Error('no practice session is active');
    return this.state;
  }

  private showNone(problem: StartProblem | null, problemReason: string | null = null): void {
    this.current = { status: 'none', problem, problemReason, busy: this.busy };
    this.notify();
  }

  /** Publishes the committed state's permitted view (never a candidate's). */
  private publish(): void {
    if (this.current.status === 'completed') return;
    if (!this.state || !this.activity) {
      if (this.current.status === 'none') this.showNone(this.current.problem, this.current.problemReason);
      return;
    }
    this.current = {
      status: 'active',
      view: readPermittedView(this.state),
      facts: this.facts,
      busy: this.busy,
      save: this.pending ? 'failed' : 'saved',
      suspension: this.suspension,
      ending: this.stopping === 'access-ended' ? 'access-ended' : null,
    };
    const suspended = this.suspension?.reached ?? false;
    this.report({
      activityId: this.state.activity.id,
      phase: this.state.phase,
      suspended,
      // A failed save pauses training, and the stop path is never metered.
      timed: TIMED_PHASES.has(this.state.phase) && !suspended && !this.pending && this.stopping === null,
    });
    this.notify();
  }

  /** The timed-metering hook (Amendment 4 A4): reports each change, unused by the spec 1 stub. */
  private report(report: PhaseReport): void {
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
  a.provenance === b.provenance && a.meteringBasis === b.meteringBasis && a.allowancePolicyVersion === b.allowancePolicyVersion;

/** The stop path's first command; the player's plain stop carries no cause. */
const stopCommand = (cause: StopCause): Command => (cause === 'stop' ? { kind: 'request-stop' } : { kind: 'request-stop', cause });

const wheelOf = (request: Extract<StartRequest, { game: 'roulette' }>): RouletteWheel => request.wheel ?? 'single-zero';

/** Whether a retried start asks for the same table, so it may recover the unacknowledged activity. */
function sameRequest(a: StartRequest, b: StartRequest): boolean {
  if (a.buyIn !== b.buyIn || a.fundingSource !== b.fundingSource) return false;
  if (canonicalJson(a.strategy ?? null) !== canonicalJson(b.strategy ?? null)) return false;
  if (a.game === 'craps') return b.game === 'craps' && a.odds === b.odds;
  if (a.game === 'blackjack') return b.game === 'blackjack' && canonicalJson(a.rules) === canonicalJson(b.rules);
  return b.game === 'roulette' && wheelOf(a) === wheelOf(b);
}
