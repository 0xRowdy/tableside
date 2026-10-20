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
  encodeMoney,
  readPermittedView,
  streamIdentityFromEntropy,
  sub,
  type ActivityState,
  type Command,
  type CommandEnvelope,
  type DomainFact,
  type PermittedView,
} from '@tableside/engine';
import { SINGLE_ZERO_ROULETTE } from '@tableside/definitions';

import type { PracticeAdapters } from './adapters';
import type { CompletedPracticeSession, NewActivity, StoredActivity } from './store';

/** How long the landed ball stays on screen before the automatic settle step. */
export const REVEAL_MS = 1500;
/** The pause between the ending steps, so each is seen and announced. */
export const ENDING_STEP_MS = 1000;

export type StartProblem = 'invalid-buy-in' | 'save-failed' | 'access-not-allowed';

export type PracticeSnapshot =
  | { readonly status: 'loading' }
  | { readonly status: 'none'; readonly problem: StartProblem | null; readonly busy: boolean }
  | {
      readonly status: 'active';
      readonly view: PermittedView;
      /** Facts of the latest committed transition, for announcements. */
      readonly facts: readonly DomainFact[];
      readonly buyIn: string;
      /** True while a command or an automatic step is in flight; input waits. */
      readonly busy: boolean;
      /** "failed": the last transition isn't saved and play is paused until a retry succeeds. */
      readonly save: 'saved' | 'failed';
      readonly accessNotAllowed: boolean;
    }
  | { readonly status: 'completed'; readonly result: CompletedPracticeSession };

export interface StartRequest {
  readonly game: 'roulette';
  /** Whole units, as canonical decimal text. */
  readonly buyIn: string;
}

type Pending = { readonly kind: 'transition'; readonly envelope: CommandEnvelope } | { readonly kind: 'completion' };

export class PracticeController {
  private current: PracticeSnapshot = { status: 'loading' };
  private readonly listeners = new Set<() => void>();
  private activity: StoredActivity | null = null;
  private state: ActivityState | null = null;
  private facts: readonly DomainFact[] = [];
  private busy = false;
  private pending: Pending | null = null;
  private accessNotAllowed = false;
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
  async start(request: StartRequest): Promise<void> {
    await this.exclusive(async () => {
      const access = await this.adapters.access.beforeActivity({ game: request.game });
      if (access.status !== 'allowed') return this.showNone('access-not-allowed');

      let activity: NewActivity;
      if (this.unacknowledgedStart && sameRequest(this.unacknowledgedStart.request, request)) {
        activity = this.unacknowledgedStart.activity;
      } else {
        const activityId = this.adapters.newId();
        const random = streamIdentityFromEntropy(this.adapters.entropy);
        const specification = {
          activityId,
          owner: this.adapters.owner,
          device: this.adapters.device,
          game: request.game,
          rules: SINGLE_ZERO_ROULETTE,
          strategy: null,
          reference: null,
          funding: request.buyIn,
        };
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
    await this.exclusive(() => this.send({ kind: 'place-wager', target, amount }));
  }

  /** Begins a turn (the spin), then settles it automatically after the reveal. */
  async spin(): Promise<void> {
    await this.exclusive(async () => {
      const state = this.requireState();
      const access = await this.adapters.access.beforeTurn({ activityId: state.activity.id, turn: state.turn + 1 });
      this.accessNotAllowed = access.status !== 'allowed';
      if (this.accessNotAllowed) return this.publish();
      if (await this.send({ kind: 'begin-turn' })) await this.drive();
    });
  }

  /** Ends the session: removable wagers come back, committed ones settle automatically, then one final result. */
  async endSession(): Promise<void> {
    await this.exclusive(async () => {
      if (await this.send({ kind: 'request-stop' })) await this.drive();
    });
  }

  /** Retries the save that failed, then carries on with any automatic steps. */
  async retrySave(): Promise<void> {
    await this.exclusive(async () => {
      const pending = this.pending;
      if (!pending) return;
      const saved = pending.kind === 'transition' ? await this.commit(pending.envelope) : await this.complete();
      if (saved) await this.drive();
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
    }
  }

  /** The automatic, no-tap steps: settle a revealed spin, run final settlement, complete. */
  private async drive(): Promise<void> {
    for (;;) {
      if (this.pending) return;
      const phase = this.requireState().phase;
      if (phase === 'revealing-outcome') {
        await this.adapters.clock.sleep(REVEAL_MS);
        if (!(await this.send({ kind: 'settle-turn' }))) return;
      } else if (phase === 'final-settlement') {
        await this.adapters.clock.sleep(ENDING_STEP_MS);
        if (!(await this.send({ kind: 'advance-final-settlement' }))) return;
      } else if (phase === 'completed') {
        await this.complete();
        return;
      } else {
        return;
      }
    }
  }

  /** Durability steps 2-4 for one command. True once it is committed and published. */
  private async send(command: Command): Promise<boolean> {
    if (this.pending) return false;
    const state = this.requireState();
    return this.commit({ sequence: state.sequence, commandId: `${state.activity.id}/${state.sequence}`, command });
  }

  private async commit(envelope: CommandEnvelope): Promise<boolean> {
    const state = this.requireState();
    const result = advanceActivity(state, envelope);
    if (result.status !== 'committed') return false;
    const { store } = this.adapters;
    let committed: boolean;
    try {
      const outcome = await store.commitTransition({
        activityId: state.activity.id,
        priorSequence: state.sequence,
        checkpoint: encodeCheckpoint(result.state),
        receipt: result.receipt,
        facts: result.facts,
        effects: [],
      });
      if (outcome.status === 'sequence-conflict') {
        // Another writer moved the activity on: show what is durably there.
        const stored = await store.load(state.activity.id);
        if (stored) this.adopt(stored, []);
        this.pending = null;
        return false;
      }
      committed = true;
    } catch {
      // An uncertain acknowledgement: the receipt says whether it committed.
      committed = (await store.readReceipt(state.activity.id, envelope.commandId).catch(() => null)) !== null;
    }
    if (!committed) {
      this.pending = { kind: 'transition', envelope };
      this.publish();
      return false;
    }
    this.pending = null;
    this.state = result.state;
    this.facts = result.facts;
    this.publish();
    return true;
  }

  /** Durability step 5: one final result and one outgoing synchronization record. */
  private async complete(): Promise<boolean> {
    const state = this.requireState();
    const activity = this.activity as StoredActivity;
    const buyIn = activity.specification.funding;
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
      buyIn,
      rebuys: [],
      cumulativeFunding: buyIn,
      finalCashOut: state.balance,
      netResult: encodeMoney(sub(decodeMoney(state.balance), decodeMoney(buyIn))),
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
      buyIn: this.activity.specification.funding,
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

const sameRequest = (a: StartRequest, b: StartRequest) => a.game === b.game && a.buyIn === b.buyIn;
