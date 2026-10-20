// Substitute adapters for controller and screen tests: a fake clock,
// deterministic entropy and sequential ids, over the in-memory store and the
// always-allowed access supervisor.

import type { EntropySource } from '@tableside/engine';

import { alwaysAllowed, type Clock, type PracticeAdapters } from '../adapters';
import { MemoryActivityStore } from '../memory-store';

/**
 * A clock that only moves when told. With `auto`, every sleep of at most
 * `autoLimitMs` (the pacing of automatic steps) resolves at once and moves time
 * forward by its length; longer waits, such as the save retry, wait for `advance`.
 */
export class FakeClock implements Clock {
  private time: number;
  private waiting: { until: number; resolve: () => void }[] = [];

  constructor(
    start = 1_790_000_000_000,
    private readonly auto = false,
    private readonly autoLimitMs = 2_000,
  ) {
    this.time = start;
  }

  now(): number {
    return this.time;
  }

  sleep(ms: number): Promise<void> {
    if (this.auto && ms <= this.autoLimitMs) {
      this.time += ms;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.waiting.push({ until: this.time + ms, resolve }));
  }

  /** Waits currently pending. */
  get pending(): number {
    return this.waiting.length;
  }

  /** Moves time forward, waking every sleep that is due. */
  advance(ms: number): void {
    this.time += ms;
    const due = this.waiting.filter((wait) => wait.until <= this.time);
    this.waiting = this.waiting.filter((wait) => wait.until > this.time);
    for (const wait of due) wait.resolve();
  }
}

/** Little-endian bytes of four u32 words, as the secure entropy adapter supplies them. */
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

/**
 * The Random123 "pi digits" key and session words. Its first single-zero spins
 * are 27, 0, 25, 31, 9 (engine draws.cases, checked against the Python reference).
 */
export const PI_WORDS = [0xa4093822, 0x299f31d0, 0x13198a2e, 0x03707344] as const;

export function substituteAdapters(options: { clock?: FakeClock } = {}): PracticeAdapters & {
  store: MemoryActivityStore;
  clock: FakeClock;
} {
  let next = 0;
  return {
    store: new MemoryActivityStore(),
    access: alwaysAllowed,
    clock: options.clock ?? new FakeClock(),
    entropy: entropyFromWords(PI_WORDS),
    newId: () => `activity-${++next}`,
    device: 'test-device',
    owner: 'local',
  };
}
