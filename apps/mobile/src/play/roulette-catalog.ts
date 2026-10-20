// Roulette's wager catalog for the bet selector, built from the engine's
// permitted view: every placement the layout offers, grouped by kind under the
// inside and outside limits. Placements of a kind this file doesn't name yet
// still appear, under a name derived from their target id.

import type { RoulettePermittedView as PermittedView } from '@tableside/engine';

import type { PlacedWager, WagerCatalog, WagerChoice, WagerKind } from './bet-selector/catalog';
import { targetName } from './roulette-text';
import { formatUnits } from './units';

type Placement = PermittedView['table']['placements'][number];

interface KindDescriptor {
  readonly id: string;
  readonly name: string;
  readonly choiceLabel: string;
  /** The line under the name, given the payout text ("pays 35:1"). */
  readonly detail: (pays: string) => string;
  /** The choice's short label. */
  readonly label: string;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Kinds this file names. */
const KNOWN: readonly { pattern: RegExp; describe: (target: string) => KindDescriptor }[] = [
  {
    pattern: /^straight-\d+$/,
    describe: (target) => ({
      id: 'straight',
      name: 'Straight up',
      choiceLabel: 'Number',
      detail: (pays) => `1 number · ${pays}`,
      label: target.slice('straight-'.length),
    }),
  },
  {
    pattern: /^(red|black)$/,
    describe: (target) => ({
      id: 'red-black',
      name: 'Red or black',
      choiceLabel: 'Color',
      detail: (pays) => `${capitalize(pays)} · loses on 0`,
      label: targetName(target),
    }),
  },
];

/** A kind not named above, from its target id: "split-17-18" → kind "Split", label "17–18". */
function describeUnknown(target: string): KindDescriptor {
  const id = target.replace(/(-\d+)+$/, '');
  const numbers = target.slice(id.length + 1);
  const name = capitalize(id.replace(/-/g, ' '));
  return { id, name, choiceLabel: 'Numbers', detail: capitalize, label: numbers ? numbers.replace(/-/g, '–') : name };
}

const describe = (target: string): KindDescriptor =>
  (KNOWN.find((known) => known.pattern.test(target))?.describe ?? describeUnknown)(target);

const SECTION_TITLES = { inside: 'Inside bets', outside: 'Outside bets' } as const;

export function rouletteCatalog(view: PermittedView): WagerCatalog {
  const sections = (['inside', 'outside'] as const).map((limitClass) => {
    const placements = view.table.placements.filter((p) => p.limitClass === limitClass);
    const kinds = new Map<string, { descriptor: KindDescriptor; payouts: Set<string>; choices: WagerChoice[] }>();
    for (const placement of placements) {
      const descriptor = describe(placement.target);
      const entry = kinds.get(descriptor.id) ?? { descriptor, payouts: new Set<string>(), choices: [] };
      kinds.set(descriptor.id, entry);
      entry.payouts.add(placement.payout);
      entry.choices.push(choiceFor(placement, descriptor.label));
    }
    const first = placements[0];
    return {
      title: first ? `${SECTION_TITLES[limitClass]} · ${formatUnits(first.min)} to ${formatUnits(first.max)}` : SECTION_TITLES[limitClass],
      kinds: [...kinds.values()].map(
        ({ descriptor, payouts, choices }): WagerKind => ({
          id: descriptor.id,
          name: descriptor.name,
          choiceLabel: descriptor.choiceLabel,
          detail: descriptor.detail(`pays ${[...payouts].join(' or ')}`),
          choices,
        }),
      ),
    };
  });
  return { sections: sections.filter((section) => section.kinds.length > 0) };
}

function choiceFor(placement: Placement, label: string): WagerChoice {
  return {
    target: placement.target,
    label,
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
