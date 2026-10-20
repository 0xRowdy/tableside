// Recorded by scripts/record-checkpoints.ts with engine 0.0.0, state schema 4. Never edit or remove.
import type { RecordedBuild } from './index';

export const RECORDED_ENGINE_0_0_0_SCHEMA_4: RecordedBuild = {
  "engine": "0.0.0",
  "schema": 4,
  "checkpoints": [
    {
      "name": "roulette, wagers placed before the spin",
      "game": "roulette",
      "phase": "open-decision",
      "specification": {
        "activityId": "activity-1",
        "device": "device-1",
        "funding": "1000",
        "fundingSource": "practice-funding",
        "game": "roulette",
        "owner": "local",
        "reference": null,
        "rules": {
          "id": "roulette-single-zero",
          "limits": {
            "inside": {
              "max": "100",
              "min": "1"
            },
            "outside": {
              "max": "1000",
              "min": "10"
            }
          },
          "version": 1,
          "wheel": "single-zero"
        },
        "strategy": null
      },
      "random": {
        "key": [
          2752067618,
          698298832
        ],
        "protocol": 1,
        "session": [
          320440878,
          57701188
        ]
      },
      "checkpoint": "{\"activity\":{\"device\":\"device-1\",\"id\":\"activity-1\",\"owner\":\"local\"},\"balance\":\"985\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"0\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"roulette\",\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"version\":1},\"strategy\":null},\"outcome\":null,\"phase\":\"open-decision\",\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[2752067618,698298832],\"lane\":0,\"protocol\":1,\"session\":[320440878,57701188]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"red\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"amount\\\":\\\"5\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"straight-17\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1}],\"rules\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheel\":\"single-zero\"},\"schema\":4,\"sequence\":2,\"strategy\":null,\"turn\":0,\"wagers\":[{\"amount\":\"5\",\"target\":\"straight-17\"},{\"amount\":\"10\",\"target\":\"red\"}]}",
      "continuation": [
        {
          "kind": "request-stop"
        },
        {
          "kind": "advance-final-settlement"
        }
      ],
      "facts": "[{\"kind\":\"stop-requested\",\"phase\":\"open-decision\"},{\"amount\":\"5\",\"kind\":\"wager-returned\",\"target\":\"straight-17\"},{\"amount\":\"10\",\"kind\":\"wager-returned\",\"target\":\"red\"},{\"balance\":\"1000\",\"kind\":\"activity-completed\"}]",
      "finalBalance": "1000"
    },
    {
      "name": "roulette, the ball landed but not yet settled",
      "game": "roulette",
      "phase": "revealing-outcome",
      "specification": {
        "activityId": "activity-1",
        "device": "device-1",
        "funding": "1000",
        "fundingSource": "practice-funding",
        "game": "roulette",
        "owner": "local",
        "reference": null,
        "rules": {
          "id": "roulette-single-zero",
          "limits": {
            "inside": {
              "max": "100",
              "min": "1"
            },
            "outside": {
              "max": "1000",
              "min": "10"
            }
          },
          "version": 1,
          "wheel": "single-zero"
        },
        "strategy": null
      },
      "random": {
        "key": [
          2752067618,
          698298832
        ],
        "protocol": 1,
        "session": [
          320440878,
          57701188
        ]
      },
      "checkpoint": "{\"activity\":{\"device\":\"device-1\",\"id\":\"activity-1\",\"owner\":\"local\"},\"balance\":\"990\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"0\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"roulette\",\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"version\":1},\"strategy\":null},\"outcome\":{\"pocket\":27,\"turn\":1},\"phase\":\"revealing-outcome\",\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[2752067618,698298832],\"lane\":1,\"protocol\":1,\"session\":[320440878,57701188]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"red\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1}],\"rules\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheel\":\"single-zero\"},\"schema\":4,\"sequence\":2,\"strategy\":null,\"turn\":1,\"wagers\":[{\"amount\":\"10\",\"target\":\"red\"}]}",
      "continuation": [
        {
          "kind": "settle-turn"
        },
        {
          "kind": "request-stop"
        },
        {
          "kind": "advance-final-settlement"
        }
      ],
      "facts": "[{\"kind\":\"wager-settled\",\"net\":\"10\",\"result\":\"win\",\"returned\":\"20\",\"stake\":\"10\",\"target\":\"red\",\"turn\":1},{\"kind\":\"stop-requested\",\"phase\":\"settled-outcome\"},{\"balance\":\"1010\",\"kind\":\"activity-completed\"}]",
      "finalBalance": "1010"
    },
    {
      "name": "roulette, a spin settled",
      "game": "roulette",
      "phase": "open-decision",
      "specification": {
        "activityId": "activity-1",
        "device": "device-1",
        "funding": "1000",
        "fundingSource": "practice-funding",
        "game": "roulette",
        "owner": "local",
        "reference": null,
        "rules": {
          "id": "roulette-single-zero",
          "limits": {
            "inside": {
              "max": "100",
              "min": "1"
            },
            "outside": {
              "max": "1000",
              "min": "10"
            }
          },
          "version": 1,
          "wheel": "single-zero"
        },
        "strategy": null
      },
      "random": {
        "key": [
          2752067618,
          698298832
        ],
        "protocol": 1,
        "session": [
          320440878,
          57701188
        ]
      },
      "checkpoint": "{\"activity\":{\"device\":\"device-1\",\"id\":\"activity-1\",\"owner\":\"local\"},\"balance\":\"990\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"10\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"roulette\",\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"version\":1},\"strategy\":null},\"outcome\":{\"pocket\":27,\"turn\":1},\"phase\":\"open-decision\",\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[2752067618,698298832],\"lane\":1,\"protocol\":1,\"session\":[320440878,57701188]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"red\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"settle-turn\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"amount\\\":\\\"20\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"black\\\"}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3}],\"rules\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheel\":\"single-zero\"},\"schema\":4,\"sequence\":4,\"strategy\":null,\"turn\":1,\"wagers\":[{\"amount\":\"20\",\"target\":\"black\"}]}",
      "continuation": [
        {
          "kind": "request-stop"
        },
        {
          "kind": "advance-final-settlement"
        }
      ],
      "facts": "[{\"kind\":\"stop-requested\",\"phase\":\"open-decision\"},{\"amount\":\"20\",\"kind\":\"wager-returned\",\"target\":\"black\"},{\"balance\":\"1010\",\"kind\":\"activity-completed\"}]",
      "finalBalance": "1010"
    },
    {
      "name": "roulette, stopped with a wager down, final settlement under way",
      "game": "roulette",
      "phase": "final-settlement",
      "specification": {
        "activityId": "activity-1",
        "device": "device-1",
        "funding": "1000",
        "fundingSource": "practice-funding",
        "game": "roulette",
        "owner": "local",
        "reference": null,
        "rules": {
          "id": "roulette-single-zero",
          "limits": {
            "inside": {
              "max": "100",
              "min": "1"
            },
            "outside": {
              "max": "1000",
              "min": "10"
            }
          },
          "version": 1,
          "wheel": "single-zero"
        },
        "strategy": null
      },
      "random": {
        "key": [
          2752067618,
          698298832
        ],
        "protocol": 1,
        "session": [
          320440878,
          57701188
        ]
      },
      "checkpoint": "{\"activity\":{\"device\":\"device-1\",\"id\":\"activity-1\",\"owner\":\"local\"},\"balance\":\"1010\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"10\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"roulette\",\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"version\":1},\"strategy\":null},\"outcome\":{\"pocket\":27,\"turn\":1},\"phase\":\"final-settlement\",\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[2752067618,698298832],\"lane\":1,\"protocol\":1,\"session\":[320440878,57701188]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"red\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"settle-turn\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"even\\\"}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3},{\"command\":\"{\\\"kind\\\":\\\"request-stop\\\"}\",\"commandId\":\"record-4\",\"disposition\":\"applied\",\"sequence\":4}],\"rules\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheel\":\"single-zero\"},\"schema\":4,\"sequence\":5,\"strategy\":null,\"turn\":1,\"wagers\":[]}",
      "continuation": [
        {
          "kind": "advance-final-settlement"
        }
      ],
      "facts": "[{\"balance\":\"1010\",\"kind\":\"activity-completed\"}]",
      "finalBalance": "1010"
    },
    {
      "name": "roulette guided, a correction waiting for retry or override",
      "game": "roulette",
      "phase": "correction",
      "specification": {
        "activityId": "activity-1",
        "device": "device-1",
        "funding": "1000",
        "fundingSource": "practice-funding",
        "game": "roulette",
        "owner": "local",
        "reference": null,
        "rules": {
          "id": "roulette-single-zero",
          "limits": {
            "inside": {
              "max": "100",
              "min": "1"
            },
            "outside": {
              "max": "1000",
              "min": "10"
            }
          },
          "version": 1,
          "wheel": "single-zero"
        },
        "strategy": {
          "definition": {
            "adjustments": [],
            "counters": [],
            "format": 1,
            "game": "roulette",
            "id": "test-flat-even-money",
            "instructions": [
              {
                "bets": [
                  {
                    "amount": {
                      "lit": "10"
                    },
                    "target": {
                      "param": "target"
                    }
                  }
                ],
                "id": "flat",
                "label": "1 unit on the target, every spin",
                "when": {
                  "always": true
                }
              }
            ],
            "name": "Flat even-money",
            "parameters": [
              {
                "choices": [
                  "red",
                  "black",
                  "odd",
                  "even",
                  "low",
                  "high"
                ],
                "default": "red",
                "id": "target",
                "label": "Target"
              }
            ],
            "revision": 1,
            "stopWhen": null,
            "table": {
              "limits": {
                "inside": {
                  "max": "100",
                  "min": "1"
                },
                "outside": {
                  "max": "1000",
                  "min": "10"
                }
              },
              "wheels": [
                "single-zero",
                "double-zero"
              ]
            }
          },
          "parameters": {
            "target": "red"
          }
        }
      },
      "random": {
        "key": [
          2752067618,
          698298832
        ],
        "protocol": 1,
        "session": [
          320440878,
          57701188
        ]
      },
      "checkpoint": "{\"activity\":{\"device\":\"device-1\",\"id\":\"activity-1\",\"owner\":\"local\"},\"balance\":\"950\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"0\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"roulette\",\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"version\":1},\"strategy\":{\"id\":\"test-flat-even-money\",\"version\":1}},\"outcome\":null,\"phase\":\"correction\",\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[2752067618,698298832],\"lane\":0,\"protocol\":1,\"session\":[320440878,57701188]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"50\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"red\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"assessed\",\"sequence\":1}],\"rules\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheel\":\"single-zero\"},\"schema\":4,\"sequence\":2,\"strategy\":{\"coachedTurn\":false,\"correction\":{\"actual\":[{\"amount\":\"50\",\"target\":\"red\"}],\"explanation\":{\"fallback\":null,\"instructions\":[{\"id\":\"flat\",\"label\":\"1 unit on the target, every spin\"}],\"prescription\":{\"bets\":[{\"amount\":\"10\",\"target\":\"red\"}],\"held\":[],\"status\":\"prescribed\"},\"situation\":{\"available\":\"1000\",\"subjects\":{\"last-pocket-color\":\"none\",\"last-result\":\"none\"}},\"state\":{\"counters\":{},\"cycleTurn\":0,\"lastResult\":\"none\",\"lists\":{}}},\"id\":\"activity-1/departure/1\",\"turn\":1},\"cycle\":{\"number\":1,\"turns\":[]},\"cycleEnd\":null,\"decisions\":0,\"definition\":{\"adjustments\":[],\"counters\":[],\"format\":1,\"game\":\"roulette\",\"id\":\"test-flat-even-money\",\"instructions\":[{\"bets\":[{\"amount\":{\"lit\":\"10\"},\"target\":{\"param\":\"target\"}}],\"id\":\"flat\",\"label\":\"1 unit on the target, every spin\",\"when\":{\"always\":true}}],\"name\":\"Flat even-money\",\"parameters\":[{\"choices\":[\"red\",\"black\",\"odd\",\"even\",\"low\",\"high\"],\"default\":\"red\",\"id\":\"target\",\"label\":\"Target\"}],\"revision\":1,\"stopWhen\":null,\"table\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheels\":[\"single-zero\",\"double-zero\"]}},\"departures\":[],\"parameters\":{\"target\":\"red\"},\"progress\":{\"counters\":{},\"cycleTurn\":0,\"lastResult\":\"none\",\"lists\":{}},\"status\":\"active\"},\"turn\":0,\"wagers\":[{\"amount\":\"50\",\"target\":\"red\"}]}",
      "continuation": [
        {
          "kind": "retry-correction"
        },
        {
          "kind": "request-stop"
        },
        {
          "kind": "advance-final-settlement"
        }
      ],
      "facts": "[{\"departure\":{\"actual\":[{\"amount\":\"50\",\"target\":\"red\"}],\"explanation\":{\"fallback\":null,\"instructions\":[{\"id\":\"flat\",\"label\":\"1 unit on the target, every spin\"}],\"prescription\":{\"bets\":[{\"amount\":\"10\",\"target\":\"red\"}],\"held\":[],\"status\":\"prescribed\"},\"situation\":{\"available\":\"1000\",\"subjects\":{\"last-pocket-color\":\"none\",\"last-result\":\"none\"}},\"state\":{\"counters\":{},\"cycleTurn\":0,\"lastResult\":\"none\",\"lists\":{}}},\"id\":\"activity-1/departure/1\",\"resolution\":\"retried\",\"turn\":1},\"kind\":\"departure-recorded\"},{\"amount\":\"10\",\"kind\":\"wager-changed\",\"previous\":\"50\",\"target\":\"red\"},{\"kind\":\"stop-requested\",\"phase\":\"open-decision\"},{\"amount\":\"10\",\"kind\":\"wager-returned\",\"target\":\"red\"},{\"balance\":\"1000\",\"kind\":\"activity-completed\"}]",
      "finalBalance": "1000"
    },
    {
      "name": "roulette guided, a progression cycle ended by an override",
      "game": "roulette",
      "phase": "cycle-completion",
      "specification": {
        "activityId": "activity-1",
        "device": "device-1",
        "funding": "1000",
        "fundingSource": "practice-funding",
        "game": "roulette",
        "owner": "local",
        "reference": null,
        "rules": {
          "id": "roulette-single-zero",
          "limits": {
            "inside": {
              "max": "100",
              "min": "1"
            },
            "outside": {
              "max": "1000",
              "min": "10"
            }
          },
          "version": 1,
          "wheel": "single-zero"
        },
        "strategy": {
          "definition": {
            "adjustments": [
              {
                "counter": "stake",
                "id": "double",
                "on": "loss",
                "to": {
                  "mul": [
                    {
                      "counter": "stake"
                    },
                    {
                      "lit": "2"
                    }
                  ]
                }
              },
              {
                "counter": "stake",
                "id": "reset",
                "on": "win",
                "to": {
                  "lit": "10"
                }
              }
            ],
            "counters": [
              {
                "cap": "320",
                "id": "stake",
                "initial": "10"
              }
            ],
            "format": 1,
            "game": "roulette",
            "id": "test-doubling",
            "instructions": [
              {
                "bets": [
                  {
                    "amount": {
                      "counter": "stake"
                    },
                    "target": {
                      "target": "red"
                    }
                  }
                ],
                "id": "bet",
                "label": "The stake on red",
                "when": {
                  "always": true
                }
              }
            ],
            "name": "Doubling on red",
            "parameters": [],
            "revision": 3,
            "stopWhen": null,
            "table": {
              "limits": {
                "inside": {
                  "max": "100",
                  "min": "1"
                },
                "outside": {
                  "max": "1000",
                  "min": "10"
                }
              },
              "wheels": [
                "single-zero",
                "double-zero"
              ]
            }
          },
          "parameters": {}
        }
      },
      "random": {
        "key": [
          2752067618,
          698298832
        ],
        "protocol": 1,
        "session": [
          320440878,
          57701188
        ]
      },
      "checkpoint": "{\"activity\":{\"device\":\"device-1\",\"id\":\"activity-1\",\"owner\":\"local\"},\"balance\":\"1050\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"50\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"roulette\",\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"version\":1},\"strategy\":{\"id\":\"test-doubling\",\"version\":3}},\"outcome\":{\"pocket\":27,\"turn\":1},\"phase\":\"cycle-completion\",\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[2752067618,698298832],\"lane\":1,\"protocol\":1,\"session\":[320440878,57701188]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"50\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"red\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"assessed\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"override-correction\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"kind\\\":\\\"settle-turn\\\"}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3}],\"rules\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheel\":\"single-zero\"},\"schema\":4,\"sequence\":4,\"strategy\":{\"coachedTurn\":false,\"correction\":null,\"cycle\":{\"number\":1,\"turns\":[{\"followed\":false,\"net\":\"50\",\"outcome\":\"27\",\"turn\":1,\"wagers\":[{\"amount\":\"50\",\"target\":\"red\"}]}]},\"cycleEnd\":\"override\",\"decisions\":1,\"definition\":{\"adjustments\":[{\"counter\":\"stake\",\"id\":\"double\",\"on\":\"loss\",\"to\":{\"mul\":[{\"counter\":\"stake\"},{\"lit\":\"2\"}]}},{\"counter\":\"stake\",\"id\":\"reset\",\"on\":\"win\",\"to\":{\"lit\":\"10\"}}],\"counters\":[{\"cap\":\"320\",\"id\":\"stake\",\"initial\":\"10\"}],\"format\":1,\"game\":\"roulette\",\"id\":\"test-doubling\",\"instructions\":[{\"bets\":[{\"amount\":{\"counter\":\"stake\"},\"target\":{\"target\":\"red\"}}],\"id\":\"bet\",\"label\":\"The stake on red\",\"when\":{\"always\":true}}],\"name\":\"Doubling on red\",\"parameters\":[],\"revision\":3,\"stopWhen\":null,\"table\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheels\":[\"single-zero\",\"double-zero\"]}},\"departures\":[{\"actual\":[{\"amount\":\"50\",\"target\":\"red\"}],\"explanation\":{\"fallback\":null,\"instructions\":[{\"id\":\"bet\",\"label\":\"The stake on red\"}],\"prescription\":{\"bets\":[{\"amount\":\"10\",\"target\":\"red\"}],\"held\":[],\"status\":\"prescribed\"},\"situation\":{\"available\":\"1000\",\"subjects\":{\"last-pocket-color\":\"none\",\"last-result\":\"none\"}},\"state\":{\"counters\":{\"stake\":\"10\"},\"cycleTurn\":0,\"lastResult\":\"none\",\"lists\":{}}},\"id\":\"activity-1/departure/1\",\"resolution\":\"overridden\",\"turn\":1}],\"parameters\":{},\"progress\":{\"counters\":{\"stake\":\"10\"},\"cycleTurn\":0,\"lastResult\":\"none\",\"lists\":{}},\"status\":\"cycle-ended\"},\"turn\":1,\"wagers\":[]}",
      "continuation": [
        {
          "kind": "request-stop"
        },
        {
          "kind": "advance-final-settlement"
        }
      ],
      "facts": "[{\"kind\":\"stop-requested\",\"phase\":\"open-decision\"},{\"balance\":\"1050\",\"kind\":\"activity-completed\"}]",
      "finalBalance": "1050"
    },
    {
      "name": "craps, a point established",
      "game": "craps",
      "phase": "settled-outcome",
      "specification": {
        "activityId": "craps-1",
        "device": "device-1",
        "funding": "1000",
        "fundingSource": "practice-funding",
        "game": "craps",
        "owner": "local",
        "reference": null,
        "rules": {
          "field": "triple-12",
          "id": "standard-craps",
          "limits": {
            "flat": {
              "max": "1000",
              "min": "10"
            },
            "props": {
              "max": "100",
              "min": "1"
            }
          },
          "odds": "3-4-5x",
          "version": 2
        },
        "strategy": null
      },
      "random": {
        "key": [
          1,
          0
        ],
        "protocol": 1,
        "session": [
          0,
          0
        ]
      },
      "checkpoint": "{\"activity\":{\"device\":\"device-1\",\"id\":\"craps-1\",\"owner\":\"local\"},\"balance\":\"990\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"0\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"craps\",\"random\":{\"key\":[1,0],\"protocol\":1,\"session\":[0,0]},\"reference\":null,\"rules\":{\"id\":\"standard-craps\",\"version\":2},\"strategy\":null},\"instructions\":[],\"outcome\":{\"dice\":[5,1],\"turn\":1},\"phase\":\"settled-outcome\",\"point\":6,\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[1,0],\"lane\":2,\"protocol\":1,\"session\":[0,0]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"pass\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"amount\\\":\\\"5\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"field\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"assessed\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"kind\\\":\\\"settle-turn\\\"}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3}],\"rules\":{\"field\":\"triple-12\",\"limits\":{\"flat\":{\"max\":\"1000\",\"min\":\"10\"},\"props\":{\"max\":\"100\",\"min\":\"1\"}},\"odds\":\"3-4-5x\"},\"schema\":4,\"sequence\":4,\"strategy\":null,\"turn\":1,\"wagers\":[{\"amount\":\"10\",\"target\":\"pass\"}]}",
      "continuation": [
        {
          "kind": "request-stop"
        },
        {
          "kind": "advance-final-settlement"
        },
        {
          "kind": "advance-final-settlement"
        },
        {
          "kind": "advance-final-settlement"
        },
        {
          "kind": "advance-final-settlement"
        },
        {
          "kind": "advance-final-settlement"
        },
        {
          "kind": "advance-final-settlement"
        },
        {
          "kind": "advance-final-settlement"
        },
        {
          "kind": "advance-final-settlement"
        },
        {
          "kind": "advance-final-settlement"
        },
        {
          "kind": "advance-final-settlement"
        }
      ],
      "facts": "[{\"kind\":\"stop-requested\",\"phase\":\"settled-outcome\"},{\"kind\":\"turn-began\",\"turn\":2,\"wagers\":[{\"amount\":\"10\",\"target\":\"pass\"}]},{\"dice\":[3,2],\"kind\":\"dice-rolled\",\"turn\":2},{\"kind\":\"turn-began\",\"turn\":3,\"wagers\":[{\"amount\":\"10\",\"target\":\"pass\"}]},{\"dice\":[6,5],\"kind\":\"dice-rolled\",\"turn\":3},{\"kind\":\"turn-began\",\"turn\":4,\"wagers\":[{\"amount\":\"10\",\"target\":\"pass\"}]},{\"dice\":[6,6],\"kind\":\"dice-rolled\",\"turn\":4},{\"kind\":\"turn-began\",\"turn\":5,\"wagers\":[{\"amount\":\"10\",\"target\":\"pass\"}]},{\"dice\":[1,4],\"kind\":\"dice-rolled\",\"turn\":5},{\"kind\":\"turn-began\",\"turn\":6,\"wagers\":[{\"amount\":\"10\",\"target\":\"pass\"}]},{\"dice\":[5,3],\"kind\":\"dice-rolled\",\"turn\":6},{\"kind\":\"turn-began\",\"turn\":7,\"wagers\":[{\"amount\":\"10\",\"target\":\"pass\"}]},{\"dice\":[4,1],\"kind\":\"dice-rolled\",\"turn\":7},{\"kind\":\"turn-began\",\"turn\":8,\"wagers\":[{\"amount\":\"10\",\"target\":\"pass\"}]},{\"dice\":[4,1],\"kind\":\"dice-rolled\",\"turn\":8},{\"kind\":\"turn-began\",\"turn\":9,\"wagers\":[{\"amount\":\"10\",\"target\":\"pass\"}]},{\"dice\":[1,3],\"kind\":\"dice-rolled\",\"turn\":9},{\"kind\":\"turn-began\",\"turn\":10,\"wagers\":[{\"amount\":\"10\",\"target\":\"pass\"}]},{\"dice\":[2,3],\"kind\":\"dice-rolled\",\"turn\":10},{\"kind\":\"turn-began\",\"turn\":11,\"wagers\":[{\"amount\":\"10\",\"target\":\"pass\"}]},{\"dice\":[1,5],\"kind\":\"dice-rolled\",\"turn\":11},{\"kind\":\"wager-settled\",\"net\":\"10\",\"result\":\"win\",\"returned\":\"20\",\"stake\":\"10\",\"target\":\"pass\",\"turn\":11},{\"kind\":\"point-changed\",\"point\":null,\"turn\":11},{\"balance\":\"1010\",\"kind\":\"activity-completed\"}]",
      "finalBalance": "1010"
    },
    {
      "name": "blackjack, dealt and waiting for the decision",
      "game": "blackjack",
      "phase": "open-decision",
      "specification": {
        "activityId": "blackjack-1",
        "device": "device-1",
        "funding": "1000",
        "fundingSource": "practice-funding",
        "game": "blackjack",
        "owner": "local",
        "reference": null,
        "rules": {
          "dealer": "S17",
          "decks": 6,
          "id": "blackjack-six-deck",
          "lateSurrender": true,
          "limits": {
            "initial": {
              "max": "1000",
              "min": "10"
            }
          },
          "penetration": 75,
          "players": {
            "learnerSeat": 0,
            "otherWagers": [],
            "strategy": null
          },
          "version": 1
        },
        "strategy": null
      },
      "random": {
        "key": [
          2752067618,
          698298832
        ],
        "protocol": 1,
        "session": [
          320440878,
          57701188
        ]
      },
      "checkpoint": "{\"activity\":{\"device\":\"device-1\",\"id\":\"blackjack-1\",\"owner\":\"local\"},\"balance\":\"990\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"0\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"blackjack\",\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"reference\":null,\"rules\":{\"id\":\"blackjack-six-deck\",\"version\":1},\"strategy\":null},\"outcome\":{\"active\":0,\"dealer\":[{\"deck\":1,\"rank\":10,\"suit\":\"spades\"},{\"deck\":3,\"rank\":6,\"suit\":\"spades\"}],\"hands\":[{\"cards\":[{\"deck\":2,\"rank\":10,\"suit\":\"spades\"},{\"deck\":1,\"rank\":11,\"suit\":\"diamonds\"}],\"done\":false,\"doubled\":false,\"surrendered\":false,\"target\":\"hand-1\"}],\"holeRevealed\":false,\"insurance\":\"not-offered\",\"others\":[],\"peek\":\"no-blackjack\"},\"phase\":\"open-decision\",\"random\":{\"block\":[77,0],\"exhausted\":false,\"key\":[2752067618,698298832],\"lane\":3,\"protocol\":1,\"session\":[320440878,57701188]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"hand-1\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1}],\"rules\":{\"dealer\":\"S17\",\"decks\":6,\"lateSurrender\":true,\"limits\":{\"initial\":{\"max\":\"1000\",\"min\":\"10\"}},\"penetration\":75,\"players\":{\"learnerSeat\":0,\"otherWagers\":[],\"strategy\":null}},\"schema\":4,\"sequence\":2,\"shoe\":{\"cut\":234,\"next\":4,\"order\":[152,100,75,200,65,35,242,282,199,132,190,280,241,71,178,116,209,74,95,225,151,16,155,72,268,18,239,39,187,191,119,156,188,123,231,186,243,276,91,208,179,32,279,184,109,196,27,53,29,263,44,61,234,11,41,33,183,106,244,114,122,262,54,289,235,133,120,181,150,229,292,307,103,232,67,141,189,217,167,245,115,129,51,285,76,73,161,134,0,13,8,126,83,298,63,64,124,185,7,146,137,306,224,138,30,59,297,154,164,250,213,201,34,98,9,219,77,211,10,284,93,88,136,104,43,286,270,40,130,110,149,24,171,17,112,157,36,304,274,256,153,246,58,172,197,139,143,162,267,26,214,94,160,203,227,78,45,113,247,21,301,278,79,14,87,80,273,218,135,23,308,2,252,302,1,253,66,111,261,221,305,55,228,163,92,57,175,22,281,264,6,15,210,216,147,81,68,290,85,125,19,283,117,192,170,56,265,176,287,127,140,168,173,174,311,237,108,177,220,204,266,82,212,248,158,69,60,255,233,296,159,293,28,166,5,207,294,20,142,25,105,84,309,12,238,275,128,259,37,295,303,165,90,193,180,198,257,271,277,121,230,182,97,260,310,249,269,223,101,300,215,206,4,31,50,38,47,48,42,102,131,194,195,49,288,240,96,118,52,226,145,205,202,99,299,272,169,3,222,144,62,89,254,291,46,236,107,251,86,148,258,70]},\"strategy\":null,\"turn\":1,\"wagers\":[{\"amount\":\"10\",\"target\":\"hand-1\"}]}",
      "continuation": [
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "settle-turn"
        },
        {
          "kind": "request-stop"
        },
        {
          "kind": "advance-final-settlement"
        }
      ],
      "facts": "[{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"hand-1\",\"turn\":1},{\"card\":{\"deck\":3,\"rank\":6,\"suit\":\"spades\"},\"kind\":\"hole-card-revealed\",\"turn\":1},{\"card\":{\"deck\":1,\"rank\":1,\"suit\":\"diamonds\"},\"kind\":\"card-dealt\",\"to\":\"dealer\",\"turn\":1},{\"kind\":\"wager-settled\",\"net\":\"10\",\"result\":\"win\",\"returned\":\"20\",\"stake\":\"10\",\"target\":\"hand-1\",\"turn\":1},{\"kind\":\"stop-requested\",\"phase\":\"settled-outcome\"},{\"balance\":\"1010\",\"kind\":\"activity-completed\"}]",
      "finalBalance": "1010"
    }
  ]
};
