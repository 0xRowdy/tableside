// The account vault at seam 1: per (environment, account, installation) keys
// and encrypted databases, the account-session generation, locked versus lost
// keys, recovery that keeps the original bytes, and backup exclusion. Each test
// is one device: a fake keychain, real files in a temporary directory and real
// SQLCipher (Node).

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

import type { AccountSession, VaultOpening } from '@/account/vault';
import { StaleSessionError } from '@/account/sqlite-store';
import { nodeSqlCipherDriver } from '@/account/testing/node-sqlcipher';
import { nodeVaultFiles, TestDevice, type NodeVaultFiles } from '@/account/testing/vault-substitutes';
import { completedRecord, newActivity, transition } from '@/practice/testing/store-contract';

const devices: TestDevice[] = [];
afterAll(() => devices.forEach((device) => device.remove()));

class Device extends TestDevice {
  constructor() {
    super();
    devices.push(this);
  }
}

function opened(opening: VaultOpening): AccountSession {
  if (opening.status !== 'open') throw new Error(`expected an open database, got ${JSON.stringify(opening)}`);
  return opening.session;
}

/** The activity the session's practice controller would create: owned by the account, from this installation. */
function practiceIn(session: AccountSession, activityId: string) {
  const base = newActivity(activityId);
  return newActivity(activityId, { specification: { ...base.specification, owner: session.accountId, device: session.installationId } });
}

