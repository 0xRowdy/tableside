// Spec 3 Synchronized record types › Challenge attempt; Amendment 1 C8, Amendment 4 §1; #142

import { ATTEMPT_ENDING_REASONS, CHALLENGE_RECORD_VERSION, type ChallengeAttemptRecord, type ChallengeAttemptSummary, type MeteringBasis } from '@tableside/engine';

import type { RecordType } from './sync/registry';

// Spec 3 Amendment 4 §1
const METERING_BASES: readonly MeteringBasis[] = ['challenge-attempt', 'premium'];

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isCount = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 1;
const isNullOr = (value: unknown, test: (value: unknown) => boolean) => value === null || test(value);

function isSummary(value: unknown): value is ChallengeAttemptSummary {
  return (
    isObject(value) &&
    value.recordVersion === CHALLENGE_RECORD_VERSION &&
    typeof value.attemptId === 'string' &&
    typeof value.owner === 'string' &&
    typeof value.installation === 'string' &&
    isCount(value.deviceSequence) &&
    isObject(value.groupKey) &&
    isObject(value.identities) &&
    ATTEMPT_ENDING_REASONS.includes(value.endingReason as ChallengeAttemptRecord['endingReason']) &&
    isObject(value.metrics) &&
    isNullOr(value.assistanceStep, Number.isSafeInteger) &&
    typeof value.interrupted === 'boolean' &&
    isNullOr(value.performanceMs, Number.isFinite) &&
    isNullOr(value.finances, isObject) &&
    isNullOr(value.allowancePolicyVersion, (version) => typeof version === 'string') &&
    METERING_BASES.includes(value.meteringBasis as MeteringBasis) &&
    Number.isSafeInteger(value.startedAt) &&
    Number.isSafeInteger(value.endedAt)
  );
}

const isRecord = (value: unknown): value is ChallengeAttemptRecord => isSummary(value) && Array.isArray((value as { review?: unknown }).review);

export const challengeAttempt: RecordType<ChallengeAttemptRecord, ChallengeAttemptRecord | ChallengeAttemptSummary> = {
  name: 'challenge-attempt',
  kind: 'immutable-result',
  payloadVersion: 1,
  identity: { scheme: 'attempt-id', of: (record) => record.attemptId },
  isPayload: isRecord,
  barriers: [],
  ordering: 'per-device',
  acceptance: 'private.accept_challenge_attempt_v1',
  snapshot: 'private.snapshot_challenge_attempts',
  detail: {
    server: 'private.detail_challenge_attempts',
    complete: (record) => Array.isArray((record as Partial<ChallengeAttemptRecord>).review),
    at: (record) => record.endedAt,
  },
  fromChange(change) {
    const record = isObject(change) ? change.record : undefined;
    if (!isSummary(record)) return null;
    const { review } = record as { review?: unknown };
    return review === undefined || Array.isArray(review) ? record : null;
  },
  // Spec 3 Synchronized record types › Challenge attempt
  contribution: null,
  export: { csv: null, json: (record) => record },
  deletion: { serverTables: ['private.challenge_attempts'] },
};
