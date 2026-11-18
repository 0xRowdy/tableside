// Spec 3 Synchronized record types › Challenge attempt, Lesson-progress event; Amendment 1 C8, C9, C10; Testing Decisions › Seam 2 (Failure injection, Sync); #142, #147
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { EMPTY_QUARANTINE_LIST, type ChallengeAttemptRecord, type ChallengeView } from '@tableside/engine';

import { SqliteActivityStore, type StoreIdentity } from '@/account/sqlite-store';
import { nodeSqlCipherDriver } from '@/account/testing/node-sqlcipher';
import { alwaysAllowed } from '@/practice/adapters';
import { entropyFromWords, FakeClock, PI_WORDS } from '@/practice/testing/substitutes';
import { plentyAllowance } from '@/training/allowance';
import { CHALLENGE_ATTEMPT_RECORD_TYPE } from '@/training/store';
import { TrainingService, type ChallengeSetup } from '@/training/service';
import { NO_SCREEN_READER } from '@/training/speech';
import { cardOf, HI_LO_BY_RANK } from '@/training/testing/hi-lo';
import { attemptRecord, lessonEvent, newAttempt } from '@/training/testing/store-contract';
import { LESSON_PROGRESS_RECORD_TYPE, type LessonProgressEvent } from '@/training/lesson-progress';

