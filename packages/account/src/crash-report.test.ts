// Spec 2 Observability and privacy boundaries; #108

import { RANDOM_PROTOCOL_VERSION, advanceChallenge, challengeAttemptRecord, createChallenge, readChallengeView, type ChallengeState } from '@tableside/engine';
import { describe, expect, it } from 'vitest';

import { crashReport } from './crash-report';
import { SyncCallError } from './sync/protocol';

const PRIVATE = [
  'player@example.com',
  '482913',
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhY2NvdW50In0.c2lnbmF0dXJl',
  'refresh-token-value',
  'Bellagio',
  '1763164800000',
  '16-17',
];

describe('a crash report', () => {
  it("keeps the error's type and its code locations, never its message", () => {
    const error = new TypeError(`could not save {"casino":"Bellagio","email":"player@example.com","code":"482913","band":"16-17"}`);
    const report = crashReport(error);
    expect(report.type).toBe('TypeError');
    expect(report.frames.length).toBeGreaterThan(0);
    expect(report.frames[0]).toContain('crash-report.test.ts');
    for (const text of PRIVATE) expect(JSON.stringify(report)).not.toContain(text);
  });

  it('drops query strings and fragments from frame locations, where a token could sit', () => {
    const error = new Error('boom');
    error.stack = [
      'Error: boom eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhY2NvdW50In0.c2lnbmF0dXJl',
      '    at renew (https://example.supabase.co/auth/v1/token?refresh_token=refresh-token-value#access_token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhY2NvdW50In0.c2lnbmF0dXJl:1:2)',
      '    at save@index.bundle?platform=ios&anchor=1763164800000:10:3',
      '    at player@example.com (index.bundle:3:4)',
    ].join('\n');
    const report = crashReport(error);
    expect(report.frames).toEqual(['at renew (https://example.supabase.co/auth/v1/token:1:2)', 'at save@index.bundle:10:3', 'at <frame> (index.bundle:3:4)']);
    for (const text of PRIVATE) expect(JSON.stringify(report)).not.toContain(text);
  });

  it('never keeps a line of a many-line message, even one shaped like a frame', () => {
    for (const message of ['could not save\n  at the Bellagio, code 482913, player@example.com', 'x\nat home (band 16-17 for player@example.com)', 'x\n    at player (Bellagio:1:2)']) {
      const report = crashReport(new Error(message));
      for (const text of PRIVATE) expect(JSON.stringify(report)).not.toContain(text);
      expect(report.frames[0]).toContain('crash-report.test.ts');
    }
  });

  it("keeps a sync failure's structured kind, which is a code, not text", () => {
    expect(crashReport(new SyncCallError('refused'))).toMatchObject({ type: 'SyncCallError', code: 'refused' });
  });

  it('reports a thrown non-error as its kind only', () => {
    expect(crashReport('player@example.com')).toEqual({ type: 'string', frames: [] });
    expect(crashReport({ email: 'player@example.com' })).toEqual({ type: 'object', frames: [] });
  });

  it('never takes a type name that could be text', () => {
    const error = new Error('x');
    error.name = 'player@example.com';
    expect(crashReport(error).type).toBe('Error');
  });
});

// Spec 3 Information hiding (end to end), Launch gates 2; #156
describe('a crash during an unfinished Check attempt', () => {
  const ATTEMPT = 'attempt-5f0c2a9e41b7';

  function unfinishedCheck(): ChallengeState {
    let state = createChallenge(
      { attemptId: ATTEMPT, owner: 'account-1', device: 'installation-1', variant: 'check', content: { category: 'card-values', id: 'card-values', version: 1, length: 20, coverage: 'every-rank' } },
      { protocol: RANDOM_PROTOCOL_VERSION, key: [7, 0x9e3779b9], session: [50, 0] },
    );
    for (const command of [{ kind: 'begin' }, { kind: 'answer', value: -1 }, { kind: 'next-item' }] as const) {
      const result = advanceChallenge(state, { sequence: state.sequence, commandId: `c-${state.sequence}`, command });
      if (result.status !== 'committed') throw new Error('refused');
      state = result.state;
    }
    return state;
  }

  function hiddenIn(state: ChallengeState): string[] {
    const cards = state.items.slice(0, 4).map((item) => JSON.stringify(item));
    return [ATTEMPT, 'account-1', 'installation-1', ...cards, JSON.stringify(state.answers), JSON.stringify(readChallengeView(state)), '"reference"', '"answers"'];
  }

  it("carries none of the attempt, its cards, answers or references, even when the error's message holds them", () => {
    const state = unfinishedCheck();
    const thrown: unknown[] = [];
    try {
      challengeAttemptRecord(state, {} as never);
    } catch (error) {
      thrown.push(error);
    }
    thrown.push(new Error(`attempt ${ATTEMPT} has a damaged checkpoint: ${JSON.stringify(state)}`));
    thrown.push(Object.assign(new RangeError(JSON.stringify({ view: readChallengeView(state), items: state.items })), { code: 'answer -1', kind: state.attempt.id }));
    expect(thrown).toHaveLength(3);
    for (const error of thrown) {
      const report = JSON.stringify(crashReport(error));
      expect(report).toContain('crash-report.test.ts');
      for (const hidden of hiddenIn(state)) expect(report).not.toContain(hidden);
    }
  });

  it('is only the error type, an optional code and code locations: no breadcrumb trail of screens, commands or answers', () => {
    const report = crashReport(new TypeError(JSON.stringify(unfinishedCheck())));
    expect(Object.keys(report).sort()).toEqual(['frames', 'type']);
    expect(Object.keys(crashReport(new SyncCallError('refused'))).sort()).toEqual(['code', 'frames', 'type']);
  });
});
