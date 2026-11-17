// Spec 3 Modules › Training service › Challenge controller
// Spec 3 Attempt lifecycle; Amendment 1 C6; #158, #132, #133

import {
  advanceChallenge,
  challengeAttemptRecord,
  createChallenge,
  decodeChallengeCheckpoint,
  encodeChallengeCheckpoint,
  readChallengeView,
  streamIdentityFromEntropy,
  type ChallengeAttemptRecord,
  type ChallengeCommand,
  type ChallengeContent,
  type ChallengeFact,
  type ChallengePhase,
  type ChallengeState,
  type ChallengeVariant,
  type ChallengeView,
} from '@tableside/engine';

import type { AccessDecision, AccessDenial, LifecycleEvent } from '../practice/adapters';
import { RECONNECT_TO_VERIFY, SAVE_RETRY_MS } from '../practice/controller';
import type { TrainingAdapters } from './adapters';
import { CHALLENGE_CHARGE, type Admission, type AttemptCharge, type CommittedAttemptTransition, type StoredAttempt } from './store';

export type StartProblem = 'invalid-setup' | 'access-denied' | 'access-uncertain' | 'save-failed';

// Spec 3 S3-03 BFdJT
export const RECORDED_MS = 800;

export type LearnerCommand = Extract<ChallengeCommand, { readonly kind: 'answer' | 'skip' | 'retry-item' | 'next-item' | 'reveal-count' }>;

// Spec 3 Attempt lifecycle › Phases, Pause; Amendment 1 B5, C1
export type HoldCause = 'learner' | 'speech-backlog' | 'navigation' | 'app-lifecycle' | 'sign-out' | 'recovered' | 'access';

export interface AttemptHold {
  readonly kind: 'paused' | 'auto-paused' | 'suspended';
  readonly cause: HoldCause;
  readonly reached: boolean;
  readonly reason: string | null;
  readonly resumeBlocked: string | null;
}

// Spec 3 Amendment 1 C6
const HOLD_RANK: Record<HoldCause, number> = { learner: 0, 'speech-backlog': 0, navigation: 1, 'app-lifecycle': 1, recovered: 1, 'sign-out': 2, access: 2 };

const ITEM_FINISHED: ReadonlySet<ChallengePhase> = new Set(['ready', 'card', 'recorded', 'ended']);

const HOLD_KIND: Record<HoldCause, AttemptHold['kind']> = {
  learner: 'paused',
  'speech-backlog': 'auto-paused',
  navigation: 'suspended',
  'app-lifecycle': 'suspended',
  'sign-out': 'suspended',
  recovered: 'suspended',
  access: 'suspended',
};

export type AttemptSnapshot =
  | { readonly status: 'loading' }
  | { readonly status: 'none'; readonly problem: Exclude<StartProblem, 'invalid-setup'> | null; readonly busy: boolean }
  | {
      readonly status: 'active';
      readonly view: ChallengeView;
      readonly facts: readonly ChallengeFact[];
      readonly busy: boolean;
      readonly save: 'saved' | 'failed';
      readonly hold: AttemptHold | null;
    }
  | { readonly status: 'ended'; readonly record: ChallengeAttemptRecord };

type Committed = { readonly state: ChallengeState; readonly facts: readonly ChallengeFact[] };

type Pending = { readonly kind: 'transition'; readonly command: LearnerCommand } | { readonly kind: 'record' };

const UNANSWERED: AccessDenial = { status: 'uncertain', provenance: 'unanswered', disposition: 'stop' };

const CANT_RESUME = "This attempt can't resume right now.";

export class ChallengeController {
  private current: AttemptSnapshot = { status: 'loading' };
  private readonly listeners = new Set<() => void>();
  private attempt: StoredAttempt | null = null;
  private state: ChallengeState | null = null;
  private facts: readonly ChallengeFact[] = [];
  private busy = false;
  private pending: Pending | null = null;
  private retryFor: Pending | null = null;
  private hold: AttemptHold | null = null;
  private interrupted = false;
  private resumeQueued = false;

