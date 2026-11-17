// #158, #136
import { QUARANTINE_LIST } from '@tableside/definitions';
import * as Crypto from 'expo-crypto';

import { alwaysAllowed } from '../practice/adapters';
import { sleep } from '../practice/app-adapters';
import type { TrainingAdapters } from './adapters';
import { plentyAllowance } from './allowance';
import { MemoryTrainingStore } from './memory-store';
import { screenReaderSpeech } from './screen-reader';

export function createTrainingAdapters(): TrainingAdapters {
  const clock = { now: () => Date.now(), sleep };
  return {
    store: new MemoryTrainingStore(),
    // TODO(spec 5)
    access: alwaysAllowed,
    allowance: plentyAllowance(clock.now),
    clock,
    entropy: { randomBytes: (length) => Crypto.getRandomValues(new Uint8Array(length)) },
    newId: () => Crypto.randomUUID(),
    device: 'this-device',
    owner: 'local',
    quarantine: QUARANTINE_LIST,
    speech: screenReaderSpeech(),
  };
}
