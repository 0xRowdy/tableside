// Copies of two shipped blackjack benchmark profiles and certified built-in
// strategies (S17 LS basic; H17 no-LS counting with deviations and the bet
// schedule), so the cross-runtime suite traces them; the engine can't import
// the definitions package. The runner's tests check these copies still equal
// the shipped data. Regenerate from the definitions package if they change.
import type { BenchmarkProfile, StrategyDefinition } from '../src';

export const CERTIFIED_BLACKJACK = {
 "S17_LS": {
  "profile": {
   "id": "benchmark-blackjack-S17_LS",
   "version": 1,
   "funding": "1000",
   "base": "10",
   "opportunities": 200,
   "finalSettlement": "complete",
   "game": "blackjack",
   "rules": {
    "id": "blackjack-six-deck",
    "version": 1,
    "decks": 6,
    "dealer": "S17",
    "lateSurrender": true,
    "penetration": 75,
    "limits": {
     "initial": {
      "min": "10",
      "max": "1000"
     }
    },
    "players": {
     "learnerSeat": 1,
     "otherWagers": [
      "10"
     ],
     "strategy": {
      "first": {
       "hard": [
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHDDDDHHHH",
        "HDDDDDDDDH",
        "HDDDDDDDDD",
        "HHHSSSHHHH",
        "HSSSSSHHHH",
        "HSSSSSHHHH",
        "HSSSSSHHHR",
        "RSSSSSHHRR",
        "SSSSSSSSSS",
        "SSSSSSSSSS",
        "SSSSSSSSSS",
        "SSSSSSSSSS"
       ],
       "soft": [
        "HHHHHDHHHH",
        "HHHHDDHHHH",
        "HHHHDDHHHH",
        "HHHDDDHHHH",
        "HHHDDDHHHH",
        "HHDDDDHHHH",
        "HSDDDDSSHH",
        "SSSSSSSSSS",
        "SSSSSSSSSS"
       ],
       "pair": [
        "PPPPPPPPPP",
        "HPPPPPPHHH",
        "HPPPPPPHHH",
        "HHHHPPHHHH",
        "HDDDDDDDDH",
        "HPPPPPHHHH",
        "HPPPPPPHHH",
        "PPPPPPPPPP",
        "SPPPPPSPPS",
        "SSSSSSSSSS"
       ]
      },
      "pairWithoutSurrender": [
       "PPPPPPPPPP",
       "HPPPPPPHHH",
       "HPPPPPPHHH",
       "HHHHPPHHHH",
       "HDDDDDDDDH",
       "HPPPPPHHHH",
       "HPPPPPPHHH",
       "PPPPPPPPPP",
       "SPPPPPSPPS",
       "SSSSSSSSSS"
      ],
      "pairAtCap": [
       "SSSSSSSSSS",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HDDDDDDDDH",
       "HHHSSSHHHH",
       "HSSSSSHHHH",
       "HSSSSSHHHH",
       "SSSSSSSSSS",
       "SSSSSSSSSS"
      ],
      "later": {
       "hard": [
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHDDDDHHHH",
        "HDDDDDDDDH",
        "HDDDDDDDDD",
        "HHHSSSHHHH",
        "HSSSSSHHHH",
        "HSSSSSHHHH",
        "HSSSSSHHHH",
        "HSSSSSHHHH",
        "SSSSSSSSSS",
        "SSSSSSSSSS",
        "SSSSSSSSSS",
        "SSSSSSSSSS",
        "SSSSSSSSSS"
       ],
       "soft": [
        "HHHHHDHHHH",
        "HHHHDDHHHH",
        "HHHHDDHHHH",
        "HHHDDDHHHH",
        "HHHDDDHHHH",
        "HHDDDDHHHH",
        "HSDDDDSSHH",
        "SSSSSSSSSS",
        "SSSSSSSSSS",
        "SSSSSSSSSS"
       ]
      },
      "laterWithoutDouble": {
       "hard": [
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHSSSHHHH",
        "HSSSSSHHHH",
        "HSSSSSHHHH",
        "HSSSSSHHHH",
        "HSSSSSHHHH",
        "SSSSSSSSSS",
        "SSSSSSSSSS",
        "SSSSSSSSSS",
        "SSSSSSSSSS",
        "SSSSSSSSSS"
       ],
       "soft": [
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HSSSSSSSHH",
        "SSSSSSSSSS",
        "SSSSSSSSSS",
        "SSSSSSSSSS"
       ]
      }
     }
    }
   },
   "reference": {
    "id": "blackjack-coaching-reference@9892826d10a6d377",
    "version": 1
   },
   "exposureBound": "5126500"
  },
  "strategy": {
   "format": 1,
   "id": "blackjack-basic-S17_LS",
   "revision": 1,
   "name": "Basic strategy",
   "game": "blackjack",
   "table": {
    "dealer": "S17",
    "lateSurrender": true,
    "limits": {
     "initial": {
      "min": "10",
      "max": "1000"
     }
    }
   },
   "parameters": [],
   "counters": [],
   "instructions": [],
   "adjustments": [],
   "stopWhen": null,
   "play": {
    "count": "none",
    "first": {
     "hard": [
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHDDDDHHHH",
      "HDDDDDDDDH",
      "HDDDDDDDDD",
      "HHHSSSHHHH",
      "HSSSSSHHHH",
      "HSSSSSHHHH",
      "HSSSSSHHHR",
      "RSSSSSHHRR",
      "SSSSSSSSSS",
      "SSSSSSSSSS",
      "SSSSSSSSSS",
      "SSSSSSSSSS"
     ],
     "soft": [
      "HHHHHDHHHH",
      "HHHHDDHHHH",
      "HHHHDDHHHH",
      "HHHDDDHHHH",
      "HHHDDDHHHH",
      "HHDDDDHHHH",
      "HSDDDDSSHH",
      "SSSSSSSSSS",
      "SSSSSSSSSS"
     ],
     "pair": [
      "PPPPPPPPPP",
      "HPPPPPPHHH",
      "HPPPPPPHHH",
      "HHHHPPHHHH",
      "HDDDDDDDDH",
      "HPPPPPHHHH",
      "HPPPPPPHHH",
      "PPPPPPPPPP",
      "SPPPPPSPPS",
      "SSSSSSSSSS"
     ]
    },
    "fallbacks": {
     "double": {
      "hard": [
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHSSSHHHH",
       "HSSSSSHHHH",
       "HSSSSSHHHH",
       "HSSSSSHHHH",
       "HSSSSSHHHH",
       "SSSSSSSSSS",
       "SSSSSSSSSS",
       "SSSSSSSSSS",
       "SSSSSSSSSS"
      ],
      "soft": [
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HSSSSSSSHH",
       "SSSSSSSSSS",
       "SSSSSSSSSS"
      ],
      "pair": [
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHSSSHHHH",
       "HSSSSSHHHH",
       "HSSSSSHHHH",
       "SSSSSSSSSS",
       "SSSSSSSSSS"
      ]
     },
     "doubleOnOriginalLateSurrender": {
      "hard": [
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHSSSHHHH",
       "HSSSSSHHHH",
       "HSSSSSHHHH",
       "HSSSSSHHHR",
       "RSSSSSHHRR",
       "SSSSSSSSSS",
       "SSSSSSSSSS",
       "SSSSSSSSSS",
       "SSSSSSSSSS"
      ],
      "soft": [
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HSSSSSSSHH",
       "SSSSSSSSSS",
       "SSSSSSSSSS"
      ],
      "pair": [
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHSSSHHHH",
       "HSSSSSHHHH",
       "RSSSSSHHRR",
       "SSSSSSSSSS",
       "SSSSSSSSSS"
      ]
     },
     "splitByRule": [
      "SSSSSSSSSS",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HDDDDDDDDH",
      "HHHSSSHHHH",
      "HSSSSSHHHH",
      "HSSSSSHHHH",
      "SSSSSSSSSS",
      "SSSSSSSSSS"
     ],
     "splitByBalance": [
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHSSSHHHH",
      "HSSSSSHHHH",
      "RSSSSSHHRR",
      "SSSSSSSSSS",
      "SSSSSSSSSS"
     ],
     "surrender": {
      "hard": [
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHDDDDHHHH",
       "HDDDDDDDDH",
       "HDDDDDDDDD",
       "HHHSSSHHHH",
       "HSSSSSHHHH",
       "HSSSSSHHHH",
       "HSSSSSHHHH",
       "HSSSSSHHHH",
       "SSSSSSSSSS",
       "SSSSSSSSSS",
       "SSSSSSSSSS",
       "SSSSSSSSSS"
      ],
      "soft": [
       "HHHHHDHHHH",
       "HHHHDDHHHH",
       "HHHHDDHHHH",
       "HHHDDDHHHH",
       "HHHDDDHHHH",
       "HHDDDDHHHH",
       "HSDDDDSSHH",
       "SSSSSSSSSS",
       "SSSSSSSSSS"
      ],
      "pair": [
       "PPPPPPPPPP",
       "HPPPPPPHHH",
       "HPPPPPPHHH",
       "HHHHPPHHHH",
       "HDDDDDDDDH",
       "HPPPPPHHHH",
       "HPPPPPPHHH",
       "PPPPPPPPPP",
       "SPPPPPSPPS",
       "SSSSSSSSSS"
      ]
     }
    },
    "later": {
     "hard": [
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHDDDDHHHH",
      "HDDDDDDDDH",
      "HDDDDDDDDD",
      "HHHSSSHHHH",
      "HSSSSSHHHH",
      "HSSSSSHHHH",
      "HSSSSSHHHH",
      "HSSSSSHHHH",
      "SSSSSSSSSS",
      "SSSSSSSSSS",
      "SSSSSSSSSS",
      "SSSSSSSSSS",
      "SSSSSSSSSS"
     ],
     "soft": [
      "HHHHHDHHHH",
      "HHHHDDHHHH",
      "HHHHDDHHHH",
      "HHHDDDHHHH",
      "HHHDDDHHHH",
      "HHDDDDHHHH",
      "HSDDDDSSHH",
      "SSSSSSSSSS",
      "SSSSSSSSSS",
      "SSSSSSSSSS"
     ]
    },
    "laterWithoutDouble": {
     "hard": [
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHSSSHHHH",
      "HSSSSSHHHH",
      "HSSSSSHHHH",
      "HSSSSSHHHH",
      "HSSSSSHHHH",
      "SSSSSSSSSS",
      "SSSSSSSSSS",
      "SSSSSSSSSS",
      "SSSSSSSSSS",
      "SSSSSSSSSS"
     ],
     "soft": [
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HSSSSSSSHH",
      "SSSSSSSSSS",
      "SSSSSSSSSS",
      "SSSSSSSSSS"
     ]
    },
    "deviations": []
   },
   "note": "Certified blackjack reference 1.0.0."
  }
 },
 "H17_noLS": {
  "profile": {
   "id": "benchmark-blackjack-H17_noLS",
   "version": 1,
   "funding": "1000",
   "base": "10",
   "opportunities": 200,
   "finalSettlement": "complete",
   "game": "blackjack",
   "rules": {
    "id": "blackjack-six-deck",
    "version": 1,
    "decks": 6,
    "dealer": "H17",
    "lateSurrender": false,
    "penetration": 75,
    "limits": {
     "initial": {
      "min": "10",
      "max": "1000"
     }
    },
    "players": {
     "learnerSeat": 1,
     "otherWagers": [
      "10"
     ],
     "strategy": {
      "first": {
       "hard": [
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHDDDDHHHH",
        "HDDDDDDDDH",
        "DDDDDDDDDD",
        "HHHSSSHHHH",
        "HSSSSSHHHH",
        "HSSSSSHHHH",
        "HSSSSSHHHH",
        "HSSSSSHHHH",
        "SSSSSSSSSS",
        "SSSSSSSSSS",
        "SSSSSSSSSS",
        "SSSSSSSSSS"
       ],
       "soft": [
        "HHHHHDHHHH",
        "HHHHDDHHHH",
        "HHHHDDHHHH",
        "HHHDDDHHHH",
        "HHHDDDHHHH",
        "HHDDDDHHHH",
        "HDDDDDSSHH",
        "SSSSSDSSSS",
        "SSSSSSSSSS"
       ],
       "pair": [
        "PPPPPPPPPP",
        "HPPPPPPHHH",
        "HPPPPPPHHH",
        "HHHHPPHHHH",
        "HDDDDDDDDH",
        "HPPPPPHHHH",
        "HPPPPPPHHH",
        "PPPPPPPPPP",
        "SPPPPPSPPS",
        "SSSSSSSSSS"
       ]
      },
      "pairWithoutSurrender": [
       "PPPPPPPPPP",
       "HPPPPPPHHH",
       "HPPPPPPHHH",
       "HHHHPPHHHH",
       "HDDDDDDDDH",
       "HPPPPPHHHH",
       "HPPPPPPHHH",
       "PPPPPPPPPP",
       "SPPPPPSPPS",
       "SSSSSSSSSS"
      ],
      "pairAtCap": [
       "SSSSSSSSSS",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HDDDDDDDDH",
       "HHHSSSHHHH",
       "HSSSSSHHHH",
       "HSSSSSHHHH",
       "SSSSSSSSSS",
       "SSSSSSSSSS"
      ],
      "later": {
       "hard": [
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHDDDDHHHH",
        "HDDDDDDDDH",
        "DDDDDDDDDD",
        "HHHSSSHHHH",
        "HSSSSSHHHH",
        "HSSSSSHHHH",
        "HSSSSSHHHH",
        "HSSSSSHHHH",
        "SSSSSSSSSS",
        "SSSSSSSSSS",
        "SSSSSSSSSS",
        "SSSSSSSSSS",
        "SSSSSSSSSS"
       ],
       "soft": [
        "HHHHHDHHHH",
        "HHHHDDHHHH",
        "HHHHDDHHHH",
        "HHHDDDHHHH",
        "HHHDDDHHHH",
        "HHDDDDHHHH",
        "HDDDDDSSHH",
        "SSSSSDSSSS",
        "SSSSSSSSSS",
        "SSSSSSSSSS"
       ]
      },
      "laterWithoutDouble": {
       "hard": [
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHSSSHHHH",
        "HSSSSSHHHH",
        "HSSSSSHHHH",
        "HSSSSSHHHH",
        "HSSSSSHHHH",
        "SSSSSSSSSS",
        "SSSSSSSSSS",
        "SSSSSSSSSS",
        "SSSSSSSSSS",
        "SSSSSSSSSS"
       ],
       "soft": [
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HHHHHHHHHH",
        "HSSSSSSSHH",
        "SSSSSSSSSS",
        "SSSSSSSSSS",
        "SSSSSSSSSS"
       ]
      }
     }
    }
   },
   "reference": {
    "id": "blackjack-coaching-reference@9892826d10a6d377",
    "version": 1
   },
   "exposureBound": "5126500"
  },
  "strategy": {
   "format": 1,
   "id": "blackjack-counting-with-deviations-bet-schedule-H17_noLS",
   "revision": 1,
   "name": "Counting with deviations · bet schedule",
   "game": "blackjack",
   "table": {
    "dealer": "H17",
    "lateSurrender": false,
    "limits": {
     "initial": {
      "min": "10",
      "max": "1000"
     }
    }
   },
   "parameters": [],
   "counters": [],
   "instructions": [
    {
     "id": "true-count-below-1",
     "label": "True count below +1: 1 unit (10)",
     "when": {
      "always": true
     },
     "priority": 0,
     "bets": [
      {
       "target": {
        "target": "hand-1"
       },
       "amount": {
        "lit": "10"
       }
      }
     ]
    },
    {
     "id": "true-count-1",
     "label": "True count +1: 2 units (20)",
     "when": {
      "compare": {
       "value": "true-count"
      },
      "op": "ge",
      "to": {
       "lit": "1"
      }
     },
     "priority": 1,
     "bets": [
      {
       "target": {
        "target": "hand-1"
       },
       "amount": {
        "lit": "20"
       }
      }
     ]
    },
    {
     "id": "true-count-2",
     "label": "True count +2: 4 units (40)",
     "when": {
      "compare": {
       "value": "true-count"
      },
      "op": "ge",
      "to": {
       "lit": "2"
      }
     },
     "priority": 2,
     "bets": [
      {
       "target": {
        "target": "hand-1"
       },
       "amount": {
        "lit": "40"
       }
      }
     ]
    },
    {
     "id": "true-count-3",
     "label": "True count +3: 6 units (60)",
     "when": {
      "compare": {
       "value": "true-count"
      },
      "op": "ge",
      "to": {
       "lit": "3"
      }
     },
     "priority": 3,
     "bets": [
      {
       "target": {
        "target": "hand-1"
       },
       "amount": {
        "lit": "60"
       }
      }
     ]
    },
    {
     "id": "true-count-4",
     "label": "True count +4 or more: 8 units (80)",
     "when": {
      "compare": {
       "value": "true-count"
      },
      "op": "ge",
      "to": {
       "lit": "4"
      }
     },
     "priority": 4,
     "bets": [
      {
       "target": {
        "target": "hand-1"
       },
       "amount": {
        "lit": "80"
       }
      }
     ]
    }
   ],
   "adjustments": [],
   "stopWhen": null,
   "play": {
    "count": "player",
    "first": {
     "hard": [
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHDDDDHHHH",
      "HDDDDDDDDH",
      "DDDDDDDDDD",
      "HHHSSSHHHH",
      "HSSSSSHHHH",
      "HSSSSSHHHH",
      "HSSSSSHHHH",
      "HSSSSSHHHH",
      "SSSSSSSSSS",
      "SSSSSSSSSS",
      "SSSSSSSSSS",
      "SSSSSSSSSS"
     ],
     "soft": [
      "HHHHHDHHHH",
      "HHHHDDHHHH",
      "HHHHDDHHHH",
      "HHHDDDHHHH",
      "HHHDDDHHHH",
      "HHDDDDHHHH",
      "HDDDDDSSHH",
      "SSSSSDSSSS",
      "SSSSSSSSSS"
     ],
     "pair": [
      "PPPPPPPPPP",
      "HPPPPPPHHH",
      "HPPPPPPHHH",
      "HHHHPPHHHH",
      "HDDDDDDDDH",
      "HPPPPPHHHH",
      "HPPPPPPHHH",
      "PPPPPPPPPP",
      "SPPPPPSPPS",
      "SSSSSSSSSS"
     ]
    },
    "fallbacks": {
     "double": {
      "hard": [
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHSSSHHHH",
       "HSSSSSHHHH",
       "HSSSSSHHHH",
       "HSSSSSHHHH",
       "HSSSSSHHHH",
       "SSSSSSSSSS",
       "SSSSSSSSSS",
       "SSSSSSSSSS",
       "SSSSSSSSSS"
      ],
      "soft": [
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HSSSSSSSHH",
       "SSSSSSSSSS",
       "SSSSSSSSSS"
      ],
      "pair": [
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHSSSHHHH",
       "HSSSSSHHHH",
       "HSSSSSHHHH",
       "SSSSSSSSSS",
       "SSSSSSSSSS"
      ]
     },
     "doubleOnOriginalLateSurrender": {
      "hard": [
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHSSSHHHH",
       "HSSSSSHHHH",
       "HSSSSSHHHH",
       "HSSSSSHHHH",
       "HSSSSSHHHH",
       "SSSSSSSSSS",
       "SSSSSSSSSS",
       "SSSSSSSSSS",
       "SSSSSSSSSS"
      ],
      "soft": [
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HSSSSSSSHH",
       "SSSSSSSSSS",
       "SSSSSSSSSS"
      ],
      "pair": [
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHSSSHHHH",
       "HSSSSSHHHH",
       "HSSSSSHHHH",
       "SSSSSSSSSS",
       "SSSSSSSSSS"
      ]
     },
     "splitByRule": [
      "SSSSSSSSSS",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HDDDDDDDDH",
      "HHHSSSHHHH",
      "HSSSSSHHHH",
      "HSSSSSHHHH",
      "SSSSSSSSSS",
      "SSSSSSSSSS"
     ],
     "splitByBalance": [
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHSSSHHHH",
      "HSSSSSHHHH",
      "HSSSSSHHHH",
      "SSSSSSSSSS",
      "SSSSSSSSSS"
     ],
     "surrender": {
      "hard": [
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHHHHHHHHH",
       "HHDDDDHHHH",
       "HDDDDDDDDH",
       "DDDDDDDDDD",
       "HHHSSSHHHH",
       "HSSSSSHHHH",
       "HSSSSSHHHH",
       "HSSSSSHHHH",
       "HSSSSSHHHH",
       "SSSSSSSSSS",
       "SSSSSSSSSS",
       "SSSSSSSSSS",
       "SSSSSSSSSS"
      ],
      "soft": [
       "HHHHHDHHHH",
       "HHHHDDHHHH",
       "HHHHDDHHHH",
       "HHHDDDHHHH",
       "HHHDDDHHHH",
       "HHDDDDHHHH",
       "HDDDDDSSHH",
       "SSSSSDSSSS",
       "SSSSSSSSSS"
      ],
      "pair": [
       "PPPPPPPPPP",
       "HPPPPPPHHH",
       "HPPPPPPHHH",
       "HHHHPPHHHH",
       "HDDDDDDDDH",
       "HPPPPPHHHH",
       "HPPPPPPHHH",
       "PPPPPPPPPP",
       "SPPPPPSPPS",
       "SSSSSSSSSS"
      ]
     }
    },
    "later": {
     "hard": [
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHDDDDHHHH",
      "HDDDDDDDDH",
      "DDDDDDDDDD",
      "HHHSSSHHHH",
      "HSSSSSHHHH",
      "HSSSSSHHHH",
      "HSSSSSHHHH",
      "HSSSSSHHHH",
      "SSSSSSSSSS",
      "SSSSSSSSSS",
      "SSSSSSSSSS",
      "SSSSSSSSSS",
      "SSSSSSSSSS"
     ],
     "soft": [
      "HHHHHDHHHH",
      "HHHHDDHHHH",
      "HHHHDDHHHH",
      "HHHDDDHHHH",
      "HHHDDDHHHH",
      "HHDDDDHHHH",
      "HDDDDDSSHH",
      "SSSSSDSSSS",
      "SSSSSSSSSS",
      "SSSSSSSSSS"
     ]
    },
    "laterWithoutDouble": {
     "hard": [
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHSSSHHHH",
      "HSSSSSHHHH",
      "HSSSSSHHHH",
      "HSSSSSHHHH",
      "HSSSSSHHHH",
      "SSSSSSSSSS",
      "SSSSSSSSSS",
      "SSSSSSSSSS",
      "SSSSSSSSSS",
      "SSSSSSSSSS"
     ],
     "soft": [
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HHHHHHHHHH",
      "HSSSSSSSHH",
      "SSSSSSSSSS",
      "SSSSSSSSSS",
      "SSSSSSSSSS"
     ]
    },
    "deviations": [
     {
      "id": "H17 16 vs 10",
      "set": "illustrious18",
      "situation": "16 vs 10",
      "hand": {
       "kind": "hard",
       "total": 16
      },
      "up": 10,
      "threshold": 1,
      "direction": "deviate-at-or-above",
      "atOrAbove": "stand",
      "below": "hit",
      "published": {
       "schlesinger": {
        "value": "+0",
        "difference": 1,
        "cost": [
         {
          "trueCount": 0,
          "perBet": "+0.0000"
         }
        ]
       },
       "bja": {
        "value": "0+",
        "difference": null,
        "cost": []
       }
      }
     },
     {
      "id": "H17 15 vs 10",
      "set": "illustrious18",
      "situation": "15 vs 10",
      "hand": {
       "kind": "hard",
       "total": 15
      },
      "up": 10,
      "threshold": 4,
      "direction": "deviate-at-or-above",
      "atOrAbove": "stand",
      "below": "hit",
      "published": {
       "schlesinger": {
        "value": "+4",
        "difference": 0,
        "cost": []
       },
       "bja": {
        "value": "4+",
        "difference": 0,
        "cost": []
       }
      }
     },
     {
      "id": "H17 T,T vs 5",
      "set": "illustrious18",
      "situation": "T,T vs 5",
      "hand": {
       "kind": "pair",
       "value": 10
      },
      "up": 5,
      "threshold": 5,
      "direction": "deviate-at-or-above",
      "atOrAbove": "split",
      "below": "stand",
      "published": {
       "schlesinger": {
        "value": "+5",
        "difference": 0,
        "cost": []
       },
       "bja": {
        "value": "5+",
        "difference": 0,
        "cost": []
       }
      }
     },
     {
      "id": "H17 T,T vs 6",
      "set": "illustrious18",
      "situation": "T,T vs 6",
      "hand": {
       "kind": "pair",
       "value": 10
      },
      "up": 6,
      "threshold": 4,
      "direction": "deviate-at-or-above",
      "atOrAbove": "split",
      "below": "stand",
      "published": {
       "schlesinger": {
        "value": "+4",
        "difference": 0,
        "cost": []
       },
       "bja": {
        "value": "4+",
        "difference": 0,
        "cost": []
       }
      }
     },
     {
      "id": "H17 10 vs 10",
      "set": "illustrious18",
      "situation": "10 vs 10",
      "hand": {
       "kind": "hard",
       "total": 10
      },
      "up": 10,
      "threshold": 4,
      "direction": "deviate-at-or-above",
      "atOrAbove": "double",
      "below": "hit",
      "published": {
       "schlesinger": {
        "value": "+4",
        "difference": 0,
        "cost": []
       },
       "bja": {
        "value": "4+",
        "difference": 0,
        "cost": []
       }
      }
     },
     {
      "id": "H17 12 vs 3",
      "set": "illustrious18",
      "situation": "12 vs 3",
      "hand": {
       "kind": "hard",
       "total": 12
      },
      "up": 3,
      "threshold": 2,
      "direction": "deviate-at-or-above",
      "atOrAbove": "stand",
      "below": "hit",
      "published": {
       "schlesinger": {
        "value": "+2",
        "difference": 0,
        "cost": []
       },
       "bja": {
        "value": "2+",
        "difference": 0,
        "cost": []
       }
      }
     },
     {
      "id": "H17 12 vs 2",
      "set": "illustrious18",
      "situation": "12 vs 2",
      "hand": {
       "kind": "hard",
       "total": 12
      },
      "up": 2,
      "threshold": 3,
      "direction": "deviate-at-or-above",
      "atOrAbove": "stand",
      "below": "hit",
      "published": {
       "schlesinger": {
        "value": "+3",
        "difference": 0,
        "cost": []
       },
       "bja": {
        "value": "3+",
        "difference": 0,
        "cost": []
       }
      }
     },
     {
      "id": "H17 11 vs A",
      "set": "illustrious18",
      "situation": "11 vs A",
      "hand": {
       "kind": "hard",
       "total": 11
      },
      "up": 1,
      "threshold": 0,
      "direction": "basic-at-or-above",
      "atOrAbove": "double",
      "below": "hit",
      "published": {
       "schlesinger": {
        "value": "+1",
        "difference": -1,
        "cost": [
         {
          "trueCount": 0,
          "perBet": "+0.0125"
         }
        ]
       },
       "bja": {
        "value": "D",
        "difference": null,
        "cost": []
       }
      }
     },
     {
      "id": "H17 9 vs 2",
      "set": "illustrious18",
      "situation": "9 vs 2",
      "hand": {
       "kind": "hard",
       "total": 9
      },
      "up": 2,
      "threshold": 1,
      "direction": "deviate-at-or-above",
      "atOrAbove": "double",
      "below": "hit",
      "published": {
       "schlesinger": {
        "value": "+1",
        "difference": 0,
        "cost": []
       },
       "bja": {
        "value": "1+",
        "difference": 0,
        "cost": []
       }
      }
     },
     {
      "id": "H17 10 vs A",
      "set": "illustrious18",
      "situation": "10 vs A",
      "hand": {
       "kind": "hard",
       "total": 10
      },
      "up": 1,
      "threshold": 3,
      "direction": "deviate-at-or-above",
      "atOrAbove": "double",
      "below": "hit",
      "published": {
       "schlesinger": {
        "value": "+4",
        "difference": -1,
        "cost": [
         {
          "trueCount": 3,
          "perBet": "+0.0196"
         }
        ]
       },
       "bja": {
        "value": "3+",
        "difference": 0,
        "cost": []
       }
      }
     },
     {
      "id": "H17 9 vs 7",
      "set": "illustrious18",
      "situation": "9 vs 7",
      "hand": {
       "kind": "hard",
       "total": 9
      },
      "up": 7,
      "threshold": 4,
      "direction": "deviate-at-or-above",
      "atOrAbove": "double",
      "below": "hit",
      "published": {
       "schlesinger": {
        "value": "+3",
        "difference": 1,
        "cost": [
         {
          "trueCount": 3,
          "perBet": "+0.0011"
         }
        ]
       },
       "bja": {
        "value": "3+",
        "difference": 1,
        "cost": [
         {
          "trueCount": 3,
          "perBet": "+0.0011"
         }
        ]
       }
      }
     },
     {
      "id": "H17 16 vs 9",
      "set": "illustrious18",
      "situation": "16 vs 9",
      "hand": {
       "kind": "hard",
       "total": 16
      },
      "up": 9,
      "threshold": 5,
      "direction": "deviate-at-or-above",
      "atOrAbove": "stand",
      "below": "hit",
      "published": {
       "schlesinger": {
        "value": "+5",
        "difference": 0,
        "cost": []
       },
       "bja": {
        "value": "4+",
        "difference": 1,
        "cost": [
         {
          "trueCount": 4,
          "perBet": "+0.0032"
         }
        ]
       }
      }
     },
     {
      "id": "H17 13 vs 2",
      "set": "illustrious18",
      "situation": "13 vs 2",
      "hand": {
       "kind": "hard",
       "total": 13
      },
      "up": 2,
      "threshold": -1,
      "direction": "basic-at-or-above",
      "atOrAbove": "stand",
      "below": "hit",
      "published": {
       "schlesinger": {
        "value": "-1",
        "difference": 0,
        "cost": []
       },
       "bja": {
        "value": "-1-",
        "difference": -1,
        "cost": [
         {
          "trueCount": -1,
          "perBet": "+0.0001"
         }
        ]
       }
      }
     },
     {
      "id": "H17 12 vs 4",
      "set": "illustrious18",
      "situation": "12 vs 4",
      "hand": {
       "kind": "hard",
       "total": 12
      },
      "up": 4,
      "threshold": 0,
      "direction": "basic-at-or-above",
      "atOrAbove": "stand",
      "below": "hit",
      "published": {
       "schlesinger": {
        "value": "0",
        "difference": 0,
        "cost": []
       },
       "bja": {
        "value": "0-",
        "difference": null,
        "cost": []
       }
      }
     },
     {
      "id": "H17 12 vs 5",
      "set": "illustrious18",
      "situation": "12 vs 5",
      "hand": {
       "kind": "hard",
       "total": 12
      },
      "up": 5,
      "threshold": -1,
      "direction": "basic-at-or-above",
      "atOrAbove": "stand",
      "below": "hit",
      "published": {
       "schlesinger": {
        "value": "-2",
        "difference": 1,
        "cost": [
         {
          "trueCount": -2,
          "perBet": "+0.0103"
         }
        ]
       },
       "bja": {
        "value": "",
        "difference": null,
        "cost": []
       }
      }
     },
     {
      "id": "H17 12 vs 6",
      "set": "illustrious18",
      "situation": "12 vs 6",
      "hand": {
       "kind": "hard",
       "total": 12
      },
      "up": 6,
      "threshold": -3,
      "direction": "basic-at-or-above",
      "atOrAbove": "stand",
      "below": "hit",
      "published": {
       "schlesinger": {
        "value": "-1",
        "difference": -2,
        "cost": [
         {
          "trueCount": -3,
          "perBet": "+0.0032"
         },
         {
          "trueCount": -2,
          "perBet": "+0.0165"
         }
        ]
       },
       "bja": {
        "value": "",
        "difference": null,
        "cost": []
       }
      }
     },
     {
      "id": "H17 13 vs 3",
      "set": "illustrious18",
      "situation": "13 vs 3",
      "hand": {
       "kind": "hard",
       "total": 13
      },
      "up": 3,
      "threshold": -2,
      "direction": "basic-at-or-above",
      "atOrAbove": "stand",
      "below": "hit",
      "published": {
       "schlesinger": {
        "value": "-2",
        "difference": 0,
        "cost": []
       },
       "bja": {
        "value": "",
        "difference": null,
        "cost": []
       }
      }
     },
     {
      "id": "H17 Insurance",
      "set": "insurance",
      "situation": "Insurance",
      "hand": {
       "kind": "insurance"
      },
      "up": 1,
      "threshold": 3,
      "direction": "deviate-at-or-above",
      "atOrAbove": "insure",
      "below": "decline",
      "published": {
       "schlesinger": {
        "value": "+3",
        "difference": 0,
        "cost": []
       },
       "bja": {
        "value": "",
        "difference": null,
        "cost": []
       }
      }
     }
    ]
   },
   "note": "Certified blackjack reference 1.0.0."
  }
 }
} as unknown as Record<'S17_LS' | 'H17_noLS', { readonly profile: BenchmarkProfile; readonly strategy: StrategyDefinition }>;
