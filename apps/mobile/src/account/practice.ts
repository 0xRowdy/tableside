// The practice controller's adapters for an open account session: the
// account's encrypted store replaces spec 1's in-memory store, the account ID
// replaces the placeholder owner, and the registered installation ID replaces
// the placeholder device. A new session (sign-in or account switch) needs a new
// controller; the old one's store refuses to read or write.

import type { PracticeAdapters } from '../practice/adapters';
import type { AccountSession } from './vault';

export function forAccountSession(adapters: PracticeAdapters, session: AccountSession): PracticeAdapters {
  return { ...adapters, store: session.store, owner: session.accountId, device: session.installationId };
}
