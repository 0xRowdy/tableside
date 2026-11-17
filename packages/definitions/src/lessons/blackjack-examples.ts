// Spec 3 Lessons › Structure (worked examples); #152; #155
// docs/research/blackjack-lessons.md
import type { StrategyStepExample, StrategyStepExplanation } from '../strategy-examples';

const HAND = { target: 'hand-1', amount: '10' } as const;

const ELEVEN_V6: StrategyStepExplanation = {
  cell: {
    hand: 11,
    kind: 'hard',
    play: 'double',
    table: 'first',
    up: 6,
  },
  deviation: null,
  ifUnaffordable: {
    fallback: 'hit',
    play: 'double',
  },
  kind: 'play',
  preferred: 'double',
  prescribed: {
    action: 'double',
    amount: null,
  },
  situation: {
    available: '990',
    cards: [
      {
        deck: 0,
        rank: 6,
        suit: 'clubs',
      },
      {
        deck: 0,
        rank: 5,
        suit: 'clubs',
      },
    ],
    count: null,
    decision: 'hand',
    hand: 0,
    hands: 1,
    original: true,
    pair: false,
    stake: '10',
    target: 'hand-1',
    total: {
      soft: false,
      value: 11,
    },
    up: {
      deck: 0,
      rank: 6,
      suit: 'diamonds',
    },
  },
  unavailable: [],
};

export const BASICS_EXAMPLE: StrategyStepExample = {
  kind: 'strategy-step',
  step: 4,
  game: 'blackjack',
  strategy: 'basic',
  parameters: {},
  table: 'S17_LS',
  practiceFunding: '1000',
  turns: [
    { wagers: [HAND], outcome: { shown: [], dealt: [6, 6, 5, 10] } },
  ],
  choices: [
    { answer: {
      kind: 'play',
      move: {
        action: 'hit',
        amount: null,
      },
    }, response: { correct: false, explanation: ELEVEN_V6, note: 'Hitting is allowed, but basic strategy doubles 11 against a 6: one more card for a second bet of 10.' } },
    { answer: {
      kind: 'play',
      move: {
        action: 'stand',
        amount: null,
      },
    }, response: { correct: false, explanation: ELEVEN_V6, note: 'No card can bust 11, so standing gives up a free draw.' } },
    { answer: {
      kind: 'play',
      move: {
        action: 'double',
        amount: null,
      },
    }, response: { correct: true, explanation: ELEVEN_V6, note: null } },
  ],
};

const SIXTEEN_V10: StrategyStepExplanation = {
  cell: {
    hand: 16,
    kind: 'hard',
    play: 'surrender',
    table: 'first',
    up: 10,
  },
  deviation: null,
  ifUnaffordable: null,
  kind: 'play',
  preferred: 'surrender',
  prescribed: {
    action: 'surrender',
    amount: null,
  },
  situation: {
    available: '990',
    cards: [
      {
        deck: 0,
        rank: 9,
        suit: 'clubs',
      },
      {
        deck: 0,
        rank: 7,
        suit: 'clubs',
      },
    ],
    count: null,
    decision: 'hand',
    hand: 0,
    hands: 1,
    original: true,
    pair: false,
    stake: '10',
    target: 'hand-1',
    total: {
      soft: false,
      value: 16,
    },
    up: {
      deck: 0,
      rank: 10,
      suit: 'clubs',
    },
  },
  unavailable: [],
};

export const BASIC_STRATEGY_EXAMPLE: StrategyStepExample = {
  kind: 'strategy-step',
  step: 2,
  game: 'blackjack',
  strategy: 'basic',
  parameters: {},
  table: 'S17_LS',
  practiceFunding: '1000',
  turns: [
    { wagers: [HAND], outcome: { shown: [], dealt: [9, 10, 7, 9] } },
  ],
  choices: [
    { answer: {
      kind: 'play',
      move: {
        action: 'hit',
        amount: null,
      },
    }, response: { correct: false, explanation: SIXTEEN_V10, note: 'Without late surrender basic strategy hits here, but at this table it surrenders a two-card 16 against a 10.' } },
    { answer: {
      kind: 'play',
      move: {
        action: 'stand',
        amount: null,
      },
    }, response: { correct: false, explanation: SIXTEEN_V10, note: 'Standing isn’t the basic play for 16 against a 10 at any table.' } },
    { answer: {
      kind: 'play',
      move: {
        action: 'surrender',
        amount: null,
      },
    }, response: { correct: true, explanation: SIXTEEN_V10, note: 'Surrender comes first in the order of decisions, and this table offers it.' } },
  ],
};

