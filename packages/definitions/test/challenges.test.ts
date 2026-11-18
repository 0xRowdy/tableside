// Spec 3 Challenge content (from #4); #158, #133, #134, #137, #138
import { contentProblem, createChallenge, advanceChallenge, RANDOM_PROTOCOL_VERSION } from '@tableside/engine';
import { describe, expect, it } from 'vitest';

import { BLACKJACK_REFERENCE_IDENTITY, blackjackRules, blackjackStrategy, CHALLENGE_CONTENT, DEFAULT_TABLE_SETUP, seatStrategy, TABLE_CONTENT, tableSetup } from '../src';

describe('challenge content definitions', () => {
  it('start with card values: 20 questions covering every rank, version 1', () => {
    expect(CHALLENGE_CONTENT['card-values']).toEqual({ category: 'card-values', id: 'card-values', version: 1, length: 20, coverage: 'every-rank' });
  });

  it('include running count: 52 cards of a six-deck shoe, checked after cards 13, 26, 39 and 52, pinned to the blackjack reference', () => {
    expect(CHALLENGE_CONTENT['running-count']).toEqual({
      category: 'running-count',
      id: 'running-count',
      version: 1,
      length: 52,
      decks: 6,
      checkpoints: [13, 26, 39, 52],
      reference: BLACKJACK_REFERENCE_IDENTITY,
    });
  });

  it('include conversion: 10 questions, running counts within ±20 and decks remaining up to 6, with no blackjack reference pinned', () => {
    expect(CHALLENGE_CONTENT.conversion).toEqual({ category: 'conversion', id: 'conversion', version: 1, length: 10, maxRunningCount: 20, maxDecks: 6 });
  });

  it('include table counting: 10 rounds pinned to the blackjack reference', () => {
    expect(TABLE_CONTENT).toEqual({ category: 'table', id: 'table', version: 1, rounds: 10, reference: BLACKJACK_REFERENCE_IDENTITY });
    expect(CHALLENGE_CONTENT.table).toBe(TABLE_CONTENT);
  });

  it('default table counting to Observe, S17 with late surrender, 75% penetration, no extra players and N = 1; Play funding to no bet schedule, a base wager of 10 and 1,000', () => {
    expect(DEFAULT_TABLE_SETUP).toEqual({ seat: 'observe', preset: 'S17_LS', penetration: 75, extraPlayers: 0, interval: 1, countingMode: 'basic', betSchedule: false, baseWager: 10, startingBalance: 1000 });
    expect(tableSetup(DEFAULT_TABLE_SETUP)).toEqual({ seat: 'observe', rules: blackjackRules('S17_LS', 75, 0), strategy: seatStrategy('S17_LS'), interval: 1 });
  });

  it("seat the simulated player with the preset's basic strategy and extra players at the table minimum", () => {
    const setup = tableSetup({ ...DEFAULT_TABLE_SETUP, seat: 'observe', preset: 'H17_noLS', penetration: 50, extraPlayers: 4, interval: 3, countingMode: 'basic' });
    expect(setup.seat === 'observe' && setup.strategy).toEqual(seatStrategy('H17_noLS'));
    expect(setup.rules.players).toEqual({ learnerSeat: 4, otherWagers: ['10', '10', '10', '10'], strategy: seatStrategy('H17_noLS') });
    expect([setup.rules.dealer, setup.rules.lateSurrender, setup.rules.penetration, setup.interval]).toEqual(['H17', false, 50, 3]);
  });

  it("seat the learner in Play with the certified counting policy for the preset and mode, the count kept by the learner", () => {
    const basic = tableSetup({ ...DEFAULT_TABLE_SETUP, seat: 'play', preset: 'H17_LS', countingMode: 'basic' });
    const deviations = tableSetup({ ...DEFAULT_TABLE_SETUP, seat: 'play', countingMode: 'deviations', extraPlayers: 2 });
    expect(basic).toEqual({
      seat: 'play',
      rules: blackjackRules('H17_LS', 75, 0),
      policy: blackjackStrategy('H17_LS', 'counting-with-basic').play,
      interval: 1,
      betSchedule: false,
      baseWager: '10',
      startingBalance: '1000',
    });
    const scheduled = tableSetup({ ...DEFAULT_TABLE_SETUP, seat: 'play', betSchedule: true, baseWager: 25, startingBalance: 300 });
    expect(scheduled.seat === 'play' && [scheduled.betSchedule, scheduled.baseWager, scheduled.startingBalance]).toEqual([true, '25', '300']);
    expect(deviations.seat === 'play' && [deviations.policy.count, deviations.policy.deviations.length > 0]).toEqual(['player', true]);
    expect(deviations.rules.players.strategy).toEqual(seatStrategy('S17_LS'));
    for (const table of [basic, deviations, scheduled]) {
      const created = createChallenge({ attemptId: 'a', owner: 'o', device: 'd', variant: 'check', content: TABLE_CONTENT, table }, { protocol: RANDOM_PROTOCOL_VERSION, key: [1, 2], session: [3, 4] });
      expect(advanceChallenge(created, { sequence: 0, commandId: 'begin', command: { kind: 'begin' } }).status).toBe('committed');
    }
  });

  it('are each accepted by the engine and generate their length', () => {
    for (const content of Object.values(CHALLENGE_CONTENT)) {
      expect(contentProblem(content)).toBeUndefined();
      const table = content.category === 'table' ? { table: tableSetup(DEFAULT_TABLE_SETUP) } : {};
      const created = createChallenge({ attemptId: 'a', owner: 'o', device: 'd', variant: 'learn', content, ...table }, { protocol: RANDOM_PROTOCOL_VERSION, key: [1, 2], session: [3, 4] });
      const begun = advanceChallenge(created, { sequence: 0, commandId: 'begin', command: { kind: 'begin' } });
      expect(begun.status === 'committed' && (content.category === 'table' ? begun.state.table?.round : begun.state.items.length)).toBe(content.category === 'table' ? 1 : content.length);
    }
  });
});
