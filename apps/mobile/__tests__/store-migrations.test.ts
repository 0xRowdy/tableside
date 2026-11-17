// #86

import { closeSync, existsSync, openSync, readFileSync, writeFileSync, writeSync } from 'node:fs';

import type { AccountSession, VaultOpening } from '@/account/vault';
import { schemaVersionOf } from '@/account/store-schema';
import { laterBuild } from '@/account/testing/later-build';
import { nodeSqlCipherDriver } from '@/account/testing/node-sqlcipher';
import { TestDevice } from '@/account/testing/vault-substitutes';
import { completedRecord, newActivity, transition } from '@/practice/testing/store-contract';

const devices: TestDevice[] = [];
afterAll(() => devices.forEach((device) => device.remove()));

function device(): TestDevice {
  const made = new TestDevice();
  devices.push(made);
  return made;
}

function opened(opening: VaultOpening): AccountSession {
  if (opening.status !== 'open') throw new Error(`expected an open database, got ${JSON.stringify(opening)}`);
  return opening.session;
}

const LATER_BUILD = laterBuild();
const LATER_SCHEMA = schemaVersionOf(LATER_BUILD);

const practiceIn = (session: AccountSession, activityId: string) => {
  const base = newActivity(activityId);
  return newActivity(activityId, { specification: { ...base.specification, owner: session.accountId, device: session.installationId } });
};
const resultIn = (session: AccountSession, activityId: string) => completedRecord(activityId, { owner: session.accountId, device: session.installationId });

function snapshot(phone: TestDevice): Record<string, string> {
  return Object.fromEntries(phone.files.written().map((path) => [path, existsSync(path) ? readFileSync(path).toString('base64') : '(absent)']));
}

const strays = (phone: TestDevice) => phone.files.written().filter((path) => !/\/installation$|\.db(-wal|-shm)?$/.test(path));

function damage(phone: TestDevice, accountId = 'account-a'): void {
  const path = phone.files.written().find((file) => file.endsWith(`/${accountId}.db`))!;
  const descriptor = openSync(path, 'r+');
  writeSync(descriptor, Buffer.alloc(4096, 0x5a), 0, 4096, 0);
  closeSync(descriptor);
}

const IDS = ['done', 'unfinished'];

async function contents(session: AccountSession, activityIds: readonly string[]) {
  const { store } = session;
  return {
    activities: await Promise.all(activityIds.map((id) => store.load(id))),
    transitions: await Promise.all(activityIds.map((id) => store.readTransitions(id))),
    effects: await Promise.all(activityIds.map((id) => store.readEffects(id))),
    unfinished: await store.findUnfinished(),
    outgoing: await store.readOutgoing(),
  };
}

async function leftBySchema1(phone: TestDevice, accountId = 'account-a') {
  const vault = phone.vault();
  const session = opened(await vault.open(accountId));
  await session.store.createActivity(practiceIn(session, 'done'));
  await session.store.commitTransition(transition('done', 0));
  await session.store.recordEffects('done', [{ effectId: { grant: 'g1', activity: 'done', sequence: 1 }, kind: 'turn-charge', amount: '1' }]);
  await session.store.complete(resultIn(session, 'done'));
  await session.store.createActivity(practiceIn(session, 'unfinished'));
  await session.store.commitTransition(transition('unfinished', 0));
  await session.store.commitTransition(transition('unfinished', 1));
  const before = await contents(session, ['done', 'unfinished']);
  await vault.close();
  return before;
}

describe('an update', () => {
  it('opens an account database a release left, two releases later (both skipped), with every record as it was', async () => {
    const phone = device();
    const before = await leftBySchema1(phone);

    const session = opened(await phone.vault('production', undefined, LATER_BUILD).open('account-a'));

    expect(await contents(session, ['done', 'unfinished'])).toEqual(before);
    expect(await session.store.commitTransition(transition('unfinished', 2))).toEqual({ status: 'committed' });
  });
});

describe('a failed migration', () => {
  it('on a full disk leaves the database as the earlier build left it, and the next open completes it', async () => {
    const phone = device();
    const before = await leftBySchema1(phone);
    let fault: 'full' | undefined = 'full';

    const failed = await phone.vault('production', nodeSqlCipherDriver({ fault: () => fault }), LATER_BUILD).open('account-a');

    expect(failed).toMatchObject({ status: 'migration-failed', accountId: 'account-a', reason: 'full' });
    expect(strays(phone)).toEqual([]);
    expect(await contents(opened(await phone.vault().open('account-a')), IDS)).toEqual(before);
    fault = undefined;
    expect(await contents(opened(await phone.vault('production', undefined, LATER_BUILD).open('account-a')), IDS)).toEqual(before);
  });

  it('never runs on a backup that is not the database as it stands: a sound but older copy is refused', async () => {
    const phone = device();
    await leftBySchema1(phone);
    const database = phone.files.written().find((file) => file.endsWith('/account-a.db'))!;
    const older = readFileSync(database);
    const earlier = phone.vault();
    const session = opened(await earlier.open('account-a'));
    await session.store.commitTransition(transition('unfinished', 2));
    const before = await contents(session, IDS);
    await earlier.close();
    phone.files = { ...phone.files, copy: async (_, to) => writeFileSync(to, older) };

    const failed = await phone.vault('production', undefined, LATER_BUILD).open('account-a');

    expect(failed).toMatchObject({ status: 'migration-failed' });
    expect(strays(phone)).toEqual([]);
    expect(await contents(opened(await phone.vault().open('account-a')), IDS)).toEqual(before);
  });
});

