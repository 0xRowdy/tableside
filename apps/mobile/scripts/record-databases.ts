// docs/development.md Releases: recorded checkpoints and the quarantine list
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import {
  advanceActivity,
  advanceChallenge,
  canonicalJson,
  challengeAttemptRecord,
  createChallenge,
  encodeChallengeCheckpoint,
  readChallengeView,
  type ChallengeCommand,
  type ChallengeSpecification,
  type ChallengeState,
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
  sha256Hex,
} from '@tableside/engine';
import { RECORDED_BUILDS, type RecordedCheckpoint } from '@tableside/engine/recorded-checkpoints';

import { type Command as SyncCommand, SqliteActivityStore, type StoreIdentity } from '../src/account/sqlite-store';
import { STORE_SCHEMA_VERSION } from '../src/account/store-schema';
import { dumpDatabase } from '../src/account/testing/database-dump';
import { nodeSqlCipherDriver } from '../src/account/testing/node-sqlcipher';
import type { RecordedDatabase, RecordedStoreSchema } from '../src/account/testing/recorded';
import { LAST_SETUP } from '../src/training/service';
import { CHALLENGE_CHARGE, FRESH_LIFECYCLE } from '../src/training/store';

const IDENTITY: StoreIdentity = { environment: 'production', accountId: 'recorded-account', installationId: 'recorded-installation' };
const KEY = '5e'.repeat(32);
const CREATED_AT = 1_790_000_000_000;
const directory = mkdtempSync(join(tmpdir(), 'tableside-record-'));

const build = RECORDED_BUILDS.find((recorded) => recorded.engine === ENGINE_VERSION && recorded.schema === STATE_SCHEMA_VERSION);
if (!build) throw new Error(`the engine has no recording of this build (engine ${ENGINE_VERSION}, schema ${STATE_SCHEMA_VERSION}): record its checkpoints first`);

function specificationOf(recorded: RecordedCheckpoint, activityId?: string): ActivitySpecification {
  const specification = recorded.specification as ActivitySpecification;
  return { ...specification, activityId: activityId ?? specification.activityId, owner: IDENTITY.accountId, device: IDENTITY.installationId };
}

function commandsOf(recorded: RecordedCheckpoint): { commandId: string; command: Command }[] {
  const { receipts } = JSON.parse(recorded.checkpoint) as { receipts: { commandId: string; command: string }[] };
  return receipts.map((receipt) => ({ commandId: receipt.commandId, command: JSON.parse(receipt.command) as Command }));
}

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
  const replayed = commandsOf(recorded).reduce<ActivityState>((state, { commandId, command }) => {
    const result = advanceActivity(state, { sequence: state.sequence, commandId, command });
    if (result.status !== 'committed') throw new Error(`${recorded.name}: refused ${JSON.stringify(command)}`);
    return result.state;
  }, createActivity(recorded.specification as ActivitySpecification, recorded.random as RandomStreamIdentity));
  if (encodeCheckpoint(replayed) !== recorded.checkpoint) throw new Error(`${recorded.name}: the replay doesn't reach the recorded checkpoint`);

  const specification = specificationOf(recorded);
  return record(recorded.name, { activityId: specification.activityId, game: recorded.game, phase: recorded.phase, finalCashOut: recorded.finalBalance }, async (store) => {
    await play(store, specification, recorded.random as RandomStreamIdentity, commandsOf(recorded));
  });
}

const operationFor = (digit: string, record: { readonly activityId: string }) => (command: SyncCommand) => {
  const operationId = digit.repeat(32);
  const request = canonicalJson({
    protocol: 1,
    operation: operationId,
    installation: IDENTITY.installationId,
    command,
    recordType: 'completed-practice-session',
    payloadVersion: 1,
    item: record.activityId,
    payload: record,
  });
  return { operationId, request, requestHash: sha256Hex(request) };
};

