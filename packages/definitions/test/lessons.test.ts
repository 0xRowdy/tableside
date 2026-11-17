// Spec 3 Lessons and worked examples (#48), Amendment 1 B1; Testing Decisions › Build-time check; #143
import { describe, expect, it } from 'vitest';

import { APP_ORIENTATION, CATALOG_CATEGORIES, CHALLENGE_LESSONS, LESSONS, lessonProblems, type Lesson, type LessonHandoff } from '../src';

const authored = (lesson: Lesson) => lesson.content !== null;

describe('lesson definitions', () => {
  it('list 24 lesson slots: 1 app, 10 blackjack, 6 standard craps, 6 roulette, 1 builder', () => {
    expect(LESSONS.map((lesson) => [lesson.section, lesson.title])).toEqual([
      ['app', 'App orientation'],
      ['blackjack', 'Blackjack basics'],
      ['blackjack', 'Basic strategy'],
      ['blackjack', 'Basic with deviations'],
      ['blackjack', 'Counting with basic'],
      ['blackjack', 'Counting with deviations'],
      ['blackjack', 'Card values'],
      ['blackjack', 'Running count'],
      ['blackjack', 'True-count conversion'],
      ['blackjack', 'Table counting'],
      ['blackjack', 'Bet schedule'],
      ['craps', 'Craps basics'],
      ['craps', 'Pass with odds'],
      ['craps', 'Flat place 6 and 8'],
      ['craps', "Don't pass with lay odds"],
      ['craps', 'Three-point Molly (bounded)'],
      ['craps', 'Press-and-collect 6 and 8 (capped)'],
      ['roulette', 'Roulette basics'],
      ['roulette', 'Flat even-money'],
      ['roulette', 'Fixed two-dozen coverage'],
      ['roulette', 'Capped Martingale'],
      ['roulette', 'Three-win parlay'],
      ['roulette', 'Bounded Labouchere'],
      ['builder', 'Building a strategy'],
    ]);
  });

  it('associate each game lesson with its game for access, and the app and builder lessons with none', () => {
    expect(LESSONS.filter((lesson) => lesson.game === null).map((lesson) => lesson.id)).toEqual(['app-orientation', 'building-a-strategy']);
    expect(new Set(LESSONS.filter((lesson) => lesson.section === 'craps').map((lesson) => lesson.game))).toEqual(new Set(['craps']));
  });

  it('author App orientation at version 1 (navigation, help, practice vs casino records), with no material change yet', () => {
    expect(LESSONS.filter(authored).map((lesson) => lesson.id)).toEqual([
      'app-orientation',
      'craps-basics',
      'pass-with-odds',
      'flat-place-6-8',
      'dont-pass-with-lay-odds',
      'three-point-molly',
      'press-and-collect-6-8',
    ]);
    const orientation = LESSONS[0]!;
    expect(orientation.summary).toBe('Tabs, help, practice vs casino records');
    expect(orientation.content).toMatchObject({ version: 1, materialVersion: 1, change: null, workedExample: null, handoffs: [], sources: [] });
    expect(orientation.content?.steps.map((step) => step.heading)).toEqual(['Find your way around', 'Help when you need it', 'Practice records and casino records', 'Lessons at your own pace']);
  });

  it('pass build-time validation', () => {
    expect(lessonProblems(LESSONS)).toEqual([]);
  });

  // Spec 3 Lessons › Entry points; #145
  it('name the blackjack lesson beside each counting challenge category on the Counting tab', () => {
    expect(CATALOG_CATEGORIES).toEqual(['card-values', 'running-count', 'conversion', 'table']);
    expect(CATALOG_CATEGORIES.map((category) => LESSONS.find((lesson) => lesson.id === CHALLENGE_LESSONS[category])?.title)).toEqual([
      'Card values',
      'Running count',
      'True-count conversion',
      'Table counting',
    ]);
  });

  describe('validation reports', () => {
    const orientation = LESSONS[0]!;
    const content = orientation.content!;

    it('duplicate and malformed identities', () => {
      expect(lessonProblems([orientation, orientation, { ...orientation, id: 'App Orientation' }])).toEqual([
        'app-orientation: the identity is used twice',
        'App Orientation: the identity is not lowercase words joined by hyphens',
      ]);
    });

    it('a game association that does not match the section', () => {
      expect(lessonProblems([{ ...orientation, game: 'blackjack' }, { ...LESSONS[1]!, game: null }, { ...LESSONS[11]!, game: 'roulette', content: null }])).toEqual([
        'app-orientation: a lesson in the app section must be associated with no game, not blackjack',
        'blackjack-basics: a lesson in the blackjack section must be associated with blackjack, not no game',
        'craps-basics: a lesson in the craps section must be associated with craps, not roulette',
      ]);
    });

    it('versions that are not positive whole numbers, or a material change after the current version', () => {
      expect(
        lessonProblems([
          { ...orientation, content: { ...content, version: 0 } },
          { ...orientation, id: 'b', content: { ...content, version: 1.5 } },
          { ...orientation, id: 'c', content: { ...content, version: 2, materialVersion: 3, change: 'x' } },
        ]),
      ).toEqual([
        'app-orientation: the version is not a positive whole number',
        'b: the version is not a positive whole number',
        'c: the material-change version is after the current version',
      ]);
    });

    it('a material change without its explanation, or an explanation without one', () => {
      expect(
        lessonProblems([
          { ...orientation, content: { ...content, version: 2, materialVersion: 2, change: null } },
          { ...orientation, id: 'b', content: { ...content, version: 2, materialVersion: 1, change: 'the tabs changed' } },
        ]),
      ).toEqual(['app-orientation: a material change needs its explanation', 'b: only a material change has an explanation']);
    });

    // Spec 3 Lessons › Structure (Handoff); Testing Decisions › Build-time check; #145
    describe('handoff targets that do not resolve to a real setup', () => {
      const cardValues: Lesson = { ...LESSONS[6]!, content };
      const roulette: Lesson = { ...LESSONS[20]!, content };
      const withHandoffs = (lesson: Lesson, handoffs: readonly unknown[]): Lesson => ({ ...lesson, content: { ...content, handoffs: handoffs as LessonHandoff[] } });

      it('accept free play, guided practice with or without a mode or strategy, and a Learn challenge', () => {
        expect(
          lessonProblems([
            withHandoffs(cardValues, [
              { kind: 'learn-challenge', category: 'conversion' },
              { kind: 'guided-practice', game: 'blackjack', strategy: 'counting-with-deviations' },
              { kind: 'guided-practice', game: 'blackjack', strategy: null },
              { kind: 'free-play', game: 'blackjack' },
            ]),
            withHandoffs(roulette, [
              { kind: 'guided-practice', game: 'roulette', strategy: 'builtin-roulette-capped-martingale' },
              { kind: 'free-play', game: 'roulette' },
            ]),
          ]),
        ).toEqual([]);
      });

      it('an unknown kind, game, mode, strategy or challenge category', () => {
        expect(
          lessonProblems([
            withHandoffs(cardValues, [
              { kind: 'quiz', game: 'blackjack' },
              { kind: 'guided-practice', game: 'blackjack', strategy: 'wonging' },
              { kind: 'learn-challenge', category: 'shuffle-tracking' },
            ]),
            withHandoffs({ ...APP_ORIENTATION, content }, [{ kind: 'free-play', game: 'baccarat' }]),
            withHandoffs(roulette, [
              { kind: 'guided-practice', game: 'roulette', strategy: 'builtin-craps-pass-with-odds' },
              { kind: 'guided-practice', game: 'roulette', strategy: 'reverse-martingale' },
            ]),
          ]),
        ).toEqual([
          'card-values: handoff 1 is not free play, guided practice or a Learn challenge',
          'card-values: handoff 2 names no built-in blackjack strategy: wonging',
          'card-values: handoff 3 names no counting challenge: shuffle-tracking',
          'app-orientation: handoff 1 opens no game setup: baccarat',
          'capped-martingale: handoff 1 names no built-in roulette strategy: builtin-craps-pass-with-odds',
          'capped-martingale: handoff 2 names no built-in roulette strategy: reverse-martingale',
        ]);
      });

      it("a target in another game than the lesson's, or one offered twice", () => {
        expect(
          lessonProblems([
            withHandoffs(roulette, [
              { kind: 'free-play', game: 'craps' },
              { kind: 'learn-challenge', category: 'card-values' },
              { kind: 'free-play', game: 'roulette' },
              { kind: 'free-play', game: 'roulette' },
            ]),
          ]),
        ).toEqual([
          'capped-martingale: handoff 1 opens craps setup from a roulette lesson',
          'capped-martingale: handoff 2 opens blackjack setup from a roulette lesson',
          'capped-martingale: handoff 4 repeats an earlier one',
        ]);
      });
    });

    it('a lesson with no steps or an empty step', () => {
      expect(
        lessonProblems([
          { ...orientation, content: { ...content, steps: [] } },
          { ...orientation, id: 'b', content: { ...content, steps: [{ heading: '', paragraphs: ['x'] }, { heading: 'y', paragraphs: [] }] } },
        ]),
      ).toEqual(['app-orientation: a lesson has at least one step', 'b: step 1 has no heading', 'b: step 2 has no text']);
    });
  });
});
