// The SQLCipher account store at seam 1: spec 1's store contract suite runs
// unchanged against it (on Node SQLCipher here; on device the native test host
// runs it), plus the additions spec 2 makes at the same seam.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Database from 'better-sqlite3-multiple-ciphers';
import { FLAT_EVEN_MONEY } from '@tableside/definitions';

import { openVerifiedConnection, SqlError, type RawSqlConnection } from '@/account/sql';
import { SqliteActivityStore, StaleSessionError, StoreIntegrityError, StoreMismatchError, UnsupportedSchemaError, type StoreIdentity } from '@/account/sqlite-store';
import { nodeSqlCipherDriver } from '@/account/testing/node-sqlcipher';
import { PracticeController, type PracticeSnapshot } from '@/practice/controller';
import { completedRecord, describeActivityStoreContract, newActivity, transition } from '@/practice/testing/store-contract';
import { FakeClock, substituteAdapters } from '@/practice/testing/substitutes';

const KEY = 'ab'.repeat(32);
/** The contract suite's activities name owner "local" on "test-device". */
const CONTRACT_IDENTITY: StoreIdentity = { environment: 'test', accountId: 'local', installationId: 'test-device' };

const directories: string[] = [];
const opened: SqliteActivityStore[] = [];
afterAll(async () => {
  await Promise.all(opened.map((store) => store.close()));
  directories.forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

function databasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), 'tableside-store-'));
  directories.push(directory);
  return join(directory, 'account.db');
}

async function openStore(path: string, identity = CONTRACT_IDENTITY, driver = nodeSqlCipherDriver()) {
  const store = await SqliteActivityStore.open(await driver.open(path, KEY), identity);
  opened.push(store);
  return store;
}

describeActivityStoreContract('the SQLCipher store', async () => {
  const path = databasePath();
  // A restart is a second connection over the same file; the suite may keep using the first.
  return { store: await openStore(path), reopen: () => openStore(path) };
});

/** A second, raw connection to the file, as an outside party (or a damaged disk) would touch it. */
function raw(path: string, key = KEY): Database.Database {
  const db = new Database(path);
  db.pragma(`cipher = 'sqlcipher'`);
  db.pragma('legacy = 4');
  db.pragma(`key = "x'${key}'"`);
  return db;
}

function rawOver(db: Database.Database): RawSqlConnection {
  return {
    exec: async (sql) => void db.exec(sql),
    run: async (sql, params = []) => db.prepare(sql).run(...params).changes,
    get: async <T>(sql: string, params: readonly (string | number | null)[] = []) => (db.prepare(sql).get(...params) as T | undefined) ?? null,
    all: async <T>(sql: string, params: readonly (string | number | null)[] = []) => db.prepare(sql).all(...params) as T[],
    close: async () => void db.close(),
  };
}

function active(snapshot: PracticeSnapshot) {
  if (snapshot.status !== 'active') throw new Error(`expected an active session, got ${snapshot.status}`);
  return snapshot;
}

