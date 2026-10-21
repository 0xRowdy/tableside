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
  INSURANCE_TARGET,
  isPlayCorrection,
  quarantineStatus,
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

/** How long the landed ball or the dice stay on screen before the automatic settle step. */
export const REVEAL_MS = 1500;
/** The pause between the ending steps, so each is seen and announced. */
export const ENDING_STEP_MS = 1000;
/** How long play stays paused after a failed save before it retries by itself. */
export const SAVE_RETRY_MS = 5000;
/** Under time metering, active training time is checkpointed about this often (Amendment 4 A4). */
export const TIME_CHECKPOINT_MS = 1000;
/** The allowance effect a time-usage checkpoint records: its amount is active milliseconds. */
export const TIME_USAGE = 'time-usage';

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

/** An unfinished session found unusable and marked incomplete (#80), as its explanation shows it. */
export interface IncompleteSessionSummary {
  readonly game: GameId;
  /** The buy-in, or the training-bankroll allocation (see fundingSource). */
  readonly buyIn: string;
  readonly fundingSource: FundingSource;
  /** Turns committed before it became unusable; null when the checkpoint can't be read. */
  readonly turnsRecorded: number | null;
  /** The pinned engine identity; null when the checkpoint can't be read. */
  readonly engine: string | null;
  readonly reason: IncompleteReason;
  /** A quarantine entry's explanation, from the shipped list; null for a damaged checkpoint. */
  readonly explanation: string | null;
}

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
      /**
       * "access-ended": the stop path runs because access or allowance ended.
       * "content-removed": it runs because a required removal covers the strategy.
       */
      readonly ending: AccessStop | null;
    }
  /** The result just produced and durably saved in this process. */
  | { readonly status: 'completed'; readonly result: CompletedPracticeSession }
  /** The unfinished session is unusable (quarantined or damaged): marked incomplete, never given a result. */
  | { readonly status: 'incomplete'; readonly session: IncompleteSessionSummary }
  /**
   * The unfinished session was saved by a later build this one can't run (a
   * rollback): it is never reopened and waits, untouched, for the app to be updated.
   */
  | { readonly status: 'needs-update'; readonly game: GameId };

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
      /** The limits chosen at setup; the launch limits when omitted. */
      readonly limits?: RouletteRuleSet['limits'];
    })
  | (StartRequestBase & {
      readonly game: 'craps';
      readonly odds: OddsCap;
      /** What a field 12 pays; triple when omitted. */
      readonly field?: FieldPayout;
      /** The limits chosen at setup; the launch limits when omitted. */
      readonly limits?: CrapsRuleSet['limits'];
    })
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
  (state.identities.game === 'blackjack' && (state.phase === 'open-decision' || state.phase === 'correction') && (state as BlackjackActivityState).outcome?.active != null);

/** Phases whose time counts as active training (Amendment 4 A4); every other phase is excluded. */
const TIMED_PHASES: ReadonlySet<Phase> = new Set(['open-decision', 'revealing-outcome', 'settled-outcome']);

/** Suspensions that end by themselves when the player comes back to the table. */
const RESUMES_ON_RETURN: ReadonlySet<SuspendCause> = new Set(['navigation', 'app-lifecycle']);

/** Whether coming back to the table lifts this suspension by itself (it still asks the supervisor). */
const resumesOnReturn = (suspension: Pick<Suspension, 'cause'>): boolean => RESUMES_ON_RETURN.has(suspension.cause);

/** Stops the access supervisor imposes, as opposed to the player's own. */
export type AccessStop = Extract<StopCause, 'access-ended' | 'content-removed'>;
const ACCESS_STOPS: ReadonlySet<StopCause> = new Set<AccessStop>(['access-ended', 'content-removed']);
const isAccessStop = (cause: StopCause | null): cause is AccessStop => cause !== null && ACCESS_STOPS.has(cause);

