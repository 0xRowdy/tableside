// Spec 1 S1-03

import { decodeMoney, INSURANCE_TARGET, type BlackjackPermittedView } from '@tableside/engine';

import type { PlacedWager, WagerCatalog } from './bet-selector/catalog';
import { formatUnits } from './units';

const HAND = 'hand-1';
const COMMITTED_REASON = 'In play until the hand settles.';

export function blackjackCatalog(view: BlackjackPermittedView): WagerCatalog {
  const offer = view.insuranceOffer;
  if (offer) {
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
