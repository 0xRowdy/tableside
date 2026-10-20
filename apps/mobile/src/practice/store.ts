// The durable activity store port. The practice controller is its only caller.
// Spec 1 ships the in-memory implementation (memory-store.ts); spec 2's SQLite
// store implements this same interface. Every operation is durable when its
// promise resolves; a rejected promise is an uncertain acknowledgement (the
// write may or may not have happened), which the caller resolves by reading.
// Every implementation must pass the contract suite in testing/store-contract.ts.

import type { ActivitySpecification, DomainFact, RandomStreamIdentity, Receipt, VersionedIdentity } from '@tableside/engine';

/**
 * An allowance effect (spec 5): a turn charge committed with the transition that
 * begins the turn, or a time-usage checkpoint. Spec 1 never produces one.
 */
export interface AllowanceEffect {
  /** Stable identity: the store records an effect id once, so a replayed or recovered transition never charges twice. */
  readonly effectId: { readonly grant: string; readonly activity: string; readonly sequence: number };
  /** For example a turn charge or a time-usage checkpoint. */
  readonly kind: string;
  /** Canonical amount in the effect's own unit. */
  readonly amount: string;
}

export interface NewActivity {
  readonly activityId: string;
  readonly specification: ActivitySpecification;
  /** The random identity, recorded before any content is generated from it. */
  readonly random: RandomStreamIdentity;
  /** Canonical checkpoint of the initial state (sequence 0). */
  readonly checkpoint: string;
  readonly createdAt: number;
}

export interface StoredActivity extends NewActivity {
  /** Canonical checkpoint of the latest committed state. */
  readonly checkpoint: string;
  /** The sequence the next command must carry. */
  readonly sequence: number;
  readonly completion: CompletedPracticeSession | null;
}

/** One committed transition: everything step 3 of the durability protocol writes atomically. */
export interface TransitionCommit {
  readonly activityId: string;
  /** The commit applies only if the stored sequence still equals this. */
  readonly priorSequence: number;
  /** Canonical checkpoint of the new state, whose sequence is priorSequence + 1. */
  readonly checkpoint: string;
  readonly receipt: Receipt;
  /** Generated outcomes, settlement and balance facts, in engine order. */
  readonly facts: readonly DomainFact[];
  readonly effects: readonly AllowanceEffect[];
}

export type CommitOutcome =
  | { readonly status: 'committed' }
  /** This command (by receipt command id) was committed before: a second delivery; nothing was written. */
  | { readonly status: 'already-committed'; readonly transition: CommittedTransition }
  /** Another transition already committed at this sequence; nothing was written. */
  | { readonly status: 'sequence-conflict'; readonly sequence: number };

export interface CommittedTransition {
  readonly receipt: Receipt;
  /** Checkpoint as of this transition. */
  readonly checkpoint: string;
  readonly facts: readonly DomainFact[];
}

/** The completed practice session record (its full field set grows with #79). */
export interface CompletedPracticeSession {
  readonly activityId: string;
  readonly game: 'roulette';
  readonly mode: 'free-play';
  readonly identities: {
    readonly engine: string;
    readonly rules: VersionedIdentity;
    readonly strategy: VersionedIdentity | null;
    readonly reference: VersionedIdentity | null;
  };
  readonly buyIn: string;
  readonly rebuys: readonly string[];
  readonly cumulativeFunding: string;
  readonly finalCashOut: string;
  /** Final cash-out minus cumulative funding. */
  readonly netResult: string;
  readonly completedAt: number;
}

/** A durable outgoing synchronization record (consumed by spec 2). */
export interface OutgoingSyncRecord {
  readonly id: string;
  readonly kind: 'completed-practice-session';
  readonly record: CompletedPracticeSession;
}

export interface ActivityStore {
  /** Durability step 1. Idempotent by activity id: a retry returns the activity already stored, unchanged. */
  createActivity(activity: NewActivity): Promise<StoredActivity>;
  load(activityId: string): Promise<StoredActivity | null>;
  /** The unfinished activity (not yet completed), if any. */
  findUnfinished(): Promise<StoredActivity | null>;
  /**
   * Durability step 3, conditioned on the prior sequence. A commit whose command
   * id is already committed is a duplicate delivery and returns that transition.
   */
  commitTransition(commit: TransitionCommit): Promise<CommitOutcome>;
  /** Time-usage checkpoints between transitions, through the same single writer. Idempotent by effect id. */
  recordEffects(activityId: string, effects: readonly AllowanceEffect[]): Promise<void>;
  /** Every allowance effect recorded for the activity, in the order first recorded. */
  readEffects(activityId: string): Promise<readonly AllowanceEffect[]>;
  /** The committed transition for a command id, for resolving an uncertain acknowledgement. */
  readReceipt(activityId: string, commandId: string): Promise<CommittedTransition | null>;
  /**
   * Durability step 5: records the final result and its outgoing synchronization
   * record together, once. A repeat returns the result already recorded.
   */
  complete(record: CompletedPracticeSession): Promise<CompletedPracticeSession>;
  readOutgoing(): Promise<readonly OutgoingSyncRecord[]>;
}
