// Seam 2: Recovery needed (spec 2, *Account gate*, *Key states*; user story
// 23). A device whose account database can't be opened keeps the original
// bytes, restores the account's synced history into a fresh database under a
// new installation (so its per-device positions and command scope never
// collide with the original's, #98), and can sign out instead.

import { afterEach, describe, expect, it } from 'vitest';

import { completedPracticeSession } from '../src';
import { type SimulatedDevice, createAccountByEmail, createDevice, localStack, signInByEmail, uniqueEmail } from '../src/testing';

const stack = localStack();
const devices: SimulatedDevice[] = [];
function device(name: string): SimulatedDevice {
  const created = createDevice(stack, { name });
  devices.push(created);
  return created;
}
afterEach(() => devices.splice(0).forEach((d) => d.dispose()));

/** A phone whose account has a synced practice session, then lost the database's key: it reopens in Recovery needed. */
async function lostKey() {
  const email = uniqueEmail('recovery');
  const phone = device('phone');
  expect(await createAccountByEmail(phone, email)).toEqual({ status: 'signed-in' });
  const played = await phone.playPracticeSession();
  await phone.account.sync.idle();
  const gate = phone.account.gate;
  if (gate.state !== 'active') throw new Error('account setup failed');
  const { accountId } = gate;
  const installation = phone.vault.store().identity.installationId;
  phone.kill();
  phone.vault.loseKey(accountId);
  await phone.restart();
  expect(phone.account.gate).toEqual({ state: 'recovery-needed', accountId });
  // What the vault found and kept, once the killed process's connection had closed.
  const kept = phone.vault.accountFiles(accountId);
  return { email, phone, played, accountId, installation, kept };
}

describe('Recovery needed', () => {
  it('restores the synced history into a fresh database after a new sign-in, under a new installation, keeping the original bytes', async () => {
    const { email, phone, played, accountId, installation, kept } = await lostKey();
    expect(Object.keys(kept).length).toBeGreaterThan(0);

    expect(await phone.account.recover()).toEqual({ status: 'sign-in-needed' });
    expect(phone.account.gate).toEqual({ state: 'signed-out', accountId });

    await stack.resetCodeRequests();
    expect(await signInByEmail(phone, email)).toEqual({ status: 'signed-in' });
    await phone.account.sync.idle();
    expect(phone.account.gate).toMatchObject({ state: 'active', accountId });
    const restored = phone.vault.store();
    expect(restored.identity.installationId).not.toBe(installation);
    expect((await restored.readAcceptedRecords(completedPracticeSession.name)).map((record) => record.item)).toEqual([played.activityId]);
    expect(phone.account.sync.status.history).toEqual({ state: 'complete' });

    // The original's files are exactly as they were.
    const now = phone.vault.accountFiles(accountId);
    for (const [path, hash] of Object.entries(kept)) expect(now[path]).toBe(hash);
    // The server knows the fresh database as an installation of its own.
    const installations = await stack.sql<{ installation_id: string }[]>`
      select installation_id from private.installations where account_id = ${accountId} order by registered_at`;
    expect(installations.map((row) => row.installation_id)).toEqual([installation, restored.identity.installationId]);

    // A relaunch opens the fresh database again.
    await phone.restart();
    expect(phone.account.gate).toMatchObject({ state: 'active', accountId });
    expect(phone.vault.store().identity.installationId).toBe(restored.identity.installationId);
  });

  it('can sign out instead, keeping the original', async () => {
    const { phone, accountId, kept } = await lostKey();
    expect(await phone.account.signOut()).toMatchObject({ status: 'signed-out' });
    expect(phone.account.gate).toEqual({ state: 'signed-out', accountId });
    expect(phone.vault.accountFiles(accountId)).toEqual(kept);
  });

  it('is the only state recovery runs from', async () => {
    const phone = device('phone');
    expect(await createAccountByEmail(phone, uniqueEmail('no-recovery'))).toEqual({ status: 'signed-in' });
    const installation = phone.vault.store().identity.installationId;
    expect(await phone.account.recover()).toEqual({ status: 'failed' });
    expect(phone.account.gate).toMatchObject({ state: 'active' });
    expect(phone.vault.store().identity.installationId).toBe(installation);
  });
});
