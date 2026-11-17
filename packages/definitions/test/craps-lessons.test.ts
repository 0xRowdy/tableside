// Spec 3 Lessons › Inventory, Content requirements, Structure; Amendment 1 C11; Testing Decisions › Build-time check; #154
import { ODDS_CAPS } from '@tableside/engine';
import { describe, expect, it } from 'vitest';

import { CRAPS_EDGE_WAGERS, crapsHouseEdge, LESSONS, lessonProblems, standardCraps, type Lesson } from '../src';

const craps = () => LESSONS.filter((lesson) => lesson.section === 'craps');
const lesson = (id: string) => LESSONS.find((candidate) => candidate.id === id)!;
const copy = (subject: Lesson) => subject.content!.steps.flatMap((step) => [step.heading, ...step.paragraphs]).join('\n');

const STRATEGIES: Record<string, string> = {
  'pass-with-odds': 'builtin-craps-pass-with-odds',
  'flat-place-6-8': 'builtin-craps-flat-place-6-8',
  'dont-pass-with-lay-odds': 'builtin-craps-dont-pass-lay-odds',
  'three-point-molly': 'builtin-craps-three-point-molly',
  'press-and-collect-6-8': 'builtin-craps-press-and-collect-6-8',
};

describe('standard craps lessons', () => {
  it('author all six, at version 1 with no material change, and pass build-time validation', () => {
    expect(craps().map((subject) => [subject.id, subject.content && { version: subject.content.version, materialVersion: subject.content.materialVersion, change: subject.content.change }])).toEqual(
      ['craps-basics', 'pass-with-odds', 'flat-place-6-8', 'dont-pass-with-lay-odds', 'three-point-molly', 'press-and-collect-6-8'].map((id) => [id, { version: 1, materialVersion: 1, change: null }]),
    );
    expect(lessonProblems(craps())).toEqual([]);
  });

  it('hand basics off to craps free play, and each strategy lesson to guided practice with its strategy, then free play', () => {
    expect(lesson('craps-basics').content!.handoffs).toEqual([{ kind: 'free-play', game: 'craps' }]);
    for (const [id, strategy] of Object.entries(STRATEGIES)) {
      expect(lesson(id).content!.handoffs).toEqual([
        { kind: 'guided-practice', game: 'craps', strategy },
        { kind: 'free-play', game: 'craps' },
      ]);
    }
  });

  it('say plainly in each progression lesson that changing stakes does not remove the house edge', () => {
    for (const id of ['three-point-molly', 'press-and-collect-6-8']) expect(copy(lesson(id))).toContain("Changing stakes doesn't remove the house edge.");
  });

  it("label Tableside's own variants, caps and resets in each strategy lesson", () => {
    for (const id of Object.keys(STRATEGIES)) expect(copy(lesson(id))).toMatch(/Tableside's own/);
  });

  it('state only house-edge figures the engine computes for standard craps', () => {
    const engine = new Set(
      ODDS_CAPS.flatMap((odds) =>
        CRAPS_EDGE_WAGERS.flatMap((wager) => {
          const edge = crapsHouseEdge(wager, standardCraps(odds));
          return [edge.percent, edge.withFullOdds].filter((value) => value !== null).map((value) => `${value}%`);
        }),
      ),
    );
    const stated = craps().flatMap((subject) => copy(subject).match(/\d+\.\d+%/g) ?? []);
    expect(stated.length).toBeGreaterThan(0);
    expect(stated.filter((figure) => !engine.has(figure))).toEqual([]);
  });

  it('make no profitability, readiness or predicted-result claims', () => {
    const claims = /\b(guarantee|profitable|profit (?:is|every)|beat the (?:house|casino|game)|sure win|can't lose|ready for the casino|casino[- ]ready|you will win|always wins)\b/i;
    for (const subject of craps()) expect([subject.id, copy(subject).match(claims)?.[0] ?? null]).toEqual([subject.id, null]);
  });

  it('cite exact sources as text, with https links or none', () => {
    for (const subject of craps()) {
      const { sources } = subject.content!;
      expect([subject.id, sources.length > 0]).toEqual([subject.id, true]);
      for (const source of sources) {
        expect(source.citation.trim()).not.toBe('');
        expect(source.citation).not.toMatch(/\[|\]/);
        if (source.url !== null) expect(source.url).toMatch(/^https:\/\/\S+$/);
      }
    }
  });
});