describe('the SQLCipher store', () => {
  it('keeps the database encrypted: no stored text is readable from the file, and another key opens nothing', async () => {
    const path = databasePath();
    const store = await openStore(path);
    await store.createActivity(newActivity('a1'));
    await store.complete(completedRecord('a1'));
    await store.close();

    for (const file of [path, `${path}-wal`]) {
      const bytes = (() => {
        try {
          return readFileSync(file);
        } catch {
          return Buffer.alloc(0);
        }
      })();
      expect(bytes.includes('roulette/single-zero')).toBe(false);
    }
    await expect(nodeSqlCipherDriver().open(path, 'cd'.repeat(32))).rejects.toMatchObject({ kind: 'unreadable' });
  });

  it('runs in WAL with synchronous=FULL on its connection, and refuses a connection that cannot be made durable', async () => {
    const path = databasePath();
    await openStore(path);
    const outside = raw(path);
    expect(outside.pragma('journal_mode', { simple: true })).toBe('wal');
    outside.close();

    // A connection that can't use WAL (an in-memory database), or that ignores synchronous=FULL, is refused rather than used.
    await expect(openVerifiedConnection(rawOver(new Database(':memory:')))).rejects.toMatchObject({ kind: 'not-durable' });
    // Some platform builds default to synchronous=NORMAL; this connection stays there.
    const normal = raw(databasePath());
    normal.pragma('synchronous = NORMAL');
    const ignoresFull = rawOver(normal);
    await expect(openVerifiedConnection({ ...ignoresFull, exec: async (sql) => (/synchronous/.test(sql) ? undefined : ignoresFull.exec(sql)) })).rejects.toMatchObject({
      kind: 'not-durable',
    });
  });

  it('holds only text and integer columns: no value is ever a floating-point column', async () => {
    const path = databasePath();
    await openStore(path);
    const outside = raw(path);
    const tables = outside.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[];
    const types = new Set(tables.flatMap(({ name }) => (outside.prepare(`SELECT type FROM pragma_table_info('${name}')`).all() as { type: string }[]).map((column) => column.type)));
    outside.close();

    expect([...types].sort()).toEqual(['INTEGER', 'TEXT']);
  });

  it('keeps money as exact canonical text', async () => {
    const store = await openStore(databasePath());
    await store.createActivity(newActivity('a1'));
    const record = completedRecord('a1', { buyIn: '1000.05', finalCashOut: '999999999999999999999.95', netResult: '999999999999999998999.9' });

    await store.complete(record);

    expect((await store.load('a1'))?.completion).toMatchObject({ buyIn: '1000.05', finalCashOut: '999999999999999999999.95', netResult: '999999999999999998999.9' });
  });

  it('checks each stored value on read: changed bytes are reported, never returned', async () => {
    const path = databasePath();
    const store = await openStore(path);
    await store.createActivity(newActivity('a1'));
    await store.commitTransition(transition('a1', 0));

    const outside = raw(path);
    outside.prepare(`UPDATE transitions SET body = replace(body, '27', '28')`).run();
    outside.prepare(`UPDATE activities SET body_format = 2`).run();
    outside.close();

    await expect(store.readReceipt('a1', 'cmd-0')).rejects.toBeInstanceOf(StoreIntegrityError);
    await expect(store.load('a1')).rejects.toBeInstanceOf(StoreIntegrityError);
  });

  it('records the account as owner and the installation as originating device, and refuses anyone else', async () => {
    const identity: StoreIdentity = { environment: 'test', accountId: 'account-1', installationId: 'installation-1' };
    const store = await openStore(databasePath(), identity);
    const mine = newActivity('a1', { specification: { ...newActivity('a1').specification, owner: 'account-1', device: 'installation-1' } });

    expect((await store.createActivity(mine)).specification).toMatchObject({ owner: 'account-1', device: 'installation-1' });
    await expect(store.createActivity(newActivity('a2'))).rejects.toBeInstanceOf(StoreMismatchError);
    await expect(store.complete(completedRecord('a1'))).rejects.toBeInstanceOf(StoreMismatchError);
    expect(await store.readOutgoing()).toEqual([]);
  });

  it('opens a database only for the environment, account and installation it was made for', async () => {
    const path = databasePath();
    await (await openStore(path)).close();

    for (const other of [
      { ...CONTRACT_IDENTITY, accountId: 'someone-else' },
      { ...CONTRACT_IDENTITY, installationId: 'another-installation' },
      { ...CONTRACT_IDENTITY, environment: 'production' },
    ]) {
      await expect(openStore(path, other)).rejects.toBeInstanceOf(StoreMismatchError);
    }
  });

  it('refuses a schema this build did not create (migrations are the migration runner\'s)', async () => {
    const path = databasePath();
    await (await openStore(path)).close();
    const outside = raw(path);
    outside.prepare(`UPDATE meta SET value = '2' WHERE name = 'schema_version'`).run();
    outside.close();

    await expect(openStore(path)).rejects.toBeInstanceOf(UnsupportedSchemaError);
  });

  it('keeps an unfinished activity\'s pinned rules and strategy revision intact for as long as it is unfinished', async () => {
    const path = databasePath();
    const adapters = substituteAdapters({ clock: new FakeClock(undefined, true) });
    const store = await openStore(path);
    const controller = new PracticeController({ ...adapters, store });
    await controller.load();
    await controller.start({ game: 'roulette', buyIn: '1000', strategy: { definition: FLAT_EVEN_MONEY, parameters: { target: 'red' } } });
    const pinned = (await store.findUnfinished())?.specification;
    expect(pinned?.strategy).not.toBeNull();
    // Other practice comes and goes around it.
    await store.createActivity(newActivity('other'));
    await store.complete(completedRecord('other'));

    const reopened = await openStore(path);

    expect((await reopened.findUnfinished())?.specification).toEqual(pinned);
  });

  it('reads and writes nothing once the account session that opened it has ended', async () => {
    const path = databasePath();
    let current = true;
    const store = await SqliteActivityStore.open(await nodeSqlCipherDriver().open(path, KEY), CONTRACT_IDENTITY, { isCurrent: () => current });
    opened.push(store);
    await store.createActivity(newActivity('a1'));

    current = false;

    await expect(store.commitTransition(transition('a1', 0))).rejects.toBeInstanceOf(StaleSessionError);
    await expect(store.complete(completedRecord('a1'))).rejects.toBeInstanceOf(StaleSessionError);
    await expect(store.findUnfinished()).rejects.toBeInstanceOf(StaleSessionError);
    expect((await (await openStore(path)).load('a1'))?.sequence).toBe(0);
  });

  it('pauses play before any unsaved reveal when the disk is full, with a save status and a retry that carries on', async () => {
    let fault: 'full' | 'io' | undefined;
    const store = await openStore(databasePath(), CONTRACT_IDENTITY, nodeSqlCipherDriver({ fault: () => fault }));
    const adapters = substituteAdapters({ clock: new FakeClock(undefined, true) });
    const controller = new PracticeController({ ...adapters, store });
    await controller.load();
    await controller.start({ game: 'roulette', buyIn: '1000' });
    await controller.placeWager('red', '10');
    const shown: PracticeSnapshot[] = [];
    controller.subscribe(() => shown.push(controller.snapshot()));

    fault = 'full';
    await controller.spin();

    expect(active(controller.snapshot())).toMatchObject({ save: 'failed', view: { outcome: null } });
    expect(shown.every((snapshot) => snapshot.status !== 'active' || snapshot.view.outcome === null)).toBe(true);
    expect((await store.findUnfinished())?.sequence).toBe(1);

    fault = undefined;
    await controller.retrySave();

    expect(active(controller.snapshot())).toMatchObject({ save: 'saved', view: { outcome: { turn: 1, pocket: 27 } } });
  });

  it('reports a write failure as the failure it was', async () => {
    let fault: 'full' | 'io' | undefined;
    const store = await openStore(databasePath(), CONTRACT_IDENTITY, nodeSqlCipherDriver({ fault: () => fault }));
    await store.createActivity(newActivity('a1'));

    fault = 'io';
    const failure = await store.commitTransition(transition('a1', 0)).catch((error: unknown) => error);
    fault = 'full';
    const full = await store.complete(completedRecord('a1')).catch((error: unknown) => error);
    fault = undefined;

    expect(failure).toEqual(new SqlError('io', 'disk I/O error'));
    expect(full).toEqual(new SqlError('full', 'database or disk is full'));
    expect(await store.load('a1')).toMatchObject({ sequence: 0, completion: null });
  });

  it('keeps exactly one outgoing synchronization record per completion, across a restart', async () => {
    const path = databasePath();
    const store = await openStore(path);
    await store.createActivity(newActivity('a1'));
    await store.complete(completedRecord('a1'));
    await store.close();

    const reopened = await openStore(path);
    await reopened.complete(completedRecord('a1', { netResult: '-5' }));

    expect(await reopened.readOutgoing()).toEqual([{ id: 'completed/a1', kind: 'completed-practice-session', record: completedRecord('a1') }]);
  });
});
