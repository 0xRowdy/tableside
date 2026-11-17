// #90; spec 2 Amendment 1 B3

import type { AccountGate } from '@tableside/account';

import { followAccountGate, withAccountGate } from '@/account/gate-access';
import { PracticeController, REVEAL_MS, type PracticeSnapshot } from '@/practice/controller';
import { FakeClock, substituteAdapters } from '@/practice/testing/substitutes';

const ADULT: AccountGate = { state: 'active', accountId: 'account-1', eligibility: '18+' };

function gateSource(initial: AccountGate) {
  let gate = initial;
  const listeners = new Set<(gate: AccountGate) => void>();
  return {
    get gate() {
      return gate;
    },
    subscribe(listener: (gate: AccountGate) => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    move(next: AccountGate) {
      gate = next;
      listeners.forEach((listener) => listener(next));
    },
  };
}

async function started(initial: AccountGate = ADULT) {
  const source = gateSource(initial);
  const base = substituteAdapters({ clock: new FakeClock(undefined, false) });
  const adapters = { ...base, access: withAccountGate(base.access, () => source.gate) };
  const controller = new PracticeController(adapters);
  const stop = followAccountGate(source, controller);
  await controller.load();
  await controller.start({ game: 'roulette', buyIn: '1000' });
  await controller.placeWager('red', '10');
  return { source, controller, clock: adapters.clock as FakeClock, store: adapters.store, stop };
}

function active(snapshot: PracticeSnapshot) {
  if (snapshot.status !== 'active') throw new Error(`expected an active session, got ${snapshot.status}`);
  return snapshot;
}

async function waitFor(condition: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !condition(); i++) await new Promise((resolve) => setImmediate(resolve));
  if (!condition()) throw new Error('condition never held');
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

describe('newly learned ineligibility', () => {
  it('suspends at once mid-turn: nothing more is revealed, settled or charged, and it can’t end or resume', async () => {
    const { source, controller, clock, store } = await started();
    const spinning = controller.spin();
    await waitFor(() => clock.pending === 1);

    source.move({ state: 'age-ineligible', accountId: 'account-1' });
    await settle();
    clock.advance(REVEAL_MS * 10);
    await spinning;

    const snapshot = active(controller.snapshot());
    expect(snapshot.view).toMatchObject({ phase: 'revealing-outcome' });
    expect(snapshot.suspension).toMatchObject({ cause: 'access', kind: 'immediate', reached: true, canEnd: false });
    await controller.resume();
    expect(active(controller.snapshot()).suspension?.resumeBlocked).toBeTruthy();
    expect(active(controller.snapshot()).view).toMatchObject({ phase: 'revealing-outcome' });
    expect(await store.readOutgoing()).toEqual([]);
  });
});

describe('eligibility becoming unresolved', () => {
  it('lets the turn in progress finish, then suspends at the boundary with no final settlement', async () => {
    const { source, controller, clock, store } = await started();
    const spinning = controller.spin();
    await waitFor(() => clock.pending === 1);

    source.move({ state: 'age-unresolved', accountId: 'account-1', reason: 'check-pending' });
    await settle();
    clock.advance(REVEAL_MS);
    await spinning;

    const snapshot = active(controller.snapshot());
    expect(snapshot.view).toMatchObject({ phase: 'settled-outcome', balance: '1010' });
    expect(snapshot.suspension).toMatchObject({ cause: 'access', kind: 'turn-boundary', reached: true });
    await controller.spin();
    expect(active(controller.snapshot()).view).toMatchObject({ phase: 'settled-outcome', balance: '1010' });
    await controller.endSession();
    expect(controller.snapshot().status).toBe('active');
    expect(await store.readOutgoing()).toEqual([]);
  });

  it('resumes exactly where it was once eligibility is established again', async () => {
    const { source, controller } = await started();
    source.move({ state: 'age-unresolved', accountId: 'account-1', reason: 'check-pending' });
    await settle();
    expect(active(controller.snapshot()).suspension).toMatchObject({ reached: true });

    source.move(ADULT);
    await controller.resume();
    expect(active(controller.snapshot()).suspension).toBeNull();
    expect(active(controller.snapshot()).view).toMatchObject({ phase: 'open-decision' });
  });
});

describe('a move between eligible bands', () => {
  it('doesn’t pause', async () => {
    const { source, controller, clock } = await started({ state: 'active', accountId: 'account-1', eligibility: '16-17' });
    const spinning = controller.spin();
    await waitFor(() => clock.pending === 1);

    source.move(ADULT);
    await settle();
    clock.advance(REVEAL_MS);
    await spinning;
    expect(active(controller.snapshot()).suspension).toBeNull();
    expect(active(controller.snapshot()).view).toMatchObject({ phase: 'settled-outcome' });
  });
});

describe('a restricted gate', () => {
  it('admits no new practice session', async () => {
    const source = gateSource({ state: 'age-unresolved', accountId: 'account-1', reason: 'not-established' });
    const base = substituteAdapters({ clock: new FakeClock(undefined, true) });
    const controller = new PracticeController({ ...base, access: withAccountGate(base.access, () => source.gate) });
    await controller.load();
    await controller.start({ game: 'roulette', buyIn: '1000' });
    expect(controller.snapshot()).toMatchObject({ status: 'none', problem: 'access-denied' });
  });
});
