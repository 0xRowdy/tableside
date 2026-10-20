// The in-memory activity store: the store port's substitute until spec 2's
// SQLite store. Values are kept as JSON text so callers never share objects
// with it, and one queue serializes every operation (the single writer).

import type {
  ActivityStore,
  CommitOutcome,
  CommittedTransition,
  CompletedPracticeSession,
  NewActivity,
  OutgoingSyncRecord,
  StoredActivity,
  TransitionCommit,
} from './store';

type Operation = 'createActivity' | 'commitTransition' | 'complete' | 'readReceipt';

export class StoreWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoreWriteError';
  }
}

interface Row {
  activity: string;
  transitions: Map<string, string>;
  effects: Set<string>;
}

export class MemoryActivityStore implements ActivityStore {
  private readonly rows = new Map<string, Row>();
  private readonly outgoing: string[] = [];
  private queue: Promise<unknown> = Promise.resolve();
  private readonly failures: { operation: Operation; when: 'before' | 'after' }[] = [];

  /**
   * Failure injection: the next call of `operation` fails. "before" writes
   * nothing (a write or read failure); "after" writes, then fails the acknowledgement.
   */
  failNext(operation: Operation, when: 'before' | 'after'): void {
    this.failures.push({ operation, when });
  }

  createActivity(activity: NewActivity): Promise<StoredActivity> {
    return this.injectable('createActivity', () => {
      const existing = this.rows.get(activity.activityId);
      if (existing) return parse<StoredActivity>(existing.activity);
      const stored: StoredActivity = { ...activity, sequence: 0, completion: null };
      this.rows.set(activity.activityId, { activity: JSON.stringify(stored), transitions: new Map(), effects: new Set() });
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
      if (activity.sequence !== commit.priorSequence) return { status: 'sequence-conflict', sequence: activity.sequence };
      for (const effect of commit.effects) {
        const { grant, activity: owner, sequence } = effect.effectId;
        row.effects.add(JSON.stringify([grant, owner, sequence]));
      }
      const transition: CommittedTransition = { receipt: commit.receipt, checkpoint: commit.checkpoint, facts: commit.facts };
      row.transitions.set(commit.receipt.commandId, JSON.stringify(transition));
      row.activity = JSON.stringify({ ...activity, checkpoint: commit.checkpoint, sequence: commit.priorSequence + 1 });
      return { status: 'committed' };
    });
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
const clone = <T>(value: T): T => parse<T>(JSON.stringify(value));
