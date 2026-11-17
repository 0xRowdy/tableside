// #158
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SqliteActivityStore, type StoreIdentity } from '@/account/sqlite-store';
import { migrate, STORE_MIGRATIONS, type StoreMigration } from '@/account/store-schema';
import { dumpDatabase, type DatabaseDump } from '@/account/testing/database-dump';
import { nodeSqlCipherDriver } from '@/account/testing/node-sqlcipher';
import { newActivity, transition } from '@/practice/testing/store-contract';
import { lessonEvent, newAttempt } from '@/training/testing/store-contract';
import { MemoryTrainingStore } from '@/training/memory-store';
import { describeTrainingStoreContract } from '@/training/testing/store-contract';

const KEY = 'cd'.repeat(32);
const IDENTITY: StoreIdentity = { environment: 'test', accountId: 'local', installationId: 'test-device' };
const directories: string[] = [];
const opened: SqliteActivityStore[] = [];
afterAll(async () => {
  await Promise.all(opened.map((store) => store.close().catch(() => undefined)));
  directories.forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

function databasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), 'tableside-training-'));
  directories.push(directory);
  return join(directory, 'account.db');
}

const tablesOf = (dump: DatabaseDump) => dump.schema.flatMap((statement) => /^CREATE TABLE (\w+)/.exec(statement)?.[1] ?? []);

async function openStore(path: string, migrations?: readonly StoreMigration[]) {
  const store = await SqliteActivityStore.open(await nodeSqlCipherDriver().open(path, KEY), IDENTITY, migrations ? { migrations } : {});
  opened.push(store);
  return store;
}

describeTrainingStoreContract('the memory training store', async () => {
  const store = new MemoryTrainingStore();
  return { store, reopen: async () => store.reopen() };
});

describeTrainingStoreContract('the SQLCipher store', async () => {
  const path = databasePath();
  return { store: await openStore(path), reopen: () => openStore(path) };
});

describe('the SQLCipher store', () => {
  it('keeps an unfinished challenge attempt beside an unfinished practice session', async () => {
    const store = await openStore(databasePath());
    await store.createActivity(newActivity('practice-1'));
    await store.createAttempt(newAttempt('attempt-1'));
    expect((await store.findUnfinished())?.activityId).toBe('practice-1');
    expect((await store.findUnfinishedAttempt())?.attemptId).toBe('attempt-1');
  });

  // #143
  it('refuses a lesson-progress event of another account or installation', async () => {
    const store = await openStore(databasePath());
    await expect(store.recordLessonEvent(lessonEvent('e-1', { owner: 'someone-else' }))).rejects.toThrow(/another account or installation/);
    await expect(store.recordLessonEvent(lessonEvent('e-2', { installation: 'other-device' }))).rejects.toThrow(/another account or installation/);
    expect(await store.readLessonEvents()).toEqual([]);
  });

  it('migrates a schema-2 database, keeping its attempts and preferences, and adds exactly the lesson-progress events table', async () => {
    const path = databasePath();
    const before = await openStore(path, STORE_MIGRATIONS.slice(0, 1));
    await before.createAttempt(newAttempt('attempt-1'));
    await before.writePreference('last-setup', '{}');
    const kept = await before.loadAttempt('attempt-1');
    await before.close();

    const connection = await nodeSqlCipherDriver().open(path, KEY);
    const tablesBefore = tablesOf(await dumpDatabase(connection));
    await connection.transaction((tx) => migrate(tx, 2, STORE_MIGRATIONS));
    const added = tablesOf(await dumpDatabase(connection)).filter((table) => !tablesBefore.includes(table));
    await connection.close();
    const after = await openStore(path);

    expect(added).toEqual(['lesson_progress_events']);
    expect(await after.loadAttempt('attempt-1')).toEqual(kept);
    expect(await after.readPreference('last-setup')).toBe('{}');
    expect(await after.recordLessonEvent(lessonEvent('e-1'))).toMatchObject({ deviceSequence: 1 });
  });

  it('migrates a schema-1 database, keeping its practice records, and adds attempt and preference storage', async () => {
    const path = databasePath();
    const before = await openStore(path, []);
    await before.createActivity(newActivity('practice-1'));
    await before.commitTransition(transition('practice-1', 0));
    const kept = await before.load('practice-1');
    await before.close();

    const connection = await nodeSqlCipherDriver().open(path, KEY);
    await connection.transaction((tx) => migrate(tx, 1, STORE_MIGRATIONS));
    await connection.close();
    const after = await openStore(path);

    expect(await after.load('practice-1')).toEqual(kept);
    await after.createAttempt(newAttempt('attempt-1'));
    await after.writePreference('last-setup', '{}');
    expect(await after.readPreference('last-setup')).toBe('{}');
  });
});
