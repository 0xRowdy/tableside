import type { AccountSession } from './vault';

// #158
export function forAccountSession<A extends { readonly store: object; readonly owner: string; readonly device: string }>(adapters: A, session: AccountSession): A {
  return { ...adapters, store: session.store, owner: session.accountId, device: session.installationId };
}
