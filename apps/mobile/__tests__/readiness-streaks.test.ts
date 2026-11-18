// Spec 3 Comparison groups, records and progression (Readiness streak, Milestones); Amendment 1 B3, C2, C3
// Testing Decisions › Seam 2 (Projection); #141
import type { ChallengeGroupKey } from '@tableside/engine';

import { milestoneCandidates, progressProjection, type ProgressMilestone } from '@/training/progress';
import { attempt, attemptRecord, RUNNING_COUNT_CHECK, TABLE_PLAY_CHECK, type AttemptFixture } from '@/training/testing/attempt-records';

const ASSISTED: ChallengeGroupKey = { ...RUNNING_COUNT_CHECK, assistanceClass: 'assisted-check', countRevealed: true };
const LEARN: ChallengeGroupKey = { ...RUNNING_COUNT_CHECK, variant: 'learn', assistanceClass: 'learn' };
const PACED: ChallengeGroupKey = { ...RUNNING_COUNT_CHECK, pacing: '2s' };
const CARD_VALUES: ChallengeGroupKey = { ...RUNNING_COUNT_CHECK, category: 'card-values', content: { id: 'card-values', version: 1 }, reference: null, length: 20 };

const PASS: AttemptFixture = { id: '', scores: { 'running-count': [4, 4] } };
const FAIL: AttemptFixture = { id: '', scores: { 'running-count': [3, 4] } };

// Device-sequence order on device-a, numbered from 1.
const sequence = (...fixtures: (AttemptFixture & { readonly id: string })[]) =>
  fixtures.map((fixture, index) => attempt({ ...fixture, deviceSequence: fixture.deviceSequence ?? index + 1 }));

const earnedBy = (...fixtures: (AttemptFixture & { readonly id: string })[]) =>
  milestoneCandidates(sequence(...fixtures), 'device-a').map((milestone) => milestone.attempts);

