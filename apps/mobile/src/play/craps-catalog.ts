// Craps's wager catalog for the bet selector, built from the engine's
// permitted view: every wager the table offers now (line bets the puck
// allows, odds behind established bets, place, buy, lay, field, hardways,
// propositions and the horn) with their limits, increments, payouts and the
// house edge of these rules.

import { crapsHouseEdge, type CrapsWager } from '@tableside/definitions';
import type { CrapsPermittedView as PermittedView } from '@tableside/engine';

import type { PlacedWager, WagerCatalog, WagerChoice, WagerKind } from './bet-selector/catalog';
import { commitmentText, crapsTargetName, workingText, workingToggle } from './craps-text';
import { formatUnits } from './units';

type Placement = PermittedView['table']['placements'][number];

/** Short chooser labels: the number for box bets and hardways, the name otherwise. */
const shortLabel = (target: string) => /^(place|buy|lay|hard)-(\d+)$/.exec(target)?.[2] ?? crapsTargetName(target);

/** The payout as the stake editor says it: the field and the horn pay differently by total. */
function payoutText(placement: Placement): string {
  if (placement.kind === 'horn') return '30:1 on 2 or 12, 15:1 on 3 or 11, per part';
  if (placement.kind === 'field') return '1:1, more on 2 and 12';
  return placement.payout;
}

function choice(placement: Placement): WagerChoice {
  const toggle = workingToggle(placement.target);
  return {
    target: placement.target,
    label: shortLabel(placement.target),
    name: crapsTargetName(placement.target),
    min: placement.min,
    max: placement.max,
    step: placement.increment,
    payout: payoutText(placement),
    ...(toggle ? { toggle } : {}),
  };
}

/** The value of a placed wager's working toggle: its instruction, else the usual come-out status. */
export function placedToggle(view: PermittedView, target: string): boolean | undefined {
  const toggle = workingToggle(target);
  const status = view.table.wagers.find((item) => item.target === target);
  return toggle && status ? (status.instruction ?? toggle.usual) : undefined;
}

/** "6·8 1.52% · 5·9 4.00% · 4·10 6.67%": the edge of a box family, number pairs sharing one value. */
function boxEdges(family: 'place' | 'buy' | 'lay', edge: (wager: CrapsWager) => string): string {
  return ([[6, 8], [5, 9], [4, 10]] as const).map(([a, b]) => `${a}·${b} ${edge(`${family}-${a}`)}%`).join(' · ');
}

/** Buy and lay edges at each number's minimum stake, where rounding the commission up costs the most. */
function minimumEdges(family: 'buy' | 'lay', placements: readonly Placement[], edge: (wager: CrapsWager, stake?: string) => string): string {
  return ([6, 5, 4] as const)
    .map((n) => {
      const min = placements.find((p) => p.target === `${family}-${n}`)?.min;
      return `${n === 6 ? '6·8' : n === 5 ? '5·9' : '4·10'} ${edge(`${family}-${n}`, min)}%`;
    })
    .join(' · ');
}

export function crapsCatalog(view: PermittedView): WagerCatalog {
  const { placements, limits, point, variant, odds, field } = view.table;
  const rules = { ...variant, odds, field };
  const edge = (wager: CrapsWager, stake?: string) => crapsHouseEdge(wager, rules, stake).percent;
  const of = (kind: Placement['kind']) => placements.filter((p) => p.kind === kind).map(choice);
  const kinds: WagerKind[] = [];
  const line = of('line');
  if (line.length > 0) {
    kinds.push({
      id: 'line',
      name: point === null ? 'Pass line and don’t pass' : 'Come and don’t come',
      detail: `${point === null ? 'Made before a come-out roll' : 'Travel to the next number rolled'} · pays 1:1 · edge ${edge('pass')}% and ${edge('dont-pass')}%`,
      choiceLabel: 'Bet',
      choices: line,
    });
  }
  const oddsChoices = of('odds');
  if (oddsChoices.length > 0) {
    kinds.push({ id: 'odds', name: 'Odds', detail: 'Behind an established bet · true odds, no commission · edge 0%', choiceLabel: 'Behind', choices: oddsChoices });
  }
  const twelve = field === 'triple-12' ? '3:1' : '2:1';
  return {
    sections: [
      { title: `Line bets · ${formatUnits(limits.flat.min)} to ${formatUnits(limits.flat.max)} · odds ${odds}`, kinds },
      {
        title: `Numbers and field · ${formatUnits(limits.flat.min)} to ${formatUnits(limits.flat.max)}`,
        kinds: [
          {
            id: 'place',
            name: 'Place',
            detail: `Pays 9:5, 7:5, 7:6 · 6 and 8 in multiples of 6, others in 5s · off on the come-out unless you turn it on · edge ${boxEdges('place', edge)}`,
            choiceLabel: 'Number',
            choices: of('place'),
          },
          {
            id: 'buy',
            name: 'Buy',
            detail: `True odds · 5% commission of the stake on wins, rounded up · off on the come-out unless you turn it on · edge ${boxEdges('buy', edge)}, at the minimum stake ${minimumEdges('buy', placements, edge)}`,
            choiceLabel: 'Number',
            choices: of('buy'),
          },
          {
            id: 'lay',
            name: 'Lay',
            detail: `Wins on 7 at true odds · 5% commission of the win, rounded up · works on the come-out · edge ${boxEdges('lay', edge)}, at the minimum stake ${minimumEdges('lay', placements, edge)}`,
            choiceLabel: 'Against',
            choices: of('lay'),
          },
          {
            id: 'field',
            name: 'Field',
            detail: `One roll · 2 pays 2:1, 12 pays ${twelve}, 3 4 9 10 11 pay 1:1 · edge ${edge('field')}%`,
            choiceLabel: 'Bet',
            choices: of('field'),
          },
        ],
      },
      {
        title: `Hardways and propositions · ${formatUnits(limits.props.min)} to ${formatUnits(limits.props.max)} per part`,
        kinds: [
          {
            id: 'hardway',
            name: 'Hardways',
            detail: `Hard 4·10 pays 7:1, 6·8 pays 9:1 · lose on 7 or the easy way · works on the come-out · edge 6·8 ${edge('hard-6')}% · 4·10 ${edge('hard-4')}%`,
            choiceLabel: 'Number',
            choices: of('hardway'),
          },
          {
            id: 'proposition',
            name: 'Propositions',
            detail: `One roll · 2·12 pay 30:1, 3·11 15:1, any craps 7:1, any seven 4:1 · horn in 4 equal parts · edge ${edge('prop-3')}–${edge('any-seven')}%`,
            choiceLabel: 'Bet',
            choices: [...of('proposition'), ...of('horn')],
          },
        ],
      },
    ],
  };
}

const ROLLING = 'Committed to this roll until it settles. It can’t be changed or taken down.';

/** The wagers on the table, for the selector: contracts stay committed and say why, with their working status. */
export function crapsPlacedWagers(view: PermittedView): PlacedWager[] {
  return view.wagers.map((wager) => {
    const status = view.table.wagers.find((item) => item.target === wager.target);
    const working = `${workingText(view, wager.target)}.`;
    const toggled = placedToggle(view, wager.target);
    const placed = { target: wager.target, amount: wager.amount, name: crapsTargetName(wager.target), ...(toggled === undefined ? {} : { toggled }) };
    if (view.wagersCommitted) return { ...placed, committed: true, committedReason: `${ROLLING} ${working}` };
    if (status?.removable === false) return { ...placed, committed: true, committedReason: `${working} ${commitmentText(wager.target, view.table.point)}` };
    return { ...placed, committed: false };
  });
}
