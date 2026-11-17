// Spec 2 Deletion, Amendment 8 §3; #104

import { revokeGrant, unseal } from './provider-grants.ts';

export interface ProviderIdentity {
  readonly provider: string;
  readonly subject: string;
  readonly sealed: string | null;
}

export interface DeletionPorts {
  requestAnalyticsErasure(ids: readonly string[]): Promise<{ readonly completed: boolean }>;
  deleteRevenueCatCustomer(accountId: string): Promise<'deleted' | 'none'>;
  revokeProviderGrant(identity: ProviderIdentity): Promise<'revoked' | 'not-held'>;
}

export const deletionPorts: DeletionPorts = {
  // TODO(spec 7)
  requestAnalyticsErasure: () => Promise.resolve({ completed: false }),
  // TODO(spec 5)
  deleteRevenueCatCustomer: () => Promise.resolve('none'),
  async revokeProviderGrant(identity) {
    const grant = identity.sealed ? await unseal(identity.sealed) : null;
    if (!grant) return 'not-held';
    if (!(await revokeGrant(identity.provider, grant))) throw new Error('provider-revocation');
    return 'revoked';
  },
};
