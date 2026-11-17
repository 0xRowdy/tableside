// Spec 3 Challenge content (from #4); #158
import { contentProblem, createChallenge, advanceChallenge, RANDOM_PROTOCOL_VERSION } from '@tableside/engine';
import { describe, expect, it } from 'vitest';

import { CHALLENGE_CONTENT } from '../src';

describe('challenge content definitions', () => {
  it('start with card values: 20 questions covering every rank, version 1', () => {
    expect(CHALLENGE_CONTENT['card-values']).toEqual({ category: 'card-values', id: 'card-values', version: 1, length: 20, coverage: 'every-rank' });
  });

  it('are each accepted by the engine and generate their length', () => {
    for (const content of Object.values(CHALLENGE_CONTENT)) {
      expect(contentProblem(content)).toBeUndefined();
      const created = createChallenge({ attemptId: 'a', owner: 'o', device: 'd', variant: 'learn', content }, { protocol: RANDOM_PROTOCOL_VERSION, key: [1, 2], session: [3, 4] });
      const begun = advanceChallenge(created, { sequence: 0, commandId: 'begin', command: { kind: 'begin' } });
      expect(begun.status === 'committed' && begun.state.items.length).toBe(content.length);
    }
  });
});
