import type { PracticeAdapters } from '../practice/adapters';
import type { TrainingAdapters } from '../training/adapters';
import type { AccountSession } from './vault';

export function forAccountSession(adapters: PracticeAdapters, session: AccountSession): PracticeAdapters {
  return { ...adapters, store: session.store, owner: session.accountId, device: session.installationId };
}

// #158
export function trainingForAccountSession(adapters: TrainingAdapters, session: AccountSession): TrainingAdapters {
  return { ...adapters, store: session.store, owner: session.accountId, device: session.installationId };
}
