// Spec 2 Per-device attempt ordering

import type { AcceptedRecord } from './store';

export interface DeviceSequence {
  readonly installation: string;
  readonly positions: readonly (AcceptedRecord | null)[];
  readonly runs: readonly (readonly AcceptedRecord[])[];
}

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
