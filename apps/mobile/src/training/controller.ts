// Spec 3 Modules › Training service › Challenge controller
// Spec 3 Attempt lifecycle; Amendment 1 C6; #158, #132, #133

import {
  advanceChallenge,
  challengeAttemptRecord,
  createChallenge,
  decodeChallengeCheckpoint,
  encodeChallengeCheckpoint,
  quarantineStatus,
  readChallengeView,
  streamIdentityFromEntropy,
  unusableAttemptRecord,
  type ChallengeAttemptRecord,
  type ChallengeCommand,
  type ChallengeContent,
  type ChallengeFact,
  type ChallengePacing,
  type ChallengePhase,
  type ChallengeState,
  type ChallengeVariant,
  type ChallengeView,
} from '@tableside/engine';

import type { AccessDecision, AccessDenial, LifecycleEvent } from '../practice/adapters';
import { RECONNECT_TO_VERIFY, SAVE_RETRY_MS } from '../practice/controller';
import type { TrainingAdapters } from './adapters';
import { CHALLENGE_CHARGE, FRESH_LIFECYCLE, type Admission, type AttemptCharge, type AttemptLifecycle, type CommittedAttemptTransition, type StoredAttempt } from './store';

export type StartProblem = 'invalid-setup' | 'access-denied' | 'access-uncertain' | 'save-failed';

// Spec 3 S3-03 BFdJT
export const RECORDED_MS = 800;

// Spec 3 Attempt lifecycle › Automatic pacing; S3-02 buD2R; #136
export const PACE_MS: Readonly<Record<ChallengePacing, number | null>> = { 'self-paced': null, '3s': 3000, '2s': 2000, '1s': 1000 };

export type LearnerCommand = Extract<ChallengeCommand, { readonly kind: 'answer' | 'skip' | 'retry-item' | 'next-item' | 'reveal-count' }>;

// Spec 3 Attempt lifecycle › Phases, Pause; Amendment 1 B5, C1
export type HoldCause = 'learner' | 'speech-backlog' | 'navigation' | 'app-lifecycle' | 'sign-out' | 'recovered' | 'access';
export type PauseCause = Extract<HoldCause, 'learner' | 'speech-backlog'>;
export type DirectSuspendCause = Extract<HoldCause, 'navigation' | 'app-lifecycle' | 'sign-out'>;

export interface AttemptHold {
  readonly kind: 'paused' | 'auto-paused' | 'suspended';
  readonly cause: HoldCause;
  readonly reached: boolean;
  readonly reason: string | null;
  readonly resumeBlocked: string | null;
  // Spec 1 Amendment 4 A2
  readonly endBlocked: string | null;
}

// Spec 3 Amendment 1 C6: a hold gives way only to one of equal or higher rank
const HOLDS: Record<HoldCause, { readonly kind: AttemptHold['kind']; readonly rank: number }> = {
  learner: { kind: 'paused', rank: 0 },
  'speech-backlog': { kind: 'auto-paused', rank: 0 },
  navigation: { kind: 'suspended', rank: 1 },
  'app-lifecycle': { kind: 'suspended', rank: 1 },
  recovered: { kind: 'suspended', rank: 1 },
  'sign-out': { kind: 'suspended', rank: 2 },
  access: { kind: 'suspended', rank: 2 },
};

const ITEM_FINISHED: ReadonlySet<ChallengePhase> = new Set(['ready', 'card', 'recorded', 'ended']);

// Spec 3 Attempt lifecycle › Performance timer
const TIMED_PHASES: ReadonlySet<ChallengePhase> = new Set(['card', 'question', 'recorded']);

const answeredLast = (state: ChallengeState) => state.phase === 'ended' || (state.position + 1 >= state.content.length && (state.phase === 'recorded' || state.phase === 'explanation'));

export interface PerformanceTimer {
  readonly ms: number;
  readonly since: number | null;
}

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
      readonly timer: PerformanceTimer | null;
      readonly pacing: ChallengePacing;
    }
  | { readonly status: 'ended'; readonly record: ChallengeAttemptRecord; readonly position: number; readonly explanation: string | null }
  // docs/development.md Releases
  | { readonly status: 'needs-update' };

type Committed = { readonly state: ChallengeState; readonly facts: readonly ChallengeFact[] };

type ControllerCommand = LearnerCommand | Extract<ChallengeCommand, { readonly kind: 'end' }>;

type Pending = { readonly kind: 'transition'; readonly command: ControllerCommand } | { readonly kind: 'record' };

// Spec 3 Amendment 1 C3
type Unusable = { readonly explanation: string | null };

const UNANSWERED: AccessDenial = { status: 'uncertain', provenance: 'unanswered', disposition: 'stop' };

