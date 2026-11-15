// The deletion job's providers (spec 2, #104): what it asks of services
// outside the database at the irreversible boundary. Each is a port whose
// implementation belongs to a later spec; until then it is a stub that sends
// nothing and never claims more than it did.
//
//   analytics   spec 7 (#57) owns the analytics provider. The stub records the
//               request as made and never reports the provider's completion
//               (Amendment 8 §3: queued work is never complete).
//   revenueCat  spec 5 (#55) owns purchases and RevenueCat. No customer exists
//               before it lands, so there is none to remove.
//   grants      revokes the Sign in with Apple token and the Google grant the
//               provider-grant function captured and sealed (provider-grants.ts),
//               with the provider's own revocation endpoint. An identity whose
//               flow gave no revocable credential (no grant held), or a
//               provider with no grant settings here, answers 'not-held',
//               which the status reports as a provider exception, never as
//               revoked. Real provider credentials are launch gate 3's (#109).

import { revokeGrant, unseal } from './provider-grants.ts';

/** An Apple or Google identity of the account: the provider, its subject, and its sealed grant when one is held. */
export interface ProviderIdentity {
  readonly provider: string;
  readonly subject: string;
  readonly sealed: string | null;
}

export interface DeletionPorts {
  /** Asks the analytics provider to erase each ID; `completed` only when the provider already finished. */
  requestAnalyticsErasure(ids: readonly string[]): Promise<{ readonly completed: boolean }>;
  /** Removes the account's RevenueCat customer (its app user ID is the account ID). */
  deleteRevenueCatCustomer(accountId: string): Promise<'deleted' | 'none'>;
  /** Revokes Tableside's grant for one Apple or Google identity; throws when the provider couldn't be reached (retried). */
  revokeProviderGrant(identity: ProviderIdentity): Promise<'revoked' | 'not-held'>;
}

export const deletionPorts: DeletionPorts = {
  requestAnalyticsErasure: () => Promise.resolve({ completed: false }),
  deleteRevenueCatCustomer: () => Promise.resolve('none'),
  async revokeProviderGrant(identity) {
    const grant = identity.sealed ? await unseal(identity.sealed) : null;
    if (!grant) return 'not-held';
    if (!(await revokeGrant(identity.provider, grant))) throw new Error('provider-revocation');
    return 'revoked';
  },
};
