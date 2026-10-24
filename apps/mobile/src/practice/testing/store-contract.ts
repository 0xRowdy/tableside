// The store-port contract: the behaviour every ActivityStore implementation
// must have. The in-memory store runs it in __tests__/memory-store.test.ts;
// spec 2's SQLite store must run the same suite:
//
//   describeActivityStoreContract('SQLite store', async () => { … return { store, reopen } });
//
// It uses Jest's globals, so call it from a Jest test file.

import type { DomainFact, Receipt } from '@tableside/engine';

import type { ActivityStore, AllowanceEffect, CompletedPracticeSession, IncompleteReason, NewActivity, TransitionCommit } from '../store';

export interface StoreUnderTest {
  /** A store over fresh, empty durable storage. */
  readonly store: ActivityStore;
  /** Simulates an app restart: a new store instance over the same durable storage. */
  reopen(): Promise<ActivityStore>;
}

const RANDOM = { protocol: 1, key: [1, 2], session: [3, 4] } as const;

export function newActivity(activityId: string, overrides: Partial<NewActivity> = {}): NewActivity {
  return {
    activityId,
    admission: { provenance: 'contract-suite', meteringBasis: 'free-play' },
    specification: {
      activityId,
      owner: 'local',
      device: 'test-device',
      game: 'roulette',
      rules: {
        id: 'roulette/single-zero',
        version: 1,
        wheel: 'single-zero',
        limits: { inside: { min: '1', max: '100' }, outside: { min: '10', max: '1000' } },
      },
      strategy: null,
      reference: null,
      fundingSource: 'practice-funding',
      funding: '1000',
    },
    random: { ...RANDOM, key: [...RANDOM.key], session: [...RANDOM.session] } as NewActivity['random'],
    // Checkpoints are opaque canonical text to the store; it must keep them byte for byte.
    checkpoint: `{"activity":"${activityId}","sequence":0}`,
    createdAt: 1_790_000_000_000,
    ...overrides,
  };
}

const QUARANTINED: IncompleteReason = { kind: 'quarantined', entry: 'q-1', listVersion: 2 };

function receipt(sequence: number, command: string): Receipt {
  return { commandId: `cmd-${sequence}`, sequence, command, disposition: 'applied' };
}

export function transition(activityId: string, priorSequence: number, options: { facts?: DomainFact[]; effects?: AllowanceEffect[]; command?: string } = {}): TransitionCommit {
  return {
    activityId,
    priorSequence,
    checkpoint: `{"activity":"${activityId}","sequence":${priorSequence + 1}}`,
    receipt: receipt(priorSequence, options.command ?? '{"kind":"begin-turn"}'),
    facts: options.facts ?? [{ kind: 'outcome-generated', turn: 1, pocket: 27 }],
    effects: options.effects ?? [],
  };
}

export function turnCharge(activityId: string, sequence: number): AllowanceEffect {
  return { effectId: { grant: 'grant-1', activity: activityId, sequence }, kind: 'turn-charge', amount: '1' };
}

export function completedRecord(activityId: string, overrides: Partial<CompletedPracticeSession> = {}): CompletedPracticeSession {
  return {
    recordVersion: 1,
    activityId,
    owner: 'local',
    device: 'test-device',
    game: 'roulette',
    identities: { engine: '0.0.0', rules: { id: 'roulette/single-zero', version: 1 }, strategy: null, reference: null, randomProtocol: 1 },
    startedAt: 1_790_000_000_000,
    endedAt: 1_790_000_100_000,
    mode: 'free-play',
    blackjackMode: null,
    betSchedule: null,
    strategy: null,
    rules: {
      id: 'roulette/single-zero',
      version: 1,
      content: { wheel: 'single-zero', limits: { inside: { min: '1', max: '100' }, outside: { min: '10', max: '1000' } } },
    },
    fundingSource: 'practice-funding',
    meteringBasis: 'free-play',
    allowancePolicyVersion: null,
    buyIn: '1000',
    rebuys: [],
    cumulativeFunding: '1000',
    finalCashOut: '1010',
    netResult: '10',
    maxDrawdown: '0',
    turnsPlayed: 1,
    endingReason: 'stop',
    overrideAffected: false,
    wagers: { wins: 1, losses: 0, pushes: 0, resolved: 1 },
    noBet: false,
    outcomes: [{ turn: 1, target: 'red', stake: '10', result: 'win', net: '10', returned: '20' }],
    guidance: null,
    ...overrides,
  };
}