/** A supervisor question that failed to answer counts as uncertain access. */
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
  private retryFor: Pending | readonly AllowanceEffect[] | null = null;
  /** A start whose creation wasn't acknowledged, reused by the retry so it recovers the same activity. */
  private unacknowledgedStart: { request: StartRequest; activity: NewActivity } | null = null;
  /** Time metering: the active stretch being timed, from `since`; null while time doesn't count. */
  private meter: { readonly activityId: string; readonly grant: string; since: number } | null = null;
  /** The next time-usage checkpoint's index for this activity; null until the recorded ones are counted. */
  private timeIndex: number | null = null;
  /** Time-usage checkpoints that failed to save: training is paused until a retry records them. */
  private unsavedTime: readonly AllowanceEffect[] | null = null;

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
      if (await this.openUnfinished(stored)) this.suspendNow('interrupted', null);
    });
  }

  /** What setup shows for a game: its funding source and allowance line. Asking never charges or starts anything. */
  async setupTerms(game: string): Promise<SetupTerms> {
    const { access } = this.adapters;
    if (!access.setupTerms) return PRACTICE_FUNDING_TERMS;
    return access.setupTerms({ game }).catch(() => PRACTICE_FUNDING_TERMS);
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
        if (!(await this.openUnfinished(unfinished))) return;
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
          // Guided blackjack pins the certified reference its built-in strategies are packed from.
          reference: request.game === 'blackjack' && request.strategy ? { ...BLACKJACK_REFERENCE_IDENTITY } : null,
          fundingSource: request.fundingSource,
          funding: request.buyIn,
        };
        const specification = { ...base, ...rulesOf(request) } as ActivitySpecification;
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
      // Timing starts only once the table shows, so a newly created activity has no time checkpoints yet.
      this.adopt(stored, [], stored.sequence === 0 ? 0 : null);
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

  /** A per-bet working instruction (craps): the wager works, or is off, until told otherwise. */
  async setWorking(target: string, working: boolean): Promise<void> {
    await this.exclusive(async () => {
      if (!this.playOpen()) return;
      if (settled(await this.send({ kind: 'set-working', target, working }))) await this.drive();
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

  /** From a correction: takes the move back and sets the strategy's bets, or plays the strategy's play in a blackjack hand. */
  async retryCorrection(): Promise<void> {
    // A held playing move is part of the hand in play, which always finishes.
    if (this.heldPlay()) return this.handAction({ kind: 'retry-correction' });
    await this.exclusive(async () => {
      if (!this.playOpen()) return;
      if (settled(await this.send({ kind: 'retry-correction' }))) await this.drive();
    });
  }

  /** From a correction: keeps the move (a strategy override), which begins the turn at once. */
  async overrideCorrection(): Promise<void> {
    if (this.heldPlay()) return this.handAction({ kind: 'override-correction' });
    await this.exclusive(() => this.turnCommand({ kind: 'override-correction' }));
  }

  /** True while a blackjack playing move waits in a correction. */
  private heldPlay(): boolean {
    const correction = this.state?.strategy?.correction;
    return this.state?.phase === 'correction' && correction != null && isPlayCorrection(correction);
  }

  /** Starts another strategy cycle with the remaining balance. */
  async restartCycle(): Promise<void> {
    await this.exclusive(async () => {
      if (!this.playOpen()) return;
      if (settled(await this.send({ kind: 'restart-cycle' }))) await this.drive();
    });
  }

  /** At a pending strategy action: keeps what was paid and ends the cycle instead; another starts only explicitly. */
  async collectInstead(): Promise<void> {
    await this.exclusive(async () => {
      if (!this.playOpen()) return;
      if (settled(await this.send({ kind: 'collect-instead' }))) await this.drive();
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
      const access = await this.adapters.access.beforeTurn({ activityId: state.activity.id, turn: state.turn + 1, strategy: state.identities.strategy }).catch((): AccessDenial => UNANSWERED);
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
    await this.handAction({ kind: 'play', action });
  }

  /**
   * Insures the blackjack hand in play while insurance (or even money) is
   * offered, before the peek. Part of the hand, so it stays open on the stop
   * path just like a playing action.
   */
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

  /**
   * Ends the session: removable wagers come back, committed ones settle
   * automatically, then one final result. While suspended it works only between
   * turns and when the gate states allow it (Amendment 5 A3); it then runs
   * offline and never asks for access. A session suspended mid-round must resume
   * to finish the round first.
   */
  async endSession(cause: Exclude<StopCause, AccessStop> = 'stop'): Promise<void> {
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
      if (this.unsavedTime) {
        if (!(await this.retryTime())) return;
        if (!this.pending) return this.drive();
      }
      const pending = this.pending;
      if (!pending) return;
      if (pending.kind === 'completion') return this.complete();
      if (this.heldBack(pending)) {
        // Suspended, or a turn that may no longer begin: only learn whether it committed after all.
        const recovered = await this.recover(pending);
        if (recovered !== 'not-saved') return this.drive();
        if (this.pendingIsUnknown) return;
        // It never committed: drop it. Nothing is revealed, settled or charged; resuming re-derives the step or asks again.
        this.pending = null;
        // The active time it carried was still spent: record it on its own.
        const time = pending.effects.filter((effect) => effect.kind === TIME_USAGE);
        if (time.length > 0) await this.writeTime(time);
        this.publish();
        return this.drive();
      }
      if (settled(await this.retryTransition(pending))) await this.drive();
    });
  }

  /**
   * Whether a failed save may no longer be committed by a retry: while the
   * session is suspended nothing is revealed, settled or charged (an automatic
   * step is re-derived after the resume), and once access stops play or a
   * suspension applies, a command that begins a turn never begins it. (The
   * player's own stop keeps the turn they asked for, as when it saved first time.)
   */
  private heldBack(pending: Outbound): boolean {
    if (this.suspension?.kind === 'immediate' || this.suspension?.reached) return true;
    if (!this.suspension && !isAccessStop(this.stopping)) return false;
    const state = this.requireState();
    const candidate = advanceActivity(state, pending.envelope);
    return candidate.status === 'committed' && candidate.state.turn !== state.turn;
  }

  /** Leaves an incomplete session's explanation; Play then offers setup. */
  dismissIncomplete(): void {
    if (this.current.status === 'incomplete') this.showNone(null);
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
      if (this.pending || this.unsavedTime) this.scheduleRetry();
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
    // Amendment 5 §3 allows End session after a turn-boundary suspend, never mid-round. An immediate
    // suspend that lands between turns is read as one at a turn boundary (owner ruling on review
    // finding S16): no turn is under way, so ending there runs the same stop path from the boundary.
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
      if (decision.disposition === 'stop') this.stopping = decision.stopCause ?? 'access-ended';
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
    const failed = this.pending ?? this.unsavedTime;
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
    // A time-usage checkpoint that isn't saved pauses training, automatic steps included.
    if (this.pending || this.unsavedTime) return 'not-saved';
    const state = this.requireState();
    // Each action carries the active time since the last checkpoint with its transition.
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

  /**
   * Takes up the unfinished activity found in the store, unless it is unusable
   * (#80). One a later build saved is left untouched; one whose checkpoint is
   * damaged, or whose pinned identities the shipped quarantine list names, is
   * marked incomplete and explained, never resumed or given a result.
   * True when it was taken up.
   */
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
    // Unsaved, the mark is made again the next time the activity is found; either way nothing is resumed.
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

  /** The shipped list's explanation for a quarantine mark (entries are never removed, so it is always there). */
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
      // A new activity has no checkpoints; one found in the store has them counted before time is next taken.
      this.timeIndex = timeIndex;
    }
    this.activity = stored;
    this.state = decoded.state;
    this.facts = facts;
    this.pending = null;
    this.suspension = null;
    // Final settlement already started: the stop path is under way and play never reopens.
    this.stopping = decoded.state.phase === 'final-settlement' ? (this.stopping ?? 'stop') : null;
    this.publish();
  }

  // ---- time-usage checkpoints (Amendment 4 A4) ---------------------------------

  /**
   * Starts or stops timing as the metered state changes. Only a time-metered
   * admission with a grant is timed. Stopping records the stretch just ended.
   */
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

  /** About every second while this stretch is timed: one checkpoint through the store's single writer. */
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

  /** The active time since the last checkpoint, as the next checkpoint; null when none (or its index isn't known yet). */
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

  /** Records checkpoints; a failure pauses training until a retry records them (only recorded time is charged). */
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

  /** Retries the unsaved checkpoints; true once they are recorded, and training resumes. */
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

  /** Publishes the committed state's permitted view (never a candidate's). */
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
      // A failed save pauses training, and the stop path is never metered. Nor is a
      // pending strategy action: the table waits on the player in an open decision.
      timed: TIMED_PHASES.has(this.state.phase) && !view.strategy?.pending && !suspended && !this.pending && !this.unsavedTime && this.stopping === null,
    });
    this.notify();
  }

  /** The timed-metering hook (Amendment 4 A4): reports each change, unused by the spec 1 stub. */
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

/** The stop path's first command; the player's plain stop carries no cause. */
const stopCommand = (cause: StopCause): Command => (cause === 'stop' ? { kind: 'request-stop' } : { kind: 'request-stop', cause });

/** The game and the rule set a start request pins: its preset with the choices made at setup. */
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

/** Whether a retried start asks for the same table, so it may recover the unacknowledged activity. */
function sameRequest(a: StartRequest, b: StartRequest): boolean {
  if (a.buyIn !== b.buyIn || a.fundingSource !== b.fundingSource) return false;
  if (canonicalJson(a.strategy ?? null) !== canonicalJson(b.strategy ?? null)) return false;
  return canonicalJson(rulesOf(a)) === canonicalJson(rulesOf(b));
}
