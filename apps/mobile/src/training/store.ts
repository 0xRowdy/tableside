// Spec 3 Attempt lifecycle › Durability; Amendment 1 C6, C7; #158

import type { ChallengeAttemptRecord, ChallengeAttemptSummary, ChallengeFact, ChallengePacing, ChallengeSpecification, RandomStreamIdentity, Receipt, UnsequencedAttemptRecord } from '@tableside/engine';

import type { AllowanceEffect, MeteringBasis } from '../practice/store';
import type { LessonProgressEvent, LessonSync, UnsequencedLessonEvent } from './lesson-progress';
import type { MilestoneSync, ReadinessMilestoneRecord } from './readiness-milestone';

export const CHALLENGE_ATTEMPT_RECORD_TYPE = 'challenge-attempt';

// Spec 3 Attempt lifecycle › Charge
export const CHALLENGE_CHARGE = 'challenge-attempt';

export interface Admission {
  readonly provenance: string;
  readonly meteringBasis: MeteringBasis;
  readonly allowancePolicyVersion?: string;
}

// Spec 3 Attempt lifecycle › Pause, Performance timer, Automatic pacing; Amendment 1 C1; #135, #136
export interface AttemptLifecycle {
  readonly timed: boolean;
  readonly performanceMs: number;
  readonly interrupted: boolean;
  readonly pacing: ChallengePacing;
}

export const FRESH_LIFECYCLE: AttemptLifecycle = { timed: false, performanceMs: 0, interrupted: false, pacing: 'self-paced' };

// #135
export const withLifecycle = <T extends { readonly lifecycle?: AttemptLifecycle }>(body: T): T & { readonly lifecycle: AttemptLifecycle } => ({
  ...body,
  lifecycle: { ...FRESH_LIFECYCLE, ...body.lifecycle },
});

export interface NewAttempt {
  readonly attemptId: string;
  readonly admission: Admission;
  readonly specification: ChallengeSpecification;
  readonly random: RandomStreamIdentity;
  readonly checkpoint: string;
  readonly createdAt: number;
  readonly lifecycle: AttemptLifecycle;
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
  readonly lifecycle: AttemptLifecycle;
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
  // Spec 3 Attempt lifecycle › Pause; #135
  saveAttemptLifecycle(attemptId: string, lifecycle: AttemptLifecycle): Promise<void>;
  // Spec 3 Synchronized record types › Challenge attempt
  recordAttempt(record: UnsequencedAttemptRecord): Promise<ChallengeAttemptRecord>;
  readAttemptRecords(): Promise<readonly ChallengeAttemptRecord[]>;
  // #142
  readAcceptedAttempts(): Promise<readonly AcceptedAttempt[]>;
}

// Spec 3 Amendment 1 C8; #142
export type AcceptedAttempt = ChallengeAttemptSummary & { readonly review?: ChallengeAttemptRecord['review'] };

// Spec 3 Amendment 1 C7
export interface DevicePreferences {
  readPreference(key: string): Promise<string | null>;
  writePreference(key: string, value: string): Promise<void>;
}

// Spec 3 Synchronized record types › Lesson-progress event; #143
export interface LessonProgressStore {
  recordLessonEvent(event: UnsequencedLessonEvent): Promise<LessonProgressEvent>;
  readLessonEvents(): Promise<readonly LessonProgressEvent[]>;
  // #147
  readLessonSync(): Promise<LessonSync>;
}

// Spec 3 Synchronized record types › Readiness milestone; #141
export interface MilestoneStore {
  recordMilestone(milestone: ReadinessMilestoneRecord): Promise<ReadinessMilestoneRecord>;
  readMilestones(): Promise<readonly ReadinessMilestoneRecord[]>;
  // #148
  readMilestoneSync(): Promise<MilestoneSync>;
}

export type TrainingStore = ChallengeStore & DevicePreferences & LessonProgressStore & MilestoneStore;
