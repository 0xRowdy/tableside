// Roulette's wager catalog for the bet selector, built from the engine's
// permitted view: every placement the layout offers, grouped by kind under the
// inside and outside limits (design frame "S1-03 Bet selector — Roulette ·
// choose a wager"), plus "Find by number", which lists every inside bet
// covering a number (the design's bet loupe, "Wagers on 17").

import type { PermittedView, PlacementKind, RoulettePocket } from '@tableside/engine';

import type { PlacedWager, WagerCatalog, WagerChoice, WagerKind } from './bet-selector/catalog';
import { ORDINAL, targetName, wheelZeros } from './roulette-text';
import { formatUnits } from './units';

type Placement = PermittedView['table']['placements'][number];
type Wheel = PermittedView['table']['wheel'];

interface KindDescriptor {
  readonly name: string;
  readonly choiceLabel: string;
  /** The line under the name, given the payout text ("pays 35:1"). */
  readonly detail: (pays: string, wheel: Wheel) => string;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const losesOnZero = (pays: string, wheel: Wheel) => `${capitalize(pays)} · loses on ${wheel === 'double-zero' ? '0 and 00' : '0'}`;

type Paired = 'red' | 'black' | 'odd' | 'even' | 'low' | 'high';
type KindId = Exclude<PlacementKind, Paired> | 'red-black' | 'odd-even' | 'low-high';

/** The selector's kinds; paired outside bets share one ("Red or black"). Order follows the design. */
const KINDS: Readonly<Record<KindId, KindDescriptor>> = {
  straight: { name: 'Straight up', choiceLabel: 'Number', detail: (pays) => `1 number · ${pays}` },
  split: { name: 'Split', choiceLabel: 'Two neighbors', detail: (pays) => `2 neighbors · ${pays}` },
  street: { name: 'Street', choiceLabel: 'Row', detail: (pays) => `Row of 3 · ${pays}` },
  trio: {
    name: 'Trio',
    choiceLabel: 'Numbers',
    detail: (pays, wheel) => `${wheel === 'double-zero' ? '0-00-2, 0-1-2 or 00-2-3' : '0-1-2 or 0-2-3'} · ${pays}`,
  },
  corner: { name: 'Corner', choiceLabel: 'Block', detail: (pays) => `Block of 4 · ${pays}` },
  'six-line': { name: 'Six line', choiceLabel: 'Rows', detail: (pays) => `2 rows · ${pays}` },
  'first-four': { name: 'First four', choiceLabel: 'Numbers', detail: (pays) => `0, 1, 2, 3 · ${pays}` },
  basket: { name: 'Five-number basket', choiceLabel: 'Numbers', detail: (pays) => `0, 00, 1, 2, 3 · ${pays}` },
  'red-black': { name: 'Red or black', choiceLabel: 'Color', detail: losesOnZero },
  'odd-even': { name: 'Odd or even', choiceLabel: 'Choice', detail: losesOnZero },
  'low-high': { name: '1–18 or 19–36', choiceLabel: 'Half', detail: losesOnZero },
  dozen: { name: 'Dozen', choiceLabel: 'Dozen', detail: capitalize },
  column: { name: 'Column', choiceLabel: 'Column', detail: capitalize },
};

const PAIRED: Readonly<Record<Paired, KindId>> = {
  red: 'red-black',
  black: 'red-black',
  odd: 'odd-even',
  even: 'odd-even',
  low: 'low-high',
  high: 'low-high',
};

const isPaired = (kind: PlacementKind): kind is Paired => kind in PAIRED;
const kindId = (kind: PlacementKind): KindId => (isPaired(kind) ? PAIRED[kind] : kind);

const OUTSIDE_LABELS: Partial<Record<string, string>> = { low: '1–18', high: '19–36' };

/** A choice's short label: "17", "16 | 17", "16 · 17 · 18", "13–18", "1st 12". */
function choiceLabel(placement: Placement): string {
  const { kind, covers, target } = placement;
  switch (kind) {
    case 'straight':
      return String(covers[0]);
    case 'split':
      return covers.join(' | ');
    case 'six-line':
      return `${covers[0]}–${covers.at(-1)}`;
    case 'dozen':
      return `${ORDINAL[Math.ceil((covers[0] as number) / 12) - 1]} 12`;
    case 'column':
      return `${ORDINAL[(covers[0] as number) - 1]} column`;
    default:
      return placement.limitClass === 'inside' ? covers.join(' · ') : (OUTSIDE_LABELS[target] ?? targetName(target));
  }
}

const SECTION_TITLES = { inside: 'Inside bets', outside: 'Outside bets' } as const;

export function rouletteCatalog(view: PermittedView): WagerCatalog {
  const { wheel } = view.table;
  const sections = (['inside', 'outside'] as const).map((limitClass) => {
    const placements = view.table.placements.filter((p) => p.limitClass === limitClass);
    const kinds = new Map<KindId, { payouts: Set<string>; choices: WagerChoice[] }>();
    for (const placement of placements) {
      const id = kindId(placement.kind);
      const entry = kinds.get(id) ?? { payouts: new Set<string>(), choices: [] };
      kinds.set(id, entry);
      entry.payouts.add(placement.payout);
      entry.choices.push(choiceFor(placement));
    }
    const first = placements[0];
    const order = Object.keys(KINDS) as KindId[];
    return {
      title: first ? `${SECTION_TITLES[limitClass]} · ${formatUnits(first.min)} to ${formatUnits(first.max)}` : SECTION_TITLES[limitClass],
      kinds: [...kinds]
        .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
        .map(([id, { payouts, choices }]): WagerKind => {
          const descriptor = KINDS[id];
          return {
            id,
            name: descriptor.name,
            choiceLabel: descriptor.choiceLabel,
            detail: descriptor.detail(`pays ${[...payouts].join(' or ')}`, wheel),
            choices,
          };
        }),
    };
  });

  const pockets: RoulettePocket[] = [...wheelZeros(wheel), ...Array.from({ length: 36 }, (_, i) => i + 1)];
  const inside = view.table.placements.filter((p) => p.limitClass === 'inside');
  return {
    sections: sections.filter((section) => section.kinds.length > 0),
    finder: {
      name: 'Find by number',
      detail: 'Every inside bet that covers a number',
      keyLabel: 'Number',
      keys: pockets.map((pocket) => ({
        id: String(pocket),
        label: String(pocket),
        title: `Wagers on ${pocket}`,
        targets: inside.filter((p) => p.covers.includes(pocket)).map((p) => p.target),
      })),
    },
  };
}

function choiceFor(placement: Placement): WagerChoice {
  return {
    target: placement.target,
    label: choiceLabel(placement),
    name: targetName(placement.target),
    min: placement.min,
    max: placement.max,
    // Roulette stakes are whole units.
    step: '1',
    payout: placement.payout,
  };
}

const COMMITTED_REASON = 'Committed to this spin until it settles. It can’t be changed or taken down.';

/** The wagers on the table, for the selector: all removable between spins, all committed during one. */
export function roulettePlacedWagers(view: PermittedView): PlacedWager[] {
  return view.wagers.map((wager) =>
    view.wagersCommitted
      ? { target: wager.target, amount: wager.amount, committed: true, committedReason: COMMITTED_REASON }
      : { target: wager.target, amount: wager.amount, committed: false },
  );
}
