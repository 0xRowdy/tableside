// The practice controller: the only thing that advances a practice session.
// It asks the engine for each transition, commits it through the store port,
// and publishes the engine's permitted view only after the commit. It never
// decides legality, payouts or settlement; the engine does. Automatic steps
// (settling a revealed spin, final settlement, completion) are driven here,
// never by a tap or an animation callback.

import {
  advanceActivity,
  ActivitySpecificationError,
  createActivity,
  decodeCheckpoint,
  decodeMoney,
  encodeCheckpoint,
  readPermittedView,
  streamIdentityFromEntropy,
  summarizeFunding,
  type ActivitySpecification,
  type ActivityState,
  type Command,
  type CommandEnvelope,
  type DomainFact,
  type FundingSource,
  type OddsCap,
  type PermittedView,
} from '@tableside/engine';
import { SINGLE_ZERO_ROULETTE, standardCraps } from '@tableside/definitions';

import type { PracticeAdapters } from './adapters';
import type { AllowanceEffect, CommitOutcome, CommittedTransition, CompletedPracticeSession, NewActivity, StoredActivity } from './store';

/** How long the landed ball or the dice stay on screen before the automatic settle step. */
export const REVEAL_MS = 1500;
/** The pause between the ending steps, so each is seen and announced. */
export const ENDING_STEP_MS = 1000;
/** How long play stays paused after a failed save before it retries by itself. */
export const SAVE_RETRY_MS = 5000;

export type StartProblem = 'invalid-buy-in' | 'save-failed' | 'access-not-allowed';

export type PracticeSnapshot =
  | { readonly status: 'loading' }
  | { readonly status: 'none'; readonly problem: StartProblem | null; readonly busy: boolean }
  | {
      readonly status: 'active';
      readonly view: PermittedView;
      /** Facts of the latest committed transition, for announcements. */
      readonly facts: readonly DomainFact[];
      /** True while a command or an automatic step is in flight; input waits. */
      readonly busy: boolean;
      /** "failed": the last transition isn't saved and play is paused until a retry succeeds. */
      readonly save: 'saved' | 'failed';
      readonly accessNotAllowed: boolean;
    }
  | { readonly status: 'completed'; readonly result: CompletedPracticeSession };

interface StartRequestBase {
  /** Whole units, as canonical decimal text: the buy-in, or the whole training bankroll allocated to the session. */
  readonly buyIn: string;
  /** Practice funding unless spec 5 starts the session from the training bankroll. */
  readonly fundingSource?: FundingSource;
}

export type StartRequest =
  | (StartRequestBase & { readonly game: 'roulette' })
  | (StartRequestBase & { readonly game: 'craps'; readonly odds: OddsCap });

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

export class PracticeController {
  private current: PracticeSnapshot = { status: 'loading' };
  private readonly listeners = new Set<() => void>();
  private activity: StoredActivity | null = null;
  private state: ActivityState | null = null;
  private facts: readonly DomainFact[] = [];
  private busy = false;
  private pending: Pending | null = null;
  private accessNotAllowed = false;
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

  /** Finds the unfinished session, if any, and resumes it in its committed phase. */
  async load(): Promise<void> {
    await this.exclusive(async () => {
      const stored = await this.adapters.store.findUnfinished();
      if (!stored) return this.showNone(null);
      this.adopt(stored, []);
      await this.drive();
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
        return this.drive();
      }

      const access = await this.adapters.access.beforeActivity({ game: request.game });
      if (access.status !== 'allowed') return this.showNone('access-not-allowed');

      let activity: NewActivity;
      if (this.unacknowledgedStart && sameRequest(this.unacknowledgedStart.request, request)) {
        activity = this.unacknowledgedStart.activity;
      } else {
        const activityId = this.adapters.newId();
        const random = streamIdentityFromEntropy(this.adapters.entropy);
        const base = {
          activityId,
          owner: this.adapters.owner,
          device: this.adapters.device,
          strategy: null,
          reference: null,
          fundingSource: request.fundingSource,
          funding: request.buyIn,
        };
        const specification: ActivitySpecification =
          request.game === 'craps'
            ? { ...base, game: 'craps', rules: standardCraps(request.odds) }
            : { ...base, game: 'roulette', rules: SINGLE_ZERO_ROULETTE };
        let initial: ActivityState;
        try {
          initial = createActivity(specification, random);
        } catch (error) {
          if (error instanceof ActivitySpecificationError) return this.showNone('invalid-buy-in');
          throw error;
        }
        activity = { activityId, specification, random, checkpoint: encodeCheckpoint(initial), createdAt: this.adapters.clock.now() };
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
      // A wager never starts an automatic step itself, but an adopted later state may.
      if (settled(await this.send({ kind: 'place-wager', target, amount }))) await this.drive();
    });
  }

