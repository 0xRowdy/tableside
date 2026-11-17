import { QUARANTINE_LIST } from '@tableside/definitions';
import { canonicalJson, type EntropySource } from '@tableside/engine';
import type { RecordedCheckpoint } from '@tableside/engine/recorded-checkpoints';

import { alwaysAllowed, type Clock, type PracticeAdapters } from '../adapters';
import { SAVE_RETRY_MS } from '../controller';
import { MemoryActivityStore, MemoryDisk } from '../memory-store';
import type { StoredActivity } from '../store';

export class FakeClock implements Clock {
  private time: number;
  private waiting: { until: number; resolve: () => void }[] = [];

  constructor(
    start = 1_790_000_000_000,
    private readonly auto = false,
    private readonly autoLimitMs = SAVE_RETRY_MS,
  ) {
    this.time = start;
  }

  now(): number {
    return this.time;
  }

  sleep(ms: number): Promise<void> {
    if (this.auto && ms < this.autoLimitMs) {
      this.time += ms;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.waiting.push({ until: this.time + ms, resolve }));
  }

  get pending(): number {
    return this.waiting.length;
  }

  advance(ms: number): void {
    this.time += ms;
    const due = this.waiting.filter((wait) => wait.until <= this.time);
    this.waiting = this.waiting.filter((wait) => wait.until > this.time);
    for (const wait of due) wait.resolve();
  }
}

export function entropyFromWords(words: readonly [number, number, number, number]): EntropySource {
  return {
    randomBytes: () => {
      const bytes = new Uint8Array(16);
      const view = new DataView(bytes.buffer);
      words.forEach((word, index) => view.setUint32(index * 4, word, true));
      return bytes;
    },
  };
}

export const PI_WORDS = [0xa4093822, 0x299f31d0, 0x13198a2e, 0x03707344] as const;

export function substituteAdapters(options: { clock?: FakeClock; words?: readonly [number, number, number, number] } = {}): PracticeAdapters & {
  store: MemoryActivityStore;
  clock: FakeClock;
} {
  let next = 0;
  return {
    store: new MemoryActivityStore(),
    access: alwaysAllowed,
    clock: options.clock ?? new FakeClock(),
    entropy: entropyFromWords(options.words ?? PI_WORDS),
    newId: () => `activity-${++next}`,
    device: 'test-device',
    owner: 'local',
    quarantine: QUARANTINE_LIST,
  };
}

// #80
export function storeHolding(...activities: StoredActivity[]): MemoryActivityStore {
  const disk = new MemoryDisk();
  for (const activity of activities) {
    disk.rows.set(activity.activityId, { activity: JSON.stringify(activity), transitions: new Map(), effects: new Map() });
  }
  return new MemoryActivityStore(disk);
}

export function leftBy(recorded: RecordedCheckpoint, checkpoint = recorded.checkpoint): StoredActivity {
  const specification = recorded.specification as StoredActivity['specification'];
  return {
    activityId: specification.activityId,
    admission: { provenance: 'earlier-build', meteringBasis: 'free-play' },
    specification,
    random: recorded.random as StoredActivity['random'],
    checkpoint,
    sequence: (JSON.parse(checkpoint) as { sequence: number }).sequence,
    createdAt: 1_790_000_000_000,
    completion: null,
    incomplete: null,
  };
}

export function fromLaterBuild(recorded: RecordedCheckpoint): string {
  const value = JSON.parse(recorded.checkpoint) as { schema: number };
  return canonicalJson({ ...value, schema: value.schema + 1 });
}