export function describeActivityStoreContract(name: string, open: () => Promise<StoreUnderTest>): void {
  describe(`${name} meets the activity store contract`, () => {
    describe('creating activities (durability step 1)', () => {
      it('stores a new activity at sequence 0, unfinished, with its random identity and checkpoint text unchanged', async () => {
        const { store } = await open();
        const activity = newActivity('a1');

        const stored = await store.createActivity(activity);

        expect(stored).toEqual({ ...activity, sequence: 0, completion: null, incomplete: null });
        expect(await store.load('a1')).toEqual(stored);
        expect((await store.load('a1'))?.checkpoint).toBe(activity.checkpoint);
      });

      it('is idempotent by activity id: a retry returns the activity already stored, unchanged', async () => {
        const { store } = await open();
        await store.createActivity(newActivity('a1'));
        await store.commitTransition(transition('a1', 0));

        const retried = await store.createActivity(newActivity('a1', { random: { protocol: 1, key: [9, 9], session: [9, 9] }, createdAt: 5 }));

        expect(retried.random).toEqual(RANDOM);
        expect(retried.sequence).toBe(1);
        expect(retried.createdAt).toBe(1_790_000_000_000);
      });

      it('returns null for an activity it does not hold', async () => {
        const { store } = await open();
        expect(await store.load('missing')).toBeNull();
        expect(await store.readReceipt('missing', 'cmd-0')).toBeNull();
        expect(await store.readEffects('missing')).toEqual([]);
      });
    });

    describe('committing transitions (durability step 3)', () => {
      it('commits the checkpoint, receipt and facts together and advances the sequence by one', async () => {
        const { store } = await open();
        await store.createActivity(newActivity('a1'));
        const commit = transition('a1', 0, {
          facts: [
            { kind: 'turn-began', turn: 1, wagers: [{ target: 'red', amount: '10' }] },
            { kind: 'outcome-generated', turn: 1, pocket: 27 },
          ],
        });

        expect(await store.commitTransition(commit)).toEqual({ status: 'committed' });

        const stored = await store.load('a1');
        expect(stored?.sequence).toBe(1);
        expect(stored?.checkpoint).toBe(commit.checkpoint);
        expect(await store.readReceipt('a1', 'cmd-0')).toEqual({ receipt: commit.receipt, checkpoint: commit.checkpoint, facts: commit.facts });
      });

      it('reads back every committed transition in commit order, once each, across a restart', async () => {
        const { store, reopen } = await open();
        await store.createActivity(newActivity('a1'));
        expect(await store.readTransitions('a1')).toEqual([]);
        const first = transition('a1', 0, { facts: [{ kind: 'turn-began', turn: 1, wagers: [] }] });
        const second = transition('a1', 1, { facts: [{ kind: 'outcome-generated', turn: 1, pocket: 0 }] });
        await store.commitTransition(first);
        // A second delivery and a stale commit add nothing.
        await store.commitTransition(first);
        const stale = transition('a1', 0);
        await store.commitTransition({ ...stale, receipt: { ...stale.receipt, commandId: 'stale' } });
        await store.commitTransition(second);
        const expected = [first, second].map((commit) => ({ receipt: commit.receipt, checkpoint: commit.checkpoint, facts: commit.facts }));
        expect(await store.readTransitions('a1')).toEqual(expected);
        expect(await (await reopen()).readTransitions('a1')).toEqual(expected);
        expect(await store.readTransitions('missing')).toEqual([]);
      });

      it('applies a commit only at its prior sequence; a stale one writes nothing and reports the stored sequence', async () => {
        const { store } = await open();
        await store.createActivity(newActivity('a1'));
        await store.commitTransition(transition('a1', 0));
        const base = transition('a1', 0, { effects: [turnCharge('a1', 0)] });
        const stale: TransitionCommit = { ...base, receipt: { ...base.receipt, commandId: 'other' } };

        expect(await store.commitTransition(stale)).toEqual({ status: 'sequence-conflict', sequence: 1 });

        expect((await store.load('a1'))?.sequence).toBe(1);
        expect(await store.readReceipt('a1', 'other')).toBeNull();
        expect(await store.readEffects('a1')).toEqual([]);
      });

      it('takes a commit delivered twice once and returns the committed transition the second time', async () => {
        const { store } = await open();
        await store.createActivity(newActivity('a1'));
        const commit = transition('a1', 0, { effects: [turnCharge('a1', 0)] });

        await store.commitTransition(commit);
        const again = await store.commitTransition(commit);

        expect(again).toEqual({ status: 'already-committed', transition: { receipt: commit.receipt, checkpoint: commit.checkpoint, facts: commit.facts } });
        expect((await store.load('a1'))?.sequence).toBe(1);
        expect(await store.readEffects('a1')).toEqual([turnCharge('a1', 0)]);
      });

      it('never overwrites a committed transition with another that reuses its command id', async () => {
        const { store } = await open();
        await store.createActivity(newActivity('a1'));
        const commit = transition('a1', 0);
        await store.commitTransition(commit);
        const reused = { ...transition('a1', 1, { command: '{"kind":"settle-turn"}', effects: [turnCharge('a1', 1)] }), receipt: commit.receipt };

        expect(await store.commitTransition(reused)).toEqual({ status: 'already-committed', transition: { receipt: commit.receipt, checkpoint: commit.checkpoint, facts: commit.facts } });
        expect((await store.load('a1'))?.sequence).toBe(1);
        expect(await store.readEffects('a1')).toEqual([]);
      });

      it('lets exactly one of two concurrent commits at the same sequence through (single writer)', async () => {
        const { store } = await open();
        await store.createActivity(newActivity('a1'));
        const first = transition('a1', 0);
        const other = transition('a1', 0, { command: '{"kind":"request-stop"}' });
        const second: TransitionCommit = { ...other, receipt: { ...other.receipt, commandId: 'cmd-0b' } };

        const outcomes = await Promise.all([store.commitTransition(first), store.commitTransition(second)]);

        expect(outcomes.map((outcome) => outcome.status).sort()).toEqual(['committed', 'sequence-conflict']);
        expect((await store.load('a1'))?.sequence).toBe(1);
      });

      it('keeps activities apart', async () => {
        const { store } = await open();
        await store.createActivity(newActivity('a1'));
        await store.createActivity(newActivity('a2'));

        await store.commitTransition(transition('a1', 0));

        expect((await store.load('a2'))?.sequence).toBe(0);
        expect(await store.readReceipt('a2', 'cmd-0')).toBeNull();
      });

      it('rejects a commit for an activity it does not hold', async () => {
        const { store } = await open();
        await expect(store.commitTransition(transition('missing', 0))).rejects.toThrow();
      });
    });

    describe('allowance effects', () => {
      it('records each effect committed with a transition once, by its effect id', async () => {
        const { store } = await open();
        await store.createActivity(newActivity('a1'));

        await store.commitTransition(transition('a1', 0, { effects: [turnCharge('a1', 0)] }));
        // A later transition that carries an already-recorded effect id (a replay) doesn't charge again.
        await store.commitTransition(transition('a1', 1, { effects: [turnCharge('a1', 0), turnCharge('a1', 1)] }));

        expect(await store.readEffects('a1')).toEqual([turnCharge('a1', 0), turnCharge('a1', 1)]);
      });

      it('records time-usage checkpoints outside a transition, idempotent by effect id', async () => {
        const { store } = await open();
        await store.createActivity(newActivity('a1'));
        const second: AllowanceEffect = { effectId: { grant: 'grant-1', activity: 'a1', sequence: 7 }, kind: 'time-usage', amount: '1' };

        await store.recordEffects('a1', [second]);
        await store.recordEffects('a1', [second]);

        expect(await store.readEffects('a1')).toEqual([second]);
        expect((await store.load('a1'))?.sequence).toBe(0);
      });
    });

    describe('completing (durability step 5)', () => {
      it('records one final result with one outgoing synchronization record, and the activity is no longer unfinished', async () => {
        const { store } = await open();
        await store.createActivity(newActivity('a1'));
        expect((await store.findUnfinished())?.activityId).toBe('a1');

        const result = await store.complete(completedRecord('a1'));

        expect(result).toEqual(completedRecord('a1'));
        expect((await store.load('a1'))?.completion).toEqual(completedRecord('a1'));
        expect(await store.findUnfinished()).toBeNull();
        expect(await store.readOutgoing()).toEqual([{ id: 'completed/a1', kind: 'completed-practice-session', record: completedRecord('a1') }]);
      });

      it('completes once: a repeat returns the result already recorded and adds no second sync record', async () => {
        const { store } = await open();
        await store.createActivity(newActivity('a1'));
        await store.complete(completedRecord('a1'));

        const repeat = await store.complete(completedRecord('a1', { finalCashOut: '0', netResult: '-1000', endedAt: 9 }));

        expect(repeat).toEqual(completedRecord('a1'));
        expect(await store.readOutgoing()).toHaveLength(1);
      });

      it('finds the unfinished activity among completed ones', async () => {
        const { store } = await open();
        await store.createActivity(newActivity('a1'));
        await store.complete(completedRecord('a1'));
        await store.createActivity(newActivity('a2'));

        expect((await store.findUnfinished())?.activityId).toBe('a2');
      });
    });

    describe('marking an unusable activity incomplete (#80)', () => {
      it('records why, keeps the checkpoint, and the activity is no longer unfinished; no result or sync record is invented', async () => {
        const { store } = await open();
        await store.createActivity(newActivity('a1'));
        await store.commitTransition(transition('a1', 0));

        const marked = await store.markIncomplete('a1', QUARANTINED);

        expect(marked).toMatchObject({ activityId: 'a1', sequence: 1, completion: null, incomplete: QUARANTINED });
        expect((await store.load('a1'))?.incomplete).toEqual(QUARANTINED);
        expect((await store.load('a1'))?.checkpoint).toBe(transition('a1', 0).checkpoint);
        expect(await store.findUnfinished()).toBeNull();
        expect(await store.readOutgoing()).toEqual([]);
      });

      it('marks once: a repeat keeps the first reason', async () => {
        const { store } = await open();
        await store.createActivity(newActivity('a1'));
        await store.markIncomplete('a1', QUARANTINED);

        const repeat = await store.markIncomplete('a1', { kind: 'damaged', detail: 'later' });

        expect(repeat.incomplete).toEqual(QUARANTINED);
      });

      it('never marks a completed activity: its result stands', async () => {
        const { store } = await open();
        await store.createActivity(newActivity('a1'));
        await store.complete(completedRecord('a1'));

        const marked = await store.markIncomplete('a1', QUARANTINED);

        expect([marked.completion, marked.incomplete]).toEqual([completedRecord('a1'), null]);
      });

      it('keeps the mark across a restart and finds the next unfinished activity past it', async () => {
        const subject = await open();
        await subject.store.createActivity(newActivity('a1'));
        await subject.store.markIncomplete('a1', QUARANTINED);
        await subject.store.createActivity(newActivity('a2'));

        const reopened = await subject.reopen();

        expect((await reopened.load('a1'))?.incomplete).toEqual(QUARANTINED);
        expect((await reopened.findUnfinished())?.activityId).toBe('a2');
      });

      it('rejects a mark for an activity it does not hold', async () => {
        const { store } = await open();
        await expect(store.markIncomplete('missing', QUARANTINED)).rejects.toThrow();
      });
    });

    describe('durability', () => {
      it('keeps everything it acknowledged across a restart', async () => {
        const subject = await open();
        const { store } = subject;
        await store.createActivity(newActivity('a1'));
        const commit = transition('a1', 0, { effects: [turnCharge('a1', 0)] });
        await store.commitTransition(commit);
        await store.createActivity(newActivity('a2'));
        await store.complete(completedRecord('a2'));

        const reopened = await subject.reopen();

        expect(await reopened.findUnfinished()).toEqual({ ...newActivity('a1'), checkpoint: commit.checkpoint, sequence: 1, completion: null, incomplete: null });
        expect(await reopened.readReceipt('a1', 'cmd-0')).toEqual({ receipt: commit.receipt, checkpoint: commit.checkpoint, facts: commit.facts });
        expect(await reopened.readEffects('a1')).toEqual([turnCharge('a1', 0)]);
        expect((await reopened.load('a2'))?.completion).toEqual(completedRecord('a2'));
        expect(await reopened.readOutgoing()).toHaveLength(1);
        // And it carries on from there: the next commit is conditioned on the restored sequence.
        expect(await reopened.commitTransition(transition('a1', 0))).toMatchObject({ status: 'already-committed' });
        expect(await reopened.commitTransition(transition('a1', 1, { command: '{"kind":"settle-turn"}' }))).toEqual({ status: 'committed' });
      });

      it('shares no objects with its callers', async () => {
        const { store } = await open();
        const activity = newActivity('a1');
        const stored = await store.createActivity(activity);
        (stored as { sequence: number }).sequence = 99;
        (activity.random.key as unknown as number[])[0] = 99;
        const commit = transition('a1', 0);
        await store.commitTransition(commit);
        (commit.facts as DomainFact[]).length = 0;
        const read = await store.readReceipt('a1', 'cmd-0');
        (read?.facts as DomainFact[]).length = 0;

        expect((await store.load('a1'))?.sequence).toBe(1);
        expect((await store.load('a1'))?.random.key).toEqual([1, 2]);
        expect((await store.readReceipt('a1', 'cmd-0'))?.facts).toHaveLength(1);
      });
    });
  });
}
