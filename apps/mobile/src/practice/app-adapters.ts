// The adapters the app runs the practice controller on. The store, owner and
// device here are placeholders: for the open account session, forAccountSession
// (src/account/practice.ts) swaps in the account's encrypted store, account ID
// and installation ID. App tests keep these, over their own store. Until spec
// 5 every activity and turn is allowed, and until spec 6 syncs required
// removals none applies.

import { QUARANTINE_LIST } from '@tableside/definitions';
import * as Crypto from 'expo-crypto';

import { alwaysAllowed, withRequiredRemovals, type PracticeAdapters } from './adapters';
import { MemoryActivityStore } from './memory-store';

export function createAppAdapters(): PracticeAdapters {
  return {
    store: new MemoryActivityStore(),
    access: withRequiredRemovals(alwaysAllowed, { removed: () => false }),
    clock: {
      now: () => Date.now(),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    },
    entropy: { randomBytes: (length) => Crypto.getRandomValues(new Uint8Array(length)) },
    newId: () => Crypto.randomUUID(),
    // Placeholders: the account session replaces them.
    device: 'this-device',
    owner: 'local',
    quarantine: QUARANTINE_LIST,
  };
}
