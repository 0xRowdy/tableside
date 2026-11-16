// Per-device ordering (spec 2, *Per-device attempt ordering*): records sit at
// their originating installation's positions, whatever order they arrived in
// and whatever their clocks say. Expectations are worked by hand.

import { describe, expect, it } from 'vitest';

import { byOriginatingDevice } from './ordering';
import type { AcceptedRecord } from './store';

/** An accepted attempt: arrival order is the account sequence, `at` its device clock. */
const attempt = (installation: string, position: number, sequence: number, at: number): AcceptedRecord => ({
  recordType: 'challenge-attempt',
  item: `${installation}-${position}`,
  sequence,
  payload: { at },
  origin: { installation, position },
});

describe('records by originating device', () => {
  it('orders each installation by position: not by arrival, and not by clock', async () => {
    // Arrived 3, 1, 2; the clock went backwards before position 2.
    const records = [attempt('phone', 3, 1, 3_000), attempt('phone', 1, 2, 2_000), attempt('phone', 2, 3, 1_000)];
    const [phone] = byOriginatingDevice(records);
    expect(phone?.positions.map((record) => record?.item)).toEqual(['phone-1', 'phone-2', 'phone-3']);
    expect(phone?.runs.map((run) => run.map((record) => record.item))).toEqual([['phone-1', 'phone-2', 'phone-3']]);
  });

  it('keeps each installation separate: devices are never stitched into one sequence', async () => {
    const records = [attempt('tablet', 1, 1, 10), attempt('phone', 1, 2, 5), attempt('phone', 2, 3, 20), attempt('tablet', 2, 4, 15)];
    expect(byOriginatingDevice(records).map(({ installation, runs }) => [installation, runs.map((run) => run.map((record) => record.item))])).toEqual([
      ['phone', [['phone-1', 'phone-2']]],
      ['tablet', [['tablet-1', 'tablet-2']]],
    ]);
  });

  it('leaves a missing position empty, and no run spans it until it arrives', async () => {
    const early = [attempt('phone', 1, 1, 1), attempt('phone', 3, 2, 3), attempt('phone', 4, 3, 4)];
    const [gap] = byOriginatingDevice(early);
    expect(gap?.positions.map((record) => record?.item ?? null)).toEqual(['phone-1', null, 'phone-3', 'phone-4']);
    expect(gap?.runs.map((run) => run.map((record) => record.item))).toEqual([['phone-1'], ['phone-3', 'phone-4']]);

    // The late upload fills its original position.
    const [filled] = byOriginatingDevice([...early, attempt('phone', 2, 4, 2)]);
    expect(filled?.runs.map((run) => run.map((record) => record.item))).toEqual([['phone-1', 'phone-2', 'phone-3', 'phone-4']]);
  });

  it('counts positions missing before the first that arrived', async () => {
    const [phone] = byOriginatingDevice([attempt('phone', 2, 1, 1)]);
    expect(phone?.positions.map((record) => record?.item ?? null)).toEqual([null, 'phone-2']);
    expect(phone?.runs.map((run) => run.length)).toEqual([1]);
  });

  it('refuses a record with no origin: only per-device types have positions', async () => {
    const { recordType, item, sequence, payload } = attempt('phone', 1, 1, 1);
    expect(() => byOriginatingDevice([{ recordType, item, sequence, payload }])).toThrow(TypeError);
  });
});
