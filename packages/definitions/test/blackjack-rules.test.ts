import { createActivity, RANDOM_PROTOCOL_VERSION } from '@tableside/engine';
import { describe, expect, it } from 'vitest';

import { BLACKJACK_PRESETS, blackjackRules, DEFAULT_BLACKJACK_PRESET } from '../src/index';

// Launch rules (#3 / spec #51): six decks; S17/H17 x late surrender on/off,
// default S17 + LS; penetration 50-80% in 5% steps, default 75%; initial wager 10/1,000.
describe('blackjack rule presets', () => {
  it('defaults to S17 with late surrender, 75% penetration and initial-wager limits 10/1,000', () => {
    expect(DEFAULT_BLACKJACK_PRESET).toBe('S17_LS');
    expect(blackjackRules()).toEqual({
      id: 'blackjack-six-deck',
      version: 1,
      decks: 6,
      dealer: 'S17',
      lateSurrender: true,
      penetration: 75,
      limits: { initial: { min: '10', max: '1000' } },
      players: { learnerSeat: 0, otherWagers: [], strategy: null },
    });
  });

  it('maps each preset to its dealer rule and surrender option', () => {
    expect(BLACKJACK_PRESETS.map((preset) => [preset, blackjackRules(preset).dealer, blackjackRules(preset).lateSurrender])).toEqual([
      ['S17_LS', 'S17', true],
      ['S17_noLS', 'S17', false],
      ['H17_LS', 'H17', true],
      ['H17_noLS', 'H17', false],
    ]);
  });

  it('every preset at every penetration is a rule set the engine runs', () => {
    const random = { protocol: RANDOM_PROTOCOL_VERSION, key: [1, 2], session: [3, 4] } as const;
    for (const preset of BLACKJACK_PRESETS) {
      for (const penetration of [50, 55, 60, 65, 70, 75, 80]) {
        const rules = blackjackRules(preset, penetration, penetration % 4);
        const state = createActivity({ activityId: 'a', owner: 'o', device: 'd', game: 'blackjack', rules, strategy: null, reference: null, fundingSource: 'practice-funding', funding: '1000' }, random);
        expect(state.rules.penetration).toBe(penetration);
      }
    }
  });
});