  constructor(private readonly adapters: TrainingAdapters) {}

  snapshot = (): AttemptSnapshot => this.current;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async load(): Promise<void> {
    await this.exclusive(async () => {
      const stored = await this.adapters.store.findUnfinishedAttempt().catch(() => null);
      if (!stored) return this.showNone(null);
      const state = this.decode(stored);
      // TODO(#135)
      if (state.phase === 'ready') return this.showNone(null);
      this.adopt(stored, state);
      if (state.phase === 'ended') await this.record();
      // Spec 3 Amendment 1 C1
      else this.holdNow('recovered', null);
      await this.drive();
    });
  }

  // Spec 3 Training service interface › Start attempt
  async start(variant: ChallengeVariant, content: ChallengeContent): Promise<void> {
    await this.exclusive(async () => {
      let stored: StoredAttempt | null;
      try {
        stored = await this.adapters.store.findUnfinishedAttempt();
      } catch {
        return this.showNone('save-failed');
      }
      if (stored) {
        const leftover = this.decode(stored);
        if (leftover.phase !== 'ready') {
          this.adopt(stored, leftover);
          return this.holdNow('recovered', null);
        }
        // Spec 3 Amendment 1 C6
        const discarded = await this.adapters.store.discardUnchargedAttempt(stored.attemptId).then(
          () => true,
          () => false,
        );
        if (!discarded) return this.showNone('save-failed');
      }

      const access = await this.adapters.access.beforeChallenge({ category: content.category, variant }).catch((): AccessDenial => UNANSWERED);
      if (access.status !== 'allowed') return this.showNone(access.status === 'uncertain' ? 'access-uncertain' : 'access-denied');
      const admission: Admission = {
        provenance: access.provenance,
        meteringBasis: access.meteringBasis,
        ...(access.allowancePolicyVersion === undefined ? {} : { allowancePolicyVersion: access.allowancePolicyVersion }),
      };

      const attemptId = this.adapters.newId();
      const random = streamIdentityFromEntropy(this.adapters.entropy);
      const specification = { attemptId, owner: this.adapters.owner, device: this.adapters.device, variant, content };
      const initial = createChallenge(specification, random);
      const created = { attemptId, admission, specification, random, checkpoint: encodeChallengeCheckpoint(initial), createdAt: this.adapters.clock.now() };
      let attempt: StoredAttempt | null;
      try {
        attempt = await this.adapters.store.createAttempt(created);
      } catch {
        attempt = await this.adapters.store.loadAttempt(attemptId).catch(() => null);
      }
      if (!attempt) return this.showNone('save-failed');
      await this.beginCharged(attempt, initial);
    });
  }

  // Spec 3 Amendment 1 C6
  private async beginCharged(stored: StoredAttempt, state: ChallengeState): Promise<void> {
    const charge: AttemptCharge = {
      effect: { effectId: { grant: stored.admission.provenance, activity: stored.attemptId, sequence: 0 }, kind: CHALLENGE_CHARGE, amount: '1' },
      chargedAt: this.adapters.clock.now(),
    };
    const committed = await this.commit(state, { kind: 'begin' }, charge);
    if (!committed) {
      this.state = null;
      this.attempt = null;
      return this.showNone('save-failed');
    }
    const charged = await this.adapters.store.loadAttempt(stored.attemptId).catch(() => null);
    this.adopt(charged ?? { ...stored, charge }, committed.state, committed.facts);
  }

  async submit(command: LearnerCommand): Promise<void> {
    await this.exclusive(async () => {
      if (!this.state || this.pending || this.hold?.reached) return;
      // Spec 3 Amendment 1 C6
      if (this.hold && command.kind === 'next-item') {
        this.hold = { ...this.hold, reached: true };
        return this.publish();
      }
      await this.send(command);
      await this.drive();
    });
  }

