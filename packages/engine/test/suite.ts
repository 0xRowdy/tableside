// docs/cross-runtime-harness.md Adding cases
import type { Suite } from '@tableside/harness';

import { activityCases } from './activity.cases';
import { blackjackCases } from './blackjack.cases';
import { blackjackGuidedCases } from './blackjack-guided.cases';
import { blackjackTableCases } from './blackjack-table.cases';
import { challengeCases } from './challenge.cases';
import { compatibilityCases } from './compatibility.cases';
import { conversionCases } from './conversion.cases';
import { countingCases } from './counting.cases';
import { crapsCases } from './craps.cases';
import { crapsMenuCases } from './craps-menu.cases';
import { crapsStrategyCases } from './craps-strategy.cases';
import { drawCases } from './draws.cases';
import { engineCases } from './engine.cases';
import { fundingCases } from './funding.cases';
import { hashCases } from './hash.cases';
import { limitCases } from './limits.cases';
import { moneyCases } from './money.cases';
import { randomCases } from './random.cases';
import { recordCases } from './record.cases';
import { rouletteCases } from './roulette.cases';
import { runningCountCases } from './running-count.cases';
import { runtimeCases } from './runtime.cases';
import { standardizedCases } from './standardized.cases';
import { strategyCases } from './strategy.cases';
import { tableCases } from './table.cases';
import { guidedCases } from './guided.cases';
import { progressionCases } from './progression.cases';

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
    ...limitCases,
    ...rouletteCases,
    ...crapsCases,
    ...crapsMenuCases,
    ...blackjackCases,
    ...blackjackTableCases,
    ...strategyCases,
    ...guidedCases,
    ...blackjackGuidedCases,
    ...countingCases,
    ...progressionCases,
    ...crapsStrategyCases,
    ...recordCases,
    ...compatibilityCases,
    ...standardizedCases,
    ...challengeCases,
    ...runningCountCases,
    ...conversionCases,
    ...tableCases,
  ],
};
