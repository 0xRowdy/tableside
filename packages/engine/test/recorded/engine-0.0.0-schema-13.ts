// docs/development.md Releases: recorded checkpoints and the quarantine list
import type { RecordedBuild } from './index';

export const RECORDED_ENGINE_0_0_0_SCHEMA_13: RecordedBuild = {
  "engine": "0.0.0",
  "schema": 13,
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
      "checkpoint": "{\"activity\":{\"device\":\"device-1\",\"id\":\"activity-1\",\"owner\":\"local\"},\"balance\":\"985\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"0\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"roulette\",\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"version\":1},\"strategy\":null},\"outcome\":null,\"phase\":\"open-decision\",\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[2752067618,698298832],\"lane\":0,\"protocol\":1,\"session\":[320440878,57701188]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"red\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"amount\\\":\\\"5\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"straight-17\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1}],\"rules\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheel\":\"single-zero\"},\"schema\":13,\"sequence\":2,\"strategy\":null,\"turn\":0,\"wagers\":[{\"amount\":\"5\",\"target\":\"straight-17\"},{\"amount\":\"10\",\"target\":\"red\"}]}",
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
      "checkpoint": "{\"activity\":{\"device\":\"device-1\",\"id\":\"activity-1\",\"owner\":\"local\"},\"balance\":\"990\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"0\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"roulette\",\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"version\":1},\"strategy\":null},\"outcome\":{\"pocket\":27,\"turn\":1},\"phase\":\"revealing-outcome\",\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[2752067618,698298832],\"lane\":1,\"protocol\":1,\"session\":[320440878,57701188]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"red\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1}],\"rules\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheel\":\"single-zero\"},\"schema\":13,\"sequence\":2,\"strategy\":null,\"turn\":1,\"wagers\":[{\"amount\":\"10\",\"target\":\"red\"}]}",
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
      "checkpoint": "{\"activity\":{\"device\":\"device-1\",\"id\":\"activity-1\",\"owner\":\"local\"},\"balance\":\"990\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"10\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"roulette\",\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"version\":1},\"strategy\":null},\"outcome\":{\"pocket\":27,\"turn\":1},\"phase\":\"open-decision\",\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[2752067618,698298832],\"lane\":1,\"protocol\":1,\"session\":[320440878,57701188]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"red\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"settle-turn\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"amount\\\":\\\"20\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"black\\\"}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3}],\"rules\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheel\":\"single-zero\"},\"schema\":13,\"sequence\":4,\"strategy\":null,\"turn\":1,\"wagers\":[{\"amount\":\"20\",\"target\":\"black\"}]}",
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
      "checkpoint": "{\"activity\":{\"device\":\"device-1\",\"id\":\"activity-1\",\"owner\":\"local\"},\"balance\":\"1010\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"10\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"roulette\",\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"version\":1},\"strategy\":null},\"outcome\":{\"pocket\":27,\"turn\":1},\"phase\":\"final-settlement\",\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[2752067618,698298832],\"lane\":1,\"protocol\":1,\"session\":[320440878,57701188]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"red\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"settle-turn\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"even\\\"}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3},{\"command\":\"{\\\"kind\\\":\\\"request-stop\\\"}\",\"commandId\":\"record-4\",\"disposition\":\"applied\",\"sequence\":4}],\"rules\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheel\":\"single-zero\"},\"schema\":13,\"sequence\":5,\"strategy\":null,\"turn\":1,\"wagers\":[]}",
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
      "checkpoint": "{\"activity\":{\"device\":\"device-1\",\"id\":\"activity-1\",\"owner\":\"local\"},\"balance\":\"950\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"0\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"roulette\",\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"version\":1},\"strategy\":{\"id\":\"test-flat-even-money\",\"version\":1}},\"outcome\":null,\"phase\":\"correction\",\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[2752067618,698298832],\"lane\":0,\"protocol\":1,\"session\":[320440878,57701188]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"50\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"red\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"assessed\",\"sequence\":1}],\"rules\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheel\":\"single-zero\"},\"schema\":13,\"sequence\":2,\"strategy\":{\"coachedTurn\":false,\"correction\":{\"actual\":[{\"amount\":\"50\",\"target\":\"red\"}],\"explanation\":{\"fallback\":null,\"instructions\":[{\"id\":\"flat\",\"label\":\"1 unit on the target, every spin\"}],\"prescription\":{\"bets\":[{\"amount\":\"10\",\"target\":\"red\"}],\"held\":[],\"status\":\"prescribed\"},\"situation\":{\"available\":\"1000\",\"subjects\":{\"last-pocket-color\":\"none\",\"last-result\":\"none\"},\"values\":{}},\"state\":{\"counters\":{},\"cycleTurn\":0,\"lastResult\":\"none\",\"lists\":{}}},\"id\":\"activity-1/departure/1\",\"turn\":1},\"cycle\":{\"number\":1,\"turns\":[]},\"cycleEnd\":null,\"decisions\":{\"betting\":0,\"playing\":0},\"deferred\":null,\"definition\":{\"adjustments\":[],\"counters\":[],\"format\":1,\"game\":\"roulette\",\"id\":\"test-flat-even-money\",\"instructions\":[{\"bets\":[{\"amount\":{\"lit\":\"10\"},\"target\":{\"param\":\"target\"}}],\"id\":\"flat\",\"label\":\"1 unit on the target, every spin\",\"when\":{\"always\":true}}],\"name\":\"Flat even-money\",\"parameters\":[{\"choices\":[\"red\",\"black\",\"odd\",\"even\",\"low\",\"high\"],\"default\":\"red\",\"id\":\"target\",\"label\":\"Target\"}],\"revision\":1,\"stopWhen\":null,\"table\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheels\":[\"single-zero\",\"double-zero\"]}},\"departures\":[],\"parameters\":{\"target\":\"red\"},\"progress\":{\"counters\":{},\"cycleTurn\":0,\"lastResult\":\"none\",\"lists\":{}},\"status\":\"active\"},\"turn\":0,\"wagers\":[{\"amount\":\"50\",\"target\":\"red\"}]}",
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
      "facts": "[{\"departure\":{\"actual\":[{\"amount\":\"50\",\"target\":\"red\"}],\"explanation\":{\"fallback\":null,\"instructions\":[{\"id\":\"flat\",\"label\":\"1 unit on the target, every spin\"}],\"prescription\":{\"bets\":[{\"amount\":\"10\",\"target\":\"red\"}],\"held\":[],\"status\":\"prescribed\"},\"situation\":{\"available\":\"1000\",\"subjects\":{\"last-pocket-color\":\"none\",\"last-result\":\"none\"},\"values\":{}},\"state\":{\"counters\":{},\"cycleTurn\":0,\"lastResult\":\"none\",\"lists\":{}}},\"id\":\"activity-1/departure/1\",\"resolution\":\"retried\",\"turn\":1},\"kind\":\"departure-recorded\"},{\"amount\":\"10\",\"kind\":\"wager-changed\",\"previous\":\"50\",\"target\":\"red\"},{\"kind\":\"stop-requested\",\"phase\":\"open-decision\"},{\"amount\":\"10\",\"kind\":\"wager-returned\",\"target\":\"red\"},{\"balance\":\"1000\",\"kind\":\"activity-completed\"}]",
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
      "checkpoint": "{\"activity\":{\"device\":\"device-1\",\"id\":\"activity-1\",\"owner\":\"local\"},\"balance\":\"1050\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"50\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"roulette\",\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"version\":1},\"strategy\":{\"id\":\"test-doubling\",\"version\":3}},\"outcome\":{\"pocket\":27,\"turn\":1},\"phase\":\"cycle-completion\",\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[2752067618,698298832],\"lane\":1,\"protocol\":1,\"session\":[320440878,57701188]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"50\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"red\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"assessed\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"override-correction\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"kind\\\":\\\"settle-turn\\\"}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3}],\"rules\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheel\":\"single-zero\"},\"schema\":13,\"sequence\":4,\"strategy\":{\"coachedTurn\":false,\"correction\":null,\"cycle\":{\"number\":1,\"turns\":[{\"followed\":false,\"net\":\"50\",\"outcome\":\"27\",\"turn\":1,\"wagers\":[{\"amount\":\"50\",\"target\":\"red\"}]}]},\"cycleEnd\":\"override\",\"decisions\":{\"betting\":1,\"playing\":0},\"deferred\":null,\"definition\":{\"adjustments\":[{\"counter\":\"stake\",\"id\":\"double\",\"on\":\"loss\",\"to\":{\"mul\":[{\"counter\":\"stake\"},{\"lit\":\"2\"}]}},{\"counter\":\"stake\",\"id\":\"reset\",\"on\":\"win\",\"to\":{\"lit\":\"10\"}}],\"counters\":[{\"cap\":\"320\",\"id\":\"stake\",\"initial\":\"10\"}],\"format\":1,\"game\":\"roulette\",\"id\":\"test-doubling\",\"instructions\":[{\"bets\":[{\"amount\":{\"counter\":\"stake\"},\"target\":{\"target\":\"red\"}}],\"id\":\"bet\",\"label\":\"The stake on red\",\"when\":{\"always\":true}}],\"name\":\"Doubling on red\",\"parameters\":[],\"revision\":3,\"stopWhen\":null,\"table\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheels\":[\"single-zero\",\"double-zero\"]}},\"departures\":[{\"actual\":[{\"amount\":\"50\",\"target\":\"red\"}],\"explanation\":{\"fallback\":null,\"instructions\":[{\"id\":\"bet\",\"label\":\"The stake on red\"}],\"prescription\":{\"bets\":[{\"amount\":\"10\",\"target\":\"red\"}],\"held\":[],\"status\":\"prescribed\"},\"situation\":{\"available\":\"1000\",\"subjects\":{\"last-pocket-color\":\"none\",\"last-result\":\"none\"},\"values\":{}},\"state\":{\"counters\":{\"stake\":\"10\"},\"cycleTurn\":0,\"lastResult\":\"none\",\"lists\":{}}},\"id\":\"activity-1/departure/1\",\"resolution\":\"overridden\",\"turn\":1}],\"parameters\":{},\"progress\":{\"counters\":{\"stake\":\"10\"},\"cycleTurn\":0,\"lastResult\":\"none\",\"lists\":{}},\"status\":\"cycle-ended\"},\"turn\":1,\"wagers\":[]}",
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
      "checkpoint": "{\"activity\":{\"device\":\"device-1\",\"id\":\"craps-1\",\"owner\":\"local\"},\"balance\":\"990\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"0\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"craps\",\"random\":{\"key\":[1,0],\"protocol\":1,\"session\":[0,0]},\"reference\":null,\"rules\":{\"id\":\"standard-craps\",\"version\":2},\"strategy\":null},\"instructions\":[],\"outcome\":{\"dice\":[5,1],\"turn\":1},\"phase\":\"settled-outcome\",\"point\":6,\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[1,0],\"lane\":2,\"protocol\":1,\"session\":[0,0]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"pass\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"amount\\\":\\\"5\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"field\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"assessed\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"kind\\\":\\\"settle-turn\\\"}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3}],\"rules\":{\"field\":\"triple-12\",\"limits\":{\"flat\":{\"max\":\"1000\",\"min\":\"10\"},\"props\":{\"max\":\"100\",\"min\":\"1\"}},\"odds\":\"3-4-5x\"},\"schema\":13,\"sequence\":4,\"strategy\":null,\"turn\":1,\"wagers\":[{\"amount\":\"10\",\"target\":\"pass\"}]}",
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
      "name": "craps guided, Stop strategy with the pass line contract settling",
      "game": "craps",
      "phase": "strategy-settlement",
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
        "strategy": {
          "definition": {
            "adjustments": [],
            "counters": [],
            "format": 1,
            "game": "craps",
            "id": "test-pass-with-odds",
            "instructions": [
              {
                "bets": [
                  {
                    "amount": {
                      "lit": "10"
                    },
                    "target": {
                      "target": "pass"
                    }
                  }
                ],
                "id": "come-out",
                "label": "Pass 10 on the come-out",
                "when": {
                  "is": "none",
                  "subject": "point"
                }
              },
              {
                "bets": [
                  {
                    "amount": {
                      "lit": "10"
                    },
                    "target": {
                      "target": "pass"
                    }
                  },
                  {
                    "amount": {
                      "lit": "10"
                    },
                    "target": {
                      "target": "pass-odds"
                    }
                  }
                ],
                "id": "odds",
                "label": "10 odds behind the pass line",
                "when": {
                  "any": [
                    {
                      "all": [
                        {
                          "is": "4",
                          "subject": "point"
                        },
                        {
                          "is": "on",
                          "subject": "pass"
                        }
                      ]
                    },
                    {
                      "all": [
                        {
                          "is": "5",
                          "subject": "point"
                        },
                        {
                          "is": "on",
                          "subject": "pass"
                        }
                      ]
                    },
                    {
                      "all": [
                        {
                          "is": "6",
                          "subject": "point"
                        },
                        {
                          "is": "on",
                          "subject": "pass"
                        }
                      ]
                    },
                    {
                      "all": [
                        {
                          "is": "8",
                          "subject": "point"
                        },
                        {
                          "is": "on",
                          "subject": "pass"
                        }
                      ]
                    },
                    {
                      "all": [
                        {
                          "is": "9",
                          "subject": "point"
                        },
                        {
                          "is": "on",
                          "subject": "pass"
                        }
                      ]
                    },
                    {
                      "all": [
                        {
                          "is": "10",
                          "subject": "point"
                        },
                        {
                          "is": "on",
                          "subject": "pass"
                        }
                      ]
                    }
                  ]
                }
              }
            ],
            "name": "Pass with odds",
            "parameters": [],
            "revision": 1,
            "stopWhen": null,
            "table": {
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
              "odds": [
                "1x",
                "2x",
                "3-4-5x",
                "5x",
                "10x"
              ]
            }
          },
          "parameters": {}
        }
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
      "checkpoint": "{\"activity\":{\"device\":\"device-1\",\"id\":\"craps-1\",\"owner\":\"local\"},\"balance\":\"990\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"0\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"craps\",\"random\":{\"key\":[1,0],\"protocol\":1,\"session\":[0,0]},\"reference\":null,\"rules\":{\"id\":\"standard-craps\",\"version\":2},\"strategy\":{\"id\":\"test-pass-with-odds\",\"version\":1}},\"instructions\":[],\"outcome\":{\"dice\":[5,1],\"turn\":1},\"phase\":\"strategy-settlement\",\"point\":6,\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[1,0],\"lane\":2,\"protocol\":1,\"session\":[0,0]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"pass\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"settle-turn\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"kind\\\":\\\"stop-strategy\\\"}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3}],\"rules\":{\"field\":\"triple-12\",\"limits\":{\"flat\":{\"max\":\"1000\",\"min\":\"10\"},\"props\":{\"max\":\"100\",\"min\":\"1\"}},\"odds\":\"3-4-5x\"},\"schema\":13,\"sequence\":4,\"strategy\":{\"coachedTurn\":false,\"correction\":null,\"cycle\":{\"number\":1,\"turns\":[{\"followed\":true,\"net\":\"0\",\"outcome\":\"5+1\",\"turn\":1,\"wagers\":[{\"amount\":\"10\",\"target\":\"pass\"}]}]},\"cycleEnd\":null,\"decisions\":{\"betting\":1,\"playing\":0},\"deferred\":null,\"definition\":{\"adjustments\":[],\"counters\":[],\"format\":1,\"game\":\"craps\",\"id\":\"test-pass-with-odds\",\"instructions\":[{\"bets\":[{\"amount\":{\"lit\":\"10\"},\"target\":{\"target\":\"pass\"}}],\"id\":\"come-out\",\"label\":\"Pass 10 on the come-out\",\"when\":{\"is\":\"none\",\"subject\":\"point\"}},{\"bets\":[{\"amount\":{\"lit\":\"10\"},\"target\":{\"target\":\"pass\"}},{\"amount\":{\"lit\":\"10\"},\"target\":{\"target\":\"pass-odds\"}}],\"id\":\"odds\",\"label\":\"10 odds behind the pass line\",\"when\":{\"any\":[{\"all\":[{\"is\":\"4\",\"subject\":\"point\"},{\"is\":\"on\",\"subject\":\"pass\"}]},{\"all\":[{\"is\":\"5\",\"subject\":\"point\"},{\"is\":\"on\",\"subject\":\"pass\"}]},{\"all\":[{\"is\":\"6\",\"subject\":\"point\"},{\"is\":\"on\",\"subject\":\"pass\"}]},{\"all\":[{\"is\":\"8\",\"subject\":\"point\"},{\"is\":\"on\",\"subject\":\"pass\"}]},{\"all\":[{\"is\":\"9\",\"subject\":\"point\"},{\"is\":\"on\",\"subject\":\"pass\"}]},{\"all\":[{\"is\":\"10\",\"subject\":\"point\"},{\"is\":\"on\",\"subject\":\"pass\"}]}]}}],\"name\":\"Pass with odds\",\"parameters\":[],\"revision\":1,\"stopWhen\":null,\"table\":{\"limits\":{\"flat\":{\"max\":\"1000\",\"min\":\"10\"},\"props\":{\"max\":\"100\",\"min\":\"1\"}},\"odds\":[\"1x\",\"2x\",\"3-4-5x\",\"5x\",\"10x\"]}},\"departures\":[],\"parameters\":{},\"progress\":{\"counters\":{},\"cycleTurn\":1,\"lastResult\":\"push\",\"lists\":{}},\"status\":\"stopped\"},\"turn\":1,\"wagers\":[{\"amount\":\"10\",\"target\":\"pass\"}]}",
      "continuation": [
        {
          "kind": "advance-strategy-settlement"
        },
        {
          "kind": "advance-strategy-settlement"
        },
        {
          "kind": "advance-strategy-settlement"
        },
        {
          "kind": "advance-strategy-settlement"
        },
        {
          "kind": "advance-strategy-settlement"
        },
        {
          "kind": "advance-strategy-settlement"
        },
        {
          "kind": "advance-strategy-settlement"
        },
        {
          "kind": "advance-strategy-settlement"
        },
        {
          "kind": "advance-strategy-settlement"
        },
        {
          "kind": "advance-strategy-settlement"
        },
        {
          "kind": "request-stop"
        },
        {
          "kind": "advance-final-settlement"
        }
      ],
      "facts": "[{\"kind\":\"turn-began\",\"turn\":2,\"wagers\":[{\"amount\":\"10\",\"target\":\"pass\"}]},{\"dice\":[3,2],\"kind\":\"dice-rolled\",\"turn\":2},{\"kind\":\"turn-began\",\"turn\":3,\"wagers\":[{\"amount\":\"10\",\"target\":\"pass\"}]},{\"dice\":[6,5],\"kind\":\"dice-rolled\",\"turn\":3},{\"kind\":\"turn-began\",\"turn\":4,\"wagers\":[{\"amount\":\"10\",\"target\":\"pass\"}]},{\"dice\":[6,6],\"kind\":\"dice-rolled\",\"turn\":4},{\"kind\":\"turn-began\",\"turn\":5,\"wagers\":[{\"amount\":\"10\",\"target\":\"pass\"}]},{\"dice\":[1,4],\"kind\":\"dice-rolled\",\"turn\":5},{\"kind\":\"turn-began\",\"turn\":6,\"wagers\":[{\"amount\":\"10\",\"target\":\"pass\"}]},{\"dice\":[5,3],\"kind\":\"dice-rolled\",\"turn\":6},{\"kind\":\"turn-began\",\"turn\":7,\"wagers\":[{\"amount\":\"10\",\"target\":\"pass\"}]},{\"dice\":[4,1],\"kind\":\"dice-rolled\",\"turn\":7},{\"kind\":\"turn-began\",\"turn\":8,\"wagers\":[{\"amount\":\"10\",\"target\":\"pass\"}]},{\"dice\":[4,1],\"kind\":\"dice-rolled\",\"turn\":8},{\"kind\":\"turn-began\",\"turn\":9,\"wagers\":[{\"amount\":\"10\",\"target\":\"pass\"}]},{\"dice\":[1,3],\"kind\":\"dice-rolled\",\"turn\":9},{\"kind\":\"turn-began\",\"turn\":10,\"wagers\":[{\"amount\":\"10\",\"target\":\"pass\"}]},{\"dice\":[2,3],\"kind\":\"dice-rolled\",\"turn\":10},{\"kind\":\"turn-began\",\"turn\":11,\"wagers\":[{\"amount\":\"10\",\"target\":\"pass\"}]},{\"dice\":[1,5],\"kind\":\"dice-rolled\",\"turn\":11},{\"kind\":\"wager-settled\",\"net\":\"10\",\"result\":\"win\",\"returned\":\"20\",\"stake\":\"10\",\"target\":\"pass\",\"turn\":11},{\"kind\":\"point-changed\",\"point\":null,\"turn\":11},{\"kind\":\"stop-requested\",\"phase\":\"settled-outcome\"},{\"balance\":\"1010\",\"kind\":\"activity-completed\"}]",
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
      "checkpoint": "{\"activity\":{\"device\":\"device-1\",\"id\":\"blackjack-1\",\"owner\":\"local\"},\"balance\":\"990\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"0\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"blackjack\",\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"reference\":null,\"rules\":{\"id\":\"blackjack-six-deck\",\"version\":1},\"strategy\":null},\"outcome\":{\"active\":0,\"dealer\":[{\"deck\":1,\"rank\":10,\"suit\":\"spades\"},{\"deck\":3,\"rank\":6,\"suit\":\"spades\"}],\"hands\":[{\"cards\":[{\"deck\":2,\"rank\":10,\"suit\":\"spades\"},{\"deck\":1,\"rank\":11,\"suit\":\"diamonds\"}],\"done\":false,\"doubled\":false,\"surrendered\":false,\"target\":\"hand-1\"}],\"holeRevealed\":false,\"insurance\":\"not-offered\",\"others\":[],\"peek\":\"no-blackjack\"},\"phase\":\"open-decision\",\"random\":{\"block\":[77,0],\"exhausted\":false,\"key\":[2752067618,698298832],\"lane\":3,\"protocol\":1,\"session\":[320440878,57701188]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"hand-1\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1}],\"rules\":{\"dealer\":\"S17\",\"decks\":6,\"lateSurrender\":true,\"limits\":{\"initial\":{\"max\":\"1000\",\"min\":\"10\"}},\"penetration\":75,\"players\":{\"learnerSeat\":0,\"otherWagers\":[],\"strategy\":null}},\"schema\":13,\"sequence\":2,\"shoe\":{\"cut\":234,\"next\":4,\"order\":[152,100,75,200,65,35,242,282,199,132,190,280,241,71,178,116,209,74,95,225,151,16,155,72,268,18,239,39,187,191,119,156,188,123,231,186,243,276,91,208,179,32,279,184,109,196,27,53,29,263,44,61,234,11,41,33,183,106,244,114,122,262,54,289,235,133,120,181,150,229,292,307,103,232,67,141,189,217,167,245,115,129,51,285,76,73,161,134,0,13,8,126,83,298,63,64,124,185,7,146,137,306,224,138,30,59,297,154,164,250,213,201,34,98,9,219,77,211,10,284,93,88,136,104,43,286,270,40,130,110,149,24,171,17,112,157,36,304,274,256,153,246,58,172,197,139,143,162,267,26,214,94,160,203,227,78,45,113,247,21,301,278,79,14,87,80,273,218,135,23,308,2,252,302,1,253,66,111,261,221,305,55,228,163,92,57,175,22,281,264,6,15,210,216,147,81,68,290,85,125,19,283,117,192,170,56,265,176,287,127,140,168,173,174,311,237,108,177,220,204,266,82,212,248,158,69,60,255,233,296,159,293,28,166,5,207,294,20,142,25,105,84,309,12,238,275,128,259,37,295,303,165,90,193,180,198,257,271,277,121,230,182,97,260,310,249,269,223,101,300,215,206,4,31,50,38,47,48,42,102,131,194,195,49,288,240,96,118,52,226,145,205,202,99,299,272,169,3,222,144,62,89,254,291,46,236,107,251,86,148,258,70]},\"strategy\":null,\"turn\":1,\"wagers\":[{\"amount\":\"10\",\"target\":\"hand-1\"}]}",
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
    },
    {
      "name": "blackjack guided, counting with the bet schedule, a betting correction waiting",
      "game": "blackjack",
      "phase": "correction",
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
        "strategy": {
          "definition": {
            "adjustments": [],
            "counters": [],
            "format": 1,
            "game": "blackjack",
            "id": "test-blackjack-counting-schedule",
            "instructions": [
              {
                "bets": [
                  {
                    "amount": {
                      "lit": "10"
                    },
                    "target": {
                      "target": "hand-1"
                    }
                  }
                ],
                "id": "below-1",
                "label": "Below +1: 1 unit",
                "priority": 0,
                "when": {
                  "always": true
                }
              },
              {
                "bets": [
                  {
                    "amount": {
                      "lit": "20"
                    },
                    "target": {
                      "target": "hand-1"
                    }
                  }
                ],
                "id": "from-1",
                "label": "+1: 2 units",
                "priority": 1,
                "when": {
                  "compare": {
                    "value": "true-count"
                  },
                  "op": "ge",
                  "to": {
                    "lit": "1"
                  }
                }
              },
              {
                "bets": [
                  {
                    "amount": {
                      "lit": "40"
                    },
                    "target": {
                      "target": "hand-1"
                    }
                  }
                ],
                "id": "from-2",
                "label": "+2: 4 units",
                "priority": 2,
                "when": {
                  "compare": {
                    "value": "true-count"
                  },
                  "op": "ge",
                  "to": {
                    "lit": "2"
                  }
                }
              },
              {
                "bets": [
                  {
                    "amount": {
                      "lit": "60"
                    },
                    "target": {
                      "target": "hand-1"
                    }
                  }
                ],
                "id": "from-3",
                "label": "+3: 6 units",
                "priority": 3,
                "when": {
                  "compare": {
                    "value": "true-count"
                  },
                  "op": "ge",
                  "to": {
                    "lit": "3"
                  }
                }
              },
              {
                "bets": [
                  {
                    "amount": {
                      "lit": "80"
                    },
                    "target": {
                      "target": "hand-1"
                    }
                  }
                ],
                "id": "from-4",
                "label": "+4 or more: 8 units",
                "priority": 4,
                "when": {
                  "compare": {
                    "value": "true-count"
                  },
                  "op": "ge",
                  "to": {
                    "lit": "4"
                  }
                }
              }
            ],
            "name": "Counting with basic",
            "parameters": [],
            "play": {
              "count": "player",
              "deviations": [],
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
                  "pair": [
                    "HHHHHHHHHH",
                    "HHHHHHHHHH",
                    "HHHHHHHHHH",
                    "HHHHHHHHHH",
                    "HHHHHHHHHH",
                    "HHHHHHHHHH",
                    "HHHHHHHHHH",
                    "HHHHHHHHHH",
                    "SHHHHHSHHS",
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
                  "pair": [
                    "HHHHHHHHHH",
                    "HHHHHHHHHH",
                    "HHHHHHHHHH",
                    "HHHHHHHHHH",
                    "HHHHHHHHHH",
                    "HHHHHHHHHH",
                    "HHHHHHHHHH",
                    "HHHHHHHHHH",
                    "SHHHHHSHHS",
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
                  ]
                },
                "splitByBalance": [
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HSSSSSHHHH",
                  "HSSSSSHHHH",
                  "RSSSSSHHRR",
                  "SSSSSSSSSS",
                  "SSSSSSSSSS"
                ],
                "splitByRule": [
                  "SSSSSSSSSS",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HDDDDDDDDH",
                  "HSSSSSHHHH",
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
                  ],
                  "soft": [
                    "HHHHHHHHHH",
                    "HHHHDDHHHH",
                    "HHHHDDHHHH",
                    "HHHDDDHHHH",
                    "HHHDDDHHHH",
                    "HHDDDDHHHH",
                    "HSDDDDSSHH",
                    "SSSSSSSSSS",
                    "SSSSSSSSSS"
                  ]
                }
              },
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
                ],
                "soft": [
                  "HHHHHHHHHH",
                  "HHHHDDHHHH",
                  "HHHHDDHHHH",
                  "HHHDDDHHHH",
                  "HHHDDDHHHH",
                  "HHDDDDHHHH",
                  "HSDDDDSSHH",
                  "SSSSSSSSSS",
                  "SSSSSSSSSS"
                ]
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
                  "HHHHHHHHHH",
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
            },
            "revision": 1,
            "stopWhen": null,
            "table": {
              "dealer": "S17",
              "lateSurrender": true,
              "limits": {
                "initial": {
                  "max": "1000",
                  "min": "10"
                }
              }
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
      "checkpoint": "{\"activity\":{\"device\":\"device-1\",\"id\":\"blackjack-1\",\"owner\":\"local\"},\"balance\":\"950\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"0\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"blackjack\",\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"reference\":null,\"rules\":{\"id\":\"blackjack-six-deck\",\"version\":1},\"strategy\":{\"id\":\"test-blackjack-counting-schedule\",\"version\":1}},\"outcome\":null,\"phase\":\"correction\",\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[2752067618,698298832],\"lane\":0,\"protocol\":1,\"session\":[320440878,57701188]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"50\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"hand-1\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"assessed\",\"sequence\":1}],\"rules\":{\"dealer\":\"S17\",\"decks\":6,\"lateSurrender\":true,\"limits\":{\"initial\":{\"max\":\"1000\",\"min\":\"10\"}},\"penetration\":75,\"players\":{\"learnerSeat\":0,\"otherWagers\":[],\"strategy\":null}},\"schema\":13,\"sequence\":2,\"shoe\":null,\"strategy\":{\"coachedTurn\":false,\"correction\":{\"actual\":[{\"amount\":\"50\",\"target\":\"hand-1\"}],\"explanation\":{\"fallback\":null,\"instructions\":[{\"id\":\"below-1\",\"label\":\"Below +1: 1 unit\"}],\"prescription\":{\"bets\":[{\"amount\":\"10\",\"target\":\"hand-1\"}],\"held\":[],\"status\":\"prescribed\"},\"situation\":{\"available\":\"1000\",\"subjects\":{\"last-result\":\"none\"},\"values\":{\"true-count\":\"0\"}},\"state\":{\"counters\":{},\"cycleTurn\":0,\"lastResult\":\"none\",\"lists\":{}}},\"id\":\"blackjack-1/departure/1\",\"turn\":1},\"cycle\":{\"number\":1,\"turns\":[]},\"cycleEnd\":null,\"decisions\":{\"betting\":0,\"playing\":0},\"deferred\":null,\"definition\":{\"adjustments\":[],\"counters\":[],\"format\":1,\"game\":\"blackjack\",\"id\":\"test-blackjack-counting-schedule\",\"instructions\":[{\"bets\":[{\"amount\":{\"lit\":\"10\"},\"target\":{\"target\":\"hand-1\"}}],\"id\":\"below-1\",\"label\":\"Below +1: 1 unit\",\"priority\":0,\"when\":{\"always\":true}},{\"bets\":[{\"amount\":{\"lit\":\"20\"},\"target\":{\"target\":\"hand-1\"}}],\"id\":\"from-1\",\"label\":\"+1: 2 units\",\"priority\":1,\"when\":{\"compare\":{\"value\":\"true-count\"},\"op\":\"ge\",\"to\":{\"lit\":\"1\"}}},{\"bets\":[{\"amount\":{\"lit\":\"40\"},\"target\":{\"target\":\"hand-1\"}}],\"id\":\"from-2\",\"label\":\"+2: 4 units\",\"priority\":2,\"when\":{\"compare\":{\"value\":\"true-count\"},\"op\":\"ge\",\"to\":{\"lit\":\"2\"}}},{\"bets\":[{\"amount\":{\"lit\":\"60\"},\"target\":{\"target\":\"hand-1\"}}],\"id\":\"from-3\",\"label\":\"+3: 6 units\",\"priority\":3,\"when\":{\"compare\":{\"value\":\"true-count\"},\"op\":\"ge\",\"to\":{\"lit\":\"3\"}}},{\"bets\":[{\"amount\":{\"lit\":\"80\"},\"target\":{\"target\":\"hand-1\"}}],\"id\":\"from-4\",\"label\":\"+4 or more: 8 units\",\"priority\":4,\"when\":{\"compare\":{\"value\":\"true-count\"},\"op\":\"ge\",\"to\":{\"lit\":\"4\"}}}],\"name\":\"Counting with basic\",\"parameters\":[],\"play\":{\"count\":\"player\",\"deviations\":[],\"fallbacks\":{\"double\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SHHHHHSHHS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"doubleOnOriginalLateSurrender\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHR\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SHHHHHSHHS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"splitByBalance\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"splitByRule\":[\"SSSSSSSSSS\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"surrender\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"PPPPPPPPPP\",\"HPPPPPPHHH\",\"HPPPPPPHHH\",\"HHHHPPHHHH\",\"HDDDDDDDDH\",\"HPPPPPHHHH\",\"HPPPPPPHHH\",\"PPPPPPPPPP\",\"SPPPPPSPPS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]}},\"first\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHR\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"PPPPPPPPPP\",\"HPPPPPPHHH\",\"HPPPPPPHHH\",\"HHHHPPHHHH\",\"HDDDDDDDDH\",\"HPPPPPHHHH\",\"HPPPPPPHHH\",\"PPPPPPPPPP\",\"SPPPPPSPPS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"later\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"laterWithoutDouble\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]}},\"revision\":1,\"stopWhen\":null,\"table\":{\"dealer\":\"S17\",\"lateSurrender\":true,\"limits\":{\"initial\":{\"max\":\"1000\",\"min\":\"10\"}}}},\"departures\":[],\"parameters\":{},\"progress\":{\"counters\":{},\"cycleTurn\":0,\"lastResult\":\"none\",\"lists\":{}},\"status\":\"active\"},\"turn\":0,\"wagers\":[{\"amount\":\"50\",\"target\":\"hand-1\"}]}",
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
      "facts": "[{\"departure\":{\"actual\":[{\"amount\":\"50\",\"target\":\"hand-1\"}],\"explanation\":{\"fallback\":null,\"instructions\":[{\"id\":\"below-1\",\"label\":\"Below +1: 1 unit\"}],\"prescription\":{\"bets\":[{\"amount\":\"10\",\"target\":\"hand-1\"}],\"held\":[],\"status\":\"prescribed\"},\"situation\":{\"available\":\"1000\",\"subjects\":{\"last-result\":\"none\"},\"values\":{\"true-count\":\"0\"}},\"state\":{\"counters\":{},\"cycleTurn\":0,\"lastResult\":\"none\",\"lists\":{}}},\"id\":\"blackjack-1/departure/1\",\"resolution\":\"retried\",\"turn\":1},\"kind\":\"departure-recorded\"},{\"amount\":\"10\",\"kind\":\"wager-changed\",\"previous\":\"50\",\"target\":\"hand-1\"},{\"kind\":\"stop-requested\",\"phase\":\"open-decision\"},{\"amount\":\"10\",\"kind\":\"wager-returned\",\"target\":\"hand-1\"},{\"balance\":\"1000\",\"kind\":\"activity-completed\"}]",
      "finalBalance": "1000"
    }
  ],
  "challenges": [
    {
      "name": "card values Learn, created and not yet begun",
      "category": "card-values",
      "phase": "ready",
      "specification": {
        "attemptId": "attempt-1",
        "content": {
          "category": "card-values",
          "coverage": "every-rank",
          "id": "card-values",
          "length": 20,
          "version": 1
        },
        "device": "device-1",
        "owner": "owner-1",
        "variant": "learn"
      },
      "random": {
        "key": [
          1,
          2654435769
        ],
        "protocol": 1,
        "session": [
          8,
          0
        ]
      },
      "checkpoint": "{\"answers\":[],\"attempt\":{\"device\":\"device-1\",\"id\":\"attempt-1\",\"owner\":\"owner-1\"},\"content\":{\"category\":\"card-values\",\"coverage\":\"every-rank\",\"id\":\"card-values\",\"length\":20,\"version\":1},\"ending\":null,\"identities\":{\"category\":\"card-values\",\"content\":{\"id\":\"card-values\",\"version\":1},\"engine\":\"0.0.0\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":null},\"items\":[],\"phase\":\"ready\",\"position\":0,\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":0,\"protocol\":1,\"session\":[8,0]},\"receipts\":[],\"rejected\":0,\"revealedAt\":null,\"schema\":13,\"sequence\":0,\"table\":null,\"variant\":\"learn\"}",
      "continuation": [
        {
          "kind": "begin"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        }
      ],
      "facts": "[{\"kind\":\"content-shown\",\"position\":0},{\"kind\":\"answer-accepted\",\"position\":0,\"scored\":true},{\"kind\":\"content-shown\",\"position\":1},{\"kind\":\"answer-accepted\",\"position\":1,\"scored\":true},{\"kind\":\"content-shown\",\"position\":2},{\"kind\":\"answer-accepted\",\"position\":2,\"scored\":true},{\"kind\":\"content-shown\",\"position\":3},{\"kind\":\"answer-accepted\",\"position\":3,\"scored\":true},{\"kind\":\"content-shown\",\"position\":4},{\"kind\":\"answer-accepted\",\"position\":4,\"scored\":true},{\"kind\":\"content-shown\",\"position\":5},{\"kind\":\"answer-accepted\",\"position\":5,\"scored\":true},{\"kind\":\"content-shown\",\"position\":6},{\"kind\":\"answer-accepted\",\"position\":6,\"scored\":true},{\"kind\":\"content-shown\",\"position\":7},{\"kind\":\"answer-accepted\",\"position\":7,\"scored\":true},{\"kind\":\"content-shown\",\"position\":8},{\"kind\":\"answer-accepted\",\"position\":8,\"scored\":true},{\"kind\":\"content-shown\",\"position\":9},{\"kind\":\"answer-accepted\",\"position\":9,\"scored\":true},{\"kind\":\"content-shown\",\"position\":10},{\"kind\":\"answer-accepted\",\"position\":10,\"scored\":true},{\"kind\":\"content-shown\",\"position\":11},{\"kind\":\"answer-accepted\",\"position\":11,\"scored\":true},{\"kind\":\"content-shown\",\"position\":12},{\"kind\":\"answer-accepted\",\"position\":12,\"scored\":true},{\"kind\":\"content-shown\",\"position\":13},{\"kind\":\"answer-accepted\",\"position\":13,\"scored\":true},{\"kind\":\"content-shown\",\"position\":14},{\"kind\":\"answer-accepted\",\"position\":14,\"scored\":true},{\"kind\":\"content-shown\",\"position\":15},{\"kind\":\"answer-accepted\",\"position\":15,\"scored\":true},{\"kind\":\"content-shown\",\"position\":16},{\"kind\":\"answer-accepted\",\"position\":16,\"scored\":true},{\"kind\":\"content-shown\",\"position\":17},{\"kind\":\"answer-accepted\",\"position\":17,\"scored\":true},{\"kind\":\"content-shown\",\"position\":18},{\"kind\":\"answer-accepted\",\"position\":18,\"scored\":true},{\"kind\":\"content-shown\",\"position\":19},{\"kind\":\"answer-accepted\",\"position\":19,\"scored\":true},{\"ending\":\"completed\",\"kind\":\"attempt-ended\"}]",
      "results": "{\"assistanceStep\":null,\"assisted\":true,\"ending\":\"completed\",\"finances\":null,\"metrics\":{\"betting-adherence\":null,\"card-values\":{\"correct\":5,\"total\":20},\"playing-adherence\":null,\"running-count\":null,\"true-count\":null},\"review\":[{\"card\":{\"rank\":5,\"suit\":\"diamonds\"},\"entered\":0,\"kind\":\"card-value\",\"position\":1,\"reference\":1},{\"card\":{\"rank\":7,\"suit\":\"diamonds\"},\"entered\":0,\"kind\":\"card-value\",\"position\":2,\"reference\":0},{\"card\":{\"rank\":10,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":3,\"reference\":-1},{\"card\":{\"rank\":2,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":4,\"reference\":1},{\"card\":{\"rank\":7,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":5,\"reference\":0},{\"card\":{\"rank\":2,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":6,\"reference\":1},{\"card\":{\"rank\":11,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":7,\"reference\":-1},{\"card\":{\"rank\":4,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":8,\"reference\":1},{\"card\":{\"rank\":6,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":9,\"reference\":1},{\"card\":{\"rank\":11,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":10,\"reference\":-1},{\"card\":{\"rank\":12,\"suit\":\"diamonds\"},\"entered\":0,\"kind\":\"card-value\",\"position\":11,\"reference\":-1},{\"card\":{\"rank\":9,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":12,\"reference\":0},{\"card\":{\"rank\":2,\"suit\":\"diamonds\"},\"entered\":0,\"kind\":\"card-value\",\"position\":13,\"reference\":1},{\"card\":{\"rank\":6,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":14,\"reference\":1},{\"card\":{\"rank\":2,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":15,\"reference\":1},{\"card\":{\"rank\":1,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":16,\"reference\":-1},{\"card\":{\"rank\":9,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":17,\"reference\":0},{\"card\":{\"rank\":8,\"suit\":\"diamonds\"},\"entered\":0,\"kind\":\"card-value\",\"position\":18,\"reference\":0},{\"card\":{\"rank\":3,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":19,\"reference\":1},{\"card\":{\"rank\":13,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":20,\"reference\":-1}]}"
    },
    {
      "name": "card values Learn, a card waiting for its answer",
      "category": "card-values",
      "phase": "question",
      "specification": {
        "attemptId": "attempt-1",
        "content": {
          "category": "card-values",
          "coverage": "every-rank",
          "id": "card-values",
          "length": 20,
          "version": 1
        },
        "device": "device-1",
        "owner": "owner-1",
        "variant": "learn"
      },
      "random": {
        "key": [
          1,
          2654435769
        ],
        "protocol": 1,
        "session": [
          8,
          0
        ]
      },
      "checkpoint": "{\"answers\":[{\"first\":1,\"last\":1,\"position\":0,\"tries\":1}],\"attempt\":{\"device\":\"device-1\",\"id\":\"attempt-1\",\"owner\":\"owner-1\"},\"content\":{\"category\":\"card-values\",\"coverage\":\"every-rank\",\"id\":\"card-values\",\"length\":20,\"version\":1},\"ending\":null,\"identities\":{\"category\":\"card-values\",\"content\":{\"id\":\"card-values\",\"version\":1},\"engine\":\"0.0.0\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":null},\"items\":[{\"card\":{\"rank\":5,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":7,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":10,\"suit\":\"clubs\"}},{\"card\":{\"rank\":2,\"suit\":\"clubs\"}},{\"card\":{\"rank\":7,\"suit\":\"hearts\"}},{\"card\":{\"rank\":2,\"suit\":\"spades\"}},{\"card\":{\"rank\":11,\"suit\":\"hearts\"}},{\"card\":{\"rank\":4,\"suit\":\"spades\"}},{\"card\":{\"rank\":6,\"suit\":\"hearts\"}},{\"card\":{\"rank\":11,\"suit\":\"clubs\"}},{\"card\":{\"rank\":12,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":9,\"suit\":\"hearts\"}},{\"card\":{\"rank\":2,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":6,\"suit\":\"hearts\"}},{\"card\":{\"rank\":2,\"suit\":\"spades\"}},{\"card\":{\"rank\":1,\"suit\":\"clubs\"}},{\"card\":{\"rank\":9,\"suit\":\"spades\"}},{\"card\":{\"rank\":8,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":3,\"suit\":\"clubs\"}},{\"card\":{\"rank\":13,\"suit\":\"spades\"}}],\"phase\":\"question\",\"position\":1,\"random\":{\"block\":[200,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":0,\"protocol\":1,\"session\":[8,0]},\"receipts\":[{\"command\":\"{\\\"kind\\\":\\\"begin\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":1}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2}],\"rejected\":39,\"revealedAt\":null,\"schema\":13,\"sequence\":3,\"table\":null,\"variant\":\"learn\"}",
      "continuation": [
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        }
      ],
      "facts": "[{\"kind\":\"answer-accepted\",\"position\":1,\"scored\":true},{\"kind\":\"content-shown\",\"position\":2},{\"kind\":\"answer-accepted\",\"position\":2,\"scored\":true},{\"kind\":\"content-shown\",\"position\":3},{\"kind\":\"answer-accepted\",\"position\":3,\"scored\":true},{\"kind\":\"content-shown\",\"position\":4},{\"kind\":\"answer-accepted\",\"position\":4,\"scored\":true},{\"kind\":\"content-shown\",\"position\":5},{\"kind\":\"answer-accepted\",\"position\":5,\"scored\":true},{\"kind\":\"content-shown\",\"position\":6},{\"kind\":\"answer-accepted\",\"position\":6,\"scored\":true},{\"kind\":\"content-shown\",\"position\":7},{\"kind\":\"answer-accepted\",\"position\":7,\"scored\":true},{\"kind\":\"content-shown\",\"position\":8},{\"kind\":\"answer-accepted\",\"position\":8,\"scored\":true},{\"kind\":\"content-shown\",\"position\":9},{\"kind\":\"answer-accepted\",\"position\":9,\"scored\":true},{\"kind\":\"content-shown\",\"position\":10},{\"kind\":\"answer-accepted\",\"position\":10,\"scored\":true},{\"kind\":\"content-shown\",\"position\":11},{\"kind\":\"answer-accepted\",\"position\":11,\"scored\":true},{\"kind\":\"content-shown\",\"position\":12},{\"kind\":\"answer-accepted\",\"position\":12,\"scored\":true},{\"kind\":\"content-shown\",\"position\":13},{\"kind\":\"answer-accepted\",\"position\":13,\"scored\":true},{\"kind\":\"content-shown\",\"position\":14},{\"kind\":\"answer-accepted\",\"position\":14,\"scored\":true},{\"kind\":\"content-shown\",\"position\":15},{\"kind\":\"answer-accepted\",\"position\":15,\"scored\":true},{\"kind\":\"content-shown\",\"position\":16},{\"kind\":\"answer-accepted\",\"position\":16,\"scored\":true},{\"kind\":\"content-shown\",\"position\":17},{\"kind\":\"answer-accepted\",\"position\":17,\"scored\":true},{\"kind\":\"content-shown\",\"position\":18},{\"kind\":\"answer-accepted\",\"position\":18,\"scored\":true},{\"kind\":\"content-shown\",\"position\":19},{\"kind\":\"answer-accepted\",\"position\":19,\"scored\":true},{\"ending\":\"completed\",\"kind\":\"attempt-ended\"}]",
      "results": "{\"assistanceStep\":null,\"assisted\":true,\"ending\":\"completed\",\"finances\":null,\"metrics\":{\"betting-adherence\":null,\"card-values\":{\"correct\":6,\"total\":20},\"playing-adherence\":null,\"running-count\":null,\"true-count\":null},\"review\":[{\"card\":{\"rank\":5,\"suit\":\"diamonds\"},\"entered\":1,\"kind\":\"card-value\",\"position\":1,\"reference\":1},{\"card\":{\"rank\":7,\"suit\":\"diamonds\"},\"entered\":0,\"kind\":\"card-value\",\"position\":2,\"reference\":0},{\"card\":{\"rank\":10,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":3,\"reference\":-1},{\"card\":{\"rank\":2,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":4,\"reference\":1},{\"card\":{\"rank\":7,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":5,\"reference\":0},{\"card\":{\"rank\":2,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":6,\"reference\":1},{\"card\":{\"rank\":11,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":7,\"reference\":-1},{\"card\":{\"rank\":4,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":8,\"reference\":1},{\"card\":{\"rank\":6,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":9,\"reference\":1},{\"card\":{\"rank\":11,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":10,\"reference\":-1},{\"card\":{\"rank\":12,\"suit\":\"diamonds\"},\"entered\":0,\"kind\":\"card-value\",\"position\":11,\"reference\":-1},{\"card\":{\"rank\":9,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":12,\"reference\":0},{\"card\":{\"rank\":2,\"suit\":\"diamonds\"},\"entered\":0,\"kind\":\"card-value\",\"position\":13,\"reference\":1},{\"card\":{\"rank\":6,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":14,\"reference\":1},{\"card\":{\"rank\":2,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":15,\"reference\":1},{\"card\":{\"rank\":1,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":16,\"reference\":-1},{\"card\":{\"rank\":9,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":17,\"reference\":0},{\"card\":{\"rank\":8,\"suit\":\"diamonds\"},\"entered\":0,\"kind\":\"card-value\",\"position\":18,\"reference\":0},{\"card\":{\"rank\":3,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":19,\"reference\":1},{\"card\":{\"rank\":13,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":20,\"reference\":-1}]}"
    },
    {
      "name": "card values Learn, a wrong answer explained",
      "category": "card-values",
      "phase": "explanation",
      "specification": {
        "attemptId": "attempt-1",
        "content": {
          "category": "card-values",
          "coverage": "every-rank",
          "id": "card-values",
          "length": 20,
          "version": 1
        },
        "device": "device-1",
        "owner": "owner-1",
        "variant": "learn"
      },
      "random": {
        "key": [
          1,
          2654435769
        ],
        "protocol": 1,
        "session": [
          8,
          0
        ]
      },
      "checkpoint": "{\"answers\":[{\"first\":1,\"last\":1,\"position\":0,\"tries\":1},{\"first\":1,\"last\":1,\"position\":1,\"tries\":1}],\"attempt\":{\"device\":\"device-1\",\"id\":\"attempt-1\",\"owner\":\"owner-1\"},\"content\":{\"category\":\"card-values\",\"coverage\":\"every-rank\",\"id\":\"card-values\",\"length\":20,\"version\":1},\"ending\":null,\"identities\":{\"category\":\"card-values\",\"content\":{\"id\":\"card-values\",\"version\":1},\"engine\":\"0.0.0\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":null},\"items\":[{\"card\":{\"rank\":5,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":7,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":10,\"suit\":\"clubs\"}},{\"card\":{\"rank\":2,\"suit\":\"clubs\"}},{\"card\":{\"rank\":7,\"suit\":\"hearts\"}},{\"card\":{\"rank\":2,\"suit\":\"spades\"}},{\"card\":{\"rank\":11,\"suit\":\"hearts\"}},{\"card\":{\"rank\":4,\"suit\":\"spades\"}},{\"card\":{\"rank\":6,\"suit\":\"hearts\"}},{\"card\":{\"rank\":11,\"suit\":\"clubs\"}},{\"card\":{\"rank\":12,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":9,\"suit\":\"hearts\"}},{\"card\":{\"rank\":2,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":6,\"suit\":\"hearts\"}},{\"card\":{\"rank\":2,\"suit\":\"spades\"}},{\"card\":{\"rank\":1,\"suit\":\"clubs\"}},{\"card\":{\"rank\":9,\"suit\":\"spades\"}},{\"card\":{\"rank\":8,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":3,\"suit\":\"clubs\"}},{\"card\":{\"rank\":13,\"suit\":\"spades\"}}],\"phase\":\"explanation\",\"position\":1,\"random\":{\"block\":[200,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":0,\"protocol\":1,\"session\":[8,0]},\"receipts\":[{\"command\":\"{\\\"kind\\\":\\\"begin\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":1}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":1}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3}],\"rejected\":39,\"revealedAt\":null,\"schema\":13,\"sequence\":4,\"table\":null,\"variant\":\"learn\"}",
      "continuation": [
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        }
      ],
      "facts": "[{\"kind\":\"content-shown\",\"position\":2},{\"kind\":\"answer-accepted\",\"position\":2,\"scored\":true},{\"kind\":\"content-shown\",\"position\":3},{\"kind\":\"answer-accepted\",\"position\":3,\"scored\":true},{\"kind\":\"content-shown\",\"position\":4},{\"kind\":\"answer-accepted\",\"position\":4,\"scored\":true},{\"kind\":\"content-shown\",\"position\":5},{\"kind\":\"answer-accepted\",\"position\":5,\"scored\":true},{\"kind\":\"content-shown\",\"position\":6},{\"kind\":\"answer-accepted\",\"position\":6,\"scored\":true},{\"kind\":\"content-shown\",\"position\":7},{\"kind\":\"answer-accepted\",\"position\":7,\"scored\":true},{\"kind\":\"content-shown\",\"position\":8},{\"kind\":\"answer-accepted\",\"position\":8,\"scored\":true},{\"kind\":\"content-shown\",\"position\":9},{\"kind\":\"answer-accepted\",\"position\":9,\"scored\":true},{\"kind\":\"content-shown\",\"position\":10},{\"kind\":\"answer-accepted\",\"position\":10,\"scored\":true},{\"kind\":\"content-shown\",\"position\":11},{\"kind\":\"answer-accepted\",\"position\":11,\"scored\":true},{\"kind\":\"content-shown\",\"position\":12},{\"kind\":\"answer-accepted\",\"position\":12,\"scored\":true},{\"kind\":\"content-shown\",\"position\":13},{\"kind\":\"answer-accepted\",\"position\":13,\"scored\":true},{\"kind\":\"content-shown\",\"position\":14},{\"kind\":\"answer-accepted\",\"position\":14,\"scored\":true},{\"kind\":\"content-shown\",\"position\":15},{\"kind\":\"answer-accepted\",\"position\":15,\"scored\":true},{\"kind\":\"content-shown\",\"position\":16},{\"kind\":\"answer-accepted\",\"position\":16,\"scored\":true},{\"kind\":\"content-shown\",\"position\":17},{\"kind\":\"answer-accepted\",\"position\":17,\"scored\":true},{\"kind\":\"content-shown\",\"position\":18},{\"kind\":\"answer-accepted\",\"position\":18,\"scored\":true},{\"kind\":\"content-shown\",\"position\":19},{\"kind\":\"answer-accepted\",\"position\":19,\"scored\":true},{\"ending\":\"completed\",\"kind\":\"attempt-ended\"}]",
      "results": "{\"assistanceStep\":null,\"assisted\":true,\"ending\":\"completed\",\"finances\":null,\"metrics\":{\"betting-adherence\":null,\"card-values\":{\"correct\":5,\"total\":20},\"playing-adherence\":null,\"running-count\":null,\"true-count\":null},\"review\":[{\"card\":{\"rank\":5,\"suit\":\"diamonds\"},\"entered\":1,\"kind\":\"card-value\",\"position\":1,\"reference\":1},{\"card\":{\"rank\":7,\"suit\":\"diamonds\"},\"entered\":1,\"kind\":\"card-value\",\"position\":2,\"reference\":0},{\"card\":{\"rank\":10,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":3,\"reference\":-1},{\"card\":{\"rank\":2,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":4,\"reference\":1},{\"card\":{\"rank\":7,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":5,\"reference\":0},{\"card\":{\"rank\":2,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":6,\"reference\":1},{\"card\":{\"rank\":11,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":7,\"reference\":-1},{\"card\":{\"rank\":4,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":8,\"reference\":1},{\"card\":{\"rank\":6,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":9,\"reference\":1},{\"card\":{\"rank\":11,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":10,\"reference\":-1},{\"card\":{\"rank\":12,\"suit\":\"diamonds\"},\"entered\":0,\"kind\":\"card-value\",\"position\":11,\"reference\":-1},{\"card\":{\"rank\":9,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":12,\"reference\":0},{\"card\":{\"rank\":2,\"suit\":\"diamonds\"},\"entered\":0,\"kind\":\"card-value\",\"position\":13,\"reference\":1},{\"card\":{\"rank\":6,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":14,\"reference\":1},{\"card\":{\"rank\":2,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":15,\"reference\":1},{\"card\":{\"rank\":1,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":16,\"reference\":-1},{\"card\":{\"rank\":9,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":17,\"reference\":0},{\"card\":{\"rank\":8,\"suit\":\"diamonds\"},\"entered\":0,\"kind\":\"card-value\",\"position\":18,\"reference\":0},{\"card\":{\"rank\":3,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":19,\"reference\":1},{\"card\":{\"rank\":13,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":20,\"reference\":-1}]}"
    },
    {
      "name": "card values Check, an answer recorded",
      "category": "card-values",
      "phase": "recorded",
      "specification": {
        "attemptId": "attempt-1",
        "content": {
          "category": "card-values",
          "coverage": "every-rank",
          "id": "card-values",
          "length": 20,
          "version": 1
        },
        "device": "device-1",
        "owner": "owner-1",
        "variant": "check"
      },
      "random": {
        "key": [
          1,
          2654435769
        ],
        "protocol": 1,
        "session": [
          8,
          0
        ]
      },
      "checkpoint": "{\"answers\":[{\"first\":1,\"last\":1,\"position\":0,\"tries\":1},{\"first\":1,\"last\":1,\"position\":1,\"tries\":1}],\"attempt\":{\"device\":\"device-1\",\"id\":\"attempt-1\",\"owner\":\"owner-1\"},\"content\":{\"category\":\"card-values\",\"coverage\":\"every-rank\",\"id\":\"card-values\",\"length\":20,\"version\":1},\"ending\":null,\"identities\":{\"category\":\"card-values\",\"content\":{\"id\":\"card-values\",\"version\":1},\"engine\":\"0.0.0\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":null},\"items\":[{\"card\":{\"rank\":5,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":7,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":10,\"suit\":\"clubs\"}},{\"card\":{\"rank\":2,\"suit\":\"clubs\"}},{\"card\":{\"rank\":7,\"suit\":\"hearts\"}},{\"card\":{\"rank\":2,\"suit\":\"spades\"}},{\"card\":{\"rank\":11,\"suit\":\"hearts\"}},{\"card\":{\"rank\":4,\"suit\":\"spades\"}},{\"card\":{\"rank\":6,\"suit\":\"hearts\"}},{\"card\":{\"rank\":11,\"suit\":\"clubs\"}},{\"card\":{\"rank\":12,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":9,\"suit\":\"hearts\"}},{\"card\":{\"rank\":2,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":6,\"suit\":\"hearts\"}},{\"card\":{\"rank\":2,\"suit\":\"spades\"}},{\"card\":{\"rank\":1,\"suit\":\"clubs\"}},{\"card\":{\"rank\":9,\"suit\":\"spades\"}},{\"card\":{\"rank\":8,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":3,\"suit\":\"clubs\"}},{\"card\":{\"rank\":13,\"suit\":\"spades\"}}],\"phase\":\"recorded\",\"position\":1,\"random\":{\"block\":[200,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":0,\"protocol\":1,\"session\":[8,0]},\"receipts\":[{\"command\":\"{\\\"kind\\\":\\\"begin\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":1}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":1}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3}],\"rejected\":39,\"revealedAt\":null,\"schema\":13,\"sequence\":4,\"table\":null,\"variant\":\"check\"}",
      "continuation": [
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        }
      ],
      "facts": "[{\"kind\":\"content-shown\",\"position\":2},{\"kind\":\"answer-accepted\",\"position\":2,\"scored\":true},{\"kind\":\"content-shown\",\"position\":3},{\"kind\":\"answer-accepted\",\"position\":3,\"scored\":true},{\"kind\":\"content-shown\",\"position\":4},{\"kind\":\"answer-accepted\",\"position\":4,\"scored\":true},{\"kind\":\"content-shown\",\"position\":5},{\"kind\":\"answer-accepted\",\"position\":5,\"scored\":true},{\"kind\":\"content-shown\",\"position\":6},{\"kind\":\"answer-accepted\",\"position\":6,\"scored\":true},{\"kind\":\"content-shown\",\"position\":7},{\"kind\":\"answer-accepted\",\"position\":7,\"scored\":true},{\"kind\":\"content-shown\",\"position\":8},{\"kind\":\"answer-accepted\",\"position\":8,\"scored\":true},{\"kind\":\"content-shown\",\"position\":9},{\"kind\":\"answer-accepted\",\"position\":9,\"scored\":true},{\"kind\":\"content-shown\",\"position\":10},{\"kind\":\"answer-accepted\",\"position\":10,\"scored\":true},{\"kind\":\"content-shown\",\"position\":11},{\"kind\":\"answer-accepted\",\"position\":11,\"scored\":true},{\"kind\":\"content-shown\",\"position\":12},{\"kind\":\"answer-accepted\",\"position\":12,\"scored\":true},{\"kind\":\"content-shown\",\"position\":13},{\"kind\":\"answer-accepted\",\"position\":13,\"scored\":true},{\"kind\":\"content-shown\",\"position\":14},{\"kind\":\"answer-accepted\",\"position\":14,\"scored\":true},{\"kind\":\"content-shown\",\"position\":15},{\"kind\":\"answer-accepted\",\"position\":15,\"scored\":true},{\"kind\":\"content-shown\",\"position\":16},{\"kind\":\"answer-accepted\",\"position\":16,\"scored\":true},{\"kind\":\"content-shown\",\"position\":17},{\"kind\":\"answer-accepted\",\"position\":17,\"scored\":true},{\"kind\":\"content-shown\",\"position\":18},{\"kind\":\"answer-accepted\",\"position\":18,\"scored\":true},{\"kind\":\"content-shown\",\"position\":19},{\"kind\":\"answer-accepted\",\"position\":19,\"scored\":true},{\"ending\":\"completed\",\"kind\":\"attempt-ended\"}]",
      "results": "{\"assistanceStep\":null,\"assisted\":false,\"ending\":\"completed\",\"finances\":null,\"metrics\":{\"betting-adherence\":null,\"card-values\":{\"correct\":5,\"total\":20},\"playing-adherence\":null,\"running-count\":null,\"true-count\":null},\"review\":[{\"card\":{\"rank\":5,\"suit\":\"diamonds\"},\"entered\":1,\"kind\":\"card-value\",\"position\":1,\"reference\":1},{\"card\":{\"rank\":7,\"suit\":\"diamonds\"},\"entered\":1,\"kind\":\"card-value\",\"position\":2,\"reference\":0},{\"card\":{\"rank\":10,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":3,\"reference\":-1},{\"card\":{\"rank\":2,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":4,\"reference\":1},{\"card\":{\"rank\":7,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":5,\"reference\":0},{\"card\":{\"rank\":2,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":6,\"reference\":1},{\"card\":{\"rank\":11,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":7,\"reference\":-1},{\"card\":{\"rank\":4,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":8,\"reference\":1},{\"card\":{\"rank\":6,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":9,\"reference\":1},{\"card\":{\"rank\":11,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":10,\"reference\":-1},{\"card\":{\"rank\":12,\"suit\":\"diamonds\"},\"entered\":0,\"kind\":\"card-value\",\"position\":11,\"reference\":-1},{\"card\":{\"rank\":9,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":12,\"reference\":0},{\"card\":{\"rank\":2,\"suit\":\"diamonds\"},\"entered\":0,\"kind\":\"card-value\",\"position\":13,\"reference\":1},{\"card\":{\"rank\":6,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":14,\"reference\":1},{\"card\":{\"rank\":2,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":15,\"reference\":1},{\"card\":{\"rank\":1,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":16,\"reference\":-1},{\"card\":{\"rank\":9,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":17,\"reference\":0},{\"card\":{\"rank\":8,\"suit\":\"diamonds\"},\"entered\":0,\"kind\":\"card-value\",\"position\":18,\"reference\":0},{\"card\":{\"rank\":3,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":19,\"reference\":1},{\"card\":{\"rank\":13,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":20,\"reference\":-1}]}"
    },
    {
      "name": "running count Learn, a wrong count explained after the count was shown",
      "category": "running-count",
      "phase": "explanation",
      "specification": {
        "attemptId": "attempt-1",
        "content": {
          "category": "running-count",
          "checkpoints": [
            13,
            26,
            39,
            52
          ],
          "decks": 6,
          "id": "running-count",
          "length": 52,
          "reference": {
            "id": "blackjack-reference",
            "version": 1
          },
          "version": 1
        },
        "device": "device-1",
        "owner": "owner-1",
        "variant": "learn"
      },
      "random": {
        "key": [
          1,
          2654435769
        ],
        "protocol": 1,
        "session": [
          8,
          0
        ]
      },
      "checkpoint": "{\"answers\":[{\"first\":3,\"last\":3,\"position\":0,\"tries\":1}],\"attempt\":{\"device\":\"device-1\",\"id\":\"attempt-1\",\"owner\":\"owner-1\"},\"content\":{\"category\":\"running-count\",\"checkpoints\":[13,26,39,52],\"decks\":6,\"id\":\"running-count\",\"length\":52,\"reference\":{\"id\":\"blackjack-reference\",\"version\":1},\"version\":1},\"ending\":null,\"identities\":{\"category\":\"running-count\",\"content\":{\"id\":\"running-count\",\"version\":1},\"engine\":\"0.0.0\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":{\"id\":\"blackjack-reference\",\"version\":1}},\"items\":[{\"card\":{\"rank\":13,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":3,\"suit\":\"hearts\"}},{\"card\":{\"rank\":4,\"suit\":\"clubs\"}},{\"card\":{\"rank\":3,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":3,\"suit\":\"clubs\"}},{\"card\":{\"rank\":4,\"suit\":\"clubs\"}},{\"card\":{\"rank\":12,\"suit\":\"clubs\"}},{\"card\":{\"rank\":11,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":13,\"suit\":\"clubs\"}},{\"card\":{\"rank\":7,\"suit\":\"spades\"}},{\"card\":{\"rank\":11,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":12,\"suit\":\"hearts\"}},{\"card\":{\"rank\":1,\"suit\":\"spades\"}},{\"card\":{\"rank\":6,\"suit\":\"spades\"}},{\"card\":{\"rank\":8,\"suit\":\"hearts\"}},{\"card\":{\"rank\":2,\"suit\":\"hearts\"}},{\"card\":{\"rank\":10,\"suit\":\"hearts\"}},{\"card\":{\"rank\":13,\"suit\":\"clubs\"}},{\"card\":{\"rank\":5,\"suit\":\"clubs\"}},{\"card\":{\"rank\":13,\"suit\":\"hearts\"}},{\"card\":{\"rank\":7,\"suit\":\"spades\"}},{\"card\":{\"rank\":9,\"suit\":\"hearts\"}},{\"card\":{\"rank\":5,\"suit\":\"hearts\"}},{\"card\":{\"rank\":1,\"suit\":\"hearts\"}},{\"card\":{\"rank\":5,\"suit\":\"hearts\"}},{\"card\":{\"rank\":4,\"suit\":\"spades\"}},{\"card\":{\"rank\":9,\"suit\":\"hearts\"}},{\"card\":{\"rank\":6,\"suit\":\"clubs\"}},{\"card\":{\"rank\":3,\"suit\":\"spades\"}},{\"card\":{\"rank\":7,\"suit\":\"clubs\"}},{\"card\":{\"rank\":11,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":1,\"suit\":\"clubs\"}},{\"card\":{\"rank\":9,\"suit\":\"hearts\"}},{\"card\":{\"rank\":12,\"suit\":\"spades\"}},{\"card\":{\"rank\":3,\"suit\":\"clubs\"}},{\"card\":{\"rank\":5,\"suit\":\"hearts\"}},{\"card\":{\"rank\":12,\"suit\":\"clubs\"}},{\"card\":{\"rank\":12,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":7,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":4,\"suit\":\"clubs\"}},{\"card\":{\"rank\":11,\"suit\":\"clubs\"}},{\"card\":{\"rank\":13,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":10,\"suit\":\"spades\"}},{\"card\":{\"rank\":9,\"suit\":\"spades\"}},{\"card\":{\"rank\":9,\"suit\":\"spades\"}},{\"card\":{\"rank\":1,\"suit\":\"spades\"}},{\"card\":{\"rank\":12,\"suit\":\"spades\"}},{\"card\":{\"rank\":10,\"suit\":\"clubs\"}},{\"card\":{\"rank\":10,\"suit\":\"clubs\"}},{\"card\":{\"rank\":8,\"suit\":\"spades\"}},{\"card\":{\"rank\":7,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":7,\"suit\":\"diamonds\"}}],\"phase\":\"explanation\",\"position\":0,\"random\":{\"block\":[77,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":3,\"protocol\":1,\"session\":[8,0]},\"receipts\":[{\"command\":\"{\\\"kind\\\":\\\"begin\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"reveal-count\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":3}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2}],\"rejected\":0,\"revealedAt\":1,\"schema\":13,\"sequence\":3,\"table\":null,\"variant\":\"learn\"}",
      "continuation": [
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        }
      ],
      "facts": "[{\"kind\":\"content-shown\",\"position\":1},{\"kind\":\"answer-accepted\",\"position\":1,\"scored\":true},{\"kind\":\"content-shown\",\"position\":2},{\"kind\":\"answer-accepted\",\"position\":2,\"scored\":true},{\"kind\":\"content-shown\",\"position\":3},{\"kind\":\"answer-accepted\",\"position\":3,\"scored\":true},{\"kind\":\"content-shown\",\"position\":4},{\"kind\":\"answer-accepted\",\"position\":4,\"scored\":true},{\"kind\":\"content-shown\",\"position\":5},{\"kind\":\"answer-accepted\",\"position\":5,\"scored\":true},{\"kind\":\"content-shown\",\"position\":6},{\"kind\":\"answer-accepted\",\"position\":6,\"scored\":true},{\"kind\":\"content-shown\",\"position\":7},{\"kind\":\"answer-accepted\",\"position\":7,\"scored\":true},{\"kind\":\"content-shown\",\"position\":8},{\"kind\":\"answer-accepted\",\"position\":8,\"scored\":true},{\"kind\":\"content-shown\",\"position\":9},{\"kind\":\"answer-accepted\",\"position\":9,\"scored\":true},{\"kind\":\"content-shown\",\"position\":10},{\"kind\":\"answer-accepted\",\"position\":10,\"scored\":true},{\"kind\":\"content-shown\",\"position\":11},{\"kind\":\"answer-accepted\",\"position\":11,\"scored\":true},{\"kind\":\"content-shown\",\"position\":12},{\"kind\":\"answer-accepted\",\"position\":12,\"scored\":true},{\"kind\":\"content-shown\",\"position\":13},{\"kind\":\"answer-accepted\",\"position\":13,\"scored\":true},{\"kind\":\"content-shown\",\"position\":14},{\"kind\":\"answer-accepted\",\"position\":14,\"scored\":true},{\"kind\":\"content-shown\",\"position\":15},{\"kind\":\"answer-accepted\",\"position\":15,\"scored\":true},{\"kind\":\"content-shown\",\"position\":16},{\"kind\":\"answer-accepted\",\"position\":16,\"scored\":true},{\"kind\":\"content-shown\",\"position\":17},{\"kind\":\"answer-accepted\",\"position\":17,\"scored\":true},{\"kind\":\"content-shown\",\"position\":18},{\"kind\":\"answer-accepted\",\"position\":18,\"scored\":true},{\"kind\":\"content-shown\",\"position\":19},{\"kind\":\"answer-accepted\",\"position\":19,\"scored\":true},{\"kind\":\"content-shown\",\"position\":20},{\"kind\":\"answer-accepted\",\"position\":20,\"scored\":true},{\"kind\":\"content-shown\",\"position\":21},{\"kind\":\"answer-accepted\",\"position\":21,\"scored\":true},{\"kind\":\"content-shown\",\"position\":22},{\"kind\":\"answer-accepted\",\"position\":22,\"scored\":true},{\"kind\":\"content-shown\",\"position\":23},{\"kind\":\"answer-accepted\",\"position\":23,\"scored\":true},{\"kind\":\"content-shown\",\"position\":24},{\"kind\":\"answer-accepted\",\"position\":24,\"scored\":true},{\"kind\":\"content-shown\",\"position\":25},{\"kind\":\"answer-accepted\",\"position\":25,\"scored\":true},{\"kind\":\"content-shown\",\"position\":26},{\"kind\":\"answer-accepted\",\"position\":26,\"scored\":true},{\"kind\":\"content-shown\",\"position\":27},{\"kind\":\"answer-accepted\",\"position\":27,\"scored\":true},{\"kind\":\"content-shown\",\"position\":28},{\"kind\":\"answer-accepted\",\"position\":28,\"scored\":true},{\"kind\":\"content-shown\",\"position\":29},{\"kind\":\"answer-accepted\",\"position\":29,\"scored\":true},{\"kind\":\"content-shown\",\"position\":30},{\"kind\":\"answer-accepted\",\"position\":30,\"scored\":true},{\"kind\":\"content-shown\",\"position\":31},{\"kind\":\"answer-accepted\",\"position\":31,\"scored\":true},{\"kind\":\"content-shown\",\"position\":32},{\"kind\":\"answer-accepted\",\"position\":32,\"scored\":true},{\"kind\":\"content-shown\",\"position\":33},{\"kind\":\"answer-accepted\",\"position\":33,\"scored\":true},{\"kind\":\"content-shown\",\"position\":34},{\"kind\":\"answer-accepted\",\"position\":34,\"scored\":true},{\"kind\":\"content-shown\",\"position\":35},{\"kind\":\"answer-accepted\",\"position\":35,\"scored\":true},{\"kind\":\"content-shown\",\"position\":36},{\"kind\":\"answer-accepted\",\"position\":36,\"scored\":true},{\"kind\":\"content-shown\",\"position\":37},{\"kind\":\"answer-accepted\",\"position\":37,\"scored\":true},{\"kind\":\"content-shown\",\"position\":38},{\"kind\":\"answer-accepted\",\"position\":38,\"scored\":true},{\"kind\":\"content-shown\",\"position\":39},{\"kind\":\"answer-accepted\",\"position\":39,\"scored\":true},{\"kind\":\"content-shown\",\"position\":40},{\"kind\":\"answer-accepted\",\"position\":40,\"scored\":true},{\"kind\":\"content-shown\",\"position\":41},{\"kind\":\"answer-accepted\",\"position\":41,\"scored\":true},{\"kind\":\"content-shown\",\"position\":42},{\"kind\":\"answer-accepted\",\"position\":42,\"scored\":true},{\"kind\":\"content-shown\",\"position\":43},{\"kind\":\"answer-accepted\",\"position\":43,\"scored\":true},{\"kind\":\"content-shown\",\"position\":44},{\"kind\":\"answer-accepted\",\"position\":44,\"scored\":true},{\"kind\":\"content-shown\",\"position\":45},{\"kind\":\"answer-accepted\",\"position\":45,\"scored\":true},{\"kind\":\"content-shown\",\"position\":46},{\"kind\":\"answer-accepted\",\"position\":46,\"scored\":true},{\"kind\":\"content-shown\",\"position\":47},{\"kind\":\"answer-accepted\",\"position\":47,\"scored\":true},{\"kind\":\"content-shown\",\"position\":48},{\"kind\":\"answer-accepted\",\"position\":48,\"scored\":true},{\"kind\":\"content-shown\",\"position\":49},{\"kind\":\"answer-accepted\",\"position\":49,\"scored\":true},{\"kind\":\"content-shown\",\"position\":50},{\"kind\":\"answer-accepted\",\"position\":50,\"scored\":true},{\"kind\":\"content-shown\",\"position\":51},{\"kind\":\"answer-accepted\",\"position\":51,\"scored\":true},{\"ending\":\"completed\",\"kind\":\"attempt-ended\"}]",
      "results": "{\"assistanceStep\":1,\"assisted\":true,\"ending\":\"completed\",\"finances\":null,\"metrics\":{\"betting-adherence\":null,\"card-values\":null,\"playing-adherence\":null,\"running-count\":{\"correct\":10,\"total\":52},\"true-count\":null},\"review\":[{\"checkpoint\":1,\"entered\":3,\"error\":4,\"kind\":\"running-count\",\"position\":1,\"reference\":-1},{\"checkpoint\":2,\"entered\":0,\"error\":0,\"kind\":\"running-count\",\"position\":2,\"reference\":0},{\"checkpoint\":3,\"entered\":0,\"error\":-1,\"kind\":\"running-count\",\"position\":3,\"reference\":1},{\"checkpoint\":4,\"entered\":0,\"error\":-2,\"kind\":\"running-count\",\"position\":4,\"reference\":2},{\"checkpoint\":5,\"entered\":0,\"error\":-3,\"kind\":\"running-count\",\"position\":5,\"reference\":3},{\"checkpoint\":6,\"entered\":0,\"error\":-4,\"kind\":\"running-count\",\"position\":6,\"reference\":4},{\"checkpoint\":7,\"entered\":0,\"error\":-3,\"kind\":\"running-count\",\"position\":7,\"reference\":3},{\"checkpoint\":8,\"entered\":0,\"error\":-2,\"kind\":\"running-count\",\"position\":8,\"reference\":2},{\"checkpoint\":9,\"entered\":0,\"error\":-1,\"kind\":\"running-count\",\"position\":9,\"reference\":1},{\"checkpoint\":10,\"entered\":0,\"error\":-1,\"kind\":\"running-count\",\"position\":10,\"reference\":1},{\"checkpoint\":11,\"entered\":0,\"error\":0,\"kind\":\"running-count\",\"position\":11,\"reference\":0},{\"checkpoint\":12,\"entered\":0,\"error\":1,\"kind\":\"running-count\",\"position\":12,\"reference\":-1},{\"checkpoint\":13,\"entered\":0,\"error\":2,\"kind\":\"running-count\",\"position\":13,\"reference\":-2},{\"checkpoint\":14,\"entered\":0,\"error\":1,\"kind\":\"running-count\",\"position\":14,\"reference\":-1},{\"checkpoint\":15,\"entered\":0,\"error\":1,\"kind\":\"running-count\",\"position\":15,\"reference\":-1},{\"checkpoint\":16,\"entered\":0,\"error\":0,\"kind\":\"running-count\",\"position\":16,\"reference\":0},{\"checkpoint\":17,\"entered\":0,\"error\":1,\"kind\":\"running-count\",\"position\":17,\"reference\":-1},{\"checkpoint\":18,\"entered\":0,\"error\":2,\"kind\":\"running-count\",\"position\":18,\"reference\":-2},{\"checkpoint\":19,\"entered\":0,\"error\":1,\"kind\":\"running-count\",\"position\":19,\"reference\":-1},{\"checkpoint\":20,\"entered\":0,\"error\":2,\"kind\":\"running-count\",\"position\":20,\"reference\":-2},{\"checkpoint\":21,\"entered\":0,\"error\":2,\"kind\":\"running-count\",\"position\":21,\"reference\":-2},{\"checkpoint\":22,\"entered\":0,\"error\":2,\"kind\":\"running-count\",\"position\":22,\"reference\":-2},{\"checkpoint\":23,\"entered\":0,\"error\":1,\"kind\":\"running-count\",\"position\":23,\"reference\":-1},{\"checkpoint\":24,\"entered\":0,\"error\":2,\"kind\":\"running-count\",\"position\":24,\"reference\":-2},{\"checkpoint\":25,\"entered\":0,\"error\":1,\"kind\":\"running-count\",\"position\":25,\"reference\":-1},{\"checkpoint\":26,\"entered\":0,\"error\":0,\"kind\":\"running-count\",\"position\":26,\"reference\":0},{\"checkpoint\":27,\"entered\":0,\"error\":0,\"kind\":\"running-count\",\"position\":27,\"reference\":0},{\"checkpoint\":28,\"entered\":0,\"error\":-1,\"kind\":\"running-count\",\"position\":28,\"reference\":1},{\"checkpoint\":29,\"entered\":0,\"error\":-2,\"kind\":\"running-count\",\"position\":29,\"reference\":2},{\"checkpoint\":30,\"entered\":0,\"error\":-2,\"kind\":\"running-count\",\"position\":30,\"reference\":2},{\"checkpoint\":31,\"entered\":0,\"error\":-1,\"kind\":\"running-count\",\"position\":31,\"reference\":1},{\"checkpoint\":32,\"entered\":0,\"error\":0,\"kind\":\"running-count\",\"position\":32,\"reference\":0},{\"checkpoint\":33,\"entered\":0,\"error\":0,\"kind\":\"running-count\",\"position\":33,\"reference\":0},{\"checkpoint\":34,\"entered\":0,\"error\":1,\"kind\":\"running-count\",\"position\":34,\"reference\":-1},{\"checkpoint\":35,\"entered\":0,\"error\":0,\"kind\":\"running-count\",\"position\":35,\"reference\":0},{\"checkpoint\":36,\"entered\":0,\"error\":-1,\"kind\":\"running-count\",\"position\":36,\"reference\":1},{\"checkpoint\":37,\"entered\":0,\"error\":0,\"kind\":\"running-count\",\"position\":37,\"reference\":0},{\"checkpoint\":38,\"entered\":0,\"error\":1,\"kind\":\"running-count\",\"position\":38,\"reference\":-1},{\"checkpoint\":39,\"entered\":0,\"error\":1,\"kind\":\"running-count\",\"position\":39,\"reference\":-1},{\"checkpoint\":40,\"entered\":0,\"error\":0,\"kind\":\"running-count\",\"position\":40,\"reference\":0},{\"checkpoint\":41,\"entered\":0,\"error\":1,\"kind\":\"running-count\",\"position\":41,\"reference\":-1},{\"checkpoint\":42,\"entered\":0,\"error\":2,\"kind\":\"running-count\",\"position\":42,\"reference\":-2},{\"checkpoint\":43,\"entered\":0,\"error\":3,\"kind\":\"running-count\",\"position\":43,\"reference\":-3},{\"checkpoint\":44,\"entered\":0,\"error\":3,\"kind\":\"running-count\",\"position\":44,\"reference\":-3},{\"checkpoint\":45,\"entered\":0,\"error\":3,\"kind\":\"running-count\",\"position\":45,\"reference\":-3},{\"checkpoint\":46,\"entered\":0,\"error\":4,\"kind\":\"running-count\",\"position\":46,\"reference\":-4},{\"checkpoint\":47,\"entered\":0,\"error\":5,\"kind\":\"running-count\",\"position\":47,\"reference\":-5},{\"checkpoint\":48,\"entered\":0,\"error\":6,\"kind\":\"running-count\",\"position\":48,\"reference\":-6},{\"checkpoint\":49,\"entered\":0,\"error\":7,\"kind\":\"running-count\",\"position\":49,\"reference\":-7},{\"checkpoint\":50,\"entered\":0,\"error\":7,\"kind\":\"running-count\",\"position\":50,\"reference\":-7},{\"checkpoint\":51,\"entered\":0,\"error\":7,\"kind\":\"running-count\",\"position\":51,\"reference\":-7},{\"checkpoint\":52,\"entered\":0,\"error\":7,\"kind\":\"running-count\",\"position\":52,\"reference\":-7}]}"
    },
    {
      "name": "running count Check, a card between checkpoints after the count was shown",
      "category": "running-count",
      "phase": "card",
      "specification": {
        "attemptId": "attempt-1",
        "content": {
          "category": "running-count",
          "checkpoints": [
            13,
            26,
            39,
            52
          ],
          "decks": 6,
          "id": "running-count",
          "length": 52,
          "reference": {
            "id": "blackjack-reference",
            "version": 1
          },
          "version": 1
        },
        "device": "device-1",
        "owner": "owner-1",
        "variant": "check"
      },
      "random": {
        "key": [
          1,
          2654435769
        ],
        "protocol": 1,
        "session": [
          8,
          0
        ]
      },
      "checkpoint": "{\"answers\":[],\"attempt\":{\"device\":\"device-1\",\"id\":\"attempt-1\",\"owner\":\"owner-1\"},\"content\":{\"category\":\"running-count\",\"checkpoints\":[13,26,39,52],\"decks\":6,\"id\":\"running-count\",\"length\":52,\"reference\":{\"id\":\"blackjack-reference\",\"version\":1},\"version\":1},\"ending\":null,\"identities\":{\"category\":\"running-count\",\"content\":{\"id\":\"running-count\",\"version\":1},\"engine\":\"0.0.0\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":{\"id\":\"blackjack-reference\",\"version\":1}},\"items\":[{\"card\":{\"rank\":13,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":3,\"suit\":\"hearts\"}},{\"card\":{\"rank\":4,\"suit\":\"clubs\"}},{\"card\":{\"rank\":3,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":3,\"suit\":\"clubs\"}},{\"card\":{\"rank\":4,\"suit\":\"clubs\"}},{\"card\":{\"rank\":12,\"suit\":\"clubs\"}},{\"card\":{\"rank\":11,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":13,\"suit\":\"clubs\"}},{\"card\":{\"rank\":7,\"suit\":\"spades\"}},{\"card\":{\"rank\":11,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":12,\"suit\":\"hearts\"}},{\"card\":{\"rank\":1,\"suit\":\"spades\"}},{\"card\":{\"rank\":6,\"suit\":\"spades\"}},{\"card\":{\"rank\":8,\"suit\":\"hearts\"}},{\"card\":{\"rank\":2,\"suit\":\"hearts\"}},{\"card\":{\"rank\":10,\"suit\":\"hearts\"}},{\"card\":{\"rank\":13,\"suit\":\"clubs\"}},{\"card\":{\"rank\":5,\"suit\":\"clubs\"}},{\"card\":{\"rank\":13,\"suit\":\"hearts\"}},{\"card\":{\"rank\":7,\"suit\":\"spades\"}},{\"card\":{\"rank\":9,\"suit\":\"hearts\"}},{\"card\":{\"rank\":5,\"suit\":\"hearts\"}},{\"card\":{\"rank\":1,\"suit\":\"hearts\"}},{\"card\":{\"rank\":5,\"suit\":\"hearts\"}},{\"card\":{\"rank\":4,\"suit\":\"spades\"}},{\"card\":{\"rank\":9,\"suit\":\"hearts\"}},{\"card\":{\"rank\":6,\"suit\":\"clubs\"}},{\"card\":{\"rank\":3,\"suit\":\"spades\"}},{\"card\":{\"rank\":7,\"suit\":\"clubs\"}},{\"card\":{\"rank\":11,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":1,\"suit\":\"clubs\"}},{\"card\":{\"rank\":9,\"suit\":\"hearts\"}},{\"card\":{\"rank\":12,\"suit\":\"spades\"}},{\"card\":{\"rank\":3,\"suit\":\"clubs\"}},{\"card\":{\"rank\":5,\"suit\":\"hearts\"}},{\"card\":{\"rank\":12,\"suit\":\"clubs\"}},{\"card\":{\"rank\":12,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":7,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":4,\"suit\":\"clubs\"}},{\"card\":{\"rank\":11,\"suit\":\"clubs\"}},{\"card\":{\"rank\":13,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":10,\"suit\":\"spades\"}},{\"card\":{\"rank\":9,\"suit\":\"spades\"}},{\"card\":{\"rank\":9,\"suit\":\"spades\"}},{\"card\":{\"rank\":1,\"suit\":\"spades\"}},{\"card\":{\"rank\":12,\"suit\":\"spades\"}},{\"card\":{\"rank\":10,\"suit\":\"clubs\"}},{\"card\":{\"rank\":10,\"suit\":\"clubs\"}},{\"card\":{\"rank\":8,\"suit\":\"spades\"}},{\"card\":{\"rank\":7,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":7,\"suit\":\"diamonds\"}}],\"phase\":\"card\",\"position\":2,\"random\":{\"block\":[77,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":3,\"protocol\":1,\"session\":[8,0]},\"receipts\":[{\"command\":\"{\\\"kind\\\":\\\"begin\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"kind\\\":\\\"reveal-count\\\"}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3}],\"rejected\":0,\"revealedAt\":3,\"schema\":13,\"sequence\":4,\"table\":null,\"variant\":\"check\"}",
      "continuation": [
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        }
      ],
      "facts": "[{\"kind\":\"content-shown\",\"position\":3},{\"kind\":\"content-shown\",\"position\":4},{\"kind\":\"content-shown\",\"position\":5},{\"kind\":\"content-shown\",\"position\":6},{\"kind\":\"content-shown\",\"position\":7},{\"kind\":\"content-shown\",\"position\":8},{\"kind\":\"content-shown\",\"position\":9},{\"kind\":\"content-shown\",\"position\":10},{\"kind\":\"content-shown\",\"position\":11},{\"kind\":\"content-shown\",\"position\":12},{\"kind\":\"checkpoint-due\",\"position\":12},{\"kind\":\"answer-accepted\",\"position\":12,\"scored\":true},{\"kind\":\"content-shown\",\"position\":13},{\"kind\":\"content-shown\",\"position\":14},{\"kind\":\"content-shown\",\"position\":15},{\"kind\":\"content-shown\",\"position\":16},{\"kind\":\"content-shown\",\"position\":17},{\"kind\":\"content-shown\",\"position\":18},{\"kind\":\"content-shown\",\"position\":19},{\"kind\":\"content-shown\",\"position\":20},{\"kind\":\"content-shown\",\"position\":21},{\"kind\":\"content-shown\",\"position\":22},{\"kind\":\"content-shown\",\"position\":23},{\"kind\":\"content-shown\",\"position\":24},{\"kind\":\"content-shown\",\"position\":25},{\"kind\":\"checkpoint-due\",\"position\":25},{\"kind\":\"answer-accepted\",\"position\":25,\"scored\":true},{\"kind\":\"content-shown\",\"position\":26},{\"kind\":\"content-shown\",\"position\":27},{\"kind\":\"content-shown\",\"position\":28},{\"kind\":\"content-shown\",\"position\":29},{\"kind\":\"content-shown\",\"position\":30},{\"kind\":\"content-shown\",\"position\":31},{\"kind\":\"content-shown\",\"position\":32},{\"kind\":\"content-shown\",\"position\":33},{\"kind\":\"content-shown\",\"position\":34},{\"kind\":\"content-shown\",\"position\":35},{\"kind\":\"content-shown\",\"position\":36},{\"kind\":\"content-shown\",\"position\":37},{\"kind\":\"content-shown\",\"position\":38},{\"kind\":\"checkpoint-due\",\"position\":38},{\"kind\":\"answer-accepted\",\"position\":38,\"scored\":true},{\"kind\":\"content-shown\",\"position\":39},{\"kind\":\"content-shown\",\"position\":40},{\"kind\":\"content-shown\",\"position\":41},{\"kind\":\"content-shown\",\"position\":42},{\"kind\":\"content-shown\",\"position\":43},{\"kind\":\"content-shown\",\"position\":44},{\"kind\":\"content-shown\",\"position\":45},{\"kind\":\"content-shown\",\"position\":46},{\"kind\":\"content-shown\",\"position\":47},{\"kind\":\"content-shown\",\"position\":48},{\"kind\":\"content-shown\",\"position\":49},{\"kind\":\"content-shown\",\"position\":50},{\"kind\":\"content-shown\",\"position\":51},{\"kind\":\"checkpoint-due\",\"position\":51},{\"kind\":\"answer-accepted\",\"position\":51,\"scored\":true},{\"ending\":\"completed\",\"kind\":\"attempt-ended\"}]",
      "results": "{\"assistanceStep\":3,\"assisted\":true,\"ending\":\"completed\",\"finances\":null,\"metrics\":{\"betting-adherence\":null,\"card-values\":null,\"playing-adherence\":null,\"running-count\":{\"correct\":1,\"total\":4},\"true-count\":null},\"review\":[{\"checkpoint\":1,\"entered\":0,\"error\":2,\"kind\":\"running-count\",\"position\":13,\"reference\":-2},{\"checkpoint\":2,\"entered\":0,\"error\":0,\"kind\":\"running-count\",\"position\":26,\"reference\":0},{\"checkpoint\":3,\"entered\":0,\"error\":1,\"kind\":\"running-count\",\"position\":39,\"reference\":-1},{\"checkpoint\":4,\"entered\":0,\"error\":7,\"kind\":\"running-count\",\"position\":52,\"reference\":-7}]}"
    },
    {
      "name": "running count Check, the first checkpoint skipped",
      "category": "running-count",
      "phase": "recorded",
      "specification": {
        "attemptId": "attempt-1",
        "content": {
          "category": "running-count",
          "checkpoints": [
            13,
            26,
            39,
            52
          ],
          "decks": 6,
          "id": "running-count",
          "length": 52,
          "reference": {
            "id": "blackjack-reference",
            "version": 1
          },
          "version": 1
        },
        "device": "device-1",
        "owner": "owner-1",
        "variant": "check"
      },
      "random": {
        "key": [
          1,
          2654435769
        ],
        "protocol": 1,
        "session": [
          8,
          0
        ]
      },
      "checkpoint": "{\"answers\":[{\"first\":\"skip\",\"last\":\"skip\",\"position\":12,\"tries\":1}],\"attempt\":{\"device\":\"device-1\",\"id\":\"attempt-1\",\"owner\":\"owner-1\"},\"content\":{\"category\":\"running-count\",\"checkpoints\":[13,26,39,52],\"decks\":6,\"id\":\"running-count\",\"length\":52,\"reference\":{\"id\":\"blackjack-reference\",\"version\":1},\"version\":1},\"ending\":null,\"identities\":{\"category\":\"running-count\",\"content\":{\"id\":\"running-count\",\"version\":1},\"engine\":\"0.0.0\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":{\"id\":\"blackjack-reference\",\"version\":1}},\"items\":[{\"card\":{\"rank\":13,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":3,\"suit\":\"hearts\"}},{\"card\":{\"rank\":4,\"suit\":\"clubs\"}},{\"card\":{\"rank\":3,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":3,\"suit\":\"clubs\"}},{\"card\":{\"rank\":4,\"suit\":\"clubs\"}},{\"card\":{\"rank\":12,\"suit\":\"clubs\"}},{\"card\":{\"rank\":11,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":13,\"suit\":\"clubs\"}},{\"card\":{\"rank\":7,\"suit\":\"spades\"}},{\"card\":{\"rank\":11,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":12,\"suit\":\"hearts\"}},{\"card\":{\"rank\":1,\"suit\":\"spades\"}},{\"card\":{\"rank\":6,\"suit\":\"spades\"}},{\"card\":{\"rank\":8,\"suit\":\"hearts\"}},{\"card\":{\"rank\":2,\"suit\":\"hearts\"}},{\"card\":{\"rank\":10,\"suit\":\"hearts\"}},{\"card\":{\"rank\":13,\"suit\":\"clubs\"}},{\"card\":{\"rank\":5,\"suit\":\"clubs\"}},{\"card\":{\"rank\":13,\"suit\":\"hearts\"}},{\"card\":{\"rank\":7,\"suit\":\"spades\"}},{\"card\":{\"rank\":9,\"suit\":\"hearts\"}},{\"card\":{\"rank\":5,\"suit\":\"hearts\"}},{\"card\":{\"rank\":1,\"suit\":\"hearts\"}},{\"card\":{\"rank\":5,\"suit\":\"hearts\"}},{\"card\":{\"rank\":4,\"suit\":\"spades\"}},{\"card\":{\"rank\":9,\"suit\":\"hearts\"}},{\"card\":{\"rank\":6,\"suit\":\"clubs\"}},{\"card\":{\"rank\":3,\"suit\":\"spades\"}},{\"card\":{\"rank\":7,\"suit\":\"clubs\"}},{\"card\":{\"rank\":11,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":1,\"suit\":\"clubs\"}},{\"card\":{\"rank\":9,\"suit\":\"hearts\"}},{\"card\":{\"rank\":12,\"suit\":\"spades\"}},{\"card\":{\"rank\":3,\"suit\":\"clubs\"}},{\"card\":{\"rank\":5,\"suit\":\"hearts\"}},{\"card\":{\"rank\":12,\"suit\":\"clubs\"}},{\"card\":{\"rank\":12,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":7,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":4,\"suit\":\"clubs\"}},{\"card\":{\"rank\":11,\"suit\":\"clubs\"}},{\"card\":{\"rank\":13,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":10,\"suit\":\"spades\"}},{\"card\":{\"rank\":9,\"suit\":\"spades\"}},{\"card\":{\"rank\":9,\"suit\":\"spades\"}},{\"card\":{\"rank\":1,\"suit\":\"spades\"}},{\"card\":{\"rank\":12,\"suit\":\"spades\"}},{\"card\":{\"rank\":10,\"suit\":\"clubs\"}},{\"card\":{\"rank\":10,\"suit\":\"clubs\"}},{\"card\":{\"rank\":8,\"suit\":\"spades\"}},{\"card\":{\"rank\":7,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":7,\"suit\":\"diamonds\"}}],\"phase\":\"recorded\",\"position\":12,\"random\":{\"block\":[77,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":3,\"protocol\":1,\"session\":[8,0]},\"receipts\":[{\"command\":\"{\\\"kind\\\":\\\"begin\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-4\",\"disposition\":\"applied\",\"sequence\":4},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-5\",\"disposition\":\"applied\",\"sequence\":5},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-6\",\"disposition\":\"applied\",\"sequence\":6},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-7\",\"disposition\":\"applied\",\"sequence\":7},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-8\",\"disposition\":\"applied\",\"sequence\":8},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-9\",\"disposition\":\"applied\",\"sequence\":9},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-10\",\"disposition\":\"applied\",\"sequence\":10},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-11\",\"disposition\":\"applied\",\"sequence\":11},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-12\",\"disposition\":\"applied\",\"sequence\":12},{\"command\":\"{\\\"kind\\\":\\\"skip\\\"}\",\"commandId\":\"record-13\",\"disposition\":\"applied\",\"sequence\":13}],\"rejected\":0,\"revealedAt\":null,\"schema\":13,\"sequence\":14,\"table\":null,\"variant\":\"check\"}",
      "continuation": [
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        }
      ],
      "facts": "[{\"kind\":\"content-shown\",\"position\":13},{\"kind\":\"content-shown\",\"position\":14},{\"kind\":\"content-shown\",\"position\":15},{\"kind\":\"content-shown\",\"position\":16},{\"kind\":\"content-shown\",\"position\":17},{\"kind\":\"content-shown\",\"position\":18},{\"kind\":\"content-shown\",\"position\":19},{\"kind\":\"content-shown\",\"position\":20},{\"kind\":\"content-shown\",\"position\":21},{\"kind\":\"content-shown\",\"position\":22},{\"kind\":\"content-shown\",\"position\":23},{\"kind\":\"content-shown\",\"position\":24},{\"kind\":\"content-shown\",\"position\":25},{\"kind\":\"checkpoint-due\",\"position\":25},{\"kind\":\"answer-accepted\",\"position\":25,\"scored\":true},{\"kind\":\"content-shown\",\"position\":26},{\"kind\":\"content-shown\",\"position\":27},{\"kind\":\"content-shown\",\"position\":28},{\"kind\":\"content-shown\",\"position\":29},{\"kind\":\"content-shown\",\"position\":30},{\"kind\":\"content-shown\",\"position\":31},{\"kind\":\"content-shown\",\"position\":32},{\"kind\":\"content-shown\",\"position\":33},{\"kind\":\"content-shown\",\"position\":34},{\"kind\":\"content-shown\",\"position\":35},{\"kind\":\"content-shown\",\"position\":36},{\"kind\":\"content-shown\",\"position\":37},{\"kind\":\"content-shown\",\"position\":38},{\"kind\":\"checkpoint-due\",\"position\":38},{\"kind\":\"answer-accepted\",\"position\":38,\"scored\":true},{\"kind\":\"content-shown\",\"position\":39},{\"kind\":\"content-shown\",\"position\":40},{\"kind\":\"content-shown\",\"position\":41},{\"kind\":\"content-shown\",\"position\":42},{\"kind\":\"content-shown\",\"position\":43},{\"kind\":\"content-shown\",\"position\":44},{\"kind\":\"content-shown\",\"position\":45},{\"kind\":\"content-shown\",\"position\":46},{\"kind\":\"content-shown\",\"position\":47},{\"kind\":\"content-shown\",\"position\":48},{\"kind\":\"content-shown\",\"position\":49},{\"kind\":\"content-shown\",\"position\":50},{\"kind\":\"content-shown\",\"position\":51},{\"kind\":\"checkpoint-due\",\"position\":51},{\"kind\":\"answer-accepted\",\"position\":51,\"scored\":true},{\"ending\":\"completed\",\"kind\":\"attempt-ended\"}]",
      "results": "{\"assistanceStep\":null,\"assisted\":false,\"ending\":\"completed\",\"finances\":null,\"metrics\":{\"betting-adherence\":null,\"card-values\":null,\"playing-adherence\":null,\"running-count\":{\"correct\":1,\"total\":4},\"true-count\":null},\"review\":[{\"checkpoint\":1,\"entered\":\"skip\",\"error\":null,\"kind\":\"running-count\",\"position\":13,\"reference\":-2},{\"checkpoint\":2,\"entered\":0,\"error\":0,\"kind\":\"running-count\",\"position\":26,\"reference\":0},{\"checkpoint\":3,\"entered\":0,\"error\":1,\"kind\":\"running-count\",\"position\":39,\"reference\":-1},{\"checkpoint\":4,\"entered\":0,\"error\":7,\"kind\":\"running-count\",\"position\":52,\"reference\":-7}]}"
    },
    {
      "name": "conversion Learn, a wrong true count explained",
      "category": "conversion",
      "phase": "explanation",
      "specification": {
        "attemptId": "attempt-1",
        "content": {
          "category": "conversion",
          "id": "conversion",
          "length": 10,
          "maxDecks": 6,
          "maxRunningCount": 20,
          "version": 1
        },
        "device": "device-1",
        "owner": "owner-1",
        "variant": "learn"
      },
      "random": {
        "key": [
          1,
          2654435769
        ],
        "protocol": 1,
        "session": [
          8,
          0
        ]
      },
      "checkpoint": "{\"answers\":[{\"first\":-3,\"last\":-3,\"position\":0,\"tries\":1}],\"attempt\":{\"device\":\"device-1\",\"id\":\"attempt-1\",\"owner\":\"owner-1\"},\"content\":{\"category\":\"conversion\",\"id\":\"conversion\",\"length\":10,\"maxDecks\":6,\"maxRunningCount\":20,\"version\":1},\"ending\":null,\"identities\":{\"category\":\"conversion\",\"content\":{\"id\":\"conversion\",\"version\":1},\"engine\":\"0.0.0\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":null},\"items\":[{\"decks\":5.5,\"running\":-15},{\"decks\":0.5,\"running\":12},{\"decks\":3.5,\"running\":11},{\"decks\":5,\"running\":18},{\"decks\":3.5,\"running\":-19},{\"decks\":1.5,\"running\":0},{\"decks\":4.5,\"running\":14},{\"decks\":5,\"running\":0},{\"decks\":3,\"running\":19},{\"decks\":0.5,\"running\":9}],\"phase\":\"explanation\",\"position\":0,\"random\":{\"block\":[10,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":0,\"protocol\":1,\"session\":[8,0]},\"receipts\":[{\"command\":\"{\\\"kind\\\":\\\"begin\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":-3}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1}],\"rejected\":1,\"revealedAt\":null,\"schema\":13,\"sequence\":2,\"table\":null,\"variant\":\"learn\"}",
      "continuation": [
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        }
      ],
      "facts": "[{\"kind\":\"content-shown\",\"position\":1},{\"kind\":\"answer-accepted\",\"position\":1,\"scored\":true},{\"kind\":\"content-shown\",\"position\":2},{\"kind\":\"answer-accepted\",\"position\":2,\"scored\":true},{\"kind\":\"content-shown\",\"position\":3},{\"kind\":\"answer-accepted\",\"position\":3,\"scored\":true},{\"kind\":\"content-shown\",\"position\":4},{\"kind\":\"answer-accepted\",\"position\":4,\"scored\":true},{\"kind\":\"content-shown\",\"position\":5},{\"kind\":\"answer-accepted\",\"position\":5,\"scored\":true},{\"kind\":\"content-shown\",\"position\":6},{\"kind\":\"answer-accepted\",\"position\":6,\"scored\":true},{\"kind\":\"content-shown\",\"position\":7},{\"kind\":\"answer-accepted\",\"position\":7,\"scored\":true},{\"kind\":\"content-shown\",\"position\":8},{\"kind\":\"answer-accepted\",\"position\":8,\"scored\":true},{\"kind\":\"content-shown\",\"position\":9},{\"kind\":\"answer-accepted\",\"position\":9,\"scored\":true},{\"ending\":\"completed\",\"kind\":\"attempt-ended\"}]",
      "results": "{\"assistanceStep\":null,\"assisted\":true,\"ending\":\"completed\",\"finances\":null,\"metrics\":{\"betting-adherence\":null,\"card-values\":null,\"playing-adherence\":null,\"running-count\":null,\"true-count\":{\"correct\":2,\"total\":10}},\"review\":[{\"decks\":5.5,\"entered\":-3,\"error\":-1,\"kind\":\"conversion\",\"position\":1,\"reference\":-2,\"running\":-15},{\"decks\":0.5,\"entered\":0,\"error\":-24,\"kind\":\"conversion\",\"position\":2,\"reference\":24,\"running\":12},{\"decks\":3.5,\"entered\":0,\"error\":-3,\"kind\":\"conversion\",\"position\":3,\"reference\":3,\"running\":11},{\"decks\":5,\"entered\":0,\"error\":-3,\"kind\":\"conversion\",\"position\":4,\"reference\":3,\"running\":18},{\"decks\":3.5,\"entered\":0,\"error\":5,\"kind\":\"conversion\",\"position\":5,\"reference\":-5,\"running\":-19},{\"decks\":1.5,\"entered\":0,\"error\":0,\"kind\":\"conversion\",\"position\":6,\"reference\":0,\"running\":0},{\"decks\":4.5,\"entered\":0,\"error\":-3,\"kind\":\"conversion\",\"position\":7,\"reference\":3,\"running\":14},{\"decks\":5,\"entered\":0,\"error\":0,\"kind\":\"conversion\",\"position\":8,\"reference\":0,\"running\":0},{\"decks\":3,\"entered\":0,\"error\":-6,\"kind\":\"conversion\",\"position\":9,\"reference\":6,\"running\":19},{\"decks\":0.5,\"entered\":0,\"error\":-18,\"kind\":\"conversion\",\"position\":10,\"reference\":18,\"running\":9}]}"
    },
    {
      "name": "conversion Check, a true count recorded",
      "category": "conversion",
      "phase": "recorded",
      "specification": {
        "attemptId": "attempt-1",
        "content": {
          "category": "conversion",
          "id": "conversion",
          "length": 10,
          "maxDecks": 6,
          "maxRunningCount": 20,
          "version": 1
        },
        "device": "device-1",
        "owner": "owner-1",
        "variant": "check"
      },
      "random": {
        "key": [
          1,
          2654435769
        ],
        "protocol": 1,
        "session": [
          8,
          0
        ]
      },
      "checkpoint": "{\"answers\":[{\"first\":-2,\"last\":-2,\"position\":0,\"tries\":1},{\"first\":23,\"last\":23,\"position\":1,\"tries\":1}],\"attempt\":{\"device\":\"device-1\",\"id\":\"attempt-1\",\"owner\":\"owner-1\"},\"content\":{\"category\":\"conversion\",\"id\":\"conversion\",\"length\":10,\"maxDecks\":6,\"maxRunningCount\":20,\"version\":1},\"ending\":null,\"identities\":{\"category\":\"conversion\",\"content\":{\"id\":\"conversion\",\"version\":1},\"engine\":\"0.0.0\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":null},\"items\":[{\"decks\":5.5,\"running\":-15},{\"decks\":0.5,\"running\":12},{\"decks\":3.5,\"running\":11},{\"decks\":5,\"running\":18},{\"decks\":3.5,\"running\":-19},{\"decks\":1.5,\"running\":0},{\"decks\":4.5,\"running\":14},{\"decks\":5,\"running\":0},{\"decks\":3,\"running\":19},{\"decks\":0.5,\"running\":9}],\"phase\":\"recorded\",\"position\":1,\"random\":{\"block\":[10,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":0,\"protocol\":1,\"session\":[8,0]},\"receipts\":[{\"command\":\"{\\\"kind\\\":\\\"begin\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":-2}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":23}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3}],\"rejected\":1,\"revealedAt\":null,\"schema\":13,\"sequence\":4,\"table\":null,\"variant\":\"check\"}",
      "continuation": [
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        }
      ],
      "facts": "[{\"kind\":\"content-shown\",\"position\":2},{\"kind\":\"answer-accepted\",\"position\":2,\"scored\":true},{\"kind\":\"content-shown\",\"position\":3},{\"kind\":\"answer-accepted\",\"position\":3,\"scored\":true},{\"kind\":\"content-shown\",\"position\":4},{\"kind\":\"answer-accepted\",\"position\":4,\"scored\":true},{\"kind\":\"content-shown\",\"position\":5},{\"kind\":\"answer-accepted\",\"position\":5,\"scored\":true},{\"kind\":\"content-shown\",\"position\":6},{\"kind\":\"answer-accepted\",\"position\":6,\"scored\":true},{\"kind\":\"content-shown\",\"position\":7},{\"kind\":\"answer-accepted\",\"position\":7,\"scored\":true},{\"kind\":\"content-shown\",\"position\":8},{\"kind\":\"answer-accepted\",\"position\":8,\"scored\":true},{\"kind\":\"content-shown\",\"position\":9},{\"kind\":\"answer-accepted\",\"position\":9,\"scored\":true},{\"ending\":\"completed\",\"kind\":\"attempt-ended\"}]",
      "results": "{\"assistanceStep\":null,\"assisted\":false,\"ending\":\"completed\",\"finances\":null,\"metrics\":{\"betting-adherence\":null,\"card-values\":null,\"playing-adherence\":null,\"running-count\":null,\"true-count\":{\"correct\":3,\"total\":10}},\"review\":[{\"decks\":5.5,\"entered\":-2,\"error\":0,\"kind\":\"conversion\",\"position\":1,\"reference\":-2,\"running\":-15},{\"decks\":0.5,\"entered\":23,\"error\":-1,\"kind\":\"conversion\",\"position\":2,\"reference\":24,\"running\":12},{\"decks\":3.5,\"entered\":0,\"error\":-3,\"kind\":\"conversion\",\"position\":3,\"reference\":3,\"running\":11},{\"decks\":5,\"entered\":0,\"error\":-3,\"kind\":\"conversion\",\"position\":4,\"reference\":3,\"running\":18},{\"decks\":3.5,\"entered\":0,\"error\":5,\"kind\":\"conversion\",\"position\":5,\"reference\":-5,\"running\":-19},{\"decks\":1.5,\"entered\":0,\"error\":0,\"kind\":\"conversion\",\"position\":6,\"reference\":0,\"running\":0},{\"decks\":4.5,\"entered\":0,\"error\":-3,\"kind\":\"conversion\",\"position\":7,\"reference\":3,\"running\":14},{\"decks\":5,\"entered\":0,\"error\":0,\"kind\":\"conversion\",\"position\":8,\"reference\":0,\"running\":0},{\"decks\":3,\"entered\":0,\"error\":-6,\"kind\":\"conversion\",\"position\":9,\"reference\":6,\"running\":19},{\"decks\":0.5,\"entered\":0,\"error\":-18,\"kind\":\"conversion\",\"position\":10,\"reference\":18,\"running\":9}]}"
    },
    {
      "name": "table Observe Learn N=1, a wrong running count after round 1 explained",
      "category": "table",
      "phase": "explanation",
      "specification": {
        "attemptId": "attempt-1",
        "content": {
          "category": "table",
          "id": "table",
          "reference": {
            "id": "blackjack-reference",
            "version": 1
          },
          "rounds": 10,
          "version": 1
        },
        "device": "device-1",
        "owner": "owner-1",
        "table": {
          "interval": 1,
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
          "seat": "observe",
          "strategy": {
            "first": {
              "hard": [
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HDDDDDDDDH",
                "HDDDDDDDDD",
                "HSSSSSHHHH",
                "HSSSSSHHHH",
                "HSSSSSHHHH",
                "HSSSSSHHHH",
                "HSSSSSHHHR",
                "SSSSSSSSSS",
                "SSSSSSSSSS",
                "SSSSSSSSSS",
                "SSSSSSSSSS"
              ],
              "pair": [
                "PPPPPPPPPP",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HDDDDDDDDH",
                "HSSSSSHHHH",
                "HSSSSSHHHH",
                "PPPPPPPPPP",
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
                "SSSSSSSSSS",
                "SSSSSSSSSS",
                "SSSSSSSSSS"
              ]
            },
            "later": {
              "hard": [
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HDDDDDDDDH",
                "HDDDDDDDDD",
                "HSSSSSHHHH",
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
                "SSSSSSSSSS",
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
                "HSSSSSHHHH",
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
                "SSSSSSSSSS",
                "SSSSSSSSSS",
                "SSSSSSSSSS",
                "SSSSSSSSSS"
              ]
            },
            "pairAtCap": [
              "SSSSSSSSSS",
              "HHHHHHHHHH",
              "HHHHHHHHHH",
              "HHHHHHHHHH",
              "HDDDDDDDDH",
              "HSSSSSHHHH",
              "HSSSSSHHHH",
              "HSSSSSHHHH",
              "SSSSSSSSSS",
              "SSSSSSSSSS"
            ],
            "pairWithoutSurrender": [
              "PPPPPPPPPP",
              "HHHHHHHHHH",
              "HHHHHHHHHH",
              "HHHHHHHHHH",
              "HDDDDDDDDH",
              "HSSSSSHHHH",
              "HSSSSSHHHH",
              "PPPPPPPPPP",
              "SSSSSSSSSS",
              "SSSSSSSSSS"
            ]
          }
        },
        "variant": "learn"
      },
      "random": {
        "key": [
          1,
          2654435769
        ],
        "protocol": 1,
        "session": [
          8,
          0
        ]
      },
      "checkpoint": "{\"answers\":[{\"first\":0,\"last\":0,\"position\":0,\"tries\":1},{\"first\":0,\"last\":0,\"position\":1,\"tries\":1},{\"first\":4,\"last\":4,\"position\":10,\"tries\":1}],\"attempt\":{\"device\":\"device-1\",\"id\":\"attempt-1\",\"owner\":\"owner-1\"},\"content\":{\"category\":\"table\",\"id\":\"table\",\"reference\":{\"id\":\"blackjack-reference\",\"version\":1},\"rounds\":10,\"version\":1},\"ending\":null,\"identities\":{\"category\":\"table\",\"content\":{\"id\":\"table\",\"version\":1},\"engine\":\"0.0.0\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":{\"id\":\"blackjack-reference\",\"version\":1}},\"items\":[{\"checkpoint\":1,\"count\":\"running\",\"round\":1,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"checkpoint\":1,\"count\":\"true\",\"round\":1,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"events\":[],\"face\":{\"rank\":13,\"suit\":\"diamonds\"},\"round\":1,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":{\"rank\":3,\"suit\":\"hearts\"},\"round\":1,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":4,\"suit\":\"clubs\"},\"round\":1,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":null,\"round\":1,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"hand-1\"}],\"face\":{\"rank\":3,\"suit\":\"diamonds\"},\"round\":1,\"step\":\"reveal\"},{\"events\":[],\"face\":{\"rank\":3,\"suit\":\"clubs\"},\"round\":1,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":4,\"suit\":\"clubs\"},\"round\":1,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":12,\"suit\":\"clubs\"},\"round\":1,\"step\":\"deal\",\"to\":\"dealer\"},{\"checkpoint\":2,\"count\":\"running\",\"round\":1,\"step\":\"prompt\",\"timing\":\"after-round\"}],\"phase\":\"explanation\",\"position\":10,\"random\":{\"block\":[77,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":3,\"protocol\":1,\"session\":[8,0]},\"receipts\":[{\"command\":\"{\\\"kind\\\":\\\"begin\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-4\",\"disposition\":\"applied\",\"sequence\":4},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-5\",\"disposition\":\"applied\",\"sequence\":5},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-6\",\"disposition\":\"applied\",\"sequence\":6},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-7\",\"disposition\":\"applied\",\"sequence\":7},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-8\",\"disposition\":\"applied\",\"sequence\":8},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-9\",\"disposition\":\"applied\",\"sequence\":9},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-10\",\"disposition\":\"applied\",\"sequence\":10},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-11\",\"disposition\":\"applied\",\"sequence\":11},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-12\",\"disposition\":\"applied\",\"sequence\":12},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":4}\",\"commandId\":\"record-13\",\"disposition\":\"applied\",\"sequence\":13}],\"rejected\":0,\"revealedAt\":null,\"schema\":13,\"sequence\":14,\"table\":{\"round\":1,\"seat\":null,\"setup\":{\"interval\":1,\"rules\":{\"dealer\":\"S17\",\"decks\":6,\"id\":\"blackjack-six-deck\",\"lateSurrender\":true,\"limits\":{\"initial\":{\"max\":\"1000\",\"min\":\"10\"}},\"penetration\":75,\"players\":{\"learnerSeat\":0,\"otherWagers\":[],\"strategy\":null},\"version\":1},\"seat\":\"observe\",\"strategy\":{\"first\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"PPPPPPPPPP\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"PPPPPPPPPP\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"later\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"laterWithoutDouble\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"pairAtCap\":[\"SSSSSSSSSS\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pairWithoutSurrender\":[\"PPPPPPPPPP\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"PPPPPPPPPP\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]}},\"shoe\":{\"cut\":234,\"next\":7,\"order\":[25,132,107,15,210,3,63,179,220,201,283,37,247,200,137,79,35,64,56,38,97,294,30,130,238,146,138,161,249,214,127,104,86,258,2,134,11,180,227,159,114,285,152,99,47,39,206,269,217,98,279,71,287,101,88,198,234,300,42,57,13,67,221,115,261,110,136,171,22,26,248,303,92,128,65,311,288,58,33,62,16,119,170,271,292,45,82,169,7,219,19,5,230,203,204,59,70,6,83,280,43,302,262,87,53,267,260,297,60,100,211,117,286,291,143,199,259,176,95,240,229,84,125,113,61,290,226,202,256,187,156,81,275,74,103,20,270,298,140,265,23,184,109,177,52,166,181,106,123,31,135,309,40,196,0,228,266,235,273,158,4,116,66,252,131,172,232,168,304,241,186,278,96,111,183,12,34,307,213,308,164,296,299,281,48,150,165,239,289,251,243,236,17,178,225,257,197,29,205,122,46,293,118,188,274,254,276,218,102,189,174,208,139,246,55,282,193,72,167,145,191,245,284,124,233,80,222,163,73,49,8,190,154,231,41,147,77,277,21,209,242,50,1,10,153,51,182,195,120,253,212,263,28,90,216,155,250,301,207,192,305,18,69,121,224,185,36,295,264,237,310,91,144,94,173,244,9,27,89,129,68,112,78,194,75,255,160,306,151,76,268,24,54,157,215,32,14,142,133,141,93,223,108,126,44,175,105,148,149,162,85,272]}},\"variant\":\"learn\"}",
      "continuation": [
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        }
      ],
      "facts": "[{\"kind\":\"checkpoint-due\",\"position\":11},{\"kind\":\"answer-accepted\",\"position\":11,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":12,\"scored\":true},{\"kind\":\"content-shown\",\"position\":13},{\"kind\":\"content-shown\",\"position\":14},{\"kind\":\"content-shown\",\"position\":15},{\"kind\":\"content-shown\",\"position\":16},{\"kind\":\"content-shown\",\"position\":17},{\"kind\":\"checkpoint-due\",\"position\":18},{\"kind\":\"answer-accepted\",\"position\":18,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":19},{\"kind\":\"answer-accepted\",\"position\":19,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":20,\"scored\":true},{\"kind\":\"content-shown\",\"position\":21},{\"kind\":\"content-shown\",\"position\":22},{\"kind\":\"content-shown\",\"position\":23},{\"kind\":\"content-shown\",\"position\":24},{\"kind\":\"content-shown\",\"position\":25},{\"kind\":\"content-shown\",\"position\":26},{\"kind\":\"checkpoint-due\",\"position\":27},{\"kind\":\"answer-accepted\",\"position\":27,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":28},{\"kind\":\"answer-accepted\",\"position\":28,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":29,\"scored\":true},{\"kind\":\"content-shown\",\"position\":30},{\"kind\":\"content-shown\",\"position\":31},{\"kind\":\"content-shown\",\"position\":32},{\"kind\":\"content-shown\",\"position\":33},{\"kind\":\"content-shown\",\"position\":34},{\"kind\":\"content-shown\",\"position\":35},{\"kind\":\"checkpoint-due\",\"position\":36},{\"kind\":\"answer-accepted\",\"position\":36,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":37},{\"kind\":\"answer-accepted\",\"position\":37,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":38,\"scored\":true},{\"kind\":\"content-shown\",\"position\":39},{\"kind\":\"content-shown\",\"position\":40},{\"kind\":\"content-shown\",\"position\":41},{\"kind\":\"content-shown\",\"position\":42},{\"kind\":\"content-shown\",\"position\":43},{\"kind\":\"content-shown\",\"position\":44},{\"kind\":\"content-shown\",\"position\":45},{\"kind\":\"checkpoint-due\",\"position\":46},{\"kind\":\"answer-accepted\",\"position\":46,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":47},{\"kind\":\"answer-accepted\",\"position\":47,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":48,\"scored\":true},{\"kind\":\"content-shown\",\"position\":49},{\"kind\":\"content-shown\",\"position\":50},{\"kind\":\"content-shown\",\"position\":51},{\"kind\":\"content-shown\",\"position\":52},{\"kind\":\"content-shown\",\"position\":53},{\"kind\":\"content-shown\",\"position\":54},{\"kind\":\"content-shown\",\"position\":55},{\"kind\":\"checkpoint-due\",\"position\":56},{\"kind\":\"answer-accepted\",\"position\":56,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":57},{\"kind\":\"answer-accepted\",\"position\":57,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":58,\"scored\":true},{\"kind\":\"content-shown\",\"position\":59},{\"kind\":\"content-shown\",\"position\":60},{\"kind\":\"content-shown\",\"position\":61},{\"kind\":\"content-shown\",\"position\":62},{\"kind\":\"content-shown\",\"position\":63},{\"kind\":\"content-shown\",\"position\":64},{\"kind\":\"checkpoint-due\",\"position\":65},{\"kind\":\"answer-accepted\",\"position\":65,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":66},{\"kind\":\"answer-accepted\",\"position\":66,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":67,\"scored\":true},{\"kind\":\"content-shown\",\"position\":68},{\"kind\":\"content-shown\",\"position\":69},{\"kind\":\"content-shown\",\"position\":70},{\"kind\":\"content-shown\",\"position\":71},{\"kind\":\"content-shown\",\"position\":72},{\"kind\":\"content-shown\",\"position\":73},{\"kind\":\"checkpoint-due\",\"position\":74},{\"kind\":\"answer-accepted\",\"position\":74,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":75},{\"kind\":\"answer-accepted\",\"position\":75,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":76,\"scored\":true},{\"kind\":\"content-shown\",\"position\":77},{\"kind\":\"content-shown\",\"position\":78},{\"kind\":\"content-shown\",\"position\":79},{\"kind\":\"content-shown\",\"position\":80},{\"kind\":\"content-shown\",\"position\":81},{\"kind\":\"checkpoint-due\",\"position\":82},{\"kind\":\"answer-accepted\",\"position\":82,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":83},{\"kind\":\"answer-accepted\",\"position\":83,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":84,\"scored\":true},{\"kind\":\"content-shown\",\"position\":85},{\"kind\":\"content-shown\",\"position\":86},{\"kind\":\"content-shown\",\"position\":87},{\"kind\":\"content-shown\",\"position\":88},{\"kind\":\"content-shown\",\"position\":89},{\"kind\":\"checkpoint-due\",\"position\":90},{\"kind\":\"answer-accepted\",\"position\":90,\"scored\":true},{\"ending\":\"completed\",\"kind\":\"attempt-ended\"}]",
      "results": "{\"assistanceStep\":null,\"assisted\":true,\"ending\":\"completed\",\"finances\":null,\"metrics\":{\"betting-adherence\":null,\"card-values\":null,\"playing-adherence\":null,\"running-count\":{\"correct\":9,\"total\":20},\"true-count\":{\"correct\":9,\"total\":10}},\"review\":[{\"checkpoint\":1,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":1,\"reference\":0,\"round\":1,\"timing\":\"before-bet\"},{\"checkpoint\":1,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":2,\"reference\":0,\"round\":1,\"timing\":\"before-bet\"},{\"checkpoint\":2,\"count\":\"running\",\"entered\":4,\"error\":1,\"kind\":\"table\",\"position\":11,\"reference\":3,\"round\":1,\"timing\":\"after-round\"},{\"checkpoint\":3,\"count\":\"running\",\"entered\":0,\"error\":-3,\"kind\":\"table\",\"position\":12,\"reference\":3,\"round\":2,\"timing\":\"before-bet\"},{\"checkpoint\":3,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":13,\"reference\":0,\"round\":2,\"timing\":\"before-bet\"},{\"checkpoint\":4,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":19,\"reference\":0,\"round\":2,\"timing\":\"after-round\"},{\"checkpoint\":5,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":20,\"reference\":0,\"round\":3,\"timing\":\"before-bet\"},{\"checkpoint\":5,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":21,\"reference\":0,\"round\":3,\"timing\":\"before-bet\"},{\"checkpoint\":6,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":28,\"reference\":0,\"round\":3,\"timing\":\"after-round\"},{\"checkpoint\":7,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":29,\"reference\":0,\"round\":4,\"timing\":\"before-bet\"},{\"checkpoint\":7,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":30,\"reference\":0,\"round\":4,\"timing\":\"before-bet\"},{\"checkpoint\":8,\"count\":\"running\",\"entered\":0,\"error\":2,\"kind\":\"table\",\"position\":37,\"reference\":-2,\"round\":4,\"timing\":\"after-round\"},{\"checkpoint\":9,\"count\":\"running\",\"entered\":0,\"error\":2,\"kind\":\"table\",\"position\":38,\"reference\":-2,\"round\":5,\"timing\":\"before-bet\"},{\"checkpoint\":9,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":39,\"reference\":0,\"round\":5,\"timing\":\"before-bet\"},{\"checkpoint\":10,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":47,\"reference\":0,\"round\":5,\"timing\":\"after-round\"},{\"checkpoint\":11,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":48,\"reference\":0,\"round\":6,\"timing\":\"before-bet\"},{\"checkpoint\":11,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":49,\"reference\":0,\"round\":6,\"timing\":\"before-bet\"},{\"checkpoint\":12,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":57,\"reference\":0,\"round\":6,\"timing\":\"after-round\"},{\"checkpoint\":13,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":58,\"reference\":0,\"round\":7,\"timing\":\"before-bet\"},{\"checkpoint\":13,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":59,\"reference\":0,\"round\":7,\"timing\":\"before-bet\"},{\"checkpoint\":14,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":66,\"reference\":-1,\"round\":7,\"timing\":\"after-round\"},{\"checkpoint\":15,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":67,\"reference\":-1,\"round\":8,\"timing\":\"before-bet\"},{\"checkpoint\":15,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":68,\"reference\":0,\"round\":8,\"timing\":\"before-bet\"},{\"checkpoint\":16,\"count\":\"running\",\"entered\":0,\"error\":3,\"kind\":\"table\",\"position\":75,\"reference\":-3,\"round\":8,\"timing\":\"after-round\"},{\"checkpoint\":17,\"count\":\"running\",\"entered\":0,\"error\":3,\"kind\":\"table\",\"position\":76,\"reference\":-3,\"round\":9,\"timing\":\"before-bet\"},{\"checkpoint\":17,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":77,\"reference\":0,\"round\":9,\"timing\":\"before-bet\"},{\"checkpoint\":18,\"count\":\"running\",\"entered\":0,\"error\":5,\"kind\":\"table\",\"position\":83,\"reference\":-5,\"round\":9,\"timing\":\"after-round\"},{\"checkpoint\":19,\"count\":\"running\",\"entered\":0,\"error\":5,\"kind\":\"table\",\"position\":84,\"reference\":-5,\"round\":10,\"timing\":\"before-bet\"},{\"checkpoint\":19,\"count\":\"true\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":85,\"reference\":-1,\"round\":10,\"timing\":\"before-bet\"},{\"checkpoint\":20,\"count\":\"running\",\"entered\":0,\"error\":7,\"kind\":\"table\",\"position\":91,\"reference\":-7,\"round\":10,\"timing\":\"after-round\"}]}"
    },
    {
      "name": "table Observe Check N=3, mid-round with the count revealed",
      "category": "table",
      "phase": "card",
      "specification": {
        "attemptId": "attempt-1",
        "content": {
          "category": "table",
          "id": "table",
          "reference": {
            "id": "blackjack-reference",
            "version": 1
          },
          "rounds": 10,
          "version": 1
        },
        "device": "device-1",
        "owner": "owner-1",
        "table": {
          "interval": 3,
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
          "seat": "observe",
          "strategy": {
            "first": {
              "hard": [
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HDDDDDDDDH",
                "HDDDDDDDDD",
                "HSSSSSHHHH",
                "HSSSSSHHHH",
                "HSSSSSHHHH",
                "HSSSSSHHHH",
                "HSSSSSHHHR",
                "SSSSSSSSSS",
                "SSSSSSSSSS",
                "SSSSSSSSSS",
                "SSSSSSSSSS"
              ],
              "pair": [
                "PPPPPPPPPP",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HDDDDDDDDH",
                "HSSSSSHHHH",
                "HSSSSSHHHH",
                "PPPPPPPPPP",
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
                "SSSSSSSSSS",
                "SSSSSSSSSS",
                "SSSSSSSSSS"
              ]
            },
            "later": {
              "hard": [
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HDDDDDDDDH",
                "HDDDDDDDDD",
                "HSSSSSHHHH",
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
                "SSSSSSSSSS",
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
                "HSSSSSHHHH",
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
                "SSSSSSSSSS",
                "SSSSSSSSSS",
                "SSSSSSSSSS",
                "SSSSSSSSSS"
              ]
            },
            "pairAtCap": [
              "SSSSSSSSSS",
              "HHHHHHHHHH",
              "HHHHHHHHHH",
              "HHHHHHHHHH",
              "HDDDDDDDDH",
              "HSSSSSHHHH",
              "HSSSSSHHHH",
              "HSSSSSHHHH",
              "SSSSSSSSSS",
              "SSSSSSSSSS"
            ],
            "pairWithoutSurrender": [
              "PPPPPPPPPP",
              "HHHHHHHHHH",
              "HHHHHHHHHH",
              "HHHHHHHHHH",
              "HDDDDDDDDH",
              "HSSSSSHHHH",
              "HSSSSSHHHH",
              "PPPPPPPPPP",
              "SSSSSSSSSS",
              "SSSSSSSSSS"
            ]
          }
        },
        "variant": "check"
      },
      "random": {
        "key": [
          1,
          2654435769
        ],
        "protocol": 1,
        "session": [
          8,
          0
        ]
      },
      "checkpoint": "{\"answers\":[],\"attempt\":{\"device\":\"device-1\",\"id\":\"attempt-1\",\"owner\":\"owner-1\"},\"content\":{\"category\":\"table\",\"id\":\"table\",\"reference\":{\"id\":\"blackjack-reference\",\"version\":1},\"rounds\":10,\"version\":1},\"ending\":null,\"identities\":{\"category\":\"table\",\"content\":{\"id\":\"table\",\"version\":1},\"engine\":\"0.0.0\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":{\"id\":\"blackjack-reference\",\"version\":1}},\"items\":[{\"events\":[],\"face\":{\"rank\":13,\"suit\":\"diamonds\"},\"round\":1,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":{\"rank\":3,\"suit\":\"hearts\"},\"round\":1,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":4,\"suit\":\"clubs\"},\"round\":1,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":null,\"round\":1,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"hand-1\"}],\"face\":{\"rank\":3,\"suit\":\"diamonds\"},\"round\":1,\"step\":\"reveal\"},{\"events\":[],\"face\":{\"rank\":3,\"suit\":\"clubs\"},\"round\":1,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":4,\"suit\":\"clubs\"},\"round\":1,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":12,\"suit\":\"clubs\"},\"round\":1,\"step\":\"deal\",\"to\":\"dealer\"}],\"phase\":\"card\",\"position\":2,\"random\":{\"block\":[77,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":3,\"protocol\":1,\"session\":[8,0]},\"receipts\":[{\"command\":\"{\\\"kind\\\":\\\"begin\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"kind\\\":\\\"reveal-count\\\"}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3}],\"rejected\":0,\"revealedAt\":3,\"schema\":13,\"sequence\":4,\"table\":{\"round\":1,\"seat\":null,\"setup\":{\"interval\":3,\"rules\":{\"dealer\":\"S17\",\"decks\":6,\"id\":\"blackjack-six-deck\",\"lateSurrender\":true,\"limits\":{\"initial\":{\"max\":\"1000\",\"min\":\"10\"}},\"penetration\":75,\"players\":{\"learnerSeat\":0,\"otherWagers\":[],\"strategy\":null},\"version\":1},\"seat\":\"observe\",\"strategy\":{\"first\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"PPPPPPPPPP\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"PPPPPPPPPP\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"later\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"laterWithoutDouble\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"pairAtCap\":[\"SSSSSSSSSS\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pairWithoutSurrender\":[\"PPPPPPPPPP\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"PPPPPPPPPP\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]}},\"shoe\":{\"cut\":234,\"next\":7,\"order\":[25,132,107,15,210,3,63,179,220,201,283,37,247,200,137,79,35,64,56,38,97,294,30,130,238,146,138,161,249,214,127,104,86,258,2,134,11,180,227,159,114,285,152,99,47,39,206,269,217,98,279,71,287,101,88,198,234,300,42,57,13,67,221,115,261,110,136,171,22,26,248,303,92,128,65,311,288,58,33,62,16,119,170,271,292,45,82,169,7,219,19,5,230,203,204,59,70,6,83,280,43,302,262,87,53,267,260,297,60,100,211,117,286,291,143,199,259,176,95,240,229,84,125,113,61,290,226,202,256,187,156,81,275,74,103,20,270,298,140,265,23,184,109,177,52,166,181,106,123,31,135,309,40,196,0,228,266,235,273,158,4,116,66,252,131,172,232,168,304,241,186,278,96,111,183,12,34,307,213,308,164,296,299,281,48,150,165,239,289,251,243,236,17,178,225,257,197,29,205,122,46,293,118,188,274,254,276,218,102,189,174,208,139,246,55,282,193,72,167,145,191,245,284,124,233,80,222,163,73,49,8,190,154,231,41,147,77,277,21,209,242,50,1,10,153,51,182,195,120,253,212,263,28,90,216,155,250,301,207,192,305,18,69,121,224,185,36,295,264,237,310,91,144,94,173,244,9,27,89,129,68,112,78,194,75,255,160,306,151,76,268,24,54,157,215,32,14,142,133,141,93,223,108,126,44,175,105,148,149,162,85,272]}},\"variant\":\"check\"}",
      "continuation": [
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        }
      ],
      "facts": "[{\"kind\":\"content-shown\",\"position\":3},{\"kind\":\"content-shown\",\"position\":4},{\"kind\":\"content-shown\",\"position\":5},{\"kind\":\"content-shown\",\"position\":6},{\"kind\":\"content-shown\",\"position\":7},{\"kind\":\"content-shown\",\"position\":8},{\"kind\":\"content-shown\",\"position\":9},{\"kind\":\"content-shown\",\"position\":10},{\"kind\":\"content-shown\",\"position\":11},{\"kind\":\"content-shown\",\"position\":12},{\"kind\":\"content-shown\",\"position\":13},{\"kind\":\"content-shown\",\"position\":14},{\"kind\":\"content-shown\",\"position\":15},{\"kind\":\"content-shown\",\"position\":16},{\"kind\":\"content-shown\",\"position\":17},{\"kind\":\"content-shown\",\"position\":18},{\"kind\":\"checkpoint-due\",\"position\":19},{\"kind\":\"answer-accepted\",\"position\":19,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":20,\"scored\":true},{\"kind\":\"content-shown\",\"position\":21},{\"kind\":\"content-shown\",\"position\":22},{\"kind\":\"content-shown\",\"position\":23},{\"kind\":\"content-shown\",\"position\":24},{\"kind\":\"content-shown\",\"position\":25},{\"kind\":\"content-shown\",\"position\":26},{\"kind\":\"content-shown\",\"position\":27},{\"kind\":\"content-shown\",\"position\":28},{\"kind\":\"content-shown\",\"position\":29},{\"kind\":\"content-shown\",\"position\":30},{\"kind\":\"content-shown\",\"position\":31},{\"kind\":\"content-shown\",\"position\":32},{\"kind\":\"content-shown\",\"position\":33},{\"kind\":\"content-shown\",\"position\":34},{\"kind\":\"content-shown\",\"position\":35},{\"kind\":\"content-shown\",\"position\":36},{\"kind\":\"content-shown\",\"position\":37},{\"kind\":\"content-shown\",\"position\":38},{\"kind\":\"content-shown\",\"position\":39},{\"kind\":\"content-shown\",\"position\":40},{\"kind\":\"checkpoint-due\",\"position\":41},{\"kind\":\"answer-accepted\",\"position\":41,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":42,\"scored\":true},{\"kind\":\"content-shown\",\"position\":43},{\"kind\":\"content-shown\",\"position\":44},{\"kind\":\"content-shown\",\"position\":45},{\"kind\":\"content-shown\",\"position\":46},{\"kind\":\"content-shown\",\"position\":47},{\"kind\":\"content-shown\",\"position\":48},{\"kind\":\"content-shown\",\"position\":49},{\"kind\":\"content-shown\",\"position\":50},{\"kind\":\"content-shown\",\"position\":51},{\"kind\":\"content-shown\",\"position\":52},{\"kind\":\"content-shown\",\"position\":53},{\"kind\":\"content-shown\",\"position\":54},{\"kind\":\"content-shown\",\"position\":55},{\"kind\":\"content-shown\",\"position\":56},{\"kind\":\"content-shown\",\"position\":57},{\"kind\":\"content-shown\",\"position\":58},{\"kind\":\"content-shown\",\"position\":59},{\"kind\":\"checkpoint-due\",\"position\":60},{\"kind\":\"answer-accepted\",\"position\":60,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":61,\"scored\":true},{\"kind\":\"content-shown\",\"position\":62},{\"kind\":\"content-shown\",\"position\":63},{\"kind\":\"content-shown\",\"position\":64},{\"kind\":\"content-shown\",\"position\":65},{\"kind\":\"content-shown\",\"position\":66},{\"kind\":\"checkpoint-due\",\"position\":67},{\"kind\":\"answer-accepted\",\"position\":67,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":68,\"scored\":true},{\"ending\":\"completed\",\"kind\":\"attempt-ended\"}]",
      "results": "{\"assistanceStep\":3,\"assisted\":true,\"ending\":\"completed\",\"finances\":null,\"metrics\":{\"betting-adherence\":null,\"card-values\":null,\"playing-adherence\":null,\"running-count\":{\"correct\":2,\"total\":4},\"true-count\":{\"correct\":2,\"total\":4}},\"review\":[{\"checkpoint\":1,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":20,\"reference\":0,\"round\":3,\"timing\":\"block\"},{\"checkpoint\":1,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":21,\"reference\":0,\"round\":3,\"timing\":\"block\"},{\"checkpoint\":2,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":42,\"reference\":0,\"round\":6,\"timing\":\"block\"},{\"checkpoint\":2,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":43,\"reference\":0,\"round\":6,\"timing\":\"block\"},{\"checkpoint\":3,\"count\":\"running\",\"entered\":0,\"error\":5,\"kind\":\"table\",\"position\":61,\"reference\":-5,\"round\":9,\"timing\":\"block\"},{\"checkpoint\":3,\"count\":\"true\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":62,\"reference\":-1,\"round\":9,\"timing\":\"block\"},{\"checkpoint\":4,\"count\":\"running\",\"entered\":0,\"error\":7,\"kind\":\"table\",\"position\":68,\"reference\":-7,\"round\":10,\"timing\":\"block\"},{\"checkpoint\":4,\"count\":\"true\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":69,\"reference\":-1,\"round\":10,\"timing\":\"block\"}]}"
    },
    {
      "name": "table Observe Check, four extra players at 50%, past a reshuffle",
      "category": "table",
      "phase": "question",
      "specification": {
        "attemptId": "attempt-1",
        "content": {
          "category": "table",
          "id": "table",
          "reference": {
            "id": "blackjack-reference",
            "version": 1
          },
          "rounds": 10,
          "version": 1
        },
        "device": "device-1",
        "owner": "owner-1",
        "table": {
          "interval": 1,
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
            "penetration": 50,
            "players": {
              "learnerSeat": 4,
              "otherWagers": [
                "10",
                "10",
                "10",
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
                    "HHHHHHHHHH",
                    "HDDDDDDDDH",
                    "HDDDDDDDDD",
                    "HSSSSSHHHH",
                    "HSSSSSHHHH",
                    "HSSSSSHHHH",
                    "HSSSSSHHHH",
                    "HSSSSSHHHR",
                    "SSSSSSSSSS",
                    "SSSSSSSSSS",
                    "SSSSSSSSSS",
                    "SSSSSSSSSS"
                  ],
                  "pair": [
                    "PPPPPPPPPP",
                    "HHHHHHHHHH",
                    "HHHHHHHHHH",
                    "HHHHHHHHHH",
                    "HDDDDDDDDH",
                    "HSSSSSHHHH",
                    "HSSSSSHHHH",
                    "PPPPPPPPPP",
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
                    "SSSSSSSSSS",
                    "SSSSSSSSSS",
                    "SSSSSSSSSS"
                  ]
                },
                "later": {
                  "hard": [
                    "HHHHHHHHHH",
                    "HHHHHHHHHH",
                    "HHHHHHHHHH",
                    "HHHHHHHHHH",
                    "HHHHHHHHHH",
                    "HHHHHHHHHH",
                    "HDDDDDDDDH",
                    "HDDDDDDDDD",
                    "HSSSSSHHHH",
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
                    "SSSSSSSSSS",
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
                    "HSSSSSHHHH",
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
                    "SSSSSSSSSS",
                    "SSSSSSSSSS",
                    "SSSSSSSSSS",
                    "SSSSSSSSSS"
                  ]
                },
                "pairAtCap": [
                  "SSSSSSSSSS",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HDDDDDDDDH",
                  "HSSSSSHHHH",
                  "HSSSSSHHHH",
                  "HSSSSSHHHH",
                  "SSSSSSSSSS",
                  "SSSSSSSSSS"
                ],
                "pairWithoutSurrender": [
                  "PPPPPPPPPP",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HDDDDDDDDH",
                  "HSSSSSHHHH",
                  "HSSSSSHHHH",
                  "PPPPPPPPPP",
                  "SSSSSSSSSS",
                  "SSSSSSSSSS"
                ]
              }
            },
            "version": 1
          },
          "seat": "observe",
          "strategy": {
            "first": {
              "hard": [
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HDDDDDDDDH",
                "HDDDDDDDDD",
                "HSSSSSHHHH",
                "HSSSSSHHHH",
                "HSSSSSHHHH",
                "HSSSSSHHHH",
                "HSSSSSHHHR",
                "SSSSSSSSSS",
                "SSSSSSSSSS",
                "SSSSSSSSSS",
                "SSSSSSSSSS"
              ],
              "pair": [
                "PPPPPPPPPP",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HDDDDDDDDH",
                "HSSSSSHHHH",
                "HSSSSSHHHH",
                "PPPPPPPPPP",
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
                "SSSSSSSSSS",
                "SSSSSSSSSS",
                "SSSSSSSSSS"
              ]
            },
            "later": {
              "hard": [
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HDDDDDDDDH",
                "HDDDDDDDDD",
                "HSSSSSHHHH",
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
                "SSSSSSSSSS",
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
                "HSSSSSHHHH",
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
                "SSSSSSSSSS",
                "SSSSSSSSSS",
                "SSSSSSSSSS",
                "SSSSSSSSSS"
              ]
            },
            "pairAtCap": [
              "SSSSSSSSSS",
              "HHHHHHHHHH",
              "HHHHHHHHHH",
              "HHHHHHHHHH",
              "HDDDDDDDDH",
              "HSSSSSHHHH",
              "HSSSSSHHHH",
              "HSSSSSHHHH",
              "SSSSSSSSSS",
              "SSSSSSSSSS"
            ],
            "pairWithoutSurrender": [
              "PPPPPPPPPP",
              "HHHHHHHHHH",
              "HHHHHHHHHH",
              "HHHHHHHHHH",
              "HDDDDDDDDH",
              "HSSSSSHHHH",
              "HSSSSSHHHH",
              "PPPPPPPPPP",
              "SSSSSSSSSS",
              "SSSSSSSSSS"
            ]
          }
        },
        "variant": "check"
      },
      "random": {
        "key": [
          146,
          2654435769
        ],
        "protocol": 1,
        "session": [
          1023,
          0
        ]
      },
      "checkpoint": "{\"answers\":[{\"first\":0,\"last\":0,\"position\":0,\"tries\":1},{\"first\":0,\"last\":0,\"position\":1,\"tries\":1},{\"first\":0,\"last\":0,\"position\":20,\"tries\":1},{\"first\":0,\"last\":0,\"position\":21,\"tries\":1},{\"first\":0,\"last\":0,\"position\":22,\"tries\":1},{\"first\":0,\"last\":0,\"position\":46,\"tries\":1},{\"first\":0,\"last\":0,\"position\":47,\"tries\":1},{\"first\":0,\"last\":0,\"position\":48,\"tries\":1},{\"first\":0,\"last\":0,\"position\":70,\"tries\":1},{\"first\":0,\"last\":0,\"position\":71,\"tries\":1},{\"first\":0,\"last\":0,\"position\":72,\"tries\":1},{\"first\":0,\"last\":0,\"position\":89,\"tries\":1},{\"first\":0,\"last\":0,\"position\":90,\"tries\":1},{\"first\":0,\"last\":0,\"position\":91,\"tries\":1},{\"first\":0,\"last\":0,\"position\":108,\"tries\":1},{\"first\":0,\"last\":0,\"position\":109,\"tries\":1},{\"first\":0,\"last\":0,\"position\":110,\"tries\":1},{\"first\":0,\"last\":0,\"position\":127,\"tries\":1},{\"first\":0,\"last\":0,\"position\":128,\"tries\":1},{\"first\":0,\"last\":0,\"position\":129,\"tries\":1},{\"first\":0,\"last\":0,\"position\":148,\"tries\":1},{\"first\":0,\"last\":0,\"position\":149,\"tries\":1},{\"first\":0,\"last\":0,\"position\":150,\"tries\":1},{\"first\":0,\"last\":0,\"position\":172,\"tries\":1},{\"first\":0,\"last\":0,\"position\":173,\"tries\":1},{\"first\":0,\"last\":0,\"position\":174,\"tries\":1},{\"first\":0,\"last\":0,\"position\":196,\"tries\":1}],\"attempt\":{\"device\":\"device-1\",\"id\":\"attempt-1\",\"owner\":\"owner-1\"},\"content\":{\"category\":\"table\",\"id\":\"table\",\"reference\":{\"id\":\"blackjack-reference\",\"version\":1},\"rounds\":10,\"version\":1},\"ending\":null,\"identities\":{\"category\":\"table\",\"content\":{\"id\":\"table\",\"version\":1},\"engine\":\"0.0.0\",\"random\":{\"key\":[146,2654435769],\"protocol\":1,\"session\":[1023,0]},\"reference\":{\"id\":\"blackjack-reference\",\"version\":1}},\"items\":[{\"checkpoint\":1,\"count\":\"running\",\"round\":1,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"checkpoint\":1,\"count\":\"true\",\"round\":1,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"events\":[],\"face\":{\"rank\":5,\"suit\":\"diamonds\"},\"round\":1,\"step\":\"deal\",\"to\":\"seat-1-hand-1\"},{\"events\":[],\"face\":{\"rank\":3,\"suit\":\"hearts\"},\"round\":1,\"step\":\"deal\",\"to\":\"seat-2-hand-1\"},{\"events\":[],\"face\":{\"rank\":8,\"suit\":\"clubs\"},\"round\":1,\"step\":\"deal\",\"to\":\"seat-3-hand-1\"},{\"events\":[],\"face\":{\"rank\":3,\"suit\":\"spades\"},\"round\":1,\"step\":\"deal\",\"to\":\"seat-4-hand-1\"},{\"events\":[],\"face\":{\"rank\":8,\"suit\":\"diamonds\"},\"round\":1,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":{\"rank\":11,\"suit\":\"clubs\"},\"round\":1,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":7,\"suit\":\"hearts\"},\"round\":1,\"step\":\"deal\",\"to\":\"seat-1-hand-1\"},{\"events\":[],\"face\":{\"rank\":10,\"suit\":\"spades\"},\"round\":1,\"step\":\"deal\",\"to\":\"seat-2-hand-1\"},{\"events\":[],\"face\":{\"rank\":1,\"suit\":\"spades\"},\"round\":1,\"step\":\"deal\",\"to\":\"seat-3-hand-1\"},{\"events\":[],\"face\":{\"rank\":8,\"suit\":\"clubs\"},\"round\":1,\"step\":\"deal\",\"to\":\"seat-4-hand-1\"},{\"events\":[],\"face\":{\"rank\":7,\"suit\":\"hearts\"},\"round\":1,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":null,\"round\":1,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[{\"kind\":\"peeked\",\"result\":\"no-blackjack\"},{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"seat-1-hand-1\"}],\"face\":{\"rank\":8,\"suit\":\"spades\"},\"round\":1,\"step\":\"deal\",\"to\":\"seat-1-hand-1\"},{\"events\":[{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"seat-1-hand-1\"},{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"seat-2-hand-1\"}],\"face\":{\"rank\":8,\"suit\":\"diamonds\"},\"round\":1,\"step\":\"deal\",\"to\":\"seat-2-hand-1\"},{\"events\":[{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"seat-3-hand-1\"},{\"action\":\"double\",\"kind\":\"played\",\"target\":\"seat-4-hand-1\"}],\"face\":{\"rank\":9,\"suit\":\"clubs\"},\"round\":1,\"step\":\"deal\",\"to\":\"seat-4-hand-1\"},{\"events\":[{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"hand-1\"}],\"face\":{\"rank\":2,\"suit\":\"hearts\"},\"round\":1,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"hand-1\"}],\"face\":{\"rank\":5,\"suit\":\"diamonds\"},\"round\":1,\"step\":\"reveal\"},{\"events\":[],\"face\":{\"rank\":9,\"suit\":\"spades\"},\"round\":1,\"step\":\"deal\",\"to\":\"dealer\"},{\"checkpoint\":2,\"count\":\"running\",\"round\":1,\"step\":\"prompt\",\"timing\":\"after-round\"},{\"checkpoint\":3,\"count\":\"running\",\"round\":2,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"checkpoint\":3,\"count\":\"true\",\"round\":2,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"events\":[],\"face\":{\"rank\":4,\"suit\":\"spades\"},\"round\":2,\"step\":\"deal\",\"to\":\"seat-1-hand-1\"},{\"events\":[],\"face\":{\"rank\":7,\"suit\":\"spades\"},\"round\":2,\"step\":\"deal\",\"to\":\"seat-2-hand-1\"},{\"events\":[],\"face\":{\"rank\":5,\"suit\":\"hearts\"},\"round\":2,\"step\":\"deal\",\"to\":\"seat-3-hand-1\"},{\"events\":[],\"face\":{\"rank\":9,\"suit\":\"clubs\"},\"round\":2,\"step\":\"deal\",\"to\":\"seat-4-hand-1\"},{\"events\":[],\"face\":{\"rank\":12,\"suit\":\"diamonds\"},\"round\":2,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":{\"rank\":9,\"suit\":\"spades\"},\"round\":2,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":2,\"suit\":\"spades\"},\"round\":2,\"step\":\"deal\",\"to\":\"seat-1-hand-1\"},{\"events\":[],\"face\":{\"rank\":8,\"suit\":\"clubs\"},\"round\":2,\"step\":\"deal\",\"to\":\"seat-2-hand-1\"},{\"events\":[],\"face\":{\"rank\":10,\"suit\":\"clubs\"},\"round\":2,\"step\":\"deal\",\"to\":\"seat-3-hand-1\"},{\"events\":[],\"face\":{\"rank\":2,\"suit\":\"clubs\"},\"round\":2,\"step\":\"deal\",\"to\":\"seat-4-hand-1\"},{\"events\":[],\"face\":{\"rank\":3,\"suit\":\"diamonds\"},\"round\":2,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":null,\"round\":2,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"seat-1-hand-1\"}],\"face\":{\"rank\":3,\"suit\":\"hearts\"},\"round\":2,\"step\":\"deal\",\"to\":\"seat-1-hand-1\"},{\"events\":[{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"seat-1-hand-1\"}],\"face\":{\"rank\":9,\"suit\":\"clubs\"},\"round\":2,\"step\":\"deal\",\"to\":\"seat-1-hand-1\"},{\"events\":[{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"seat-1-hand-1\"},{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"seat-2-hand-1\"}],\"face\":{\"rank\":2,\"suit\":\"clubs\"},\"round\":2,\"step\":\"deal\",\"to\":\"seat-2-hand-1\"},{\"events\":[{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"seat-2-hand-1\"},{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"seat-3-hand-1\"}],\"face\":{\"rank\":1,\"suit\":\"diamonds\"},\"round\":2,\"step\":\"deal\",\"to\":\"seat-3-hand-1\"},{\"events\":[{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"seat-3-hand-1\"}],\"face\":{\"rank\":7,\"suit\":\"diamonds\"},\"round\":2,\"step\":\"deal\",\"to\":\"seat-3-hand-1\"},{\"events\":[{\"action\":\"double\",\"kind\":\"played\",\"target\":\"seat-4-hand-1\"}],\"face\":{\"rank\":6,\"suit\":\"diamonds\"},\"round\":2,\"step\":\"deal\",\"to\":\"seat-4-hand-1\"},{\"events\":[{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"hand-1\"}],\"face\":{\"rank\":1,\"suit\":\"clubs\"},\"round\":2,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"hand-1\"}],\"face\":{\"rank\":5,\"suit\":\"hearts\"},\"round\":2,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"hand-1\"}],\"face\":{\"rank\":2,\"suit\":\"diamonds\"},\"round\":2,\"step\":\"reveal\"},{\"events\":[],\"face\":{\"rank\":1,\"suit\":\"hearts\"},\"round\":2,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":7,\"suit\":\"spades\"},\"round\":2,\"step\":\"deal\",\"to\":\"dealer\"},{\"checkpoint\":4,\"count\":\"running\",\"round\":2,\"step\":\"prompt\",\"timing\":\"after-round\"},{\"checkpoint\":5,\"count\":\"running\",\"round\":3,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"checkpoint\":5,\"count\":\"true\",\"round\":3,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"events\":[],\"face\":{\"rank\":10,\"suit\":\"diamonds\"},\"round\":3,\"step\":\"deal\",\"to\":\"seat-1-hand-1\"},{\"events\":[],\"face\":{\"rank\":1,\"suit\":\"spades\"},\"round\":3,\"step\":\"deal\",\"to\":\"seat-2-hand-1\"},{\"events\":[],\"face\":{\"rank\":4,\"suit\":\"hearts\"},\"round\":3,\"step\":\"deal\",\"to\":\"seat-3-hand-1\"},{\"events\":[],\"face\":{\"rank\":8,\"suit\":\"diamonds\"},\"round\":3,\"step\":\"deal\",\"to\":\"seat-4-hand-1\"},{\"events\":[],\"face\":{\"rank\":3,\"suit\":\"spades\"},\"round\":3,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":{\"rank\":7,\"suit\":\"hearts\"},\"round\":3,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":4,\"suit\":\"hearts\"},\"round\":3,\"step\":\"deal\",\"to\":\"seat-1-hand-1\"},{\"events\":[],\"face\":{\"rank\":1,\"suit\":\"hearts\"},\"round\":3,\"step\":\"deal\",\"to\":\"seat-2-hand-1\"},{\"events\":[],\"face\":{\"rank\":13,\"suit\":\"clubs\"},\"round\":3,\"step\":\"deal\",\"to\":\"seat-3-hand-1\"},{\"events\":[],\"face\":{\"rank\":8,\"suit\":\"clubs\"},\"round\":3,\"step\":\"deal\",\"to\":\"seat-4-hand-1\"},{\"events\":[],\"face\":{\"rank\":9,\"suit\":\"diamonds\"},\"round\":3,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":null,\"round\":3,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"seat-1-hand-1\"}],\"face\":{\"rank\":6,\"suit\":\"hearts\"},\"round\":3,\"step\":\"deal\",\"to\":\"seat-1-hand-1\"},{\"events\":[{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"seat-1-hand-1\"},{\"action\":\"split\",\"kind\":\"played\",\"target\":\"seat-2-hand-1\"},{\"into\":\"seat-2-hand-2\",\"kind\":\"split\",\"target\":\"seat-2-hand-1\"}],\"face\":{\"rank\":13,\"suit\":\"hearts\"},\"round\":3,\"step\":\"deal\",\"to\":\"seat-2-hand-1\"},{\"events\":[],\"face\":{\"rank\":11,\"suit\":\"hearts\"},\"round\":3,\"step\":\"deal\",\"to\":\"seat-2-hand-2\"},{\"events\":[{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"seat-3-hand-1\"}],\"face\":{\"rank\":3,\"suit\":\"hearts\"},\"round\":3,\"step\":\"deal\",\"to\":\"seat-3-hand-1\"},{\"events\":[{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"seat-3-hand-1\"},{\"action\":\"split\",\"kind\":\"played\",\"target\":\"seat-4-hand-1\"},{\"into\":\"seat-4-hand-2\",\"kind\":\"split\",\"target\":\"seat-4-hand-1\"}],\"face\":{\"rank\":9,\"suit\":\"diamonds\"},\"round\":3,\"step\":\"deal\",\"to\":\"seat-4-hand-1\"},{\"events\":[{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"seat-4-hand-1\"}],\"face\":{\"rank\":12,\"suit\":\"diamonds\"},\"round\":3,\"step\":\"deal\",\"to\":\"seat-4-hand-2\"},{\"events\":[{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"seat-4-hand-2\"},{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"hand-1\"}],\"face\":{\"rank\":1,\"suit\":\"hearts\"},\"round\":3,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"hand-1\"}],\"face\":{\"rank\":5,\"suit\":\"clubs\"},\"round\":3,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"hand-1\"}],\"face\":{\"rank\":11,\"suit\":\"diamonds\"},\"round\":3,\"step\":\"reveal\"},{\"checkpoint\":6,\"count\":\"running\",\"round\":3,\"step\":\"prompt\",\"timing\":\"after-round\"},{\"checkpoint\":7,\"count\":\"running\",\"round\":4,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"checkpoint\":7,\"count\":\"true\",\"round\":4,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"events\":[],\"face\":{\"rank\":1,\"suit\":\"hearts\"},\"round\":4,\"step\":\"deal\",\"to\":\"seat-1-hand-1\"},{\"events\":[],\"face\":{\"rank\":9,\"suit\":\"diamonds\"},\"round\":4,\"step\":\"deal\",\"to\":\"seat-2-hand-1\"},{\"events\":[],\"face\":{\"rank\":13,\"suit\":\"spades\"},\"round\":4,\"step\":\"deal\",\"to\":\"seat-3-hand-1\"},{\"events\":[],\"face\":{\"rank\":10,\"suit\":\"hearts\"},\"round\":4,\"step\":\"deal\",\"to\":\"seat-4-hand-1\"},{\"events\":[],\"face\":{\"rank\":2,\"suit\":\"spades\"},\"round\":4,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":{\"rank\":9,\"suit\":\"clubs\"},\"round\":4,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":13,\"suit\":\"spades\"},\"round\":4,\"step\":\"deal\",\"to\":\"seat-1-hand-1\"},{\"events\":[],\"face\":{\"rank\":11,\"suit\":\"clubs\"},\"round\":4,\"step\":\"deal\",\"to\":\"seat-2-hand-1\"},{\"events\":[],\"face\":{\"rank\":4,\"suit\":\"clubs\"},\"round\":4,\"step\":\"deal\",\"to\":\"seat-3-hand-1\"},{\"events\":[],\"face\":{\"rank\":3,\"suit\":\"clubs\"},\"round\":4,\"step\":\"deal\",\"to\":\"seat-4-hand-1\"},{\"events\":[],\"face\":{\"rank\":13,\"suit\":\"hearts\"},\"round\":4,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":null,\"round\":4,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"seat-2-hand-1\"},{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"seat-3-hand-1\"}],\"face\":{\"rank\":13,\"suit\":\"hearts\"},\"round\":4,\"step\":\"deal\",\"to\":\"seat-3-hand-1\"},{\"events\":[{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"seat-4-hand-1\"}],\"face\":{\"rank\":5,\"suit\":\"diamonds\"},\"round\":4,\"step\":\"deal\",\"to\":\"seat-4-hand-1\"},{\"events\":[{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"seat-4-hand-1\"},{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"hand-1\"}],\"face\":{\"rank\":10,\"suit\":\"spades\"},\"round\":4,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":{\"rank\":13,\"suit\":\"spades\"},\"round\":4,\"step\":\"reveal\"},{\"checkpoint\":8,\"count\":\"running\",\"round\":4,\"step\":\"prompt\",\"timing\":\"after-round\"},{\"checkpoint\":9,\"count\":\"running\",\"round\":5,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"checkpoint\":9,\"count\":\"true\",\"round\":5,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"events\":[],\"face\":{\"rank\":2,\"suit\":\"spades\"},\"round\":5,\"step\":\"deal\",\"to\":\"seat-1-hand-1\"},{\"events\":[],\"face\":{\"rank\":12,\"suit\":\"clubs\"},\"round\":5,\"step\":\"deal\",\"to\":\"seat-2-hand-1\"},{\"events\":[],\"face\":{\"rank\":6,\"suit\":\"hearts\"},\"round\":5,\"step\":\"deal\",\"to\":\"seat-3-hand-1\"},{\"events\":[],\"face\":{\"rank\":10,\"suit\":\"clubs\"},\"round\":5,\"step\":\"deal\",\"to\":\"seat-4-hand-1\"},{\"events\":[],\"face\":{\"rank\":1,\"suit\":\"diamonds\"},\"round\":5,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":{\"rank\":5,\"suit\":\"hearts\"},\"round\":5,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":2,\"suit\":\"diamonds\"},\"round\":5,\"step\":\"deal\",\"to\":\"seat-1-hand-1\"},{\"events\":[],\"face\":{\"rank\":11,\"suit\":\"diamonds\"},\"round\":5,\"step\":\"deal\",\"to\":\"seat-2-hand-1\"},{\"events\":[],\"face\":{\"rank\":12,\"suit\":\"diamonds\"},\"round\":5,\"step\":\"deal\",\"to\":\"seat-3-hand-1\"},{\"events\":[],\"face\":{\"rank\":9,\"suit\":\"hearts\"},\"round\":5,\"step\":\"deal\",\"to\":\"seat-4-hand-1\"},{\"events\":[],\"face\":{\"rank\":9,\"suit\":\"spades\"},\"round\":5,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":null,\"round\":5,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"seat-1-hand-1\"}],\"face\":{\"rank\":7,\"suit\":\"spades\"},\"round\":5,\"step\":\"deal\",\"to\":\"seat-1-hand-1\"},{\"events\":[{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"seat-1-hand-1\"}],\"face\":{\"rank\":1,\"suit\":\"diamonds\"},\"round\":5,\"step\":\"deal\",\"to\":\"seat-1-hand-1\"},{\"events\":[{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"seat-1-hand-1\"},{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"seat-2-hand-1\"},{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"seat-3-hand-1\"},{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"seat-4-hand-1\"},{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"hand-1\"}],\"face\":{\"rank\":10,\"suit\":\"spades\"},\"round\":5,\"step\":\"reveal\"},{\"events\":[],\"face\":{\"rank\":2,\"suit\":\"diamonds\"},\"round\":5,\"step\":\"deal\",\"to\":\"dealer\"},{\"checkpoint\":10,\"count\":\"running\",\"round\":5,\"step\":\"prompt\",\"timing\":\"after-round\"},{\"checkpoint\":11,\"count\":\"running\",\"round\":6,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"checkpoint\":11,\"count\":\"true\",\"round\":6,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"events\":[],\"face\":{\"rank\":13,\"suit\":\"hearts\"},\"round\":6,\"step\":\"deal\",\"to\":\"seat-1-hand-1\"},{\"events\":[],\"face\":{\"rank\":13,\"suit\":\"clubs\"},\"round\":6,\"step\":\"deal\",\"to\":\"seat-2-hand-1\"},{\"events\":[],\"face\":{\"rank\":6,\"suit\":\"spades\"},\"round\":6,\"step\":\"deal\",\"to\":\"seat-3-hand-1\"},{\"events\":[],\"face\":{\"rank\":9,\"suit\":\"clubs\"},\"round\":6,\"step\":\"deal\",\"to\":\"seat-4-hand-1\"},{\"events\":[],\"face\":{\"rank\":11,\"suit\":\"spades\"},\"round\":6,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":{\"rank\":11,\"suit\":\"spades\"},\"round\":6,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":10,\"suit\":\"spades\"},\"round\":6,\"step\":\"deal\",\"to\":\"seat-1-hand-1\"},{\"events\":[],\"face\":{\"rank\":8,\"suit\":\"hearts\"},\"round\":6,\"step\":\"deal\",\"to\":\"seat-2-hand-1\"},{\"events\":[],\"face\":{\"rank\":13,\"suit\":\"spades\"},\"round\":6,\"step\":\"deal\",\"to\":\"seat-3-hand-1\"},{\"events\":[],\"face\":{\"rank\":6,\"suit\":\"hearts\"},\"round\":6,\"step\":\"deal\",\"to\":\"seat-4-hand-1\"},{\"events\":[],\"face\":{\"rank\":9,\"suit\":\"spades\"},\"round\":6,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":null,\"round\":6,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[{\"kind\":\"peeked\",\"result\":\"no-blackjack\"},{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"seat-1-hand-1\"},{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"seat-2-hand-1\"},{\"action\":\"surrender\",\"kind\":\"played\",\"target\":\"seat-3-hand-1\"},{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"seat-4-hand-1\"}],\"face\":{\"rank\":5,\"suit\":\"clubs\"},\"round\":6,\"step\":\"deal\",\"to\":\"seat-4-hand-1\"},{\"events\":[{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"seat-4-hand-1\"},{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"hand-1\"}],\"face\":{\"rank\":3,\"suit\":\"clubs\"},\"round\":6,\"step\":\"reveal\"},{\"events\":[],\"face\":{\"rank\":2,\"suit\":\"hearts\"},\"round\":6,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":12,\"suit\":\"spades\"},\"round\":6,\"step\":\"deal\",\"to\":\"dealer\"},{\"checkpoint\":12,\"count\":\"running\",\"round\":6,\"step\":\"prompt\",\"timing\":\"after-round\"},{\"checkpoint\":13,\"count\":\"running\",\"round\":7,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"checkpoint\":13,\"count\":\"true\",\"round\":7,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"events\":[],\"face\":{\"rank\":1,\"suit\":\"clubs\"},\"round\":7,\"step\":\"deal\",\"to\":\"seat-1-hand-1\"},{\"events\":[],\"face\":{\"rank\":2,\"suit\":\"clubs\"},\"round\":7,\"step\":\"deal\",\"to\":\"seat-2-hand-1\"},{\"events\":[],\"face\":{\"rank\":6,\"suit\":\"spades\"},\"round\":7,\"step\":\"deal\",\"to\":\"seat-3-hand-1\"},{\"events\":[],\"face\":{\"rank\":13,\"suit\":\"hearts\"},\"round\":7,\"step\":\"deal\",\"to\":\"seat-4-hand-1\"},{\"events\":[],\"face\":{\"rank\":13,\"suit\":\"diamonds\"},\"round\":7,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":{\"rank\":12,\"suit\":\"spades\"},\"round\":7,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":1,\"suit\":\"diamonds\"},\"round\":7,\"step\":\"deal\",\"to\":\"seat-1-hand-1\"},{\"events\":[],\"face\":{\"rank\":10,\"suit\":\"clubs\"},\"round\":7,\"step\":\"deal\",\"to\":\"seat-2-hand-1\"},{\"events\":[],\"face\":{\"rank\":11,\"suit\":\"diamonds\"},\"round\":7,\"step\":\"deal\",\"to\":\"seat-3-hand-1\"},{\"events\":[],\"face\":{\"rank\":5,\"suit\":\"hearts\"},\"round\":7,\"step\":\"deal\",\"to\":\"seat-4-hand-1\"},{\"events\":[],\"face\":{\"rank\":5,\"suit\":\"spades\"},\"round\":7,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":null,\"round\":7,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[{\"kind\":\"peeked\",\"result\":\"no-blackjack\"},{\"action\":\"split\",\"kind\":\"played\",\"target\":\"seat-1-hand-1\"},{\"into\":\"seat-1-hand-2\",\"kind\":\"split\",\"target\":\"seat-1-hand-1\"}],\"face\":{\"rank\":1,\"suit\":\"spades\"},\"round\":7,\"step\":\"deal\",\"to\":\"seat-1-hand-1\"},{\"events\":[],\"face\":{\"rank\":7,\"suit\":\"diamonds\"},\"round\":7,\"step\":\"deal\",\"to\":\"seat-1-hand-2\"},{\"events\":[{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"seat-2-hand-1\"}],\"face\":{\"rank\":11,\"suit\":\"clubs\"},\"round\":7,\"step\":\"deal\",\"to\":\"seat-2-hand-1\"},{\"events\":[{\"action\":\"surrender\",\"kind\":\"played\",\"target\":\"seat-3-hand-1\"},{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"seat-4-hand-1\"}],\"face\":{\"rank\":2,\"suit\":\"diamonds\"},\"round\":7,\"step\":\"deal\",\"to\":\"seat-4-hand-1\"},{\"events\":[{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"seat-4-hand-1\"},{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"hand-1\"}],\"face\":{\"rank\":2,\"suit\":\"hearts\"},\"round\":7,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"hand-1\"}],\"face\":{\"rank\":13,\"suit\":\"spades\"},\"round\":7,\"step\":\"reveal\"},{\"checkpoint\":14,\"count\":\"running\",\"round\":7,\"step\":\"prompt\",\"timing\":\"after-round\"},{\"checkpoint\":15,\"count\":\"running\",\"round\":8,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"checkpoint\":15,\"count\":\"true\",\"round\":8,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"events\":[],\"face\":{\"rank\":4,\"suit\":\"clubs\"},\"round\":8,\"step\":\"deal\",\"to\":\"seat-1-hand-1\"},{\"events\":[],\"face\":{\"rank\":10,\"suit\":\"diamonds\"},\"round\":8,\"step\":\"deal\",\"to\":\"seat-2-hand-1\"},{\"events\":[],\"face\":{\"rank\":7,\"suit\":\"clubs\"},\"round\":8,\"step\":\"deal\",\"to\":\"seat-3-hand-1\"},{\"events\":[],\"face\":{\"rank\":9,\"suit\":\"hearts\"},\"round\":8,\"step\":\"deal\",\"to\":\"seat-4-hand-1\"},{\"events\":[],\"face\":{\"rank\":13,\"suit\":\"diamonds\"},\"round\":8,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":{\"rank\":7,\"suit\":\"hearts\"},\"round\":8,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":10,\"suit\":\"clubs\"},\"round\":8,\"step\":\"deal\",\"to\":\"seat-1-hand-1\"},{\"events\":[],\"face\":{\"rank\":3,\"suit\":\"spades\"},\"round\":8,\"step\":\"deal\",\"to\":\"seat-2-hand-1\"},{\"events\":[],\"face\":{\"rank\":5,\"suit\":\"spades\"},\"round\":8,\"step\":\"deal\",\"to\":\"seat-3-hand-1\"},{\"events\":[],\"face\":{\"rank\":6,\"suit\":\"clubs\"},\"round\":8,\"step\":\"deal\",\"to\":\"seat-4-hand-1\"},{\"events\":[],\"face\":{\"rank\":5,\"suit\":\"hearts\"},\"round\":8,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":null,\"round\":8,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"seat-1-hand-1\"}],\"face\":{\"rank\":8,\"suit\":\"hearts\"},\"round\":8,\"step\":\"deal\",\"to\":\"seat-1-hand-1\"},{\"events\":[{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"seat-2-hand-1\"}],\"face\":{\"rank\":13,\"suit\":\"diamonds\"},\"round\":8,\"step\":\"deal\",\"to\":\"seat-2-hand-1\"},{\"events\":[{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"seat-3-hand-1\"}],\"face\":{\"rank\":4,\"suit\":\"diamonds\"},\"round\":8,\"step\":\"deal\",\"to\":\"seat-3-hand-1\"},{\"events\":[{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"seat-3-hand-1\"}],\"face\":{\"rank\":9,\"suit\":\"clubs\"},\"round\":8,\"step\":\"deal\",\"to\":\"seat-3-hand-1\"},{\"events\":[{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"seat-4-hand-1\"}],\"face\":{\"rank\":3,\"suit\":\"diamonds\"},\"round\":8,\"step\":\"deal\",\"to\":\"seat-4-hand-1\"},{\"events\":[{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"seat-4-hand-1\"},{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"hand-1\"}],\"face\":{\"rank\":2,\"suit\":\"spades\"},\"round\":8,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"hand-1\"}],\"face\":{\"rank\":2,\"suit\":\"clubs\"},\"round\":8,\"step\":\"reveal\"},{\"events\":[],\"face\":{\"rank\":7,\"suit\":\"spades\"},\"round\":8,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":3,\"suit\":\"clubs\"},\"round\":8,\"step\":\"deal\",\"to\":\"dealer\"},{\"checkpoint\":16,\"count\":\"running\",\"round\":8,\"step\":\"prompt\",\"timing\":\"after-round\"},{\"checkpoint\":17,\"count\":\"running\",\"round\":9,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"checkpoint\":17,\"count\":\"true\",\"round\":9,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"events\":[],\"face\":{\"rank\":13,\"suit\":\"diamonds\"},\"round\":9,\"step\":\"deal\",\"to\":\"seat-1-hand-1\"},{\"events\":[],\"face\":{\"rank\":4,\"suit\":\"diamonds\"},\"round\":9,\"step\":\"deal\",\"to\":\"seat-2-hand-1\"},{\"events\":[],\"face\":{\"rank\":10,\"suit\":\"diamonds\"},\"round\":9,\"step\":\"deal\",\"to\":\"seat-3-hand-1\"},{\"events\":[],\"face\":{\"rank\":6,\"suit\":\"spades\"},\"round\":9,\"step\":\"deal\",\"to\":\"seat-4-hand-1\"},{\"events\":[],\"face\":{\"rank\":4,\"suit\":\"hearts\"},\"round\":9,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":{\"rank\":13,\"suit\":\"clubs\"},\"round\":9,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":12,\"suit\":\"spades\"},\"round\":9,\"step\":\"deal\",\"to\":\"seat-1-hand-1\"},{\"events\":[],\"face\":{\"rank\":6,\"suit\":\"diamonds\"},\"round\":9,\"step\":\"deal\",\"to\":\"seat-2-hand-1\"},{\"events\":[],\"face\":{\"rank\":12,\"suit\":\"spades\"},\"round\":9,\"step\":\"deal\",\"to\":\"seat-3-hand-1\"},{\"events\":[],\"face\":{\"rank\":6,\"suit\":\"clubs\"},\"round\":9,\"step\":\"deal\",\"to\":\"seat-4-hand-1\"},{\"events\":[],\"face\":{\"rank\":6,\"suit\":\"clubs\"},\"round\":9,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":null,\"round\":9,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[{\"kind\":\"peeked\",\"result\":\"no-blackjack\"},{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"seat-1-hand-1\"},{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"seat-2-hand-1\"}],\"face\":{\"rank\":6,\"suit\":\"hearts\"},\"round\":9,\"step\":\"deal\",\"to\":\"seat-2-hand-1\"},{\"events\":[{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"seat-2-hand-1\"}],\"face\":{\"rank\":11,\"suit\":\"diamonds\"},\"round\":9,\"step\":\"deal\",\"to\":\"seat-2-hand-1\"},{\"events\":[{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"seat-3-hand-1\"},{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"seat-4-hand-1\"}],\"face\":{\"rank\":4,\"suit\":\"clubs\"},\"round\":9,\"step\":\"deal\",\"to\":\"seat-4-hand-1\"},{\"events\":[{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"seat-4-hand-1\"}],\"face\":{\"rank\":8,\"suit\":\"diamonds\"},\"round\":9,\"step\":\"deal\",\"to\":\"seat-4-hand-1\"},{\"events\":[{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"hand-1\"}],\"face\":{\"rank\":4,\"suit\":\"spades\"},\"round\":9,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"hand-1\"}],\"face\":{\"rank\":1,\"suit\":\"clubs\"},\"round\":9,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"hand-1\"}],\"face\":{\"rank\":10,\"suit\":\"hearts\"},\"round\":9,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":{\"rank\":5,\"suit\":\"diamonds\"},\"round\":9,\"step\":\"reveal\"},{\"events\":[],\"face\":{\"rank\":2,\"suit\":\"spades\"},\"round\":9,\"step\":\"deal\",\"to\":\"dealer\"},{\"checkpoint\":18,\"count\":\"running\",\"round\":9,\"step\":\"prompt\",\"timing\":\"after-round\"},{\"round\":10,\"step\":\"shuffle\"},{\"checkpoint\":19,\"count\":\"running\",\"round\":10,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"checkpoint\":19,\"count\":\"true\",\"round\":10,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"events\":[],\"face\":{\"rank\":13,\"suit\":\"clubs\"},\"round\":10,\"step\":\"deal\",\"to\":\"seat-1-hand-1\"},{\"events\":[],\"face\":{\"rank\":5,\"suit\":\"spades\"},\"round\":10,\"step\":\"deal\",\"to\":\"seat-2-hand-1\"},{\"events\":[],\"face\":{\"rank\":9,\"suit\":\"diamonds\"},\"round\":10,\"step\":\"deal\",\"to\":\"seat-3-hand-1\"},{\"events\":[],\"face\":{\"rank\":2,\"suit\":\"clubs\"},\"round\":10,\"step\":\"deal\",\"to\":\"seat-4-hand-1\"},{\"events\":[],\"face\":{\"rank\":10,\"suit\":\"diamonds\"},\"round\":10,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":{\"rank\":9,\"suit\":\"diamonds\"},\"round\":10,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":1,\"suit\":\"diamonds\"},\"round\":10,\"step\":\"deal\",\"to\":\"seat-1-hand-1\"},{\"events\":[],\"face\":{\"rank\":12,\"suit\":\"hearts\"},\"round\":10,\"step\":\"deal\",\"to\":\"seat-2-hand-1\"},{\"events\":[],\"face\":{\"rank\":9,\"suit\":\"spades\"},\"round\":10,\"step\":\"deal\",\"to\":\"seat-3-hand-1\"},{\"events\":[],\"face\":{\"rank\":4,\"suit\":\"diamonds\"},\"round\":10,\"step\":\"deal\",\"to\":\"seat-4-hand-1\"},{\"events\":[],\"face\":{\"rank\":5,\"suit\":\"diamonds\"},\"round\":10,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":null,\"round\":10,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"seat-2-hand-1\"}],\"face\":{\"rank\":1,\"suit\":\"spades\"},\"round\":10,\"step\":\"deal\",\"to\":\"seat-2-hand-1\"},{\"events\":[{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"seat-2-hand-1\"}],\"face\":{\"rank\":10,\"suit\":\"hearts\"},\"round\":10,\"step\":\"deal\",\"to\":\"seat-2-hand-1\"},{\"events\":[{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"seat-3-hand-1\"},{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"seat-4-hand-1\"}],\"face\":{\"rank\":12,\"suit\":\"hearts\"},\"round\":10,\"step\":\"deal\",\"to\":\"seat-4-hand-1\"},{\"events\":[{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"seat-4-hand-1\"}],\"face\":{\"rank\":7,\"suit\":\"hearts\"},\"round\":10,\"step\":\"deal\",\"to\":\"seat-4-hand-1\"},{\"events\":[{\"action\":\"hit\",\"kind\":\"played\",\"target\":\"hand-1\"}],\"face\":{\"rank\":2,\"suit\":\"clubs\"},\"round\":10,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"hand-1\"}],\"face\":{\"rank\":2,\"suit\":\"diamonds\"},\"round\":10,\"step\":\"reveal\"},{\"events\":[],\"face\":{\"rank\":10,\"suit\":\"hearts\"},\"round\":10,\"step\":\"deal\",\"to\":\"dealer\"},{\"checkpoint\":20,\"count\":\"running\",\"round\":10,\"step\":\"prompt\",\"timing\":\"after-round\"}],\"phase\":\"question\",\"position\":198,\"random\":{\"block\":[155,0],\"exhausted\":false,\"key\":[146,2654435769],\"lane\":2,\"protocol\":1,\"session\":[1023,0]},\"receipts\":[{\"command\":\"{\\\"kind\\\":\\\"begin\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-4\",\"disposition\":\"applied\",\"sequence\":4},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-5\",\"disposition\":\"applied\",\"sequence\":5},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-6\",\"disposition\":\"applied\",\"sequence\":6},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-7\",\"disposition\":\"applied\",\"sequence\":7},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-8\",\"disposition\":\"applied\",\"sequence\":8},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-9\",\"disposition\":\"applied\",\"sequence\":9},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-10\",\"disposition\":\"applied\",\"sequence\":10},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-11\",\"disposition\":\"applied\",\"sequence\":11},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-12\",\"disposition\":\"applied\",\"sequence\":12},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-13\",\"disposition\":\"applied\",\"sequence\":13},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-14\",\"disposition\":\"applied\",\"sequence\":14},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-15\",\"disposition\":\"applied\",\"sequence\":15},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-16\",\"disposition\":\"applied\",\"sequence\":16},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-17\",\"disposition\":\"applied\",\"sequence\":17},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-18\",\"disposition\":\"applied\",\"sequence\":18},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-19\",\"disposition\":\"applied\",\"sequence\":19},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-20\",\"disposition\":\"applied\",\"sequence\":20},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-21\",\"disposition\":\"applied\",\"sequence\":21},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-22\",\"disposition\":\"applied\",\"sequence\":22},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-23\",\"disposition\":\"applied\",\"sequence\":23},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-24\",\"disposition\":\"applied\",\"sequence\":24},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-25\",\"disposition\":\"applied\",\"sequence\":25},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-26\",\"disposition\":\"applied\",\"sequence\":26},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-27\",\"disposition\":\"applied\",\"sequence\":27},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-28\",\"disposition\":\"applied\",\"sequence\":28},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-29\",\"disposition\":\"applied\",\"sequence\":29},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-30\",\"disposition\":\"applied\",\"sequence\":30},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-31\",\"disposition\":\"applied\",\"sequence\":31},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-32\",\"disposition\":\"applied\",\"sequence\":32},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-33\",\"disposition\":\"applied\",\"sequence\":33},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-34\",\"disposition\":\"applied\",\"sequence\":34},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-35\",\"disposition\":\"applied\",\"sequence\":35},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-36\",\"disposition\":\"applied\",\"sequence\":36},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-37\",\"disposition\":\"applied\",\"sequence\":37},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-38\",\"disposition\":\"applied\",\"sequence\":38},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-39\",\"disposition\":\"applied\",\"sequence\":39},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-40\",\"disposition\":\"applied\",\"sequence\":40},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-41\",\"disposition\":\"applied\",\"sequence\":41},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-42\",\"disposition\":\"applied\",\"sequence\":42},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-43\",\"disposition\":\"applied\",\"sequence\":43},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-44\",\"disposition\":\"applied\",\"sequence\":44},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-45\",\"disposition\":\"applied\",\"sequence\":45},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-46\",\"disposition\":\"applied\",\"sequence\":46},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-47\",\"disposition\":\"applied\",\"sequence\":47},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-48\",\"disposition\":\"applied\",\"sequence\":48},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-49\",\"disposition\":\"applied\",\"sequence\":49},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-50\",\"disposition\":\"applied\",\"sequence\":50},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-51\",\"disposition\":\"applied\",\"sequence\":51},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-52\",\"disposition\":\"applied\",\"sequence\":52},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-53\",\"disposition\":\"applied\",\"sequence\":53},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-54\",\"disposition\":\"applied\",\"sequence\":54},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-55\",\"disposition\":\"applied\",\"sequence\":55},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-56\",\"disposition\":\"applied\",\"sequence\":56},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-57\",\"disposition\":\"applied\",\"sequence\":57},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-58\",\"disposition\":\"applied\",\"sequence\":58},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-59\",\"disposition\":\"applied\",\"sequence\":59},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-60\",\"disposition\":\"applied\",\"sequence\":60},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-61\",\"disposition\":\"applied\",\"sequence\":61},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-62\",\"disposition\":\"applied\",\"sequence\":62},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-63\",\"disposition\":\"applied\",\"sequence\":63},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-64\",\"disposition\":\"applied\",\"sequence\":64},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-65\",\"disposition\":\"applied\",\"sequence\":65},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-66\",\"disposition\":\"applied\",\"sequence\":66},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-67\",\"disposition\":\"applied\",\"sequence\":67},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-68\",\"disposition\":\"applied\",\"sequence\":68},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-69\",\"disposition\":\"applied\",\"sequence\":69},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-70\",\"disposition\":\"applied\",\"sequence\":70},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-71\",\"disposition\":\"applied\",\"sequence\":71},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-72\",\"disposition\":\"applied\",\"sequence\":72},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-73\",\"disposition\":\"applied\",\"sequence\":73},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-74\",\"disposition\":\"applied\",\"sequence\":74},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-75\",\"disposition\":\"applied\",\"sequence\":75},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-76\",\"disposition\":\"applied\",\"sequence\":76},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-77\",\"disposition\":\"applied\",\"sequence\":77},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-78\",\"disposition\":\"applied\",\"sequence\":78},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-79\",\"disposition\":\"applied\",\"sequence\":79},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-80\",\"disposition\":\"applied\",\"sequence\":80},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-81\",\"disposition\":\"applied\",\"sequence\":81},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-82\",\"disposition\":\"applied\",\"sequence\":82},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-83\",\"disposition\":\"applied\",\"sequence\":83},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-84\",\"disposition\":\"applied\",\"sequence\":84},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-85\",\"disposition\":\"applied\",\"sequence\":85},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-86\",\"disposition\":\"applied\",\"sequence\":86},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-87\",\"disposition\":\"applied\",\"sequence\":87},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-88\",\"disposition\":\"applied\",\"sequence\":88},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-89\",\"disposition\":\"applied\",\"sequence\":89},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-90\",\"disposition\":\"applied\",\"sequence\":90},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-91\",\"disposition\":\"applied\",\"sequence\":91},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-92\",\"disposition\":\"applied\",\"sequence\":92},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-93\",\"disposition\":\"applied\",\"sequence\":93},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-94\",\"disposition\":\"applied\",\"sequence\":94},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-95\",\"disposition\":\"applied\",\"sequence\":95},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-96\",\"disposition\":\"applied\",\"sequence\":96},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-97\",\"disposition\":\"applied\",\"sequence\":97},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-98\",\"disposition\":\"applied\",\"sequence\":98},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-99\",\"disposition\":\"applied\",\"sequence\":99},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-100\",\"disposition\":\"applied\",\"sequence\":100},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-101\",\"disposition\":\"applied\",\"sequence\":101},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-102\",\"disposition\":\"applied\",\"sequence\":102},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-103\",\"disposition\":\"applied\",\"sequence\":103},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-104\",\"disposition\":\"applied\",\"sequence\":104},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-105\",\"disposition\":\"applied\",\"sequence\":105},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-106\",\"disposition\":\"applied\",\"sequence\":106},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-107\",\"disposition\":\"applied\",\"sequence\":107},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-108\",\"disposition\":\"applied\",\"sequence\":108},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-109\",\"disposition\":\"applied\",\"sequence\":109},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-110\",\"disposition\":\"applied\",\"sequence\":110},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-111\",\"disposition\":\"applied\",\"sequence\":111},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-112\",\"disposition\":\"applied\",\"sequence\":112},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-113\",\"disposition\":\"applied\",\"sequence\":113},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-114\",\"disposition\":\"applied\",\"sequence\":114},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-115\",\"disposition\":\"applied\",\"sequence\":115},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-116\",\"disposition\":\"applied\",\"sequence\":116},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-117\",\"disposition\":\"applied\",\"sequence\":117},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-118\",\"disposition\":\"applied\",\"sequence\":118},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-119\",\"disposition\":\"applied\",\"sequence\":119},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-120\",\"disposition\":\"applied\",\"sequence\":120},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-121\",\"disposition\":\"applied\",\"sequence\":121},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-122\",\"disposition\":\"applied\",\"sequence\":122},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-123\",\"disposition\":\"applied\",\"sequence\":123},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-124\",\"disposition\":\"applied\",\"sequence\":124},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-125\",\"disposition\":\"applied\",\"sequence\":125},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-126\",\"disposition\":\"applied\",\"sequence\":126},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-127\",\"disposition\":\"applied\",\"sequence\":127},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-128\",\"disposition\":\"applied\",\"sequence\":128},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-129\",\"disposition\":\"applied\",\"sequence\":129},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-130\",\"disposition\":\"applied\",\"sequence\":130},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-131\",\"disposition\":\"applied\",\"sequence\":131},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-132\",\"disposition\":\"applied\",\"sequence\":132},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-133\",\"disposition\":\"applied\",\"sequence\":133},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-134\",\"disposition\":\"applied\",\"sequence\":134},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-135\",\"disposition\":\"applied\",\"sequence\":135},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-136\",\"disposition\":\"applied\",\"sequence\":136},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-137\",\"disposition\":\"applied\",\"sequence\":137},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-138\",\"disposition\":\"applied\",\"sequence\":138},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-139\",\"disposition\":\"applied\",\"sequence\":139},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-140\",\"disposition\":\"applied\",\"sequence\":140},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-141\",\"disposition\":\"applied\",\"sequence\":141},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-142\",\"disposition\":\"applied\",\"sequence\":142},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-143\",\"disposition\":\"applied\",\"sequence\":143},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-144\",\"disposition\":\"applied\",\"sequence\":144},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-145\",\"disposition\":\"applied\",\"sequence\":145},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-146\",\"disposition\":\"applied\",\"sequence\":146},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-147\",\"disposition\":\"applied\",\"sequence\":147},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-148\",\"disposition\":\"applied\",\"sequence\":148},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-149\",\"disposition\":\"applied\",\"sequence\":149},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-150\",\"disposition\":\"applied\",\"sequence\":150},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-151\",\"disposition\":\"applied\",\"sequence\":151},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-152\",\"disposition\":\"applied\",\"sequence\":152},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-153\",\"disposition\":\"applied\",\"sequence\":153},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-154\",\"disposition\":\"applied\",\"sequence\":154},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-155\",\"disposition\":\"applied\",\"sequence\":155},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-156\",\"disposition\":\"applied\",\"sequence\":156},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-157\",\"disposition\":\"applied\",\"sequence\":157},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-158\",\"disposition\":\"applied\",\"sequence\":158},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-159\",\"disposition\":\"applied\",\"sequence\":159},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-160\",\"disposition\":\"applied\",\"sequence\":160},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-161\",\"disposition\":\"applied\",\"sequence\":161},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-162\",\"disposition\":\"applied\",\"sequence\":162},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-163\",\"disposition\":\"applied\",\"sequence\":163},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-164\",\"disposition\":\"applied\",\"sequence\":164},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-165\",\"disposition\":\"applied\",\"sequence\":165},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-166\",\"disposition\":\"applied\",\"sequence\":166},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-167\",\"disposition\":\"applied\",\"sequence\":167},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-168\",\"disposition\":\"applied\",\"sequence\":168},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-169\",\"disposition\":\"applied\",\"sequence\":169},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-170\",\"disposition\":\"applied\",\"sequence\":170},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-171\",\"disposition\":\"applied\",\"sequence\":171},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-172\",\"disposition\":\"applied\",\"sequence\":172},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-173\",\"disposition\":\"applied\",\"sequence\":173},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-174\",\"disposition\":\"applied\",\"sequence\":174},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-175\",\"disposition\":\"applied\",\"sequence\":175},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-176\",\"disposition\":\"applied\",\"sequence\":176},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-177\",\"disposition\":\"applied\",\"sequence\":177},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-178\",\"disposition\":\"applied\",\"sequence\":178},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-179\",\"disposition\":\"applied\",\"sequence\":179},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-180\",\"disposition\":\"applied\",\"sequence\":180},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-181\",\"disposition\":\"applied\",\"sequence\":181},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-182\",\"disposition\":\"applied\",\"sequence\":182},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-183\",\"disposition\":\"applied\",\"sequence\":183},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-184\",\"disposition\":\"applied\",\"sequence\":184},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-185\",\"disposition\":\"applied\",\"sequence\":185},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-186\",\"disposition\":\"applied\",\"sequence\":186},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-187\",\"disposition\":\"applied\",\"sequence\":187},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-188\",\"disposition\":\"applied\",\"sequence\":188},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-189\",\"disposition\":\"applied\",\"sequence\":189},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-190\",\"disposition\":\"applied\",\"sequence\":190},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-191\",\"disposition\":\"applied\",\"sequence\":191},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-192\",\"disposition\":\"applied\",\"sequence\":192},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-193\",\"disposition\":\"applied\",\"sequence\":193},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-194\",\"disposition\":\"applied\",\"sequence\":194},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-195\",\"disposition\":\"applied\",\"sequence\":195},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-196\",\"disposition\":\"applied\",\"sequence\":196},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-197\",\"disposition\":\"applied\",\"sequence\":197},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-198\",\"disposition\":\"applied\",\"sequence\":198},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-199\",\"disposition\":\"applied\",\"sequence\":199},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-200\",\"disposition\":\"applied\",\"sequence\":200},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-201\",\"disposition\":\"applied\",\"sequence\":201},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-202\",\"disposition\":\"applied\",\"sequence\":202},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-203\",\"disposition\":\"applied\",\"sequence\":203},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-204\",\"disposition\":\"applied\",\"sequence\":204},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-205\",\"disposition\":\"applied\",\"sequence\":205},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-206\",\"disposition\":\"applied\",\"sequence\":206},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-207\",\"disposition\":\"applied\",\"sequence\":207},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-208\",\"disposition\":\"applied\",\"sequence\":208},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-209\",\"disposition\":\"applied\",\"sequence\":209},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-210\",\"disposition\":\"applied\",\"sequence\":210},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-211\",\"disposition\":\"applied\",\"sequence\":211},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-212\",\"disposition\":\"applied\",\"sequence\":212},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-213\",\"disposition\":\"applied\",\"sequence\":213},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-214\",\"disposition\":\"applied\",\"sequence\":214},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-215\",\"disposition\":\"applied\",\"sequence\":215},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-216\",\"disposition\":\"applied\",\"sequence\":216},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-217\",\"disposition\":\"applied\",\"sequence\":217},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-218\",\"disposition\":\"applied\",\"sequence\":218},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-219\",\"disposition\":\"applied\",\"sequence\":219},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-220\",\"disposition\":\"applied\",\"sequence\":220},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-221\",\"disposition\":\"applied\",\"sequence\":221},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-222\",\"disposition\":\"applied\",\"sequence\":222},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-223\",\"disposition\":\"applied\",\"sequence\":223},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-224\",\"disposition\":\"applied\",\"sequence\":224},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-225\",\"disposition\":\"applied\",\"sequence\":225}],\"rejected\":0,\"revealedAt\":null,\"schema\":13,\"sequence\":226,\"table\":{\"round\":10,\"seat\":null,\"setup\":{\"interval\":1,\"rules\":{\"dealer\":\"S17\",\"decks\":6,\"id\":\"blackjack-six-deck\",\"lateSurrender\":true,\"limits\":{\"initial\":{\"max\":\"1000\",\"min\":\"10\"}},\"penetration\":50,\"players\":{\"learnerSeat\":4,\"otherWagers\":[\"10\",\"10\",\"10\",\"10\"],\"strategy\":{\"first\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"PPPPPPPPPP\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"PPPPPPPPPP\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"later\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"laterWithoutDouble\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"pairAtCap\":[\"SSSSSSSSSS\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pairWithoutSurrender\":[\"PPPPPPPPPP\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"PPPPPPPPPP\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]}},\"version\":1},\"seat\":\"observe\",\"strategy\":{\"first\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"PPPPPPPPPP\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"PPPPPPPPPP\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"later\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"laterWithoutDouble\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"pairAtCap\":[\"SSSSSSSSSS\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pairWithoutSurrender\":[\"PPPPPPPPPP\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"PPPPPPPPPP\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]}},\"shoe\":{\"cut\":156,\"next\":18,\"order\":[64,199,73,209,230,125,13,37,151,276,277,170,195,191,141,32,105,295,119,251,112,36,279,148,205,185,272,247,40,7,143,156,41,134,244,5,178,116,297,186,50,274,159,241,122,309,47,9,243,28,93,273,238,69,257,136,161,242,126,248,70,281,190,158,294,213,246,253,153,104,87,22,133,44,260,288,80,15,72,202,61,30,221,78,275,154,225,84,19,0,139,118,53,181,18,6,206,12,26,76,16,152,283,38,135,58,88,137,3,308,138,130,255,280,278,65,262,62,100,97,162,211,229,174,193,256,75,250,157,176,291,71,140,115,264,128,145,46,166,124,107,111,296,298,68,42,67,43,59,56,216,66,163,302,249,77,210,54,187,222,282,101,2,219,106,55,204,265,214,180,1,24,179,33,144,261,95,270,150,169,172,10,131,201,90,99,35,287,268,34,227,208,200,189,173,215,231,127,292,29,83,121,129,110,79,269,85,305,197,146,94,252,175,239,286,8,196,48,25,17,109,102,177,188,117,113,306,120,267,299,220,212,293,237,74,235,149,263,103,108,307,224,228,123,223,194,245,60,96,4,284,304,167,63,217,303,132,52,233,240,45,51,81,182,301,266,300,82,226,198,165,164,183,271,155,49,31,285,91,310,20,218,168,142,259,184,258,86,27,234,160,89,192,114,57,254,311,14,11,171,232,290,203,98,21,236,147,207,289,39,92,23]}},\"variant\":\"check\"}",
      "continuation": [
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        }
      ],
      "facts": "[{\"kind\":\"answer-accepted\",\"position\":198,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":199,\"scored\":true},{\"kind\":\"content-shown\",\"position\":200},{\"kind\":\"content-shown\",\"position\":201},{\"kind\":\"content-shown\",\"position\":202},{\"kind\":\"content-shown\",\"position\":203},{\"kind\":\"content-shown\",\"position\":204},{\"kind\":\"content-shown\",\"position\":205},{\"kind\":\"content-shown\",\"position\":206},{\"kind\":\"content-shown\",\"position\":207},{\"kind\":\"content-shown\",\"position\":208},{\"kind\":\"content-shown\",\"position\":209},{\"kind\":\"content-shown\",\"position\":210},{\"kind\":\"content-shown\",\"position\":211},{\"kind\":\"content-shown\",\"position\":212},{\"kind\":\"content-shown\",\"position\":213},{\"kind\":\"content-shown\",\"position\":214},{\"kind\":\"content-shown\",\"position\":215},{\"kind\":\"content-shown\",\"position\":216},{\"kind\":\"content-shown\",\"position\":217},{\"kind\":\"content-shown\",\"position\":218},{\"kind\":\"checkpoint-due\",\"position\":219},{\"kind\":\"answer-accepted\",\"position\":219,\"scored\":true},{\"ending\":\"completed\",\"kind\":\"attempt-ended\"}]",
      "results": "{\"assistanceStep\":null,\"assisted\":false,\"ending\":\"completed\",\"finances\":null,\"metrics\":{\"betting-adherence\":null,\"card-values\":null,\"playing-adherence\":null,\"running-count\":{\"correct\":3,\"total\":20},\"true-count\":{\"correct\":7,\"total\":10}},\"review\":[{\"checkpoint\":1,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":1,\"reference\":0,\"round\":1,\"timing\":\"before-bet\"},{\"checkpoint\":1,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":2,\"reference\":0,\"round\":1,\"timing\":\"before-bet\"},{\"checkpoint\":2,\"count\":\"running\",\"entered\":0,\"error\":-2,\"kind\":\"table\",\"position\":21,\"reference\":2,\"round\":1,\"timing\":\"after-round\"},{\"checkpoint\":3,\"count\":\"running\",\"entered\":0,\"error\":-2,\"kind\":\"table\",\"position\":22,\"reference\":2,\"round\":2,\"timing\":\"before-bet\"},{\"checkpoint\":3,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":23,\"reference\":0,\"round\":2,\"timing\":\"before-bet\"},{\"checkpoint\":4,\"count\":\"running\",\"entered\":0,\"error\":-7,\"kind\":\"table\",\"position\":47,\"reference\":7,\"round\":2,\"timing\":\"after-round\"},{\"checkpoint\":5,\"count\":\"running\",\"entered\":0,\"error\":-7,\"kind\":\"table\",\"position\":48,\"reference\":7,\"round\":3,\"timing\":\"before-bet\"},{\"checkpoint\":5,\"count\":\"true\",\"entered\":0,\"error\":-1,\"kind\":\"table\",\"position\":49,\"reference\":1,\"round\":3,\"timing\":\"before-bet\"},{\"checkpoint\":6,\"count\":\"running\",\"entered\":0,\"error\":-4,\"kind\":\"table\",\"position\":71,\"reference\":4,\"round\":3,\"timing\":\"after-round\"},{\"checkpoint\":7,\"count\":\"running\",\"entered\":0,\"error\":-4,\"kind\":\"table\",\"position\":72,\"reference\":4,\"round\":4,\"timing\":\"before-bet\"},{\"checkpoint\":7,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":73,\"reference\":0,\"round\":4,\"timing\":\"before-bet\"},{\"checkpoint\":8,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":90,\"reference\":-1,\"round\":4,\"timing\":\"after-round\"},{\"checkpoint\":9,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":91,\"reference\":-1,\"round\":5,\"timing\":\"before-bet\"},{\"checkpoint\":9,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":92,\"reference\":0,\"round\":5,\"timing\":\"before-bet\"},{\"checkpoint\":10,\"count\":\"running\",\"entered\":0,\"error\":3,\"kind\":\"table\",\"position\":109,\"reference\":-3,\"round\":5,\"timing\":\"after-round\"},{\"checkpoint\":11,\"count\":\"running\",\"entered\":0,\"error\":3,\"kind\":\"table\",\"position\":110,\"reference\":-3,\"round\":6,\"timing\":\"before-bet\"},{\"checkpoint\":11,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":111,\"reference\":0,\"round\":6,\"timing\":\"before-bet\"},{\"checkpoint\":12,\"count\":\"running\",\"entered\":0,\"error\":5,\"kind\":\"table\",\"position\":128,\"reference\":-5,\"round\":6,\"timing\":\"after-round\"},{\"checkpoint\":13,\"count\":\"running\",\"entered\":0,\"error\":5,\"kind\":\"table\",\"position\":129,\"reference\":-5,\"round\":7,\"timing\":\"before-bet\"},{\"checkpoint\":13,\"count\":\"true\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":130,\"reference\":-1,\"round\":7,\"timing\":\"before-bet\"},{\"checkpoint\":14,\"count\":\"running\",\"entered\":0,\"error\":9,\"kind\":\"table\",\"position\":149,\"reference\":-9,\"round\":7,\"timing\":\"after-round\"},{\"checkpoint\":15,\"count\":\"running\",\"entered\":0,\"error\":9,\"kind\":\"table\",\"position\":150,\"reference\":-9,\"round\":8,\"timing\":\"before-bet\"},{\"checkpoint\":15,\"count\":\"true\",\"entered\":0,\"error\":2,\"kind\":\"table\",\"position\":151,\"reference\":-2,\"round\":8,\"timing\":\"before-bet\"},{\"checkpoint\":16,\"count\":\"running\",\"entered\":0,\"error\":3,\"kind\":\"table\",\"position\":173,\"reference\":-3,\"round\":8,\"timing\":\"after-round\"},{\"checkpoint\":17,\"count\":\"running\",\"entered\":0,\"error\":3,\"kind\":\"table\",\"position\":174,\"reference\":-3,\"round\":9,\"timing\":\"before-bet\"},{\"checkpoint\":17,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":175,\"reference\":0,\"round\":9,\"timing\":\"before-bet\"},{\"checkpoint\":18,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":197,\"reference\":0,\"round\":9,\"timing\":\"after-round\"},{\"checkpoint\":19,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":199,\"reference\":0,\"round\":10,\"timing\":\"before-bet\"},{\"checkpoint\":19,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":200,\"reference\":0,\"round\":10,\"timing\":\"before-bet\"},{\"checkpoint\":20,\"count\":\"running\",\"entered\":0,\"error\":2,\"kind\":\"table\",\"position\":220,\"reference\":-2,\"round\":10,\"timing\":\"after-round\"}]}"
    },
    {
      "name": "table Observe Check N=1, created and not yet begun",
      "category": "table",
      "phase": "ready",
      "specification": {
        "attemptId": "attempt-1",
        "content": {
          "category": "table",
          "id": "table",
          "reference": {
            "id": "blackjack-reference",
            "version": 1
          },
          "rounds": 10,
          "version": 1
        },
        "device": "device-1",
        "owner": "owner-1",
        "table": {
          "interval": 1,
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
          "seat": "observe",
          "strategy": {
            "first": {
              "hard": [
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HDDDDDDDDH",
                "HDDDDDDDDD",
                "HSSSSSHHHH",
                "HSSSSSHHHH",
                "HSSSSSHHHH",
                "HSSSSSHHHH",
                "HSSSSSHHHR",
                "SSSSSSSSSS",
                "SSSSSSSSSS",
                "SSSSSSSSSS",
                "SSSSSSSSSS"
              ],
              "pair": [
                "PPPPPPPPPP",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HDDDDDDDDH",
                "HSSSSSHHHH",
                "HSSSSSHHHH",
                "PPPPPPPPPP",
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
                "SSSSSSSSSS",
                "SSSSSSSSSS",
                "SSSSSSSSSS"
              ]
            },
            "later": {
              "hard": [
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HDDDDDDDDH",
                "HDDDDDDDDD",
                "HSSSSSHHHH",
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
                "SSSSSSSSSS",
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
                "HSSSSSHHHH",
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
                "SSSSSSSSSS",
                "SSSSSSSSSS",
                "SSSSSSSSSS",
                "SSSSSSSSSS"
              ]
            },
            "pairAtCap": [
              "SSSSSSSSSS",
              "HHHHHHHHHH",
              "HHHHHHHHHH",
              "HHHHHHHHHH",
              "HDDDDDDDDH",
              "HSSSSSHHHH",
              "HSSSSSHHHH",
              "HSSSSSHHHH",
              "SSSSSSSSSS",
              "SSSSSSSSSS"
            ],
            "pairWithoutSurrender": [
              "PPPPPPPPPP",
              "HHHHHHHHHH",
              "HHHHHHHHHH",
              "HHHHHHHHHH",
              "HDDDDDDDDH",
              "HSSSSSHHHH",
              "HSSSSSHHHH",
              "PPPPPPPPPP",
              "SSSSSSSSSS",
              "SSSSSSSSSS"
            ]
          }
        },
        "variant": "check"
      },
      "random": {
        "key": [
          3,
          2654435769
        ],
        "protocol": 1,
        "session": [
          22,
          0
        ]
      },
      "checkpoint": "{\"answers\":[],\"attempt\":{\"device\":\"device-1\",\"id\":\"attempt-1\",\"owner\":\"owner-1\"},\"content\":{\"category\":\"table\",\"id\":\"table\",\"reference\":{\"id\":\"blackjack-reference\",\"version\":1},\"rounds\":10,\"version\":1},\"ending\":null,\"identities\":{\"category\":\"table\",\"content\":{\"id\":\"table\",\"version\":1},\"engine\":\"0.0.0\",\"random\":{\"key\":[3,2654435769],\"protocol\":1,\"session\":[22,0]},\"reference\":{\"id\":\"blackjack-reference\",\"version\":1}},\"items\":[],\"phase\":\"ready\",\"position\":0,\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[3,2654435769],\"lane\":0,\"protocol\":1,\"session\":[22,0]},\"receipts\":[],\"rejected\":0,\"revealedAt\":null,\"schema\":13,\"sequence\":0,\"table\":{\"round\":0,\"seat\":null,\"setup\":{\"interval\":1,\"rules\":{\"dealer\":\"S17\",\"decks\":6,\"id\":\"blackjack-six-deck\",\"lateSurrender\":true,\"limits\":{\"initial\":{\"max\":\"1000\",\"min\":\"10\"}},\"penetration\":75,\"players\":{\"learnerSeat\":0,\"otherWagers\":[],\"strategy\":null},\"version\":1},\"seat\":\"observe\",\"strategy\":{\"first\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"PPPPPPPPPP\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"PPPPPPPPPP\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"later\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"laterWithoutDouble\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"pairAtCap\":[\"SSSSSSSSSS\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pairWithoutSurrender\":[\"PPPPPPPPPP\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"PPPPPPPPPP\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]}},\"shoe\":null},\"variant\":\"check\"}",
      "continuation": [
        {
          "kind": "begin"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        }
      ],
      "facts": "[{\"kind\":\"checkpoint-due\",\"position\":0},{\"kind\":\"answer-accepted\",\"position\":0,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":1,\"scored\":true},{\"kind\":\"content-shown\",\"position\":2},{\"kind\":\"content-shown\",\"position\":3},{\"kind\":\"content-shown\",\"position\":4},{\"kind\":\"content-shown\",\"position\":5},{\"kind\":\"content-shown\",\"position\":6},{\"kind\":\"content-shown\",\"position\":7},{\"kind\":\"checkpoint-due\",\"position\":8},{\"kind\":\"answer-accepted\",\"position\":8,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":9},{\"kind\":\"answer-accepted\",\"position\":9,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":10,\"scored\":true},{\"kind\":\"content-shown\",\"position\":11},{\"kind\":\"content-shown\",\"position\":12},{\"kind\":\"content-shown\",\"position\":13},{\"kind\":\"content-shown\",\"position\":14},{\"kind\":\"content-shown\",\"position\":15},{\"kind\":\"content-shown\",\"position\":16},{\"kind\":\"content-shown\",\"position\":17},{\"kind\":\"checkpoint-due\",\"position\":18},{\"kind\":\"answer-accepted\",\"position\":18,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":19},{\"kind\":\"answer-accepted\",\"position\":19,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":20,\"scored\":true},{\"kind\":\"content-shown\",\"position\":21},{\"kind\":\"content-shown\",\"position\":22},{\"kind\":\"content-shown\",\"position\":23},{\"kind\":\"content-shown\",\"position\":24},{\"kind\":\"content-shown\",\"position\":25},{\"kind\":\"content-shown\",\"position\":26},{\"kind\":\"content-shown\",\"position\":27},{\"kind\":\"content-shown\",\"position\":28},{\"kind\":\"checkpoint-due\",\"position\":29},{\"kind\":\"answer-accepted\",\"position\":29,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":30},{\"kind\":\"answer-accepted\",\"position\":30,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":31,\"scored\":true},{\"kind\":\"content-shown\",\"position\":32},{\"kind\":\"content-shown\",\"position\":33},{\"kind\":\"content-shown\",\"position\":34},{\"kind\":\"content-shown\",\"position\":35},{\"kind\":\"content-shown\",\"position\":36},{\"kind\":\"content-shown\",\"position\":37},{\"kind\":\"checkpoint-due\",\"position\":38},{\"kind\":\"answer-accepted\",\"position\":38,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":39},{\"kind\":\"answer-accepted\",\"position\":39,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":40,\"scored\":true},{\"kind\":\"content-shown\",\"position\":41},{\"kind\":\"content-shown\",\"position\":42},{\"kind\":\"content-shown\",\"position\":43},{\"kind\":\"content-shown\",\"position\":44},{\"kind\":\"content-shown\",\"position\":45},{\"kind\":\"content-shown\",\"position\":46},{\"kind\":\"content-shown\",\"position\":47},{\"kind\":\"checkpoint-due\",\"position\":48},{\"kind\":\"answer-accepted\",\"position\":48,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":49},{\"kind\":\"answer-accepted\",\"position\":49,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":50,\"scored\":true},{\"kind\":\"content-shown\",\"position\":51},{\"kind\":\"content-shown\",\"position\":52},{\"kind\":\"content-shown\",\"position\":53},{\"kind\":\"content-shown\",\"position\":54},{\"kind\":\"content-shown\",\"position\":55},{\"kind\":\"content-shown\",\"position\":56},{\"kind\":\"content-shown\",\"position\":57},{\"kind\":\"checkpoint-due\",\"position\":58},{\"kind\":\"answer-accepted\",\"position\":58,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":59},{\"kind\":\"answer-accepted\",\"position\":59,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":60,\"scored\":true},{\"kind\":\"content-shown\",\"position\":61},{\"kind\":\"content-shown\",\"position\":62},{\"kind\":\"content-shown\",\"position\":63},{\"kind\":\"content-shown\",\"position\":64},{\"kind\":\"content-shown\",\"position\":65},{\"kind\":\"checkpoint-due\",\"position\":66},{\"kind\":\"answer-accepted\",\"position\":66,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":67},{\"kind\":\"answer-accepted\",\"position\":67,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":68,\"scored\":true},{\"kind\":\"content-shown\",\"position\":69},{\"kind\":\"content-shown\",\"position\":70},{\"kind\":\"content-shown\",\"position\":71},{\"kind\":\"content-shown\",\"position\":72},{\"kind\":\"content-shown\",\"position\":73},{\"kind\":\"checkpoint-due\",\"position\":74},{\"kind\":\"answer-accepted\",\"position\":74,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":75},{\"kind\":\"answer-accepted\",\"position\":75,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":76,\"scored\":true},{\"kind\":\"content-shown\",\"position\":77},{\"kind\":\"content-shown\",\"position\":78},{\"kind\":\"content-shown\",\"position\":79},{\"kind\":\"content-shown\",\"position\":80},{\"kind\":\"content-shown\",\"position\":81},{\"kind\":\"content-shown\",\"position\":82},{\"kind\":\"checkpoint-due\",\"position\":83},{\"kind\":\"answer-accepted\",\"position\":83,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":84},{\"kind\":\"answer-accepted\",\"position\":84,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":85,\"scored\":true},{\"kind\":\"content-shown\",\"position\":86},{\"kind\":\"content-shown\",\"position\":87},{\"kind\":\"content-shown\",\"position\":88},{\"kind\":\"content-shown\",\"position\":89},{\"kind\":\"content-shown\",\"position\":90},{\"kind\":\"content-shown\",\"position\":91},{\"kind\":\"checkpoint-due\",\"position\":92},{\"kind\":\"answer-accepted\",\"position\":92,\"scored\":true},{\"ending\":\"completed\",\"kind\":\"attempt-ended\"}]",
      "results": "{\"assistanceStep\":null,\"assisted\":false,\"ending\":\"completed\",\"finances\":null,\"metrics\":{\"betting-adherence\":null,\"card-values\":null,\"playing-adherence\":null,\"running-count\":{\"correct\":1,\"total\":20},\"true-count\":{\"correct\":9,\"total\":10}},\"review\":[{\"checkpoint\":1,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":1,\"reference\":0,\"round\":1,\"timing\":\"before-bet\"},{\"checkpoint\":1,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":2,\"reference\":0,\"round\":1,\"timing\":\"before-bet\"},{\"checkpoint\":2,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":9,\"reference\":-1,\"round\":1,\"timing\":\"after-round\"},{\"checkpoint\":3,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":10,\"reference\":-1,\"round\":2,\"timing\":\"before-bet\"},{\"checkpoint\":3,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":11,\"reference\":0,\"round\":2,\"timing\":\"before-bet\"},{\"checkpoint\":4,\"count\":\"running\",\"entered\":0,\"error\":-1,\"kind\":\"table\",\"position\":19,\"reference\":1,\"round\":2,\"timing\":\"after-round\"},{\"checkpoint\":5,\"count\":\"running\",\"entered\":0,\"error\":-1,\"kind\":\"table\",\"position\":20,\"reference\":1,\"round\":3,\"timing\":\"before-bet\"},{\"checkpoint\":5,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":21,\"reference\":0,\"round\":3,\"timing\":\"before-bet\"},{\"checkpoint\":6,\"count\":\"running\",\"entered\":0,\"error\":-4,\"kind\":\"table\",\"position\":30,\"reference\":4,\"round\":3,\"timing\":\"after-round\"},{\"checkpoint\":7,\"count\":\"running\",\"entered\":0,\"error\":-4,\"kind\":\"table\",\"position\":31,\"reference\":4,\"round\":4,\"timing\":\"before-bet\"},{\"checkpoint\":7,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":32,\"reference\":0,\"round\":4,\"timing\":\"before-bet\"},{\"checkpoint\":8,\"count\":\"running\",\"entered\":0,\"error\":-4,\"kind\":\"table\",\"position\":39,\"reference\":4,\"round\":4,\"timing\":\"after-round\"},{\"checkpoint\":9,\"count\":\"running\",\"entered\":0,\"error\":-4,\"kind\":\"table\",\"position\":40,\"reference\":4,\"round\":5,\"timing\":\"before-bet\"},{\"checkpoint\":9,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":41,\"reference\":0,\"round\":5,\"timing\":\"before-bet\"},{\"checkpoint\":10,\"count\":\"running\",\"entered\":0,\"error\":-4,\"kind\":\"table\",\"position\":49,\"reference\":4,\"round\":5,\"timing\":\"after-round\"},{\"checkpoint\":11,\"count\":\"running\",\"entered\":0,\"error\":-4,\"kind\":\"table\",\"position\":50,\"reference\":4,\"round\":6,\"timing\":\"before-bet\"},{\"checkpoint\":11,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":51,\"reference\":0,\"round\":6,\"timing\":\"before-bet\"},{\"checkpoint\":12,\"count\":\"running\",\"entered\":0,\"error\":-5,\"kind\":\"table\",\"position\":59,\"reference\":5,\"round\":6,\"timing\":\"after-round\"},{\"checkpoint\":13,\"count\":\"running\",\"entered\":0,\"error\":-5,\"kind\":\"table\",\"position\":60,\"reference\":5,\"round\":7,\"timing\":\"before-bet\"},{\"checkpoint\":13,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":61,\"reference\":0,\"round\":7,\"timing\":\"before-bet\"},{\"checkpoint\":14,\"count\":\"running\",\"entered\":0,\"error\":-1,\"kind\":\"table\",\"position\":67,\"reference\":1,\"round\":7,\"timing\":\"after-round\"},{\"checkpoint\":15,\"count\":\"running\",\"entered\":0,\"error\":-1,\"kind\":\"table\",\"position\":68,\"reference\":1,\"round\":8,\"timing\":\"before-bet\"},{\"checkpoint\":15,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":69,\"reference\":0,\"round\":8,\"timing\":\"before-bet\"},{\"checkpoint\":16,\"count\":\"running\",\"entered\":0,\"error\":3,\"kind\":\"table\",\"position\":75,\"reference\":-3,\"round\":8,\"timing\":\"after-round\"},{\"checkpoint\":17,\"count\":\"running\",\"entered\":0,\"error\":3,\"kind\":\"table\",\"position\":76,\"reference\":-3,\"round\":9,\"timing\":\"before-bet\"},{\"checkpoint\":17,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":77,\"reference\":0,\"round\":9,\"timing\":\"before-bet\"},{\"checkpoint\":18,\"count\":\"running\",\"entered\":0,\"error\":5,\"kind\":\"table\",\"position\":84,\"reference\":-5,\"round\":9,\"timing\":\"after-round\"},{\"checkpoint\":19,\"count\":\"running\",\"entered\":0,\"error\":5,\"kind\":\"table\",\"position\":85,\"reference\":-5,\"round\":10,\"timing\":\"before-bet\"},{\"checkpoint\":19,\"count\":\"true\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":86,\"reference\":-1,\"round\":10,\"timing\":\"before-bet\"},{\"checkpoint\":20,\"count\":\"running\",\"entered\":0,\"error\":5,\"kind\":\"table\",\"position\":93,\"reference\":-5,\"round\":10,\"timing\":\"after-round\"}]}"
    },
    {
      "name": "table Play Check N=1 with basic, an illegal move refused at a decision",
      "category": "table",
      "phase": "decision",
      "specification": {
        "attemptId": "attempt-1",
        "content": {
          "category": "table",
          "id": "table",
          "reference": {
            "id": "blackjack-reference",
            "version": 1
          },
          "rounds": 10,
          "version": 1
        },
        "device": "device-1",
        "owner": "owner-1",
        "table": {
          "baseWager": "10",
          "betSchedule": false,
          "interval": 1,
          "policy": {
            "count": "player",
            "deviations": [],
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
                "pair": [
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "SHHHHHSHHS",
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
                "pair": [
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "SHHHHHSHHS",
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
                ]
              },
              "splitByBalance": [
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HSSSSSHHHH",
                "HSSSSSHHHH",
                "RSSSSSHHRR",
                "SSSSSSSSSS",
                "SSSSSSSSSS"
              ],
              "splitByRule": [
                "SSSSSSSSSS",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HDDDDDDDDH",
                "HSSSSSHHHH",
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
                ],
                "soft": [
                  "HHHHHHHHHH",
                  "HHHHDDHHHH",
                  "HHHHDDHHHH",
                  "HHHDDDHHHH",
                  "HHHDDDHHHH",
                  "HHDDDDHHHH",
                  "HSDDDDSSHH",
                  "SSSSSSSSSS",
                  "SSSSSSSSSS"
                ]
              }
            },
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
              ],
              "soft": [
                "HHHHHHHHHH",
                "HHHHDDHHHH",
                "HHHHDDHHHH",
                "HHHDDDHHHH",
                "HHHDDDHHHH",
                "HHDDDDHHHH",
                "HSDDDDSSHH",
                "SSSSSSSSSS",
                "SSSSSSSSSS"
              ]
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
                "HHHHHHHHHH",
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
          },
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
          "seat": "play",
          "startingBalance": "1000"
        },
        "variant": "check"
      },
      "random": {
        "key": [
          1,
          2654435769
        ],
        "protocol": 1,
        "session": [
          8,
          0
        ]
      },
      "checkpoint": "{\"answers\":[{\"first\":0,\"last\":0,\"position\":0,\"tries\":1},{\"first\":0,\"last\":0,\"position\":1,\"tries\":1}],\"attempt\":{\"device\":\"device-1\",\"id\":\"attempt-1\",\"owner\":\"owner-1\"},\"content\":{\"category\":\"table\",\"id\":\"table\",\"reference\":{\"id\":\"blackjack-reference\",\"version\":1},\"rounds\":10,\"version\":1},\"ending\":null,\"identities\":{\"category\":\"table\",\"content\":{\"id\":\"table\",\"version\":1},\"engine\":\"0.0.0\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":{\"id\":\"blackjack-reference\",\"version\":1}},\"items\":[{\"checkpoint\":1,\"count\":\"running\",\"round\":1,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"checkpoint\":1,\"count\":\"true\",\"round\":1,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"events\":[],\"face\":{\"rank\":13,\"suit\":\"diamonds\"},\"round\":1,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":{\"rank\":3,\"suit\":\"hearts\"},\"round\":1,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":4,\"suit\":\"clubs\"},\"round\":1,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":null,\"round\":1,\"step\":\"deal\",\"to\":\"dealer\"},{\"actions\":[\"hit\",\"stand\",\"double\",\"surrender\"],\"decision\":\"hand\",\"events\":[],\"round\":1,\"step\":\"decision\",\"target\":\"hand-1\",\"unaffordable\":[]}],\"phase\":\"decision\",\"position\":6,\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":0,\"protocol\":1,\"session\":[8,0]},\"receipts\":[{\"command\":\"{\\\"kind\\\":\\\"begin\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-4\",\"disposition\":\"applied\",\"sequence\":4},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-5\",\"disposition\":\"applied\",\"sequence\":5},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-6\",\"disposition\":\"applied\",\"sequence\":6},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-7\",\"disposition\":\"applied\",\"sequence\":7},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-8\",\"disposition\":\"applied\",\"sequence\":8},{\"command\":\"{\\\"action\\\":\\\"split\\\",\\\"kind\\\":\\\"play\\\"}\",\"commandId\":\"record-9\",\"disposition\":\"applied\",\"sequence\":9}],\"rejected\":0,\"revealedAt\":null,\"schema\":13,\"sequence\":10,\"table\":{\"round\":1,\"seat\":{\"activity\":{\"activity\":{\"device\":\"device-1\",\"id\":\"attempt-1/seat\",\"owner\":\"owner-1\"},\"balance\":\"990\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"0\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"blackjack\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":{\"id\":\"blackjack-reference\",\"version\":1},\"rules\":{\"id\":\"blackjack-six-deck\",\"version\":1},\"strategy\":null},\"outcome\":{\"active\":0,\"dealer\":[{\"deck\":2,\"rank\":3,\"suit\":\"hearts\"},{\"deck\":0,\"rank\":3,\"suit\":\"diamonds\"}],\"hands\":[{\"cards\":[{\"deck\":0,\"rank\":13,\"suit\":\"diamonds\"},{\"deck\":2,\"rank\":4,\"suit\":\"clubs\"}],\"done\":false,\"doubled\":false,\"surrendered\":false,\"target\":\"hand-1\"}],\"holeRevealed\":false,\"insurance\":\"not-offered\",\"others\":[],\"peek\":\"not-needed\"},\"phase\":\"open-decision\",\"random\":{\"block\":[77,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":3,\"protocol\":1,\"session\":[8,0]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"hand-1\\\"}\",\"commandId\":\"seat-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"seat-1\",\"disposition\":\"applied\",\"sequence\":1}],\"rules\":{\"dealer\":\"S17\",\"decks\":6,\"lateSurrender\":true,\"limits\":{\"initial\":{\"max\":\"1000\",\"min\":\"10\"}},\"penetration\":75,\"players\":{\"learnerSeat\":0,\"otherWagers\":[],\"strategy\":null}},\"schema\":13,\"sequence\":2,\"shoe\":{\"cut\":234,\"next\":4,\"order\":[25,132,107,15,210,3,63,179,220,201,283,37,247,200,137,79,35,64,56,38,97,294,30,130,238,146,138,161,249,214,127,104,86,258,2,134,11,180,227,159,114,285,152,99,47,39,206,269,217,98,279,71,287,101,88,198,234,300,42,57,13,67,221,115,261,110,136,171,22,26,248,303,92,128,65,311,288,58,33,62,16,119,170,271,292,45,82,169,7,219,19,5,230,203,204,59,70,6,83,280,43,302,262,87,53,267,260,297,60,100,211,117,286,291,143,199,259,176,95,240,229,84,125,113,61,290,226,202,256,187,156,81,275,74,103,20,270,298,140,265,23,184,109,177,52,166,181,106,123,31,135,309,40,196,0,228,266,235,273,158,4,116,66,252,131,172,232,168,304,241,186,278,96,111,183,12,34,307,213,308,164,296,299,281,48,150,165,239,289,251,243,236,17,178,225,257,197,29,205,122,46,293,118,188,274,254,276,218,102,189,174,208,139,246,55,282,193,72,167,145,191,245,284,124,233,80,222,163,73,49,8,190,154,231,41,147,77,277,21,209,242,50,1,10,153,51,182,195,120,253,212,263,28,90,216,155,250,301,207,192,305,18,69,121,224,185,36,295,264,237,310,91,144,94,173,244,9,27,89,129,68,112,78,194,75,255,160,306,151,76,268,24,54,157,215,32,14,142,133,141,93,223,108,126,44,175,105,148,149,162,85,272]},\"strategy\":null,\"turn\":1,\"wagers\":[{\"amount\":\"10\",\"target\":\"hand-1\"}]},\"betCorrection\":null,\"bets\":[],\"correction\":null,\"decisions\":[{\"attempts\":[{\"action\":\"split\",\"refusal\":\"rule\"}],\"explanation\":{\"cell\":{\"hand\":14,\"kind\":\"hard\",\"play\":\"stand\",\"table\":\"first\",\"up\":3},\"deviation\":null,\"ifUnaffordable\":null,\"kind\":\"play\",\"preferred\":\"stand\",\"prescribed\":{\"action\":\"stand\",\"amount\":null},\"situation\":{\"available\":\"990\",\"cards\":[{\"deck\":0,\"rank\":13,\"suit\":\"diamonds\"},{\"deck\":2,\"rank\":4,\"suit\":\"clubs\"}],\"count\":null,\"decision\":\"hand\",\"hand\":0,\"hands\":1,\"original\":true,\"pair\":false,\"stake\":\"10\",\"target\":\"hand-1\",\"total\":{\"soft\":false,\"value\":14},\"up\":{\"deck\":2,\"rank\":3,\"suit\":\"hearts\"}},\"unavailable\":[]},\"played\":null,\"position\":6,\"prompt\":null,\"resolution\":null}],\"ledger\":[{\"balance\":\"990\",\"change\":\"wager\",\"net\":null,\"position\":2,\"round\":1,\"wager\":\"10\"}]},\"setup\":{\"baseWager\":\"10\",\"betSchedule\":false,\"interval\":1,\"policy\":{\"count\":\"player\",\"deviations\":[],\"fallbacks\":{\"double\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SHHHHHSHHS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"doubleOnOriginalLateSurrender\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHR\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SHHHHHSHHS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"splitByBalance\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"splitByRule\":[\"SSSSSSSSSS\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"surrender\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"PPPPPPPPPP\",\"HPPPPPPHHH\",\"HPPPPPPHHH\",\"HHHHPPHHHH\",\"HDDDDDDDDH\",\"HPPPPPHHHH\",\"HPPPPPPHHH\",\"PPPPPPPPPP\",\"SPPPPPSPPS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]}},\"first\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHR\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"PPPPPPPPPP\",\"HPPPPPPHHH\",\"HPPPPPPHHH\",\"HHHHPPHHHH\",\"HDDDDDDDDH\",\"HPPPPPHHHH\",\"HPPPPPPHHH\",\"PPPPPPPPPP\",\"SPPPPPSPPS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"later\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"laterWithoutDouble\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]}},\"rules\":{\"dealer\":\"S17\",\"decks\":6,\"id\":\"blackjack-six-deck\",\"lateSurrender\":true,\"limits\":{\"initial\":{\"max\":\"1000\",\"min\":\"10\"}},\"penetration\":75,\"players\":{\"learnerSeat\":0,\"otherWagers\":[],\"strategy\":null},\"version\":1},\"seat\":\"play\",\"startingBalance\":\"1000\"},\"shoe\":null},\"variant\":\"check\"}",
      "continuation": [
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "decline-insurance"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "decline-insurance"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        }
      ],
      "facts": "[{\"kind\":\"content-shown\",\"position\":7},{\"kind\":\"content-shown\",\"position\":8},{\"kind\":\"content-shown\",\"position\":9},{\"kind\":\"content-shown\",\"position\":10},{\"kind\":\"round-settled\",\"net\":\"10\",\"position\":10},{\"kind\":\"checkpoint-due\",\"position\":11},{\"kind\":\"answer-accepted\",\"position\":11,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":12},{\"kind\":\"answer-accepted\",\"position\":12,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":13,\"scored\":true},{\"kind\":\"content-shown\",\"position\":14},{\"kind\":\"wager-placed\",\"position\":14},{\"kind\":\"content-shown\",\"position\":15},{\"kind\":\"content-shown\",\"position\":16},{\"kind\":\"content-shown\",\"position\":17},{\"kind\":\"content-shown\",\"position\":19},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":19},{\"kind\":\"checkpoint-due\",\"position\":20},{\"kind\":\"answer-accepted\",\"position\":20,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":21},{\"kind\":\"answer-accepted\",\"position\":21,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":22,\"scored\":true},{\"kind\":\"content-shown\",\"position\":23},{\"kind\":\"wager-placed\",\"position\":23},{\"kind\":\"content-shown\",\"position\":24},{\"kind\":\"content-shown\",\"position\":25},{\"kind\":\"content-shown\",\"position\":26},{\"kind\":\"content-shown\",\"position\":29},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":29},{\"kind\":\"checkpoint-due\",\"position\":30},{\"kind\":\"answer-accepted\",\"position\":30,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":31},{\"kind\":\"answer-accepted\",\"position\":31,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":32,\"scored\":true},{\"kind\":\"content-shown\",\"position\":33},{\"kind\":\"wager-placed\",\"position\":33},{\"kind\":\"content-shown\",\"position\":34},{\"kind\":\"content-shown\",\"position\":35},{\"kind\":\"content-shown\",\"position\":36},{\"kind\":\"content-shown\",\"position\":38},{\"kind\":\"content-shown\",\"position\":39},{\"kind\":\"round-settled\",\"net\":\"10\",\"position\":39},{\"kind\":\"checkpoint-due\",\"position\":40},{\"kind\":\"answer-accepted\",\"position\":40,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":41},{\"kind\":\"answer-accepted\",\"position\":41,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":42,\"scored\":true},{\"kind\":\"content-shown\",\"position\":43},{\"kind\":\"wager-placed\",\"position\":43},{\"kind\":\"content-shown\",\"position\":44},{\"kind\":\"content-shown\",\"position\":45},{\"kind\":\"content-shown\",\"position\":46},{\"kind\":\"content-shown\",\"position\":48},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":48},{\"kind\":\"checkpoint-due\",\"position\":49},{\"kind\":\"answer-accepted\",\"position\":49,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":50},{\"kind\":\"answer-accepted\",\"position\":50,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":51,\"scored\":true},{\"kind\":\"content-shown\",\"position\":52},{\"kind\":\"wager-placed\",\"position\":52},{\"kind\":\"content-shown\",\"position\":53},{\"kind\":\"content-shown\",\"position\":54},{\"kind\":\"content-shown\",\"position\":55},{\"kind\":\"content-shown\",\"position\":57},{\"kind\":\"content-shown\",\"position\":58},{\"kind\":\"content-shown\",\"position\":59},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":59},{\"kind\":\"checkpoint-due\",\"position\":60},{\"kind\":\"answer-accepted\",\"position\":60,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":61},{\"kind\":\"answer-accepted\",\"position\":61,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":62,\"scored\":true},{\"kind\":\"content-shown\",\"position\":63},{\"kind\":\"wager-placed\",\"position\":63},{\"kind\":\"content-shown\",\"position\":64},{\"kind\":\"content-shown\",\"position\":65},{\"kind\":\"content-shown\",\"position\":66},{\"kind\":\"content-shown\",\"position\":68},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":68},{\"kind\":\"checkpoint-due\",\"position\":69},{\"kind\":\"answer-accepted\",\"position\":69,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":70},{\"kind\":\"answer-accepted\",\"position\":70,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":71,\"scored\":true},{\"kind\":\"content-shown\",\"position\":72},{\"kind\":\"wager-placed\",\"position\":72},{\"kind\":\"content-shown\",\"position\":73},{\"kind\":\"content-shown\",\"position\":74},{\"kind\":\"content-shown\",\"position\":75},{\"kind\":\"content-shown\",\"position\":77},{\"kind\":\"content-shown\",\"position\":78},{\"kind\":\"round-settled\",\"net\":\"10\",\"position\":78},{\"kind\":\"checkpoint-due\",\"position\":79},{\"kind\":\"answer-accepted\",\"position\":79,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":80},{\"kind\":\"answer-accepted\",\"position\":80,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":81,\"scored\":true},{\"kind\":\"content-shown\",\"position\":82},{\"kind\":\"wager-placed\",\"position\":82},{\"kind\":\"content-shown\",\"position\":83},{\"kind\":\"content-shown\",\"position\":84},{\"kind\":\"content-shown\",\"position\":85},{\"kind\":\"content-shown\",\"position\":87},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":87},{\"kind\":\"checkpoint-due\",\"position\":88},{\"kind\":\"answer-accepted\",\"position\":88,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":89},{\"kind\":\"answer-accepted\",\"position\":89,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":90,\"scored\":true},{\"kind\":\"content-shown\",\"position\":91},{\"kind\":\"wager-placed\",\"position\":91},{\"kind\":\"content-shown\",\"position\":92},{\"kind\":\"content-shown\",\"position\":93},{\"kind\":\"content-shown\",\"position\":94},{\"kind\":\"content-shown\",\"position\":96},{\"kind\":\"round-settled\",\"net\":\"10\",\"position\":96},{\"kind\":\"checkpoint-due\",\"position\":97},{\"kind\":\"answer-accepted\",\"position\":97,\"scored\":true},{\"ending\":\"completed\",\"kind\":\"attempt-ended\"}]",
      "results": "{\"assistanceStep\":null,\"assisted\":false,\"ending\":\"completed\",\"finances\":{\"finishingBalance\":\"980\",\"net\":\"-20\",\"startingBalance\":\"1000\"},\"metrics\":{\"betting-adherence\":null,\"card-values\":null,\"playing-adherence\":{\"correct\":6,\"total\":11},\"running-count\":{\"correct\":3,\"total\":20},\"true-count\":{\"correct\":10,\"total\":10}},\"review\":[{\"checkpoint\":1,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":1,\"reference\":0,\"round\":1,\"timing\":\"before-bet\"},{\"checkpoint\":1,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":2,\"reference\":0,\"round\":1,\"timing\":\"before-bet\"},{\"atEntered\":null,\"cards\":[{\"rank\":13,\"suit\":\"diamonds\"},{\"rank\":4,\"suit\":\"clubs\"}],\"chosen\":\"split\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":7,\"prescribed\":\"stand\",\"refused\":[\"split\"],\"resolution\":\"followed\",\"round\":1,\"total\":{\"soft\":false,\"value\":14},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":3,\"suit\":\"hearts\"}},{\"checkpoint\":2,\"count\":\"running\",\"entered\":0,\"error\":-3,\"kind\":\"table\",\"position\":12,\"reference\":3,\"round\":1,\"timing\":\"after-round\"},{\"checkpoint\":3,\"count\":\"running\",\"entered\":0,\"error\":-3,\"kind\":\"table\",\"position\":13,\"reference\":3,\"round\":2,\"timing\":\"before-bet\"},{\"checkpoint\":3,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":14,\"reference\":0,\"round\":2,\"timing\":\"before-bet\"},{\"atEntered\":null,\"cards\":[{\"rank\":11,\"suit\":\"diamonds\"},{\"rank\":7,\"suit\":\"spades\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":19,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":2,\"total\":{\"soft\":false,\"value\":17},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":13,\"suit\":\"clubs\"}},{\"checkpoint\":4,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":21,\"reference\":0,\"round\":2,\"timing\":\"after-round\"},{\"checkpoint\":5,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":22,\"reference\":0,\"round\":3,\"timing\":\"before-bet\"},{\"checkpoint\":5,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":23,\"reference\":0,\"round\":3,\"timing\":\"before-bet\"},{\"atEntered\":null,\"cards\":[{\"rank\":12,\"suit\":\"hearts\"},{\"rank\":6,\"suit\":\"spades\"}],\"chosen\":\"decline-insurance\",\"countDependent\":false,\"decision\":\"insurance\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"decline-insurance\",\"position\":28,\"prescribed\":\"decline-insurance\",\"refused\":[],\"resolution\":\"followed\",\"round\":3,\"total\":{\"soft\":false,\"value\":16},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":1,\"suit\":\"spades\"}},{\"atEntered\":null,\"cards\":[{\"rank\":12,\"suit\":\"hearts\"},{\"rank\":6,\"suit\":\"spades\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":29,\"prescribed\":\"surrender\",\"refused\":[],\"resolution\":\"departed\",\"round\":3,\"total\":{\"soft\":false,\"value\":16},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":1,\"suit\":\"spades\"}},{\"checkpoint\":6,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":31,\"reference\":-1,\"round\":3,\"timing\":\"after-round\"},{\"checkpoint\":7,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":32,\"reference\":-1,\"round\":4,\"timing\":\"before-bet\"},{\"checkpoint\":7,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":33,\"reference\":0,\"round\":4,\"timing\":\"before-bet\"},{\"atEntered\":null,\"cards\":[{\"rank\":2,\"suit\":\"hearts\"},{\"rank\":13,\"suit\":\"clubs\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":38,\"prescribed\":\"hit\",\"refused\":[],\"resolution\":\"departed\",\"round\":4,\"total\":{\"soft\":false,\"value\":12},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":10,\"suit\":\"hearts\"}},{\"checkpoint\":8,\"count\":\"running\",\"entered\":0,\"error\":2,\"kind\":\"table\",\"position\":41,\"reference\":-2,\"round\":4,\"timing\":\"after-round\"},{\"checkpoint\":9,\"count\":\"running\",\"entered\":0,\"error\":2,\"kind\":\"table\",\"position\":42,\"reference\":-2,\"round\":5,\"timing\":\"before-bet\"},{\"checkpoint\":9,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":43,\"reference\":0,\"round\":5,\"timing\":\"before-bet\"},{\"atEntered\":null,\"cards\":[{\"rank\":7,\"suit\":\"spades\"},{\"rank\":5,\"suit\":\"hearts\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":48,\"prescribed\":\"hit\",\"refused\":[],\"resolution\":\"departed\",\"round\":5,\"total\":{\"soft\":false,\"value\":12},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":9,\"suit\":\"hearts\"}},{\"checkpoint\":10,\"count\":\"running\",\"entered\":0,\"error\":2,\"kind\":\"table\",\"position\":50,\"reference\":-2,\"round\":5,\"timing\":\"after-round\"},{\"checkpoint\":11,\"count\":\"running\",\"entered\":0,\"error\":2,\"kind\":\"table\",\"position\":51,\"reference\":-2,\"round\":6,\"timing\":\"before-bet\"},{\"checkpoint\":11,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":52,\"reference\":0,\"round\":6,\"timing\":\"before-bet\"},{\"atEntered\":null,\"cards\":[{\"rank\":5,\"suit\":\"hearts\"},{\"rank\":9,\"suit\":\"hearts\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":57,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":6,\"total\":{\"soft\":false,\"value\":14},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":4,\"suit\":\"spades\"}},{\"checkpoint\":12,\"count\":\"running\",\"entered\":0,\"error\":-2,\"kind\":\"table\",\"position\":61,\"reference\":2,\"round\":6,\"timing\":\"after-round\"},{\"checkpoint\":13,\"count\":\"running\",\"entered\":0,\"error\":-2,\"kind\":\"table\",\"position\":62,\"reference\":2,\"round\":7,\"timing\":\"before-bet\"},{\"checkpoint\":13,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":63,\"reference\":0,\"round\":7,\"timing\":\"before-bet\"},{\"atEntered\":null,\"cards\":[{\"rank\":11,\"suit\":\"diamonds\"},{\"rank\":9,\"suit\":\"hearts\"}],\"chosen\":\"decline-insurance\",\"countDependent\":false,\"decision\":\"insurance\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"decline-insurance\",\"position\":68,\"prescribed\":\"decline-insurance\",\"refused\":[],\"resolution\":\"followed\",\"round\":7,\"total\":{\"soft\":false,\"value\":19},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":1,\"suit\":\"clubs\"}},{\"checkpoint\":14,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":70,\"reference\":-1,\"round\":7,\"timing\":\"after-round\"},{\"checkpoint\":15,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":71,\"reference\":-1,\"round\":8,\"timing\":\"before-bet\"},{\"checkpoint\":15,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":72,\"reference\":0,\"round\":8,\"timing\":\"before-bet\"},{\"atEntered\":null,\"cards\":[{\"rank\":3,\"suit\":\"clubs\"},{\"rank\":12,\"suit\":\"clubs\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":77,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":8,\"total\":{\"soft\":false,\"value\":13},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":5,\"suit\":\"hearts\"}},{\"checkpoint\":16,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":80,\"reference\":-1,\"round\":8,\"timing\":\"after-round\"},{\"checkpoint\":17,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":81,\"reference\":-1,\"round\":9,\"timing\":\"before-bet\"},{\"checkpoint\":17,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":82,\"reference\":0,\"round\":9,\"timing\":\"before-bet\"},{\"atEntered\":null,\"cards\":[{\"rank\":4,\"suit\":\"clubs\"},{\"rank\":13,\"suit\":\"diamonds\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":87,\"prescribed\":\"hit\",\"refused\":[],\"resolution\":\"departed\",\"round\":9,\"total\":{\"soft\":false,\"value\":14},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":11,\"suit\":\"clubs\"}},{\"checkpoint\":18,\"count\":\"running\",\"entered\":0,\"error\":3,\"kind\":\"table\",\"position\":89,\"reference\":-3,\"round\":9,\"timing\":\"after-round\"},{\"checkpoint\":19,\"count\":\"running\",\"entered\":0,\"error\":3,\"kind\":\"table\",\"position\":90,\"reference\":-3,\"round\":10,\"timing\":\"before-bet\"},{\"checkpoint\":19,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":91,\"reference\":0,\"round\":10,\"timing\":\"before-bet\"},{\"atEntered\":null,\"cards\":[{\"rank\":9,\"suit\":\"spades\"},{\"rank\":1,\"suit\":\"spades\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":96,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":10,\"total\":{\"soft\":true,\"value\":20},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":9,\"suit\":\"spades\"}},{\"checkpoint\":20,\"count\":\"running\",\"entered\":0,\"error\":5,\"kind\":\"table\",\"position\":98,\"reference\":-5,\"round\":10,\"timing\":\"after-round\"}]}"
    },
    {
      "name": "table Play Learn N=1 with basic, a departing move held in the correction pause",
      "category": "table",
      "phase": "correction",
      "specification": {
        "attemptId": "attempt-1",
        "content": {
          "category": "table",
          "id": "table",
          "reference": {
            "id": "blackjack-reference",
            "version": 1
          },
          "rounds": 10,
          "version": 1
        },
        "device": "device-1",
        "owner": "owner-1",
        "table": {
          "baseWager": "10",
          "betSchedule": false,
          "interval": 1,
          "policy": {
            "count": "player",
            "deviations": [],
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
                "pair": [
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "SHHHHHSHHS",
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
                "pair": [
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "SHHHHHSHHS",
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
                ]
              },
              "splitByBalance": [
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HSSSSSHHHH",
                "HSSSSSHHHH",
                "RSSSSSHHRR",
                "SSSSSSSSSS",
                "SSSSSSSSSS"
              ],
              "splitByRule": [
                "SSSSSSSSSS",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HDDDDDDDDH",
                "HSSSSSHHHH",
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
                ],
                "soft": [
                  "HHHHHHHHHH",
                  "HHHHDDHHHH",
                  "HHHHDDHHHH",
                  "HHHDDDHHHH",
                  "HHHDDDHHHH",
                  "HHDDDDHHHH",
                  "HSDDDDSSHH",
                  "SSSSSSSSSS",
                  "SSSSSSSSSS"
                ]
              }
            },
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
              ],
              "soft": [
                "HHHHHHHHHH",
                "HHHHDDHHHH",
                "HHHHDDHHHH",
                "HHHDDDHHHH",
                "HHHDDDHHHH",
                "HHDDDDHHHH",
                "HSDDDDSSHH",
                "SSSSSSSSSS",
                "SSSSSSSSSS"
              ]
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
                "HHHHHHHHHH",
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
          },
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
          "seat": "play",
          "startingBalance": "1000"
        },
        "variant": "learn"
      },
      "random": {
        "key": [
          1,
          2654435769
        ],
        "protocol": 1,
        "session": [
          8,
          0
        ]
      },
      "checkpoint": "{\"answers\":[{\"first\":0,\"last\":0,\"position\":0,\"tries\":1},{\"first\":0,\"last\":0,\"position\":1,\"tries\":1}],\"attempt\":{\"device\":\"device-1\",\"id\":\"attempt-1\",\"owner\":\"owner-1\"},\"content\":{\"category\":\"table\",\"id\":\"table\",\"reference\":{\"id\":\"blackjack-reference\",\"version\":1},\"rounds\":10,\"version\":1},\"ending\":null,\"identities\":{\"category\":\"table\",\"content\":{\"id\":\"table\",\"version\":1},\"engine\":\"0.0.0\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":{\"id\":\"blackjack-reference\",\"version\":1}},\"items\":[{\"checkpoint\":1,\"count\":\"running\",\"round\":1,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"checkpoint\":1,\"count\":\"true\",\"round\":1,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"events\":[],\"face\":{\"rank\":13,\"suit\":\"diamonds\"},\"round\":1,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":{\"rank\":3,\"suit\":\"hearts\"},\"round\":1,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":4,\"suit\":\"clubs\"},\"round\":1,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":null,\"round\":1,\"step\":\"deal\",\"to\":\"dealer\"},{\"actions\":[\"hit\",\"stand\",\"double\",\"surrender\"],\"decision\":\"hand\",\"events\":[],\"round\":1,\"step\":\"decision\",\"target\":\"hand-1\",\"unaffordable\":[]}],\"phase\":\"correction\",\"position\":6,\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":0,\"protocol\":1,\"session\":[8,0]},\"receipts\":[{\"command\":\"{\\\"kind\\\":\\\"begin\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-4\",\"disposition\":\"applied\",\"sequence\":4},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-5\",\"disposition\":\"applied\",\"sequence\":5},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-6\",\"disposition\":\"applied\",\"sequence\":6},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-7\",\"disposition\":\"applied\",\"sequence\":7},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-8\",\"disposition\":\"applied\",\"sequence\":8},{\"command\":\"{\\\"action\\\":\\\"hit\\\",\\\"kind\\\":\\\"play\\\"}\",\"commandId\":\"record-9\",\"disposition\":\"applied\",\"sequence\":9}],\"rejected\":0,\"revealedAt\":null,\"schema\":13,\"sequence\":10,\"table\":{\"round\":1,\"seat\":{\"activity\":{\"activity\":{\"device\":\"device-1\",\"id\":\"attempt-1/seat\",\"owner\":\"owner-1\"},\"balance\":\"990\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"0\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"blackjack\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":{\"id\":\"blackjack-reference\",\"version\":1},\"rules\":{\"id\":\"blackjack-six-deck\",\"version\":1},\"strategy\":null},\"outcome\":{\"active\":0,\"dealer\":[{\"deck\":2,\"rank\":3,\"suit\":\"hearts\"},{\"deck\":0,\"rank\":3,\"suit\":\"diamonds\"}],\"hands\":[{\"cards\":[{\"deck\":0,\"rank\":13,\"suit\":\"diamonds\"},{\"deck\":2,\"rank\":4,\"suit\":\"clubs\"}],\"done\":false,\"doubled\":false,\"surrendered\":false,\"target\":\"hand-1\"}],\"holeRevealed\":false,\"insurance\":\"not-offered\",\"others\":[],\"peek\":\"not-needed\"},\"phase\":\"open-decision\",\"random\":{\"block\":[77,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":3,\"protocol\":1,\"session\":[8,0]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"hand-1\\\"}\",\"commandId\":\"seat-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"seat-1\",\"disposition\":\"applied\",\"sequence\":1}],\"rules\":{\"dealer\":\"S17\",\"decks\":6,\"lateSurrender\":true,\"limits\":{\"initial\":{\"max\":\"1000\",\"min\":\"10\"}},\"penetration\":75,\"players\":{\"learnerSeat\":0,\"otherWagers\":[],\"strategy\":null}},\"schema\":13,\"sequence\":2,\"shoe\":{\"cut\":234,\"next\":4,\"order\":[25,132,107,15,210,3,63,179,220,201,283,37,247,200,137,79,35,64,56,38,97,294,30,130,238,146,138,161,249,214,127,104,86,258,2,134,11,180,227,159,114,285,152,99,47,39,206,269,217,98,279,71,287,101,88,198,234,300,42,57,13,67,221,115,261,110,136,171,22,26,248,303,92,128,65,311,288,58,33,62,16,119,170,271,292,45,82,169,7,219,19,5,230,203,204,59,70,6,83,280,43,302,262,87,53,267,260,297,60,100,211,117,286,291,143,199,259,176,95,240,229,84,125,113,61,290,226,202,256,187,156,81,275,74,103,20,270,298,140,265,23,184,109,177,52,166,181,106,123,31,135,309,40,196,0,228,266,235,273,158,4,116,66,252,131,172,232,168,304,241,186,278,96,111,183,12,34,307,213,308,164,296,299,281,48,150,165,239,289,251,243,236,17,178,225,257,197,29,205,122,46,293,118,188,274,254,276,218,102,189,174,208,139,246,55,282,193,72,167,145,191,245,284,124,233,80,222,163,73,49,8,190,154,231,41,147,77,277,21,209,242,50,1,10,153,51,182,195,120,253,212,263,28,90,216,155,250,301,207,192,305,18,69,121,224,185,36,295,264,237,310,91,144,94,173,244,9,27,89,129,68,112,78,194,75,255,160,306,151,76,268,24,54,157,215,32,14,142,133,141,93,223,108,126,44,175,105,148,149,162,85,272]},\"strategy\":null,\"turn\":1,\"wagers\":[{\"amount\":\"10\",\"target\":\"hand-1\"}]},\"betCorrection\":null,\"bets\":[],\"correction\":{\"actual\":{\"action\":\"hit\",\"amount\":null},\"decision\":0,\"explanation\":{\"cell\":{\"hand\":14,\"kind\":\"hard\",\"play\":\"stand\",\"table\":\"first\",\"up\":3},\"deviation\":null,\"ifUnaffordable\":null,\"kind\":\"play\",\"preferred\":\"stand\",\"prescribed\":{\"action\":\"stand\",\"amount\":null},\"situation\":{\"available\":\"990\",\"cards\":[{\"deck\":0,\"rank\":13,\"suit\":\"diamonds\"},{\"deck\":2,\"rank\":4,\"suit\":\"clubs\"}],\"count\":null,\"decision\":\"hand\",\"hand\":0,\"hands\":1,\"original\":true,\"pair\":false,\"stake\":\"10\",\"target\":\"hand-1\",\"total\":{\"soft\":false,\"value\":14},\"up\":{\"deck\":2,\"rank\":3,\"suit\":\"hearts\"}},\"unavailable\":[]},\"id\":\"attempt-1/departure/9\",\"turn\":1},\"decisions\":[{\"attempts\":[{\"action\":\"hit\",\"refusal\":null}],\"explanation\":{\"cell\":{\"hand\":14,\"kind\":\"hard\",\"play\":\"stand\",\"table\":\"first\",\"up\":3},\"deviation\":null,\"ifUnaffordable\":null,\"kind\":\"play\",\"preferred\":\"stand\",\"prescribed\":{\"action\":\"stand\",\"amount\":null},\"situation\":{\"available\":\"990\",\"cards\":[{\"deck\":0,\"rank\":13,\"suit\":\"diamonds\"},{\"deck\":2,\"rank\":4,\"suit\":\"clubs\"}],\"count\":null,\"decision\":\"hand\",\"hand\":0,\"hands\":1,\"original\":true,\"pair\":false,\"stake\":\"10\",\"target\":\"hand-1\",\"total\":{\"soft\":false,\"value\":14},\"up\":{\"deck\":2,\"rank\":3,\"suit\":\"hearts\"}},\"unavailable\":[]},\"played\":null,\"position\":6,\"prompt\":null,\"resolution\":null}],\"ledger\":[{\"balance\":\"990\",\"change\":\"wager\",\"net\":null,\"position\":2,\"round\":1,\"wager\":\"10\"}]},\"setup\":{\"baseWager\":\"10\",\"betSchedule\":false,\"interval\":1,\"policy\":{\"count\":\"player\",\"deviations\":[],\"fallbacks\":{\"double\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SHHHHHSHHS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"doubleOnOriginalLateSurrender\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHR\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SHHHHHSHHS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"splitByBalance\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"splitByRule\":[\"SSSSSSSSSS\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"surrender\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"PPPPPPPPPP\",\"HPPPPPPHHH\",\"HPPPPPPHHH\",\"HHHHPPHHHH\",\"HDDDDDDDDH\",\"HPPPPPHHHH\",\"HPPPPPPHHH\",\"PPPPPPPPPP\",\"SPPPPPSPPS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]}},\"first\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHR\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"PPPPPPPPPP\",\"HPPPPPPHHH\",\"HPPPPPPHHH\",\"HHHHPPHHHH\",\"HDDDDDDDDH\",\"HPPPPPHHHH\",\"HPPPPPPHHH\",\"PPPPPPPPPP\",\"SPPPPPSPPS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"later\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"laterWithoutDouble\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]}},\"rules\":{\"dealer\":\"S17\",\"decks\":6,\"id\":\"blackjack-six-deck\",\"lateSurrender\":true,\"limits\":{\"initial\":{\"max\":\"1000\",\"min\":\"10\"}},\"penetration\":75,\"players\":{\"learnerSeat\":0,\"otherWagers\":[],\"strategy\":null},\"version\":1},\"seat\":\"play\",\"startingBalance\":\"1000\"},\"shoe\":null},\"variant\":\"learn\"}",
      "continuation": [
        {
          "kind": "override-correction"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "decline-insurance"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "override-correction"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "override-correction"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "override-correction"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "decline-insurance"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "override-correction"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        }
      ],
      "facts": "[{\"kind\":\"content-shown\",\"position\":7},{\"kind\":\"content-shown\",\"position\":9},{\"kind\":\"content-shown\",\"position\":10},{\"kind\":\"content-shown\",\"position\":11},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":11},{\"kind\":\"checkpoint-due\",\"position\":12},{\"kind\":\"answer-accepted\",\"position\":12,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":13},{\"kind\":\"answer-accepted\",\"position\":13,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":14,\"scored\":true},{\"kind\":\"content-shown\",\"position\":15},{\"kind\":\"wager-placed\",\"position\":15},{\"kind\":\"content-shown\",\"position\":16},{\"kind\":\"content-shown\",\"position\":17},{\"kind\":\"content-shown\",\"position\":18},{\"kind\":\"content-shown\",\"position\":20},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":20},{\"kind\":\"checkpoint-due\",\"position\":21},{\"kind\":\"answer-accepted\",\"position\":21,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":22},{\"kind\":\"answer-accepted\",\"position\":22,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":23,\"scored\":true},{\"kind\":\"content-shown\",\"position\":24},{\"kind\":\"wager-placed\",\"position\":24},{\"kind\":\"content-shown\",\"position\":25},{\"kind\":\"content-shown\",\"position\":26},{\"kind\":\"content-shown\",\"position\":27},{\"kind\":\"correction-offered\",\"position\":29},{\"kind\":\"content-shown\",\"position\":30},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":30},{\"kind\":\"checkpoint-due\",\"position\":31},{\"kind\":\"answer-accepted\",\"position\":31,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":32},{\"kind\":\"answer-accepted\",\"position\":32,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":33,\"scored\":true},{\"kind\":\"content-shown\",\"position\":34},{\"kind\":\"wager-placed\",\"position\":34},{\"kind\":\"content-shown\",\"position\":35},{\"kind\":\"content-shown\",\"position\":36},{\"kind\":\"content-shown\",\"position\":37},{\"kind\":\"correction-offered\",\"position\":38},{\"kind\":\"content-shown\",\"position\":39},{\"kind\":\"content-shown\",\"position\":40},{\"kind\":\"round-settled\",\"net\":\"10\",\"position\":40},{\"kind\":\"checkpoint-due\",\"position\":41},{\"kind\":\"answer-accepted\",\"position\":41,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":42},{\"kind\":\"answer-accepted\",\"position\":42,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":43,\"scored\":true},{\"kind\":\"content-shown\",\"position\":44},{\"kind\":\"wager-placed\",\"position\":44},{\"kind\":\"content-shown\",\"position\":45},{\"kind\":\"content-shown\",\"position\":46},{\"kind\":\"content-shown\",\"position\":47},{\"kind\":\"correction-offered\",\"position\":48},{\"kind\":\"content-shown\",\"position\":49},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":49},{\"kind\":\"checkpoint-due\",\"position\":50},{\"kind\":\"answer-accepted\",\"position\":50,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":51},{\"kind\":\"answer-accepted\",\"position\":51,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":52,\"scored\":true},{\"kind\":\"content-shown\",\"position\":53},{\"kind\":\"wager-placed\",\"position\":53},{\"kind\":\"content-shown\",\"position\":54},{\"kind\":\"content-shown\",\"position\":55},{\"kind\":\"content-shown\",\"position\":56},{\"kind\":\"content-shown\",\"position\":58},{\"kind\":\"content-shown\",\"position\":59},{\"kind\":\"content-shown\",\"position\":60},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":60},{\"kind\":\"checkpoint-due\",\"position\":61},{\"kind\":\"answer-accepted\",\"position\":61,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":62},{\"kind\":\"answer-accepted\",\"position\":62,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":63,\"scored\":true},{\"kind\":\"content-shown\",\"position\":64},{\"kind\":\"wager-placed\",\"position\":64},{\"kind\":\"content-shown\",\"position\":65},{\"kind\":\"content-shown\",\"position\":66},{\"kind\":\"content-shown\",\"position\":67},{\"kind\":\"content-shown\",\"position\":69},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":69},{\"kind\":\"checkpoint-due\",\"position\":70},{\"kind\":\"answer-accepted\",\"position\":70,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":71},{\"kind\":\"answer-accepted\",\"position\":71,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":72,\"scored\":true},{\"kind\":\"content-shown\",\"position\":73},{\"kind\":\"wager-placed\",\"position\":73},{\"kind\":\"content-shown\",\"position\":74},{\"kind\":\"content-shown\",\"position\":75},{\"kind\":\"content-shown\",\"position\":76},{\"kind\":\"content-shown\",\"position\":78},{\"kind\":\"content-shown\",\"position\":79},{\"kind\":\"round-settled\",\"net\":\"10\",\"position\":79},{\"kind\":\"checkpoint-due\",\"position\":80},{\"kind\":\"answer-accepted\",\"position\":80,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":81},{\"kind\":\"answer-accepted\",\"position\":81,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":82,\"scored\":true},{\"kind\":\"content-shown\",\"position\":83},{\"kind\":\"wager-placed\",\"position\":83},{\"kind\":\"content-shown\",\"position\":84},{\"kind\":\"content-shown\",\"position\":85},{\"kind\":\"content-shown\",\"position\":86},{\"kind\":\"correction-offered\",\"position\":87},{\"kind\":\"content-shown\",\"position\":88},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":88},{\"kind\":\"checkpoint-due\",\"position\":89},{\"kind\":\"answer-accepted\",\"position\":89,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":90},{\"kind\":\"answer-accepted\",\"position\":90,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":91,\"scored\":true},{\"kind\":\"content-shown\",\"position\":92},{\"kind\":\"wager-placed\",\"position\":92},{\"kind\":\"content-shown\",\"position\":93},{\"kind\":\"content-shown\",\"position\":94},{\"kind\":\"content-shown\",\"position\":95},{\"kind\":\"content-shown\",\"position\":97},{\"kind\":\"round-settled\",\"net\":\"10\",\"position\":97},{\"kind\":\"checkpoint-due\",\"position\":98},{\"kind\":\"answer-accepted\",\"position\":98,\"scored\":true},{\"ending\":\"completed\",\"kind\":\"attempt-ended\"}]",
      "results": "{\"assistanceStep\":null,\"assisted\":true,\"ending\":\"completed\",\"finances\":{\"finishingBalance\":\"960\",\"net\":\"-40\",\"startingBalance\":\"1000\"},\"metrics\":{\"betting-adherence\":null,\"card-values\":null,\"playing-adherence\":{\"correct\":7,\"total\":12},\"running-count\":{\"correct\":3,\"total\":20},\"true-count\":{\"correct\":10,\"total\":10}},\"review\":[{\"checkpoint\":1,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":1,\"reference\":0,\"round\":1,\"timing\":\"before-bet\"},{\"checkpoint\":1,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":2,\"reference\":0,\"round\":1,\"timing\":\"before-bet\"},{\"atEntered\":null,\"cards\":[{\"rank\":13,\"suit\":\"diamonds\"},{\"rank\":4,\"suit\":\"clubs\"}],\"chosen\":\"hit\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"hit\",\"position\":7,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"overridden\",\"round\":1,\"total\":{\"soft\":false,\"value\":14},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":3,\"suit\":\"hearts\"}},{\"atEntered\":null,\"cards\":[{\"rank\":13,\"suit\":\"diamonds\"},{\"rank\":4,\"suit\":\"clubs\"},{\"rank\":3,\"suit\":\"clubs\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":9,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":1,\"total\":{\"soft\":false,\"value\":17},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":3,\"suit\":\"hearts\"}},{\"checkpoint\":2,\"count\":\"running\",\"entered\":0,\"error\":-3,\"kind\":\"table\",\"position\":13,\"reference\":3,\"round\":1,\"timing\":\"after-round\"},{\"checkpoint\":3,\"count\":\"running\",\"entered\":0,\"error\":-3,\"kind\":\"table\",\"position\":14,\"reference\":3,\"round\":2,\"timing\":\"before-bet\"},{\"checkpoint\":3,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":15,\"reference\":0,\"round\":2,\"timing\":\"before-bet\"},{\"atEntered\":null,\"cards\":[{\"rank\":11,\"suit\":\"diamonds\"},{\"rank\":7,\"suit\":\"spades\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":20,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":2,\"total\":{\"soft\":false,\"value\":17},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":13,\"suit\":\"clubs\"}},{\"checkpoint\":4,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":22,\"reference\":0,\"round\":2,\"timing\":\"after-round\"},{\"checkpoint\":5,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":23,\"reference\":0,\"round\":3,\"timing\":\"before-bet\"},{\"checkpoint\":5,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":24,\"reference\":0,\"round\":3,\"timing\":\"before-bet\"},{\"atEntered\":null,\"cards\":[{\"rank\":12,\"suit\":\"hearts\"},{\"rank\":6,\"suit\":\"spades\"}],\"chosen\":\"decline-insurance\",\"countDependent\":false,\"decision\":\"insurance\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"decline-insurance\",\"position\":29,\"prescribed\":\"decline-insurance\",\"refused\":[],\"resolution\":\"followed\",\"round\":3,\"total\":{\"soft\":false,\"value\":16},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":1,\"suit\":\"spades\"}},{\"atEntered\":null,\"cards\":[{\"rank\":12,\"suit\":\"hearts\"},{\"rank\":6,\"suit\":\"spades\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":30,\"prescribed\":\"surrender\",\"refused\":[],\"resolution\":\"overridden\",\"round\":3,\"total\":{\"soft\":false,\"value\":16},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":1,\"suit\":\"spades\"}},{\"checkpoint\":6,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":32,\"reference\":-1,\"round\":3,\"timing\":\"after-round\"},{\"checkpoint\":7,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":33,\"reference\":-1,\"round\":4,\"timing\":\"before-bet\"},{\"checkpoint\":7,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":34,\"reference\":0,\"round\":4,\"timing\":\"before-bet\"},{\"atEntered\":null,\"cards\":[{\"rank\":2,\"suit\":\"hearts\"},{\"rank\":13,\"suit\":\"clubs\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":39,\"prescribed\":\"hit\",\"refused\":[],\"resolution\":\"overridden\",\"round\":4,\"total\":{\"soft\":false,\"value\":12},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":10,\"suit\":\"hearts\"}},{\"checkpoint\":8,\"count\":\"running\",\"entered\":0,\"error\":2,\"kind\":\"table\",\"position\":42,\"reference\":-2,\"round\":4,\"timing\":\"after-round\"},{\"checkpoint\":9,\"count\":\"running\",\"entered\":0,\"error\":2,\"kind\":\"table\",\"position\":43,\"reference\":-2,\"round\":5,\"timing\":\"before-bet\"},{\"checkpoint\":9,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":44,\"reference\":0,\"round\":5,\"timing\":\"before-bet\"},{\"atEntered\":null,\"cards\":[{\"rank\":7,\"suit\":\"spades\"},{\"rank\":5,\"suit\":\"hearts\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":49,\"prescribed\":\"hit\",\"refused\":[],\"resolution\":\"overridden\",\"round\":5,\"total\":{\"soft\":false,\"value\":12},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":9,\"suit\":\"hearts\"}},{\"checkpoint\":10,\"count\":\"running\",\"entered\":0,\"error\":2,\"kind\":\"table\",\"position\":51,\"reference\":-2,\"round\":5,\"timing\":\"after-round\"},{\"checkpoint\":11,\"count\":\"running\",\"entered\":0,\"error\":2,\"kind\":\"table\",\"position\":52,\"reference\":-2,\"round\":6,\"timing\":\"before-bet\"},{\"checkpoint\":11,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":53,\"reference\":0,\"round\":6,\"timing\":\"before-bet\"},{\"atEntered\":null,\"cards\":[{\"rank\":5,\"suit\":\"hearts\"},{\"rank\":9,\"suit\":\"hearts\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":58,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":6,\"total\":{\"soft\":false,\"value\":14},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":4,\"suit\":\"spades\"}},{\"checkpoint\":12,\"count\":\"running\",\"entered\":0,\"error\":-2,\"kind\":\"table\",\"position\":62,\"reference\":2,\"round\":6,\"timing\":\"after-round\"},{\"checkpoint\":13,\"count\":\"running\",\"entered\":0,\"error\":-2,\"kind\":\"table\",\"position\":63,\"reference\":2,\"round\":7,\"timing\":\"before-bet\"},{\"checkpoint\":13,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":64,\"reference\":0,\"round\":7,\"timing\":\"before-bet\"},{\"atEntered\":null,\"cards\":[{\"rank\":11,\"suit\":\"diamonds\"},{\"rank\":9,\"suit\":\"hearts\"}],\"chosen\":\"decline-insurance\",\"countDependent\":false,\"decision\":\"insurance\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"decline-insurance\",\"position\":69,\"prescribed\":\"decline-insurance\",\"refused\":[],\"resolution\":\"followed\",\"round\":7,\"total\":{\"soft\":false,\"value\":19},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":1,\"suit\":\"clubs\"}},{\"checkpoint\":14,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":71,\"reference\":-1,\"round\":7,\"timing\":\"after-round\"},{\"checkpoint\":15,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":72,\"reference\":-1,\"round\":8,\"timing\":\"before-bet\"},{\"checkpoint\":15,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":73,\"reference\":0,\"round\":8,\"timing\":\"before-bet\"},{\"atEntered\":null,\"cards\":[{\"rank\":3,\"suit\":\"clubs\"},{\"rank\":12,\"suit\":\"clubs\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":78,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":8,\"total\":{\"soft\":false,\"value\":13},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":5,\"suit\":\"hearts\"}},{\"checkpoint\":16,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":81,\"reference\":-1,\"round\":8,\"timing\":\"after-round\"},{\"checkpoint\":17,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":82,\"reference\":-1,\"round\":9,\"timing\":\"before-bet\"},{\"checkpoint\":17,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":83,\"reference\":0,\"round\":9,\"timing\":\"before-bet\"},{\"atEntered\":null,\"cards\":[{\"rank\":4,\"suit\":\"clubs\"},{\"rank\":13,\"suit\":\"diamonds\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":88,\"prescribed\":\"hit\",\"refused\":[],\"resolution\":\"overridden\",\"round\":9,\"total\":{\"soft\":false,\"value\":14},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":11,\"suit\":\"clubs\"}},{\"checkpoint\":18,\"count\":\"running\",\"entered\":0,\"error\":3,\"kind\":\"table\",\"position\":90,\"reference\":-3,\"round\":9,\"timing\":\"after-round\"},{\"checkpoint\":19,\"count\":\"running\",\"entered\":0,\"error\":3,\"kind\":\"table\",\"position\":91,\"reference\":-3,\"round\":10,\"timing\":\"before-bet\"},{\"checkpoint\":19,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":92,\"reference\":0,\"round\":10,\"timing\":\"before-bet\"},{\"atEntered\":null,\"cards\":[{\"rank\":9,\"suit\":\"spades\"},{\"rank\":1,\"suit\":\"spades\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":97,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":10,\"total\":{\"soft\":true,\"value\":20},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":9,\"suit\":\"spades\"}},{\"checkpoint\":20,\"count\":\"running\",\"entered\":0,\"error\":5,\"kind\":\"table\",\"position\":99,\"reference\":-5,\"round\":10,\"timing\":\"after-round\"}]}"
    },
    {
      "name": "table Play Check N=1 with deviations, the true count asked before a decision",
      "category": "table",
      "phase": "question",
      "specification": {
        "attemptId": "attempt-1",
        "content": {
          "category": "table",
          "id": "table",
          "reference": {
            "id": "blackjack-reference",
            "version": 1
          },
          "rounds": 10,
          "version": 1
        },
        "device": "device-1",
        "owner": "owner-1",
        "table": {
          "baseWager": "10",
          "betSchedule": false,
          "interval": 1,
          "policy": {
            "count": "player",
            "deviations": [
              {
                "atOrAbove": "stand",
                "below": "hit",
                "direction": "deviate-at-or-above",
                "hand": {
                  "kind": "hard",
                  "total": 16
                },
                "id": "16v10",
                "published": {
                  "bja": {
                    "cost": [
                      {
                        "perBet": "+0.0000",
                        "trueCount": 0
                      }
                    ],
                    "difference": 1,
                    "value": "+0"
                  },
                  "schlesinger": {
                    "cost": [
                      {
                        "perBet": "+0.0000",
                        "trueCount": 0
                      }
                    ],
                    "difference": 1,
                    "value": "+0"
                  }
                },
                "set": "illustrious18",
                "situation": "16 vs 10",
                "threshold": 1,
                "up": 10
              },
              {
                "atOrAbove": "double",
                "below": "hit",
                "direction": "deviate-at-or-above",
                "hand": {
                  "kind": "hard",
                  "total": 10
                },
                "id": "10v10",
                "published": {
                  "bja": {
                    "cost": [],
                    "difference": 0,
                    "value": "+4"
                  },
                  "schlesinger": {
                    "cost": [],
                    "difference": 0,
                    "value": "+4"
                  }
                },
                "set": "illustrious18",
                "situation": "10 vs 10",
                "threshold": 4,
                "up": 10
              },
              {
                "atOrAbove": "stand",
                "below": "hit",
                "direction": "deviate-at-or-above",
                "hand": {
                  "kind": "hard",
                  "total": 12
                },
                "id": "12v3",
                "published": {
                  "bja": {
                    "cost": [],
                    "difference": 0,
                    "value": "+2"
                  },
                  "schlesinger": {
                    "cost": [],
                    "difference": 0,
                    "value": "+2"
                  }
                },
                "set": "illustrious18",
                "situation": "12 vs 3",
                "threshold": 2,
                "up": 3
              },
              {
                "atOrAbove": "stand",
                "below": "hit",
                "direction": "basic-at-or-above",
                "hand": {
                  "kind": "hard",
                  "total": 13
                },
                "id": "13v2",
                "published": {
                  "bja": {
                    "cost": [
                      {
                        "perBet": "+0.0072",
                        "trueCount": -1
                      }
                    ],
                    "difference": 1,
                    "value": "-1"
                  },
                  "schlesinger": {
                    "cost": [
                      {
                        "perBet": "+0.0072",
                        "trueCount": -1
                      }
                    ],
                    "difference": 1,
                    "value": "-1"
                  }
                },
                "set": "illustrious18",
                "situation": "13 vs 2",
                "threshold": 0,
                "up": 2
              },
              {
                "atOrAbove": "split",
                "below": "stand",
                "direction": "deviate-at-or-above",
                "hand": {
                  "kind": "pair",
                  "value": 10
                },
                "id": "TTv5",
                "published": {
                  "bja": {
                    "cost": [],
                    "difference": 0,
                    "value": "+5"
                  },
                  "schlesinger": {
                    "cost": [],
                    "difference": 0,
                    "value": "+5"
                  }
                },
                "set": "illustrious18",
                "situation": "T,T vs 5",
                "threshold": 5,
                "up": 5
              },
              {
                "atOrAbove": "split",
                "below": "stand",
                "direction": "deviate-at-or-above",
                "hand": {
                  "kind": "pair",
                  "value": 10
                },
                "id": "TTv6",
                "published": {
                  "bja": {
                    "cost": [
                      {
                        "perBet": "+0.0188",
                        "trueCount": 4
                      }
                    ],
                    "difference": 1,
                    "value": "+4"
                  },
                  "schlesinger": {
                    "cost": [
                      {
                        "perBet": "+0.0188",
                        "trueCount": 4
                      }
                    ],
                    "difference": 1,
                    "value": "+4"
                  }
                },
                "set": "illustrious18",
                "situation": "T,T vs 6",
                "threshold": 5,
                "up": 6
              },
              {
                "atOrAbove": "surrender",
                "below": "basic",
                "direction": "deviate-at-or-above",
                "hand": {
                  "kind": "hard",
                  "total": 14
                },
                "id": "14v10R",
                "published": {
                  "bja": {
                    "cost": [],
                    "difference": 1,
                    "value": "+3"
                  },
                  "schlesinger": {
                    "cost": [],
                    "difference": 1,
                    "value": "+3"
                  }
                },
                "set": "fab4",
                "situation": "14 vs 10 surrender",
                "threshold": 4,
                "up": 10
              },
              {
                "atOrAbove": "surrender",
                "below": "basic",
                "direction": "basic-at-or-above",
                "hand": {
                  "kind": "hard",
                  "total": 15
                },
                "id": "15v10R",
                "published": {
                  "bja": {
                    "cost": [],
                    "difference": 0,
                    "value": "+0"
                  },
                  "schlesinger": {
                    "cost": [],
                    "difference": 0,
                    "value": "+0"
                  }
                },
                "set": "fab4",
                "situation": "15 vs 10 surrender",
                "threshold": 0,
                "up": 10
              },
              {
                "atOrAbove": "insure",
                "below": "decline",
                "direction": "deviate-at-or-above",
                "hand": {
                  "kind": "insurance"
                },
                "id": "insurance",
                "published": {
                  "bja": {
                    "cost": [],
                    "difference": 0,
                    "value": "+3"
                  },
                  "schlesinger": {
                    "cost": [],
                    "difference": 0,
                    "value": "+3"
                  }
                },
                "set": "insurance",
                "situation": "Insurance",
                "threshold": 3,
                "up": 1
              }
            ],
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
                "pair": [
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "SHHHHHSHHS",
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
                "pair": [
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "SHHHHHSHHS",
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
                ]
              },
              "splitByBalance": [
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HSSSSSHHHH",
                "HSSSSSHHHH",
                "RSSSSSHHRR",
                "SSSSSSSSSS",
                "SSSSSSSSSS"
              ],
              "splitByRule": [
                "SSSSSSSSSS",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HDDDDDDDDH",
                "HSSSSSHHHH",
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
                ],
                "soft": [
                  "HHHHHHHHHH",
                  "HHHHDDHHHH",
                  "HHHHDDHHHH",
                  "HHHDDDHHHH",
                  "HHHDDDHHHH",
                  "HHDDDDHHHH",
                  "HSDDDDSSHH",
                  "SSSSSSSSSS",
                  "SSSSSSSSSS"
                ]
              }
            },
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
              ],
              "soft": [
                "HHHHHHHHHH",
                "HHHHDDHHHH",
                "HHHHDDHHHH",
                "HHHDDDHHHH",
                "HHHDDDHHHH",
                "HHDDDDHHHH",
                "HSDDDDSSHH",
                "SSSSSSSSSS",
                "SSSSSSSSSS"
              ]
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
                "HHHHHHHHHH",
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
          },
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
          "seat": "play",
          "startingBalance": "1000"
        },
        "variant": "check"
      },
      "random": {
        "key": [
          1,
          2654435769
        ],
        "protocol": 1,
        "session": [
          8,
          0
        ]
      },
      "checkpoint": "{\"answers\":[{\"first\":0,\"last\":0,\"position\":0,\"tries\":1},{\"first\":0,\"last\":0,\"position\":1,\"tries\":1},{\"first\":0,\"last\":0,\"position\":11,\"tries\":1},{\"first\":0,\"last\":0,\"position\":12,\"tries\":1},{\"first\":0,\"last\":0,\"position\":13,\"tries\":1},{\"first\":0,\"last\":0,\"position\":20,\"tries\":1},{\"first\":0,\"last\":0,\"position\":21,\"tries\":1},{\"first\":0,\"last\":0,\"position\":22,\"tries\":1}],\"attempt\":{\"device\":\"device-1\",\"id\":\"attempt-1\",\"owner\":\"owner-1\"},\"content\":{\"category\":\"table\",\"id\":\"table\",\"reference\":{\"id\":\"blackjack-reference\",\"version\":1},\"rounds\":10,\"version\":1},\"ending\":null,\"identities\":{\"category\":\"table\",\"content\":{\"id\":\"table\",\"version\":1},\"engine\":\"0.0.0\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":{\"id\":\"blackjack-reference\",\"version\":1}},\"items\":[{\"checkpoint\":1,\"count\":\"running\",\"round\":1,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"checkpoint\":1,\"count\":\"true\",\"round\":1,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"events\":[],\"face\":{\"rank\":13,\"suit\":\"diamonds\"},\"round\":1,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":{\"rank\":3,\"suit\":\"hearts\"},\"round\":1,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":4,\"suit\":\"clubs\"},\"round\":1,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":null,\"round\":1,\"step\":\"deal\",\"to\":\"dealer\"},{\"actions\":[\"hit\",\"stand\",\"double\",\"surrender\"],\"decision\":\"hand\",\"events\":[],\"round\":1,\"step\":\"decision\",\"target\":\"hand-1\",\"unaffordable\":[]},{\"events\":[{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"hand-1\"}],\"face\":{\"rank\":3,\"suit\":\"diamonds\"},\"round\":1,\"step\":\"reveal\"},{\"events\":[],\"face\":{\"rank\":3,\"suit\":\"clubs\"},\"round\":1,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":4,\"suit\":\"clubs\"},\"round\":1,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":12,\"suit\":\"clubs\"},\"round\":1,\"step\":\"deal\",\"to\":\"dealer\"},{\"checkpoint\":2,\"count\":\"running\",\"round\":1,\"step\":\"prompt\",\"timing\":\"after-round\"},{\"checkpoint\":3,\"count\":\"running\",\"round\":2,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"checkpoint\":3,\"count\":\"true\",\"round\":2,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"events\":[],\"face\":{\"rank\":11,\"suit\":\"diamonds\"},\"round\":2,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":{\"rank\":13,\"suit\":\"clubs\"},\"round\":2,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":7,\"suit\":\"spades\"},\"round\":2,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":null,\"round\":2,\"step\":\"deal\",\"to\":\"dealer\"},{\"actions\":[\"hit\",\"stand\",\"double\",\"surrender\"],\"decision\":\"hand\",\"events\":[{\"kind\":\"peeked\",\"result\":\"no-blackjack\"}],\"round\":2,\"step\":\"decision\",\"target\":\"hand-1\",\"unaffordable\":[]},{\"events\":[{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"hand-1\"}],\"face\":{\"rank\":11,\"suit\":\"diamonds\"},\"round\":2,\"step\":\"reveal\"},{\"checkpoint\":4,\"count\":\"running\",\"round\":2,\"step\":\"prompt\",\"timing\":\"after-round\"},{\"checkpoint\":5,\"count\":\"running\",\"round\":3,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"checkpoint\":5,\"count\":\"true\",\"round\":3,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"events\":[],\"face\":{\"rank\":12,\"suit\":\"hearts\"},\"round\":3,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":{\"rank\":1,\"suit\":\"spades\"},\"round\":3,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":6,\"suit\":\"spades\"},\"round\":3,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":null,\"round\":3,\"step\":\"deal\",\"to\":\"dealer\"},{\"checkpoint\":6,\"count\":\"true\",\"round\":3,\"step\":\"prompt\",\"timing\":\"decision\"},{\"actions\":[\"insure\",\"decline-insurance\"],\"decision\":\"insurance\",\"events\":[],\"round\":3,\"step\":\"decision\",\"target\":\"hand-1\",\"unaffordable\":[]}],\"phase\":\"question\",\"position\":27,\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":0,\"protocol\":1,\"session\":[8,0]},\"receipts\":[{\"command\":\"{\\\"kind\\\":\\\"begin\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-4\",\"disposition\":\"applied\",\"sequence\":4},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-5\",\"disposition\":\"applied\",\"sequence\":5},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-6\",\"disposition\":\"applied\",\"sequence\":6},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-7\",\"disposition\":\"applied\",\"sequence\":7},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-8\",\"disposition\":\"applied\",\"sequence\":8},{\"command\":\"{\\\"action\\\":\\\"stand\\\",\\\"kind\\\":\\\"play\\\"}\",\"commandId\":\"record-9\",\"disposition\":\"applied\",\"sequence\":9},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-10\",\"disposition\":\"applied\",\"sequence\":10},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-11\",\"disposition\":\"applied\",\"sequence\":11},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-12\",\"disposition\":\"applied\",\"sequence\":12},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-13\",\"disposition\":\"applied\",\"sequence\":13},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-14\",\"disposition\":\"applied\",\"sequence\":14},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-15\",\"disposition\":\"applied\",\"sequence\":15},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-16\",\"disposition\":\"applied\",\"sequence\":16},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-17\",\"disposition\":\"applied\",\"sequence\":17},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-18\",\"disposition\":\"applied\",\"sequence\":18},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-19\",\"disposition\":\"applied\",\"sequence\":19},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-20\",\"disposition\":\"applied\",\"sequence\":20},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-21\",\"disposition\":\"applied\",\"sequence\":21},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-22\",\"disposition\":\"applied\",\"sequence\":22},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-23\",\"disposition\":\"applied\",\"sequence\":23},{\"command\":\"{\\\"action\\\":\\\"stand\\\",\\\"kind\\\":\\\"play\\\"}\",\"commandId\":\"record-24\",\"disposition\":\"applied\",\"sequence\":24},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-25\",\"disposition\":\"applied\",\"sequence\":25},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-26\",\"disposition\":\"applied\",\"sequence\":26},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-27\",\"disposition\":\"applied\",\"sequence\":27},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-28\",\"disposition\":\"applied\",\"sequence\":28},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-29\",\"disposition\":\"applied\",\"sequence\":29},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-30\",\"disposition\":\"applied\",\"sequence\":30},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-31\",\"disposition\":\"applied\",\"sequence\":31},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-32\",\"disposition\":\"applied\",\"sequence\":32},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-33\",\"disposition\":\"applied\",\"sequence\":33},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-34\",\"disposition\":\"applied\",\"sequence\":34},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-35\",\"disposition\":\"applied\",\"sequence\":35}],\"rejected\":0,\"revealedAt\":null,\"schema\":13,\"sequence\":36,\"table\":{\"round\":3,\"seat\":{\"activity\":{\"activity\":{\"device\":\"device-1\",\"id\":\"attempt-1/seat\",\"owner\":\"owner-1\"},\"balance\":\"990\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"10\",\"peak\":\"10\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"blackjack\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":{\"id\":\"blackjack-reference\",\"version\":1},\"rules\":{\"id\":\"blackjack-six-deck\",\"version\":1},\"strategy\":null},\"outcome\":{\"active\":0,\"dealer\":[{\"deck\":4,\"rank\":1,\"suit\":\"spades\"},{\"deck\":2,\"rank\":8,\"suit\":\"hearts\"}],\"hands\":[{\"cards\":[{\"deck\":0,\"rank\":12,\"suit\":\"hearts\"},{\"deck\":3,\"rank\":6,\"suit\":\"spades\"}],\"done\":false,\"doubled\":false,\"surrendered\":false,\"target\":\"hand-1\"}],\"holeRevealed\":false,\"insurance\":\"offered\",\"others\":[],\"peek\":\"pending\"},\"phase\":\"open-decision\",\"random\":{\"block\":[77,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":3,\"protocol\":1,\"session\":[8,0]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"hand-1\\\"}\",\"commandId\":\"seat-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"seat-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"action\\\":\\\"stand\\\",\\\"kind\\\":\\\"play\\\"}\",\"commandId\":\"seat-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"kind\\\":\\\"settle-turn\\\"}\",\"commandId\":\"seat-3\",\"disposition\":\"applied\",\"sequence\":3},{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"hand-1\\\"}\",\"commandId\":\"seat-4\",\"disposition\":\"applied\",\"sequence\":4},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"seat-5\",\"disposition\":\"applied\",\"sequence\":5},{\"command\":\"{\\\"action\\\":\\\"stand\\\",\\\"kind\\\":\\\"play\\\"}\",\"commandId\":\"seat-6\",\"disposition\":\"applied\",\"sequence\":6},{\"command\":\"{\\\"kind\\\":\\\"settle-turn\\\"}\",\"commandId\":\"seat-7\",\"disposition\":\"applied\",\"sequence\":7},{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"hand-1\\\"}\",\"commandId\":\"seat-8\",\"disposition\":\"applied\",\"sequence\":8},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"seat-9\",\"disposition\":\"applied\",\"sequence\":9}],\"rules\":{\"dealer\":\"S17\",\"decks\":6,\"lateSurrender\":true,\"limits\":{\"initial\":{\"max\":\"1000\",\"min\":\"10\"}},\"penetration\":75,\"players\":{\"learnerSeat\":0,\"otherWagers\":[],\"strategy\":null}},\"schema\":13,\"sequence\":10,\"shoe\":{\"cut\":234,\"next\":15,\"order\":[25,132,107,15,210,3,63,179,220,201,283,37,247,200,137,79,35,64,56,38,97,294,30,130,238,146,138,161,249,214,127,104,86,258,2,134,11,180,227,159,114,285,152,99,47,39,206,269,217,98,279,71,287,101,88,198,234,300,42,57,13,67,221,115,261,110,136,171,22,26,248,303,92,128,65,311,288,58,33,62,16,119,170,271,292,45,82,169,7,219,19,5,230,203,204,59,70,6,83,280,43,302,262,87,53,267,260,297,60,100,211,117,286,291,143,199,259,176,95,240,229,84,125,113,61,290,226,202,256,187,156,81,275,74,103,20,270,298,140,265,23,184,109,177,52,166,181,106,123,31,135,309,40,196,0,228,266,235,273,158,4,116,66,252,131,172,232,168,304,241,186,278,96,111,183,12,34,307,213,308,164,296,299,281,48,150,165,239,289,251,243,236,17,178,225,257,197,29,205,122,46,293,118,188,274,254,276,218,102,189,174,208,139,246,55,282,193,72,167,145,191,245,284,124,233,80,222,163,73,49,8,190,154,231,41,147,77,277,21,209,242,50,1,10,153,51,182,195,120,253,212,263,28,90,216,155,250,301,207,192,305,18,69,121,224,185,36,295,264,237,310,91,144,94,173,244,9,27,89,129,68,112,78,194,75,255,160,306,151,76,268,24,54,157,215,32,14,142,133,141,93,223,108,126,44,175,105,148,149,162,85,272]},\"strategy\":null,\"turn\":3,\"wagers\":[{\"amount\":\"10\",\"target\":\"hand-1\"}]},\"betCorrection\":null,\"bets\":[],\"correction\":null,\"decisions\":[{\"attempts\":[{\"action\":\"stand\",\"refusal\":null}],\"explanation\":{\"cell\":{\"hand\":14,\"kind\":\"hard\",\"play\":\"stand\",\"table\":\"first\",\"up\":3},\"deviation\":null,\"ifUnaffordable\":null,\"kind\":\"play\",\"preferred\":\"stand\",\"prescribed\":{\"action\":\"stand\",\"amount\":null},\"situation\":{\"available\":\"990\",\"cards\":[{\"deck\":0,\"rank\":13,\"suit\":\"diamonds\"},{\"deck\":2,\"rank\":4,\"suit\":\"clubs\"}],\"count\":{\"decks\":\"6\",\"running\":1,\"trueCount\":0},\"decision\":\"hand\",\"hand\":0,\"hands\":1,\"original\":true,\"pair\":false,\"stake\":\"10\",\"target\":\"hand-1\",\"total\":{\"soft\":false,\"value\":14},\"up\":{\"deck\":2,\"rank\":3,\"suit\":\"hearts\"}},\"unavailable\":[]},\"played\":\"stand\",\"position\":6,\"prompt\":null,\"resolution\":\"followed\"},{\"attempts\":[{\"action\":\"stand\",\"refusal\":null}],\"explanation\":{\"cell\":{\"hand\":17,\"kind\":\"hard\",\"play\":\"stand\",\"table\":\"first\",\"up\":10},\"deviation\":null,\"ifUnaffordable\":null,\"kind\":\"play\",\"preferred\":\"stand\",\"prescribed\":{\"action\":\"stand\",\"amount\":null},\"situation\":{\"available\":\"1000\",\"cards\":[{\"deck\":3,\"rank\":11,\"suit\":\"diamonds\"},{\"deck\":3,\"rank\":7,\"suit\":\"spades\"}],\"count\":{\"decks\":\"6\",\"running\":1,\"trueCount\":0},\"decision\":\"hand\",\"hand\":0,\"hands\":1,\"original\":true,\"pair\":false,\"stake\":\"10\",\"target\":\"hand-1\",\"total\":{\"soft\":false,\"value\":17},\"up\":{\"deck\":4,\"rank\":13,\"suit\":\"clubs\"}},\"unavailable\":[]},\"played\":\"stand\",\"position\":18,\"prompt\":null,\"resolution\":\"followed\"},{\"attempts\":[],\"explanation\":{\"cell\":null,\"deviation\":{\"atOrAbove\":\"insure\",\"below\":\"decline\",\"direction\":\"deviate-at-or-above\",\"hand\":{\"kind\":\"insurance\"},\"id\":\"insurance\",\"play\":\"decline\",\"published\":{\"bja\":{\"cost\":[],\"difference\":0,\"value\":\"+3\"},\"schlesinger\":{\"cost\":[],\"difference\":0,\"value\":\"+3\"}},\"set\":\"insurance\",\"side\":\"below\",\"situation\":\"Insurance\",\"threshold\":3,\"up\":1},\"ifUnaffordable\":null,\"kind\":\"play\",\"preferred\":\"decline-insurance\",\"prescribed\":{\"action\":\"decline-insurance\",\"amount\":null},\"situation\":{\"available\":\"990\",\"cards\":[{\"deck\":0,\"rank\":12,\"suit\":\"hearts\"},{\"deck\":3,\"rank\":6,\"suit\":\"spades\"}],\"count\":{\"decks\":\"5.5\",\"running\":-1,\"trueCount\":0},\"decision\":\"insurance\",\"hand\":0,\"hands\":1,\"original\":true,\"pair\":false,\"stake\":\"10\",\"target\":\"hand-1\",\"total\":{\"soft\":false,\"value\":16},\"up\":{\"deck\":4,\"rank\":1,\"suit\":\"spades\"}},\"unavailable\":[]},\"played\":null,\"position\":28,\"prompt\":27,\"resolution\":null}],\"ledger\":[{\"balance\":\"990\",\"change\":\"wager\",\"net\":null,\"position\":2,\"round\":1,\"wager\":\"10\"},{\"balance\":\"1010\",\"change\":\"settled\",\"net\":\"10\",\"position\":10,\"round\":1,\"wager\":\"10\"},{\"balance\":\"1000\",\"change\":\"wager\",\"net\":null,\"position\":14,\"round\":2,\"wager\":\"10\"},{\"balance\":\"1000\",\"change\":\"settled\",\"net\":\"-10\",\"position\":19,\"round\":2,\"wager\":\"10\"},{\"balance\":\"990\",\"change\":\"wager\",\"net\":null,\"position\":23,\"round\":3,\"wager\":\"10\"}]},\"setup\":{\"baseWager\":\"10\",\"betSchedule\":false,\"interval\":1,\"policy\":{\"count\":\"player\",\"deviations\":[{\"atOrAbove\":\"stand\",\"below\":\"hit\",\"direction\":\"deviate-at-or-above\",\"hand\":{\"kind\":\"hard\",\"total\":16},\"id\":\"16v10\",\"published\":{\"bja\":{\"cost\":[{\"perBet\":\"+0.0000\",\"trueCount\":0}],\"difference\":1,\"value\":\"+0\"},\"schlesinger\":{\"cost\":[{\"perBet\":\"+0.0000\",\"trueCount\":0}],\"difference\":1,\"value\":\"+0\"}},\"set\":\"illustrious18\",\"situation\":\"16 vs 10\",\"threshold\":1,\"up\":10},{\"atOrAbove\":\"double\",\"below\":\"hit\",\"direction\":\"deviate-at-or-above\",\"hand\":{\"kind\":\"hard\",\"total\":10},\"id\":\"10v10\",\"published\":{\"bja\":{\"cost\":[],\"difference\":0,\"value\":\"+4\"},\"schlesinger\":{\"cost\":[],\"difference\":0,\"value\":\"+4\"}},\"set\":\"illustrious18\",\"situation\":\"10 vs 10\",\"threshold\":4,\"up\":10},{\"atOrAbove\":\"stand\",\"below\":\"hit\",\"direction\":\"deviate-at-or-above\",\"hand\":{\"kind\":\"hard\",\"total\":12},\"id\":\"12v3\",\"published\":{\"bja\":{\"cost\":[],\"difference\":0,\"value\":\"+2\"},\"schlesinger\":{\"cost\":[],\"difference\":0,\"value\":\"+2\"}},\"set\":\"illustrious18\",\"situation\":\"12 vs 3\",\"threshold\":2,\"up\":3},{\"atOrAbove\":\"stand\",\"below\":\"hit\",\"direction\":\"basic-at-or-above\",\"hand\":{\"kind\":\"hard\",\"total\":13},\"id\":\"13v2\",\"published\":{\"bja\":{\"cost\":[{\"perBet\":\"+0.0072\",\"trueCount\":-1}],\"difference\":1,\"value\":\"-1\"},\"schlesinger\":{\"cost\":[{\"perBet\":\"+0.0072\",\"trueCount\":-1}],\"difference\":1,\"value\":\"-1\"}},\"set\":\"illustrious18\",\"situation\":\"13 vs 2\",\"threshold\":0,\"up\":2},{\"atOrAbove\":\"split\",\"below\":\"stand\",\"direction\":\"deviate-at-or-above\",\"hand\":{\"kind\":\"pair\",\"value\":10},\"id\":\"TTv5\",\"published\":{\"bja\":{\"cost\":[],\"difference\":0,\"value\":\"+5\"},\"schlesinger\":{\"cost\":[],\"difference\":0,\"value\":\"+5\"}},\"set\":\"illustrious18\",\"situation\":\"T,T vs 5\",\"threshold\":5,\"up\":5},{\"atOrAbove\":\"split\",\"below\":\"stand\",\"direction\":\"deviate-at-or-above\",\"hand\":{\"kind\":\"pair\",\"value\":10},\"id\":\"TTv6\",\"published\":{\"bja\":{\"cost\":[{\"perBet\":\"+0.0188\",\"trueCount\":4}],\"difference\":1,\"value\":\"+4\"},\"schlesinger\":{\"cost\":[{\"perBet\":\"+0.0188\",\"trueCount\":4}],\"difference\":1,\"value\":\"+4\"}},\"set\":\"illustrious18\",\"situation\":\"T,T vs 6\",\"threshold\":5,\"up\":6},{\"atOrAbove\":\"surrender\",\"below\":\"basic\",\"direction\":\"deviate-at-or-above\",\"hand\":{\"kind\":\"hard\",\"total\":14},\"id\":\"14v10R\",\"published\":{\"bja\":{\"cost\":[],\"difference\":1,\"value\":\"+3\"},\"schlesinger\":{\"cost\":[],\"difference\":1,\"value\":\"+3\"}},\"set\":\"fab4\",\"situation\":\"14 vs 10 surrender\",\"threshold\":4,\"up\":10},{\"atOrAbove\":\"surrender\",\"below\":\"basic\",\"direction\":\"basic-at-or-above\",\"hand\":{\"kind\":\"hard\",\"total\":15},\"id\":\"15v10R\",\"published\":{\"bja\":{\"cost\":[],\"difference\":0,\"value\":\"+0\"},\"schlesinger\":{\"cost\":[],\"difference\":0,\"value\":\"+0\"}},\"set\":\"fab4\",\"situation\":\"15 vs 10 surrender\",\"threshold\":0,\"up\":10},{\"atOrAbove\":\"insure\",\"below\":\"decline\",\"direction\":\"deviate-at-or-above\",\"hand\":{\"kind\":\"insurance\"},\"id\":\"insurance\",\"published\":{\"bja\":{\"cost\":[],\"difference\":0,\"value\":\"+3\"},\"schlesinger\":{\"cost\":[],\"difference\":0,\"value\":\"+3\"}},\"set\":\"insurance\",\"situation\":\"Insurance\",\"threshold\":3,\"up\":1}],\"fallbacks\":{\"double\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SHHHHHSHHS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"doubleOnOriginalLateSurrender\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHR\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SHHHHHSHHS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"splitByBalance\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"splitByRule\":[\"SSSSSSSSSS\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"surrender\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"PPPPPPPPPP\",\"HPPPPPPHHH\",\"HPPPPPPHHH\",\"HHHHPPHHHH\",\"HDDDDDDDDH\",\"HPPPPPHHHH\",\"HPPPPPPHHH\",\"PPPPPPPPPP\",\"SPPPPPSPPS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]}},\"first\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHR\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"PPPPPPPPPP\",\"HPPPPPPHHH\",\"HPPPPPPHHH\",\"HHHHPPHHHH\",\"HDDDDDDDDH\",\"HPPPPPHHHH\",\"HPPPPPPHHH\",\"PPPPPPPPPP\",\"SPPPPPSPPS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"later\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"laterWithoutDouble\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]}},\"rules\":{\"dealer\":\"S17\",\"decks\":6,\"id\":\"blackjack-six-deck\",\"lateSurrender\":true,\"limits\":{\"initial\":{\"max\":\"1000\",\"min\":\"10\"}},\"penetration\":75,\"players\":{\"learnerSeat\":0,\"otherWagers\":[],\"strategy\":null},\"version\":1},\"seat\":\"play\",\"startingBalance\":\"1000\"},\"shoe\":null},\"variant\":\"check\"}",
      "continuation": [
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "decline-insurance"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "decline-insurance"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        }
      ],
      "facts": "[{\"kind\":\"answer-accepted\",\"position\":27,\"scored\":true},{\"kind\":\"content-shown\",\"position\":30},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":30},{\"kind\":\"checkpoint-due\",\"position\":31},{\"kind\":\"answer-accepted\",\"position\":31,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":32},{\"kind\":\"answer-accepted\",\"position\":32,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":33,\"scored\":true},{\"kind\":\"content-shown\",\"position\":34},{\"kind\":\"wager-placed\",\"position\":34},{\"kind\":\"content-shown\",\"position\":35},{\"kind\":\"content-shown\",\"position\":36},{\"kind\":\"content-shown\",\"position\":37},{\"kind\":\"content-shown\",\"position\":39},{\"kind\":\"content-shown\",\"position\":40},{\"kind\":\"round-settled\",\"net\":\"10\",\"position\":40},{\"kind\":\"checkpoint-due\",\"position\":41},{\"kind\":\"answer-accepted\",\"position\":41,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":42},{\"kind\":\"answer-accepted\",\"position\":42,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":43,\"scored\":true},{\"kind\":\"content-shown\",\"position\":44},{\"kind\":\"wager-placed\",\"position\":44},{\"kind\":\"content-shown\",\"position\":45},{\"kind\":\"content-shown\",\"position\":46},{\"kind\":\"content-shown\",\"position\":47},{\"kind\":\"content-shown\",\"position\":49},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":49},{\"kind\":\"checkpoint-due\",\"position\":50},{\"kind\":\"answer-accepted\",\"position\":50,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":51},{\"kind\":\"answer-accepted\",\"position\":51,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":52,\"scored\":true},{\"kind\":\"content-shown\",\"position\":53},{\"kind\":\"wager-placed\",\"position\":53},{\"kind\":\"content-shown\",\"position\":54},{\"kind\":\"content-shown\",\"position\":55},{\"kind\":\"content-shown\",\"position\":56},{\"kind\":\"content-shown\",\"position\":58},{\"kind\":\"content-shown\",\"position\":59},{\"kind\":\"content-shown\",\"position\":60},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":60},{\"kind\":\"checkpoint-due\",\"position\":61},{\"kind\":\"answer-accepted\",\"position\":61,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":62},{\"kind\":\"answer-accepted\",\"position\":62,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":63,\"scored\":true},{\"kind\":\"content-shown\",\"position\":64},{\"kind\":\"wager-placed\",\"position\":64},{\"kind\":\"content-shown\",\"position\":65},{\"kind\":\"content-shown\",\"position\":66},{\"kind\":\"content-shown\",\"position\":67},{\"kind\":\"checkpoint-due\",\"position\":68},{\"kind\":\"answer-accepted\",\"position\":68,\"scored\":true},{\"kind\":\"content-shown\",\"position\":70},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":70},{\"kind\":\"checkpoint-due\",\"position\":71},{\"kind\":\"answer-accepted\",\"position\":71,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":72},{\"kind\":\"answer-accepted\",\"position\":72,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":73,\"scored\":true},{\"kind\":\"content-shown\",\"position\":74},{\"kind\":\"wager-placed\",\"position\":74},{\"kind\":\"content-shown\",\"position\":75},{\"kind\":\"content-shown\",\"position\":76},{\"kind\":\"content-shown\",\"position\":77},{\"kind\":\"content-shown\",\"position\":79},{\"kind\":\"content-shown\",\"position\":80},{\"kind\":\"round-settled\",\"net\":\"10\",\"position\":80},{\"kind\":\"checkpoint-due\",\"position\":81},{\"kind\":\"answer-accepted\",\"position\":81,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":82},{\"kind\":\"answer-accepted\",\"position\":82,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":83,\"scored\":true},{\"kind\":\"content-shown\",\"position\":84},{\"kind\":\"wager-placed\",\"position\":84},{\"kind\":\"content-shown\",\"position\":85},{\"kind\":\"content-shown\",\"position\":86},{\"kind\":\"content-shown\",\"position\":87},{\"kind\":\"checkpoint-due\",\"position\":88},{\"kind\":\"answer-accepted\",\"position\":88,\"scored\":true},{\"kind\":\"content-shown\",\"position\":90},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":90},{\"kind\":\"checkpoint-due\",\"position\":91},{\"kind\":\"answer-accepted\",\"position\":91,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":92},{\"kind\":\"answer-accepted\",\"position\":92,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":93,\"scored\":true},{\"kind\":\"content-shown\",\"position\":94},{\"kind\":\"wager-placed\",\"position\":94},{\"kind\":\"content-shown\",\"position\":95},{\"kind\":\"content-shown\",\"position\":96},{\"kind\":\"content-shown\",\"position\":97},{\"kind\":\"content-shown\",\"position\":99},{\"kind\":\"round-settled\",\"net\":\"10\",\"position\":99},{\"kind\":\"checkpoint-due\",\"position\":100},{\"kind\":\"answer-accepted\",\"position\":100,\"scored\":true},{\"ending\":\"completed\",\"kind\":\"attempt-ended\"}]",
      "results": "{\"assistanceStep\":null,\"assisted\":false,\"ending\":\"completed\",\"finances\":{\"finishingBalance\":\"980\",\"net\":\"-20\",\"startingBalance\":\"1000\"},\"metrics\":{\"betting-adherence\":null,\"card-values\":null,\"playing-adherence\":{\"correct\":7,\"total\":11},\"running-count\":{\"correct\":3,\"total\":20},\"true-count\":{\"correct\":13,\"total\":13}},\"review\":[{\"checkpoint\":1,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":1,\"reference\":0,\"round\":1,\"timing\":\"before-bet\"},{\"checkpoint\":1,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":2,\"reference\":0,\"round\":1,\"timing\":\"before-bet\"},{\"atEntered\":null,\"cards\":[{\"rank\":13,\"suit\":\"diamonds\"},{\"rank\":4,\"suit\":\"clubs\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":7,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":1,\"total\":{\"soft\":false,\"value\":14},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":3,\"suit\":\"hearts\"}},{\"checkpoint\":2,\"count\":\"running\",\"entered\":0,\"error\":-3,\"kind\":\"table\",\"position\":12,\"reference\":3,\"round\":1,\"timing\":\"after-round\"},{\"checkpoint\":3,\"count\":\"running\",\"entered\":0,\"error\":-3,\"kind\":\"table\",\"position\":13,\"reference\":3,\"round\":2,\"timing\":\"before-bet\"},{\"checkpoint\":3,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":14,\"reference\":0,\"round\":2,\"timing\":\"before-bet\"},{\"atEntered\":null,\"cards\":[{\"rank\":11,\"suit\":\"diamonds\"},{\"rank\":7,\"suit\":\"spades\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":19,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":2,\"total\":{\"soft\":false,\"value\":17},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":13,\"suit\":\"clubs\"}},{\"checkpoint\":4,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":21,\"reference\":0,\"round\":2,\"timing\":\"after-round\"},{\"checkpoint\":5,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":22,\"reference\":0,\"round\":3,\"timing\":\"before-bet\"},{\"checkpoint\":5,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":23,\"reference\":0,\"round\":3,\"timing\":\"before-bet\"},{\"checkpoint\":6,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":28,\"reference\":0,\"round\":3,\"timing\":\"decision\"},{\"atEntered\":\"decline-insurance\",\"cards\":[{\"rank\":12,\"suit\":\"hearts\"},{\"rank\":6,\"suit\":\"spades\"}],\"chosen\":\"decline-insurance\",\"countDependent\":true,\"decision\":\"insurance\",\"entered\":0,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"decline-insurance\",\"position\":29,\"prescribed\":\"decline-insurance\",\"refused\":[],\"resolution\":\"followed\",\"round\":3,\"total\":{\"soft\":false,\"value\":16},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":1,\"suit\":\"spades\"}},{\"atEntered\":null,\"cards\":[{\"rank\":12,\"suit\":\"hearts\"},{\"rank\":6,\"suit\":\"spades\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":30,\"prescribed\":\"surrender\",\"refused\":[],\"resolution\":\"departed\",\"round\":3,\"total\":{\"soft\":false,\"value\":16},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":1,\"suit\":\"spades\"}},{\"checkpoint\":7,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":32,\"reference\":-1,\"round\":3,\"timing\":\"after-round\"},{\"checkpoint\":8,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":33,\"reference\":-1,\"round\":4,\"timing\":\"before-bet\"},{\"checkpoint\":8,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":34,\"reference\":0,\"round\":4,\"timing\":\"before-bet\"},{\"atEntered\":null,\"cards\":[{\"rank\":2,\"suit\":\"hearts\"},{\"rank\":13,\"suit\":\"clubs\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":39,\"prescribed\":\"hit\",\"refused\":[],\"resolution\":\"departed\",\"round\":4,\"total\":{\"soft\":false,\"value\":12},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":10,\"suit\":\"hearts\"}},{\"checkpoint\":9,\"count\":\"running\",\"entered\":0,\"error\":2,\"kind\":\"table\",\"position\":42,\"reference\":-2,\"round\":4,\"timing\":\"after-round\"},{\"checkpoint\":10,\"count\":\"running\",\"entered\":0,\"error\":2,\"kind\":\"table\",\"position\":43,\"reference\":-2,\"round\":5,\"timing\":\"before-bet\"},{\"checkpoint\":10,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":44,\"reference\":0,\"round\":5,\"timing\":\"before-bet\"},{\"atEntered\":null,\"cards\":[{\"rank\":7,\"suit\":\"spades\"},{\"rank\":5,\"suit\":\"hearts\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":49,\"prescribed\":\"hit\",\"refused\":[],\"resolution\":\"departed\",\"round\":5,\"total\":{\"soft\":false,\"value\":12},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":9,\"suit\":\"hearts\"}},{\"checkpoint\":11,\"count\":\"running\",\"entered\":0,\"error\":2,\"kind\":\"table\",\"position\":51,\"reference\":-2,\"round\":5,\"timing\":\"after-round\"},{\"checkpoint\":12,\"count\":\"running\",\"entered\":0,\"error\":2,\"kind\":\"table\",\"position\":52,\"reference\":-2,\"round\":6,\"timing\":\"before-bet\"},{\"checkpoint\":12,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":53,\"reference\":0,\"round\":6,\"timing\":\"before-bet\"},{\"atEntered\":null,\"cards\":[{\"rank\":5,\"suit\":\"hearts\"},{\"rank\":9,\"suit\":\"hearts\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":58,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":6,\"total\":{\"soft\":false,\"value\":14},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":4,\"suit\":\"spades\"}},{\"checkpoint\":13,\"count\":\"running\",\"entered\":0,\"error\":-2,\"kind\":\"table\",\"position\":62,\"reference\":2,\"round\":6,\"timing\":\"after-round\"},{\"checkpoint\":14,\"count\":\"running\",\"entered\":0,\"error\":-2,\"kind\":\"table\",\"position\":63,\"reference\":2,\"round\":7,\"timing\":\"before-bet\"},{\"checkpoint\":14,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":64,\"reference\":0,\"round\":7,\"timing\":\"before-bet\"},{\"checkpoint\":15,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":69,\"reference\":0,\"round\":7,\"timing\":\"decision\"},{\"atEntered\":\"decline-insurance\",\"cards\":[{\"rank\":11,\"suit\":\"diamonds\"},{\"rank\":9,\"suit\":\"hearts\"}],\"chosen\":\"decline-insurance\",\"countDependent\":true,\"decision\":\"insurance\",\"entered\":0,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"decline-insurance\",\"position\":70,\"prescribed\":\"decline-insurance\",\"refused\":[],\"resolution\":\"followed\",\"round\":7,\"total\":{\"soft\":false,\"value\":19},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":1,\"suit\":\"clubs\"}},{\"checkpoint\":16,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":72,\"reference\":-1,\"round\":7,\"timing\":\"after-round\"},{\"checkpoint\":17,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":73,\"reference\":-1,\"round\":8,\"timing\":\"before-bet\"},{\"checkpoint\":17,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":74,\"reference\":0,\"round\":8,\"timing\":\"before-bet\"},{\"atEntered\":null,\"cards\":[{\"rank\":3,\"suit\":\"clubs\"},{\"rank\":12,\"suit\":\"clubs\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":79,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":8,\"total\":{\"soft\":false,\"value\":13},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":5,\"suit\":\"hearts\"}},{\"checkpoint\":18,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":82,\"reference\":-1,\"round\":8,\"timing\":\"after-round\"},{\"checkpoint\":19,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":83,\"reference\":-1,\"round\":9,\"timing\":\"before-bet\"},{\"checkpoint\":19,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":84,\"reference\":0,\"round\":9,\"timing\":\"before-bet\"},{\"checkpoint\":20,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":89,\"reference\":0,\"round\":9,\"timing\":\"decision\"},{\"atEntered\":\"hit\",\"cards\":[{\"rank\":4,\"suit\":\"clubs\"},{\"rank\":13,\"suit\":\"diamonds\"}],\"chosen\":\"stand\",\"countDependent\":true,\"decision\":\"hand\",\"entered\":0,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":90,\"prescribed\":\"hit\",\"refused\":[],\"resolution\":\"departed\",\"round\":9,\"total\":{\"soft\":false,\"value\":14},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":11,\"suit\":\"clubs\"}},{\"checkpoint\":21,\"count\":\"running\",\"entered\":0,\"error\":3,\"kind\":\"table\",\"position\":92,\"reference\":-3,\"round\":9,\"timing\":\"after-round\"},{\"checkpoint\":22,\"count\":\"running\",\"entered\":0,\"error\":3,\"kind\":\"table\",\"position\":93,\"reference\":-3,\"round\":10,\"timing\":\"before-bet\"},{\"checkpoint\":22,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":94,\"reference\":0,\"round\":10,\"timing\":\"before-bet\"},{\"atEntered\":null,\"cards\":[{\"rank\":9,\"suit\":\"spades\"},{\"rank\":1,\"suit\":\"spades\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":99,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":10,\"total\":{\"soft\":true,\"value\":20},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":9,\"suit\":\"spades\"}},{\"checkpoint\":23,\"count\":\"running\",\"entered\":0,\"error\":5,\"kind\":\"table\",\"position\":101,\"reference\":-5,\"round\":10,\"timing\":\"after-round\"}]}"
    },
    {
      "name": "table Play Learn N=2 with deviations, mid-round after a move",
      "category": "table",
      "phase": "card",
      "specification": {
        "attemptId": "attempt-1",
        "content": {
          "category": "table",
          "id": "table",
          "reference": {
            "id": "blackjack-reference",
            "version": 1
          },
          "rounds": 10,
          "version": 1
        },
        "device": "device-1",
        "owner": "owner-1",
        "table": {
          "baseWager": "10",
          "betSchedule": false,
          "interval": 2,
          "policy": {
            "count": "player",
            "deviations": [
              {
                "atOrAbove": "stand",
                "below": "hit",
                "direction": "deviate-at-or-above",
                "hand": {
                  "kind": "hard",
                  "total": 16
                },
                "id": "16v10",
                "published": {
                  "bja": {
                    "cost": [
                      {
                        "perBet": "+0.0000",
                        "trueCount": 0
                      }
                    ],
                    "difference": 1,
                    "value": "+0"
                  },
                  "schlesinger": {
                    "cost": [
                      {
                        "perBet": "+0.0000",
                        "trueCount": 0
                      }
                    ],
                    "difference": 1,
                    "value": "+0"
                  }
                },
                "set": "illustrious18",
                "situation": "16 vs 10",
                "threshold": 1,
                "up": 10
              },
              {
                "atOrAbove": "double",
                "below": "hit",
                "direction": "deviate-at-or-above",
                "hand": {
                  "kind": "hard",
                  "total": 10
                },
                "id": "10v10",
                "published": {
                  "bja": {
                    "cost": [],
                    "difference": 0,
                    "value": "+4"
                  },
                  "schlesinger": {
                    "cost": [],
                    "difference": 0,
                    "value": "+4"
                  }
                },
                "set": "illustrious18",
                "situation": "10 vs 10",
                "threshold": 4,
                "up": 10
              },
              {
                "atOrAbove": "stand",
                "below": "hit",
                "direction": "deviate-at-or-above",
                "hand": {
                  "kind": "hard",
                  "total": 12
                },
                "id": "12v3",
                "published": {
                  "bja": {
                    "cost": [],
                    "difference": 0,
                    "value": "+2"
                  },
                  "schlesinger": {
                    "cost": [],
                    "difference": 0,
                    "value": "+2"
                  }
                },
                "set": "illustrious18",
                "situation": "12 vs 3",
                "threshold": 2,
                "up": 3
              },
              {
                "atOrAbove": "stand",
                "below": "hit",
                "direction": "basic-at-or-above",
                "hand": {
                  "kind": "hard",
                  "total": 13
                },
                "id": "13v2",
                "published": {
                  "bja": {
                    "cost": [
                      {
                        "perBet": "+0.0072",
                        "trueCount": -1
                      }
                    ],
                    "difference": 1,
                    "value": "-1"
                  },
                  "schlesinger": {
                    "cost": [
                      {
                        "perBet": "+0.0072",
                        "trueCount": -1
                      }
                    ],
                    "difference": 1,
                    "value": "-1"
                  }
                },
                "set": "illustrious18",
                "situation": "13 vs 2",
                "threshold": 0,
                "up": 2
              },
              {
                "atOrAbove": "split",
                "below": "stand",
                "direction": "deviate-at-or-above",
                "hand": {
                  "kind": "pair",
                  "value": 10
                },
                "id": "TTv5",
                "published": {
                  "bja": {
                    "cost": [],
                    "difference": 0,
                    "value": "+5"
                  },
                  "schlesinger": {
                    "cost": [],
                    "difference": 0,
                    "value": "+5"
                  }
                },
                "set": "illustrious18",
                "situation": "T,T vs 5",
                "threshold": 5,
                "up": 5
              },
              {
                "atOrAbove": "split",
                "below": "stand",
                "direction": "deviate-at-or-above",
                "hand": {
                  "kind": "pair",
                  "value": 10
                },
                "id": "TTv6",
                "published": {
                  "bja": {
                    "cost": [
                      {
                        "perBet": "+0.0188",
                        "trueCount": 4
                      }
                    ],
                    "difference": 1,
                    "value": "+4"
                  },
                  "schlesinger": {
                    "cost": [
                      {
                        "perBet": "+0.0188",
                        "trueCount": 4
                      }
                    ],
                    "difference": 1,
                    "value": "+4"
                  }
                },
                "set": "illustrious18",
                "situation": "T,T vs 6",
                "threshold": 5,
                "up": 6
              },
              {
                "atOrAbove": "surrender",
                "below": "basic",
                "direction": "deviate-at-or-above",
                "hand": {
                  "kind": "hard",
                  "total": 14
                },
                "id": "14v10R",
                "published": {
                  "bja": {
                    "cost": [],
                    "difference": 1,
                    "value": "+3"
                  },
                  "schlesinger": {
                    "cost": [],
                    "difference": 1,
                    "value": "+3"
                  }
                },
                "set": "fab4",
                "situation": "14 vs 10 surrender",
                "threshold": 4,
                "up": 10
              },
              {
                "atOrAbove": "surrender",
                "below": "basic",
                "direction": "basic-at-or-above",
                "hand": {
                  "kind": "hard",
                  "total": 15
                },
                "id": "15v10R",
                "published": {
                  "bja": {
                    "cost": [],
                    "difference": 0,
                    "value": "+0"
                  },
                  "schlesinger": {
                    "cost": [],
                    "difference": 0,
                    "value": "+0"
                  }
                },
                "set": "fab4",
                "situation": "15 vs 10 surrender",
                "threshold": 0,
                "up": 10
              },
              {
                "atOrAbove": "insure",
                "below": "decline",
                "direction": "deviate-at-or-above",
                "hand": {
                  "kind": "insurance"
                },
                "id": "insurance",
                "published": {
                  "bja": {
                    "cost": [],
                    "difference": 0,
                    "value": "+3"
                  },
                  "schlesinger": {
                    "cost": [],
                    "difference": 0,
                    "value": "+3"
                  }
                },
                "set": "insurance",
                "situation": "Insurance",
                "threshold": 3,
                "up": 1
              }
            ],
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
                "pair": [
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "SHHHHHSHHS",
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
                "pair": [
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "SHHHHHSHHS",
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
                ]
              },
              "splitByBalance": [
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HSSSSSHHHH",
                "HSSSSSHHHH",
                "RSSSSSHHRR",
                "SSSSSSSSSS",
                "SSSSSSSSSS"
              ],
              "splitByRule": [
                "SSSSSSSSSS",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HDDDDDDDDH",
                "HSSSSSHHHH",
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
                ],
                "soft": [
                  "HHHHHHHHHH",
                  "HHHHDDHHHH",
                  "HHHHDDHHHH",
                  "HHHDDDHHHH",
                  "HHHDDDHHHH",
                  "HHDDDDHHHH",
                  "HSDDDDSSHH",
                  "SSSSSSSSSS",
                  "SSSSSSSSSS"
                ]
              }
            },
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
              ],
              "soft": [
                "HHHHHHHHHH",
                "HHHHDDHHHH",
                "HHHHDDHHHH",
                "HHHDDDHHHH",
                "HHHDDDHHHH",
                "HHDDDDHHHH",
                "HSDDDDSSHH",
                "SSSSSSSSSS",
                "SSSSSSSSSS"
              ]
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
                "HHHHHHHHHH",
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
          },
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
          "seat": "play",
          "startingBalance": "1000"
        },
        "variant": "learn"
      },
      "random": {
        "key": [
          2,
          2654435769
        ],
        "protocol": 1,
        "session": [
          15,
          0
        ]
      },
      "checkpoint": "{\"answers\":[],\"attempt\":{\"device\":\"device-1\",\"id\":\"attempt-1\",\"owner\":\"owner-1\"},\"content\":{\"category\":\"table\",\"id\":\"table\",\"reference\":{\"id\":\"blackjack-reference\",\"version\":1},\"rounds\":10,\"version\":1},\"ending\":null,\"identities\":{\"category\":\"table\",\"content\":{\"id\":\"table\",\"version\":1},\"engine\":\"0.0.0\",\"random\":{\"key\":[2,2654435769],\"protocol\":1,\"session\":[15,0]},\"reference\":{\"id\":\"blackjack-reference\",\"version\":1}},\"items\":[{\"events\":[],\"face\":{\"rank\":10,\"suit\":\"hearts\"},\"round\":1,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":{\"rank\":10,\"suit\":\"hearts\"},\"round\":1,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":4,\"suit\":\"clubs\"},\"round\":1,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":null,\"round\":1,\"step\":\"deal\",\"to\":\"dealer\"},{\"actions\":[\"hit\",\"stand\",\"double\",\"surrender\"],\"decision\":\"hand\",\"events\":[{\"kind\":\"peeked\",\"result\":\"no-blackjack\"}],\"round\":1,\"step\":\"decision\",\"target\":\"hand-1\",\"unaffordable\":[]}],\"phase\":\"card\",\"position\":3,\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[2,2654435769],\"lane\":0,\"protocol\":1,\"session\":[15,0]},\"receipts\":[{\"command\":\"{\\\"kind\\\":\\\"begin\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3}],\"rejected\":0,\"revealedAt\":null,\"schema\":13,\"sequence\":4,\"table\":{\"round\":1,\"seat\":{\"activity\":{\"activity\":{\"device\":\"device-1\",\"id\":\"attempt-1/seat\",\"owner\":\"owner-1\"},\"balance\":\"990\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"0\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"blackjack\",\"random\":{\"key\":[2,2654435769],\"protocol\":1,\"session\":[15,0]},\"reference\":{\"id\":\"blackjack-reference\",\"version\":1},\"rules\":{\"id\":\"blackjack-six-deck\",\"version\":1},\"strategy\":null},\"outcome\":{\"active\":0,\"dealer\":[{\"deck\":3,\"rank\":10,\"suit\":\"hearts\"},{\"deck\":4,\"rank\":11,\"suit\":\"diamonds\"}],\"hands\":[{\"cards\":[{\"deck\":4,\"rank\":10,\"suit\":\"hearts\"},{\"deck\":3,\"rank\":4,\"suit\":\"clubs\"}],\"done\":false,\"doubled\":false,\"surrendered\":false,\"target\":\"hand-1\"}],\"holeRevealed\":false,\"insurance\":\"not-offered\",\"others\":[],\"peek\":\"no-blackjack\"},\"phase\":\"open-decision\",\"random\":{\"block\":[77,0],\"exhausted\":false,\"key\":[2,2654435769],\"lane\":3,\"protocol\":1,\"session\":[15,0]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"hand-1\\\"}\",\"commandId\":\"seat-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"seat-1\",\"disposition\":\"applied\",\"sequence\":1}],\"rules\":{\"dealer\":\"S17\",\"decks\":6,\"lateSurrender\":true,\"limits\":{\"initial\":{\"max\":\"1000\",\"min\":\"10\"}},\"penetration\":75,\"players\":{\"learnerSeat\":0,\"otherWagers\":[],\"strategy\":null}},\"schema\":13,\"sequence\":2,\"shoe\":{\"cut\":234,\"next\":4,\"order\":[243,191,159,231,102,281,194,46,212,201,14,245,126,248,280,308,286,310,43,238,192,219,93,163,71,52,230,114,67,252,34,157,165,91,24,294,178,189,141,302,132,31,2,206,226,172,101,193,227,0,177,158,150,82,210,171,190,80,255,113,149,254,103,145,128,35,169,22,83,76,197,50,48,106,70,217,42,148,133,49,183,110,89,309,154,47,295,237,27,202,200,20,140,256,299,143,6,198,17,9,234,235,162,203,179,300,167,304,269,32,33,39,88,218,205,268,275,292,207,242,44,53,187,213,19,144,208,152,60,311,95,303,175,285,274,72,21,75,142,209,153,85,289,246,137,7,109,79,77,266,40,62,38,146,166,174,263,125,97,65,130,12,4,259,112,68,115,23,78,287,257,29,224,276,258,138,41,3,156,105,26,186,37,214,36,56,73,282,220,250,81,240,278,305,160,108,161,265,247,184,273,59,173,260,293,129,216,301,64,199,180,176,233,147,18,225,136,28,54,288,99,168,69,244,272,119,86,15,117,90,283,232,262,124,87,267,270,84,131,307,45,118,116,151,271,66,253,25,251,74,120,58,164,291,188,13,228,121,204,215,123,104,223,306,298,155,11,10,134,139,107,57,51,5,236,222,16,284,264,98,30,185,96,100,261,135,211,92,241,61,290,229,111,296,94,221,249,195,277,122,127,8,63,297,239,170,1,279,196,55,181,182]},\"strategy\":null,\"turn\":1,\"wagers\":[{\"amount\":\"10\",\"target\":\"hand-1\"}]},\"betCorrection\":null,\"bets\":[],\"correction\":null,\"decisions\":[{\"attempts\":[],\"explanation\":{\"cell\":{\"hand\":14,\"kind\":\"hard\",\"play\":\"hit\",\"table\":\"first\",\"up\":10},\"deviation\":{\"atOrAbove\":\"surrender\",\"below\":\"basic\",\"direction\":\"deviate-at-or-above\",\"hand\":{\"kind\":\"hard\",\"total\":14},\"id\":\"14v10R\",\"play\":\"basic\",\"published\":{\"bja\":{\"cost\":[],\"difference\":1,\"value\":\"+3\"},\"schlesinger\":{\"cost\":[],\"difference\":1,\"value\":\"+3\"}},\"set\":\"fab4\",\"side\":\"below\",\"situation\":\"14 vs 10 surrender\",\"threshold\":4,\"up\":10},\"ifUnaffordable\":null,\"kind\":\"play\",\"preferred\":\"hit\",\"prescribed\":{\"action\":\"hit\",\"amount\":null},\"situation\":{\"available\":\"990\",\"cards\":[{\"deck\":4,\"rank\":10,\"suit\":\"hearts\"},{\"deck\":3,\"rank\":4,\"suit\":\"clubs\"}],\"count\":{\"decks\":\"6\",\"running\":-1,\"trueCount\":0},\"decision\":\"hand\",\"hand\":0,\"hands\":1,\"original\":true,\"pair\":false,\"stake\":\"10\",\"target\":\"hand-1\",\"total\":{\"soft\":false,\"value\":14},\"up\":{\"deck\":3,\"rank\":10,\"suit\":\"hearts\"}},\"unavailable\":[]},\"played\":null,\"position\":4,\"prompt\":null,\"resolution\":null}],\"ledger\":[{\"balance\":\"990\",\"change\":\"wager\",\"net\":null,\"position\":0,\"round\":1,\"wager\":\"10\"}]},\"setup\":{\"baseWager\":\"10\",\"betSchedule\":false,\"interval\":2,\"policy\":{\"count\":\"player\",\"deviations\":[{\"atOrAbove\":\"stand\",\"below\":\"hit\",\"direction\":\"deviate-at-or-above\",\"hand\":{\"kind\":\"hard\",\"total\":16},\"id\":\"16v10\",\"published\":{\"bja\":{\"cost\":[{\"perBet\":\"+0.0000\",\"trueCount\":0}],\"difference\":1,\"value\":\"+0\"},\"schlesinger\":{\"cost\":[{\"perBet\":\"+0.0000\",\"trueCount\":0}],\"difference\":1,\"value\":\"+0\"}},\"set\":\"illustrious18\",\"situation\":\"16 vs 10\",\"threshold\":1,\"up\":10},{\"atOrAbove\":\"double\",\"below\":\"hit\",\"direction\":\"deviate-at-or-above\",\"hand\":{\"kind\":\"hard\",\"total\":10},\"id\":\"10v10\",\"published\":{\"bja\":{\"cost\":[],\"difference\":0,\"value\":\"+4\"},\"schlesinger\":{\"cost\":[],\"difference\":0,\"value\":\"+4\"}},\"set\":\"illustrious18\",\"situation\":\"10 vs 10\",\"threshold\":4,\"up\":10},{\"atOrAbove\":\"stand\",\"below\":\"hit\",\"direction\":\"deviate-at-or-above\",\"hand\":{\"kind\":\"hard\",\"total\":12},\"id\":\"12v3\",\"published\":{\"bja\":{\"cost\":[],\"difference\":0,\"value\":\"+2\"},\"schlesinger\":{\"cost\":[],\"difference\":0,\"value\":\"+2\"}},\"set\":\"illustrious18\",\"situation\":\"12 vs 3\",\"threshold\":2,\"up\":3},{\"atOrAbove\":\"stand\",\"below\":\"hit\",\"direction\":\"basic-at-or-above\",\"hand\":{\"kind\":\"hard\",\"total\":13},\"id\":\"13v2\",\"published\":{\"bja\":{\"cost\":[{\"perBet\":\"+0.0072\",\"trueCount\":-1}],\"difference\":1,\"value\":\"-1\"},\"schlesinger\":{\"cost\":[{\"perBet\":\"+0.0072\",\"trueCount\":-1}],\"difference\":1,\"value\":\"-1\"}},\"set\":\"illustrious18\",\"situation\":\"13 vs 2\",\"threshold\":0,\"up\":2},{\"atOrAbove\":\"split\",\"below\":\"stand\",\"direction\":\"deviate-at-or-above\",\"hand\":{\"kind\":\"pair\",\"value\":10},\"id\":\"TTv5\",\"published\":{\"bja\":{\"cost\":[],\"difference\":0,\"value\":\"+5\"},\"schlesinger\":{\"cost\":[],\"difference\":0,\"value\":\"+5\"}},\"set\":\"illustrious18\",\"situation\":\"T,T vs 5\",\"threshold\":5,\"up\":5},{\"atOrAbove\":\"split\",\"below\":\"stand\",\"direction\":\"deviate-at-or-above\",\"hand\":{\"kind\":\"pair\",\"value\":10},\"id\":\"TTv6\",\"published\":{\"bja\":{\"cost\":[{\"perBet\":\"+0.0188\",\"trueCount\":4}],\"difference\":1,\"value\":\"+4\"},\"schlesinger\":{\"cost\":[{\"perBet\":\"+0.0188\",\"trueCount\":4}],\"difference\":1,\"value\":\"+4\"}},\"set\":\"illustrious18\",\"situation\":\"T,T vs 6\",\"threshold\":5,\"up\":6},{\"atOrAbove\":\"surrender\",\"below\":\"basic\",\"direction\":\"deviate-at-or-above\",\"hand\":{\"kind\":\"hard\",\"total\":14},\"id\":\"14v10R\",\"published\":{\"bja\":{\"cost\":[],\"difference\":1,\"value\":\"+3\"},\"schlesinger\":{\"cost\":[],\"difference\":1,\"value\":\"+3\"}},\"set\":\"fab4\",\"situation\":\"14 vs 10 surrender\",\"threshold\":4,\"up\":10},{\"atOrAbove\":\"surrender\",\"below\":\"basic\",\"direction\":\"basic-at-or-above\",\"hand\":{\"kind\":\"hard\",\"total\":15},\"id\":\"15v10R\",\"published\":{\"bja\":{\"cost\":[],\"difference\":0,\"value\":\"+0\"},\"schlesinger\":{\"cost\":[],\"difference\":0,\"value\":\"+0\"}},\"set\":\"fab4\",\"situation\":\"15 vs 10 surrender\",\"threshold\":0,\"up\":10},{\"atOrAbove\":\"insure\",\"below\":\"decline\",\"direction\":\"deviate-at-or-above\",\"hand\":{\"kind\":\"insurance\"},\"id\":\"insurance\",\"published\":{\"bja\":{\"cost\":[],\"difference\":0,\"value\":\"+3\"},\"schlesinger\":{\"cost\":[],\"difference\":0,\"value\":\"+3\"}},\"set\":\"insurance\",\"situation\":\"Insurance\",\"threshold\":3,\"up\":1}],\"fallbacks\":{\"double\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SHHHHHSHHS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"doubleOnOriginalLateSurrender\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHR\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SHHHHHSHHS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"splitByBalance\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"splitByRule\":[\"SSSSSSSSSS\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"surrender\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"PPPPPPPPPP\",\"HPPPPPPHHH\",\"HPPPPPPHHH\",\"HHHHPPHHHH\",\"HDDDDDDDDH\",\"HPPPPPHHHH\",\"HPPPPPPHHH\",\"PPPPPPPPPP\",\"SPPPPPSPPS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]}},\"first\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHR\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"PPPPPPPPPP\",\"HPPPPPPHHH\",\"HPPPPPPHHH\",\"HHHHPPHHHH\",\"HDDDDDDDDH\",\"HPPPPPHHHH\",\"HPPPPPPHHH\",\"PPPPPPPPPP\",\"SPPPPPSPPS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"later\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"laterWithoutDouble\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]}},\"rules\":{\"dealer\":\"S17\",\"decks\":6,\"id\":\"blackjack-six-deck\",\"lateSurrender\":true,\"limits\":{\"initial\":{\"max\":\"1000\",\"min\":\"10\"}},\"penetration\":75,\"players\":{\"learnerSeat\":0,\"otherWagers\":[],\"strategy\":null},\"version\":1},\"seat\":\"play\",\"startingBalance\":\"1000\"},\"shoe\":null},\"variant\":\"learn\"}",
      "continuation": [
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "override-correction"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "override-correction"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "override-correction"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "override-correction"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        }
      ],
      "facts": "[{\"kind\":\"correction-offered\",\"position\":4},{\"kind\":\"content-shown\",\"position\":5},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":5},{\"kind\":\"content-shown\",\"position\":6},{\"kind\":\"wager-placed\",\"position\":6},{\"kind\":\"content-shown\",\"position\":7},{\"kind\":\"content-shown\",\"position\":8},{\"kind\":\"content-shown\",\"position\":9},{\"kind\":\"content-shown\",\"position\":11},{\"kind\":\"round-settled\",\"net\":\"10\",\"position\":11},{\"kind\":\"checkpoint-due\",\"position\":12},{\"kind\":\"answer-accepted\",\"position\":12,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":13,\"scored\":true},{\"kind\":\"content-shown\",\"position\":14},{\"kind\":\"wager-placed\",\"position\":14},{\"kind\":\"content-shown\",\"position\":15},{\"kind\":\"content-shown\",\"position\":16},{\"kind\":\"content-shown\",\"position\":17},{\"kind\":\"correction-offered\",\"position\":18},{\"kind\":\"content-shown\",\"position\":19},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":19},{\"kind\":\"content-shown\",\"position\":20},{\"kind\":\"wager-placed\",\"position\":20},{\"kind\":\"content-shown\",\"position\":21},{\"kind\":\"content-shown\",\"position\":22},{\"kind\":\"content-shown\",\"position\":23},{\"kind\":\"content-shown\",\"position\":25},{\"kind\":\"content-shown\",\"position\":26},{\"kind\":\"content-shown\",\"position\":27},{\"kind\":\"round-settled\",\"net\":\"10\",\"position\":27},{\"kind\":\"checkpoint-due\",\"position\":28},{\"kind\":\"answer-accepted\",\"position\":28,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":29,\"scored\":true},{\"kind\":\"content-shown\",\"position\":30},{\"kind\":\"wager-placed\",\"position\":30},{\"kind\":\"content-shown\",\"position\":31},{\"kind\":\"content-shown\",\"position\":32},{\"kind\":\"content-shown\",\"position\":33},{\"kind\":\"content-shown\",\"position\":35},{\"kind\":\"content-shown\",\"position\":36},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":36},{\"kind\":\"content-shown\",\"position\":37},{\"kind\":\"wager-placed\",\"position\":37},{\"kind\":\"content-shown\",\"position\":38},{\"kind\":\"content-shown\",\"position\":39},{\"kind\":\"content-shown\",\"position\":40},{\"kind\":\"content-shown\",\"position\":42},{\"kind\":\"round-settled\",\"net\":\"10\",\"position\":42},{\"kind\":\"checkpoint-due\",\"position\":43},{\"kind\":\"answer-accepted\",\"position\":43,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":44,\"scored\":true},{\"kind\":\"content-shown\",\"position\":45},{\"kind\":\"wager-placed\",\"position\":45},{\"kind\":\"content-shown\",\"position\":46},{\"kind\":\"content-shown\",\"position\":47},{\"kind\":\"content-shown\",\"position\":48},{\"kind\":\"content-shown\",\"position\":50},{\"kind\":\"content-shown\",\"position\":51},{\"kind\":\"content-shown\",\"position\":52},{\"kind\":\"round-settled\",\"net\":\"10\",\"position\":52},{\"kind\":\"content-shown\",\"position\":53},{\"kind\":\"wager-placed\",\"position\":53},{\"kind\":\"content-shown\",\"position\":54},{\"kind\":\"content-shown\",\"position\":55},{\"kind\":\"content-shown\",\"position\":56},{\"kind\":\"content-shown\",\"position\":58},{\"kind\":\"round-settled\",\"net\":\"0\",\"position\":58},{\"kind\":\"checkpoint-due\",\"position\":59},{\"kind\":\"answer-accepted\",\"position\":59,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":60,\"scored\":true},{\"kind\":\"content-shown\",\"position\":61},{\"kind\":\"wager-placed\",\"position\":61},{\"kind\":\"content-shown\",\"position\":62},{\"kind\":\"content-shown\",\"position\":63},{\"kind\":\"content-shown\",\"position\":64},{\"kind\":\"correction-offered\",\"position\":65},{\"kind\":\"content-shown\",\"position\":66},{\"kind\":\"content-shown\",\"position\":67},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":67},{\"kind\":\"content-shown\",\"position\":68},{\"kind\":\"wager-placed\",\"position\":68},{\"kind\":\"content-shown\",\"position\":69},{\"kind\":\"content-shown\",\"position\":70},{\"kind\":\"content-shown\",\"position\":71},{\"kind\":\"correction-offered\",\"position\":72},{\"kind\":\"content-shown\",\"position\":73},{\"kind\":\"content-shown\",\"position\":74},{\"kind\":\"round-settled\",\"net\":\"10\",\"position\":74},{\"kind\":\"checkpoint-due\",\"position\":75},{\"kind\":\"answer-accepted\",\"position\":75,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":76,\"scored\":true},{\"ending\":\"completed\",\"kind\":\"attempt-ended\"}]",
      "results": "{\"assistanceStep\":null,\"assisted\":true,\"ending\":\"completed\",\"finances\":{\"finishingBalance\":\"1010\",\"net\":\"10\",\"startingBalance\":\"1000\"},\"metrics\":{\"betting-adherence\":null,\"card-values\":null,\"playing-adherence\":{\"correct\":6,\"total\":10},\"running-count\":{\"correct\":0,\"total\":5},\"true-count\":{\"correct\":1,\"total\":5}},\"review\":[{\"atEntered\":null,\"cards\":[{\"rank\":10,\"suit\":\"hearts\"},{\"rank\":4,\"suit\":\"clubs\"}],\"chosen\":\"stand\",\"countDependent\":true,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":5,\"prescribed\":\"hit\",\"refused\":[],\"resolution\":\"overridden\",\"round\":1,\"total\":{\"soft\":false,\"value\":14},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":10,\"suit\":\"hearts\"}},{\"atEntered\":null,\"cards\":[{\"rank\":12,\"suit\":\"spades\"},{\"rank\":13,\"suit\":\"hearts\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":true,\"played\":\"stand\",\"position\":11,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":2,\"total\":{\"soft\":false,\"value\":20},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":9,\"suit\":\"diamonds\"}},{\"checkpoint\":1,\"count\":\"running\",\"entered\":0,\"error\":4,\"kind\":\"table\",\"position\":13,\"reference\":-4,\"round\":2,\"timing\":\"block\"},{\"checkpoint\":1,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":14,\"reference\":0,\"round\":2,\"timing\":\"block\"},{\"atEntered\":null,\"cards\":[{\"rank\":5,\"suit\":\"clubs\"},{\"rank\":2,\"suit\":\"diamonds\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":19,\"prescribed\":\"hit\",\"refused\":[],\"resolution\":\"overridden\",\"round\":3,\"total\":{\"soft\":false,\"value\":7},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":7,\"suit\":\"spades\"}},{\"atEntered\":null,\"cards\":[{\"rank\":10,\"suit\":\"diamonds\"},{\"rank\":8,\"suit\":\"diamonds\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":25,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":4,\"total\":{\"soft\":false,\"value\":18},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":2,\"suit\":\"spades\"}},{\"checkpoint\":2,\"count\":\"running\",\"entered\":0,\"error\":6,\"kind\":\"table\",\"position\":29,\"reference\":-6,\"round\":4,\"timing\":\"block\"},{\"checkpoint\":2,\"count\":\"true\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":30,\"reference\":-1,\"round\":4,\"timing\":\"block\"},{\"atEntered\":null,\"cards\":[{\"rank\":5,\"suit\":\"spades\"},{\"rank\":11,\"suit\":\"hearts\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":35,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":5,\"total\":{\"soft\":false,\"value\":15},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":5,\"suit\":\"hearts\"}},{\"atEntered\":null,\"cards\":[{\"rank\":8,\"suit\":\"clubs\"},{\"rank\":1,\"suit\":\"clubs\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":42,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":6,\"total\":{\"soft\":true,\"value\":19},\"trueCount\":-1,\"unaffordable\":[],\"up\":{\"rank\":7,\"suit\":\"diamonds\"}},{\"checkpoint\":3,\"count\":\"running\",\"entered\":0,\"error\":7,\"kind\":\"table\",\"position\":44,\"reference\":-7,\"round\":6,\"timing\":\"block\"},{\"checkpoint\":3,\"count\":\"true\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":45,\"reference\":-1,\"round\":6,\"timing\":\"block\"},{\"atEntered\":null,\"cards\":[{\"rank\":11,\"suit\":\"clubs\"},{\"rank\":6,\"suit\":\"spades\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":50,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":7,\"total\":{\"soft\":false,\"value\":16},\"trueCount\":-1,\"unaffordable\":[],\"up\":{\"rank\":3,\"suit\":\"diamonds\"}},{\"atEntered\":null,\"cards\":[{\"rank\":1,\"suit\":\"spades\"},{\"rank\":9,\"suit\":\"hearts\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":58,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":8,\"total\":{\"soft\":true,\"value\":20},\"trueCount\":-1,\"unaffordable\":[],\"up\":{\"rank\":12,\"suit\":\"diamonds\"}},{\"checkpoint\":4,\"count\":\"running\",\"entered\":0,\"error\":9,\"kind\":\"table\",\"position\":60,\"reference\":-9,\"round\":8,\"timing\":\"block\"},{\"checkpoint\":4,\"count\":\"true\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":61,\"reference\":-1,\"round\":8,\"timing\":\"block\"},{\"atEntered\":null,\"cards\":[{\"rank\":8,\"suit\":\"hearts\"},{\"rank\":4,\"suit\":\"spades\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":66,\"prescribed\":\"hit\",\"refused\":[],\"resolution\":\"overridden\",\"round\":9,\"total\":{\"soft\":false,\"value\":12},\"trueCount\":-1,\"unaffordable\":[],\"up\":{\"rank\":12,\"suit\":\"hearts\"}},{\"atEntered\":null,\"cards\":[{\"rank\":3,\"suit\":\"clubs\"},{\"rank\":6,\"suit\":\"diamonds\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":73,\"prescribed\":\"hit\",\"refused\":[],\"resolution\":\"overridden\",\"round\":10,\"total\":{\"soft\":false,\"value\":9},\"trueCount\":-1,\"unaffordable\":[],\"up\":{\"rank\":12,\"suit\":\"spades\"}},{\"checkpoint\":5,\"count\":\"running\",\"entered\":0,\"error\":6,\"kind\":\"table\",\"position\":76,\"reference\":-6,\"round\":10,\"timing\":\"block\"},{\"checkpoint\":5,\"count\":\"true\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":77,\"reference\":-1,\"round\":10,\"timing\":\"block\"}]}"
    },
    {
      "name": "table Play Check N=1 with the bet schedule, choosing the opening wager",
      "category": "table",
      "phase": "bet",
      "specification": {
        "attemptId": "attempt-1",
        "content": {
          "category": "table",
          "id": "table",
          "reference": {
            "id": "blackjack-reference",
            "version": 1
          },
          "rounds": 10,
          "version": 1
        },
        "device": "device-1",
        "owner": "owner-1",
        "table": {
          "baseWager": "10",
          "betSchedule": true,
          "interval": 1,
          "policy": {
            "count": "player",
            "deviations": [],
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
                "pair": [
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "SHHHHHSHHS",
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
                "pair": [
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "SHHHHHSHHS",
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
                ]
              },
              "splitByBalance": [
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HSSSSSHHHH",
                "HSSSSSHHHH",
                "RSSSSSHHRR",
                "SSSSSSSSSS",
                "SSSSSSSSSS"
              ],
              "splitByRule": [
                "SSSSSSSSSS",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HDDDDDDDDH",
                "HSSSSSHHHH",
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
                ],
                "soft": [
                  "HHHHHHHHHH",
                  "HHHHDDHHHH",
                  "HHHHDDHHHH",
                  "HHHDDDHHHH",
                  "HHHDDDHHHH",
                  "HHDDDDHHHH",
                  "HSDDDDSSHH",
                  "SSSSSSSSSS",
                  "SSSSSSSSSS"
                ]
              }
            },
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
              ],
              "soft": [
                "HHHHHHHHHH",
                "HHHHDDHHHH",
                "HHHHDDHHHH",
                "HHHDDDHHHH",
                "HHHDDDHHHH",
                "HHDDDDHHHH",
                "HSDDDDSSHH",
                "SSSSSSSSSS",
                "SSSSSSSSSS"
              ]
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
                "HHHHHHHHHH",
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
          },
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
          "seat": "play",
          "startingBalance": "1000"
        },
        "variant": "check"
      },
      "random": {
        "key": [
          1,
          2654435769
        ],
        "protocol": 1,
        "session": [
          8,
          0
        ]
      },
      "checkpoint": "{\"answers\":[{\"first\":0,\"last\":0,\"position\":0,\"tries\":1},{\"first\":0,\"last\":0,\"position\":1,\"tries\":1}],\"attempt\":{\"device\":\"device-1\",\"id\":\"attempt-1\",\"owner\":\"owner-1\"},\"content\":{\"category\":\"table\",\"id\":\"table\",\"reference\":{\"id\":\"blackjack-reference\",\"version\":1},\"rounds\":10,\"version\":1},\"ending\":null,\"identities\":{\"category\":\"table\",\"content\":{\"id\":\"table\",\"version\":1},\"engine\":\"0.0.0\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":{\"id\":\"blackjack-reference\",\"version\":1}},\"items\":[{\"checkpoint\":1,\"count\":\"running\",\"round\":1,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"checkpoint\":1,\"count\":\"true\",\"round\":1,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"amounts\":[\"10\",\"20\",\"40\",\"60\",\"80\"],\"funding\":false,\"round\":1,\"step\":\"bet\"}],\"phase\":\"bet\",\"position\":2,\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":0,\"protocol\":1,\"session\":[8,0]},\"receipts\":[{\"command\":\"{\\\"kind\\\":\\\"begin\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-4\",\"disposition\":\"applied\",\"sequence\":4}],\"rejected\":0,\"revealedAt\":null,\"schema\":13,\"sequence\":5,\"table\":{\"round\":1,\"seat\":{\"activity\":{\"activity\":{\"device\":\"device-1\",\"id\":\"attempt-1/seat\",\"owner\":\"owner-1\"},\"balance\":\"1000\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"0\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"blackjack\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":{\"id\":\"blackjack-reference\",\"version\":1},\"rules\":{\"id\":\"blackjack-six-deck\",\"version\":1},\"strategy\":null},\"outcome\":null,\"phase\":\"open-decision\",\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":0,\"protocol\":1,\"session\":[8,0]},\"receipts\":[],\"rules\":{\"dealer\":\"S17\",\"decks\":6,\"lateSurrender\":true,\"limits\":{\"initial\":{\"max\":\"1000\",\"min\":\"10\"}},\"penetration\":75,\"players\":{\"learnerSeat\":0,\"otherWagers\":[],\"strategy\":null}},\"schema\":13,\"sequence\":0,\"shoe\":null,\"strategy\":null,\"turn\":0,\"wagers\":[]},\"betCorrection\":null,\"bets\":[{\"chosen\":null,\"funding\":false,\"placed\":null,\"position\":2,\"prescribed\":\"10\",\"resolution\":null,\"round\":1,\"trueCount\":0}],\"correction\":null,\"decisions\":[],\"ledger\":[]},\"setup\":{\"baseWager\":\"10\",\"betSchedule\":true,\"interval\":1,\"policy\":{\"count\":\"player\",\"deviations\":[],\"fallbacks\":{\"double\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SHHHHHSHHS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"doubleOnOriginalLateSurrender\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHR\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SHHHHHSHHS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"splitByBalance\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"splitByRule\":[\"SSSSSSSSSS\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"surrender\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"PPPPPPPPPP\",\"HPPPPPPHHH\",\"HPPPPPPHHH\",\"HHHHPPHHHH\",\"HDDDDDDDDH\",\"HPPPPPHHHH\",\"HPPPPPPHHH\",\"PPPPPPPPPP\",\"SPPPPPSPPS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]}},\"first\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHR\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"PPPPPPPPPP\",\"HPPPPPPHHH\",\"HPPPPPPHHH\",\"HHHHPPHHHH\",\"HDDDDDDDDH\",\"HPPPPPHHHH\",\"HPPPPPPHHH\",\"PPPPPPPPPP\",\"SPPPPPSPPS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"later\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"laterWithoutDouble\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]}},\"rules\":{\"dealer\":\"S17\",\"decks\":6,\"id\":\"blackjack-six-deck\",\"lateSurrender\":true,\"limits\":{\"initial\":{\"max\":\"1000\",\"min\":\"10\"}},\"penetration\":75,\"players\":{\"learnerSeat\":0,\"otherWagers\":[],\"strategy\":null},\"version\":1},\"seat\":\"play\",\"startingBalance\":\"1000\"},\"shoe\":null},\"variant\":\"check\"}",
      "continuation": [
        {
          "kind": "bet",
          "amount": "10"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "bet",
          "amount": "10"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "bet",
          "amount": "10"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "decline-insurance"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "bet",
          "amount": "10"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "bet",
          "amount": "10"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "bet",
          "amount": "10"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "bet",
          "amount": "10"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "decline-insurance"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "bet",
          "amount": "10"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "bet",
          "amount": "10"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "bet",
          "amount": "10"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        }
      ],
      "facts": "[{\"kind\":\"content-shown\",\"position\":3},{\"kind\":\"wager-placed\",\"position\":3},{\"kind\":\"content-shown\",\"position\":4},{\"kind\":\"content-shown\",\"position\":5},{\"kind\":\"content-shown\",\"position\":6},{\"kind\":\"content-shown\",\"position\":8},{\"kind\":\"content-shown\",\"position\":9},{\"kind\":\"content-shown\",\"position\":10},{\"kind\":\"content-shown\",\"position\":11},{\"kind\":\"round-settled\",\"net\":\"10\",\"position\":11},{\"kind\":\"checkpoint-due\",\"position\":12},{\"kind\":\"answer-accepted\",\"position\":12,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":13},{\"kind\":\"answer-accepted\",\"position\":13,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":14,\"scored\":true},{\"kind\":\"content-shown\",\"position\":16},{\"kind\":\"wager-placed\",\"position\":16},{\"kind\":\"content-shown\",\"position\":17},{\"kind\":\"content-shown\",\"position\":18},{\"kind\":\"content-shown\",\"position\":19},{\"kind\":\"content-shown\",\"position\":21},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":21},{\"kind\":\"checkpoint-due\",\"position\":22},{\"kind\":\"answer-accepted\",\"position\":22,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":23},{\"kind\":\"answer-accepted\",\"position\":23,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":24,\"scored\":true},{\"kind\":\"content-shown\",\"position\":26},{\"kind\":\"wager-placed\",\"position\":26},{\"kind\":\"content-shown\",\"position\":27},{\"kind\":\"content-shown\",\"position\":28},{\"kind\":\"content-shown\",\"position\":29},{\"kind\":\"content-shown\",\"position\":32},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":32},{\"kind\":\"checkpoint-due\",\"position\":33},{\"kind\":\"answer-accepted\",\"position\":33,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":34},{\"kind\":\"answer-accepted\",\"position\":34,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":35,\"scored\":true},{\"kind\":\"content-shown\",\"position\":37},{\"kind\":\"wager-placed\",\"position\":37},{\"kind\":\"content-shown\",\"position\":38},{\"kind\":\"content-shown\",\"position\":39},{\"kind\":\"content-shown\",\"position\":40},{\"kind\":\"content-shown\",\"position\":42},{\"kind\":\"content-shown\",\"position\":43},{\"kind\":\"round-settled\",\"net\":\"10\",\"position\":43},{\"kind\":\"checkpoint-due\",\"position\":44},{\"kind\":\"answer-accepted\",\"position\":44,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":45},{\"kind\":\"answer-accepted\",\"position\":45,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":46,\"scored\":true},{\"kind\":\"content-shown\",\"position\":48},{\"kind\":\"wager-placed\",\"position\":48},{\"kind\":\"content-shown\",\"position\":49},{\"kind\":\"content-shown\",\"position\":50},{\"kind\":\"content-shown\",\"position\":51},{\"kind\":\"content-shown\",\"position\":53},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":53},{\"kind\":\"checkpoint-due\",\"position\":54},{\"kind\":\"answer-accepted\",\"position\":54,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":55},{\"kind\":\"answer-accepted\",\"position\":55,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":56,\"scored\":true},{\"kind\":\"content-shown\",\"position\":58},{\"kind\":\"wager-placed\",\"position\":58},{\"kind\":\"content-shown\",\"position\":59},{\"kind\":\"content-shown\",\"position\":60},{\"kind\":\"content-shown\",\"position\":61},{\"kind\":\"content-shown\",\"position\":63},{\"kind\":\"content-shown\",\"position\":64},{\"kind\":\"content-shown\",\"position\":65},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":65},{\"kind\":\"checkpoint-due\",\"position\":66},{\"kind\":\"answer-accepted\",\"position\":66,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":67},{\"kind\":\"answer-accepted\",\"position\":67,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":68,\"scored\":true},{\"kind\":\"content-shown\",\"position\":70},{\"kind\":\"wager-placed\",\"position\":70},{\"kind\":\"content-shown\",\"position\":71},{\"kind\":\"content-shown\",\"position\":72},{\"kind\":\"content-shown\",\"position\":73},{\"kind\":\"content-shown\",\"position\":75},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":75},{\"kind\":\"checkpoint-due\",\"position\":76},{\"kind\":\"answer-accepted\",\"position\":76,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":77},{\"kind\":\"answer-accepted\",\"position\":77,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":78,\"scored\":true},{\"kind\":\"content-shown\",\"position\":80},{\"kind\":\"wager-placed\",\"position\":80},{\"kind\":\"content-shown\",\"position\":81},{\"kind\":\"content-shown\",\"position\":82},{\"kind\":\"content-shown\",\"position\":83},{\"kind\":\"content-shown\",\"position\":85},{\"kind\":\"content-shown\",\"position\":86},{\"kind\":\"round-settled\",\"net\":\"10\",\"position\":86},{\"kind\":\"checkpoint-due\",\"position\":87},{\"kind\":\"answer-accepted\",\"position\":87,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":88},{\"kind\":\"answer-accepted\",\"position\":88,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":89,\"scored\":true},{\"kind\":\"content-shown\",\"position\":91},{\"kind\":\"wager-placed\",\"position\":91},{\"kind\":\"content-shown\",\"position\":92},{\"kind\":\"content-shown\",\"position\":93},{\"kind\":\"content-shown\",\"position\":94},{\"kind\":\"content-shown\",\"position\":96},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":96},{\"kind\":\"checkpoint-due\",\"position\":97},{\"kind\":\"answer-accepted\",\"position\":97,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":98},{\"kind\":\"answer-accepted\",\"position\":98,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":99,\"scored\":true},{\"kind\":\"content-shown\",\"position\":101},{\"kind\":\"wager-placed\",\"position\":101},{\"kind\":\"content-shown\",\"position\":102},{\"kind\":\"content-shown\",\"position\":103},{\"kind\":\"content-shown\",\"position\":104},{\"kind\":\"content-shown\",\"position\":106},{\"kind\":\"round-settled\",\"net\":\"10\",\"position\":106},{\"kind\":\"checkpoint-due\",\"position\":107},{\"kind\":\"answer-accepted\",\"position\":107,\"scored\":true},{\"ending\":\"completed\",\"kind\":\"attempt-ended\"}]",
      "results": "{\"assistanceStep\":null,\"assisted\":false,\"ending\":\"completed\",\"finances\":{\"finishingBalance\":\"980\",\"net\":\"-20\",\"startingBalance\":\"1000\"},\"metrics\":{\"betting-adherence\":{\"correct\":10,\"total\":10},\"card-values\":null,\"playing-adherence\":{\"correct\":7,\"total\":11},\"running-count\":{\"correct\":3,\"total\":20},\"true-count\":{\"correct\":10,\"total\":10}},\"review\":[{\"checkpoint\":1,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":1,\"reference\":0,\"round\":1,\"timing\":\"before-bet\"},{\"checkpoint\":1,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":2,\"reference\":0,\"round\":1,\"timing\":\"before-bet\"},{\"chosen\":\"10\",\"kind\":\"table-bet\",\"override\":false,\"placed\":\"10\",\"position\":3,\"prescribed\":\"10\",\"resolution\":\"followed\",\"round\":1,\"trueCount\":0},{\"atEntered\":null,\"cards\":[{\"rank\":13,\"suit\":\"diamonds\"},{\"rank\":4,\"suit\":\"clubs\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":8,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":1,\"total\":{\"soft\":false,\"value\":14},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":3,\"suit\":\"hearts\"}},{\"checkpoint\":2,\"count\":\"running\",\"entered\":0,\"error\":-3,\"kind\":\"table\",\"position\":13,\"reference\":3,\"round\":1,\"timing\":\"after-round\"},{\"checkpoint\":3,\"count\":\"running\",\"entered\":0,\"error\":-3,\"kind\":\"table\",\"position\":14,\"reference\":3,\"round\":2,\"timing\":\"before-bet\"},{\"checkpoint\":3,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":15,\"reference\":0,\"round\":2,\"timing\":\"before-bet\"},{\"chosen\":\"10\",\"kind\":\"table-bet\",\"override\":false,\"placed\":\"10\",\"position\":16,\"prescribed\":\"10\",\"resolution\":\"followed\",\"round\":2,\"trueCount\":0},{\"atEntered\":null,\"cards\":[{\"rank\":11,\"suit\":\"diamonds\"},{\"rank\":7,\"suit\":\"spades\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":21,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":2,\"total\":{\"soft\":false,\"value\":17},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":13,\"suit\":\"clubs\"}},{\"checkpoint\":4,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":23,\"reference\":0,\"round\":2,\"timing\":\"after-round\"},{\"checkpoint\":5,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":24,\"reference\":0,\"round\":3,\"timing\":\"before-bet\"},{\"checkpoint\":5,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":25,\"reference\":0,\"round\":3,\"timing\":\"before-bet\"},{\"chosen\":\"10\",\"kind\":\"table-bet\",\"override\":false,\"placed\":\"10\",\"position\":26,\"prescribed\":\"10\",\"resolution\":\"followed\",\"round\":3,\"trueCount\":0},{\"atEntered\":null,\"cards\":[{\"rank\":12,\"suit\":\"hearts\"},{\"rank\":6,\"suit\":\"spades\"}],\"chosen\":\"decline-insurance\",\"countDependent\":false,\"decision\":\"insurance\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"decline-insurance\",\"position\":31,\"prescribed\":\"decline-insurance\",\"refused\":[],\"resolution\":\"followed\",\"round\":3,\"total\":{\"soft\":false,\"value\":16},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":1,\"suit\":\"spades\"}},{\"atEntered\":null,\"cards\":[{\"rank\":12,\"suit\":\"hearts\"},{\"rank\":6,\"suit\":\"spades\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":32,\"prescribed\":\"surrender\",\"refused\":[],\"resolution\":\"departed\",\"round\":3,\"total\":{\"soft\":false,\"value\":16},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":1,\"suit\":\"spades\"}},{\"checkpoint\":6,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":34,\"reference\":-1,\"round\":3,\"timing\":\"after-round\"},{\"checkpoint\":7,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":35,\"reference\":-1,\"round\":4,\"timing\":\"before-bet\"},{\"checkpoint\":7,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":36,\"reference\":0,\"round\":4,\"timing\":\"before-bet\"},{\"chosen\":\"10\",\"kind\":\"table-bet\",\"override\":false,\"placed\":\"10\",\"position\":37,\"prescribed\":\"10\",\"resolution\":\"followed\",\"round\":4,\"trueCount\":0},{\"atEntered\":null,\"cards\":[{\"rank\":2,\"suit\":\"hearts\"},{\"rank\":13,\"suit\":\"clubs\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":42,\"prescribed\":\"hit\",\"refused\":[],\"resolution\":\"departed\",\"round\":4,\"total\":{\"soft\":false,\"value\":12},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":10,\"suit\":\"hearts\"}},{\"checkpoint\":8,\"count\":\"running\",\"entered\":0,\"error\":2,\"kind\":\"table\",\"position\":45,\"reference\":-2,\"round\":4,\"timing\":\"after-round\"},{\"checkpoint\":9,\"count\":\"running\",\"entered\":0,\"error\":2,\"kind\":\"table\",\"position\":46,\"reference\":-2,\"round\":5,\"timing\":\"before-bet\"},{\"checkpoint\":9,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":47,\"reference\":0,\"round\":5,\"timing\":\"before-bet\"},{\"chosen\":\"10\",\"kind\":\"table-bet\",\"override\":false,\"placed\":\"10\",\"position\":48,\"prescribed\":\"10\",\"resolution\":\"followed\",\"round\":5,\"trueCount\":0},{\"atEntered\":null,\"cards\":[{\"rank\":7,\"suit\":\"spades\"},{\"rank\":5,\"suit\":\"hearts\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":53,\"prescribed\":\"hit\",\"refused\":[],\"resolution\":\"departed\",\"round\":5,\"total\":{\"soft\":false,\"value\":12},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":9,\"suit\":\"hearts\"}},{\"checkpoint\":10,\"count\":\"running\",\"entered\":0,\"error\":2,\"kind\":\"table\",\"position\":55,\"reference\":-2,\"round\":5,\"timing\":\"after-round\"},{\"checkpoint\":11,\"count\":\"running\",\"entered\":0,\"error\":2,\"kind\":\"table\",\"position\":56,\"reference\":-2,\"round\":6,\"timing\":\"before-bet\"},{\"checkpoint\":11,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":57,\"reference\":0,\"round\":6,\"timing\":\"before-bet\"},{\"chosen\":\"10\",\"kind\":\"table-bet\",\"override\":false,\"placed\":\"10\",\"position\":58,\"prescribed\":\"10\",\"resolution\":\"followed\",\"round\":6,\"trueCount\":0},{\"atEntered\":null,\"cards\":[{\"rank\":5,\"suit\":\"hearts\"},{\"rank\":9,\"suit\":\"hearts\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":63,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":6,\"total\":{\"soft\":false,\"value\":14},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":4,\"suit\":\"spades\"}},{\"checkpoint\":12,\"count\":\"running\",\"entered\":0,\"error\":-2,\"kind\":\"table\",\"position\":67,\"reference\":2,\"round\":6,\"timing\":\"after-round\"},{\"checkpoint\":13,\"count\":\"running\",\"entered\":0,\"error\":-2,\"kind\":\"table\",\"position\":68,\"reference\":2,\"round\":7,\"timing\":\"before-bet\"},{\"checkpoint\":13,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":69,\"reference\":0,\"round\":7,\"timing\":\"before-bet\"},{\"chosen\":\"10\",\"kind\":\"table-bet\",\"override\":false,\"placed\":\"10\",\"position\":70,\"prescribed\":\"10\",\"resolution\":\"followed\",\"round\":7,\"trueCount\":0},{\"atEntered\":null,\"cards\":[{\"rank\":11,\"suit\":\"diamonds\"},{\"rank\":9,\"suit\":\"hearts\"}],\"chosen\":\"decline-insurance\",\"countDependent\":false,\"decision\":\"insurance\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"decline-insurance\",\"position\":75,\"prescribed\":\"decline-insurance\",\"refused\":[],\"resolution\":\"followed\",\"round\":7,\"total\":{\"soft\":false,\"value\":19},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":1,\"suit\":\"clubs\"}},{\"checkpoint\":14,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":77,\"reference\":-1,\"round\":7,\"timing\":\"after-round\"},{\"checkpoint\":15,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":78,\"reference\":-1,\"round\":8,\"timing\":\"before-bet\"},{\"checkpoint\":15,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":79,\"reference\":0,\"round\":8,\"timing\":\"before-bet\"},{\"chosen\":\"10\",\"kind\":\"table-bet\",\"override\":false,\"placed\":\"10\",\"position\":80,\"prescribed\":\"10\",\"resolution\":\"followed\",\"round\":8,\"trueCount\":0},{\"atEntered\":null,\"cards\":[{\"rank\":3,\"suit\":\"clubs\"},{\"rank\":12,\"suit\":\"clubs\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":85,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":8,\"total\":{\"soft\":false,\"value\":13},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":5,\"suit\":\"hearts\"}},{\"checkpoint\":16,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":88,\"reference\":-1,\"round\":8,\"timing\":\"after-round\"},{\"checkpoint\":17,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":89,\"reference\":-1,\"round\":9,\"timing\":\"before-bet\"},{\"checkpoint\":17,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":90,\"reference\":0,\"round\":9,\"timing\":\"before-bet\"},{\"chosen\":\"10\",\"kind\":\"table-bet\",\"override\":false,\"placed\":\"10\",\"position\":91,\"prescribed\":\"10\",\"resolution\":\"followed\",\"round\":9,\"trueCount\":0},{\"atEntered\":null,\"cards\":[{\"rank\":4,\"suit\":\"clubs\"},{\"rank\":13,\"suit\":\"diamonds\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":96,\"prescribed\":\"hit\",\"refused\":[],\"resolution\":\"departed\",\"round\":9,\"total\":{\"soft\":false,\"value\":14},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":11,\"suit\":\"clubs\"}},{\"checkpoint\":18,\"count\":\"running\",\"entered\":0,\"error\":3,\"kind\":\"table\",\"position\":98,\"reference\":-3,\"round\":9,\"timing\":\"after-round\"},{\"checkpoint\":19,\"count\":\"running\",\"entered\":0,\"error\":3,\"kind\":\"table\",\"position\":99,\"reference\":-3,\"round\":10,\"timing\":\"before-bet\"},{\"checkpoint\":19,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":100,\"reference\":0,\"round\":10,\"timing\":\"before-bet\"},{\"chosen\":\"10\",\"kind\":\"table-bet\",\"override\":false,\"placed\":\"10\",\"position\":101,\"prescribed\":\"10\",\"resolution\":\"followed\",\"round\":10,\"trueCount\":0},{\"atEntered\":null,\"cards\":[{\"rank\":9,\"suit\":\"spades\"},{\"rank\":1,\"suit\":\"spades\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":106,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":10,\"total\":{\"soft\":true,\"value\":20},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":9,\"suit\":\"spades\"}},{\"checkpoint\":20,\"count\":\"running\",\"entered\":0,\"error\":5,\"kind\":\"table\",\"position\":108,\"reference\":-5,\"round\":10,\"timing\":\"after-round\"}]}"
    },
    {
      "name": "table Play Learn with the bet schedule, a wager held in the correction pause",
      "category": "table",
      "phase": "correction",
      "specification": {
        "attemptId": "attempt-1",
        "content": {
          "category": "table",
          "id": "table",
          "reference": {
            "id": "blackjack-reference",
            "version": 1
          },
          "rounds": 10,
          "version": 1
        },
        "device": "device-1",
        "owner": "owner-1",
        "table": {
          "baseWager": "10",
          "betSchedule": true,
          "interval": 1,
          "policy": {
            "count": "player",
            "deviations": [],
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
                "pair": [
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "SHHHHHSHHS",
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
                "pair": [
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "SHHHHHSHHS",
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
                ]
              },
              "splitByBalance": [
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HSSSSSHHHH",
                "HSSSSSHHHH",
                "RSSSSSHHRR",
                "SSSSSSSSSS",
                "SSSSSSSSSS"
              ],
              "splitByRule": [
                "SSSSSSSSSS",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HDDDDDDDDH",
                "HSSSSSHHHH",
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
                ],
                "soft": [
                  "HHHHHHHHHH",
                  "HHHHDDHHHH",
                  "HHHHDDHHHH",
                  "HHHDDDHHHH",
                  "HHHDDDHHHH",
                  "HHDDDDHHHH",
                  "HSDDDDSSHH",
                  "SSSSSSSSSS",
                  "SSSSSSSSSS"
                ]
              }
            },
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
              ],
              "soft": [
                "HHHHHHHHHH",
                "HHHHDDHHHH",
                "HHHHDDHHHH",
                "HHHDDDHHHH",
                "HHHDDDHHHH",
                "HHDDDDHHHH",
                "HSDDDDSSHH",
                "SSSSSSSSSS",
                "SSSSSSSSSS"
              ]
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
                "HHHHHHHHHH",
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
          },
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
          "seat": "play",
          "startingBalance": "1000"
        },
        "variant": "learn"
      },
      "random": {
        "key": [
          1,
          2654435769
        ],
        "protocol": 1,
        "session": [
          8,
          0
        ]
      },
      "checkpoint": "{\"answers\":[{\"first\":0,\"last\":0,\"position\":0,\"tries\":1},{\"first\":0,\"last\":0,\"position\":1,\"tries\":1}],\"attempt\":{\"device\":\"device-1\",\"id\":\"attempt-1\",\"owner\":\"owner-1\"},\"content\":{\"category\":\"table\",\"id\":\"table\",\"reference\":{\"id\":\"blackjack-reference\",\"version\":1},\"rounds\":10,\"version\":1},\"ending\":null,\"identities\":{\"category\":\"table\",\"content\":{\"id\":\"table\",\"version\":1},\"engine\":\"0.0.0\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":{\"id\":\"blackjack-reference\",\"version\":1}},\"items\":[{\"checkpoint\":1,\"count\":\"running\",\"round\":1,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"checkpoint\":1,\"count\":\"true\",\"round\":1,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"amounts\":[\"10\",\"20\",\"40\",\"60\",\"80\"],\"funding\":false,\"round\":1,\"step\":\"bet\"}],\"phase\":\"correction\",\"position\":2,\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":0,\"protocol\":1,\"session\":[8,0]},\"receipts\":[{\"command\":\"{\\\"kind\\\":\\\"begin\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-4\",\"disposition\":\"applied\",\"sequence\":4},{\"command\":\"{\\\"amount\\\":\\\"40\\\",\\\"kind\\\":\\\"bet\\\"}\",\"commandId\":\"record-5\",\"disposition\":\"applied\",\"sequence\":5}],\"rejected\":0,\"revealedAt\":null,\"schema\":13,\"sequence\":6,\"table\":{\"round\":1,\"seat\":{\"activity\":{\"activity\":{\"device\":\"device-1\",\"id\":\"attempt-1/seat\",\"owner\":\"owner-1\"},\"balance\":\"1000\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"0\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"blackjack\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":{\"id\":\"blackjack-reference\",\"version\":1},\"rules\":{\"id\":\"blackjack-six-deck\",\"version\":1},\"strategy\":null},\"outcome\":null,\"phase\":\"open-decision\",\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":0,\"protocol\":1,\"session\":[8,0]},\"receipts\":[],\"rules\":{\"dealer\":\"S17\",\"decks\":6,\"lateSurrender\":true,\"limits\":{\"initial\":{\"max\":\"1000\",\"min\":\"10\"}},\"penetration\":75,\"players\":{\"learnerSeat\":0,\"otherWagers\":[],\"strategy\":null}},\"schema\":13,\"sequence\":0,\"shoe\":null,\"strategy\":null,\"turn\":0,\"wagers\":[]},\"betCorrection\":{\"chosen\":\"40\",\"position\":2,\"prescribed\":\"10\",\"trueCount\":0},\"bets\":[{\"chosen\":\"40\",\"funding\":false,\"placed\":null,\"position\":2,\"prescribed\":\"10\",\"resolution\":null,\"round\":1,\"trueCount\":0}],\"correction\":null,\"decisions\":[],\"ledger\":[]},\"setup\":{\"baseWager\":\"10\",\"betSchedule\":true,\"interval\":1,\"policy\":{\"count\":\"player\",\"deviations\":[],\"fallbacks\":{\"double\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SHHHHHSHHS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"doubleOnOriginalLateSurrender\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHR\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SHHHHHSHHS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"splitByBalance\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"splitByRule\":[\"SSSSSSSSSS\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"surrender\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"PPPPPPPPPP\",\"HPPPPPPHHH\",\"HPPPPPPHHH\",\"HHHHPPHHHH\",\"HDDDDDDDDH\",\"HPPPPPHHHH\",\"HPPPPPPHHH\",\"PPPPPPPPPP\",\"SPPPPPSPPS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]}},\"first\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHR\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"PPPPPPPPPP\",\"HPPPPPPHHH\",\"HPPPPPPHHH\",\"HHHHPPHHHH\",\"HDDDDDDDDH\",\"HPPPPPHHHH\",\"HPPPPPPHHH\",\"PPPPPPPPPP\",\"SPPPPPSPPS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"later\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"laterWithoutDouble\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]}},\"rules\":{\"dealer\":\"S17\",\"decks\":6,\"id\":\"blackjack-six-deck\",\"lateSurrender\":true,\"limits\":{\"initial\":{\"max\":\"1000\",\"min\":\"10\"}},\"penetration\":75,\"players\":{\"learnerSeat\":0,\"otherWagers\":[],\"strategy\":null},\"version\":1},\"seat\":\"play\",\"startingBalance\":\"1000\"},\"shoe\":null},\"variant\":\"learn\"}",
      "continuation": [
        {
          "kind": "override-correction"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "bet",
          "amount": "10"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "bet",
          "amount": "10"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "decline-insurance"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "override-correction"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "bet",
          "amount": "10"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "override-correction"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "bet",
          "amount": "10"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "override-correction"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "bet",
          "amount": "10"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "bet",
          "amount": "10"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "decline-insurance"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "bet",
          "amount": "10"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "bet",
          "amount": "10"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "override-correction"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "bet",
          "amount": "10"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        }
      ],
      "facts": "[{\"kind\":\"content-shown\",\"position\":3},{\"kind\":\"wager-placed\",\"position\":3},{\"kind\":\"content-shown\",\"position\":4},{\"kind\":\"content-shown\",\"position\":5},{\"kind\":\"content-shown\",\"position\":6},{\"kind\":\"content-shown\",\"position\":8},{\"kind\":\"content-shown\",\"position\":9},{\"kind\":\"content-shown\",\"position\":10},{\"kind\":\"content-shown\",\"position\":11},{\"kind\":\"round-settled\",\"net\":\"40\",\"position\":11},{\"kind\":\"checkpoint-due\",\"position\":12},{\"kind\":\"answer-accepted\",\"position\":12,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":13},{\"kind\":\"answer-accepted\",\"position\":13,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":14,\"scored\":true},{\"kind\":\"content-shown\",\"position\":16},{\"kind\":\"wager-placed\",\"position\":16},{\"kind\":\"content-shown\",\"position\":17},{\"kind\":\"content-shown\",\"position\":18},{\"kind\":\"content-shown\",\"position\":19},{\"kind\":\"content-shown\",\"position\":21},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":21},{\"kind\":\"checkpoint-due\",\"position\":22},{\"kind\":\"answer-accepted\",\"position\":22,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":23},{\"kind\":\"answer-accepted\",\"position\":23,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":24,\"scored\":true},{\"kind\":\"content-shown\",\"position\":26},{\"kind\":\"wager-placed\",\"position\":26},{\"kind\":\"content-shown\",\"position\":27},{\"kind\":\"content-shown\",\"position\":28},{\"kind\":\"content-shown\",\"position\":29},{\"kind\":\"correction-offered\",\"position\":31},{\"kind\":\"content-shown\",\"position\":32},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":32},{\"kind\":\"checkpoint-due\",\"position\":33},{\"kind\":\"answer-accepted\",\"position\":33,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":34},{\"kind\":\"answer-accepted\",\"position\":34,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":35,\"scored\":true},{\"kind\":\"content-shown\",\"position\":37},{\"kind\":\"wager-placed\",\"position\":37},{\"kind\":\"content-shown\",\"position\":38},{\"kind\":\"content-shown\",\"position\":39},{\"kind\":\"content-shown\",\"position\":40},{\"kind\":\"correction-offered\",\"position\":41},{\"kind\":\"content-shown\",\"position\":42},{\"kind\":\"content-shown\",\"position\":43},{\"kind\":\"round-settled\",\"net\":\"10\",\"position\":43},{\"kind\":\"checkpoint-due\",\"position\":44},{\"kind\":\"answer-accepted\",\"position\":44,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":45},{\"kind\":\"answer-accepted\",\"position\":45,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":46,\"scored\":true},{\"kind\":\"content-shown\",\"position\":48},{\"kind\":\"wager-placed\",\"position\":48},{\"kind\":\"content-shown\",\"position\":49},{\"kind\":\"content-shown\",\"position\":50},{\"kind\":\"content-shown\",\"position\":51},{\"kind\":\"correction-offered\",\"position\":52},{\"kind\":\"content-shown\",\"position\":53},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":53},{\"kind\":\"checkpoint-due\",\"position\":54},{\"kind\":\"answer-accepted\",\"position\":54,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":55},{\"kind\":\"answer-accepted\",\"position\":55,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":56,\"scored\":true},{\"kind\":\"content-shown\",\"position\":58},{\"kind\":\"wager-placed\",\"position\":58},{\"kind\":\"content-shown\",\"position\":59},{\"kind\":\"content-shown\",\"position\":60},{\"kind\":\"content-shown\",\"position\":61},{\"kind\":\"content-shown\",\"position\":63},{\"kind\":\"content-shown\",\"position\":64},{\"kind\":\"content-shown\",\"position\":65},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":65},{\"kind\":\"checkpoint-due\",\"position\":66},{\"kind\":\"answer-accepted\",\"position\":66,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":67},{\"kind\":\"answer-accepted\",\"position\":67,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":68,\"scored\":true},{\"kind\":\"content-shown\",\"position\":70},{\"kind\":\"wager-placed\",\"position\":70},{\"kind\":\"content-shown\",\"position\":71},{\"kind\":\"content-shown\",\"position\":72},{\"kind\":\"content-shown\",\"position\":73},{\"kind\":\"content-shown\",\"position\":75},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":75},{\"kind\":\"checkpoint-due\",\"position\":76},{\"kind\":\"answer-accepted\",\"position\":76,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":77},{\"kind\":\"answer-accepted\",\"position\":77,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":78,\"scored\":true},{\"kind\":\"content-shown\",\"position\":80},{\"kind\":\"wager-placed\",\"position\":80},{\"kind\":\"content-shown\",\"position\":81},{\"kind\":\"content-shown\",\"position\":82},{\"kind\":\"content-shown\",\"position\":83},{\"kind\":\"content-shown\",\"position\":85},{\"kind\":\"content-shown\",\"position\":86},{\"kind\":\"round-settled\",\"net\":\"10\",\"position\":86},{\"kind\":\"checkpoint-due\",\"position\":87},{\"kind\":\"answer-accepted\",\"position\":87,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":88},{\"kind\":\"answer-accepted\",\"position\":88,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":89,\"scored\":true},{\"kind\":\"content-shown\",\"position\":91},{\"kind\":\"wager-placed\",\"position\":91},{\"kind\":\"content-shown\",\"position\":92},{\"kind\":\"content-shown\",\"position\":93},{\"kind\":\"content-shown\",\"position\":94},{\"kind\":\"correction-offered\",\"position\":95},{\"kind\":\"content-shown\",\"position\":96},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":96},{\"kind\":\"checkpoint-due\",\"position\":97},{\"kind\":\"answer-accepted\",\"position\":97,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":98},{\"kind\":\"answer-accepted\",\"position\":98,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":99,\"scored\":true},{\"kind\":\"content-shown\",\"position\":101},{\"kind\":\"wager-placed\",\"position\":101},{\"kind\":\"content-shown\",\"position\":102},{\"kind\":\"content-shown\",\"position\":103},{\"kind\":\"content-shown\",\"position\":104},{\"kind\":\"content-shown\",\"position\":106},{\"kind\":\"round-settled\",\"net\":\"10\",\"position\":106},{\"kind\":\"checkpoint-due\",\"position\":107},{\"kind\":\"answer-accepted\",\"position\":107,\"scored\":true},{\"ending\":\"completed\",\"kind\":\"attempt-ended\"}]",
      "results": "{\"assistanceStep\":null,\"assisted\":true,\"ending\":\"completed\",\"finances\":{\"finishingBalance\":\"1010\",\"net\":\"10\",\"startingBalance\":\"1000\"},\"metrics\":{\"betting-adherence\":{\"correct\":9,\"total\":10},\"card-values\":null,\"playing-adherence\":{\"correct\":7,\"total\":11},\"running-count\":{\"correct\":3,\"total\":20},\"true-count\":{\"correct\":10,\"total\":10}},\"review\":[{\"checkpoint\":1,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":1,\"reference\":0,\"round\":1,\"timing\":\"before-bet\"},{\"checkpoint\":1,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":2,\"reference\":0,\"round\":1,\"timing\":\"before-bet\"},{\"chosen\":\"40\",\"kind\":\"table-bet\",\"override\":false,\"placed\":\"40\",\"position\":3,\"prescribed\":\"10\",\"resolution\":\"overridden\",\"round\":1,\"trueCount\":0},{\"atEntered\":null,\"cards\":[{\"rank\":13,\"suit\":\"diamonds\"},{\"rank\":4,\"suit\":\"clubs\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":8,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":1,\"total\":{\"soft\":false,\"value\":14},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":3,\"suit\":\"hearts\"}},{\"checkpoint\":2,\"count\":\"running\",\"entered\":0,\"error\":-3,\"kind\":\"table\",\"position\":13,\"reference\":3,\"round\":1,\"timing\":\"after-round\"},{\"checkpoint\":3,\"count\":\"running\",\"entered\":0,\"error\":-3,\"kind\":\"table\",\"position\":14,\"reference\":3,\"round\":2,\"timing\":\"before-bet\"},{\"checkpoint\":3,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":15,\"reference\":0,\"round\":2,\"timing\":\"before-bet\"},{\"chosen\":\"10\",\"kind\":\"table-bet\",\"override\":false,\"placed\":\"10\",\"position\":16,\"prescribed\":\"10\",\"resolution\":\"followed\",\"round\":2,\"trueCount\":0},{\"atEntered\":null,\"cards\":[{\"rank\":11,\"suit\":\"diamonds\"},{\"rank\":7,\"suit\":\"spades\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":21,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":2,\"total\":{\"soft\":false,\"value\":17},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":13,\"suit\":\"clubs\"}},{\"checkpoint\":4,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":23,\"reference\":0,\"round\":2,\"timing\":\"after-round\"},{\"checkpoint\":5,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":24,\"reference\":0,\"round\":3,\"timing\":\"before-bet\"},{\"checkpoint\":5,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":25,\"reference\":0,\"round\":3,\"timing\":\"before-bet\"},{\"chosen\":\"10\",\"kind\":\"table-bet\",\"override\":false,\"placed\":\"10\",\"position\":26,\"prescribed\":\"10\",\"resolution\":\"followed\",\"round\":3,\"trueCount\":0},{\"atEntered\":null,\"cards\":[{\"rank\":12,\"suit\":\"hearts\"},{\"rank\":6,\"suit\":\"spades\"}],\"chosen\":\"decline-insurance\",\"countDependent\":false,\"decision\":\"insurance\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"decline-insurance\",\"position\":31,\"prescribed\":\"decline-insurance\",\"refused\":[],\"resolution\":\"followed\",\"round\":3,\"total\":{\"soft\":false,\"value\":16},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":1,\"suit\":\"spades\"}},{\"atEntered\":null,\"cards\":[{\"rank\":12,\"suit\":\"hearts\"},{\"rank\":6,\"suit\":\"spades\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":32,\"prescribed\":\"surrender\",\"refused\":[],\"resolution\":\"overridden\",\"round\":3,\"total\":{\"soft\":false,\"value\":16},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":1,\"suit\":\"spades\"}},{\"checkpoint\":6,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":34,\"reference\":-1,\"round\":3,\"timing\":\"after-round\"},{\"checkpoint\":7,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":35,\"reference\":-1,\"round\":4,\"timing\":\"before-bet\"},{\"checkpoint\":7,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":36,\"reference\":0,\"round\":4,\"timing\":\"before-bet\"},{\"chosen\":\"10\",\"kind\":\"table-bet\",\"override\":false,\"placed\":\"10\",\"position\":37,\"prescribed\":\"10\",\"resolution\":\"followed\",\"round\":4,\"trueCount\":0},{\"atEntered\":null,\"cards\":[{\"rank\":2,\"suit\":\"hearts\"},{\"rank\":13,\"suit\":\"clubs\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":42,\"prescribed\":\"hit\",\"refused\":[],\"resolution\":\"overridden\",\"round\":4,\"total\":{\"soft\":false,\"value\":12},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":10,\"suit\":\"hearts\"}},{\"checkpoint\":8,\"count\":\"running\",\"entered\":0,\"error\":2,\"kind\":\"table\",\"position\":45,\"reference\":-2,\"round\":4,\"timing\":\"after-round\"},{\"checkpoint\":9,\"count\":\"running\",\"entered\":0,\"error\":2,\"kind\":\"table\",\"position\":46,\"reference\":-2,\"round\":5,\"timing\":\"before-bet\"},{\"checkpoint\":9,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":47,\"reference\":0,\"round\":5,\"timing\":\"before-bet\"},{\"chosen\":\"10\",\"kind\":\"table-bet\",\"override\":false,\"placed\":\"10\",\"position\":48,\"prescribed\":\"10\",\"resolution\":\"followed\",\"round\":5,\"trueCount\":0},{\"atEntered\":null,\"cards\":[{\"rank\":7,\"suit\":\"spades\"},{\"rank\":5,\"suit\":\"hearts\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":53,\"prescribed\":\"hit\",\"refused\":[],\"resolution\":\"overridden\",\"round\":5,\"total\":{\"soft\":false,\"value\":12},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":9,\"suit\":\"hearts\"}},{\"checkpoint\":10,\"count\":\"running\",\"entered\":0,\"error\":2,\"kind\":\"table\",\"position\":55,\"reference\":-2,\"round\":5,\"timing\":\"after-round\"},{\"checkpoint\":11,\"count\":\"running\",\"entered\":0,\"error\":2,\"kind\":\"table\",\"position\":56,\"reference\":-2,\"round\":6,\"timing\":\"before-bet\"},{\"checkpoint\":11,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":57,\"reference\":0,\"round\":6,\"timing\":\"before-bet\"},{\"chosen\":\"10\",\"kind\":\"table-bet\",\"override\":false,\"placed\":\"10\",\"position\":58,\"prescribed\":\"10\",\"resolution\":\"followed\",\"round\":6,\"trueCount\":0},{\"atEntered\":null,\"cards\":[{\"rank\":5,\"suit\":\"hearts\"},{\"rank\":9,\"suit\":\"hearts\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":63,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":6,\"total\":{\"soft\":false,\"value\":14},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":4,\"suit\":\"spades\"}},{\"checkpoint\":12,\"count\":\"running\",\"entered\":0,\"error\":-2,\"kind\":\"table\",\"position\":67,\"reference\":2,\"round\":6,\"timing\":\"after-round\"},{\"checkpoint\":13,\"count\":\"running\",\"entered\":0,\"error\":-2,\"kind\":\"table\",\"position\":68,\"reference\":2,\"round\":7,\"timing\":\"before-bet\"},{\"checkpoint\":13,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":69,\"reference\":0,\"round\":7,\"timing\":\"before-bet\"},{\"chosen\":\"10\",\"kind\":\"table-bet\",\"override\":false,\"placed\":\"10\",\"position\":70,\"prescribed\":\"10\",\"resolution\":\"followed\",\"round\":7,\"trueCount\":0},{\"atEntered\":null,\"cards\":[{\"rank\":11,\"suit\":\"diamonds\"},{\"rank\":9,\"suit\":\"hearts\"}],\"chosen\":\"decline-insurance\",\"countDependent\":false,\"decision\":\"insurance\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"decline-insurance\",\"position\":75,\"prescribed\":\"decline-insurance\",\"refused\":[],\"resolution\":\"followed\",\"round\":7,\"total\":{\"soft\":false,\"value\":19},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":1,\"suit\":\"clubs\"}},{\"checkpoint\":14,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":77,\"reference\":-1,\"round\":7,\"timing\":\"after-round\"},{\"checkpoint\":15,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":78,\"reference\":-1,\"round\":8,\"timing\":\"before-bet\"},{\"checkpoint\":15,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":79,\"reference\":0,\"round\":8,\"timing\":\"before-bet\"},{\"chosen\":\"10\",\"kind\":\"table-bet\",\"override\":false,\"placed\":\"10\",\"position\":80,\"prescribed\":\"10\",\"resolution\":\"followed\",\"round\":8,\"trueCount\":0},{\"atEntered\":null,\"cards\":[{\"rank\":3,\"suit\":\"clubs\"},{\"rank\":12,\"suit\":\"clubs\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":85,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":8,\"total\":{\"soft\":false,\"value\":13},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":5,\"suit\":\"hearts\"}},{\"checkpoint\":16,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":88,\"reference\":-1,\"round\":8,\"timing\":\"after-round\"},{\"checkpoint\":17,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":89,\"reference\":-1,\"round\":9,\"timing\":\"before-bet\"},{\"checkpoint\":17,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":90,\"reference\":0,\"round\":9,\"timing\":\"before-bet\"},{\"chosen\":\"10\",\"kind\":\"table-bet\",\"override\":false,\"placed\":\"10\",\"position\":91,\"prescribed\":\"10\",\"resolution\":\"followed\",\"round\":9,\"trueCount\":0},{\"atEntered\":null,\"cards\":[{\"rank\":4,\"suit\":\"clubs\"},{\"rank\":13,\"suit\":\"diamonds\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":96,\"prescribed\":\"hit\",\"refused\":[],\"resolution\":\"overridden\",\"round\":9,\"total\":{\"soft\":false,\"value\":14},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":11,\"suit\":\"clubs\"}},{\"checkpoint\":18,\"count\":\"running\",\"entered\":0,\"error\":3,\"kind\":\"table\",\"position\":98,\"reference\":-3,\"round\":9,\"timing\":\"after-round\"},{\"checkpoint\":19,\"count\":\"running\",\"entered\":0,\"error\":3,\"kind\":\"table\",\"position\":99,\"reference\":-3,\"round\":10,\"timing\":\"before-bet\"},{\"checkpoint\":19,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":100,\"reference\":0,\"round\":10,\"timing\":\"before-bet\"},{\"chosen\":\"10\",\"kind\":\"table-bet\",\"override\":false,\"placed\":\"10\",\"position\":101,\"prescribed\":\"10\",\"resolution\":\"followed\",\"round\":10,\"trueCount\":0},{\"atEntered\":null,\"cards\":[{\"rank\":9,\"suit\":\"spades\"},{\"rank\":1,\"suit\":\"spades\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":106,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":10,\"total\":{\"soft\":true,\"value\":20},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":9,\"suit\":\"spades\"}},{\"checkpoint\":20,\"count\":\"running\",\"entered\":0,\"error\":5,\"kind\":\"table\",\"position\":108,\"reference\":-5,\"round\":10,\"timing\":\"after-round\"}]}"
    },
    {
      "name": "table Play Check with the bet schedule, the funding notice offering affordable wagers",
      "category": "table",
      "phase": "bet",
      "specification": {
        "attemptId": "attempt-1",
        "content": {
          "category": "table",
          "id": "table",
          "reference": {
            "id": "blackjack-reference",
            "version": 1
          },
          "rounds": 10,
          "version": 1
        },
        "device": "device-1",
        "owner": "owner-1",
        "table": {
          "baseWager": "20",
          "betSchedule": true,
          "interval": 1,
          "policy": {
            "count": "player",
            "deviations": [],
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
                "pair": [
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "SHHHHHSHHS",
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
                "pair": [
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "SHHHHHSHHS",
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
                ]
              },
              "splitByBalance": [
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HSSSSSHHHH",
                "HSSSSSHHHH",
                "RSSSSSHHRR",
                "SSSSSSSSSS",
                "SSSSSSSSSS"
              ],
              "splitByRule": [
                "SSSSSSSSSS",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HDDDDDDDDH",
                "HSSSSSHHHH",
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
                ],
                "soft": [
                  "HHHHHHHHHH",
                  "HHHHDDHHHH",
                  "HHHHDDHHHH",
                  "HHHDDDHHHH",
                  "HHHDDDHHHH",
                  "HHDDDDHHHH",
                  "HSDDDDSSHH",
                  "SSSSSSSSSS",
                  "SSSSSSSSSS"
                ]
              }
            },
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
              ],
              "soft": [
                "HHHHHHHHHH",
                "HHHHDDHHHH",
                "HHHHDDHHHH",
                "HHHDDDHHHH",
                "HHHDDDHHHH",
                "HHDDDDHHHH",
                "HSDDDDSSHH",
                "SSSSSSSSSS",
                "SSSSSSSSSS"
              ]
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
                "HHHHHHHHHH",
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
          },
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
          "seat": "play",
          "startingBalance": "30"
        },
        "variant": "check"
      },
      "random": {
        "key": [
          1,
          2654435769
        ],
        "protocol": 1,
        "session": [
          8,
          0
        ]
      },
      "checkpoint": "{\"answers\":[{\"first\":0,\"last\":0,\"position\":0,\"tries\":1},{\"first\":0,\"last\":0,\"position\":1,\"tries\":1},{\"first\":0,\"last\":0,\"position\":12,\"tries\":1},{\"first\":0,\"last\":0,\"position\":13,\"tries\":1},{\"first\":0,\"last\":0,\"position\":14,\"tries\":1},{\"first\":0,\"last\":0,\"position\":22,\"tries\":1},{\"first\":0,\"last\":0,\"position\":23,\"tries\":1},{\"first\":0,\"last\":0,\"position\":24,\"tries\":1},{\"first\":0,\"last\":0,\"position\":33,\"tries\":1},{\"first\":0,\"last\":0,\"position\":34,\"tries\":1},{\"first\":0,\"last\":0,\"position\":35,\"tries\":1}],\"attempt\":{\"device\":\"device-1\",\"id\":\"attempt-1\",\"owner\":\"owner-1\"},\"content\":{\"category\":\"table\",\"id\":\"table\",\"reference\":{\"id\":\"blackjack-reference\",\"version\":1},\"rounds\":10,\"version\":1},\"ending\":null,\"identities\":{\"category\":\"table\",\"content\":{\"id\":\"table\",\"version\":1},\"engine\":\"0.0.0\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":{\"id\":\"blackjack-reference\",\"version\":1}},\"items\":[{\"checkpoint\":1,\"count\":\"running\",\"round\":1,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"checkpoint\":1,\"count\":\"true\",\"round\":1,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"amounts\":[\"20\"],\"funding\":false,\"round\":1,\"step\":\"bet\"},{\"events\":[],\"face\":{\"rank\":13,\"suit\":\"diamonds\"},\"round\":1,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":{\"rank\":3,\"suit\":\"hearts\"},\"round\":1,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":4,\"suit\":\"clubs\"},\"round\":1,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":null,\"round\":1,\"step\":\"deal\",\"to\":\"dealer\"},{\"actions\":[\"hit\",\"stand\",\"surrender\"],\"decision\":\"hand\",\"events\":[],\"round\":1,\"step\":\"decision\",\"target\":\"hand-1\",\"unaffordable\":[{\"action\":\"double\",\"amount\":\"20\"}]},{\"events\":[{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"hand-1\"}],\"face\":{\"rank\":3,\"suit\":\"diamonds\"},\"round\":1,\"step\":\"reveal\"},{\"events\":[],\"face\":{\"rank\":3,\"suit\":\"clubs\"},\"round\":1,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":4,\"suit\":\"clubs\"},\"round\":1,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":12,\"suit\":\"clubs\"},\"round\":1,\"step\":\"deal\",\"to\":\"dealer\"},{\"checkpoint\":2,\"count\":\"running\",\"round\":1,\"step\":\"prompt\",\"timing\":\"after-round\"},{\"checkpoint\":3,\"count\":\"running\",\"round\":2,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"checkpoint\":3,\"count\":\"true\",\"round\":2,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"amounts\":[\"20\",\"40\"],\"funding\":false,\"round\":2,\"step\":\"bet\"},{\"events\":[],\"face\":{\"rank\":11,\"suit\":\"diamonds\"},\"round\":2,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":{\"rank\":13,\"suit\":\"clubs\"},\"round\":2,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":7,\"suit\":\"spades\"},\"round\":2,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":null,\"round\":2,\"step\":\"deal\",\"to\":\"dealer\"},{\"actions\":[\"hit\",\"stand\",\"double\",\"surrender\"],\"decision\":\"hand\",\"events\":[{\"kind\":\"peeked\",\"result\":\"no-blackjack\"}],\"round\":2,\"step\":\"decision\",\"target\":\"hand-1\",\"unaffordable\":[]},{\"events\":[{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"hand-1\"}],\"face\":{\"rank\":11,\"suit\":\"diamonds\"},\"round\":2,\"step\":\"reveal\"},{\"checkpoint\":4,\"count\":\"running\",\"round\":2,\"step\":\"prompt\",\"timing\":\"after-round\"},{\"checkpoint\":5,\"count\":\"running\",\"round\":3,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"checkpoint\":5,\"count\":\"true\",\"round\":3,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"amounts\":[\"20\"],\"funding\":false,\"round\":3,\"step\":\"bet\"},{\"events\":[],\"face\":{\"rank\":12,\"suit\":\"hearts\"},\"round\":3,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":{\"rank\":1,\"suit\":\"spades\"},\"round\":3,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":6,\"suit\":\"spades\"},\"round\":3,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":null,\"round\":3,\"step\":\"deal\",\"to\":\"dealer\"},{\"actions\":[\"insure\",\"decline-insurance\"],\"decision\":\"insurance\",\"events\":[],\"round\":3,\"step\":\"decision\",\"target\":\"hand-1\",\"unaffordable\":[]},{\"actions\":[\"hit\",\"stand\",\"surrender\"],\"decision\":\"hand\",\"events\":[{\"action\":\"decline-insurance\",\"kind\":\"played\",\"target\":\"hand-1\"},{\"kind\":\"peeked\",\"result\":\"no-blackjack\"}],\"round\":3,\"step\":\"decision\",\"target\":\"hand-1\",\"unaffordable\":[{\"action\":\"double\",\"amount\":\"20\"}]},{\"events\":[{\"action\":\"stand\",\"kind\":\"played\",\"target\":\"hand-1\"}],\"face\":{\"rank\":8,\"suit\":\"hearts\"},\"round\":3,\"step\":\"reveal\"},{\"checkpoint\":6,\"count\":\"running\",\"round\":3,\"step\":\"prompt\",\"timing\":\"after-round\"},{\"checkpoint\":7,\"count\":\"running\",\"round\":4,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"checkpoint\":7,\"count\":\"true\",\"round\":4,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"amounts\":[\"10\"],\"funding\":true,\"round\":4,\"step\":\"bet\"}],\"phase\":\"bet\",\"position\":36,\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":0,\"protocol\":1,\"session\":[8,0]},\"receipts\":[{\"command\":\"{\\\"kind\\\":\\\"begin\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-4\",\"disposition\":\"applied\",\"sequence\":4},{\"command\":\"{\\\"amount\\\":\\\"20\\\",\\\"kind\\\":\\\"bet\\\"}\",\"commandId\":\"record-5\",\"disposition\":\"applied\",\"sequence\":5},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-6\",\"disposition\":\"applied\",\"sequence\":6},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-7\",\"disposition\":\"applied\",\"sequence\":7},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-8\",\"disposition\":\"applied\",\"sequence\":8},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-9\",\"disposition\":\"applied\",\"sequence\":9},{\"command\":\"{\\\"action\\\":\\\"stand\\\",\\\"kind\\\":\\\"play\\\"}\",\"commandId\":\"record-10\",\"disposition\":\"applied\",\"sequence\":10},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-11\",\"disposition\":\"applied\",\"sequence\":11},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-12\",\"disposition\":\"applied\",\"sequence\":12},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-13\",\"disposition\":\"applied\",\"sequence\":13},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-14\",\"disposition\":\"applied\",\"sequence\":14},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-15\",\"disposition\":\"applied\",\"sequence\":15},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-16\",\"disposition\":\"applied\",\"sequence\":16},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-17\",\"disposition\":\"applied\",\"sequence\":17},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-18\",\"disposition\":\"applied\",\"sequence\":18},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-19\",\"disposition\":\"applied\",\"sequence\":19},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-20\",\"disposition\":\"applied\",\"sequence\":20},{\"command\":\"{\\\"amount\\\":\\\"20\\\",\\\"kind\\\":\\\"bet\\\"}\",\"commandId\":\"record-21\",\"disposition\":\"applied\",\"sequence\":21},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-22\",\"disposition\":\"applied\",\"sequence\":22},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-23\",\"disposition\":\"applied\",\"sequence\":23},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-24\",\"disposition\":\"applied\",\"sequence\":24},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-25\",\"disposition\":\"applied\",\"sequence\":25},{\"command\":\"{\\\"action\\\":\\\"stand\\\",\\\"kind\\\":\\\"play\\\"}\",\"commandId\":\"record-26\",\"disposition\":\"applied\",\"sequence\":26},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-27\",\"disposition\":\"applied\",\"sequence\":27},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-28\",\"disposition\":\"applied\",\"sequence\":28},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-29\",\"disposition\":\"applied\",\"sequence\":29},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-30\",\"disposition\":\"applied\",\"sequence\":30},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-31\",\"disposition\":\"applied\",\"sequence\":31},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-32\",\"disposition\":\"applied\",\"sequence\":32},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-33\",\"disposition\":\"applied\",\"sequence\":33},{\"command\":\"{\\\"amount\\\":\\\"20\\\",\\\"kind\\\":\\\"bet\\\"}\",\"commandId\":\"record-34\",\"disposition\":\"applied\",\"sequence\":34},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-35\",\"disposition\":\"applied\",\"sequence\":35},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-36\",\"disposition\":\"applied\",\"sequence\":36},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-37\",\"disposition\":\"applied\",\"sequence\":37},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-38\",\"disposition\":\"applied\",\"sequence\":38},{\"command\":\"{\\\"action\\\":\\\"decline-insurance\\\",\\\"kind\\\":\\\"play\\\"}\",\"commandId\":\"record-39\",\"disposition\":\"applied\",\"sequence\":39},{\"command\":\"{\\\"action\\\":\\\"stand\\\",\\\"kind\\\":\\\"play\\\"}\",\"commandId\":\"record-40\",\"disposition\":\"applied\",\"sequence\":40},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-41\",\"disposition\":\"applied\",\"sequence\":41},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-42\",\"disposition\":\"applied\",\"sequence\":42},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-43\",\"disposition\":\"applied\",\"sequence\":43},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-44\",\"disposition\":\"applied\",\"sequence\":44},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-45\",\"disposition\":\"applied\",\"sequence\":45},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-46\",\"disposition\":\"applied\",\"sequence\":46},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-47\",\"disposition\":\"applied\",\"sequence\":47}],\"rejected\":0,\"revealedAt\":null,\"schema\":13,\"sequence\":48,\"table\":{\"round\":4,\"seat\":{\"activity\":{\"activity\":{\"device\":\"device-1\",\"id\":\"attempt-1/seat\",\"owner\":\"owner-1\"},\"balance\":\"10\",\"funding\":{\"buyIn\":\"30\",\"maxDrawdown\":\"40\",\"peak\":\"20\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"blackjack\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":{\"id\":\"blackjack-reference\",\"version\":1},\"rules\":{\"id\":\"blackjack-six-deck\",\"version\":1},\"strategy\":null},\"outcome\":{\"active\":null,\"dealer\":[{\"deck\":4,\"rank\":1,\"suit\":\"spades\"},{\"deck\":2,\"rank\":8,\"suit\":\"hearts\"}],\"hands\":[{\"cards\":[{\"deck\":0,\"rank\":12,\"suit\":\"hearts\"},{\"deck\":3,\"rank\":6,\"suit\":\"spades\"}],\"done\":true,\"doubled\":false,\"surrendered\":false,\"target\":\"hand-1\"}],\"holeRevealed\":true,\"insurance\":\"declined\",\"others\":[],\"peek\":\"no-blackjack\"},\"phase\":\"settled-outcome\",\"random\":{\"block\":[77,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":3,\"protocol\":1,\"session\":[8,0]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"20\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"hand-1\\\"}\",\"commandId\":\"seat-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"seat-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"action\\\":\\\"stand\\\",\\\"kind\\\":\\\"play\\\"}\",\"commandId\":\"seat-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"kind\\\":\\\"settle-turn\\\"}\",\"commandId\":\"seat-3\",\"disposition\":\"applied\",\"sequence\":3},{\"command\":\"{\\\"amount\\\":\\\"20\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"hand-1\\\"}\",\"commandId\":\"seat-4\",\"disposition\":\"applied\",\"sequence\":4},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"seat-5\",\"disposition\":\"applied\",\"sequence\":5},{\"command\":\"{\\\"action\\\":\\\"stand\\\",\\\"kind\\\":\\\"play\\\"}\",\"commandId\":\"seat-6\",\"disposition\":\"applied\",\"sequence\":6},{\"command\":\"{\\\"kind\\\":\\\"settle-turn\\\"}\",\"commandId\":\"seat-7\",\"disposition\":\"applied\",\"sequence\":7},{\"command\":\"{\\\"amount\\\":\\\"20\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"hand-1\\\"}\",\"commandId\":\"seat-8\",\"disposition\":\"applied\",\"sequence\":8},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"seat-9\",\"disposition\":\"applied\",\"sequence\":9},{\"command\":\"{\\\"action\\\":\\\"decline-insurance\\\",\\\"kind\\\":\\\"play\\\"}\",\"commandId\":\"seat-10\",\"disposition\":\"applied\",\"sequence\":10},{\"command\":\"{\\\"action\\\":\\\"stand\\\",\\\"kind\\\":\\\"play\\\"}\",\"commandId\":\"seat-11\",\"disposition\":\"applied\",\"sequence\":11},{\"command\":\"{\\\"kind\\\":\\\"settle-turn\\\"}\",\"commandId\":\"seat-12\",\"disposition\":\"applied\",\"sequence\":12}],\"rules\":{\"dealer\":\"S17\",\"decks\":6,\"lateSurrender\":true,\"limits\":{\"initial\":{\"max\":\"1000\",\"min\":\"10\"}},\"penetration\":75,\"players\":{\"learnerSeat\":0,\"otherWagers\":[],\"strategy\":null}},\"schema\":13,\"sequence\":13,\"shoe\":{\"cut\":234,\"next\":15,\"order\":[25,132,107,15,210,3,63,179,220,201,283,37,247,200,137,79,35,64,56,38,97,294,30,130,238,146,138,161,249,214,127,104,86,258,2,134,11,180,227,159,114,285,152,99,47,39,206,269,217,98,279,71,287,101,88,198,234,300,42,57,13,67,221,115,261,110,136,171,22,26,248,303,92,128,65,311,288,58,33,62,16,119,170,271,292,45,82,169,7,219,19,5,230,203,204,59,70,6,83,280,43,302,262,87,53,267,260,297,60,100,211,117,286,291,143,199,259,176,95,240,229,84,125,113,61,290,226,202,256,187,156,81,275,74,103,20,270,298,140,265,23,184,109,177,52,166,181,106,123,31,135,309,40,196,0,228,266,235,273,158,4,116,66,252,131,172,232,168,304,241,186,278,96,111,183,12,34,307,213,308,164,296,299,281,48,150,165,239,289,251,243,236,17,178,225,257,197,29,205,122,46,293,118,188,274,254,276,218,102,189,174,208,139,246,55,282,193,72,167,145,191,245,284,124,233,80,222,163,73,49,8,190,154,231,41,147,77,277,21,209,242,50,1,10,153,51,182,195,120,253,212,263,28,90,216,155,250,301,207,192,305,18,69,121,224,185,36,295,264,237,310,91,144,94,173,244,9,27,89,129,68,112,78,194,75,255,160,306,151,76,268,24,54,157,215,32,14,142,133,141,93,223,108,126,44,175,105,148,149,162,85,272]},\"strategy\":null,\"turn\":3,\"wagers\":[]},\"betCorrection\":null,\"bets\":[{\"chosen\":\"20\",\"funding\":false,\"placed\":\"20\",\"position\":2,\"prescribed\":\"20\",\"resolution\":\"followed\",\"round\":1,\"trueCount\":0},{\"chosen\":\"20\",\"funding\":false,\"placed\":\"20\",\"position\":15,\"prescribed\":\"20\",\"resolution\":\"followed\",\"round\":2,\"trueCount\":0},{\"chosen\":\"20\",\"funding\":false,\"placed\":\"20\",\"position\":25,\"prescribed\":\"20\",\"resolution\":\"followed\",\"round\":3,\"trueCount\":0},{\"chosen\":null,\"funding\":true,\"placed\":null,\"position\":36,\"prescribed\":\"20\",\"resolution\":null,\"round\":4,\"trueCount\":0}],\"correction\":null,\"decisions\":[{\"attempts\":[{\"action\":\"stand\",\"refusal\":null}],\"explanation\":{\"cell\":{\"hand\":14,\"kind\":\"hard\",\"play\":\"stand\",\"table\":\"first\",\"up\":3},\"deviation\":null,\"ifUnaffordable\":null,\"kind\":\"play\",\"preferred\":\"stand\",\"prescribed\":{\"action\":\"stand\",\"amount\":null},\"situation\":{\"available\":\"10\",\"cards\":[{\"deck\":0,\"rank\":13,\"suit\":\"diamonds\"},{\"deck\":2,\"rank\":4,\"suit\":\"clubs\"}],\"count\":null,\"decision\":\"hand\",\"hand\":0,\"hands\":1,\"original\":true,\"pair\":false,\"stake\":\"20\",\"target\":\"hand-1\",\"total\":{\"soft\":false,\"value\":14},\"up\":{\"deck\":2,\"rank\":3,\"suit\":\"hearts\"}},\"unavailable\":[]},\"played\":\"stand\",\"position\":7,\"prompt\":null,\"resolution\":\"followed\"},{\"attempts\":[{\"action\":\"stand\",\"refusal\":null}],\"explanation\":{\"cell\":{\"hand\":17,\"kind\":\"hard\",\"play\":\"stand\",\"table\":\"first\",\"up\":10},\"deviation\":null,\"ifUnaffordable\":null,\"kind\":\"play\",\"preferred\":\"stand\",\"prescribed\":{\"action\":\"stand\",\"amount\":null},\"situation\":{\"available\":\"30\",\"cards\":[{\"deck\":3,\"rank\":11,\"suit\":\"diamonds\"},{\"deck\":3,\"rank\":7,\"suit\":\"spades\"}],\"count\":null,\"decision\":\"hand\",\"hand\":0,\"hands\":1,\"original\":true,\"pair\":false,\"stake\":\"20\",\"target\":\"hand-1\",\"total\":{\"soft\":false,\"value\":17},\"up\":{\"deck\":4,\"rank\":13,\"suit\":\"clubs\"}},\"unavailable\":[]},\"played\":\"stand\",\"position\":20,\"prompt\":null,\"resolution\":\"followed\"},{\"attempts\":[{\"action\":\"decline-insurance\",\"refusal\":null}],\"explanation\":{\"cell\":null,\"deviation\":null,\"ifUnaffordable\":null,\"kind\":\"play\",\"preferred\":\"decline-insurance\",\"prescribed\":{\"action\":\"decline-insurance\",\"amount\":null},\"situation\":{\"available\":\"10\",\"cards\":[{\"deck\":0,\"rank\":12,\"suit\":\"hearts\"},{\"deck\":3,\"rank\":6,\"suit\":\"spades\"}],\"count\":null,\"decision\":\"insurance\",\"hand\":0,\"hands\":1,\"original\":true,\"pair\":false,\"stake\":\"20\",\"target\":\"hand-1\",\"total\":{\"soft\":false,\"value\":16},\"up\":{\"deck\":4,\"rank\":1,\"suit\":\"spades\"}},\"unavailable\":[]},\"played\":\"decline-insurance\",\"position\":30,\"prompt\":null,\"resolution\":\"followed\"},{\"attempts\":[{\"action\":\"stand\",\"refusal\":null}],\"explanation\":{\"cell\":{\"hand\":16,\"kind\":\"hard\",\"play\":\"surrender\",\"table\":\"first\",\"up\":1},\"deviation\":null,\"ifUnaffordable\":null,\"kind\":\"play\",\"preferred\":\"surrender\",\"prescribed\":{\"action\":\"surrender\",\"amount\":null},\"situation\":{\"available\":\"10\",\"cards\":[{\"deck\":0,\"rank\":12,\"suit\":\"hearts\"},{\"deck\":3,\"rank\":6,\"suit\":\"spades\"}],\"count\":null,\"decision\":\"hand\",\"hand\":0,\"hands\":1,\"original\":true,\"pair\":false,\"stake\":\"20\",\"target\":\"hand-1\",\"total\":{\"soft\":false,\"value\":16},\"up\":{\"deck\":4,\"rank\":1,\"suit\":\"spades\"}},\"unavailable\":[]},\"played\":\"stand\",\"position\":31,\"prompt\":null,\"resolution\":\"departed\"}],\"ledger\":[{\"balance\":\"10\",\"change\":\"wager\",\"net\":null,\"position\":3,\"round\":1,\"wager\":\"20\"},{\"balance\":\"50\",\"change\":\"settled\",\"net\":\"20\",\"position\":11,\"round\":1,\"wager\":\"20\"},{\"balance\":\"30\",\"change\":\"wager\",\"net\":null,\"position\":16,\"round\":2,\"wager\":\"20\"},{\"balance\":\"30\",\"change\":\"settled\",\"net\":\"-20\",\"position\":21,\"round\":2,\"wager\":\"20\"},{\"balance\":\"10\",\"change\":\"wager\",\"net\":null,\"position\":26,\"round\":3,\"wager\":\"20\"},{\"balance\":\"10\",\"change\":\"settled\",\"net\":\"-20\",\"position\":32,\"round\":3,\"wager\":\"20\"}]},\"setup\":{\"baseWager\":\"20\",\"betSchedule\":true,\"interval\":1,\"policy\":{\"count\":\"player\",\"deviations\":[],\"fallbacks\":{\"double\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SHHHHHSHHS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"doubleOnOriginalLateSurrender\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHR\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SHHHHHSHHS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"splitByBalance\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"splitByRule\":[\"SSSSSSSSSS\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"surrender\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"PPPPPPPPPP\",\"HPPPPPPHHH\",\"HPPPPPPHHH\",\"HHHHPPHHHH\",\"HDDDDDDDDH\",\"HPPPPPHHHH\",\"HPPPPPPHHH\",\"PPPPPPPPPP\",\"SPPPPPSPPS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]}},\"first\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHR\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"PPPPPPPPPP\",\"HPPPPPPHHH\",\"HPPPPPPHHH\",\"HHHHPPHHHH\",\"HDDDDDDDDH\",\"HPPPPPHHHH\",\"HPPPPPPHHH\",\"PPPPPPPPPP\",\"SPPPPPSPPS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"later\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"laterWithoutDouble\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]}},\"rules\":{\"dealer\":\"S17\",\"decks\":6,\"id\":\"blackjack-six-deck\",\"lateSurrender\":true,\"limits\":{\"initial\":{\"max\":\"1000\",\"min\":\"10\"}},\"penetration\":75,\"players\":{\"learnerSeat\":0,\"otherWagers\":[],\"strategy\":null},\"version\":1},\"seat\":\"play\",\"startingBalance\":\"30\"},\"shoe\":null},\"variant\":\"check\"}",
      "continuation": [
        {
          "kind": "bet",
          "amount": "10"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "bet",
          "amount": "20"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        }
      ],
      "facts": "[{\"kind\":\"content-shown\",\"position\":37},{\"kind\":\"wager-placed\",\"position\":37},{\"kind\":\"content-shown\",\"position\":38},{\"kind\":\"content-shown\",\"position\":39},{\"kind\":\"content-shown\",\"position\":40},{\"kind\":\"content-shown\",\"position\":42},{\"kind\":\"content-shown\",\"position\":43},{\"kind\":\"round-settled\",\"net\":\"10\",\"position\":43},{\"kind\":\"checkpoint-due\",\"position\":44},{\"kind\":\"answer-accepted\",\"position\":44,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":45},{\"kind\":\"answer-accepted\",\"position\":45,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":46,\"scored\":true},{\"kind\":\"content-shown\",\"position\":48},{\"kind\":\"wager-placed\",\"position\":48},{\"kind\":\"content-shown\",\"position\":49},{\"kind\":\"content-shown\",\"position\":50},{\"kind\":\"content-shown\",\"position\":51},{\"kind\":\"content-shown\",\"position\":53},{\"kind\":\"round-settled\",\"net\":\"-20\",\"position\":53},{\"kind\":\"checkpoint-due\",\"position\":54},{\"kind\":\"answer-accepted\",\"position\":54,\"scored\":true},{\"ending\":\"insufficient-funds\",\"kind\":\"attempt-ended\"}]",
      "results": "{\"assistanceStep\":null,\"assisted\":false,\"ending\":\"insufficient-funds\",\"finances\":{\"finishingBalance\":\"0\",\"net\":\"-30\",\"startingBalance\":\"30\"},\"metrics\":{\"betting-adherence\":{\"correct\":4,\"total\":5},\"card-values\":null,\"playing-adherence\":{\"correct\":3,\"total\":6},\"running-count\":{\"correct\":3,\"total\":10},\"true-count\":{\"correct\":5,\"total\":5}},\"review\":[{\"checkpoint\":1,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":1,\"reference\":0,\"round\":1,\"timing\":\"before-bet\"},{\"checkpoint\":1,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":2,\"reference\":0,\"round\":1,\"timing\":\"before-bet\"},{\"chosen\":\"20\",\"kind\":\"table-bet\",\"override\":false,\"placed\":\"20\",\"position\":3,\"prescribed\":\"20\",\"resolution\":\"followed\",\"round\":1,\"trueCount\":0},{\"atEntered\":null,\"cards\":[{\"rank\":13,\"suit\":\"diamonds\"},{\"rank\":4,\"suit\":\"clubs\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":8,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":1,\"total\":{\"soft\":false,\"value\":14},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":3,\"suit\":\"hearts\"}},{\"checkpoint\":2,\"count\":\"running\",\"entered\":0,\"error\":-3,\"kind\":\"table\",\"position\":13,\"reference\":3,\"round\":1,\"timing\":\"after-round\"},{\"checkpoint\":3,\"count\":\"running\",\"entered\":0,\"error\":-3,\"kind\":\"table\",\"position\":14,\"reference\":3,\"round\":2,\"timing\":\"before-bet\"},{\"checkpoint\":3,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":15,\"reference\":0,\"round\":2,\"timing\":\"before-bet\"},{\"chosen\":\"20\",\"kind\":\"table-bet\",\"override\":false,\"placed\":\"20\",\"position\":16,\"prescribed\":\"20\",\"resolution\":\"followed\",\"round\":2,\"trueCount\":0},{\"atEntered\":null,\"cards\":[{\"rank\":11,\"suit\":\"diamonds\"},{\"rank\":7,\"suit\":\"spades\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":21,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":2,\"total\":{\"soft\":false,\"value\":17},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":13,\"suit\":\"clubs\"}},{\"checkpoint\":4,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":23,\"reference\":0,\"round\":2,\"timing\":\"after-round\"},{\"checkpoint\":5,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":24,\"reference\":0,\"round\":3,\"timing\":\"before-bet\"},{\"checkpoint\":5,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":25,\"reference\":0,\"round\":3,\"timing\":\"before-bet\"},{\"chosen\":\"20\",\"kind\":\"table-bet\",\"override\":false,\"placed\":\"20\",\"position\":26,\"prescribed\":\"20\",\"resolution\":\"followed\",\"round\":3,\"trueCount\":0},{\"atEntered\":null,\"cards\":[{\"rank\":12,\"suit\":\"hearts\"},{\"rank\":6,\"suit\":\"spades\"}],\"chosen\":\"decline-insurance\",\"countDependent\":false,\"decision\":\"insurance\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"decline-insurance\",\"position\":31,\"prescribed\":\"decline-insurance\",\"refused\":[],\"resolution\":\"followed\",\"round\":3,\"total\":{\"soft\":false,\"value\":16},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":1,\"suit\":\"spades\"}},{\"atEntered\":null,\"cards\":[{\"rank\":12,\"suit\":\"hearts\"},{\"rank\":6,\"suit\":\"spades\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":32,\"prescribed\":\"surrender\",\"refused\":[],\"resolution\":\"departed\",\"round\":3,\"total\":{\"soft\":false,\"value\":16},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":1,\"suit\":\"spades\"}},{\"checkpoint\":6,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":34,\"reference\":-1,\"round\":3,\"timing\":\"after-round\"},{\"checkpoint\":7,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":35,\"reference\":-1,\"round\":4,\"timing\":\"before-bet\"},{\"checkpoint\":7,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":36,\"reference\":0,\"round\":4,\"timing\":\"before-bet\"},{\"chosen\":\"10\",\"kind\":\"table-bet\",\"override\":true,\"placed\":\"10\",\"position\":37,\"prescribed\":\"20\",\"resolution\":\"overridden\",\"round\":4,\"trueCount\":0},{\"atEntered\":null,\"cards\":[{\"rank\":2,\"suit\":\"hearts\"},{\"rank\":13,\"suit\":\"clubs\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":42,\"prescribed\":\"hit\",\"refused\":[],\"resolution\":\"departed\",\"round\":4,\"total\":{\"soft\":false,\"value\":12},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":10,\"suit\":\"hearts\"}},{\"checkpoint\":8,\"count\":\"running\",\"entered\":0,\"error\":2,\"kind\":\"table\",\"position\":45,\"reference\":-2,\"round\":4,\"timing\":\"after-round\"},{\"checkpoint\":9,\"count\":\"running\",\"entered\":0,\"error\":2,\"kind\":\"table\",\"position\":46,\"reference\":-2,\"round\":5,\"timing\":\"before-bet\"},{\"checkpoint\":9,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":47,\"reference\":0,\"round\":5,\"timing\":\"before-bet\"},{\"chosen\":\"20\",\"kind\":\"table-bet\",\"override\":false,\"placed\":\"20\",\"position\":48,\"prescribed\":\"20\",\"resolution\":\"followed\",\"round\":5,\"trueCount\":0},{\"atEntered\":null,\"cards\":[{\"rank\":7,\"suit\":\"spades\"},{\"rank\":5,\"suit\":\"hearts\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":53,\"prescribed\":\"hit\",\"refused\":[],\"resolution\":\"departed\",\"round\":5,\"total\":{\"soft\":false,\"value\":12},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":9,\"suit\":\"hearts\"}},{\"checkpoint\":10,\"count\":\"running\",\"entered\":0,\"error\":2,\"kind\":\"table\",\"position\":55,\"reference\":-2,\"round\":5,\"timing\":\"after-round\"}]}"
    },
    {
      "name": "table Play Check, a double refused for funds",
      "category": "table",
      "phase": "decision",
      "specification": {
        "attemptId": "attempt-1",
        "content": {
          "category": "table",
          "id": "table",
          "reference": {
            "id": "blackjack-reference",
            "version": 1
          },
          "rounds": 10,
          "version": 1
        },
        "device": "device-1",
        "owner": "owner-1",
        "table": {
          "baseWager": "10",
          "betSchedule": false,
          "interval": 1,
          "policy": {
            "count": "player",
            "deviations": [],
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
                "pair": [
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "SHHHHHSHHS",
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
                "pair": [
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "HHHHHHHHHH",
                  "SHHHHHSHHS",
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
                ]
              },
              "splitByBalance": [
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HSSSSSHHHH",
                "HSSSSSHHHH",
                "RSSSSSHHRR",
                "SSSSSSSSSS",
                "SSSSSSSSSS"
              ],
              "splitByRule": [
                "SSSSSSSSSS",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HHHHHHHHHH",
                "HDDDDDDDDH",
                "HSSSSSHHHH",
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
                ],
                "soft": [
                  "HHHHHHHHHH",
                  "HHHHDDHHHH",
                  "HHHHDDHHHH",
                  "HHHDDDHHHH",
                  "HHHDDDHHHH",
                  "HHDDDDHHHH",
                  "HSDDDDSSHH",
                  "SSSSSSSSSS",
                  "SSSSSSSSSS"
                ]
              }
            },
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
              ],
              "soft": [
                "HHHHHHHHHH",
                "HHHHDDHHHH",
                "HHHHDDHHHH",
                "HHHDDDHHHH",
                "HHHDDDHHHH",
                "HHDDDDHHHH",
                "HSDDDDSSHH",
                "SSSSSSSSSS",
                "SSSSSSSSSS"
              ]
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
                "HHHHHHHHHH",
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
          },
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
          "seat": "play",
          "startingBalance": "10"
        },
        "variant": "check"
      },
      "random": {
        "key": [
          1,
          2654435769
        ],
        "protocol": 1,
        "session": [
          8,
          0
        ]
      },
      "checkpoint": "{\"answers\":[{\"first\":0,\"last\":0,\"position\":0,\"tries\":1},{\"first\":0,\"last\":0,\"position\":1,\"tries\":1}],\"attempt\":{\"device\":\"device-1\",\"id\":\"attempt-1\",\"owner\":\"owner-1\"},\"content\":{\"category\":\"table\",\"id\":\"table\",\"reference\":{\"id\":\"blackjack-reference\",\"version\":1},\"rounds\":10,\"version\":1},\"ending\":null,\"identities\":{\"category\":\"table\",\"content\":{\"id\":\"table\",\"version\":1},\"engine\":\"0.0.0\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":{\"id\":\"blackjack-reference\",\"version\":1}},\"items\":[{\"checkpoint\":1,\"count\":\"running\",\"round\":1,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"checkpoint\":1,\"count\":\"true\",\"round\":1,\"step\":\"prompt\",\"timing\":\"before-bet\"},{\"events\":[],\"face\":{\"rank\":13,\"suit\":\"diamonds\"},\"round\":1,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":{\"rank\":3,\"suit\":\"hearts\"},\"round\":1,\"step\":\"deal\",\"to\":\"dealer\"},{\"events\":[],\"face\":{\"rank\":4,\"suit\":\"clubs\"},\"round\":1,\"step\":\"deal\",\"to\":\"hand-1\"},{\"events\":[],\"face\":null,\"round\":1,\"step\":\"deal\",\"to\":\"dealer\"},{\"actions\":[\"hit\",\"stand\",\"surrender\"],\"decision\":\"hand\",\"events\":[],\"round\":1,\"step\":\"decision\",\"target\":\"hand-1\",\"unaffordable\":[{\"action\":\"double\",\"amount\":\"10\"}]}],\"phase\":\"decision\",\"position\":6,\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":0,\"protocol\":1,\"session\":[8,0]},\"receipts\":[{\"command\":\"{\\\"kind\\\":\\\"begin\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":0}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-4\",\"disposition\":\"applied\",\"sequence\":4},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-5\",\"disposition\":\"applied\",\"sequence\":5},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-6\",\"disposition\":\"applied\",\"sequence\":6},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-7\",\"disposition\":\"applied\",\"sequence\":7},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-8\",\"disposition\":\"applied\",\"sequence\":8},{\"command\":\"{\\\"action\\\":\\\"double\\\",\\\"kind\\\":\\\"play\\\"}\",\"commandId\":\"record-9\",\"disposition\":\"applied\",\"sequence\":9}],\"rejected\":0,\"revealedAt\":null,\"schema\":13,\"sequence\":10,\"table\":{\"round\":1,\"seat\":{\"activity\":{\"activity\":{\"device\":\"device-1\",\"id\":\"attempt-1/seat\",\"owner\":\"owner-1\"},\"balance\":\"0\",\"funding\":{\"buyIn\":\"10\",\"maxDrawdown\":\"0\",\"peak\":\"0\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"blackjack\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":{\"id\":\"blackjack-reference\",\"version\":1},\"rules\":{\"id\":\"blackjack-six-deck\",\"version\":1},\"strategy\":null},\"outcome\":{\"active\":0,\"dealer\":[{\"deck\":2,\"rank\":3,\"suit\":\"hearts\"},{\"deck\":0,\"rank\":3,\"suit\":\"diamonds\"}],\"hands\":[{\"cards\":[{\"deck\":0,\"rank\":13,\"suit\":\"diamonds\"},{\"deck\":2,\"rank\":4,\"suit\":\"clubs\"}],\"done\":false,\"doubled\":false,\"surrendered\":false,\"target\":\"hand-1\"}],\"holeRevealed\":false,\"insurance\":\"not-offered\",\"others\":[],\"peek\":\"not-needed\"},\"phase\":\"open-decision\",\"random\":{\"block\":[77,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":3,\"protocol\":1,\"session\":[8,0]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"hand-1\\\"}\",\"commandId\":\"seat-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"seat-1\",\"disposition\":\"applied\",\"sequence\":1}],\"rules\":{\"dealer\":\"S17\",\"decks\":6,\"lateSurrender\":true,\"limits\":{\"initial\":{\"max\":\"1000\",\"min\":\"10\"}},\"penetration\":75,\"players\":{\"learnerSeat\":0,\"otherWagers\":[],\"strategy\":null}},\"schema\":13,\"sequence\":2,\"shoe\":{\"cut\":234,\"next\":4,\"order\":[25,132,107,15,210,3,63,179,220,201,283,37,247,200,137,79,35,64,56,38,97,294,30,130,238,146,138,161,249,214,127,104,86,258,2,134,11,180,227,159,114,285,152,99,47,39,206,269,217,98,279,71,287,101,88,198,234,300,42,57,13,67,221,115,261,110,136,171,22,26,248,303,92,128,65,311,288,58,33,62,16,119,170,271,292,45,82,169,7,219,19,5,230,203,204,59,70,6,83,280,43,302,262,87,53,267,260,297,60,100,211,117,286,291,143,199,259,176,95,240,229,84,125,113,61,290,226,202,256,187,156,81,275,74,103,20,270,298,140,265,23,184,109,177,52,166,181,106,123,31,135,309,40,196,0,228,266,235,273,158,4,116,66,252,131,172,232,168,304,241,186,278,96,111,183,12,34,307,213,308,164,296,299,281,48,150,165,239,289,251,243,236,17,178,225,257,197,29,205,122,46,293,118,188,274,254,276,218,102,189,174,208,139,246,55,282,193,72,167,145,191,245,284,124,233,80,222,163,73,49,8,190,154,231,41,147,77,277,21,209,242,50,1,10,153,51,182,195,120,253,212,263,28,90,216,155,250,301,207,192,305,18,69,121,224,185,36,295,264,237,310,91,144,94,173,244,9,27,89,129,68,112,78,194,75,255,160,306,151,76,268,24,54,157,215,32,14,142,133,141,93,223,108,126,44,175,105,148,149,162,85,272]},\"strategy\":null,\"turn\":1,\"wagers\":[{\"amount\":\"10\",\"target\":\"hand-1\"}]},\"betCorrection\":null,\"bets\":[],\"correction\":null,\"decisions\":[{\"attempts\":[{\"action\":\"double\",\"refusal\":\"funds\"}],\"explanation\":{\"cell\":{\"hand\":14,\"kind\":\"hard\",\"play\":\"stand\",\"table\":\"first\",\"up\":3},\"deviation\":null,\"ifUnaffordable\":null,\"kind\":\"play\",\"preferred\":\"stand\",\"prescribed\":{\"action\":\"stand\",\"amount\":null},\"situation\":{\"available\":\"0\",\"cards\":[{\"deck\":0,\"rank\":13,\"suit\":\"diamonds\"},{\"deck\":2,\"rank\":4,\"suit\":\"clubs\"}],\"count\":null,\"decision\":\"hand\",\"hand\":0,\"hands\":1,\"original\":true,\"pair\":false,\"stake\":\"10\",\"target\":\"hand-1\",\"total\":{\"soft\":false,\"value\":14},\"up\":{\"deck\":2,\"rank\":3,\"suit\":\"hearts\"}},\"unavailable\":[]},\"played\":null,\"position\":6,\"prompt\":null,\"resolution\":null}],\"ledger\":[{\"balance\":\"0\",\"change\":\"wager\",\"net\":null,\"position\":2,\"round\":1,\"wager\":\"10\"}]},\"setup\":{\"baseWager\":\"10\",\"betSchedule\":false,\"interval\":1,\"policy\":{\"count\":\"player\",\"deviations\":[],\"fallbacks\":{\"double\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SHHHHHSHHS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"doubleOnOriginalLateSurrender\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHR\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SHHHHHSHHS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"splitByBalance\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"splitByRule\":[\"SSSSSSSSSS\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"surrender\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"PPPPPPPPPP\",\"HPPPPPPHHH\",\"HPPPPPPHHH\",\"HHHHPPHHHH\",\"HDDDDDDDDH\",\"HPPPPPHHHH\",\"HPPPPPPHHH\",\"PPPPPPPPPP\",\"SPPPPPSPPS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]}},\"first\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHR\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"PPPPPPPPPP\",\"HPPPPPPHHH\",\"HPPPPPPHHH\",\"HHHHPPHHHH\",\"HDDDDDDDDH\",\"HPPPPPHHHH\",\"HPPPPPPHHH\",\"PPPPPPPPPP\",\"SPPPPPSPPS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"later\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"laterWithoutDouble\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]}},\"rules\":{\"dealer\":\"S17\",\"decks\":6,\"id\":\"blackjack-six-deck\",\"lateSurrender\":true,\"limits\":{\"initial\":{\"max\":\"1000\",\"min\":\"10\"}},\"penetration\":75,\"players\":{\"learnerSeat\":0,\"otherWagers\":[],\"strategy\":null},\"version\":1},\"seat\":\"play\",\"startingBalance\":\"10\"},\"shoe\":null},\"variant\":\"check\"}",
      "continuation": [
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "play",
          "action": "decline-insurance"
        },
        {
          "kind": "play",
          "action": "stand"
        },
        {
          "kind": "next-item"
        },
        {
          "kind": "answer",
          "value": 0
        },
        {
          "kind": "next-item"
        }
      ],
      "facts": "[{\"kind\":\"content-shown\",\"position\":7},{\"kind\":\"content-shown\",\"position\":8},{\"kind\":\"content-shown\",\"position\":9},{\"kind\":\"content-shown\",\"position\":10},{\"kind\":\"round-settled\",\"net\":\"10\",\"position\":10},{\"kind\":\"checkpoint-due\",\"position\":11},{\"kind\":\"answer-accepted\",\"position\":11,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":12},{\"kind\":\"answer-accepted\",\"position\":12,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":13,\"scored\":true},{\"kind\":\"content-shown\",\"position\":14},{\"kind\":\"wager-placed\",\"position\":14},{\"kind\":\"content-shown\",\"position\":15},{\"kind\":\"content-shown\",\"position\":16},{\"kind\":\"content-shown\",\"position\":17},{\"kind\":\"content-shown\",\"position\":19},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":19},{\"kind\":\"checkpoint-due\",\"position\":20},{\"kind\":\"answer-accepted\",\"position\":20,\"scored\":true},{\"kind\":\"checkpoint-due\",\"position\":21},{\"kind\":\"answer-accepted\",\"position\":21,\"scored\":true},{\"kind\":\"answer-accepted\",\"position\":22,\"scored\":true},{\"kind\":\"content-shown\",\"position\":23},{\"kind\":\"wager-placed\",\"position\":23},{\"kind\":\"content-shown\",\"position\":24},{\"kind\":\"content-shown\",\"position\":25},{\"kind\":\"content-shown\",\"position\":26},{\"kind\":\"content-shown\",\"position\":29},{\"kind\":\"round-settled\",\"net\":\"-10\",\"position\":29},{\"kind\":\"checkpoint-due\",\"position\":30},{\"kind\":\"answer-accepted\",\"position\":30,\"scored\":true},{\"ending\":\"insufficient-funds\",\"kind\":\"attempt-ended\"}]",
      "results": "{\"assistanceStep\":null,\"assisted\":false,\"ending\":\"insufficient-funds\",\"finances\":{\"finishingBalance\":\"0\",\"net\":\"-10\",\"startingBalance\":\"10\"},\"metrics\":{\"betting-adherence\":null,\"card-values\":null,\"playing-adherence\":{\"correct\":3,\"total\":4},\"running-count\":{\"correct\":3,\"total\":6},\"true-count\":{\"correct\":3,\"total\":3}},\"review\":[{\"checkpoint\":1,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":1,\"reference\":0,\"round\":1,\"timing\":\"before-bet\"},{\"checkpoint\":1,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":2,\"reference\":0,\"round\":1,\"timing\":\"before-bet\"},{\"atEntered\":null,\"cards\":[{\"rank\":13,\"suit\":\"diamonds\"},{\"rank\":4,\"suit\":\"clubs\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":7,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":1,\"total\":{\"soft\":false,\"value\":14},\"trueCount\":0,\"unaffordable\":[\"double\"],\"up\":{\"rank\":3,\"suit\":\"hearts\"}},{\"checkpoint\":2,\"count\":\"running\",\"entered\":0,\"error\":-3,\"kind\":\"table\",\"position\":12,\"reference\":3,\"round\":1,\"timing\":\"after-round\"},{\"checkpoint\":3,\"count\":\"running\",\"entered\":0,\"error\":-3,\"kind\":\"table\",\"position\":13,\"reference\":3,\"round\":2,\"timing\":\"before-bet\"},{\"checkpoint\":3,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":14,\"reference\":0,\"round\":2,\"timing\":\"before-bet\"},{\"atEntered\":null,\"cards\":[{\"rank\":11,\"suit\":\"diamonds\"},{\"rank\":7,\"suit\":\"spades\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":19,\"prescribed\":\"stand\",\"refused\":[],\"resolution\":\"followed\",\"round\":2,\"total\":{\"soft\":false,\"value\":17},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":13,\"suit\":\"clubs\"}},{\"checkpoint\":4,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":21,\"reference\":0,\"round\":2,\"timing\":\"after-round\"},{\"checkpoint\":5,\"count\":\"running\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":22,\"reference\":0,\"round\":3,\"timing\":\"before-bet\"},{\"checkpoint\":5,\"count\":\"true\",\"entered\":0,\"error\":0,\"kind\":\"table\",\"position\":23,\"reference\":0,\"round\":3,\"timing\":\"before-bet\"},{\"atEntered\":null,\"cards\":[{\"rank\":12,\"suit\":\"hearts\"},{\"rank\":6,\"suit\":\"spades\"}],\"chosen\":\"decline-insurance\",\"countDependent\":false,\"decision\":\"insurance\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"decline-insurance\",\"position\":28,\"prescribed\":\"decline-insurance\",\"refused\":[],\"resolution\":\"followed\",\"round\":3,\"total\":{\"soft\":false,\"value\":16},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":1,\"suit\":\"spades\"}},{\"atEntered\":null,\"cards\":[{\"rank\":12,\"suit\":\"hearts\"},{\"rank\":6,\"suit\":\"spades\"}],\"chosen\":\"stand\",\"countDependent\":false,\"decision\":\"hand\",\"entered\":null,\"fallback\":false,\"hand\":0,\"hands\":1,\"kind\":\"table-decision\",\"pair\":false,\"played\":\"stand\",\"position\":29,\"prescribed\":\"surrender\",\"refused\":[],\"resolution\":\"departed\",\"round\":3,\"total\":{\"soft\":false,\"value\":16},\"trueCount\":0,\"unaffordable\":[],\"up\":{\"rank\":1,\"suit\":\"spades\"}},{\"checkpoint\":6,\"count\":\"running\",\"entered\":0,\"error\":1,\"kind\":\"table\",\"position\":31,\"reference\":-1,\"round\":3,\"timing\":\"after-round\"}]}"
    }
  ]
};
