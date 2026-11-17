// Spec 3 Modules › Challenge controller: spec 1's practice-controller pattern applied to challenge attempts.
// Spec 3 Attempt lifecycle; Amendment 1 C6; #158

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
  type ChallengeState,
  type ChallengeVariant,
  type ChallengeView,
} from '@tableside/engine';

import type { AccessDenial } from '../practice/adapters';
import { SAVE_RETRY_MS } from '../practice/controller';
import type { AllowanceEffect } from '../practice/store';
import type { TrainingAdapters } from './adapters';
import { CHALLENGE_CHARGE, type Admission, type CommittedAttemptTransition, type StoredAttempt } from './store';

export type StartProblem = 'invalid-setup' | 'access-denied' | 'access-uncertain' | 'save-failed';

export type LearnerCommand = Extract<ChallengeCommand, { readonly kind: 'answer' | 'skip' | 'retry-item' | 'next-item' }>;

export type AttemptSnapshot =
  | { readonly status: 'loading' }
  | { readonly status: 'none'; readonly problem: Exclude<StartProblem, 'invalid-setup'> | null; readonly busy: boolean }
  | { readonly status: 'active'; readonly view: ChallengeView; readonly busy: boolean; readonly save: 'saved' | 'failed' }
  | { readonly status: 'ended'; readonly record: ChallengeAttemptRecord };

type Pending = { readonly kind: 'transition'; readonly command: LearnerCommand } | { readonly kind: 'record' };

const UNANSWERED: AccessDenial = { status: 'uncertain', provenance: 'unanswered', disposition: 'stop' };

export class ChallengeController {
  private current: AttemptSnapshot = { status: 'loading' };
  private readonly listeners = new Set<() => void>();
  private attempt: StoredAttempt | null = null;
  private state: ChallengeState | null = null;
  private busy = false;
  private pending: Pending | null = null;
  private retryFor: Pending | null = null;

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
      if (stored && this.decode(stored).phase !== 'ready') return this.adopt(stored, this.decode(stored));

      // Amendment 1 C6: an attempt created but never charged rechecks admission.
      const access = await this.adapters.access.beforeChallenge({ category: content.category, variant }).catch((): AccessDenial => UNANSWERED);
      if (access.status !== 'allowed') return this.showNone(access.status === 'uncertain' ? 'access-uncertain' : 'access-denied');
      const admission: Admission = {
        provenance: access.provenance,
        meteringBasis: access.meteringBasis,
        ...(access.allowancePolicyVersion === undefined ? {} : { allowancePolicyVersion: access.allowancePolicyVersion }),
      };

      if (!stored) {
        const attemptId = this.adapters.newId();
        const random = streamIdentityFromEntropy(this.adapters.entropy);
        const specification = { attemptId, owner: this.adapters.owner, device: this.adapters.device, variant, content };
        const initial = createChallenge(specification, random);
        const created = { attemptId, admission, specification, random, checkpoint: encodeChallengeCheckpoint(initial), createdAt: this.adapters.clock.now() };
        try {
          stored = await this.adapters.store.createAttempt(created);
        } catch {
          stored = await this.adapters.store.loadAttempt(attemptId).catch(() => null);
        }
        if (!stored) return this.showNone('save-failed');
      }
      await this.beginCharged({ ...stored, admission }, this.decode(stored));
    });
  }

  // Amendment 1 C6: the charge commits atomically with the first-content transition, before that content is published.
  private async beginCharged(stored: StoredAttempt, state: ChallengeState): Promise<void> {
    const charge: AllowanceEffect = { effectId: { grant: stored.admission.provenance, activity: stored.attemptId, sequence: 0 }, kind: CHALLENGE_CHARGE, amount: '1' };
    const committed = await this.commit(state, { kind: 'begin' }, charge);
    if (!committed) {
      this.state = null;
      this.attempt = null;
      return this.showNone('save-failed');
    }
    this.adopt(stored, committed);
  }

  async submit(command: LearnerCommand): Promise<void> {
    await this.exclusive(async () => {
      if (!this.state || this.pending) return;
      await this.send(command);
    });
  }

  async retrySave(): Promise<void> {
    await this.exclusive(async () => {
      const pending = this.pending;
      if (!pending) return;
      this.pending = null;
      if (pending.kind === 'record') await this.record();
      else await this.send(pending.command);
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
    this.state = next;
    this.publish();
    if (next.phase === 'ended') await this.record();
  }

  // Spec 1 Durability steps 2–4
  private async commit(state: ChallengeState, command: ChallengeCommand, charge: AllowanceEffect | null): Promise<ChallengeState | null> {
    const commandId = `${state.attempt.id}/${state.sequence}`;
    const result = advanceChallenge(state, { sequence: state.sequence, commandId, command });
    if (result.status !== 'committed') return state;
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
      if (outcome.status === 'committed') return result.state;
      if (outcome.status === 'already-committed') found = outcome.transition;
    } catch {
      found = await store.readAttemptReceipt(state.attempt.id, commandId).catch(() => null);
    }
    if (found === null || found.receipt.command !== result.receipt.command) return null;
    const decoded = decodeChallengeCheckpoint(found.checkpoint);
    if (!decoded.ok) throw new Error(`attempt ${state.attempt.id} has a damaged checkpoint: ${decoded.error.message}`);
    return decoded.state;
  }

  // Spec 3 Attempt lifecycle › Durability: completion writes one attempt record.
  private async record(): Promise<void> {
    const state = this.requireState();
    const attempt = this.attempt as StoredAttempt;
    const unsequenced = challengeAttemptRecord(state, {
      installation: this.adapters.device,
      startedAt: attempt.createdAt,
      endedAt: this.adapters.clock.now(),
      // TODO(#135)
      interrupted: false,
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

  private adopt(stored: StoredAttempt, state: ChallengeState): void {
    this.attempt = stored;
    this.state = state;
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
    this.current = { status: 'active', view: readChallengeView(this.state), busy: this.busy, save: this.pending ? 'failed' : 'saved' };
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
