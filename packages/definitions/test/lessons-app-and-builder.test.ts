// Spec 3 Lessons and worked examples (#48), Amendment 1 C11, Amendment 4 §5; #151
import { describe, expect, it } from 'vitest';

import { LESSONS, lessonProblems, type Lesson } from '../src';

const lesson = (id: string): Lesson => LESSONS.find((candidate) => candidate.id === id)!;
const copy = (subject: Lesson) => subject.content!.steps.flatMap((step) => [step.heading, ...step.paragraphs]).join('\n');
const sourceText = (subject: Lesson) => subject.content!.sources.map((source) => source.citation).join('\n');

describe.each(['app-orientation', 'building-a-strategy'])('the %s lesson', (id) => {
  const subject = lesson(id);

  it('is written at version 1 with no material change, and passes build-time validation', () => {
    expect(subject.content).toMatchObject({ version: 1, materialVersion: 1, change: null, workedExample: null });
    expect(lessonProblems([subject])).toEqual([]);
  });

  // Spec 3 Lessons › Access, Amendment 4 §5
  it('is tied to no game, so it is always available offline', () => {
    expect(subject.game).toBeNull();
  });

  // Spec 3 Amendment 1 C11
  it("records its provenance as Tableside's own work, with no outside credit or link", () => {
    expect(subject.content!.sources).toEqual([{ citation: expect.stringMatching(/^Tableside's own .+; no outside source$/), url: null }]);
    expect(`${copy(subject)}\n${sourceText(subject)}`).not.toMatch(/apprenticeship|casino quest|\bBJA\b|youtube|https?:/i);
  });

  // Spec 3 Content requirements; gate 9
  it('makes no profitability, readiness or predicted-result claim', () => {
    expect(copy(subject)).not.toMatch(/\b(profitable|guarantee\w*|beat the house|win more|winning system|ready for the casino|table-ready)\b/i);
  });
});

describe('App orientation', () => {
  const orientation = lesson('app-orientation');

  it('covers navigation, help, and practice vs casino records', () => {
    expect(orientation.summary).toBe('Tabs, help, practice vs casino records');
    expect(orientation.content!.steps.map((step) => step.heading)).toEqual([
      'Find your way around',
      'Help when you need it',
      'Practice, casino and challenge records',
      'Lessons at your own pace',
    ]);
  });

  // Spec 1 Presentation, navigation and screens
  it('names all six tabs', () => {
    const [navigation] = orientation.content!.steps;
    for (const tab of ['Home', 'Play', 'Counting', 'Community', 'Saved', 'More']) expect(navigation!.paragraphs.join(' ')).toContain(tab);
  });

  // Spec 3 Lessons › Structure (Handoff)
  it('hands off to free play in each game', () => {
    expect(orientation.content!.handoffs).toEqual([
      { kind: 'free-play', game: 'blackjack' },
      { kind: 'free-play', game: 'craps' },
      { kind: 'free-play', game: 'roulette' },
    ]);
  });
});

describe('Builder', () => {
  const builder = lesson('building-a-strategy');

  it('covers conditions, wagers and amounts, explanations, conflicts, fallbacks and stopping', () => {
    expect(builder).toMatchObject({ title: 'Building a strategy', section: 'builder', summary: 'Conditions, amounts, conflicts, fallbacks, stopping' });
    expect(builder.content!.steps.map((step) => step.heading)).toEqual([
      'Start from a strategy',
      'Conditions: when a rule acts',
      'Wagers and amounts',
      'Explanations: check what it does',
      'Conflicts: you choose which rule wins',
      'Defaults and fallbacks',
      'Stopping, saving and practicing',
    ]);
  });

  // Spec 3 Content requirements; spec 4 Amendment 1 P, U
  it("says changing stakes doesn't remove the house edge", () => {
    expect(copy(builder)).toContain("Changing bets or stakes doesn't remove the house edge.");
  });

  // Spec 4 Preview
  it('labels the preview an illustration, not a result', () => {
    expect(copy(builder)).toContain('Illustration, not a result');
  });

  // Spec 3 Lessons › Structure (Handoff); spec 4 story 41
  it('hands off to guided practice in each game, where your saved strategies are offered', () => {
    expect(builder.content!.handoffs).toEqual([
      { kind: 'guided-practice', game: 'blackjack', strategy: null },
      { kind: 'guided-practice', game: 'craps', strategy: null },
      { kind: 'guided-practice', game: 'roulette', strategy: null },
    ]);
  });
});
