// The account gate composed into spec 1's access supervisor (spec 2, *Account
// gate*; Amendment 1 B3). While the gate leaves ordinary access open, the
// supervisor it wraps decides (spec 5's policy, a stub until then). Otherwise
// nothing new starts, no turn begins and nothing resumes or ends, and an
// unfinished practice session suspends:
// - at once (save and pause in the committed phase, no further reveal) for
//   every closed state, including newly learned ineligibility;
// - at the turn boundary when eligibility becomes unresolved (a required check
//   expired or pending): a turn in progress finishes, then it suspends.
// A move between eligible bands is no pause. Gate states never stop play, so
// they never trigger final settlement by themselves.

import { isAgeRestricted, opensOrdinaryAccess, type AccountGate, type AccountService } from '@tableside/account';

import type { AccessDecision, AccessDenial, AccessSupervisor } from '../practice/adapters';
import type { PracticeController } from '../practice/controller';

const SUSPENDED_FOR_AGE = "Practice can't continue until your age range is confirmed.";
const SUSPENDED = "Practice can't continue on this account.";

/** What the gate asks of play, or null when it leaves ordinary access open. */
function gateDenial(gate: AccountGate): AccessDenial | null {
  if (opensOrdinaryAccess(gate)) return null;
  if (gate.state === 'age-unresolved') return { status: 'denied', provenance: 'account-gate', disposition: 'suspend-at-turn-boundary', reason: SUSPENDED_FOR_AGE };
  return { status: 'denied', provenance: 'account-gate', disposition: 'suspend', reason: SUSPENDED };
}

/** The supervisor `access` behind the account gate `gate` reads. */
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

/**
 * Tells the controller when the gate's age states close ordinary access, so
 * the supervisor's disposition applies to the unfinished session. (Sign-out
 * suspends through the account session ending.) Returns an unsubscribe function.
 */
export function followAccountGate(
  service: Pick<AccountService, 'gate' | 'subscribe'>,
  controller: Pick<PracticeController, 'lifecycle'>,
): () => void {
  let open = opensOrdinaryAccess(service.gate);
  return service.subscribe((gate) => {
    const wasOpen = open;
    open = opensOrdinaryAccess(gate);
    if (wasOpen && isAgeRestricted(gate)) void controller.lifecycle('access-changed');
  });
}
