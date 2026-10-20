// The blackjack table's wager catalog for the bet selector (design frame
// S1-03 "Blackjack — no wagers"): the one initial wager on the learner's box.
// Doubles (and, with #70, splits and insurance) are decisions during the hand,
// not catalog wagers.

import type { BlackjackPermittedView } from '@tableside/engine';

import type { PlacedWager, WagerCatalog } from './bet-selector/catalog';
import { formatUnits } from './units';

const HAND = 'hand-1';
const COMMITTED_REASON = 'In play until the hand settles.';

export function blackjackCatalog(view: BlackjackPermittedView): WagerCatalog {
  const { min, max } = view.table.initial;
  return {
    sections: [
      {
        title: `Initial wager · ${formatUnits(min)} to ${formatUnits(max)}`,
        kinds: [
          {
            id: 'initial',
            name: 'Initial wager',
            detail: `Main box · blackjack pays ${view.table.blackjackPays}. Doubles are offered as decisions during the hand.`,
            choiceLabel: 'Box',
            choices: [{ target: HAND, label: 'Main box', name: 'Initial wager', min, max, step: '1', payout: '1:1' }],
          },
        ],
      },
    ],
  };
}

export function blackjackPlacedWagers(view: BlackjackPermittedView): PlacedWager[] {
  return view.wagers.map((wager) =>
    view.wagersCommitted
      ? { target: wager.target, amount: wager.amount, committed: true, committedReason: COMMITTED_REASON }
      : { target: wager.target, amount: wager.amount, committed: false },
  );
}
