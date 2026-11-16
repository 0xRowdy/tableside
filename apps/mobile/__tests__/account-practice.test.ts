// Practice on an account's encrypted store: the practice controller runs on
// the adapters for an open account session, so the account is the owner, the
// installation the originating device, and every transition and result is
// committed to that account's database before it is shown. Spins come from the
// Random123 "pi digits" stream: 27 (red), then 0.

import { forAccountSession } from '@/account/practice';
import { TestDevice } from '@/account/testing/vault-substitutes';
import type { AccountSession, VaultOpening } from '@/account/vault';
import { PracticeController, type PracticeSnapshot } from '@/practice/controller';
import { FakeClock, substituteAdapters } from '@/practice/testing/substitutes';

const devices: TestDevice[] = [];
afterAll(() => devices.forEach((device) => device.remove()));

function newDevice(): TestDevice {
  const device = new TestDevice();
  devices.push(device);
  return device;
}

function opened(opening: VaultOpening): AccountSession {
  if (opening.status !== 'open') throw new Error(`expected an open database, got ${opening.status}`);
  return opening.session;
}

function controllerFor(session: AccountSession) {
  return new PracticeController(forAccountSession(substituteAdapters({ clock: new FakeClock(undefined, true) }), session));
}

function active(snapshot: PracticeSnapshot) {
  if (snapshot.status !== 'active') throw new Error(`expected an active practice session, got ${snapshot.status}`);
  return snapshot;
}

describe('practice on an account', () => {
  it('records the account as owner and the installation as device, saves the result before showing it, and queues it once for sync', async () => {
    const vault = newDevice().vault();
    const session = opened(await vault.open('account-a'));
    const controller = controllerFor(session);
    await controller.load();
    await controller.start({ game: 'roulette', buyIn: '1000' });
    await controller.placeWager('red', '10');
    await controller.spin();
    await controller.endSession();

    const snapshot = controller.snapshot();
    expect(snapshot.status).toBe('completed');
    const records = (await session.store.readOutgoing()).map((outgoing) => outgoing.record);
    expect(records).toEqual([expect.objectContaining({ owner: 'account-a', device: session.installationId, netResult: '10' })]);
    expect(snapshot.status === 'completed' && snapshot.result).toEqual(records[0]);
  });

  it('resumes an unfinished practice session after a restart, from the account database', async () => {
    const device = newDevice();
    const first = opened(await device.vault().open('account-a'));
    const controller = controllerFor(first);
    await controller.load();
    await controller.start({ game: 'roulette', buyIn: '1000' });
    await controller.placeWager('red', '10');
    await first.store.close();

    const restarted = controllerFor(opened(await device.vault().open('account-a')));
    await restarted.load();
    await restarted.resume();

    expect(active(restarted.snapshot()).view).toMatchObject({ wagers: [{ target: 'red', amount: '10' }] });
  });

  it('lets an account switch leave nothing half-saved: the earlier account session\'s practice writes and reveals nothing, and the next account sees none of it', async () => {
    const vault = newDevice().vault();
    const a = opened(await vault.open('account-a'));
    const controller = controllerFor(a);
    await controller.load();
    await controller.start({ game: 'roulette', buyIn: '1000' });
    await controller.placeWager('red', '10');

    const b = opened(await vault.open('account-b'));
    await controller.spin();

    expect(active(controller.snapshot())).toMatchObject({ save: 'failed', view: { outcome: null } });
    expect(await b.store.findUnfinished()).toBeNull();
    const back = opened(await vault.open('account-a'));
    expect(await back.store.findUnfinished()).toMatchObject({ sequence: 1 });
  });
});
