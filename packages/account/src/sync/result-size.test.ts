// Spec 2 Chunked results; #50

import { canonicalJson } from '@tableside/engine';
import { describe, expect, it } from 'vitest';

import { PracticeController } from '../../../../apps/mobile/src/practice/controller';
import { FakeClock, substituteAdapters } from '../../../../apps/mobile/src/practice/testing/substitutes';
import { PROTOCOL_VERSION, chunksOf, prepareOperation } from './protocol';
import { completedPracticeSession } from './registry';

async function rouletteSession(spins: number) {
  const controller = new PracticeController(substituteAdapters({ clock: new FakeClock(undefined, true) }));
  await controller.load();
  await controller.start({ game: 'roulette', buyIn: '100000' });
  for (let spin = 0; spin < spins; spin++) {
    await controller.placeWager('red', '10');
    await controller.placeWager('17', '5');
    await controller.spin();
  }
  await controller.endSession();
  const snapshot = controller.snapshot();
  if (snapshot.status !== 'completed') throw new Error(`the session did not complete (${snapshot.status})`);
  return snapshot.result;
}

const upload = (payload: unknown) =>
  prepareOperation({
    protocol: PROTOCOL_VERSION,
    operation: 'a'.repeat(32),
    installation: 'test-device',
    command: { generation: 1, position: 1 },
    recordType: completedPracticeSession.name,
    payloadVersion: completedPracticeSession.payloadVersion,
    item: 'activity-1',
    payload,
  });

describe('the representative completed practice session', () => {
  it('serializes to 10–20 KB, and uploads in one request', async () => {
    const result = await rouletteSession(150);
    expect(result.turnsPlayed).toBe(150);
    expect(completedPracticeSession.isPayload(result)).toBe(true);
    const size = Buffer.byteLength(canonicalJson(result), 'utf8');
    expect(size).toBeGreaterThanOrEqual(10_000);
    expect(size).toBeLessThanOrEqual(20_000);
    expect(chunksOf(upload(result), result)).toBeNull();
  });

  it('is a target, not a cap: a session many times longer is chunked and keeps every outcome', async () => {
    const result = await rouletteSession(150);
    const long = { ...result, outcomes: Array.from({ length: 12 }, () => result.outcomes).flat() };
    const chunks = chunksOf(upload(long), long);
    expect(chunks!.length).toBeGreaterThan(1);
    expect(JSON.parse(chunks!.map((chunk) => chunk.data).join(''))).toEqual(long);
  });
});
