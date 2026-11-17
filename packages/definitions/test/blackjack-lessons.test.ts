// Spec 3 Lessons and worked examples (#48), Amendment 1 B2, C11; Amendment 2 §3; #15 resolution; #152
import { describe, expect, it } from 'vitest';

import { LESSONS, lessonProblems, type Lesson } from '../src';
import { publishedGaps, situationName } from '../src/lessons/blackjack';

const lesson = (id: string): Lesson => {
  const found = LESSONS.find((candidate) => candidate.id === id);
  if (!found?.content) throw new Error(`${id} is not authored`);
  return found;
};
const text = (id: string) => lesson(id).content!.steps.flatMap((step) => [step.heading, ...step.paragraphs, ...(step.publishedNote ?? [])]);
const IDS = ['blackjack-basics', 'basic-strategy', 'basic-with-deviations', 'counting-with-basic', 'counting-with-deviations', 'bet-schedule'];

describe('blackjack lessons', () => {
  it('author basics, the four modes and the bet schedule at version 1, valid and blackjack-only', () => {
    expect(IDS.map((id) => [lesson(id).title, lesson(id).content!.version, lesson(id).content!.materialVersion])).toEqual([
      ['Blackjack basics', 1, 1],
      ['Basic strategy', 1, 1],
      ['Basic with deviations', 1, 1],
      ['Counting with basic', 1, 1],
      ['Counting with deviations', 1, 1],
      ['Bet schedule', 1, 1],
    ]);
    expect(lessonProblems(IDS.map(lesson))).toEqual([]);
  });

  it('hand each mode lesson off to guided practice with that mode prefilled', () => {
    for (const mode of ['basic-strategy', 'basic-with-deviations', 'counting-with-basic', 'counting-with-deviations']) {
      expect(lesson(mode).content!.handoffs).toContainEqual({ kind: 'guided-practice', game: 'blackjack', strategy: mode === 'basic-strategy' ? 'basic' : mode });
    }
    expect(lesson('bet-schedule').content!.handoffs.map((handoff) => handoff.kind)).toEqual(['guided-practice', 'guided-practice']);
  });

  // Spec 3 Lessons › Content requirements (game basics)
  it('cover bets and the bet selector, table conditions, turn phases, settlement and funding in basics', () => {
    const basics = text('blackjack-basics').join(' ');
    for (const fact of ['bet list', 'Deal', 'six decks', 'soft 17', 'late surrender', 'Bet, Deal, Play, Settle', 'insurance', 'pays 3 to 2', 'a push returns your bet', 'simulated chips']) {
      expect(basics).toContain(fact);
    }
    // Spec 1 Amendment 1 §B, Amendment 9 §1
    expect(basics).toContain('0.33% of each bet at the default table, 0.40% without surrender, 0.53% when the dealer hits soft 17, and 0.62% with both');
  });

  // Certified basic_S17_LS.csv cells
  it('teach basic strategy with the certified cells and fallbacks', () => {
    expect(text('basic-strategy')).toContain(
      'Sometimes the chart’s play isn’t available: you can’t double a three-card hand, or your chips can’t cover the extra bet. Each cell has a fallback for this. Hard 11 against a 6 is a double, and the fallback is to hit; soft 18 against a 3 is a double, falling back to stand.',
    );
    expect(text('basic-strategy').join(' ')).toContain('hard 16 against a 10 is a surrender');
  });

  // #15 resolution, "Relation to published values and teaching policy"; validation report "Reading the differences"
  describe('taught vs published values (S17)', () => {
    const gaps = publishedGaps('S17_LS');

    it('find the eleven one-count differences, five of them only through the tie rule', () => {
      expect(gaps.map((gap) => [gap.deviation.situation, gap.deviation.threshold, gap.published, gap.tieOnly])).toEqual([
        ['16 vs 10', 1, 0, true],
        ['T,T vs 6', 5, 4, false],
        ['12 vs 2', 4, 3, true],
        ['9 vs 7', 4, 3, true],
        ['13 vs 2', 0, -1, false],
        ['12 vs 4', 1, 0, false],
        ['12 vs 5', -1, -2, false],
        ['12 vs 6', 0, -1, false],
        ['14 vs 10 surrender', 4, 3, true],
        ['15 vs 9 surrender', 3, 2, true],
        ['15 vs A surrender', 2, 1, false],
      ]);
    });

    it('state the taught value, the published value, the per-bet cost and why, citing the source', () => {
      const deviations = lesson('basic-with-deviations').content!;
      const sixteen = deviations.steps.find((step) => step.heading === 'When the count changes a decision')!;
      expect(sixteen.publishedNote).toEqual([
        'For hard 16 against a 10, Tableside teaches: stand at +1 or higher, otherwise hit. Schlesinger’s published Illustrious 18 value is 0, one count lower.',
        'At 0 the two plays differ by 0.0000 ± 0.0008 of a unit bet, inside the margin Tableside treats as a tie. Its tie rule then keeps the play that adds no extra wager, so following the published value here costs nothing measurable.',
        'The difference comes from how Tableside sets its own values, so it doesn’t make the published chart wrong.',
      ]);
      const twelve = deviations.steps.find((step) => step.heading === 'Plays that kick in when the count drops')!;
      expect(twelve.publishedNote?.[1]).toBe(
        'Tableside values each play assuming you finish the hand by the taught chart (its teaching-continuation rule), over the hands its own six-deck game deals. On that basis, following the published value at −2 gives up 0.0126 ± 0.0007 of a unit bet each time the hand comes up, so Tableside waits one more count.',
      );
      for (const step of deviations.steps.filter((candidate) => candidate.publishedNote)) expect(step.source?.url).toBe('https://wizardofodds.com/games/blackjack/card-counting/high-low/');
    });

    it('summarize all eleven, naming T,T vs 6 and 12 vs 5 as the material differences', () => {
      const summary = lesson('basic-with-deviations').content!.steps.find((step) => step.heading === 'Where our numbers differ')!.paragraphs;
      expect(summary).toEqual([
        'With the dealer standing on soft 17, eleven of Tableside’s 22 index plays match Schlesinger’s published values and eleven sit one count higher.',
        'Five of those eleven come only from the tie rule and cost nothing measurable: hard 16 against a 10, hard 12 against a 2, hard 9 against a 7, hard 14 against a 10 (surrender) and hard 15 against a 9 (surrender).',
        'The other six are measurable at Tableside’s table. Per unit bet, at the published count: a pair of tens against a 6, 0.0188 at +4; hard 12 against a 5, 0.0126 at −2; hard 13 against a 2, 0.0072 at −1; hard 12 against a 6, 0.0044 at −1; hard 15 against an ace (surrender), 0.0020 at +1; and hard 12 against a 4, 0.0011 at 0. Only the first two, a pair of tens against a 6 and hard 12 against a 5, are large enough to matter much; the rest are a few thousandths of a bet.',
      ]);
    });

    // docs/research/blackjack-lessons.md, Deviations › H17
    it('compare the H17 values with the published ones, including the two-count gap on 12 vs 6', () => {
      const h17 = lesson('basic-with-deviations').content!.steps.find((step) => step.heading === 'When the dealer hits soft 17')!.paragraphs;
      expect(h17[1]).toBe(
        'At that table nine of Tableside’s values differ from the published Illustrious 18 and Fab 4, hard 12 against a 6 by two counts (−3 against −1) and the rest by one. Four of them come only from the tie rule: hard 16 against a 10, hard 9 against a 7, hard 14 against a 10 (surrender) and hard 15 against a 9 (surrender).',
      );
    });

    it('never call the published values wrong', () => {
      const aboutPublished = IDS.flatMap(text).filter((line) => /published|Schlesinger|Blackjack Apprenticeship/.test(line));
      for (const line of aboutPublished) expect(line.replace('doesn’t make the published chart wrong', '')).not.toMatch(/\b(wrong|incorrect|mistaken|error)/i);
    });
  });

  it('name the situations as a learner reads them', () => {
    expect(publishedGaps('S17_LS').map((gap) => situationName(gap.deviation))).toContain('a pair of tens against a 6');
  });

  // Spec 3 Lessons › Content requirements (bet schedule); #3; spec 1 Amendment 9 §7 (amounts, not multiples of a base bet)
  it('teach the 1/2/4/6/8 schedule as amounts by true count, scored apart from play and counting', () => {
    const lines = text('bet-schedule');
    expect(lines).toEqual(expect.arrayContaining(['Below +1: bet 10', '+1: bet 20', '+2: bet 40', '+3: bet 60', '+4 or higher: bet 80']));
    expect(lines.join(' ')).toContain('betting adherence is a separate score from playing adherence and counting accuracy');
    expect(lines.join(' ')).toContain('This schedule is Tableside’s own');
  });

  // Spec 3 Lessons › Content requirements; gate 9; Amendment 1 C11
  it('make no profitability, readiness or predicted-result claims, and list every source for the register', () => {
    for (const id of IDS) {
      for (const line of text(id)) expect(line).not.toMatch(/\b(profit|win money|beat the casino|edge over the house|ready for the casino|guarantee)/i);
      const { content } = lesson(id);
      expect(content!.sources.length).toBeGreaterThan(0);
      for (const line of text(id)) expect(line).not.toMatch(/(by|from|with) (Blackjack Apprenticeship|Casino Quest)'?s? (approval|endorsement)|approved by|endorsed by/i);
      for (const source of content!.sources) if (source.url !== null) expect(source.url).toMatch(/^https:\/\//);
    }
  });
});