  /** Begins a turn (a spin or a roll), then settles it automatically after the reveal. */
  async beginTurn(): Promise<void> {
    await this.exclusive(async () => {
      const state = this.requireState();
      const access = await this.adapters.access.beforeTurn({ activityId: state.activity.id, turn: state.turn + 1 });
      this.accessNotAllowed = access.status !== 'allowed';
      if (access.status !== 'allowed') return this.publish();
      // A turn charge (spec 5) commits atomically with the transition that begins the turn.
      const charge = access.turnCharge;
      const effects: AllowanceEffect[] = charge
        ? [{ effectId: { grant: charge.grant, activity: state.activity.id, sequence: state.sequence }, kind: 'turn-charge', amount: charge.amount }]
        : [];
      if (settled(await this.send({ kind: 'begin-turn' }, effects))) await this.drive();
    });
  }

  /**
   * Adds funds while the table waits for input. The engine refuses it beyond the
   * funding headroom or under a training bankroll; it never places a wager itself.
   */
  async rebuy(amount: string): Promise<void> {
    await this.exclusive(async () => {
      if (settled(await this.send({ kind: 'rebuy', amount }))) await this.drive();
    });
  }

  /** Spins the wheel: a roulette turn. */
  spin = (): Promise<void> => this.beginTurn();

  /** Ends the session: removable wagers come back, committed ones settle automatically, then one final result. */
  async endSession(): Promise<void> {
    await this.exclusive(async () => {
      if (settled(await this.send({ kind: 'request-stop' }))) await this.drive();
    });
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
    this.activity = null;
    this.state = null;
    this.showNone(null);
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
    }
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

  /** The automatic, no-tap steps: settle a revealed turn, run final settlement (one step or roll at a time), complete. */
  private async drive(): Promise<void> {
    for (;;) {
      if (this.pending) return;
      const phase = this.requireState().phase;
      if (phase === 'revealing-outcome') {
        await this.adapters.clock.sleep(REVEAL_MS);
        if (!settled(await this.send({ kind: 'settle-turn' }))) return;
      } else if (phase === 'final-settlement') {
        await this.adapters.clock.sleep(ENDING_STEP_MS);
        if (!settled(await this.send({ kind: 'advance-final-settlement' }))) return;
      } else if (phase === 'completed') {
        await this.complete();
        return;
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
    this.adopt(stored, []);
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
    // Completed: nothing is left on the table, so the balance is the final cash-out.
    const funding = summarizeFunding(state.funding, decodeMoney(state.balance));
    const record: CompletedPracticeSession = {
      activityId: state.activity.id,
      game: state.identities.game,
      mode: 'free-play',
      identities: {
        engine: state.identities.engine,
        rules: state.identities.rules,
        strategy: state.identities.strategy,
        reference: state.identities.reference,
      },
      fundingSource: funding.source,
      buyIn: funding.buyIn,
      rebuys: funding.rebuys,
      cumulativeFunding: funding.cumulativeFunding,
      finalCashOut: funding.finalCashOut,
      netResult: funding.netResult,
      maxDrawdown: funding.maxDrawdown,
      completedAt: this.adapters.clock.now(),
    };
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
    this.current = { status: 'completed', result };
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
    this.accessNotAllowed = false;
    this.publish();
  }

  private requireState(): ActivityState {
    if (!this.state) throw new Error('no practice session is active');
    return this.state;
  }

  private showNone(problem: StartProblem | null): void {
    this.current = { status: 'none', problem, busy: this.busy };
    this.notify();
  }

  /** Publishes the committed state's permitted view (never a candidate's). */
  private publish(): void {
    if (this.current.status === 'completed') return;
    if (!this.state || !this.activity) {
      if (this.current.status === 'none') this.showNone(this.current.problem);
      return;
    }
    this.current = {
      status: 'active',
      view: readPermittedView(this.state),
      facts: this.facts,
      busy: this.busy,
      save: this.pending ? 'failed' : 'saved',
      accessNotAllowed: this.accessNotAllowed,
    };
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

const sameRequest = (a: StartRequest, b: StartRequest) =>
  a.game === b.game &&
  a.buyIn === b.buyIn &&
  a.fundingSource === b.fundingSource &&
  (a.game !== 'craps' || (b.game === 'craps' && a.odds === b.odds));
