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

import type { AccountGate, AccountService } from '@tableside/account';

import type { AccessDecision, AccessDenial, AccessSupervisor } from '../practice/adapters';
import type { PracticeController } from '../practice/controller';

/** Gate states that leave ordinary access open: Renewal pending keeps it while the token renews. */
const opensAccess = (gate: AccountGate): boolean => gate.state === 'active' || gate.state === 'renewal-pending';

const PAUSED_FOR_AGE = 'Practice is paused until your age range can be confirmed.';
const PAUSED = 'Practice is paused for this account.';

/** What the gate asks of play, or null when it leaves ordinary access open. */
function gateDenial(gate: AccountGate): AccessDenial | null {
  if (opensAccess(gate)) return null;
  if (gate.state === 'age-unresolved') return { status: 'denied', provenance: 'account-gate', disposition: 'suspend-at-turn-boundary', reason: PAUSED_FOR_AGE };
  return { status: 'denied', provenance: 'account-gate', disposition: 'suspend', reason: PAUSED };
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
      return denial ? { status: 'blocked', reason: denial.reason ?? PAUSED } : access.beforeEndWhileSuspended(context);
    },
  };
}

/**
 * Tells the controller when the gate closes ordinary access, so the
 * supervisor's disposition applies to the unfinished session. Returns an
 * unsubscribe function.
 */
export function followAccountGate(
  service: Pick<AccountService, 'gate' | 'subscribe'>,
  controller: Pick<PracticeController, 'lifecycle'>,
): () => void {
  let open = opensAccess(service.gate);
  return service.subscribe((gate) => {
    const wasOpen = open;
    open = opensAccess(gate);
    if (wasOpen && !open) void controller.lifecycle('access-changed');
  });
}
