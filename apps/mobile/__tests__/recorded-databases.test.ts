// #86

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ENVIRONMENT_NAMES } from '@tableside/account/environment';

import { forAccountSession } from '@/account/practice';
import { STORE_SCHEMA_VERSION } from '@/account/store-schema';
import { restoreDatabase } from '@/account/testing/database-dump';
import { laterBuild } from '@/account/testing/later-build';
import { RECORDED_STORE_SCHEMAS, type RecordedDatabase, type RecordedStoreSchema } from '@/account/testing/recorded';
import { TestDevice } from '@/account/testing/vault-substitutes';
import type { StoreMigration } from '@/account/store-schema';
import type { AccountSession } from '@/account/vault';
import { PracticeController } from '@/practice/controller';
import { FakeClock, substituteAdapters } from '@/practice/testing/substitutes';

const devices: TestDevice[] = [];
afterAll(() => devices.forEach((device) => device.remove()));

const BUILDS: readonly (readonly [string, readonly StoreMigration[] | undefined])[] = [
  ['this build', undefined],
  ['a build two releases later', laterBuild()],
];

const cases = RECORDED_STORE_SCHEMAS.flatMap((recording) =>
  recording.databases.flatMap((database) => BUILDS.map(([build, migrations]) => [`schema ${recording.storeSchema}: ${database.name}, on ${build}`, recording, database, migrations] as const)),
);

const stored = (database: RecordedDatabase, table: string, where: (row: Readonly<Record<string, unknown>>) => boolean = () => true) =>
  (database.rows[table] ?? []).filter(where).map((row) => JSON.parse(row.body as string) as unknown);

async function onDevice(database: RecordedDatabase, migrations: readonly StoreMigration[] | undefined): Promise<AccountSession> {
  const device = new TestDevice();
  devices.push(device);
  await device.leaveDatabase(database, (connection) => restoreDatabase(connection, database));
  const environment = ENVIRONMENT_NAMES.find((name) => name === database.environment);
  if (!environment) throw new Error(`recorded database in unknown environment ${database.environment}`);
  const opening = await device.vault(environment, undefined, migrations).open(database.accountId);
  if (opening.status !== 'open') throw new Error(`expected an open database, got ${JSON.stringify(opening)}`);
  return opening.session;
}

async function waitFor(condition: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !condition(); i++) await new Promise((resolve) => setImmediate(resolve));
  if (!condition()) throw new Error('condition never held');
}

describe('a recorded database', () => {
  it.each(cases)('upgrades directly (%s), every stored value as it was', async (_, recording: RecordedStoreSchema, database, migrations) => {
    const session = await onDevice(database, migrations);
    const { store } = session;

    for (const activity of stored(database, 'activities') as { activityId: string; checkpoint: string }[]) {
      const id = activity.activityId;
      expect(await store.load(id)).toEqual(activity);
      expect(await store.readTransitions(id)).toEqual(stored(database, 'transitions', (row) => row.activity_id === id));
      expect(await store.readEffects(id)).toEqual(stored(database, 'effects', (row) => row.activity_id === id));
      expect(JSON.parse(activity.checkpoint)).toMatchObject({ schema: recording.stateSchema, identities: { engine: recording.engine } });
    }
    expect(await store.readOutgoing()).toEqual(stored(database, 'outgoing'));
    expect((await store.findUnfinished())?.activityId ?? null).toBe(database.unfinished?.activityId ?? null);

    // #91
    const rows = (table: string) => database.rows[table] ?? [];
    expect((await store.readUploadQueue()).map(({ id, operation }) => ({ id, operation }))).toEqual(
      rows('outgoing')
        .filter((row) => row.status === 'pending')
        .map((row) => ({
          id: row.id,
          operation: row.operation_id === null ? null : { operationId: row.operation_id, request: row.request, requestHash: row.request_sha256 },
        })),
    );
    expect(await store.readAcceptedRecords('completed-practice-session')).toEqual(
      rows('accepted_records').map((row) => ({ recordType: row.record_type, item: row.item_id, sequence: row.sequence, payload: JSON.parse(row.body as string) })),
    );
    expect(await store.readFeedCursor()).toBe(rows('feed_cursor')[0]?.sequence);
  });

  it.each(cases.filter(([, , database]) => database.unfinished))('resumes its unfinished practice session after the upgrade (%s) and ends with the recorded result', async (_, recording, database, migrations) => {
    const session = await onDevice(database, migrations);
    const controller = new PracticeController(forAccountSession({ ...substituteAdapters({ clock: new FakeClock(undefined, true) }), store: session.store }, session));

    await controller.load();
    expect(controller.snapshot()).toMatchObject({ status: 'active', suspension: { cause: 'interrupted' } });
    await controller.resume();
    if (database.unfinished?.game === 'blackjack') await controller.play('stand');
    await controller.endSession();
    await waitFor(() => controller.snapshot().status === 'completed');

    const snapshot = controller.snapshot();
    if (snapshot.status !== 'completed') throw new Error('not completed');
    expect(snapshot.result.finalCashOut).toBe(database.unfinished?.finalCashOut);
    expect(snapshot.result.identities.engine).toBe(recording.engine);
  });
});

// docs/development.md Releases: recorded checkpoints and the quarantine list
const RECORDED = join(__dirname, '../src/account/testing/recorded');
const CURRENT = `store-schema-${STORE_SCHEMA_VERSION}.ts`;
const released = () => JSON.parse(readFileSync(join(RECORDED, 'released.json'), 'utf8')) as Record<string, string>;
const recordings = () => readdirSync(RECORDED).filter((file) => file.endsWith('.ts') && file !== 'index.ts').sort();

const FIX = `To fix:
  1. pnpm --filter @tableside/mobile record-databases   (add --replace if STORE_SCHEMA_VERSION didn't change)
  2. Delete the older unreleased recording (one not listed in apps/mobile/src/account/testing/recorded/released.json).
  3. In apps/mobile/src/account/testing/recorded/index.ts, import the new recording and drop the deleted one.
Never edit, regenerate or remove a released recording.`;

function check(problem: string | null): void {
  if (problem) throw new Error(`${problem}\n${FIX}`);
}

describe('recorded databases', () => {
  it('of released schemas are kept byte for byte: none edited or removed', () => {
    for (const [file, hash] of Object.entries(released())) {
      const actual = createHash('sha256').update(readFileSync(join(RECORDED, file))).digest('hex');
      check(actual === hash ? null : `${file} is a released recording and changed. Restore it from git.`);
    }
  });

  it("include this build's schema, so a schema change needs a recording", () => {
    check(recordings().includes(CURRENT) ? null : `This build's store schema (${CURRENT}) has no recording.`);
  });

  it("are a released schema's or this build's: an unreleased schema's recording is replaced, not kept", () => {
    const frozen = released();
    const stale = recordings().filter((file) => file !== CURRENT && !(file in frozen));
    check(stale.length === 0 ? null : `Only this build's recording may be unreleased, not ${stale.join(', ')}.`);
  });

  it('are all upgraded by the tests above', () => {
    const listed = RECORDED_STORE_SCHEMAS.map((recording) => `store-schema-${recording.storeSchema}.ts`).sort();
    check(JSON.stringify(listed) === JSON.stringify(recordings()) ? null : `index.ts lists ${listed.join(', ')}, not every recording (${recordings().join(', ')}).`);
  });
});