function historyDatabase(): Promise<RecordedDatabase> {
  return record('finished practice', null, async (store) => {
    const shortest = [...build!.checkpoints].sort((a, b) => a.continuation.length - b.continuation.length)[0]!;
    const finished = specificationOf(shortest, 'completed-1');
    const continuation = shortest.continuation.map((command, index) => ({ commandId: `continue-${index}`, command: command as Command }));
    const { state } = await play(store, finished, shortest.random as RandomStreamIdentity, [...commandsOf(shortest), ...continuation]);
    if (state.phase !== 'completed') throw new Error(`${shortest.name} didn't complete`);
    await store.recordEffects(finished.activityId, [{ effectId: { grant: 'recorded-grant', activity: finished.activityId, sequence: 1 }, kind: 'turn-charge', amount: '1' }]);
    const facts = (await store.readTransitions(finished.activityId)).flatMap((transition) => transition.facts);
    const result = await store.complete(completedPracticeRecord(state, facts, { startedAt: CREATED_AT, endedAt: CREATED_AT + 600_000, meteringBasis: 'free-play', allowancePolicyVersion: null }));

    await store.adoptCommandScope(1);
    const accepted = await store.prepareUpload(`completed/${finished.activityId}`, operationFor('1', result));
    await store.acknowledgeUpload(
      `completed/${finished.activityId}`,
      { status: 'accepted', operation: accepted.operationId, requestHash: accepted.requestHash, sequence: 1 },
      { recordType: 'completed-practice-session', item: finished.activityId, sequence: 1, payload: result },
    );
    const sent = specificationOf(shortest, 'completed-2');
    const second = await play(store, sent, shortest.random as RandomStreamIdentity, [...commandsOf(shortest), ...continuation]);
    const secondFacts = (await store.readTransitions(sent.activityId)).flatMap((transition) => transition.facts);
    const secondResult = await store.complete(
      completedPracticeRecord(second.state, secondFacts, { startedAt: CREATED_AT + 700_000, endedAt: CREATED_AT + 900_000, meteringBasis: 'free-play', allowancePolicyVersion: null }),
    );
    await store.prepareUpload(`completed/${sent.activityId}`, operationFor('2', secondResult));
    const elsewhere = { ...result, activityId: 'elsewhere-1', device: 'recorded-other-installation' };
    await store.applyFeedPage(0, [
      { recordType: 'completed-practice-session', item: finished.activityId, sequence: 1, payload: result },
      { recordType: 'completed-practice-session', item: elsewhere.activityId, sequence: 2, payload: elsewhere },
    ]);

    const damaged = specificationOf(shortest, 'incomplete-1');
    await play(store, damaged, shortest.random as RandomStreamIdentity, commandsOf(shortest));
    await store.markIncomplete(damaged.activityId, { kind: 'damaged', detail: 'recorded: an unreadable checkpoint' });
  });
}

// #158
async function playAttempt(store: SqliteActivityStore, specification: ChallengeSpecification, random: RandomStreamIdentity, commands: readonly ChallengeCommand[]): Promise<ChallengeState> {
  let state = createChallenge(specification, random);
  const admission = { provenance: 'recorded', meteringBasis: 'challenge-attempt' } as const;
  await store.createAttempt({ attemptId: specification.attemptId, admission, specification, random, checkpoint: encodeChallengeCheckpoint(state), createdAt: CREATED_AT, lifecycle: FRESH_LIFECYCLE });
  for (const [index, command] of commands.entries()) {
    const result = advanceChallenge(state, { sequence: state.sequence, commandId: `${specification.attemptId}/${state.sequence}`, command });
    if (result.status !== 'committed') throw new Error(`${specification.attemptId}: refused ${JSON.stringify(command)}`);
    const charge = index === 0 ? { effect: { effectId: { grant: 'recorded', activity: specification.attemptId, sequence: 0 }, kind: CHALLENGE_CHARGE, amount: '1' }, chargedAt: CREATED_AT } : null;
    const outcome = await store.commitAttemptTransition({
      attemptId: specification.attemptId,
      priorSequence: state.sequence,
      checkpoint: encodeChallengeCheckpoint(result.state),
      receipt: result.receipt,
      facts: result.facts,
      charge,
      lifecycle: FRESH_LIFECYCLE,
    });
    if (outcome.status !== 'committed') throw new Error(`${specification.attemptId}: ${outcome.status}`);
    state = result.state;
  }
  return state;
}

