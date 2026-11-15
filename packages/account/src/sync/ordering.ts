// Per-device ordering (spec 2, *Per-device attempt ordering*; scoring is
// spec 3's). A per-device type's records carry a durable position on their
// originating installation, allocated when each is queued. Order comes only
// from those positions: never from arrival (a late upload fills its original
// position) and never from displayed clocks. Each installation is its own
// sequence, so devices are never stitched into one streak, and a missing
// position splits a sequence into runs that no streak or milestone may span.

import type { AcceptedRecord } from './store';

/** One installation's records of a per-device type. */
export interface DeviceSequence {
  readonly installation: string;
  /** By position: index i holds position i + 1, or null where that position hasn't arrived. */
  readonly positions: readonly (AcceptedRecord | null)[];
  /** The stretches of consecutive positions with nothing missing, in order. A streak never spans two. */
  readonly runs: readonly (readonly AcceptedRecord[])[];
}

/** Each originating installation's sequence, by installation ID. */
export function byOriginatingDevice(records: readonly AcceptedRecord[]): readonly DeviceSequence[] {
  const byInstallation = new Map<string, (AcceptedRecord | null)[]>();
  for (const record of records) {
    if (!record.origin) throw new TypeError(`${record.recordType} ${record.item} has no originating-device position`);
    const { installation, position } = record.origin;
    const positions = byInstallation.get(installation) ?? [];
    while (positions.length < position) positions.push(null);
    positions[position - 1] = record;
    byInstallation.set(installation, positions);
  }
  return [...byInstallation.keys()].sort().map((installation) => {
    const positions = byInstallation.get(installation)!;
    const runs: AcceptedRecord[][] = [];
    let run: AcceptedRecord[] = [];
    for (const record of positions) {
      if (record) {
        run.push(record);
      } else if (run.length > 0) {
        runs.push(run);
        run = [];
      }
    }
    if (run.length > 0) runs.push(run);
    return { installation, positions, runs };
  });
}
