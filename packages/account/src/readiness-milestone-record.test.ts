import type { ChallengeAttemptSummary } from '@tableside/engine';
import { describe, expect, it } from 'vitest';

import { type ReadinessMilestoneRecord, readinessMilestone } from './readiness-milestone-record';
import { isBarrierFor, recordTypes } from './sync/registry';

const milestone: ReadinessMilestoneRecord = {
  recordVersion: 1,
  owner: 'account-1',
  installation: 'installation-1',
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
  attempts: ['attempt-a', 'attempt-c'],
  deviceSequences: [2, 4],
  earnedAt: Date.UTC(2026, 10, 17, 9, 0, 0),
};

const attemptAt = (installation: string, deviceSequence: number) => ({
  recordType: 'challenge-attempt',
  payload: { attemptId: `attempt-${deviceSequence}`, installation, deviceSequence } as Partial<ChallengeAttemptSummary>,
});

describe('the readiness-milestone registration (spec 3 Synchronized record types)', () => {
  it('is a registered immutable result, not ordered per device, named by its installation and the two cited attempts', () => {
    expect(recordTypes.get('readiness-milestone')).toBe(readinessMilestone);
    expect(readinessMilestone.kind).toBe('immutable-result');
    expect(readinessMilestone.ordering).toBeUndefined();
    expect(readinessMilestone.identity.of(milestone)).toBe('installation-1/attempt-a/attempt-c');
  });

  it('uploads a group key, two cited attempts in device order and a display-only earning time', () => {
    expect(readinessMilestone.isPayload(milestone)).toBe(true);
    expect(readinessMilestone.isPayload({ ...milestone, recordVersion: 2 })).toBe(false);
    expect(readinessMilestone.isPayload({ ...milestone, attempts: ['attempt-a'] })).toBe(false);
    expect(readinessMilestone.isPayload({ ...milestone, deviceSequences: [4, 2] })).toBe(false);
    expect(readinessMilestone.isPayload({ ...milestone, deviceSequences: [0, 2] })).toBe(false);
    expect(readinessMilestone.isPayload({ ...milestone, deviceSequences: [2] })).toBe(false);
    expect(readinessMilestone.isPayload({ ...milestone, groupKey: null })).toBe(false);
    expect(readinessMilestone.isPayload({ ...milestone, earnedAt: 'today' })).toBe(false);
  });

  // Spec 3 Synchronized record types › Readiness milestone (Barrier)
  it('waits on every attempt of its installation from the first to the second cited device position, and on no other', () => {
    expect(readinessMilestone.barriers).toEqual(['challenge-attempt']);
    const waits = (barrier: ReturnType<typeof attemptAt>) => isBarrierFor(readinessMilestone as never, barrier, milestone);
    expect([1, 2, 3, 4, 5].map((position) => waits(attemptAt('installation-1', position)))).toEqual([false, true, true, true, false]);
    expect(waits(attemptAt('installation-2', 3))).toBe(false);
    expect(isBarrierFor(readinessMilestone as never, { recordType: 'lesson-progress', payload: { installation: 'installation-1', deviceSequence: 3 } }, milestone)).toBe(false);
  });

  it('adds nothing to practice totals', () => {
    expect(readinessMilestone.contribution).toBeNull();
  });

  it('is summary data: bootstrapped whole, with no detail to fetch', () => {
    expect(readinessMilestone.detail).toBeUndefined();
    expect(readinessMilestone.snapshot).toBe('private.snapshot_readiness_milestones');
    expect(readinessMilestone.fromChange({ record: milestone })).toEqual(milestone);
    expect(readinessMilestone.fromChange({ record: { ...milestone, recordVersion: 2 } })).toBeNull();
    expect(readinessMilestone.fromChange(null)).toBeNull();
  });

  it('exports each milestone as JSON, with no CSV, and is erased with the account', () => {
    expect(readinessMilestone.export.json(milestone)).toEqual(milestone);
    expect(readinessMilestone.export.csv).toBeNull();
    expect(readinessMilestone.deletion.serverTables).toEqual(['private.readiness_milestones']);
  });
});