const KEY = 'cd'.repeat(32);
const ABC_SHA256 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const IDENTITY: StoreIdentity = { environment: 'test', accountId: 'local', installationId: 'test-device' };
const directories: string[] = [];
const opened: SqliteActivityStore[] = [];
afterAll(async () => {
  await Promise.all(opened.map((store) => store.close().catch(() => undefined)));
  directories.forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

async function openStore() {
  const directory = mkdtempSync(join(tmpdir(), 'tableside-training-sync-'));
  directories.push(directory);
  const store = await SqliteActivityStore.open(await nodeSqlCipherDriver().open(join(directory, 'account.db'), KEY), IDENTITY);
  opened.push(store);
  return store;
}

async function ended(store: SqliteActivityStore, attemptId: string, overrides: Parameters<typeof attemptRecord>[1] = {}) {
  await store.createAttempt(newAttempt(attemptId));
  return store.recordAttempt(attemptRecord(attemptId, overrides));
}

function elsewhere(attemptId: string, position: number, overrides: Partial<ChallengeAttemptRecord> = {}): ChallengeAttemptRecord {
  return { ...attemptRecord(attemptId, { installation: 'other-device' }), deviceSequence: position, ...overrides };
}

const accepted = (record: ChallengeAttemptRecord, sequence: number, summary = false) => {
  const { review: _review, ...withoutDetail } = record;
  return {
    recordType: CHALLENGE_ATTEMPT_RECORD_TYPE,
    item: record.attemptId,
    sequence,
    payload: summary ? withoutDetail : record,
    origin: { installation: record.installation, position: record.deviceSequence },
    ...(summary ? { summaryAt: record.endedAt } : {}),
  };
};

function trainingOn(store: SqliteActivityStore, attemptDetail?: (attemptId: string) => Promise<ChallengeAttemptRecord | null>) {
  const clock = new FakeClock(1_790_000_000_000, true);
  let next = 0;
  return new TrainingService({
    store,
    access: alwaysAllowed,
    allowance: plentyAllowance(() => clock.now()),
    clock,
    entropy: entropyFromWords(PI_WORDS),
    newId: () => `attempt-${++next}`,
    device: IDENTITY.installationId,
    owner: IDENTITY.accountId,
    quarantine: EMPTY_QUARANTINE_LIST,
    speech: NO_SCREEN_READER,
    ...(attemptDetail ? { attemptDetail } : {}),
  });
}

const right = (view: ChallengeView) => HI_LO_BY_RANK[cardOf(view.item).rank]!;

describe('ending an attempt on an account database', () => {
  it('writes the record and queues its one upload at the same device position, announcing it after the commit', async () => {
    const store = await openStore();
    let announced = 0;
    store.onUploadQueued(() => announced++);
    const first = await ended(store, 'a-1');
    const second = await ended(store, 'a-2');
    expect(announced).toBe(2);

    const queue = await store.readUploadQueue();
    expect(queue.map((entry) => ({ recordType: entry.recordType, payload: entry.payload, position: entry.position, dependencies: entry.dependencies }))).toEqual([
      { recordType: 'challenge-attempt', payload: first, position: 1, dependencies: [] },
      { recordType: 'challenge-attempt', payload: second, position: 2, dependencies: [] },
    ]);
  });

  it('queues nothing more when the ending is written again (recovery after a crash at the commit)', async () => {
    const store = await openStore();
    await ended(store, 'a-1');
    expect(await store.recordAttempt(attemptRecord('a-1'))).toMatchObject({ deviceSequence: 1 });
    expect(await store.readUploadQueue()).toHaveLength(1);
    expect(await store.readAttemptRecords()).toHaveLength(1);
  });

  it('never queues an unfinished attempt', async () => {
    const store = await openStore();
    await store.createAttempt(newAttempt('a-1'));
    expect(await store.readUploadQueue()).toEqual([]);
  });
});

describe('accepted attempts', () => {
  it('reads the account’s accepted attempts, whole from the feed and as summaries from a bootstrap', async () => {
    const store = await openStore();
    const fromFeed = elsewhere('b-1', 1);
    expect(await store.applyFeedPage(0, [accepted(fromFeed, 1)])).toBe(true);
    expect(await store.readAcceptedAttempts()).toEqual([fromFeed]);
  });
});

describe('the Training service with synced attempts', () => {
  it('counts attempts from every device, labels only the unaccepted local ones local, and converges personal bests', async () => {
    const store = await openStore();
    const service = trainingOn(store);
    await service.load();
    const mine = await ended(store, 'a-1', { metrics: { 'card-values': { correct: 18, total: 20 }, 'running-count': null, 'true-count': null, 'playing-adherence': null, 'betting-adherence': null } });
    const theirs = elsewhere('b-1', 1, { metrics: { 'card-values': { correct: 20, total: 20 }, 'running-count': null, 'true-count': null, 'playing-adherence': null, 'betting-adherence': null } });
    await store.applyFeedPage(0, [accepted(theirs, 1, true)]);

    let progress = await service.progress();
    expect(progress.history.map((entry) => [entry.record.attemptId, entry.local])).toEqual([
      ['a-1', true],
      ['b-1', false],
    ]);
    expect(progress.groups[0]?.bests.map((best) => [best.attempt.attemptId, best.result.correct])).toEqual([['b-1', 20]]);

    await store.applyFeedPage(1, [accepted(mine, 2)]);
    progress = await service.progress();
    expect(progress.history.map((entry) => [entry.record.attemptId, entry.local])).toEqual([
      ['a-1', false],
      ['b-1', false],
    ]);
  });

  // Amendment 1 C8
  it('reviews a local attempt from this device, and fetches a summary’s review facts on demand', async () => {
    const store = await openStore();
    const asked: string[] = [];
    const theirs = elsewhere('b-1', 1);
    const service = trainingOn(store, async (attemptId) => {
      asked.push(attemptId);
      return attemptId === 'b-1' ? theirs : null;
    });
    await service.load();
    const mine = await ended(store, 'a-1');
    await store.applyFeedPage(0, [accepted(theirs, 1, true), accepted(elsewhere('b-2', 2), 2, true)]);

    expect(await service.attemptReview('a-1')).toEqual(mine);
    expect(asked).toEqual([]);
    expect(await service.attemptReview('b-1')).toEqual(theirs);
    expect(await service.attemptReview('b-2')).toBeNull();
    expect(asked).toEqual(['b-1', 'b-2']);
  });

  it('has no review to offer for a summary without a way to fetch it', async () => {
    const store = await openStore();
    const service = trainingOn(store);
    await service.load();
    await store.applyFeedPage(0, [accepted(elsewhere('b-1', 1), 1, true)]);
    expect(await service.attemptReview('b-1')).toBeNull();
  });
});

// #147
describe('recording a lesson-progress event on an account database', () => {
  it('queues its one upload at the same device position in the same write, announcing it after the commit', async () => {
    const store = await openStore();
    let announced = 0;
    store.onUploadQueued(() => announced++);
    const first = await store.recordLessonEvent(lessonEvent('e-1'));
    const second = await store.recordLessonEvent(lessonEvent('e-2', { event: { kind: 'completed' } }));
    expect(await store.recordLessonEvent(lessonEvent('e-1'))).toEqual(first);
    expect(announced).toBe(2);
    expect((await store.readUploadQueue()).map((entry) => ({ recordType: entry.recordType, payload: entry.payload, position: entry.position, dependencies: entry.dependencies }))).toEqual([
      { recordType: 'lesson-progress', payload: first, position: 1, dependencies: [] },
      { recordType: 'lesson-progress', payload: second, position: 2, dependencies: [] },
    ]);
  });

  it('reads the account’s accepted lesson-progress events with their acceptance sequence, and this device’s refused ones', async () => {
    const store = await openStore();
    const theirs: LessonProgressEvent = { ...lessonEvent('t-1', { installation: 'other-device' }), deviceSequence: 1 };
    expect(
      await store.applyFeedPage(0, [
        { recordType: LESSON_PROGRESS_RECORD_TYPE, item: 't-1', sequence: 1, payload: theirs, origin: { installation: 'other-device', position: 1 } },
      ]),
    ).toBe(true);
    await store.recordLessonEvent(lessonEvent('e-1'));
    await store.recordLessonEvent(lessonEvent('e-2'));
    await store.adoptCommandScope(1);
    const [refused] = await store.readUploadQueue();
    const operation = { operationId: 'a'.repeat(32), request: 'abc', requestHash: ABC_SHA256 };
    await store.prepareUpload(refused!.id, () => operation);
    await store.acknowledgeUpload(refused!.id, { status: 'rejected', operation: operation.operationId, requestHash: ABC_SHA256, code: 'invalid-payload' }, null);
    expect(await store.readLessonSync()).toEqual({ accepted: [{ sequence: 1, event: theirs }], refused: ['e-1'] });
  });
});

// Amendment 1 C9
describe('the local export supplement', () => {
  async function answeredTwice(setup: ChallengeSetup) {
    const store = await openStore();
    const service = trainingOn(store);
    await service.load();
    await service.startAttempt(setup);
    let answered = 0;
    for (let guard = 0; guard < 100 && answered < 2; guard++) {
      const snapshot = service.snapshot();
      if (snapshot.status !== 'active') throw new Error(`expected an active attempt, got ${snapshot.status}`);
      if (snapshot.view.phase === 'question') {
        await service.submit(answered === 0 ? { kind: 'answer', value: right(snapshot.view) } : { kind: 'skip' });
        answered++;
      } else {
        await service.submit({ kind: 'next-item' });
      }
    }
    return store;
  }

  it('carries only an unfinished Check’s entered answers and the fact that it exists', async () => {
    const store = await answeredTwice({ category: 'card-values', variant: 'check' });
    const [attempt, ...others] = await store.readUnfinishedActivities();
    expect(others).toEqual([]);
    expect(attempt).toEqual({
      kind: 'challenge-attempt',
      activityId: 'attempt-1',
      category: 'card-values',
      variant: 'check',
      startedAt: expect.any(Number),
      answers: [
        { position: 1, entered: expect.any(Number) },
        { position: 2, entered: 'skip' },
      ],
    });
    const text = JSON.stringify(attempt);
    for (const hidden of ['reference', 'rank', 'suit', 'items', 'random', 'checkpoint', 'review', 'correct']) expect(text).not.toContain(hidden);
  });

  it('lists no attempt once it has ended', async () => {
    const store = await openStore();
    await ended(store, 'a-1');
    expect(await store.readUnfinishedActivities()).toEqual([]);
  });
});
