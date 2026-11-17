// #158
import type { ChallengeFact, Receipt, UnsequencedAttemptRecord } from '@tableside/engine';

import type { UnsequencedLessonEvent } from '../lesson-progress';
import { CHALLENGE_CHARGE, type AttemptCharge, type AttemptTransitionCommit, type NewAttempt, type TrainingStore } from '../store';

export interface TrainingStoreUnderTest {
  readonly store: TrainingStore;
  reopen(): Promise<TrainingStore>;
}

const RANDOM = { protocol: 1, key: [1, 2], session: [3, 4] } as const;

export function newAttempt(attemptId: string, overrides: Partial<NewAttempt> = {}): NewAttempt {
  return {
    attemptId,
    admission: { provenance: 'contract-suite', meteringBasis: 'challenge-attempt' },
    specification: {
      attemptId,
      owner: 'local',
      device: 'test-device',
      variant: 'learn',
      content: { category: 'card-values', id: 'card-values', version: 1, length: 20, coverage: 'every-rank' },
    },
    random: { ...RANDOM, key: [...RANDOM.key], session: [...RANDOM.session] } as NewAttempt['random'],
    checkpoint: `{"attempt":"${attemptId}","sequence":0}`,
    createdAt: 1_790_000_000_000,
    ...overrides,
  };
}

export const chargeFor = (attemptId: string, chargedAt = 1_790_000_001_000): AttemptCharge => ({
  effect: { effectId: { grant: 'grant-1', activity: attemptId, sequence: 0 }, kind: CHALLENGE_CHARGE, amount: '1' },
  chargedAt,
});

const receipt = (sequence: number, command: string): Receipt => ({ commandId: `cmd-${sequence}`, sequence, command, disposition: 'applied' });

export function attemptTransition(attemptId: string, priorSequence: number, options: { charge?: AttemptCharge | null; command?: string; facts?: ChallengeFact[] } = {}): AttemptTransitionCommit {
  return {
    attemptId,
    priorSequence,
    checkpoint: `{"attempt":"${attemptId}","sequence":${priorSequence + 1}}`,
    receipt: receipt(priorSequence, options.command ?? '{"kind":"begin"}'),
    facts: options.facts ?? [{ kind: 'content-shown', position: 0 }],
    charge: options.charge ?? null,
  };
}

export function attemptRecord(attemptId: string, overrides: Partial<UnsequencedAttemptRecord> = {}): UnsequencedAttemptRecord {
  return {
    recordVersion: 1,
    attemptId,
    owner: 'local',
    installation: 'test-device',
    groupKey: {
      category: 'card-values',
      variant: 'learn',
      assistanceClass: 'learn',
      countRevealed: false,
      content: { id: 'card-values', version: 1 },
      reference: null,
      length: 20,
      pacing: 'self-paced',
      table: null,
    },
    identities: { engine: '0.0.0', content: { id: 'card-values', version: 1 }, reference: null, random: { protocol: 1, key: [1, 2], session: [3, 4] } },
    endingReason: 'completed',
    metrics: { 'card-values': { correct: 17, total: 20 }, 'running-count': null, 'true-count': null, 'playing-adherence': null, 'betting-adherence': null },
    review: [{ kind: 'card-value', position: 1, card: { rank: 7, suit: 'hearts' }, entered: 1, reference: 0 }],
    assistanceStep: null,
    interrupted: false,
    performanceMs: null,
    finances: null,
    allowancePolicyVersion: null,
    meteringBasis: 'challenge-attempt',
    startedAt: 1_790_000_000_000,
    endedAt: 1_790_000_060_000,
    ...overrides,
  };
}

// #143
export function lessonEvent(eventId: string, overrides: Partial<UnsequencedLessonEvent> = {}): UnsequencedLessonEvent {
  return {
    recordVersion: 1,
    eventId,
    owner: 'local',
    installation: 'test-device',
    lesson: { id: 'app-orientation', version: 1, materialVersion: 1 },
    event: { kind: 'bookmark', step: 2 },
    recordedAt: 1_790_000_000_000,
    ...overrides,
  };
}

