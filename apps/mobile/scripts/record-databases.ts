// Records this build's account databases for store-migration testing (#86):
//
//   pnpm --filter @tableside/mobile record-databases [--replace]
//
// It writes src/account/testing/recorded/store-schema-<STORE_SCHEMA_VERSION>.ts.
// Each database is written by this build's store, as the practice controller
// writes it, in a fresh encrypted file, then read back as data:
//
// - one database per unfinished phase the engine's recording of this build
//   covers (every game), holding that session with its committed transitions;
// - one holding finished practice: a completed session with its outgoing
//   synchronization record and an allowance effect, and a session marked
//   incomplete.
//
// While the schema is unreleased, --replace re-records it. When a build with
// it is released, the recording's SHA-256 goes in recorded/released.json; from
// then on it is never regenerated, edited or removed. A new recording must be
// added to recorded/index.ts.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import {
  advanceActivity,
  completedPracticeRecord,
  createActivity,
  encodeCheckpoint,
  ENGINE_VERSION,
  STATE_SCHEMA_VERSION,
  type ActivitySpecification,
  type ActivityState,
  type Command,
  type DomainFact,
  type RandomStreamIdentity,
} from '@tableside/engine';
import { RECORDED_BUILDS, type RecordedCheckpoint } from '@tableside/engine/recorded-checkpoints';

import { SqliteActivityStore, STORE_SCHEMA_VERSION, type StoreIdentity } from '../src/account/sqlite-store';
import { dumpDatabase } from '../src/account/testing/database-dump';
import { nodeSqlCipherDriver } from '../src/account/testing/node-sqlcipher';
import type { RecordedDatabase, RecordedStoreSchema } from '../src/account/testing/recorded';

const IDENTITY: StoreIdentity = { environment: 'production', accountId: 'recorded-account', installationId: 'recorded-installation' };
const KEY = '5e'.repeat(32);
const CREATED_AT = 1_790_000_000_000;
const directory = mkdtempSync(join(tmpdir(), 'tableside-record-'));

const build = RECORDED_BUILDS.find((recorded) => recorded.engine === ENGINE_VERSION && recorded.schema === STATE_SCHEMA_VERSION);
if (!build) throw new Error(`the engine has no recording of this build (engine ${ENGINE_VERSION}, schema ${STATE_SCHEMA_VERSION}): record its checkpoints first`);

/** The recorded session's specification, owned by the recording account on its installation, under another id when given. */
function specificationOf(recorded: RecordedCheckpoint, activityId?: string): ActivitySpecification {
  const specification = recorded.specification as ActivitySpecification;
  return { ...specification, activityId: activityId ?? specification.activityId, owner: IDENTITY.accountId, device: IDENTITY.installationId };
}

/** The commands that brought the recorded session to its checkpoint, from its receipts. */
function commandsOf(recorded: RecordedCheckpoint): { commandId: string; command: Command }[] {
  const { receipts } = JSON.parse(recorded.checkpoint) as { receipts: { commandId: string; command: string }[] };
  return receipts.map((receipt) => ({ commandId: receipt.commandId, command: JSON.parse(receipt.command) as Command }));
}

/** Creates the activity and commits each command, as the practice controller does. */
async function play(store: SqliteActivityStore, specification: ActivitySpecification, random: RandomStreamIdentity, commands: readonly { commandId: string; command: Command }[]) {
  let state: ActivityState = createActivity(specification, random);
  await store.createActivity({
    activityId: specification.activityId,
    admission: { provenance: 'recorded', meteringBasis: 'free-play' },
    specification,
    random,
    checkpoint: encodeCheckpoint(state),
    createdAt: CREATED_AT,
  });
  const facts: DomainFact[] = [];
  for (const { commandId, command } of commands) {
    const result = advanceActivity(state, { sequence: state.sequence, commandId, command });
    if (result.status !== 'committed') throw new Error(`${specification.activityId}: refused ${JSON.stringify(command)}`);
    const outcome = await store.commitTransition({
      activityId: specification.activityId,
      priorSequence: state.sequence,
      checkpoint: encodeCheckpoint(result.state),
      receipt: result.receipt,
      facts: result.facts,
      effects: [],
    });
    if (outcome.status !== 'committed') throw new Error(`${specification.activityId}: ${outcome.status}`);
    facts.push(...result.facts);
    state = result.state;
  }
  return { state, facts };
}

