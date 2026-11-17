// Spec 3 Lessons › Inventory (Roulette), Content requirements; Amendment 1 C11; #155
import { describe, expect, it } from 'vitest';

import { BOUNDED_LABOUCHERE, CAPPED_MARTINGALE, FIXED_TWO_DOZENS, FLAT_EVEN_MONEY, LESSONS, lessonProblems, THREE_WIN_PARLAY, type Lesson } from '../src';

const roulette = LESSONS.filter((lesson) => lesson.section === 'roulette');
const text = (lesson: Lesson) => lesson.content!.steps.flatMap((step) => [step.heading, ...step.paragraphs]).join('\n');
const lesson = (id: string) => roulette.find((item) => item.id === id)!;
const STRATEGY_LESSONS: readonly [string, string][] = [
  ['flat-even-money', FLAT_EVEN_MONEY.id],
  ['fixed-two-dozen-coverage', FIXED_TWO_DOZENS.id],
  ['capped-martingale', CAPPED_MARTINGALE.id],
  ['three-win-parlay', THREE_WIN_PARLAY.id],
  ['bounded-labouchere', BOUNDED_LABOUCHERE.id],
];
const PROGRESSIONS = ['capped-martingale', 'three-win-parlay', 'bounded-labouchere'];

describe('roulette lessons', () => {
  it('author all six at version 1 with no material change, and pass build-time validation and engine replay', () => {
    expect(roulette.map((item) => [item.id, item.content?.version, item.content?.materialVersion, item.content?.change])).toEqual([
      ['roulette-basics', 1, 1, null],
      ['flat-even-money', 1, 1, null],
      ['fixed-two-dozen-coverage', 1, 1, null],
      ['capped-martingale', 1, 1, null],
      ['three-win-parlay', 1, 1, null],
      ['bounded-labouchere', 1, 1, null],
    ]);
    expect(lessonProblems(roulette)).toEqual([]);
  });

  it('basics cover the wheel and limits, the bet selector, payouts, turn phases, settlement and funding, and hand off to free play or guided practice', () => {
    const basics = text(lesson('roulette-basics'));
    for (const topic of ['Single zero (0)', 'Double zero (0, 00)', 'inside bets take 1 to 100', 'view is the bet selector', '“Find by number”', 'pays 35:1', 'Betting:', 'Spin:', 'Settle:', 'returns 360', 'buy-in', 'Rebuy', 'End session']) {
      expect(basics).toContain(topic);
    }
    expect(lesson('roulette-basics').content).toMatchObject({ workedExample: null, handoffs: [{ kind: 'free-play', game: 'roulette' }, { kind: 'guided-practice', game: 'roulette', strategy: null }] });
  });

  it.each(STRATEGY_LESSONS)('%s hands off to guided practice with its strategy prefilled, then free play, and has a worked example of that strategy', (id, strategy) => {
    const { content } = lesson(id);
    expect(content?.handoffs).toEqual([{ kind: 'guided-practice', game: 'roulette', strategy }, { kind: 'free-play', game: 'roulette' }]);
    expect(content?.workedExample).toMatchObject({ kind: 'strategy-step', game: 'roulette', strategy });
  });

  it.each(PROGRESSIONS)('%s ends with the plain house-edge statement and labels its caps and resets as Tableside’s own', (id) => {
    const last = lesson(id).content!.steps.at(-1)!;
    expect(last.heading).toBe("Stakes change. The house edge doesn't.");
    expect(last.paragraphs.join('\n')).toContain("Changing stakes doesn't remove the house advantage.");
    expect(last.paragraphs.join('\n')).toMatch(/Tableside's own variant: .*starting the next cycle yourself.* Tableside's rules/);
  });

  it('cite an exact page section or video time for every source, as text links', () => {
    for (const item of roulette) {
      expect(item.content!.sources.length).toBeGreaterThan(0);
      for (const { citation, url } of item.content!.sources) {
        expect(url).toMatch(/^https:\/\//);
        expect(url).not.toMatch(/youtube\.com\/(@|c\/|channel\/)/);
        if (url!.includes('youtube.com')) expect([citation, url]).toEqual([expect.stringMatching(/, at \d+:\d\d/), expect.stringMatching(/[?&]t=\d+s$/)]);
        else expect(citation).toMatch(/section|PDF page/);
      }
    }
  });

  it('make no profitability, safety, readiness or prediction claims', () => {
    for (const item of roulette) expect(text(item)).not.toMatch(/\b(profit\w*|guarantee\w*|beat\w*|safe\w*|due|ready|readiness|sure)\b/i);
  });
});
