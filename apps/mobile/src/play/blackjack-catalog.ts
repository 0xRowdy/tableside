// The blackjack table's wager catalog for the bet selector (design frame
// S1-03 "Blackjack — no wagers"): the one initial wager on the learner's box.
// Doubles and splits are decisions during the hand, not catalog wagers. While
// insurance is offered the catalog holds only the insurance wager, so a lower
// amount than the decision panel's half can be chosen (frame "insurance
// offered").

import { decodeMoney, INSURANCE_TARGET, type BlackjackPermittedView } from '@tableside/engine';

import type { PlacedWager, WagerCatalog } from './bet-selector/catalog';
import { formatUnits } from './units';

const HAND = 'hand-1';
const COMMITTED_REASON = 'In play until the hand settles.';

export function blackjackCatalog(view: BlackjackPermittedView): WagerCatalog {
  const offer = view.insuranceOffer;
  if (offer) {
    // Whole units here; exactly half (when that is a half unit) is the panel's "Insure" button.
    const whole = decodeMoney(offer.max);
    const max = (whole.n / whole.d).toString();
    return {
      sections: [
        {
          title: `Insurance · up to ${formatUnits(offer.max)}`,
          kinds: [
            {
              id: 'insurance',
              name: 'Insurance',
              detail: 'Pays 2:1 if the dealer has blackjack; settles separately from your hand, before play goes on.',
              choiceLabel: 'Wager',
              choices: [{ target: INSURANCE_TARGET, label: 'Insurance', name: 'Insurance', min: '1', max, step: '1', payout: '2:1' }],
            },
          ],
        },
      ],
    };
  }
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
