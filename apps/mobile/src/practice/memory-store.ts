// The in-memory activity store: the store port's substitute until spec 2's
// SQLite store. Values are kept as JSON text so callers never share objects
// with it, and one queue serializes every operation (the single writer). The
// stored rows live in a MemoryDisk, so `reopen()` can simulate an app restart:
// a new store instance, with no queued work or injected failures, over the
// same durable data.

import type {
  ActivityStore,
  AllowanceEffect,
  CommitOutcome,
  CommittedTransition,
  CompletedPracticeSession,
  NewActivity,
  OutgoingSyncRecord,
  StoredActivity,
  TransitionCommit,
} from './store';

type Operation = 'createActivity' | 'commitTransition' | 'recordEffects' | 'complete' | 'readReceipt';

export class StoreWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoreWriteError';
  }
}

interface Row {
  activity: string;
  transitions: Map<string, string>;
  /** Effect text keyed by its effect id, in the order first recorded. */
  effects: Map<string, string>;
}

/** The durable part of the in-memory store. */
export class MemoryDisk {
  readonly rows = new Map<string, Row>();
  readonly outgoing: string[] = [];
}

export class MemoryActivityStore implements ActivityStore {
  private queue: Promise<unknown> = Promise.resolve();
  private readonly failures: { operation: Operation; when: 'before' | 'after' }[] = [];
  private full = false;

  constructor(private readonly disk = new MemoryDisk()) {}

  private get rows() {
    return this.disk.rows;
  }

  private get outgoing() {
    return this.disk.outgoing;
  }

  /** A new store over the same durable data, as after an app restart. */
  reopen(): MemoryActivityStore {
    return new MemoryActivityStore(this.disk);
  }

  /**
   * Failure injection: the next call of `operation` fails. "before" writes
   * nothing (a write or read failure); "after" writes, then fails the acknowledgement.
   */
  failNext(operation: Operation, when: 'before' | 'after'): void {
    this.failures.push({ operation, when });
  }

  /** Failure injection: while full, every write fails before writing (a full disk). */
  setFull(full: boolean): void {
    this.full = full;
  }

  createActivity(activity: NewActivity): Promise<StoredActivity> {
    return this.injectable('createActivity', () => {
      const existing = this.rows.get(activity.activityId);
      if (existing) return parse<StoredActivity>(existing.activity);
      const stored: StoredActivity = { ...activity, sequence: 0, completion: null };
      this.rows.set(activity.activityId, { activity: JSON.stringify(stored), transitions: new Map(), effects: new Map() });
      return clone(stored);
    });
  }

  load(activityId: string): Promise<StoredActivity | null> {
    return this.read(() => {
      const row = this.rows.get(activityId);
      return row ? parse<StoredActivity>(row.activity) : null;
    });
  }

  findUnfinished(): Promise<StoredActivity | null> {
    return this.read(() => {
      for (const row of this.rows.values()) {
        const activity = parse<StoredActivity>(row.activity);
        if (activity.completion === null) return activity;
      }
      return null;
    });
  }

  commitTransition(commit: TransitionCommit): Promise<CommitOutcome> {
    return this.injectable('commitTransition', (): CommitOutcome => {
      const row = this.require(commit.activityId);
      const activity = parse<StoredActivity>(row.activity);
      const earlier = row.transitions.get(commit.receipt.commandId);
      if (earlier !== undefined) return { status: 'already-committed', transition: parse<CommittedTransition>(earlier) };
      if (activity.sequence !== commit.priorSequence) return { status: 'sequence-conflict', sequence: activity.sequence };
      addEffects(row, commit.effects);
      const transition: CommittedTransition = { receipt: commit.receipt, checkpoint: commit.checkpoint, facts: commit.facts };
      row.transitions.set(commit.receipt.commandId, JSON.stringify(transition));
      row.activity = JSON.stringify({ ...activity, checkpoint: commit.checkpoint, sequence: commit.priorSequence + 1 });
      return { status: 'committed' };
    });
  }

  recordEffects(activityId: string, effects: readonly AllowanceEffect[]): Promise<void> {
    return this.injectable('recordEffects', () => addEffects(this.require(activityId), effects));
  }

  readEffects(activityId: string): Promise<readonly AllowanceEffect[]> {
    return this.read(() => [...(this.rows.get(activityId)?.effects.values() ?? [])].map((text) => parse<AllowanceEffect>(text)));
  }

  readReceipt(activityId: string, commandId: string): Promise<CommittedTransition | null> {
    return this.injectable('readReceipt', () => {
      const text = this.rows.get(activityId)?.transitions.get(commandId);
      return text === undefined ? null : parse<CommittedTransition>(text);
    });
  }

  complete(record: CompletedPracticeSession): Promise<CompletedPracticeSession> {
    return this.injectable('complete', () => {
      const row = this.require(record.activityId);
      const activity = parse<StoredActivity>(row.activity);
      if (activity.completion) return activity.completion;
      row.activity = JSON.stringify({ ...activity, completion: record });
      const sync: OutgoingSyncRecord = { id: `completed/${record.activityId}`, kind: 'completed-practice-session', record };
      this.outgoing.push(JSON.stringify(sync));
      return clone(record);
    });
  }

  readOutgoing(): Promise<readonly OutgoingSyncRecord[]> {
    return this.read(() => this.outgoing.map((text) => parse<OutgoingSyncRecord>(text)));
  }

  private require(activityId: string): Row {
    const row = this.rows.get(activityId);
    if (!row) throw new StoreWriteError(`no activity ${activityId}`);
    return row;
  }

  private read<T>(run: () => T): Promise<T> {
    return this.enqueue(run);
  }

  /** Runs an operation that failure injection can target. */
  private injectable<T>(operation: Operation, run: () => T): Promise<T> {
    return this.enqueue(() => {
      if (this.full && operation !== 'readReceipt') throw new StoreWriteError(`${operation} failed: the disk is full`);
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

function addEffects(row: Row, effects: readonly AllowanceEffect[]): void {
  for (const effect of effects) {
    const { grant, activity, sequence } = effect.effectId;
    const id = JSON.stringify([grant, activity, sequence]);
    if (!row.effects.has(id)) row.effects.set(id, JSON.stringify(effect));
  }
}

const parse = <T>(text: string): T => JSON.parse(text) as T;
const clone = <T>(value: T): T => parse<T>(JSON.stringify(value));
