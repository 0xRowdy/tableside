// Spec 3 Attempt lifecycle › Durability; Amendment 1 C6, C7; #158

import type { ChallengeAttemptRecord, ChallengeFact, ChallengeSpecification, RandomStreamIdentity, Receipt, UnsequencedAttemptRecord } from '@tableside/engine';

import type { AllowanceEffect, MeteringBasis } from '../practice/store';

export const CHALLENGE_ATTEMPT_RECORD_TYPE = 'challenge-attempt';

// Spec 3 Attempt lifecycle › Charge: kind of the one allowance effect an attempt commits.
export const CHALLENGE_CHARGE = 'challenge-attempt';

export interface Admission {
  readonly provenance: string;
  readonly meteringBasis: MeteringBasis;
  readonly allowancePolicyVersion?: string;
}

export interface NewAttempt {
  readonly attemptId: string;
  readonly admission: Admission;
  readonly specification: ChallengeSpecification;
  readonly random: RandomStreamIdentity;
  readonly checkpoint: string;
  readonly createdAt: number;
}

export interface StoredAttempt extends NewAttempt {
  readonly sequence: number;
  readonly charge: AllowanceEffect | null;
  readonly record: ChallengeAttemptRecord | null;
}

export interface AttemptTransitionCommit {
  readonly attemptId: string;
  readonly priorSequence: number;
  readonly checkpoint: string;
  readonly receipt: Receipt;
  readonly facts: readonly ChallengeFact[];
  // Amendment 1 C6: the charge commits atomically with the first-content transition.
  readonly charge: AllowanceEffect | null;
}

export interface CommittedAttemptTransition {
  readonly receipt: Receipt;
  readonly checkpoint: string;
  readonly facts: readonly ChallengeFact[];
}

export type AttemptCommitOutcome =
  | { readonly status: 'committed' }
  | { readonly status: 'already-committed'; readonly transition: CommittedAttemptTransition }
  | { readonly status: 'sequence-conflict'; readonly sequence: number };

export interface ChallengeStore {
  createAttempt(attempt: NewAttempt): Promise<StoredAttempt>;
  loadAttempt(attemptId: string): Promise<StoredAttempt | null>;
  findUnfinishedAttempt(): Promise<StoredAttempt | null>;
  commitAttemptTransition(commit: AttemptTransitionCommit): Promise<AttemptCommitOutcome>;
  readAttemptReceipt(attemptId: string, commandId: string): Promise<CommittedAttemptTransition | null>;
  // Writes the attempt's one record, numbered in this installation's device sequence; a repeat returns the first.
  recordAttempt(record: UnsequencedAttemptRecord): Promise<ChallengeAttemptRecord>;
  readAttemptRecords(): Promise<readonly ChallengeAttemptRecord[]>;
}

// Amendment 1 C7: device-local preferences live in the account's local database, never synced or exported.
export interface DevicePreferences {
  readPreference(key: string): Promise<string | null>;
  writePreference(key: string, value: string): Promise<void>;
}

export type TrainingStore = ChallengeStore & DevicePreferences;
