// Spec 3 Lessons › Structure (First-use hints), user story 5; S1-04 XjwQc; #146
import { describe, expect, it } from 'vitest';

import { HINT_IDS, HINTS, hintProblems, type Hint } from '../src';

describe('hint definitions', () => {
  it('define hints for the bet selector, count entry and the show-count toggle, each versioned', () => {
    expect(HINT_IDS).toEqual(['bet-selector', 'count-entry', 'show-count']);
    for (const id of HINT_IDS) {
      expect(HINTS[id].id).toBe(id);
      expect(Number.isInteger(HINTS[id].version) && HINTS[id].version >= 1).toBe(true);
    }
  });

  it('give the bet selector the frame’s wording', () => {
    expect(HINTS['bet-selector']).toMatchObject({
      name: 'Bet list',
      text: 'Every wager on this table, as a list you can read. Choosing one opens its editor; nothing is placed until you confirm.',
    });
  });

  it('pass their own checks', () => {
    expect(hintProblems(Object.values(HINTS))).toEqual([]);
  });

  it('flag a long hint, a missing version, a repeated id and a hint carrying a number', () => {
    const base: Hint = HINTS['count-entry'];
    expect(
      hintProblems([
        { ...base, text: 'word '.repeat(40).trim() },
        { ...base, id: 'show-count', version: 0 },
        { ...base, id: 'show-count', text: 'The count is +3 here.' },
      ]),
    ).toEqual([
      'count-entry: text is longer than 160 characters',
      'show-count: version must be a positive integer',
      'show-count: repeated id',
      'show-count: text carries a number, which could read as a count or an answer',
    ]);
  });
});
