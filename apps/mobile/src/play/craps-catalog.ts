// Craps's wager catalog for the bet selector, built from the engine's
// permitted view: the line bets the puck allows now and the odds each
// established bet can take, with their limits, increments and payouts.

import type { CrapsPermittedView as PermittedView } from '@tableside/engine';

import type { PlacedWager, WagerCatalog, WagerChoice, WagerKind } from './bet-selector/catalog';
import { commitmentText, crapsTargetName, workingText } from './craps-text';
import { formatUnits } from './units';

type Placement = PermittedView['table']['placements'][number];

const choice = (placement: Placement): WagerChoice => ({
  target: placement.target,
  label: crapsTargetName(placement.target),
  name: crapsTargetName(placement.target),
  min: placement.min,
  max: placement.max,
  step: placement.increment,
  payout: placement.payout,
});

export function crapsCatalog(view: PermittedView): WagerCatalog {
  const { placements, limits, point } = view.table;
  const line = placements.filter((p) => p.kind === 'line');
  const odds = placements.filter((p) => p.kind === 'odds');
  const kinds: WagerKind[] = [];
  if (line.length > 0) {
    kinds.push({
      id: 'line',
      name: point === null ? 'Pass line and don’t pass' : 'Come and don’t come',
      detail: point === null ? 'Made before a come-out roll · pays 1:1' : 'Travel to the next number rolled · pays 1:1',
      choiceLabel: 'Bet',
      choices: line.map(choice),
    });
  }
  if (odds.length > 0) {
    kinds.push({
      id: 'odds',
      name: 'Odds',
      detail: 'Behind an established bet · true odds, no commission',
      choiceLabel: 'Behind',
      choices: odds.map(choice),
    });
  }
  return {
    sections: [{ title: `Line bets · ${formatUnits(limits.line.min)} to ${formatUnits(limits.line.max)} · odds ${view.table.odds}`, kinds }],
  };
}

const ROLLING = 'Committed to this roll until it settles. It can’t be changed or taken down.';

/** The wagers on the table, for the selector: contracts stay committed and say why, with their working status. */
export function crapsPlacedWagers(view: PermittedView): PlacedWager[] {
  return view.wagers.map((wager) => {
    const status = view.table.wagers.find((item) => item.target === wager.target);
    const working = `${workingText(view, wager.target)}.`;
    const placed = { target: wager.target, amount: wager.amount, name: crapsTargetName(wager.target) };
    if (view.wagersCommitted) return { ...placed, committed: true, committedReason: `${ROLLING} ${working}` };
    if (status?.removable === false) return { ...placed, committed: true, committedReason: `${working} ${commitmentText(wager.target, view.table.point)}` };
    return { ...placed, committed: false };
  });
}