export function describeTrainingStoreContract(name: string, open: () => Promise<TrainingStoreUnderTest>): void {
  describe(`${name} (training store contract)`, () => {
    it('keeps one unfinished attempt, with its admission and checkpoint, across a reopen', async () => {
      const subject = await open();
      const created = await subject.store.createAttempt(newAttempt('a-1'));
      expect(created).toEqual({ ...newAttempt('a-1'), sequence: 0, charge: null, record: null });
      expect(await subject.store.createAttempt(newAttempt('a-1'))).toEqual(created);
      const reopened = await subject.reopen();
      expect(await reopened.findUnfinishedAttempt()).toEqual(created);
      expect(await reopened.loadAttempt('a-1')).toEqual(created);
      expect(await reopened.loadAttempt('missing')).toBeNull();
    });

    it('refuses a second unfinished attempt on the device', async () => {
      const { store } = await open();
      await store.createAttempt(newAttempt('a-1'));
      await expect(store.createAttempt(newAttempt('a-2'))).rejects.toThrow();
      expect((await store.findUnfinishedAttempt())?.attemptId).toBe('a-1');
    });

    it('commits the first-content transition and its charge together, and keeps exactly one charge', async () => {
      const subject = await open();
      const { store } = subject;
      await store.createAttempt(newAttempt('a-1'));
      expect(await store.commitAttemptTransition(attemptTransition('a-1', 0, { charge: chargeFor('a-1') }))).toEqual({ status: 'committed' });
      expect(await store.commitAttemptTransition(attemptTransition('a-1', 0, { charge: chargeFor('a-1') }))).toEqual({
        status: 'already-committed',
        transition: { receipt: attemptTransition('a-1', 0).receipt, checkpoint: attemptTransition('a-1', 0).checkpoint, facts: attemptTransition('a-1', 0).facts },
      });
      expect(await store.commitAttemptTransition({ ...attemptTransition('a-1', 0), receipt: { ...attemptTransition('a-1', 0).receipt, commandId: 'other' } })).toEqual({
        status: 'sequence-conflict',
        sequence: 1,
      });
      await store.commitAttemptTransition(attemptTransition('a-1', 1, { charge: chargeFor('a-1', 5), command: '{"kind":"answer","value":1}' }));
      const reopened = await subject.reopen();
      expect(await reopened.loadAttempt('a-1')).toMatchObject({ sequence: 2, checkpoint: attemptTransition('a-1', 1).checkpoint, charge: chargeFor('a-1') });
      expect(await reopened.readAttemptReceipt('a-1', 'cmd-1')).toEqual({
        receipt: attemptTransition('a-1', 1, { command: '{"kind":"answer","value":1}' }).receipt,
        checkpoint: attemptTransition('a-1', 1).checkpoint,
        facts: attemptTransition('a-1', 1).facts,
      });
      expect(await reopened.readAttemptReceipt('a-1', 'cmd-9')).toBeNull();
    });

    it('discards an attempt only while nothing has been committed for it', async () => {
      const { store } = await open();
      await store.createAttempt(newAttempt('a-1'));
      await store.commitAttemptTransition(attemptTransition('a-1', 0, { charge: chargeFor('a-1') }));
      await store.discardUnchargedAttempt('a-1');
      expect((await store.loadAttempt('a-1'))?.charge).toEqual(chargeFor('a-1'));
      await store.recordAttempt(attemptRecord('a-1'));
      await store.createAttempt(newAttempt('a-2'));
      await store.discardUnchargedAttempt('a-2');
      expect([await store.loadAttempt('a-2'), await store.findUnfinishedAttempt()]).toEqual([null, null]);
      await store.createAttempt(newAttempt('a-3'));
      expect((await store.findUnfinishedAttempt())?.attemptId).toBe('a-3');
    });

    it('writes each ended attempt one record, numbered in the device sequence, and frees the device for the next attempt', async () => {
      const subject = await open();
      const { store } = subject;
      await store.createAttempt(newAttempt('a-1'));
      const first = await store.recordAttempt(attemptRecord('a-1'));
      expect(first).toEqual({ ...attemptRecord('a-1'), deviceSequence: 1 });
      expect(await store.recordAttempt(attemptRecord('a-1', { endedAt: 5 }))).toEqual(first);
      expect(await store.findUnfinishedAttempt()).toBeNull();
      expect((await store.loadAttempt('a-1'))?.record).toEqual(first);
      await store.createAttempt(newAttempt('a-2'));
      await store.recordAttempt(attemptRecord('a-2'));
      const reopened = await subject.reopen();
      expect((await reopened.readAttemptRecords()).map((record) => [record.attemptId, record.deviceSequence])).toEqual([
        ['a-1', 1],
        ['a-2', 2],
      ]);
    });

    it('keeps device-local preferences by key, overwriting and surviving a reopen', async () => {
      const subject = await open();
      expect(await subject.store.readPreference('last-setup')).toBeNull();
      await subject.store.writePreference('last-setup', '{"variant":"learn"}');
      await subject.store.writePreference('last-setup', '{"variant":"check"}');
      await subject.store.writePreference('hints-seen', '[]');
      const reopened = await subject.reopen();
      expect(await reopened.readPreference('last-setup')).toBe('{"variant":"check"}');
      expect(await reopened.readPreference('hints-seen')).toBe('[]');
    });

    // #143
    it('writes each lesson-progress event once, numbered in the installation sequence for its own record type, kept across a reopen', async () => {
      const subject = await open();
      const { store } = subject;
      expect(await store.readLessonEvents()).toEqual([]);
      await store.createAttempt(newAttempt('a-1'));
      await store.recordAttempt(attemptRecord('a-1'));
      const first = await store.recordLessonEvent(lessonEvent('e-1'));
      expect(first).toEqual({ ...lessonEvent('e-1'), deviceSequence: 1 });
      expect(await store.recordLessonEvent(lessonEvent('e-1', { event: { kind: 'completed' } }))).toEqual(first);
      await store.recordLessonEvent(lessonEvent('e-2', { event: { kind: 'restarted' } }));
      await store.recordLessonEvent(lessonEvent('e-3', { event: { kind: 'completed' }, lesson: { id: 'other', version: 3, materialVersion: 2 } }));
      const reopened = await subject.reopen();
      expect(await reopened.readLessonEvents()).toEqual([
        { ...lessonEvent('e-1'), deviceSequence: 1 },
        { ...lessonEvent('e-2', { event: { kind: 'restarted' } }), deviceSequence: 2 },
        { ...lessonEvent('e-3', { event: { kind: 'completed' }, lesson: { id: 'other', version: 3, materialVersion: 2 } }), deviceSequence: 3 },
      ]);
      expect((await reopened.readAttemptRecords()).map((record) => record.deviceSequence)).toEqual([1]);
    });
  });
}
