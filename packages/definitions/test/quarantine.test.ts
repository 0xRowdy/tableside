import { describe, expect, it } from 'vitest';

import { QUARANTINE_LIST } from '../src';

// The shipped quarantine list (#80) is plain versioned data, mirrored on the
// server (Amendment 6 §6). Every entry must name what it quarantines and say why.
describe('the shipped quarantine list', () => {
  it('is versioned plain data whose entries each name an identity, with a unique id and an explanation', () => {
    expect(Number.isInteger(QUARANTINE_LIST.version) && QUARANTINE_LIST.version >= 1).toBe(true);
    expect(JSON.parse(JSON.stringify(QUARANTINE_LIST))).toEqual(QUARANTINE_LIST);
    const ids = QUARANTINE_LIST.entries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of QUARANTINE_LIST.entries) {
      expect([entry.id, Object.keys(entry.match).length > 0, entry.explanation.trim().length > 0]).toEqual([entry.id, true, true]);
    }
  });
});