const SIXTEEN_V10_AT_PLUS_ONE: StrategyStepExplanation = {
  cell: {
    hand: 16,
    kind: 'hard',
    play: 'hit',
    table: 'first',
    up: 10,
  },
  deviation: {
    atOrAbove: 'stand',
    below: 'hit',
    direction: 'deviate-at-or-above',
    hand: {
      kind: 'hard',
      total: 16,
    },
    id: 'S17 16 vs 10',
    play: 'stand',
    published: {
      bja: {
        cost: [],
        difference: null,
        value: '0+',
      },
      schlesinger: {
        cost: [
          {
            perBet: '+0.0000',
            trueCount: 0,
          },
        ],
        difference: 1,
        value: '+0',
      },
    },
    set: 'illustrious18',
    side: 'at-or-above',
    situation: '16 vs 10',
    threshold: 1,
    up: 10,
  },
  ifUnaffordable: null,
  kind: 'play',
  preferred: 'stand',
  prescribed: {
    action: 'stand',
    amount: null,
  },
  situation: {
    available: '990',
    cards: [
      {
        deck: 0,
        rank: 9,
        suit: 'clubs',
      },
      {
        deck: 0,
        rank: 7,
        suit: 'clubs',
      },
    ],
    count: {
      decks: '6',
      running: 7,
      trueCount: 1,
    },
    decision: 'hand',
    hand: 0,
    hands: 1,
    original: true,
    pair: false,
    stake: '10',
    target: 'hand-1',
    total: {
      soft: false,
      value: 16,
    },
    up: {
      deck: 0,
      rank: 10,
      suit: 'clubs',
    },
  },
  unavailable: [],
};

export const DEVIATIONS_EXAMPLE: StrategyStepExample = {
  kind: 'strategy-step',
  step: 3,
  game: 'blackjack',
  strategy: 'basic-with-deviations',
  parameters: {},
  table: 'S17_noLS',
  practiceFunding: '1000',
  turns: [
    { wagers: [HAND], outcome: { shown: [2, 3, 4, 5, 6, 2, 3, 4], dealt: [9, 10, 7, 9] } },
  ],
  choices: [
    { answer: {
      kind: 'play',
      move: {
        action: 'hit',
        amount: null,
      },
    }, response: { correct: false, explanation: SIXTEEN_V10_AT_PLUS_ONE, note: 'Hitting is the basic play. The supplied true count is +1, which reaches the index, so you stand.' } },
    { answer: {
      kind: 'play',
      move: {
        action: 'stand',
        amount: null,
      },
    }, response: { correct: true, explanation: SIXTEEN_V10_AT_PLUS_ONE, note: 'The supplied count is +7 running with 6 decks left: a true count of +1, the index for 16 against a 10.' } },
  ],
};

const TWELVE_V3_AT_PLUS_TWO: StrategyStepExplanation = {
  cell: {
    hand: 12,
    kind: 'hard',
    play: 'hit',
    table: 'first',
    up: 3,
  },
  deviation: null,
  ifUnaffordable: null,
  kind: 'play',
  preferred: 'hit',
  prescribed: {
    action: 'hit',
    amount: null,
  },
  situation: {
    available: '990',
    cards: [
      {
        deck: 0,
        rank: 10,
        suit: 'clubs',
      },
      {
        deck: 0,
        rank: 2,
        suit: 'spades',
      },
    ],
    count: null,
    decision: 'hand',
    hand: 0,
    hands: 1,
    original: true,
    pair: false,
    stake: '10',
    target: 'hand-1',
    total: {
      soft: false,
      value: 12,
    },
    up: {
      deck: 0,
      rank: 3,
      suit: 'hearts',
    },
  },
  unavailable: [],
};

export const COUNTING_BASIC_EXAMPLE: StrategyStepExample = {
  kind: 'strategy-step',
  step: 4,
  game: 'blackjack',
  strategy: 'counting-with-basic',
  parameters: {},
  table: 'S17_LS',
  practiceFunding: '1000',
  turns: [
    { wagers: [HAND], outcome: { shown: [2, 3, 4, 5, 6, 2, 3, 4, 5, 6, 2], dealt: [10, 3, 2, 9] } },
  ],
  choices: [
    { answer: {
      kind: 'play',
      move: {
        action: 'hit',
        amount: null,
      },
    }, response: { correct: true, explanation: TWELVE_V3_AT_PLUS_TWO, note: 'The running count is +12 with 5.5 decks left, a true count of +2, but this mode plays basic strategy at every count.' } },
    { answer: {
      kind: 'play',
      move: {
        action: 'stand',
        amount: null,
      },
    }, response: { correct: false, explanation: TWELVE_V3_AT_PLUS_TWO, note: 'With deviations, 12 against a 3 stands at +2. In Counting with basic the count never changes a play, so you hit.' } },
  ],
};