  // Spec 3 Attempt lifecycle › Pause; Amendment 1 C1
  pause(cause: 'learner' | 'speech-backlog' = 'learner'): void {
    this.holdNow(cause, null);
  }

  // Spec 3 Training service interface › Resume
  async resume(): Promise<void> {
    if (!this.hold) return;
    if (this.busy) {
      this.resumeQueued = true;
      return;
    }
    await this.exclusive(async () => {
      const hold = this.hold;
      const state = this.state;
      if (!hold || !state) return;
      const decision = await this.adapters.access.beforeResume({ activityId: state.attempt.id, phase: state.phase }).catch((): AccessDecision => UNANSWERED);
      if (this.hold !== hold) return;
      // Spec 3 Amendment 1 C6
      if (decision.status !== 'allowed' && decision.disposition !== 'stop') {
        this.hold = { ...hold, resumeBlocked: decision.status === 'uncertain' ? RECONNECT_TO_VERIFY : (decision.reason ?? CANT_RESUME) };
        return this.publish();
      }
      this.hold = null;
      this.publish();
      await this.drive();
    });
  }

  // Spec 3 Amendment 1 B5
  suspend(cause: 'navigation' | 'app-lifecycle' | 'sign-out' = 'navigation'): void {
    this.holdNow(cause, null);
  }

  async lifecycle(event: LifecycleEvent): Promise<void> {
    const state = this.state;
    if (!state || this.current.status !== 'active') return;
    if (event === 'backgrounded') this.suspend('app-lifecycle');
    if (event === 'signed-out') this.suspend('sign-out');
    const attemptId = state.attempt.id;
    const decision = await this.adapters.access.onLifecycle({ activityId: attemptId, event }).catch((): AccessDecision => ({ status: 'allowed', provenance: 'unanswered' }));
    if (decision.status === 'allowed' || this.state?.attempt.id !== attemptId) return;
    this.applyDenial(decision);
  }

  // Spec 3 Attempt lifecycle › Suspend dispositions; Amendment 1 C6
  private applyDenial(denial: AccessDenial): void {
    if (denial.disposition === 'stop') return;
    this.holdNow('access', denial.reason ?? null, denial.disposition === 'suspend-at-turn-boundary');
  }

  private holdNow(cause: HoldCause, reason: string | null, atBoundary = false): void {
    const state = this.state;
    if (!state || this.current.status !== 'active') return;
    const previous = this.hold;
    if (previous && HOLD_RANK[previous.cause] > HOLD_RANK[cause]) return;
    this.resumeQueued = false;
    this.interrupted = true;
    const reached = !atBoundary || (previous?.reached ?? false) || ITEM_FINISHED.has(state.phase);
    this.hold = { kind: HOLD_KIND[cause], cause, reached, reason, resumeBlocked: null };
    this.publish();
  }

  async retrySave(): Promise<void> {
    await this.exclusive(async () => {
      const pending = this.pending;
      if (!pending) return;
      this.pending = null;
      if (pending.kind === 'record') await this.record();
      else await this.send(pending.command);
      await this.drive();
    });
  }

  dismissResults(): void {
    if (this.current.status !== 'ended' || this.busy) return;
    this.attempt = null;
    this.state = null;
    this.showNone(null);
  }

  private async send(command: LearnerCommand): Promise<void> {
    const state = this.requireState();
    const next = await this.commit(state, command, null);
    if (!next) {
      this.pending = { kind: 'transition', command };
      return this.publish();
    }
    this.state = next.state;
    this.facts = next.facts;
    if (this.hold && !this.hold.reached && ITEM_FINISHED.has(next.state.phase)) this.hold = { ...this.hold, reached: true };
    this.publish();
    if (next.state.phase === 'ended') await this.record();
  }

  // Spec 3 Learn, Check and assistance › Answer accepted; S3-03 BFdJT
  private async drive(): Promise<void> {
    while (this.state?.phase === 'recorded' && !this.pending && !this.hold?.reached) {
      await this.adapters.clock.sleep(RECORDED_MS);
      if (this.hold?.reached) return;
      await this.send({ kind: 'next-item' });
    }
  }