describe('readiness streaks', () => {
  it('earn the milestone on two consecutive advancing attempts, citing both', () => {
    expect(earnedBy({ ...PASS, id: 'a' }, { ...PASS, id: 'b' })).toEqual([['a', 'b']]);
  });

  // Spec 3 Synchronized record types › Readiness milestone (Barrier); #148
  it('cite the device positions of both earning attempts, across the neutral ones between them', () => {
    const [milestone] = milestoneCandidates(sequence({ ...PASS, id: 'a' }, { id: 'n', key: LEARN, scores: { 'running-count': [1, 4] } }, { ...PASS, id: 'b' }), 'device-a');
    expect(milestone).toMatchObject({ attempts: ['a', 'b'], deviceSequences: [1, 3] });
  });

  it('advance only at 95% or better in every counting metric tested: card values 19/20, running count 4/4', () => {
    const cards = (id: string, correct: number) => ({ id, key: CARD_VALUES, scores: { 'card-values': [correct, 20] as const } });
    expect(earnedBy(cards('a', 19), cards('b', 20))).toEqual([['a', 'b']]);
    expect(earnedBy(cards('a', 18), cards('b', 19), cards('c', 19))).toEqual([['b', 'c']]);
    expect(earnedBy({ ...FAIL, id: 'a' }, { ...PASS, id: 'b' })).toEqual([]);
  });

  it('ignore adherence, which is not a counting metric', () => {
    const scores = { 'running-count': [4, 4], 'playing-adherence': [5, 10] } as const;
    expect(earnedBy({ id: 'a', scores }, { id: 'b', scores })).toEqual([['a', 'b']]);
    expect(earnedBy({ id: 'a', scores: { 'running-count': [4, 4], 'true-count': [9, 10] } }, { ...PASS, id: 'b' }, { ...PASS, id: 'c' })).toEqual([['b', 'c']]);
  });

  it.each<[string, AttemptFixture]>([
    ['a completed unassisted Check below the threshold', { ...FAIL, id: 'x' }],
    ['an abandoned Check', { ...FAIL, id: 'x', ending: 'abandoned' }],
    ['an abandoned assisted Check at the same base configuration (#4 Q15)', { ...FAIL, id: 'x', key: ASSISTED, ending: 'abandoned' }],
    ['an insufficient-funds Check (#20)', { ...PASS, id: 'x', ending: 'insufficient-funds' }],
  ])('break on %s', (_, breaking) => {
    expect(earnedBy({ ...PASS, id: 'a' }, { ...breaking, id: 'x' }, { ...PASS, id: 'b' })).toEqual([]);
    expect(earnedBy({ ...PASS, id: 'a' }, { ...breaking, id: 'x' }, { ...PASS, id: 'b' }, { ...PASS, id: 'c' })).toEqual([['b', 'c']]);
  });

  it.each<[string, AttemptFixture]>([
    ['a Learn attempt', { ...FAIL, id: 'x', key: LEARN }],
    ['an abandoned Learn attempt', { ...FAIL, id: 'x', key: LEARN, ending: 'abandoned' }],
    ['a completed assisted Check', { ...FAIL, id: 'x', key: ASSISTED }],
    ['an unusable ending (Amendment 1 C3)', { ...FAIL, id: 'x', ending: 'unusable' }],
    ['a Check at other settings', { ...FAIL, id: 'x', key: PACED }],
    ['an abandoned Check at other settings', { ...FAIL, id: 'x', key: PACED, ending: 'abandoned' }],
  ])('leave the streak alone on %s', (_, neutral) => {
    expect(earnedBy({ ...PASS, id: 'a' }, { ...neutral, id: 'x' }, { ...PASS, id: 'b' })).toEqual([['a', 'b']]);
  });

  it('follow device-sequence order, not the order given', () => {
    const attempts = [
      attempt({ ...PASS, id: 'b', deviceSequence: 3 }),
      attempt({ ...PASS, id: 'a', deviceSequence: 1 }),
      attempt({ ...FAIL, id: 'x', deviceSequence: 2 }),
    ];
    expect(milestoneCandidates(attempts, 'device-a')).toEqual([]);
  });

  it("are per installation and never stitch two devices' attempts (Amendment 1 B3)", () => {
    const attempts = [attempt({ ...PASS, id: 'a', deviceSequence: 1 }), attempt({ ...PASS, id: 'b', installation: 'device-b', deviceSequence: 1 })];
    expect(milestoneCandidates(attempts, 'device-a')).toEqual([]);
    expect(milestoneCandidates(attempts, 'device-b')).toEqual([]);
  });

  it('earn each group one milestone, kept through a later failure, with the earning attempt as its display time', () => {
    const candidates = milestoneCandidates(
      sequence({ ...PASS, id: 'a', endedAt: 1_000 }, { ...PASS, id: 'b', endedAt: 2_000 }, { ...FAIL, id: 'x' }, { ...PASS, id: 'c' }, { ...PASS, id: 'd' }),
      'device-a',
    );
    expect(candidates).toEqual([
      { recordVersion: 1, owner: 'local', installation: 'device-a', groupKey: RUNNING_COUNT_CHECK, attempts: ['a', 'b'], deviceSequences: [1, 2], earnedAt: 2_000 },
    ]);
  });

  it('ignore speed, interruptions and winnings', () => {
    const finances = { startingBalance: '1000', finishingBalance: '0', net: '-1000' };
    const slow = attempt({ ...PASS, id: 'a', deviceSequence: 1, performanceMs: 9_000_000, interrupted: true });
    const broke = { ...attempt({ ...PASS, id: 'b', deviceSequence: 2, performanceMs: null }), record: { ...attemptRecord({ ...PASS, id: 'b', deviceSequence: 2 }), finances } };
    expect(milestoneCandidates([slow, broke], 'device-a').map((milestone) => milestone.attempts)).toEqual([['a', 'b']]);
  });

  it('start fresh in a new reference version', () => {
    const next = { ...RUNNING_COUNT_CHECK, reference: { id: 'blackjack-coaching-reference@fedcba9876543210', version: 2 } };
    expect(earnedBy({ ...PASS, id: 'a' }, { ...PASS, id: 'b', key: next })).toEqual([]);
    expect(earnedBy({ ...PASS, id: 'a' }, { ...PASS, id: 'b' }, { ...PASS, id: 'c', key: next }, { ...PASS, id: 'd', key: next })).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
});

describe('recommendations', () => {
  const earnedIn = (...keys: ChallengeGroupKey[]): ProgressMilestone[] =>
    keys.map((groupKey, index) => ({
      record: { recordVersion: 1, owner: 'local', installation: 'device-a', groupKey, attempts: [`a-${index}`, `b-${index}`], deviceSequences: [1, 2], earnedAt: index },
      local: true,
    }));
  const CONVERSION: ChallengeGroupKey = { ...RUNNING_COUNT_CHECK, category: 'conversion', content: { id: 'conversion', version: 1 }, reference: null, length: 10 };
  const OBSERVE: ChallengeGroupKey = { ...TABLE_PLAY_CHECK, table: { ...TABLE_PLAY_CHECK.table!, seat: 'observe' } };

  it('start at card values, the first step on the suggested path', () => {
    expect(progressProjection([]).recommendation).toEqual({ category: 'card-values', reason: { kind: 'start' }, enter: null });
  });

  it.each<[string, ChallengeGroupKey[], string]>([
    ['card values', [CARD_VALUES], 'running-count'],
    ['running count', [CARD_VALUES, RUNNING_COUNT_CHECK], 'conversion'],
    ['running count, even when card values has none', [RUNNING_COUNT_CHECK], 'conversion'],
    ['a paced running count, at any settings', [PACED], 'conversion'],
  ])('recommend the next category once a milestone exists in %s', (_, keys, next) => {
    expect(progressProjection([], earnedIn(...keys)).recommendation).toMatchObject({ category: next, reason: { kind: 'next' } });
  });

  it('enter table counting through Observe after conversion', () => {
    expect(progressProjection([], earnedIn(CONVERSION)).recommendation).toEqual({ category: 'table', reason: { kind: 'next', after: 'conversion' }, enter: 'observe' });
  });

  it('after table counting, suggest Play, deviations, more players, deeper penetration or larger N', () => {
    expect(progressProjection([], earnedIn(OBSERVE)).recommendation).toEqual({
      category: 'table',
      reason: { kind: 'beyond', suggestions: ['play', 'deviations', 'more-players', 'deeper-penetration', 'larger-n'] },
      enter: null,
    });
    expect(progressProjection([], earnedIn(OBSERVE, TABLE_PLAY_CHECK)).recommendation.reason).toEqual({ kind: 'beyond', suggestions: ['deviations', 'more-players', 'deeper-penetration', 'larger-n'] });
  });

  it('never use speed or winnings: personal bests, fastest times and finances leave them unchanged', () => {
    const fast = sequence({ ...PASS, id: 'a', performanceMs: 1_000 }, { ...PASS, id: 'b', key: CARD_VALUES, scores: { 'card-values': [20, 20] }, performanceMs: 1 });
    const rich = fast.map((entry) => ({ ...entry, record: { ...entry.record, finances: { startingBalance: '1000', finishingBalance: '9000', net: '8000' } } }));
    expect(progressProjection(fast).recommendation).toEqual(progressProjection([]).recommendation);
    expect(progressProjection(rich, earnedIn(CARD_VALUES)).recommendation).toEqual(progressProjection([], earnedIn(CARD_VALUES)).recommendation);
  });

  it('show the earliest milestone on its group, from any installation, and keep it through a reference change', () => {
    const later = earnedIn(RUNNING_COUNT_CHECK)[0]!;
    const other: ProgressMilestone = { record: { ...later.record, installation: 'device-b', attempts: ['x', 'y'], earnedAt: -5 }, local: false };
    const next = { ...RUNNING_COUNT_CHECK, reference: { id: 'blackjack-coaching-reference@fedcba9876543210', version: 2 } };
    const { groups } = progressProjection(sequence({ ...PASS, id: 'a' }, { ...FAIL, id: 'b', key: next }), [later, other]);
    expect(groups.map((group) => [group.key.reference?.version, group.milestone?.earnedAt ?? null, group.milestone?.local ?? null])).toEqual([
      [1, -5, false],
      [2, null, null],
    ]);
  });
});
