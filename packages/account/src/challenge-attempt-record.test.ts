import type { ChallengeAttemptRecord, ChallengeAttemptSummary } from '@tableside/engine';
import { describe, expect, it } from 'vitest';

import { challengeAttempt } from './challenge-attempt-record';
import { recordTypes } from './sync/registry';

const record: ChallengeAttemptRecord = {
  recordVersion: 1,
  attemptId: 'attempt-7',
  owner: 'account-1',
  installation: 'installation-1',
  deviceSequence: 3,
  groupKey: {
    category: 'card-values',
    variant: 'check',
    assistanceClass: 'unassisted-check',
    countRevealed: false,
    content: { id: 'card-values', version: 1 },
    reference: null,
    length: 20,
    pacing: 'self-paced',
    table: null,
  },
  identities: { engine: '0.0.0', content: { id: 'card-values', version: 1 }, reference: null, random: { protocol: 1, key: [1, 2], session: [3, 4] } },
  endingReason: 'completed',
  metrics: { 'card-values': { correct: 19, total: 20 }, 'running-count': null, 'true-count': null, 'playing-adherence': null, 'betting-adherence': null },
  review: [{ kind: 'card-value', position: 1, card: { rank: 7, suit: 'hearts' }, entered: 1, reference: 0 }],
  assistanceStep: null,
  interrupted: false,
  performanceMs: 41_000,
  finances: null,
  allowancePolicyVersion: 'launch-1',
  meteringBasis: 'challenge-attempt',
  startedAt: Date.UTC(2026, 10, 17, 9, 0, 0),
  endedAt: Date.UTC(2026, 10, 17, 9, 1, 0),
};

describe('the challenge-attempt registration (spec 3 Synchronized record types)', () => {
  it('is a registered immutable result, ordered per device and named by its attempt ID', () => {
    expect(recordTypes.get('challenge-attempt')).toBe(challengeAttempt);
    expect(challengeAttempt.kind).toBe('immutable-result');
    expect(challengeAttempt.ordering).toBe('per-device');
    expect(challengeAttempt.identity.of(record)).toBe('attempt-7');
  });

  it('uploads only an ended attempt', () => {
    expect(challengeAttempt.isPayload(record)).toBe(true);
    for (const endingReason of ['abandoned', 'insufficient-funds', 'unusable']) expect(challengeAttempt.isPayload({ ...record, endingReason })).toBe(true);
    expect(challengeAttempt.isPayload({ ...record, endingReason: null })).toBe(false);
    expect(challengeAttempt.isPayload({ ...record, endingReason: 'unfinished' })).toBe(false);
    expect(challengeAttempt.isPayload({ ...record, recordVersion: 2 })).toBe(false);
    expect(challengeAttempt.isPayload({ ...record, deviceSequence: 0 })).toBe(false);
    expect(challengeAttempt.isPayload({ ...record, meteringBasis: 'premium' })).toBe(true);
    expect(challengeAttempt.isPayload({ ...record, meteringBasis: 'free-play' })).toBe(false);
  });

  it('adds nothing to practice totals', () => {
    expect(challengeAttempt.contribution).toBeNull();
  });

  // Spec 3 Amendment 1 C8, Amendment 4 §1
  it('bootstraps a summary without the review facts, and reads the whole record as detail', () => {
    const summary = Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'review'));
    expect(challengeAttempt.fromChange({ record: summary })).toEqual(summary);
    expect(challengeAttempt.fromChange({ record })).toEqual(record);
    expect(challengeAttempt.detail?.complete(summary as ChallengeAttemptSummary)).toBe(false);
    expect(challengeAttempt.detail?.complete(record)).toBe(true);
    expect(challengeAttempt.detail?.at(summary as ChallengeAttemptSummary)).toBe(record.endedAt);
  });

  it('reads only its own payloads from feed changes', () => {
    expect(challengeAttempt.fromChange({ record: { ...record, recordVersion: 2 } })).toBeNull();
    expect(challengeAttempt.fromChange({ record: { ...record, review: 'none' } })).toBeNull();
    expect(challengeAttempt.fromChange(null)).toBeNull();
  });

  it('exports each attempt as JSON, with no CSV', () => {
    expect(challengeAttempt.export.json(record)).toEqual(record);
    expect(challengeAttempt.export.csv).toBeNull();
    expect(challengeAttempt.deletion.serverTables).toEqual(['private.challenge_attempts']);
  });
});