function resultIn(session: AccountSession, activityId: string) {
  return completedRecord(activityId, { owner: session.accountId, device: session.installationId });
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

/** Every file under the vault's root with its bytes, to show recovery changes nothing. */
function snapshot(files: NodeVaultFiles): Record<string, string> {
  return Object.fromEntries(files.written().map((path) => [path, existsSync(path) ? readFileSync(path).toString('base64') : '(absent)']));
}

describe('the account vault', () => {
  it('opens one encrypted database per account, owned by the account ID from the registered installation, and keeps it across sign-out', async () => {
    const device = new Device();
    const vault = device.vault();

    const session = opened(await vault.open('account-a'));
    expect(session).toMatchObject({ environment: 'production', accountId: 'account-a' });
    expect(session.installationId).toMatch(/^installation-/);
    await session.store.createActivity(practiceIn(session, 'a1'));
    await session.store.commitTransition(transition('a1', 0));
    await vault.close();

    const restarted = device.vault();
    const again = opened(await restarted.open('account-a'));

    expect(again.installationId).toBe(session.installationId);
    expect(await again.store.findUnfinished()).toMatchObject({ activityId: 'a1', sequence: 1, specification: { owner: 'account-a', device: session.installationId } });
  });

  it('gives each account its own random key in secure storage, named by environment, installation and account', async () => {
    const device = new Device();
    const vault = device.vault();
    const a = opened(await vault.open('account-a'));
    await vault.open('account-b');

    const keys = device.keychain.entries().filter(([name]) => name.endsWith('.key'));
    expect(keys.map(([name]) => name).sort()).toEqual([`tableside.production.${a.installationId}.account-a.key`, `tableside.production.${a.installationId}.account-b.key`]);
    const [first, second] = keys.map(([, value]) => (JSON.parse(value) as { key: string }).key);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toBe(second);
  });

  describe('the account-session generation', () => {
    it('increments on every sign-in, sign-out and account switch', async () => {
      const vault = new Device().vault();
      const generations = [vault.generation];

      generations.push(opened(await vault.open('account-a')).generation);
      await vault.close();
      generations.push(vault.generation);
      generations.push(opened(await vault.open('account-a')).generation);
      generations.push(opened(await vault.open('account-b')).generation);

      expect(generations).toEqual([0, 1, 2, 3, 4]);
      expect(vault.generation).toBe(4);
    });

    it('lets a stale generation write nothing, even after signing back into the same account', async () => {
      const vault = new Device().vault();
      const before = opened(await vault.open('account-a'));
      await before.store.createActivity(practiceIn(before, 'a1'));
      await vault.close();
      const after = opened(await vault.open('account-a'));

      await expect(before.store.commitTransition(transition('a1', 0))).rejects.toBeInstanceOf(StaleSessionError);
      await expect(before.store.complete(resultIn(before, 'a1'))).rejects.toThrow();

      expect(await after.store.load('a1')).toMatchObject({ sequence: 0, completion: null });
      expect(await after.store.readOutgoing()).toEqual([]);
    });

    it('reports a sign-in that a sign-out overtook as superseded, never as an open session', async () => {
      const device = new Device();
      let release: () => void = () => undefined;
      const opening = new Promise<void>((resolve) => (release = resolve));
      const driver = nodeSqlCipherDriver();
      const vault = device.vault('production', { open: async (path, key) => (await opening, driver.open(path, key)) });

      const signIn = vault.open('account-a');
      await settle();
      // The generation moves on at once; the sign-out's close waits for the open in flight.
      const signOut = vault.close();
      release();
      await signOut;

      expect(await signIn).toEqual({ status: 'superseded' });
      const next = opened(await vault.open('account-a'));
      expect(next.generation).toBe(vault.generation);
    });

    it('drops an asynchronous completion that arrives after the generation moved on', async () => {
      const vault = new Device().vault();
      const session = opened(await vault.open('account-a'));
      const applied: string[] = [];

      expect(vault.ifCurrent(session.generation, () => applied.push('current'))).toEqual({ applied: true, value: 1 });
      await vault.open('account-b');
      expect(vault.ifCurrent(session.generation, () => applied.push('late'))).toEqual({ applied: false });

      expect(applied).toEqual(['current']);
    });
  });

  it('keeps two accounts on one installation fully apart', async () => {
    const device = new Device();
    const vault = device.vault();
    const a = opened(await vault.open('account-a'));
    await a.store.createActivity(practiceIn(a, 'a-done'));
    await a.store.complete(resultIn(a, 'a-done'));
    await a.store.createActivity(practiceIn(a, 'a-open'));

    const b = opened(await vault.open('account-b'));

    expect(await b.store.findUnfinished()).toBeNull();
    expect(await b.store.load('a-done')).toBeNull();
    expect(await b.store.readOutgoing()).toEqual([]);
    // B's store refuses A's practice outright.
    await expect(b.store.createActivity(practiceIn(a, 'a-open'))).rejects.toThrow();
    // And B's key can't read A's file.
    const aKey = (JSON.parse(device.keychain.get(`tableside.production.${a.installationId}.account-a.key`) ?? '{}') as { key: string }).key;
    const bKey = (JSON.parse(device.keychain.get(`tableside.production.${b.installationId}.account-b.key`) ?? '{}') as { key: string }).key;
    const aFile = device.files.written().find((path) => path.endsWith('account-a.db')) ?? '';
    await expect(nodeSqlCipherDriver().open(aFile, bKey)).rejects.toMatchObject({ kind: 'unreadable' });
    expect(aKey).not.toBe(bKey);

    const back = opened(await vault.open('account-a'));
    expect((await back.store.findUnfinished())?.activityId).toBe('a-open');
    expect(await back.store.readOutgoing()).toHaveLength(1);
  });

  it('keeps environments apart: the same account has a separate database and key per environment', async () => {
    const device = new Device();
    const beta = opened(await device.vault('beta').open('account-a'));
    await beta.store.createActivity(practiceIn(beta, 'beta-practice'));

    const production = opened(await device.vault('production').open('account-a'));

    expect(await production.store.findUnfinished()).toBeNull();
    expect(production.installationId).not.toBe(beta.installationId);
    expect(device.keychain.entries().map(([name]) => name.split('.')[1])).toEqual(expect.arrayContaining(['beta', 'production']));
  });

  describe('key states', () => {
    it('waits while the device is locked, creating nothing, then opens once it unlocks', async () => {
      const device = new Device();
      const first = opened(await device.vault().open('account-a'));
      await first.store.createActivity(practiceIn(first, 'a1'));
      device.keychain.locked = true;
      const before = snapshot(device.files);

      let outcome: VaultOpening | null = null;
      const vault = device.vault();
      const opening = vault.open('account-a').then((result) => (outcome = result));
      await settle();

      expect(outcome).toBeNull();
      expect(device.waitingForUnlock).toBe(1);
      expect(snapshot(device.files)).toEqual(before);

      device.unlock();
      await opening;
      expect((await opened(outcome!).store.findUnfinished())?.activityId).toBe('a1');
    });

    it('stops waiting for the unlock when the user signs out meanwhile', async () => {
      const device = new Device();
      await device.vault().open('account-a');
      device.keychain.locked = true;
      const vault = device.vault();

      const opening = vault.open('account-a');
      await settle();
      await vault.close();
      device.unlock();

      expect(await opening).toEqual({ status: 'superseded' });
    });

    it('treats a lost key as Recovery needed: keeps the original bytes and never creates a replacement', async () => {
      const device = new Device();
      const session = opened(await device.vault().open('account-a'));
      await session.store.createActivity(practiceIn(session, 'a1'));
      await device.vault().close();
      device.keychain.remove(`tableside.production.${session.installationId}.account-a.key`);
      const before = snapshot(device.files);

      const vault = device.vault();
      const first = await vault.open('account-a');
      const second = await vault.open('account-a');

      expect(first).toMatchObject({ status: 'recovery-needed', accountId: 'account-a', reason: 'key-missing' });
      expect(second).toMatchObject({ status: 'recovery-needed', reason: 'key-missing' });
      expect(snapshot(device.files)).toEqual(before);
      expect(device.keychain.get(`tableside.production.${session.installationId}.account-a.key`)).toBeUndefined();
    });

    it('treats a lost database as Recovery needed and never creates an empty one in its place', async () => {
      const device = new Device();
      const session = opened(await device.vault().open('account-a'));
      await session.store.close();
      const file = device.files.written().find((path) => path.endsWith('account-a.db')) ?? '';
      for (const path of [file, `${file}-wal`, `${file}-shm`]) rmSync(path, { force: true });

      const outcome = await device.vault().open('account-a');

      expect(outcome).toMatchObject({ status: 'recovery-needed', reason: 'database-missing' });
      expect(existsSync(file)).toBe(false);
    });

    it('treats a damaged database as Recovery needed and keeps its bytes exactly', async () => {
      const device = new Device();
      const session = opened(await device.vault().open('account-a'));
      await session.store.createActivity(practiceIn(session, 'a1'));
      await session.store.close();
      const file = device.files.written().find((path) => path.endsWith('account-a.db')) ?? '';
      const bytes = readFileSync(file);
      bytes.fill(7, 0, 64);
      writeFileSync(file, bytes);
      const before = snapshot(device.files);

      const outcome = await device.vault().open('account-a');

      expect(outcome).toMatchObject({ status: 'recovery-needed', reason: 'database-unreadable' });
      expect(snapshot(device.files)).toEqual(before);
    });

    it('treats a damaged key entry as Recovery needed', async () => {
      const device = new Device();
      const session = opened(await device.vault().open('account-a'));
      await session.store.close();
      device.keychain.set(`tableside.production.${session.installationId}.account-a.key`, 'not a key record');

      expect(await device.vault().open('account-a')).toMatchObject({ status: 'recovery-needed', reason: 'key-corrupt' });
    });

    it('finishes creating a database that a crash interrupted before it was first written', async () => {
      const device = new Device();
      const vault = device.vault();
      const installation = opened(await vault.open('account-a')).installationId;
      // The key was saved, then the app died before the database existed.
      device.keychain.set(`tableside.production.${installation}.account-b.key`, JSON.stringify({ v: 1, key: 'cd'.repeat(32), created: false }));

      const session = opened(await device.vault().open('account-b'));

      expect(await session.store.findUnfinished()).toBeNull();
    });
  });

  describe('installation identity', () => {
    it('never infers identity from restored files, and never replaces their databases: an account with one is Recovery needed', async () => {
      const original = new Device();
      const old = opened(await original.vault().open('account-a'));
      await old.store.createActivity(practiceIn(old, 'a1'));
      await old.store.close();

      // Files that came back without their device-only keychain entries (a restore, were they ever backed up, or a lost keychain).
      const restored = new Device();
      restored.files = original.files;
      const before = snapshot(original.files);
      const vault = restored.vault();
      const other = opened(await vault.open('account-b'));
      const outcome = await vault.open('account-a');
      const afterRestart = await restored.vault().open('account-a');

      expect(other.installationId).not.toBe(old.installationId);
      expect(outcome).toMatchObject({ status: 'recovery-needed', reason: 'key-missing' });
      expect(afterRestart).toMatchObject({ status: 'recovery-needed', reason: 'key-missing' });
      // The earlier installation's databases are left exactly as they were, and no empty one is made for account A.
      const earlier = Object.entries(before).filter(([path]) => path.includes(`/${old.installationId}/`));
      expect(earlier.length).toBeGreaterThan(0);
      expect(earlier.every(([path, bytes]) => snapshot(original.files)[path] === bytes)).toBe(true);
      expect(original.files.written().filter((path) => path.endsWith('account-a.db'))).toHaveLength(1);
    });

    it('never infers identity from surviving keychain entries: a reinstall gets a new installation and ignores the old keys', async () => {
      const device = new Device();
      const old = opened(await device.vault().open('account-a'));
      await old.store.close();

      // Uninstall removes the app's files; on iOS the keychain survives.
      rmSync(device.root, { recursive: true, force: true });
      device.files = nodeVaultFiles(device.root);
      const session = opened(await device.vault().open('account-a'));

      expect(session.installationId).not.toBe(old.installationId);
      expect(await session.store.findUnfinished()).toBeNull();
    });
  });

  it('keeps every database, WAL and sidecar file, and the installation identifier, inside directories excluded from backup and device transfer', async () => {
    const device = new Device();
    const vault = device.vault();
    const a = opened(await vault.open('account-a'));
    await a.store.createActivity(practiceIn(a, 'a1'));
    await vault.open('account-b');

    const written = device.files.written();
    expect(written.some((path) => path.endsWith('-wal'))).toBe(true);
    expect(written.some((path) => path.endsWith('installation'))).toBe(true);
    expect(written.every((path) => device.files.excluded().some((directory) => path.startsWith(`${directory}/`)))).toBe(true);
  });
});
