// Spec 2 Account gate, Amendment 1 B3

import { isRestricted, opensOrdinaryAccess, type AccountGate, type AccountService } from '@tableside/account';

import type { AccessDecision, AccessDenial, AccessSupervisor } from '../practice/adapters';
import type { PracticeController } from '../practice/controller';

const SUSPENDED_FOR_AGE = "Practice can't continue until your age range is confirmed.";
const SUSPENDED = "Practice can't continue on this account.";

function gateDenial(gate: AccountGate): AccessDenial | null {
  if (opensOrdinaryAccess(gate)) return null;
  if (gate.state === 'age-unresolved') return { status: 'denied', provenance: 'account-gate', disposition: 'suspend-at-turn-boundary', reason: SUSPENDED_FOR_AGE };
  return { status: 'denied', provenance: 'account-gate', disposition: 'suspend', reason: SUSPENDED };
}

export function withAccountGate(access: AccessSupervisor, gate: () => AccountGate): AccessSupervisor {
  const ask = <T extends AccessDecision>(next: () => Promise<T>): Promise<T | AccessDenial> => {
    const denial = gateDenial(gate());
    return denial ? Promise.resolve(denial) : next();
  };
  return {
    ...access,
    beforeActivity: (context) => ask(() => access.beforeActivity(context)),
    beforeTurn: (context) => ask(() => access.beforeTurn(context)),
    beforeResume: (context) => ask(() => access.beforeResume(context)),
    onLifecycle: (context) => ask(() => access.onLifecycle(context)),
    beforeEndWhileSuspended: async (context) => {
      const denial = gateDenial(gate());
      return denial ? { status: 'blocked', reason: denial.reason ?? SUSPENDED } : access.beforeEndWhileSuspended(context);
    },
  };
}

export function followAccountGate(
  service: Pick<AccountService, 'gate' | 'subscribe'>,
  controller: Pick<PracticeController, 'lifecycle'>,
): () => void {
  let open = opensOrdinaryAccess(service.gate);
  return service.subscribe((gate) => {
    const wasOpen = open;
    open = opensOrdinaryAccess(gate);
    if (wasOpen && isRestricted(gate)) void controller.lifecycle('access-changed');
  });
}
