// Spec 3 Lessons and worked examples (#48), Amendment 1 B2, C11, Amendment 2 §3; #153
import { describe, expect, it } from 'vitest';

import { CHALLENGE_LESSONS, LESSONS, lessonProblems, type Lesson } from '../src';

const lesson = (id: string): Lesson => {
  const found = LESSONS.find((candidate) => candidate.id === id);
  if (!found?.content) throw new Error(`${id} is not authored`);
  return found;
};
const text = (id: string) => lesson(id).content!.steps.flatMap((step) => [step.heading, ...step.paragraphs, ...(step.publishedNote?.paragraphs ?? [])]).join(' ');
const IDS = ['card-values', 'running-count', 'true-count-conversion', 'table-counting'];

describe('counting lessons', () => {
  it('author card values, running count, conversion and table counting at version 1, valid and blackjack-only', () => {
    expect(IDS.map((id) => [lesson(id).title, lesson(id).section, lesson(id).content!.version, lesson(id).content!.materialVersion])).toEqual([
      ['Card values', 'blackjack', 1, 1],
      ['Running count', 'blackjack', 1, 1],
      ['True-count conversion', 'blackjack', 1, 1],
      ['Table counting', 'blackjack', 1, 1],
    ]);
    expect(lessonProblems(IDS.map(lesson))).toEqual([]);
    expect(lessonProblems(LESSONS)).toEqual([]);
    expect(LESSONS.filter((candidate) => candidate.content === null)).toEqual([]);
  });

  it('give each lesson a worked example and a handoff to its own Learn challenge', () => {
    for (const [category, id] of Object.entries(CHALLENGE_LESSONS)) {
      const { content } = lesson(id);
      expect(content!.workedExample).not.toBeNull();
      expect(content!.handoffs).toEqual([{ kind: 'learn-challenge', category }]);
    }
    expect(IDS.map((id) => lesson(id).content!.workedExample!.kind)).toEqual(['card-value', 'running-count', 'conversion', 'table-count']);
  });

  // Spec 3 Lessons and worked examples: the conversion lesson; Amendment 2 §3
  it('teach half-deck estimation, truncation toward zero, other sources’ conventions and zero-threshold indices in the conversion lesson', () => {
    const conversion = text('true-count-conversion');
    for (const fact of ['nearest half deck', 'go up', 'Never use less than half a deck', '+7 with 2 decks left is +3.5, which becomes +3', '−7 with 2 decks left is −3.5, which becomes −3, not −4']) {
      expect(conversion).toContain(fact);
    }
    expect(conversion).toContain('Blackjack Apprenticeship’s example divides −7 by 2 decks and gets −3, which matches Tableside, but the page doesn’t say how to round');
    expect(conversion).not.toMatch(/Apprenticeship truncates/);
    expect(conversion).toContain('its example rounds 7 ÷ 4 = 1.75 up to 2 to keep it simple; Tableside’s convention gives +1 there');
    expect(conversion).toContain('With the dealer standing on soft 17, Tableside teaches for hard 13 against a 2: stand at 0 or higher, and hit below that.');
    const zero = lesson('true-count-conversion').content!.steps.find((s) => s.heading === 'Why it matters at zero')!;
    expect(zero.publishedNote!.paragraphs[0]).toMatch(/^For hard 13 against a 2, Tableside teaches: stand at 0 or higher, and hit below that\. Schlesinger’s published Illustrious 18 value is −1, one count lower\./);
    expect(conversion).toContain('tie rule and teaching-continuation rule');
    const example = lesson('true-count-conversion').content!.workedExample!;
    expect(example).toMatchObject({ kind: 'conversion', running: 7, decks: 2 });
  });

  it('explain in the table lesson that showing the count in Check marks the attempt assisted permanently', () => {
    const table = text('table-counting');
    expect(table).toContain('In Check, showing the count marks the whole attempt assisted, permanently, even if you hide it again.');
    for (const fact of ['Observe', 'Play option', 'coming in a later update', 'N = 1', 'every 10 rounds', 'turned over', 'starts again at 0']) expect(table).toContain(fact);
  });

  // Spec 3 gate 9; Amendment 1 C11
  it('make no profitability, readiness or prediction claims and cite exact sections as text links', () => {
    const all = IDS.map(text).join(' ');
    expect(all).not.toMatch(/\b(profit|win money|edge over|beat the casino|ready for|guarantee|you will win)/i);
    expect(all).not.toMatch(/Casino Quest/);
    for (const id of IDS) {
      const { sources } = lesson(id).content!;
      expect(sources.length).toBeGreaterThan(0);
      for (const source of sources) {
        expect(source.citation).toMatch(/section|indices_S17_final\.csv/);
        expect(source.url === null || source.url.startsWith('https://')).toBe(true);
      }
    }
  });
});