  // Spec 1 Durability steps 2–4
  private async commit(state: ChallengeState, command: ChallengeCommand, charge: AttemptCharge | null): Promise<Committed | null> {
    const commandId = `${state.attempt.id}/${state.sequence}`;
    const result = advanceChallenge(state, { sequence: state.sequence, commandId, command });
    if (result.status !== 'committed') return { state, facts: [] };
    const { store } = this.adapters;
    let found: CommittedAttemptTransition | null = null;
    try {
      const outcome = await store.commitAttemptTransition({
        attemptId: state.attempt.id,
        priorSequence: state.sequence,
        checkpoint: encodeChallengeCheckpoint(result.state),
        receipt: result.receipt,
        facts: result.facts as ChallengeFact[],
        charge,
      });
      if (outcome.status === 'committed') return { state: result.state, facts: result.facts };
      if (outcome.status === 'already-committed') found = outcome.transition;
    } catch {
      found = await store.readAttemptReceipt(state.attempt.id, commandId).catch(() => null);
    }
    if (found === null || found.receipt.command !== result.receipt.command) return null;
    const decoded = decodeChallengeCheckpoint(found.checkpoint);
    if (!decoded.ok) throw new Error(`attempt ${state.attempt.id} has a damaged checkpoint: ${decoded.error.message}`);
    return { state: decoded.state, facts: found.facts };
  }

  // Spec 3 Attempt lifecycle › Durability
  private async record(): Promise<void> {
    const state = this.requireState();
    const attempt = this.attempt as StoredAttempt;
    const unsequenced = challengeAttemptRecord(state, {
      installation: this.adapters.device,
      startedAt: attempt.charge?.chargedAt ?? attempt.createdAt,
      endedAt: this.adapters.clock.now(),
      interrupted: this.interrupted,
      performanceMs: null,
      meteringBasis: attempt.admission.meteringBasis,
      allowancePolicyVersion: attempt.admission.allowancePolicyVersion ?? null,
    });
    let record: ChallengeAttemptRecord | null;
    try {
      record = await this.adapters.store.recordAttempt(unsequenced);
    } catch {
      record = (await this.adapters.store.loadAttempt(attempt.attemptId).catch(() => null))?.record ?? null;
    }
    if (!record) {
      this.pending = { kind: 'record' };
      return this.publish();
    }
    this.current = { status: 'ended', record };
    this.notify();
  }

  private decode(stored: StoredAttempt): ChallengeState {
    const decoded = decodeChallengeCheckpoint(stored.checkpoint);
    // TODO(#135)
    if (!decoded.ok) throw new Error(`attempt ${stored.attemptId} can't be resumed: ${decoded.error.message}`);
    return decoded.state;
  }

  private adopt(stored: StoredAttempt, state: ChallengeState, facts: readonly ChallengeFact[] = []): void {
    if (this.attempt?.attemptId !== stored.attemptId) {
      this.hold = null;
      this.interrupted = false;
    }
    this.attempt = stored;
    this.state = state;
    this.facts = facts;
    this.pending = null;
    this.publish();
  }

  private requireState(): ChallengeState {
    if (!this.state) throw new Error('no challenge attempt is active');
    return this.state;
  }

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

  private scheduleRetry(): void {
    const failed = this.pending;
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

  private showNone(problem: Exclude<StartProblem, 'invalid-setup'> | null): void {
    this.current = { status: 'none', problem, busy: this.busy };
    this.notify();
  }

  private publish(): void {
    if (this.current.status === 'ended') return;
    if (!this.state) {
      if (this.current.status === 'none') this.showNone(this.current.problem);
      return;
    }
    this.current = { status: 'active', view: readChallengeView(this.state), facts: this.facts, busy: this.busy, save: this.pending ? 'failed' : 'saved', hold: this.hold };
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
