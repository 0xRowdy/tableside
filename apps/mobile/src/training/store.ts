// Spec 3 Attempt lifecycle › Durability; Amendment 1 C6, C7; #158

import type { ChallengeAttemptRecord, ChallengeFact, ChallengeSpecification, RandomStreamIdentity, Receipt, UnsequencedAttemptRecord } from '@tableside/engine';

import type { AllowanceEffect, MeteringBasis } from '../practice/store';
import type { LessonProgressEvent, UnsequencedLessonEvent } from './lesson-progress';

export const CHALLENGE_ATTEMPT_RECORD_TYPE = 'challenge-attempt';

// Spec 3 Attempt lifecycle › Charge
export const CHALLENGE_CHARGE = 'challenge-attempt';

export interface Admission {
  readonly provenance: string;
  readonly meteringBasis: MeteringBasis;
  readonly allowancePolicyVersion?: string;
}

// Spec 3 Attempt lifecycle › Performance timer; #135
export interface AttemptTiming {
  readonly timed: boolean;
  readonly performanceMs: number;
}

export const UNTIMED: AttemptTiming = { timed: false, performanceMs: 0 };

export interface NewAttempt {
  readonly attemptId: string;
  readonly admission: Admission;
  readonly specification: ChallengeSpecification;
  readonly random: RandomStreamIdentity;
  readonly checkpoint: string;
  readonly createdAt: number;
  readonly timing: AttemptTiming;
}

// Spec 3 Amendment 1 C6
export interface AttemptCharge {
  readonly effect: AllowanceEffect;
  readonly chargedAt: number;
}

export interface StoredAttempt extends NewAttempt {
  readonly sequence: number;
  readonly charge: AttemptCharge | null;
  readonly record: ChallengeAttemptRecord | null;
}

export interface AttemptTransitionCommit {
  readonly attemptId: string;
  readonly priorSequence: number;
  readonly checkpoint: string;
  readonly receipt: Receipt;
  readonly facts: readonly ChallengeFact[];
  // Spec 3 Amendment 1 C6
  readonly charge: AttemptCharge | null;
  readonly timing: AttemptTiming;
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
  // Spec 3 Amendment 1 C6
  discardUnchargedAttempt(attemptId: string): Promise<void>;
  // Spec 3 Synchronized record types › Challenge attempt
  recordAttempt(record: UnsequencedAttemptRecord): Promise<ChallengeAttemptRecord>;
  readAttemptRecords(): Promise<readonly ChallengeAttemptRecord[]>;
}

// Spec 3 Amendment 1 C7
export interface DevicePreferences {
  readPreference(key: string): Promise<string | null>;
  writePreference(key: string, value: string): Promise<void>;
}

// Spec 3 Synchronized record types › Lesson-progress event; #143
export interface LessonProgressStore {
  recordLessonEvent(event: UnsequencedLessonEvent): Promise<LessonProgressEvent>;
  readLessonEvents(): Promise<readonly LessonProgressEvent[]>;
}

export type TrainingStore = ChallengeStore & DevicePreferences & LessonProgressStore;