describe('a kill during the migration', () => {
  it('leaves the old generation or the complete new one at every point, never opens for play, and the next start finishes with nothing lost', async () => {
    const seen = new Set<string>();
    for (let at = 0; ; at++) {
      const phone = device();
      const before = await leftBySchema1(phone);
      phone.killAt(at);
      const killed = await phone
        .vault('production', undefined, LATER_BUILD)
        .open('account-a')
        .catch((error: unknown) => error);
      const died = phone.killed;
      phone.revive();
      if (!died) {
        expect(await contents(opened(killed as VaultOpening), IDS)).toEqual(before);
        break;
      }
      expect(killed).not.toMatchObject({ status: 'open' });

      const earlier = await phone.vault().open('account-a');
      if (earlier.status === 'open') {
        expect(await contents(earlier.session, IDS)).toEqual(before);
        seen.add('old');
      } else {
        expect(earlier).toMatchObject({ status: 'needs-update', schema: LATER_SCHEMA });
        seen.add('new');
      }
      const session = opened(await phone.vault('production', undefined, LATER_BUILD).open('account-a'));
      expect(await contents(session, IDS)).toEqual(before);
      expect(strays(phone)).toEqual([]);
    }
    expect([...seen].sort()).toEqual(['new', 'old']);
  });

  it('puts the verified backup back when the kill also damaged the database, but only while nothing has played on the new generation', async () => {
    const seen = new Set<string>();
    for (let at = 0; ; at++) {
      const phone = device();
      const before = await leftBySchema1(phone);
      phone.killAt(at);
      await phone
        .vault('production', undefined, LATER_BUILD)
        .open('account-a')
        .catch(() => undefined);
      const died = phone.killed;
      phone.revive();
      if (!died) break;
      damage(phone);

      const restarted = await phone.vault('production', undefined, LATER_BUILD).open('account-a');
      if (restarted.status === 'open') {
        expect(await contents(restarted.session, IDS)).toEqual(before);
        expect(strays(phone).filter((path) => !/\.unreadable-\d+(-wal)?$/.test(path))).toEqual([]);
        seen.add('restored');
      } else {
        expect(restarted).toMatchObject({ status: 'recovery-needed', reason: 'database-unreadable' });
        seen.add('recovery-needed');
      }
    }
    expect([...seen].sort()).toEqual(['recovery-needed', 'restored']);
  });

  it('never puts a pre-migration backup over play on the new generation: a later damaged database is Recovery needed, its bytes kept', async () => {
    const phone = device();
    await leftBySchema1(phone);
    const later = phone.vault('production', undefined, LATER_BUILD);
    const session = opened(await later.open('account-a'));
    await session.store.commitTransition(transition('unfinished', 2));
    await later.close();
    damage(phone);
    const files = snapshot(phone);

    const restarted = await phone.vault('production', undefined, LATER_BUILD).open('account-a');

    expect(restarted).toMatchObject({ status: 'recovery-needed', reason: 'database-unreadable' });
    expect(snapshot(phone)).toEqual(files);
  });
});

describe('a rollback', () => {
  it('is blocked from a database a later build migrated: it needs the update, and changes nothing', async () => {
    const phone = device();
    const before = await leftBySchema1(phone);
    const later = phone.vault('production', undefined, LATER_BUILD);
    opened(await later.open('account-a'));
    await later.close();
    const files = snapshot(phone);

    const rolledBack = await phone.vault().open('account-a');

    expect(rolledBack).toMatchObject({ status: 'needs-update', accountId: 'account-a', schema: LATER_SCHEMA });
    expect(snapshot(phone)).toEqual(files);
    expect(await contents(opened(await phone.vault('production', undefined, LATER_BUILD).open('account-a')), ['done', 'unfinished'])).toEqual(before);
  });

  it("is blocked from a later build's interrupted migration, damaged database or not, and leaves its backup and manifest alone", async () => {
    for (const damaged of [false, true]) {
      const phone = device();
      const before = await leftBySchema1(phone);
      for (let at = 0; !phone.files.written().some((path) => path.endsWith('.db.migration')); at++) {
        phone.killAt(at);
        await phone
          .vault('production', undefined, LATER_BUILD)
          .open('account-a')
          .catch(() => undefined);
        phone.revive();
      }
      if (damaged) damage(phone);
      const files = snapshot(phone);

      expect(await phone.vault().open('account-a')).toMatchObject({ status: 'needs-update', accountId: 'account-a' });
      expect(snapshot(phone)).toEqual(files);
      expect(await contents(opened(await phone.vault('production', undefined, LATER_BUILD).open('account-a')), IDS)).toEqual(before);
    }
  });
});

describe('the backup', () => {
  it("holds what a killed app's write-ahead log had committed: nothing is lost by migrating a database left mid-play", async () => {
    const phone = device();
    await leftBySchema1(phone);
    const earlier = phone.vault();
    const session = opened(await earlier.open('account-a'));
    await session.store.commitTransition(transition('unfinished', 2));
    const before = await contents(session, IDS);
    const database = phone.files.written().find((file) => file.endsWith('/account-a.db'))!;
    const killed = { database: readFileSync(database), log: readFileSync(`${database}-wal`) };
    await earlier.close();
    writeFileSync(database, killed.database);
    writeFileSync(`${database}-wal`, killed.log);

    const session2 = opened(await phone.vault('production', undefined, LATER_BUILD).open('account-a'));

    expect(await contents(session2, IDS)).toEqual(before);
  });
});
