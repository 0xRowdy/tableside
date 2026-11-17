// #158
import * as Crypto from 'expo-crypto';

import { alwaysAllowed } from '../practice/adapters';
import { sleep } from '../practice/app-adapters';
import type { TrainingAdapters } from './adapters';
import { MemoryTrainingStore } from './memory-store';

export function createTrainingAdapters(): TrainingAdapters {
  return {
    store: new MemoryTrainingStore(),
    // TODO(spec 5)
    access: alwaysAllowed,
    clock: { now: () => Date.now(), sleep },
    entropy: { randomBytes: (length) => Crypto.getRandomValues(new Uint8Array(length)) },
    newId: () => Crypto.randomUUID(),
    device: 'this-device',
    owner: 'local',
  };
}