async function record(name: string, unfinished: RecordedDatabase['unfinished'], fill: (store: SqliteActivityStore) => Promise<void>): Promise<RecordedDatabase> {
  const path = join(directory, `${name.replaceAll(/[^a-z0-9]+/gi, '-')}.db`);
  const store = await SqliteActivityStore.open(await nodeSqlCipherDriver().open(path, KEY), IDENTITY);
  await fill(store);
  await store.close();
  const connection = await nodeSqlCipherDriver().open(path, KEY);
  const dump = await dumpDatabase(connection);
  await connection.close();
  return { name, ...IDENTITY, unfinished, ...dump };
}

async function unfinishedDatabase(recorded: RecordedCheckpoint): Promise<RecordedDatabase> {
  // The replay reaches the engine's recorded checkpoint exactly (under the recording account's identity).
  const replayed = commandsOf(recorded).reduce<ActivityState>((state, { commandId, command }) => {
    const result = advanceActivity(state, { sequence: state.sequence, commandId, command });
    if (result.status !== 'committed') throw new Error(`${recorded.name}: refused ${JSON.stringify(command)}`);
    return result.state;
  }, createActivity(recorded.specification as ActivitySpecification, recorded.random as RandomStreamIdentity));
  if (encodeCheckpoint(replayed) !== recorded.checkpoint) throw new Error(`${recorded.name}: the replay doesn't reach the recorded checkpoint`);

  const specification = specificationOf(recorded);
  return record(recorded.name, { activityId: specification.activityId, game: recorded.game, phase: recorded.phase, finalBalance: recorded.finalBalance }, async (store) => {
    await play(store, specification, recorded.random as RandomStreamIdentity, commandsOf(recorded));
  });
}

/**
 * Finished practice: the recorded session with the shortest continuation played
 * to completion (its result, outgoing synchronization record and an allowance
 * effect), and one marked incomplete. Other games' results are stored the same way.
 */
function historyDatabase(): Promise<RecordedDatabase> {
  return record('finished practice', null, async (store) => {
    const shortest = [...build!.checkpoints].sort((a, b) => a.continuation.length - b.continuation.length)[0]!;
    const finished = specificationOf(shortest, 'completed-1');
    const continuation = shortest.continuation.map((command, index) => ({ commandId: `continue-${index}`, command: command as Command }));
    const { state } = await play(store, finished, shortest.random as RandomStreamIdentity, [...commandsOf(shortest), ...continuation]);
    if (state.phase !== 'completed') throw new Error(`${shortest.name} didn't complete`);
    await store.recordEffects(finished.activityId, [{ effectId: { grant: 'recorded-grant', activity: finished.activityId, sequence: 1 }, kind: 'turn-charge', amount: '1' }]);
    const facts = (await store.readTransitions(finished.activityId)).flatMap((transition) => transition.facts);
    await store.complete(completedPracticeRecord(state, facts, { startedAt: CREATED_AT, endedAt: CREATED_AT + 600_000, meteringBasis: 'free-play', allowancePolicyVersion: null }));

    const damaged = specificationOf(shortest, 'incomplete-1');
    await play(store, damaged, shortest.random as RandomStreamIdentity, commandsOf(shortest));
    await store.markIncomplete(damaged.activityId, { kind: 'damaged', detail: 'recorded: an unreadable checkpoint' });
  });
}

const exportName = `RECORDED_STORE_SCHEMA_${STORE_SCHEMA_VERSION}`;
const RECORDED = join(__dirname, '../src/account/testing/recorded');
const target = join(RECORDED, `store-schema-${STORE_SCHEMA_VERSION}.ts`);
const released = JSON.parse(readFileSync(join(RECORDED, 'released.json'), 'utf8')) as Record<string, string>;
if (basename(target) in released) throw new Error(`${target} is a released schema's recording: it is never rewritten`);
if (existsSync(target) && !process.argv.includes('--replace')) throw new Error(`${target} exists: pass --replace to re-record this unreleased schema`);

async function main(): Promise<void> {
  const databases = [...(await Promise.all(build!.checkpoints.map(unfinishedDatabase))), await historyDatabase()];
  const recording: RecordedStoreSchema = { storeSchema: STORE_SCHEMA_VERSION, engine: ENGINE_VERSION, stateSchema: STATE_SCHEMA_VERSION, databases };
  writeFileSync(
    target,
    `// Recorded by scripts/record-databases.ts with store schema ${STORE_SCHEMA_VERSION} (engine ${ENGINE_VERSION}, state schema ${STATE_SCHEMA_VERSION}). Never edit or remove.\n` +
      `import type { RecordedStoreSchema } from './index';\n\n` +
      `export const ${exportName}: RecordedStoreSchema = ${JSON.stringify(recording, null, 2)};\n`,
  );
  process.stdout.write(`recorded ${databases.length} databases to ${target}\n`);
}

main()
  .finally(() => rmSync(directory, { recursive: true, force: true }))
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
    process.exitCode = 1;
  });
