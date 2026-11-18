// Spec 3 Synchronized record types › Readiness milestone; Amendment 1 B3; #141, #148

import type { ChallengeAttemptSummary, ChallengeGroupKey, ChallengeMetric } from '@tableside/engine';

import { challengeAttempt } from './challenge-attempt-record';
import type { RecordType } from './sync/registry';
import { isJsonObject, isPositiveInteger } from './values';

export const READINESS_MILESTONE_RECORD_VERSION = 1 as const;

export interface ReadinessMilestoneRecord {
  readonly recordVersion: typeof READINESS_MILESTONE_RECORD_VERSION;
  readonly owner: string;
  readonly installation: string;
  readonly groupKey: ChallengeGroupKey;
  readonly attempts: readonly [first: string, second: string];
  // #148
  readonly deviceSequences: readonly [first: number, second: number];
  readonly earnedAt: number;
}

// Spec 3 Comparison groups (Readiness streak); private.readiness_streak_effect
const COUNTING_METRICS: readonly ChallengeMetric[] = ['card-values', 'running-count', 'true-count'];
const READINESS_THRESHOLD = 0.95;

type StreakAttempt = Pick<ChallengeAttemptSummary, 'groupKey' | 'endingReason' | 'metrics'>;

export function meetsReadinessThreshold(attempt: Pick<ChallengeAttemptSummary, 'metrics'>): boolean {
  const tested = COUNTING_METRICS.flatMap((metric) => attempt.metrics[metric] ?? []).filter((result) => result.total > 0);
  return tested.length > 0 && tested.every((result) => result.correct >= READINESS_THRESHOLD * result.total);
}

// Spec 3 Comparison groups (Readiness streak); Amendment 1 C2, C3
export function readinessStreakEffect(attempt: StreakAttempt): 'advances' | 'breaks' | 'neutral' {
  const { variant, assistanceClass } = attempt.groupKey;
  if (variant !== 'check') return 'neutral';
  switch (attempt.endingReason) {
    case 'abandoned':
    case 'insufficient-funds':
      return 'breaks';
    case 'unusable':
      return 'neutral';
    case 'completed':
      if (assistanceClass !== 'unassisted-check') return 'neutral';
      return meetsReadinessThreshold(attempt) ? 'advances' : 'breaks';
  }
}

const isPair = (value: unknown, test: (member: unknown) => boolean): value is readonly [unknown, unknown] =>
  Array.isArray(value) && value.length === 2 && value.every(test);

function isMilestone(value: unknown): value is ReadinessMilestoneRecord {
  return (
    isJsonObject(value) &&
    value.recordVersion === READINESS_MILESTONE_RECORD_VERSION &&
    typeof value.owner === 'string' &&
    typeof value.installation === 'string' &&
    isJsonObject(value.groupKey) &&
    isPair(value.attempts, (id) => typeof id === 'string') &&
    isPair(value.deviceSequences, isPositiveInteger) &&
    (value.deviceSequences[0] as number) < (value.deviceSequences[1] as number) &&
    Number.isSafeInteger(value.earnedAt)
  );
}

export const readinessMilestone: RecordType<ReadinessMilestoneRecord> = {
  name: 'readiness-milestone',
  kind: 'immutable-result',
  payloadVersion: 1,
  identity: { scheme: 'installation-attempts', of: (milestone) => `${milestone.installation}/${milestone.attempts[0]}/${milestone.attempts[1]}` },
  isPayload: isMilestone,
  // Spec 3 Synchronized record types › Readiness milestone (Barrier)
  barriers: [challengeAttempt.name],
  affectedBy(barrier, milestone) {
    const attempt = barrier.payload as Partial<ChallengeAttemptSummary>;
    const [first, last] = milestone.deviceSequences;
    return attempt.installation === milestone.installation && typeof attempt.deviceSequence === 'number' && attempt.deviceSequence >= first && attempt.deviceSequence <= last;
  },
  acceptance: 'private.accept_readiness_milestone_v1',
  // Spec 3 Amendment 1 C8
  snapshot: 'private.snapshot_readiness_milestones',
  fromChange(change) {
    const record = isJsonObject(change) ? change.record : undefined;
    return isMilestone(record) ? record : null;
  },
  contribution: null,
  export: { csv: null, json: (milestone) => milestone },
  deletion: { serverTables: ['private.readiness_milestones'] },
};
