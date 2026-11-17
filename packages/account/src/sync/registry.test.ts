import { createHash } from 'node:crypto';

import type { CompletedPracticeSessionRecord } from '@tableside/engine';
import { describe, expect, it } from 'vitest';

import { prepareOperation } from './protocol';
import { completedPracticeSession } from './registry';

const record = {
  recordVersion: 1,
  activityId: 'activity-7',
  owner: 'account-1',
  device: 'installation-1',
  game: 'roulette',
  mode: 'free-play',
  startedAt: Date.UTC(2026, 10, 13, 9, 0, 0),
  endedAt: Date.UTC(2026, 10, 13, 9, 30, 0),
  buyIn: '1000',
  cumulativeFunding: '1500',
  finalCashOut: '1490',
  netResult: '-10',
  turnsPlayed: 12,
} as unknown as CompletedPracticeSessionRecord;

describe('the completed practice session registration', () => {
  it('is an immutable result named by its activity ID', () => {
    expect(completedPracticeSession.kind).toBe('immutable-result');
    expect(completedPracticeSession.identity.of(record)).toBe('activity-7');
  });

  it('reads only its own payloads from feed changes', () => {
    expect(completedPracticeSession.fromChange({ record })).toBe(record);
    expect(completedPracticeSession.fromChange({ record: { ...record, recordVersion: 2 } })).toBeNull();
    expect(completedPracticeSession.fromChange({ record: { ...record, netResult: -10 } })).toBeNull();
    expect(completedPracticeSession.fromChange(null)).toBeNull();
  });

  it('renders a CSV session summary row', () => {
    expect(completedPracticeSession.export.csv?.row(record)).toEqual([
      'activity-7',
      'roulette',
      'free-play',
      '2026-11-13T09:00:00.000Z',
      '2026-11-13T09:30:00.000Z',
      '1000',
      '1500',
      '1490',
      '-10',
      '12',
    ]);
  });
});

describe('the upload envelope', () => {
  it('is canonical JSON, hashed as the server hashes the text it receives', () => {
    const prepared = prepareOperation({
      protocol: 1,
      operation: 'ab'.repeat(16),
      installation: 'installation-1',
      command: { position: 12, generation: 3 },
      recordType: 'completed-practice-session',
      payloadVersion: 1,
      item: 'activity-7',
      payload: { b: '2', a: 1 },
    });
    const text =
      '{"command":{"generation":3,"position":12},"installation":"installation-1","item":"activity-7","operation":"abababababababababababababababab",' +
      '"payload":{"a":1,"b":"2"},"payloadVersion":1,"protocol":1,"recordType":"completed-practice-session"}';
    expect(prepared).toEqual({ operationId: 'ab'.repeat(16), request: text, requestHash: createHash('sha256').update(text, 'utf8').digest('hex') });
  });
});
