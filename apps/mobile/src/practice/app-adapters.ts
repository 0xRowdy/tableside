import { QUARANTINE_LIST } from '@tableside/definitions';
import * as Crypto from 'expo-crypto';

import { alwaysAllowed, withRequiredRemovals, type PracticeAdapters } from './adapters';
import { MemoryActivityStore } from './memory-store';

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export function createAppAdapters(): PracticeAdapters {
  return {
    store: new MemoryActivityStore(),
    // TODO(spec 5, spec 6)
    access: withRequiredRemovals(alwaysAllowed, { removed: () => false }),
    clock: {
      now: () => Date.now(),
      sleep,
    },
    entropy: { randomBytes: (length) => Crypto.getRandomValues(new Uint8Array(length)) },
    newId: () => Crypto.randomUUID(),
    device: 'this-device',
    owner: 'local',
    quarantine: QUARANTINE_LIST,
  };
}
