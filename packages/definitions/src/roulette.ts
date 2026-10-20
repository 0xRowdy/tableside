// Roulette rule presets. Limits are the launch defaults (#3): inside 1-100,
// outside 10-1,000 units per placement. The double-zero preset and editable
// limits arrive with #62 and #72.

import type { RouletteRuleSet } from '@tableside/engine';

export const SINGLE_ZERO_ROULETTE: RouletteRuleSet = {
  id: 'roulette-single-zero',
  version: 1,
  wheel: 'single-zero',
  limits: { inside: { min: '1', max: '100' }, outside: { min: '10', max: '1000' } },
};
