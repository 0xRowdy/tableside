// The engine's cross-runtime suite. It runs on Node, iOS Hermes and Android
// Hermes, and the harness compares every case's outputs across them, so cases
// must be synchronous and deterministic. Every engine ticket adds its cases here.
import type { Suite } from '@tableside/harness';

import { activityCases } from './activity.cases';
import { blackjackCases } from './blackjack.cases';
import { blackjackGuidedCases } from './blackjack-guided.cases';
import { blackjackTableCases } from './blackjack-table.cases';
import { crapsCases } from './craps.cases';
import { crapsMenuCases } from './craps-menu.cases';
import { drawCases } from './draws.cases';
import { engineCases } from './engine.cases';
import { fundingCases } from './funding.cases';
import { hashCases } from './hash.cases';
import { moneyCases } from './money.cases';
import { randomCases } from './random.cases';
import { rouletteCases } from './roulette.cases';
import { runtimeCases } from './runtime.cases';
import { strategyCases } from './strategy.cases';
import { guidedCases } from './guided.cases';

export const engineSuite: Suite = {
  name: 'engine',
  cases: [
    ...runtimeCases,
    ...engineCases,
    ...randomCases,
    ...drawCases,
    ...moneyCases,
    ...hashCases,
    ...activityCases,
    ...fundingCases,
    ...rouletteCases,
    ...crapsCases,
    ...crapsMenuCases,
    ...blackjackCases,
    ...blackjackTableCases,
    ...strategyCases,
    ...guidedCases,
    ...blackjackGuidedCases,
  ],
};
