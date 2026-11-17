// Spec 3 Synchronized record types › Challenge attempt, Amendment 4 §1; #158, #133

import type { VersionedIdentity } from './activity';
import { CHALLENGE_METRICS, challengeResults, type ChallengeCategory, type ChallengeMetrics, type ChallengeState, type ChallengeVariant, type ReviewFact } from './challenge';
import type { RandomStreamIdentity } from './random';
import type { MeteringBasis } from './record';

export const CHALLENGE_RECORD_VERSION = 1 as const;

export type AssistanceClass = 'learn' | 'assisted-check' | 'unassisted-check';

export type ChallengePacing = 'self-paced' | '3s' | '2s' | '1s';

// Spec 3 Comparison groups
export interface TableGroupKey {
  readonly rules: VersionedIdentity;
  readonly penetration: number;
  readonly extraPlayers: number;
  readonly seat: 'observe' | 'play';
  readonly countingMode: 'basic' | 'deviations' | null;
  readonly betSchedule: boolean;
  readonly baseWager: string | null;
  readonly startingBalance: string | null;
  readonly checkpointInterval: number;
}

export interface ChallengeGroupKey {
  readonly category: ChallengeCategory;
  readonly variant: ChallengeVariant;
  readonly assistanceClass: AssistanceClass;
  readonly countRevealed: boolean;
  readonly content: VersionedIdentity;
  readonly reference: VersionedIdentity | null;
  readonly length: number;
  readonly pacing: ChallengePacing;
  readonly table: TableGroupKey | null;
}

// Spec 3 Attempt lifecycle
export type AttemptEndingReason = 'completed' | 'abandoned' | 'insufficient-funds' | 'unusable';

export interface ChallengeFinances {
  readonly startingBalance: string;
  readonly finishingBalance: string;
  readonly net: string;
}

export interface ChallengeAttemptRecord {
  readonly recordVersion: typeof CHALLENGE_RECORD_VERSION;
  readonly attemptId: string;
  readonly owner: string;
  readonly installation: string;
  readonly deviceSequence: number;
  readonly groupKey: ChallengeGroupKey;
  readonly identities: {
    readonly engine: string;
    readonly content: VersionedIdentity;
    readonly reference: VersionedIdentity | null;
    readonly random: RandomStreamIdentity;
  };
  readonly endingReason: AttemptEndingReason;
  readonly metrics: ChallengeMetrics;
  readonly review: readonly ReviewFact[];
  readonly assistanceStep: number | null;
  readonly interrupted: boolean;
  readonly performanceMs: number | null;
  readonly finances: ChallengeFinances | null;
  readonly allowancePolicyVersion: string | null;
  readonly meteringBasis: MeteringBasis;
  readonly startedAt: number;
  readonly endedAt: number;
}

export type UnsequencedAttemptRecord = Omit<ChallengeAttemptRecord, 'deviceSequence'>;

export interface AttemptRecordContext {
  readonly installation: string;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly interrupted: boolean;
  readonly performanceMs: number | null;
  readonly meteringBasis: MeteringBasis;
  readonly allowancePolicyVersion: string | null;
}

export function challengeGroupKey(state: ChallengeState): ChallengeGroupKey {
  return {
    category: state.identities.category,
    variant: state.variant,
    assistanceClass: state.variant === 'learn' ? 'learn' : state.revealedAt === null ? 'unassisted-check' : 'assisted-check',
    countRevealed: state.revealedAt !== null,
    content: { ...state.identities.content },
    reference: state.identities.reference && { ...state.identities.reference },
    length: state.content.length,
    pacing: 'self-paced',
    table: null,
  };
}

export function challengeAttemptRecord(state: ChallengeState, context: AttemptRecordContext): UnsequencedAttemptRecord {
  const results = challengeResults(state);
  if (!results) throw new Error(`attempt ${state.attempt.id} has not ended`);
  return recordOf(state, context, { ending: results.ending, metrics: results.metrics, review: results.review, assistanceStep: results.assistanceStep });
}

// Spec 3 Attempt lifecycle (unusable), Amendment 1 C3; #135
export function unusableAttemptRecord(state: ChallengeState, context: AttemptRecordContext): UnsequencedAttemptRecord {
  const metrics = Object.fromEntries(CHALLENGE_METRICS.map((metric) => [metric, null])) as unknown as ChallengeMetrics;
  return recordOf(state, context, { ending: 'unusable', metrics, review: [], assistanceStep: state.revealedAt });
}

function recordOf(
  state: ChallengeState,
  context: AttemptRecordContext,
  results: { readonly ending: AttemptEndingReason; readonly metrics: ChallengeMetrics; readonly review: readonly ReviewFact[]; readonly assistanceStep: number | null },
): UnsequencedAttemptRecord {
  const { identities } = state;
  return {
    recordVersion: CHALLENGE_RECORD_VERSION,
    attemptId: state.attempt.id,
    owner: state.attempt.owner,
    installation: context.installation,
    groupKey: challengeGroupKey(state),
    identities: {
      engine: identities.engine,
      content: { ...identities.content },
      reference: identities.reference && { ...identities.reference },
      random: { protocol: identities.random.protocol, key: [...identities.random.key], session: [...identities.random.session] },
    },
    endingReason: results.ending,
    metrics: results.metrics,
    review: results.review,
    assistanceStep: results.assistanceStep,
    interrupted: context.interrupted,
    performanceMs: context.performanceMs,
    finances: null,
    allowancePolicyVersion: context.allowancePolicyVersion,
    meteringBasis: context.meteringBasis,
    startedAt: context.startedAt,
    endedAt: context.endedAt,
  };
}
