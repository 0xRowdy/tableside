// #158
import type { ChallengeAttemptRecord, UnsequencedAttemptRecord } from '@tableside/engine';

import { StoreWriteError } from '../practice/memory-store';
import type { AcceptedLessonEvent, LessonProgressEvent, LessonSync, UnsequencedLessonEvent } from './lesson-progress';
import { milestoneIdentity, milestoneSlot, type MilestoneSync, type ReadinessMilestoneRecord } from './readiness-milestone';
import { withLifecycle, type AcceptedAttempt, type AttemptLifecycle, type AttemptCommitOutcome, type AttemptTransitionCommit, type CommittedAttemptTransition, type NewAttempt, type StoredAttempt, type TrainingStore } from './store';

type Operation = 'createAttempt' | 'commitAttemptTransition' | 'saveAttemptLifecycle' | 'recordAttempt' | 'readAttemptReceipt' | 'writePreference' | 'recordLessonEvent' | 'recordMilestone';

interface Row {
  attempt: string;
  transitions: Map<string, string>;
}

export class MemoryTrainingDisk {
  readonly attempts = new Map<string, Row>();
  readonly preferences = new Map<string, string>();
  lastDeviceSequence = 0;
  readonly lessonEvents: string[] = [];
  readonly milestones: string[] = [];
  // #142
  readonly accepted: string[] = [];
  // #147
  readonly acceptedLessonEvents: string[] = [];
  readonly refusedLessonEvents: string[] = [];
  // #148
  readonly acceptedMilestones: string[] = [];
  readonly refusedMilestones: string[] = [];
}

export class MemoryTrainingStore implements TrainingStore {
  private queue: Promise<unknown> = Promise.resolve();
  private readonly failures: { operation: Operation; when: 'before' | 'after' }[] = [];

  constructor(private readonly disk = new MemoryTrainingDisk()) {}

  reopen(): MemoryTrainingStore {
    return new MemoryTrainingStore(this.disk);
  }

  failNext(operation: Operation, when: 'before' | 'after'): void {
    this.failures.push({ operation, when });
  }

  createAttempt(attempt: NewAttempt): Promise<StoredAttempt> {
    return this.injectable('createAttempt', () => {
      const existing = this.disk.attempts.get(attempt.attemptId);
      if (existing) return storedAttempt(existing.attempt);
      if (this.unfinished()) throw new StoreWriteError('this device already has an unfinished challenge attempt');
      const stored: StoredAttempt = { ...attempt, sequence: 0, charge: null, record: null };
      this.disk.attempts.set(attempt.attemptId, { attempt: JSON.stringify(stored), transitions: new Map() });
      return clone(stored);
    });
  }

  loadAttempt(attemptId: string): Promise<StoredAttempt | null> {
    return this.enqueue(() => {
      const row = this.disk.attempts.get(attemptId);
      return row ? storedAttempt(row.attempt) : null;
    });
  }

  findUnfinishedAttempt(): Promise<StoredAttempt | null> {
    return this.enqueue(() => this.unfinished());
  }

  commitAttemptTransition(commit: AttemptTransitionCommit): Promise<AttemptCommitOutcome> {
    return this.injectable('commitAttemptTransition', (): AttemptCommitOutcome => {
      const row = this.require(commit.attemptId);
      const attempt = parse<StoredAttempt>(row.attempt);
      const earlier = row.transitions.get(commit.receipt.commandId);
      if (earlier !== undefined) return { status: 'already-committed', transition: parse<CommittedAttemptTransition>(earlier) };
      if (attempt.sequence !== commit.priorSequence) return { status: 'sequence-conflict', sequence: attempt.sequence };
      const transition: CommittedAttemptTransition = { receipt: commit.receipt, checkpoint: commit.checkpoint, facts: commit.facts };
      row.transitions.set(commit.receipt.commandId, JSON.stringify(transition));
      row.attempt = JSON.stringify({ ...attempt, checkpoint: commit.checkpoint, sequence: commit.priorSequence + 1, charge: attempt.charge ?? commit.charge, lifecycle: commit.lifecycle });
      return { status: 'committed' };
    });
  }

  readAttemptReceipt(attemptId: string, commandId: string): Promise<CommittedAttemptTransition | null> {
    return this.injectable('readAttemptReceipt', () => {
      const text = this.disk.attempts.get(attemptId)?.transitions.get(commandId);
      return text === undefined ? null : parse<CommittedAttemptTransition>(text);
    });
  }

  discardUnchargedAttempt(attemptId: string): Promise<void> {
    return this.enqueue(() => {
      const row = this.disk.attempts.get(attemptId);
      if (row && parse<StoredAttempt>(row.attempt).sequence === 0) this.disk.attempts.delete(attemptId);
    });
  }

  saveAttemptLifecycle(attemptId: string, lifecycle: AttemptLifecycle): Promise<void> {
    return this.injectable('saveAttemptLifecycle', () => {
      const row = this.require(attemptId);
      const attempt = storedAttempt(row.attempt);
      if (!attempt.record) row.attempt = JSON.stringify({ ...attempt, lifecycle });
    });
  }

  recordAttempt(record: UnsequencedAttemptRecord): Promise<ChallengeAttemptRecord> {
    return this.injectable('recordAttempt', () => {
      const row = this.require(record.attemptId);
      const attempt = parse<StoredAttempt>(row.attempt);
      if (attempt.record) return attempt.record;
      const sequenced: ChallengeAttemptRecord = { ...record, deviceSequence: ++this.disk.lastDeviceSequence };
      row.attempt = JSON.stringify({ ...attempt, record: sequenced });
      return clone(sequenced);
    });
  }