const THIRTEEN_V2_AT_ZERO: StrategyStepExplanation = {
  cell: {
    hand: 13,
    kind: 'hard',
    play: 'stand',
    table: 'first',
    up: 2,
  },
  deviation: {
    atOrAbove: 'stand',
    below: 'hit',
    direction: 'basic-at-or-above',
    hand: {
      kind: 'hard',
      total: 13,
    },
    id: 'S17 13 vs 2',
    play: 'stand',
    published: {
      bja: {
        cost: [],
        difference: 0,
        value: '-1-',
      },
      schlesinger: {
        cost: [
          {
            perBet: '+0.0072',
            trueCount: -1,
          },
        ],
        difference: 1,
        value: '-1',
      },
    },
    set: 'illustrious18',
    side: 'at-or-above',
    situation: '13 vs 2',
    threshold: 0,
    up: 2,
  },
  ifUnaffordable: null,
  kind: 'play',
  preferred: 'stand',
  prescribed: {
    action: 'stand',
    amount: null,
  },
  situation: {
    available: '990',
    cards: [
      {
        deck: 0,
        rank: 10,
        suit: 'hearts',
      },
      {
        deck: 0,
        rank: 3,
        suit: 'clubs',
      },
    ],
    count: {
      decks: '6',
      running: -1,
      trueCount: 0,
    },
    decision: 'hand',
    hand: 0,
    hands: 1,
    original: true,
    pair: false,
    stake: '10',
    target: 'hand-1',
    total: {
      soft: false,
      value: 13,
    },
    up: {
      deck: 0,
      rank: 2,
      suit: 'clubs',
    },
  },
  unavailable: [],
};

export const COUNTING_DEVIATIONS_EXAMPLE: StrategyStepExample = {
  kind: 'strategy-step',
  step: 3,
  game: 'blackjack',
  strategy: 'counting-with-deviations',
  parameters: {},
  table: 'S17_LS',
  practiceFunding: '1000',
  turns: [
    { wagers: [HAND], outcome: { shown: [10, 10], dealt: [10, 2, 3, 9] } },
  ],
  choices: [
    { answer: {
      kind: 'play',
      move: {
        action: 'hit',
        amount: null,
      },
    }, response: { correct: false, explanation: THIRTEEN_V2_AT_ZERO, note: 'A running count of −1 with 6 decks left truncates to a true count of 0, not −1, and 13 against a 2 stands at 0 or higher.' } },
    { answer: {
      kind: 'play',
      move: {
        action: 'stand',
        amount: null,
      },
    }, response: { correct: true, explanation: THIRTEEN_V2_AT_ZERO, note: 'Truncating toward zero makes −1 ÷ 6 a true count of 0, so the basic stand holds.' } },
  ],
};

const BET_AT_PLUS_ONE: StrategyStepExplanation = {
  fallback: null,
  instructions: [
    {
      id: 'true-count-1',
      label: 'True count +1: 20',
    },
  ],
  prescription: {
    bets: [
      {
        amount: '20',
        target: 'hand-1',
      },
    ],
    held: [],
    status: 'prescribed',
  },
  situation: {
    available: '990',
    subjects: {
      'last-result': 'loss',
    },
    values: {
      'true-count': '1',
    },
  },
  state: {
    counters: {},
    cycleTurn: 1,
    lastResult: 'loss',
    lists: {},
  },
};

export const BET_SCHEDULE_EXAMPLE: StrategyStepExample = {
  kind: 'strategy-step',
  step: 1,
  game: 'blackjack',
  strategy: 'counting-with-basic',
  parameters: {
    'bet-schedule': 'on',
  },
  table: 'S17_LS',
  practiceFunding: '1000',
  turns: [
    { wagers: [HAND], outcome: { shown: [], dealt: [2, 6, 3, 5, 4, 2, 4, 2] } },
  ],
  choices: [
    { answer: {
      kind: 'bets',
      bets: [
        {
          target: 'hand-1',
          amount: '10',
        },
      ],
    }, response: { correct: false, explanation: BET_AT_PLUS_ONE, note: '10 is the bet below +1. After this round the true count is +1.' } },
    { answer: {
      kind: 'bets',
      bets: [
        {
          target: 'hand-1',
          amount: '20',
        },
      ],
    }, response: { correct: true, explanation: BET_AT_PLUS_ONE, note: 'Eight low cards make the running count +8 with 6 decks left: a true count of +1.' } },
    { answer: {
      kind: 'bets',
      bets: [
        {
          target: 'hand-1',
          amount: '40',
        },
      ],
    }, response: { correct: false, explanation: BET_AT_PLUS_ONE, note: '40 is the bet at +2.' } },
  ],
};