function challengeDatabase(): Promise<RecordedDatabase> {
  const recorded = build!.challenges?.find((challenge) => challenge.phase === 'question');
  if (!recorded) throw new Error('the engine recording has no challenge waiting for an answer');
  const commands = (JSON.parse(recorded.checkpoint) as { receipts: { command: string }[] }).receipts.map((receipt) => JSON.parse(receipt.command) as ChallengeCommand);
  const specificationOf = (attemptId: string) => ({ ...(recorded.specification as ChallengeSpecification), attemptId, owner: IDENTITY.accountId, device: IDENTITY.installationId });
  const unfinished = specificationOf('attempt-2');
  return record('card values, an attempt waiting for an answer after a finished one', null, async (store) => {
    const finished = await playAttempt(store, specificationOf('attempt-1'), recorded.random as RandomStreamIdentity, [...commands, ...(recorded.continuation as ChallengeCommand[])]);
    if (finished.phase !== 'ended') throw new Error('the recorded continuation did not end the attempt');
    await store.recordAttempt(
      challengeAttemptRecord(finished, {
        installation: IDENTITY.installationId,
        startedAt: CREATED_AT,
        endedAt: CREATED_AT + 120_000,
        interrupted: false,
        performanceMs: null,
        meteringBasis: 'challenge-attempt',
        allowancePolicyVersion: null,
        pacing: 'self-paced',
      }),
    );
    await playAttempt(store, unfinished, recorded.random as RandomStreamIdentity, commands);
    await store.writePreference(LAST_SETUP, JSON.stringify({ category: 'card-values', variant: 'learn' }));
    // #143
    const lesson = { id: 'app-orientation', version: 1, materialVersion: 1 };
    const progress = { recordVersion: 1, owner: IDENTITY.accountId, installation: IDENTITY.installationId, lesson, recordedAt: CREATED_AT } as const;
    await store.recordLessonEvent({ ...progress, eventId: 'lesson-event-1', event: { kind: 'completed' } });
    await store.recordLessonEvent({ ...progress, eventId: 'lesson-event-2', event: { kind: 'bookmark', step: 2 } });
  }).then((database) => ({ ...database, unfinishedAttempt: { attemptId: unfinished.attemptId, phase: 'question', position: readChallengeView(createAndReplay(unfinished, recorded.random as RandomStreamIdentity, commands)).position } }));
}

function createAndReplay(specification: ChallengeSpecification, random: RandomStreamIdentity, commands: readonly ChallengeCommand[]): ChallengeState {
  return commands.reduce<ChallengeState>((state, command) => {
    const result = advanceChallenge(state, { sequence: state.sequence, commandId: `${specification.attemptId}/${state.sequence}`, command });
    if (result.status !== 'committed') throw new Error('refused');
    return result.state;
  }, createChallenge(specification, random));
}

const exportName = `RECORDED_STORE_SCHEMA_${STORE_SCHEMA_VERSION}`;
const RECORDED = join(__dirname, '../src/account/testing/recorded');
const target = join(RECORDED, `store-schema-${STORE_SCHEMA_VERSION}.ts`);
const released = JSON.parse(readFileSync(join(RECORDED, 'released.json'), 'utf8')) as Record<string, string>;
if (basename(target) in released) throw new Error(`${target} is a released schema's recording: it is never rewritten`);
if (existsSync(target) && !process.argv.includes('--replace')) throw new Error(`${target} exists: pass --replace to re-record this unreleased schema`);

async function main(): Promise<void> {
  const databases = [...(await Promise.all(build!.checkpoints.map(unfinishedDatabase))), await historyDatabase(), await challengeDatabase()];
  const recording: RecordedStoreSchema = { storeSchema: STORE_SCHEMA_VERSION, engine: ENGINE_VERSION, stateSchema: STATE_SCHEMA_VERSION, databases };
  writeFileSync(
    target,
    '// docs/development.md Releases: recorded checkpoints and the quarantine list\n' +
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