  readAttemptRecords(): Promise<readonly ChallengeAttemptRecord[]> {
    return this.enqueue(() =>
      [...this.disk.attempts.values()]
        .flatMap((row) => parse<StoredAttempt>(row.attempt).record ?? [])
        .sort((a, b) => a.deviceSequence - b.deviceSequence),
    );
  }

  // #142
  readAcceptedAttempts(): Promise<readonly AcceptedAttempt[]> {
    return this.enqueue(() => this.disk.accepted.map((text) => parse<AcceptedAttempt>(text)));
  }

  // #142
  acceptAttempts(attempts: readonly AcceptedAttempt[]): Promise<void> {
    return this.enqueue(() => {
      this.disk.accepted.push(...attempts.map((attempt) => JSON.stringify(attempt)));
    });
  }

  readPreference(key: string): Promise<string | null> {
    return this.enqueue(() => this.disk.preferences.get(key) ?? null);
  }

  writePreference(key: string, value: string): Promise<void> {
    return this.injectable('writePreference', () => {
      this.disk.preferences.set(key, value);
    });
  }

  // #143
  recordLessonEvent(event: UnsequencedLessonEvent): Promise<LessonProgressEvent> {
    return this.injectable('recordLessonEvent', () => {
      const events = this.disk.lessonEvents.map((text) => parse<LessonProgressEvent>(text));
      const existing = events.find((earlier) => earlier.eventId === event.eventId);
      if (existing) return existing;
      const sequenced: LessonProgressEvent = { ...event, deviceSequence: events.length + 1 };
      this.disk.lessonEvents.push(JSON.stringify(sequenced));
      return clone(sequenced);
    });
  }

  readLessonEvents(): Promise<readonly LessonProgressEvent[]> {
    return this.enqueue(() => this.disk.lessonEvents.map((text) => parse<LessonProgressEvent>(text)));
  }

  // #147
  readLessonSync(): Promise<LessonSync> {
    return this.enqueue(() => ({
      accepted: this.disk.acceptedLessonEvents.map((text) => parse<AcceptedLessonEvent>(text)),
      refused: [...this.disk.refusedLessonEvents],
    }));
  }

  // #147
  acceptLessonEvents(events: readonly AcceptedLessonEvent[]): Promise<void> {
    return this.enqueue(() => {
      this.disk.acceptedLessonEvents.push(...events.map((event) => JSON.stringify(event)));
    });
  }

  // #147
  refuseLessonEvents(eventIds: readonly string[]): Promise<void> {
    return this.enqueue(() => {
      this.disk.refusedLessonEvents.push(...eventIds);
    });
  }

  // #141
  recordMilestone(milestone: ReadinessMilestoneRecord): Promise<ReadinessMilestoneRecord> {
    return this.injectable('recordMilestone', () => {
      const group = milestoneSlot(milestone);
      const at = this.disk.milestones.findIndex((text) => milestoneSlot(parse<ReadinessMilestoneRecord>(text)) === group);
      const existing = at === -1 ? null : parse<ReadinessMilestoneRecord>(this.disk.milestones[at] as string);
      // #148
      if (existing && !this.disk.refusedMilestones.includes(milestoneIdentity(existing))) return existing;
      if (existing) this.disk.milestones.splice(at, 1);
      this.disk.milestones.push(JSON.stringify(milestone));
      return clone(milestone);
    });
  }

  readMilestones(): Promise<readonly ReadinessMilestoneRecord[]> {
    return this.enqueue(() => this.disk.milestones.map((text) => parse<ReadinessMilestoneRecord>(text)));
  }

  // #148
  readMilestoneSync(): Promise<MilestoneSync> {
    return this.enqueue(() => ({
      accepted: this.disk.acceptedMilestones.map((text) => parse<ReadinessMilestoneRecord>(text)),
      refused: [...this.disk.refusedMilestones],
    }));
  }

  // #148
  acceptMilestones(milestones: readonly ReadinessMilestoneRecord[]): Promise<void> {
    return this.enqueue(() => {
      this.disk.acceptedMilestones.push(...milestones.map((milestone) => JSON.stringify(milestone)));
    });
  }

  // #148
  refuseMilestones(identities: readonly string[]): Promise<void> {
    return this.enqueue(() => {
      this.disk.refusedMilestones.push(...identities);
    });
  }

  private unfinished(): StoredAttempt | null {
    for (const row of this.disk.attempts.values()) {
      const attempt = storedAttempt(row.attempt);
      if (!attempt.record) return attempt;
    }
    return null;
  }

  private require(attemptId: string): Row {
    const row = this.disk.attempts.get(attemptId);
    if (!row) throw new StoreWriteError(`no attempt ${attemptId}`);
    return row;
  }

  private injectable<T>(operation: Operation, run: () => T): Promise<T> {
    return this.enqueue(() => {
      const index = this.failures.findIndex((failure) => failure.operation === operation);
      const failure = index >= 0 ? this.failures.splice(index, 1)[0] : undefined;
      if (failure?.when === 'before') throw new StoreWriteError(`${operation} failed before writing`);
      const result = run();
      if (failure?.when === 'after') throw new StoreWriteError(`${operation} wrote but its acknowledgement was lost`);
      return result;
    });
  }

  private enqueue<T>(run: () => T): Promise<T> {
    const next = this.queue.then(run);
    this.queue = next.catch(() => undefined);
    return next;
  }
}

const parse = <T>(text: string): T => JSON.parse(text) as T;
const storedAttempt = (text: string): StoredAttempt => withLifecycle(parse<Omit<StoredAttempt, 'lifecycle'> & Partial<Pick<StoredAttempt, 'lifecycle'>>>(text));
const clone = <T>(value: T): T => parse<T>(JSON.stringify(value));
