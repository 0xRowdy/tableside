// The adapters the app runs the practice controller on. Until the app signs in
// (spec 2's first-run sign-in), the store is in memory with placeholder owner
// and device; for an open account session, forAccountSession
// (src/account/practice.ts) swaps in the account's encrypted store, account ID
// and installation ID. Until spec 5 every activity and turn is allowed, and
// until spec 6 syncs required removals none applies.

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
    // Placeholders until the app signs in (spec 2).
    device: 'this-device',
    owner: 'local',
    quarantine: QUARANTINE_LIST,
  };
}
