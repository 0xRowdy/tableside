// Spec 1 Durability

import type { ActivitySpecification, CompletedPracticeSessionRecord, DomainFact, MeteringBasis, RandomStreamIdentity, Receipt } from '@tableside/engine';

// Spec 1 Amendment 4 A5
export interface AllowanceEffect {
  readonly effectId: { readonly grant: string; readonly activity: string; readonly sequence: number };
  readonly kind: string;
  readonly amount: string;
}

export type { MeteringBasis };

export interface NewActivity {
  readonly activityId: string;
  readonly admission: {
    readonly provenance: string;
    readonly meteringBasis: MeteringBasis;
    // Spec 1 Amendment 3 §4
    readonly allowancePolicyVersion?: string;
    // Spec 1 Amendment 4 A4
    readonly timeGrant?: string;
  };
  readonly specification: ActivitySpecification;
  readonly random: RandomStreamIdentity;
  readonly checkpoint: string;
  readonly createdAt: number;
}

export interface StoredActivity extends NewActivity {
  readonly checkpoint: string;
  readonly sequence: number;
  readonly completion: CompletedPracticeSession | null;
  readonly incomplete: IncompleteReason | null;
}

// #80
export type IncompleteReason =
  | { readonly kind: 'quarantined'; readonly entry: string; readonly listVersion: number }
  | { readonly kind: 'damaged'; readonly detail: string };

export interface TransitionCommit {
  readonly activityId: string;
  readonly priorSequence: number;
  readonly checkpoint: string;
  readonly receipt: Receipt;
  readonly facts: readonly DomainFact[];
  readonly effects: readonly AllowanceEffect[];
}

export type CommitOutcome =
  | { readonly status: 'committed' }
  | { readonly status: 'already-committed'; readonly transition: CommittedTransition }
  | { readonly status: 'sequence-conflict'; readonly sequence: number };

export interface CommittedTransition {
  readonly receipt: Receipt;
  readonly checkpoint: string;
  readonly facts: readonly DomainFact[];
}

export type CompletedPracticeSession = CompletedPracticeSessionRecord;

export interface OutgoingSyncRecord {
  readonly id: string;
  readonly kind: 'completed-practice-session';
  readonly record: CompletedPracticeSession;
}

export interface ActivityStore {
  createActivity(activity: NewActivity): Promise<StoredActivity>;
  load(activityId: string): Promise<StoredActivity | null>;
  findUnfinished(): Promise<StoredActivity | null>;
  commitTransition(commit: TransitionCommit): Promise<CommitOutcome>;
  recordEffects(activityId: string, effects: readonly AllowanceEffect[]): Promise<void>;
  readEffects(activityId: string): Promise<readonly AllowanceEffect[]>;
  readTransitions(activityId: string): Promise<readonly CommittedTransition[]>;
  readReceipt(activityId: string, commandId: string): Promise<CommittedTransition | null>;
  complete(record: CompletedPracticeSession): Promise<CompletedPracticeSession>;
  readOutgoing(): Promise<readonly OutgoingSyncRecord[]>;
  markIncomplete(activityId: string, reason: IncompleteReason): Promise<StoredActivity>;
}
