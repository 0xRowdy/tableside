import type { PracticeAdapters } from '../practice/adapters';
import type { AccountSession } from './vault';

export function forAccountSession(adapters: PracticeAdapters, session: AccountSession): PracticeAdapters {
  return { ...adapters, store: session.store, owner: session.accountId, device: session.installationId };
}
