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
//   grants      revoking the Sign in with Apple token and the Google grant
//               needs a provider refresh token, which Tableside doesn't hold
//               yet: gate 3's qualification of deletion-token revocation (spec
//               2) owns it. The stub answers 'not-held', which the status
//               reports as a provider exception, never as revoked.

/** An Apple or Google identity of the account: the provider and its subject. */
export interface ProviderIdentity {
  readonly provider: string;
  readonly subject: string;
}

export interface DeletionPorts {
  /** Asks the analytics provider to erase each ID; `completed` only when the provider already finished. */
  requestAnalyticsErasure(ids: readonly string[]): Promise<{ readonly completed: boolean }>;
  /** Removes the account's RevenueCat customer (its app user ID is the account ID). */
  deleteRevenueCatCustomer(accountId: string): Promise<'deleted' | 'none'>;
  /** Revokes Tableside's grant for one Apple or Google identity. */
  revokeProviderGrant(identity: ProviderIdentity): Promise<'revoked' | 'not-held'>;
}

export const deletionPorts: DeletionPorts = {
  requestAnalyticsErasure: () => Promise.resolve({ completed: false }),
  deleteRevenueCatCustomer: () => Promise.resolve('none'),
  revokeProviderGrant: () => Promise.resolve('not-held'),
};
