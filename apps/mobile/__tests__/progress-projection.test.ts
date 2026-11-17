// Spec 3 Comparison groups, records and progression; Testing Decisions › Seam 2 (Projection); Amendment 1 C2, C3; #140
import type { ChallengeGroupKey } from '@tableside/engine';

import { attemptEarned, baseConfiguration, progressProjection } from '@/training/progress';
import { attempt, RUNNING_COUNT_CHECK, TABLE_PLAY_CHECK, type AttemptFixture } from '@/training/testing/attempt-records';

const groupsOf = (...keys: ChallengeGroupKey[]) => progressProjection(keys.map((key, index) => attempt({ id: `attempt-${index}`, key }))).groups.length;

describe('the progress projection', () => {
  describe('comparison groups', () => {
    const table = TABLE_PLAY_CHECK.table!;
    const variations: readonly [string, ChallengeGroupKey][] = [
      ['category', { ...RUNNING_COUNT_CHECK, category: 'card-values' }],
      ['variant', { ...RUNNING_COUNT_CHECK, variant: 'learn', assistanceClass: 'learn' }],
      ['assistance class', { ...RUNNING_COUNT_CHECK, assistanceClass: 'assisted-check' }],
      ['count revealed', { ...RUNNING_COUNT_CHECK, countRevealed: true }],
      ['content-definition version', { ...RUNNING_COUNT_CHECK, content: { id: 'running-count', version: 2 } }],
      ['blackjack reference version', { ...RUNNING_COUNT_CHECK, reference: { id: 'blackjack-coaching-reference@0123456789abcdef', version: 2 } }],
      ['fixed length', { ...RUNNING_COUNT_CHECK, length: 26 }],
      ['pacing', { ...RUNNING_COUNT_CHECK, pacing: '2s' }],
    ];
    it.each(variations)('separates attempts that differ only in %s', (_field, other) => {
      expect(groupsOf(RUNNING_COUNT_CHECK, RUNNING_COUNT_CHECK)).toBe(1);
      expect(groupsOf(RUNNING_COUNT_CHECK, other)).toBe(2);
    });

    const tableVariations: readonly [string, ChallengeGroupKey['table']][] = [
      ['rule preset', { ...table, rules: { id: 'blackjack-h17-ls', version: 1 } }],
      ['penetration', { ...table, penetration: 50 }],
      ['extra players', { ...table, extraPlayers: 4 }],
      ['Observe/Play', { ...table, seat: 'observe' }],
      ['counting mode', { ...table, countingMode: 'deviations' }],
      ['bet schedule', { ...table, betSchedule: true }],
      ['base wager', { ...table, baseWager: '25' }],
      ['starting balance', { ...table, startingBalance: '500' }],
      ['N', { ...table, checkpointInterval: 3 }],
    ];
    it.each(tableVariations)('separates table attempts that differ only in %s', (_field, other) => {
      expect(groupsOf(TABLE_PLAY_CHECK, TABLE_PLAY_CHECK)).toBe(1);
      expect(groupsOf(TABLE_PLAY_CHECK, { ...TABLE_PLAY_CHECK, table: other })).toBe(2);
    });

    it('keeps timed and untimed attempts in one group', () => {
      const groups = progressProjection([attempt({ id: 'timed', performanceMs: 120_000 }), attempt({ id: 'untimed', performanceMs: null })]).groups;
      expect(groups.map((group) => group.attempts.map((entry) => entry.record.attemptId))).toEqual([['timed', 'untimed']]);
    });

    it('gives assisted and unassisted Check one base configuration, keeping the variant (Amendment 1 C2)', () => {
      const assisted = { ...RUNNING_COUNT_CHECK, assistanceClass: 'assisted-check', countRevealed: true } as const;
      const learn = { ...RUNNING_COUNT_CHECK, variant: 'learn', assistanceClass: 'learn' } as const;
      expect(baseConfiguration(assisted)).toEqual(baseConfiguration(RUNNING_COUNT_CHECK));
      expect(baseConfiguration(learn)).not.toEqual(baseConfiguration(RUNNING_COUNT_CHECK));
      expect(baseConfiguration({ ...RUNNING_COUNT_CHECK, pacing: '2s' })).not.toEqual(baseConfiguration(RUNNING_COUNT_CHECK));
    });
  });

  describe('personal bests', () => {
    const bestsOf = (...fixtures: AttemptFixture[]) =>
      onlyGroup(fixtures).bests.map((best) => [best.metric, best.attempt.attemptId, `${best.result.correct}/${best.result.total}`]);

    it('keeps the highest exact first-answer ratio for each metric separately', () => {
      expect(
        bestsOf(
          { id: 'a', key: TABLE_PLAY_CHECK, scores: { 'running-count': [9, 10], 'true-count': [4, 10], 'playing-adherence': [40, 48] } },
          { id: 'b', key: TABLE_PLAY_CHECK, scores: { 'running-count': [7, 10], 'true-count': [9, 10], 'playing-adherence': [41, 48] } },
        ),
      ).toEqual([
        ['running-count', 'a', '9/10'],
        ['true-count', 'b', '9/10'],
        ['playing-adherence', 'b', '41/48'],
      ]);
    });

    it('compares ratios exactly, not by correct answers: 19 of 20 beats 45 of 48', () => {
      expect(bestsOf({ id: 'a', key: TABLE_PLAY_CHECK, scores: { 'playing-adherence': [45, 48] } }, { id: 'b', key: TABLE_PLAY_CHECK, scores: { 'playing-adherence': [19, 20] } })).toEqual([
        ['playing-adherence', 'b', '19/20'],
      ]);
    });

    it('never counts N/A: a metric no attempt tested has no best', () => {
      expect(bestsOf({ id: 'a', key: TABLE_PLAY_CHECK, scores: { 'running-count': [9, 10], 'betting-adherence': null } })).toEqual([['running-count', 'a', '9/10']]);
    });

    it('breaks a tie on the larger denominator, then on the lower attempt identity', () => {
      expect(bestsOf({ id: 'a', key: TABLE_PLAY_CHECK, scores: { 'playing-adherence': [10, 10] } }, { id: 'b', key: TABLE_PLAY_CHECK, scores: { 'playing-adherence': [20, 20] } })).toEqual([
        ['playing-adherence', 'b', '20/20'],
      ]);
      expect(bestsOf({ id: 'm', scores: { 'running-count': [3, 4] } }, { id: 'c', scores: { 'running-count': [3, 4] } }, { id: 'x', scores: { 'running-count': [3, 4] } })).toEqual([
        ['running-count', 'c', '3/4'],
      ]);
    });

    it.each(['abandoned', 'insufficient-funds', 'unusable'] as const)('takes no best from an attempt that ended %s, even with a higher ratio', (ending) => {
      expect(bestsOf({ id: 'a', scores: { 'running-count': [2, 4] } }, { id: 'b', ending, scores: { 'running-count': [4, 4] } })).toEqual([['running-count', 'a', '2/4']]);
    });

    it('shows a group with no completed attempt, and no best', () => {
      const group = onlyGroup([{ id: 'a', ending: 'insufficient-funds', key: TABLE_PLAY_CHECK }]);
      expect([group.bests, group.completed]).toEqual([[], false]);
    });

    it('starts fresh groups on a new content or reference version, keeping the old ones', () => {
      const newer = { ...RUNNING_COUNT_CHECK, reference: { ...RUNNING_COUNT_CHECK.reference!, version: 2 } };
      const { groups } = progressProjection([attempt({ id: 'old', scores: { 'running-count': [4, 4] } }), attempt({ id: 'new', key: newer, scores: { 'running-count': [2, 4] } })]);
      expect(groups.map((group) => [group.key.reference?.version, group.bests[0]?.attempt.attemptId])).toEqual(
        expect.arrayContaining([
          [1, 'old'],
          [2, 'new'],
        ]),
      );
    });
  });

  describe('fastest', () => {
    const fastestOf = (...fixtures: AttemptFixture[]) => {
      const { fastest } = onlyGroup(fixtures);
      return fastest && [fastest.attempt.attemptId, fastest.performanceMs];
    };
    const eligible: AttemptFixture = { id: 'eligible', performanceMs: 221_000 };

    it('keeps the lowest performance time among perfect, completed, unassisted, uninterrupted, timed Check attempts', () => {
      expect(fastestOf(eligible, { id: 'quicker', performanceMs: 180_000 }, { id: 'slower', performanceMs: 300_000 })).toEqual(['quicker', 180_000]);
    });

    const disqualified: readonly [string, AttemptFixture][] = [
      ['untimed', { id: 'z', performanceMs: null }],
      ['interrupted', { id: 'z', interrupted: true }],
      ['abandoned', { id: 'z', ending: 'abandoned' }],
      ['ended early with insufficient funds', { id: 'z', ending: 'insufficient-funds' }],
      ['unusable', { id: 'z', ending: 'unusable' }],
      ['not perfect', { id: 'z', scores: { 'running-count': [3, 4] } }],
    ];
    it.each(disqualified)('never takes the fastest from an attempt that is %s', (_reason, fixture) => {
      expect(fastestOf(eligible, { ...fixture, performanceMs: fixture.performanceMs === undefined ? 1_000 : fixture.performanceMs })).toEqual(['eligible', 221_000]);
      expect(fastestOf({ ...fixture, performanceMs: fixture.performanceMs === undefined ? 1_000 : fixture.performanceMs })).toBeNull();
    });

    it('needs every tested metric perfect, adherence included', () => {
      const perfectCounts = { id: 'z', key: TABLE_PLAY_CHECK, performanceMs: 1_000, scores: { 'running-count': [10, 10], 'true-count': [10, 10], 'playing-adherence': [47, 48] } } as const;
      expect(fastestOf(perfectCounts)).toBeNull();
      expect(fastestOf({ ...perfectCounts, scores: { ...perfectCounts.scores, 'playing-adherence': [48, 48], 'betting-adherence': [9, 10] } })).toBeNull();
      expect(fastestOf({ ...perfectCounts, scores: { ...perfectCounts.scores, 'playing-adherence': [48, 48], 'betting-adherence': null } })).toEqual(['z', 1_000]);
    });

    it.each([
      ['assisted Check', { ...RUNNING_COUNT_CHECK, assistanceClass: 'assisted-check', countRevealed: true }],
      ['Learn', { ...RUNNING_COUNT_CHECK, variant: 'learn', assistanceClass: 'learn' }],
    ] as const)('never takes the fastest from %s', (_label, key) => {
      expect(fastestOf({ id: 'z', key, performanceMs: 1_000 })).toBeNull();
    });
  });

  describe('local and accepted attempts', () => {
    it('lists history newest first, each attempt once, labelled local until accepted', () => {
      const { history, groups } = progressProjection([
        attempt({ id: 'synced', endedAt: 1_000, local: false }),
        attempt({ id: 'pending', endedAt: 3_000, local: true }),
        attempt({ id: 'uploaded', endedAt: 2_000, local: true }),
        attempt({ id: 'uploaded', endedAt: 2_000, local: false }),
      ]);
      expect(history.map((entry) => [entry.record.attemptId, entry.local])).toEqual([
        ['pending', true],
        ['uploaded', false],
        ['synced', false],
      ]);
      expect(groups[0]!.attempts).toHaveLength(3);
    });

    it('gives every device the same bests from the same attempts, in any order', () => {
      const attempts = [attempt({ id: 'b', installation: 'device-b', scores: { 'running-count': [3, 4] } }), attempt({ id: 'a', installation: 'device-a', scores: { 'running-count': [3, 4] } })];
      const here = progressProjection(attempts).groups[0]!;
      const there = progressProjection([...attempts].reverse()).groups[0]!;
      expect([here.bests[0]!.attempt.attemptId, there.bests[0]!.attempt.attemptId]).toEqual(['a', 'a']);
    });
  });

  describe('what an attempt earned', () => {
    const earnedBy = (id: string, ...fixtures: AttemptFixture[]) => attemptEarned(fixtures.map(attempt), id);

    it('sets a personal best when it is the first completed attempt in its group, or beats the best before it', () => {
      expect(earnedBy('first', { id: 'first', performanceMs: null, scores: { 'running-count': [2, 4] } })).toEqual({ bests: ['running-count'], fastest: null });
      expect(earnedBy('better', { id: 'first', performanceMs: null, scores: { 'running-count': [2, 4] } }, { id: 'better', performanceMs: null, scores: { 'running-count': [3, 4] } })).toEqual({
        bests: ['running-count'],
        fastest: null,
      });
    });

    it('sets nothing by equalling the best, even when its identity would win the tie', () => {
      expect(earnedBy('a-tie', { id: 'z-first', performanceMs: null, scores: { 'running-count': [3, 4] } }, { id: 'a-tie', performanceMs: null, scores: { 'running-count': [3, 4] } })).toEqual({
        bests: [],
        fastest: null,
      });
    });

    it('sets the fastest with a quicker perfect run, and only the fastest when accuracy ties', () => {
      expect(earnedBy('quicker', { id: 'first', performanceMs: 200_000 }, { id: 'quicker', performanceMs: 150_000 })).toEqual({ bests: [], fastest: 150_000 });
      expect(earnedBy('slower', { id: 'first', performanceMs: 200_000 }, { id: 'slower', performanceMs: 250_000 })).toEqual({ bests: [], fastest: null });
    });

    it('sets nothing from an insufficient-funds attempt (Amendment 2 §3)', () => {
      expect(earnedBy('short', { id: 'short', ending: 'insufficient-funds', key: TABLE_PLAY_CHECK, scores: { 'running-count': [4, 4] } })).toEqual({ bests: [], fastest: null });
    });

    it('compares only within the attempt’s own group', () => {
      expect(earnedBy('learn', { id: 'check', scores: { 'running-count': [4, 4] } }, { id: 'learn', key: { ...RUNNING_COUNT_CHECK, variant: 'learn', assistanceClass: 'learn' }, scores: { 'running-count': [1, 4] } })).toEqual({
        bests: ['running-count'],
        fastest: null,
      });
    });
  });
});

function onlyGroup(fixtures: readonly AttemptFixture[]) {
  const { groups } = progressProjection(fixtures.map(attempt));
  expect(groups).toHaveLength(1);
  return groups[0]!;
}