const CANT_RESUME = "This attempt can't resume right now.";
const CHECK_FAILED = "Couldn't check whether this attempt can end. Try again.";

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
  private resumeQueued = false;
  private showResults = true;
  private attemptLifecycle: AttemptLifecycle = FRESH_LIFECYCLE;
  private timedSince: number | null = null;
  private unusable: Unusable | null = null;
  // Spec 3 Attempt lifecycle › Automatic pacing; #136
  private paceArmed: { readonly card: string; readonly token: number } | null = null;
  private paceTokens = 0;
  private paceQueued: number | null = null;

  constructor(private readonly adapters: TrainingAdapters) {}

  snapshot = (): AttemptSnapshot => this.current;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async load(): Promise<void> {
    await this.exclusive(async () => {
      const stored = await this.adapters.store.findUnfinishedAttempt().catch(() => null);
      // Spec 3 Amendment 1 C6
      if (!stored || stored.sequence === 0) return this.showNone(null);
      await this.recover(stored);
    });
  }

  // Spec 3 Training service interface › Start attempt
  async start(variant: ChallengeVariant, content: ChallengeContent, options: { readonly timed: boolean; readonly pacing: ChallengePacing }): Promise<void> {
    await this.exclusive(async () => {
      // Spec 3 Attempt lifecycle › One unfinished attempt
      if (this.state && this.current.status === 'active') return;
      let stored: StoredAttempt | null;
      try {
        stored = await this.adapters.store.findUnfinishedAttempt();
      } catch {
        return this.showNone('save-failed');
      }
      if (this.current.status === 'needs-update') return;
      if (stored) {
        if (stored.sequence > 0) return this.recover(stored);
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
      const created = { attemptId, admission, specification, random, checkpoint: encodeChallengeCheckpoint(initial), createdAt: this.adapters.clock.now(), lifecycle: { ...FRESH_LIFECYCLE, ...options } };
      let attempt: StoredAttempt | null;
      try {
        attempt = await this.adapters.store.createAttempt(created);
      } catch {
        attempt = await this.adapters.store.loadAttempt(attemptId).catch(() => null);
      }
      if (!attempt) return this.showNone('save-failed');
      this.attemptLifecycle = attempt.lifecycle;
      this.timedSince = null;
      await this.beginCharged(attempt, initial);
    });
  }

  // Spec 3 Attempt lifecycle › Durability; Amendment 1 C1, C3; docs/development.md Releases
  private async recover(stored: StoredAttempt): Promise<void> {
    const opened = this.open(stored);
    if (opened.kind === 'needs-update') {
      this.current = { status: 'needs-update' };
      return this.notify();
    }
    if (opened.kind === 'unusable' || opened.state.phase === 'ended') {
      this.adopt(stored, opened.state, [], { quiet: true });
      if (opened.kind === 'unusable') {
        this.unusable = { explanation: opened.explanation };
        this.attemptLifecycle = { ...this.attemptLifecycle, interrupted: true };
      }
      return this.record();
    }
    this.adopt(stored, opened.state);
    this.holdNow('recovered', null);
    await this.drive();
  }

  private open(stored: StoredAttempt): { readonly kind: 'resumable'; readonly state: ChallengeState } | { readonly kind: 'unusable'; readonly state: ChallengeState; readonly explanation: string | null } | { readonly kind: 'needs-update' } {
    const decoded = decodeChallengeCheckpoint(stored.checkpoint);
    if (!decoded.ok) {
      if (decoded.error.kind === 'unsupported') return { kind: 'needs-update' };
      return { kind: 'unusable', state: createChallenge(stored.specification, stored.random), explanation: null };
    }
    const quarantine = quarantineStatus({ identities: { ...decoded.state.identities, rules: null, strategy: null } }, this.adapters.quarantine);
    return quarantine.quarantined ? { kind: 'unusable', state: decoded.state, explanation: quarantine.explanation } : { kind: 'resumable', state: decoded.state };
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
  pause(cause: PauseCause = 'learner'): void {
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
      // Spec 3 S3-05 qGARl
      if (hold.cause === 'speech-backlog' && state.phase === 'card' && this.state === state) await this.send({ kind: 'next-item' });
      await this.drive();
    });
  }

  // Spec 3 Training service interface › End; Attempt lifecycle › Charge
  async end(options: { readonly showResults?: boolean } = {}): Promise<void> {
    await this.exclusive(async () => {
      const state = this.state;
      if (!state || this.current.status !== 'active' || this.pending) return;
      const hold = this.hold;
      if (hold?.kind === 'suspended') {
        const gate = await this.adapters.access
          .beforeEndWhileSuspended({ activityId: state.attempt.id })
          .catch(() => ({ status: 'blocked', reason: CHECK_FAILED }) as const);
        if (this.hold !== hold) return;
        if (gate.status === 'blocked') {
          this.hold = { ...hold, endBlocked: gate.reason };
          return this.publish();
        }
      }
      this.hold = null;
      this.showResults = options.showResults ?? true;
      await this.send({ kind: 'end' });
    });
  }

  // Spec 3 Amendment 1 B5
  suspend(cause: DirectSuspendCause = 'navigation'): void {
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
    if (previous && HOLDS[previous.cause].rank > HOLDS[cause].rank) return;
    this.resumeQueued = false;
    this.attemptLifecycle = { ...this.attemptLifecycle, interrupted: true };
    const reached = !atBoundary || (previous?.reached ?? false) || ITEM_FINISHED.has(state.phase);
    this.hold = { kind: HOLDS[cause].kind, cause, reached, reason, resumeBlocked: null, endBlocked: null };
    this.paceArmed = null;
    this.publish();
    void this.adapters.store.saveAttemptLifecycle(state.attempt.id, this.lifecycleNow()).catch(() => undefined);
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

  private async send(command: ControllerCommand): Promise<void> {
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
        lifecycle: this.lifecycleNow(),
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
    const unusable = this.unusable;
    const unsequenced = (unusable === null ? challengeAttemptRecord : unusableAttemptRecord)(state, {
      installation: this.adapters.device,
      startedAt: attempt.charge?.chargedAt ?? attempt.createdAt,
      endedAt: this.adapters.clock.now(),
      interrupted: this.attemptLifecycle.interrupted,
      performanceMs: this.attemptLifecycle.timed ? this.lifecycleNow().performanceMs : null,
      meteringBasis: attempt.admission.meteringBasis,
      allowancePolicyVersion: attempt.admission.allowancePolicyVersion ?? null,
      pacing: this.attemptLifecycle.pacing,
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
    if (!this.showResults) {
      this.showResults = true;
      this.attempt = null;
      this.state = null;
      return this.showNone(null);
    }
    this.current = { status: 'ended', record, position: Math.min(state.position + 1, state.content.length), explanation: unusable?.explanation ?? null };
    this.notify();
  }

  private adopt(stored: StoredAttempt, state: ChallengeState, facts: readonly ChallengeFact[] = [], options: { readonly quiet?: boolean } = {}): void {
    if (this.attempt?.attemptId !== stored.attemptId) {
      this.hold = null;
      this.attemptLifecycle = stored.lifecycle;
      this.timedSince = null;
      this.unusable = null;
    }
    this.attempt = stored;
    this.state = state;
    this.facts = facts;
    this.pending = null;
    if (!options.quiet) this.publish();
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
      const due = this.paceQueued;
      this.paceQueued = null;
      if (due !== null) void this.paceDue(due);
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

  // Spec 3 Attempt lifecycle › Performance timer
  performanceMs = (): number | null => (this.state && this.attemptLifecycle.timed ? this.lifecycleNow().performanceMs : null);

  private retime(): void {
    const state = this.state;
    const running = this.attemptLifecycle.timed && state !== null && TIMED_PHASES.has(state.phase) && !answeredLast(state) && !this.hold?.reached;
    if (running === (this.timedSince !== null)) return;
    this.attemptLifecycle = this.lifecycleNow();
    this.timedSince = running ? this.adapters.clock.now() : null;
  }

  // TODO(#117)
  private lifecycleNow(): AttemptLifecycle {
    const since = this.timedSince;
    return since === null ? this.attemptLifecycle : { ...this.attemptLifecycle, performanceMs: this.attemptLifecycle.performanceMs + (this.adapters.clock.now() - since) };
  }

  private publish(): void {
    if (this.current.status === 'ended') return;
    this.retime();
    if (!this.state) {
      if (this.current.status === 'none') this.showNone(this.current.problem);
      return;
    }
    this.current = { status: 'active', view: readChallengeView(this.state), facts: this.facts, busy: this.busy, save: this.pending ? 'failed' : 'saved', hold: this.hold, timer: this.attemptLifecycle.timed ? { ms: this.attemptLifecycle.performanceMs, since: this.timedSince } : null, pacing: this.attemptLifecycle.pacing };
    this.notify();
    this.armPace();
  }

  // Spec 3 Attempt lifecycle › Automatic pacing; #133 handoff
  private armPace(): void {
    const state = this.state;
    const ms = PACE_MS[this.attemptLifecycle.pacing];
    if (!state || ms === null || state.phase !== 'card' || this.hold || this.pending) return;
    const card = `${state.attempt.id}/${state.position}`;
    if (this.paceArmed?.card === card) return;
    const token = ++this.paceTokens;
    this.paceArmed = { card, token };
    void this.adapters.clock
      .sleep(ms)
      .then(() => this.paceDue(token))
      .catch(() => undefined);
  }

  private async paceDue(token: number): Promise<void> {
    if (this.paceArmed?.token !== token) return;
    if (this.busy) {
      this.paceQueued = token;
      return;
    }
    // Spec 3 Attempt lifecycle › Automatic pacing (speech backlog); Amendment 1 C1
    if (this.adapters.speech.speaking()) return this.pause('speech-backlog');
    await this.exclusive(async () => {
      if (this.paceArmed?.token !== token || this.state?.phase !== 'card' || this.hold || this.pending) return;
      await this.send({ kind: 'next-item' });
      await this.drive();
    });
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
