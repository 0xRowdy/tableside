// Spec 2 Amendment 1 C5

import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION, prepareOperation } from './protocol';

describe('protocol 1’s encoding', () => {
  it('is the envelope as canonical JSON: keys sorted at every level, no spaces, money as text', () => {
    expect(PROTOCOL_VERSION).toBe(1);
    const prepared = prepareOperation({
      protocol: 1,
      operation: '0123456789abcdef0123456789abcdef',
      installation: 'installation-1',
      command: { generation: 2, position: 41 },
      recordType: 'completed-practice-session',
      payloadVersion: 1,
      item: 'activity-1',
      payload: { recordVersion: 1, netResult: '-12.5', activityId: 'activity-1', turnsPlayed: 3 },
    });
    const text =
      '{"command":{"generation":2,"position":41},"installation":"installation-1","item":"activity-1","operation":"0123456789abcdef0123456789abcdef",' +
      '"payload":{"activityId":"activity-1","netResult":"-12.5","recordVersion":1,"turnsPlayed":3},' +
      '"payloadVersion":1,"protocol":1,"recordType":"completed-practice-session"}';
    expect(prepared.request).toBe(text);
    expect(prepared.requestHash).toBe(createHash('sha256').update(text, 'utf8').digest('hex'));
    expect(prepared.operationId).toBe('0123456789abcdef0123456789abcdef');
  });

  it('hashes the UTF-8 bytes of non-ASCII text', () => {
    const prepared = prepareOperation({
      protocol: 1,
      operation: 'f'.repeat(32),
      installation: 'i',
      command: { generation: 1, position: 1 },
      recordType: 't',
      payloadVersion: 1,
      item: 'x',
      payload: { note: 'Café ♠' },
    });
    expect(prepared.request).toContain('"note":"Café ♠"');
    expect(prepared.requestHash).toBe(createHash('sha256').update(prepared.request, 'utf8').digest('hex'));
  });
});
