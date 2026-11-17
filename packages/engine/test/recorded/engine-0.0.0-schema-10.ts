// docs/development.md Releases: recorded checkpoints and the quarantine list
import type { RecordedBuild } from './index';

export const RECORDED_ENGINE_0_0_0_SCHEMA_10: RecordedBuild = {
  "engine": "0.0.0",
  "schema": 10,
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
      "checkpoint": "{\"activity\":{\"device\":\"device-1\",\"id\":\"activity-1\",\"owner\":\"local\"},\"balance\":\"985\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"0\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"roulette\",\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"version\":1},\"strategy\":null},\"outcome\":null,\"phase\":\"open-decision\",\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[2752067618,698298832],\"lane\":0,\"protocol\":1,\"session\":[320440878,57701188]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"red\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"amount\\\":\\\"5\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"straight-17\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1}],\"rules\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheel\":\"single-zero\"},\"schema\":10,\"sequence\":2,\"strategy\":null,\"turn\":0,\"wagers\":[{\"amount\":\"5\",\"target\":\"straight-17\"},{\"amount\":\"10\",\"target\":\"red\"}]}",
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
      "checkpoint": "{\"activity\":{\"device\":\"device-1\",\"id\":\"activity-1\",\"owner\":\"local\"},\"balance\":\"990\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"0\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"roulette\",\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"version\":1},\"strategy\":null},\"outcome\":{\"pocket\":27,\"turn\":1},\"phase\":\"revealing-outcome\",\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[2752067618,698298832],\"lane\":1,\"protocol\":1,\"session\":[320440878,57701188]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"red\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1}],\"rules\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheel\":\"single-zero\"},\"schema\":10,\"sequence\":2,\"strategy\":null,\"turn\":1,\"wagers\":[{\"amount\":\"10\",\"target\":\"red\"}]}",
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
      "checkpoint": "{\"activity\":{\"device\":\"device-1\",\"id\":\"activity-1\",\"owner\":\"local\"},\"balance\":\"990\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"10\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"roulette\",\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"version\":1},\"strategy\":null},\"outcome\":{\"pocket\":27,\"turn\":1},\"phase\":\"open-decision\",\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[2752067618,698298832],\"lane\":1,\"protocol\":1,\"session\":[320440878,57701188]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"red\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"settle-turn\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"amount\\\":\\\"20\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"black\\\"}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3}],\"rules\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheel\":\"single-zero\"},\"schema\":10,\"sequence\":4,\"strategy\":null,\"turn\":1,\"wagers\":[{\"amount\":\"20\",\"target\":\"black\"}]}",
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
      "checkpoint": "{\"activity\":{\"device\":\"device-1\",\"id\":\"activity-1\",\"owner\":\"local\"},\"balance\":\"1010\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"10\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"roulette\",\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"version\":1},\"strategy\":null},\"outcome\":{\"pocket\":27,\"turn\":1},\"phase\":\"final-settlement\",\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[2752067618,698298832],\"lane\":1,\"protocol\":1,\"session\":[320440878,57701188]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"red\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"settle-turn\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"even\\\"}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3},{\"command\":\"{\\\"kind\\\":\\\"request-stop\\\"}\",\"commandId\":\"record-4\",\"disposition\":\"applied\",\"sequence\":4}],\"rules\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheel\":\"single-zero\"},\"schema\":10,\"sequence\":5,\"strategy\":null,\"turn\":1,\"wagers\":[]}",
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
      "checkpoint": "{\"activity\":{\"device\":\"device-1\",\"id\":\"activity-1\",\"owner\":\"local\"},\"balance\":\"950\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"0\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"roulette\",\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"version\":1},\"strategy\":{\"id\":\"test-flat-even-money\",\"version\":1}},\"outcome\":null,\"phase\":\"correction\",\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[2752067618,698298832],\"lane\":0,\"protocol\":1,\"session\":[320440878,57701188]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"50\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"red\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"assessed\",\"sequence\":1}],\"rules\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheel\":\"single-zero\"},\"schema\":10,\"sequence\":2,\"strategy\":{\"coachedTurn\":false,\"correction\":{\"actual\":[{\"amount\":\"50\",\"target\":\"red\"}],\"explanation\":{\"fallback\":null,\"instructions\":[{\"id\":\"flat\",\"label\":\"1 unit on the target, every spin\"}],\"prescription\":{\"bets\":[{\"amount\":\"10\",\"target\":\"red\"}],\"held\":[],\"status\":\"prescribed\"},\"situation\":{\"available\":\"1000\",\"subjects\":{\"last-pocket-color\":\"none\",\"last-result\":\"none\"},\"values\":{}},\"state\":{\"counters\":{},\"cycleTurn\":0,\"lastResult\":\"none\",\"lists\":{}}},\"id\":\"activity-1/departure/1\",\"turn\":1},\"cycle\":{\"number\":1,\"turns\":[]},\"cycleEnd\":null,\"decisions\":{\"betting\":0,\"playing\":0},\"deferred\":null,\"definition\":{\"adjustments\":[],\"counters\":[],\"format\":1,\"game\":\"roulette\",\"id\":\"test-flat-even-money\",\"instructions\":[{\"bets\":[{\"amount\":{\"lit\":\"10\"},\"target\":{\"param\":\"target\"}}],\"id\":\"flat\",\"label\":\"1 unit on the target, every spin\",\"when\":{\"always\":true}}],\"name\":\"Flat even-money\",\"parameters\":[{\"choices\":[\"red\",\"black\",\"odd\",\"even\",\"low\",\"high\"],\"default\":\"red\",\"id\":\"target\",\"label\":\"Target\"}],\"revision\":1,\"stopWhen\":null,\"table\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheels\":[\"single-zero\",\"double-zero\"]}},\"departures\":[],\"parameters\":{\"target\":\"red\"},\"progress\":{\"counters\":{},\"cycleTurn\":0,\"lastResult\":\"none\",\"lists\":{}},\"status\":\"active\"},\"turn\":0,\"wagers\":[{\"amount\":\"50\",\"target\":\"red\"}]}",
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
      "checkpoint": "{\"activity\":{\"device\":\"device-1\",\"id\":\"activity-1\",\"owner\":\"local\"},\"balance\":\"1050\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"50\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"roulette\",\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"version\":1},\"strategy\":{\"id\":\"test-doubling\",\"version\":3}},\"outcome\":{\"pocket\":27,\"turn\":1},\"phase\":\"cycle-completion\",\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[2752067618,698298832],\"lane\":1,\"protocol\":1,\"session\":[320440878,57701188]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"50\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"red\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"assessed\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"override-correction\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"kind\\\":\\\"settle-turn\\\"}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3}],\"rules\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheel\":\"single-zero\"},\"schema\":10,\"sequence\":4,\"strategy\":{\"coachedTurn\":false,\"correction\":null,\"cycle\":{\"number\":1,\"turns\":[{\"followed\":false,\"net\":\"50\",\"outcome\":\"27\",\"turn\":1,\"wagers\":[{\"amount\":\"50\",\"target\":\"red\"}]}]},\"cycleEnd\":\"override\",\"decisions\":{\"betting\":1,\"playing\":0},\"deferred\":null,\"definition\":{\"adjustments\":[{\"counter\":\"stake\",\"id\":\"double\",\"on\":\"loss\",\"to\":{\"mul\":[{\"counter\":\"stake\"},{\"lit\":\"2\"}]}},{\"counter\":\"stake\",\"id\":\"reset\",\"on\":\"win\",\"to\":{\"lit\":\"10\"}}],\"counters\":[{\"cap\":\"320\",\"id\":\"stake\",\"initial\":\"10\"}],\"format\":1,\"game\":\"roulette\",\"id\":\"test-doubling\",\"instructions\":[{\"bets\":[{\"amount\":{\"counter\":\"stake\"},\"target\":{\"target\":\"red\"}}],\"id\":\"bet\",\"label\":\"The stake on red\",\"when\":{\"always\":true}}],\"name\":\"Doubling on red\",\"parameters\":[],\"revision\":3,\"stopWhen\":null,\"table\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheels\":[\"single-zero\",\"double-zero\"]}},\"departures\":[{\"actual\":[{\"amount\":\"50\",\"target\":\"red\"}],\"explanation\":{\"fallback\":null,\"instructions\":[{\"id\":\"bet\",\"label\":\"The stake on red\"}],\"prescription\":{\"bets\":[{\"amount\":\"10\",\"target\":\"red\"}],\"held\":[],\"status\":\"prescribed\"},\"situation\":{\"available\":\"1000\",\"subjects\":{\"last-pocket-color\":\"none\",\"last-result\":\"none\"},\"values\":{}},\"state\":{\"counters\":{\"stake\":\"10\"},\"cycleTurn\":0,\"lastResult\":\"none\",\"lists\":{}}},\"id\":\"activity-1/departure/1\",\"resolution\":\"overridden\",\"turn\":1}],\"parameters\":{},\"progress\":{\"counters\":{\"stake\":\"10\"},\"cycleTurn\":0,\"lastResult\":\"none\",\"lists\":{}},\"status\":\"cycle-ended\"},\"turn\":1,\"wagers\":[]}",
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
      "checkpoint": "{\"activity\":{\"device\":\"device-1\",\"id\":\"craps-1\",\"owner\":\"local\"},\"balance\":\"990\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"0\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"craps\",\"random\":{\"key\":[1,0],\"protocol\":1,\"session\":[0,0]},\"reference\":null,\"rules\":{\"id\":\"standard-craps\",\"version\":2},\"strategy\":null},\"instructions\":[],\"outcome\":{\"dice\":[5,1],\"turn\":1},\"phase\":\"settled-outcome\",\"point\":6,\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[1,0],\"lane\":2,\"protocol\":1,\"session\":[0,0]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"pass\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"amount\\\":\\\"5\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"field\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"assessed\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"kind\\\":\\\"settle-turn\\\"}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3}],\"rules\":{\"field\":\"triple-12\",\"limits\":{\"flat\":{\"max\":\"1000\",\"min\":\"10\"},\"props\":{\"max\":\"100\",\"min\":\"1\"}},\"odds\":\"3-4-5x\"},\"schema\":10,\"sequence\":4,\"strategy\":null,\"turn\":1,\"wagers\":[{\"amount\":\"10\",\"target\":\"pass\"}]}",
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
      "checkpoint": "{\"activity\":{\"device\":\"device-1\",\"id\":\"craps-1\",\"owner\":\"local\"},\"balance\":\"990\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"0\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"craps\",\"random\":{\"key\":[1,0],\"protocol\":1,\"session\":[0,0]},\"reference\":null,\"rules\":{\"id\":\"standard-craps\",\"version\":2},\"strategy\":{\"id\":\"test-pass-with-odds\",\"version\":1}},\"instructions\":[],\"outcome\":{\"dice\":[5,1],\"turn\":1},\"phase\":\"strategy-settlement\",\"point\":6,\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[1,0],\"lane\":2,\"protocol\":1,\"session\":[0,0]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"pass\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"settle-turn\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"kind\\\":\\\"stop-strategy\\\"}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3}],\"rules\":{\"field\":\"triple-12\",\"limits\":{\"flat\":{\"max\":\"1000\",\"min\":\"10\"},\"props\":{\"max\":\"100\",\"min\":\"1\"}},\"odds\":\"3-4-5x\"},\"schema\":10,\"sequence\":4,\"strategy\":{\"coachedTurn\":false,\"correction\":null,\"cycle\":{\"number\":1,\"turns\":[{\"followed\":true,\"net\":\"0\",\"outcome\":\"5+1\",\"turn\":1,\"wagers\":[{\"amount\":\"10\",\"target\":\"pass\"}]}]},\"cycleEnd\":null,\"decisions\":{\"betting\":1,\"playing\":0},\"deferred\":null,\"definition\":{\"adjustments\":[],\"counters\":[],\"format\":1,\"game\":\"craps\",\"id\":\"test-pass-with-odds\",\"instructions\":[{\"bets\":[{\"amount\":{\"lit\":\"10\"},\"target\":{\"target\":\"pass\"}}],\"id\":\"come-out\",\"label\":\"Pass 10 on the come-out\",\"when\":{\"is\":\"none\",\"subject\":\"point\"}},{\"bets\":[{\"amount\":{\"lit\":\"10\"},\"target\":{\"target\":\"pass\"}},{\"amount\":{\"lit\":\"10\"},\"target\":{\"target\":\"pass-odds\"}}],\"id\":\"odds\",\"label\":\"10 odds behind the pass line\",\"when\":{\"any\":[{\"all\":[{\"is\":\"4\",\"subject\":\"point\"},{\"is\":\"on\",\"subject\":\"pass\"}]},{\"all\":[{\"is\":\"5\",\"subject\":\"point\"},{\"is\":\"on\",\"subject\":\"pass\"}]},{\"all\":[{\"is\":\"6\",\"subject\":\"point\"},{\"is\":\"on\",\"subject\":\"pass\"}]},{\"all\":[{\"is\":\"8\",\"subject\":\"point\"},{\"is\":\"on\",\"subject\":\"pass\"}]},{\"all\":[{\"is\":\"9\",\"subject\":\"point\"},{\"is\":\"on\",\"subject\":\"pass\"}]},{\"all\":[{\"is\":\"10\",\"subject\":\"point\"},{\"is\":\"on\",\"subject\":\"pass\"}]}]}}],\"name\":\"Pass with odds\",\"parameters\":[],\"revision\":1,\"stopWhen\":null,\"table\":{\"limits\":{\"flat\":{\"max\":\"1000\",\"min\":\"10\"},\"props\":{\"max\":\"100\",\"min\":\"1\"}},\"odds\":[\"1x\",\"2x\",\"3-4-5x\",\"5x\",\"10x\"]}},\"departures\":[],\"parameters\":{},\"progress\":{\"counters\":{},\"cycleTurn\":1,\"lastResult\":\"push\",\"lists\":{}},\"status\":\"stopped\"},\"turn\":1,\"wagers\":[{\"amount\":\"10\",\"target\":\"pass\"}]}",
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
      "checkpoint": "{\"activity\":{\"device\":\"device-1\",\"id\":\"blackjack-1\",\"owner\":\"local\"},\"balance\":\"990\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"0\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"blackjack\",\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"reference\":null,\"rules\":{\"id\":\"blackjack-six-deck\",\"version\":1},\"strategy\":null},\"outcome\":{\"active\":0,\"dealer\":[{\"deck\":1,\"rank\":10,\"suit\":\"spades\"},{\"deck\":3,\"rank\":6,\"suit\":\"spades\"}],\"hands\":[{\"cards\":[{\"deck\":2,\"rank\":10,\"suit\":\"spades\"},{\"deck\":1,\"rank\":11,\"suit\":\"diamonds\"}],\"done\":false,\"doubled\":false,\"surrendered\":false,\"target\":\"hand-1\"}],\"holeRevealed\":false,\"insurance\":\"not-offered\",\"others\":[],\"peek\":\"no-blackjack\"},\"phase\":\"open-decision\",\"random\":{\"block\":[77,0],\"exhausted\":false,\"key\":[2752067618,698298832],\"lane\":3,\"protocol\":1,\"session\":[320440878,57701188]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"hand-1\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1}],\"rules\":{\"dealer\":\"S17\",\"decks\":6,\"lateSurrender\":true,\"limits\":{\"initial\":{\"max\":\"1000\",\"min\":\"10\"}},\"penetration\":75,\"players\":{\"learnerSeat\":0,\"otherWagers\":[],\"strategy\":null}},\"schema\":10,\"sequence\":2,\"shoe\":{\"cut\":234,\"next\":4,\"order\":[152,100,75,200,65,35,242,282,199,132,190,280,241,71,178,116,209,74,95,225,151,16,155,72,268,18,239,39,187,191,119,156,188,123,231,186,243,276,91,208,179,32,279,184,109,196,27,53,29,263,44,61,234,11,41,33,183,106,244,114,122,262,54,289,235,133,120,181,150,229,292,307,103,232,67,141,189,217,167,245,115,129,51,285,76,73,161,134,0,13,8,126,83,298,63,64,124,185,7,146,137,306,224,138,30,59,297,154,164,250,213,201,34,98,9,219,77,211,10,284,93,88,136,104,43,286,270,40,130,110,149,24,171,17,112,157,36,304,274,256,153,246,58,172,197,139,143,162,267,26,214,94,160,203,227,78,45,113,247,21,301,278,79,14,87,80,273,218,135,23,308,2,252,302,1,253,66,111,261,221,305,55,228,163,92,57,175,22,281,264,6,15,210,216,147,81,68,290,85,125,19,283,117,192,170,56,265,176,287,127,140,168,173,174,311,237,108,177,220,204,266,82,212,248,158,69,60,255,233,296,159,293,28,166,5,207,294,20,142,25,105,84,309,12,238,275,128,259,37,295,303,165,90,193,180,198,257,271,277,121,230,182,97,260,310,249,269,223,101,300,215,206,4,31,50,38,47,48,42,102,131,194,195,49,288,240,96,118,52,226,145,205,202,99,299,272,169,3,222,144,62,89,254,291,46,236,107,251,86,148,258,70]},\"strategy\":null,\"turn\":1,\"wagers\":[{\"amount\":\"10\",\"target\":\"hand-1\"}]}",
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
      "checkpoint": "{\"activity\":{\"device\":\"device-1\",\"id\":\"blackjack-1\",\"owner\":\"local\"},\"balance\":\"950\",\"funding\":{\"buyIn\":\"1000\",\"maxDrawdown\":\"0\",\"peak\":\"0\",\"rebuys\":[],\"source\":\"practice-funding\"},\"identities\":{\"engine\":\"0.0.0\",\"game\":\"blackjack\",\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"reference\":null,\"rules\":{\"id\":\"blackjack-six-deck\",\"version\":1},\"strategy\":{\"id\":\"test-blackjack-counting-schedule\",\"version\":1}},\"outcome\":null,\"phase\":\"correction\",\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[2752067618,698298832],\"lane\":0,\"protocol\":1,\"session\":[320440878,57701188]},\"receipts\":[{\"command\":\"{\\\"amount\\\":\\\"50\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"hand-1\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"assessed\",\"sequence\":1}],\"rules\":{\"dealer\":\"S17\",\"decks\":6,\"lateSurrender\":true,\"limits\":{\"initial\":{\"max\":\"1000\",\"min\":\"10\"}},\"penetration\":75,\"players\":{\"learnerSeat\":0,\"otherWagers\":[],\"strategy\":null}},\"schema\":10,\"sequence\":2,\"shoe\":null,\"strategy\":{\"coachedTurn\":false,\"correction\":{\"actual\":[{\"amount\":\"50\",\"target\":\"hand-1\"}],\"explanation\":{\"fallback\":null,\"instructions\":[{\"id\":\"below-1\",\"label\":\"Below +1: 1 unit\"}],\"prescription\":{\"bets\":[{\"amount\":\"10\",\"target\":\"hand-1\"}],\"held\":[],\"status\":\"prescribed\"},\"situation\":{\"available\":\"1000\",\"subjects\":{\"last-result\":\"none\"},\"values\":{\"true-count\":\"0\"}},\"state\":{\"counters\":{},\"cycleTurn\":0,\"lastResult\":\"none\",\"lists\":{}}},\"id\":\"blackjack-1/departure/1\",\"turn\":1},\"cycle\":{\"number\":1,\"turns\":[]},\"cycleEnd\":null,\"decisions\":{\"betting\":0,\"playing\":0},\"deferred\":null,\"definition\":{\"adjustments\":[],\"counters\":[],\"format\":1,\"game\":\"blackjack\",\"id\":\"test-blackjack-counting-schedule\",\"instructions\":[{\"bets\":[{\"amount\":{\"lit\":\"10\"},\"target\":{\"target\":\"hand-1\"}}],\"id\":\"below-1\",\"label\":\"Below +1: 1 unit\",\"priority\":0,\"when\":{\"always\":true}},{\"bets\":[{\"amount\":{\"lit\":\"20\"},\"target\":{\"target\":\"hand-1\"}}],\"id\":\"from-1\",\"label\":\"+1: 2 units\",\"priority\":1,\"when\":{\"compare\":{\"value\":\"true-count\"},\"op\":\"ge\",\"to\":{\"lit\":\"1\"}}},{\"bets\":[{\"amount\":{\"lit\":\"40\"},\"target\":{\"target\":\"hand-1\"}}],\"id\":\"from-2\",\"label\":\"+2: 4 units\",\"priority\":2,\"when\":{\"compare\":{\"value\":\"true-count\"},\"op\":\"ge\",\"to\":{\"lit\":\"2\"}}},{\"bets\":[{\"amount\":{\"lit\":\"60\"},\"target\":{\"target\":\"hand-1\"}}],\"id\":\"from-3\",\"label\":\"+3: 6 units\",\"priority\":3,\"when\":{\"compare\":{\"value\":\"true-count\"},\"op\":\"ge\",\"to\":{\"lit\":\"3\"}}},{\"bets\":[{\"amount\":{\"lit\":\"80\"},\"target\":{\"target\":\"hand-1\"}}],\"id\":\"from-4\",\"label\":\"+4 or more: 8 units\",\"priority\":4,\"when\":{\"compare\":{\"value\":\"true-count\"},\"op\":\"ge\",\"to\":{\"lit\":\"4\"}}}],\"name\":\"Counting with basic\",\"parameters\":[],\"play\":{\"count\":\"player\",\"deviations\":[],\"fallbacks\":{\"double\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SHHHHHSHHS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"doubleOnOriginalLateSurrender\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHR\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SHHHHHSHHS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"splitByBalance\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"splitByRule\":[\"SSSSSSSSSS\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"surrender\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"PPPPPPPPPP\",\"HPPPPPPHHH\",\"HPPPPPPHHH\",\"HHHHPPHHHH\",\"HDDDDDDDDH\",\"HPPPPPHHHH\",\"HPPPPPPHHH\",\"PPPPPPPPPP\",\"SPPPPPSPPS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]}},\"first\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHR\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"PPPPPPPPPP\",\"HPPPPPPHHH\",\"HPPPPPPHHH\",\"HHHHPPHHHH\",\"HDDDDDDDDH\",\"HPPPPPHHHH\",\"HPPPPPPHHH\",\"PPPPPPPPPP\",\"SPPPPPSPPS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"later\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"laterWithoutDouble\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]}},\"revision\":1,\"stopWhen\":null,\"table\":{\"dealer\":\"S17\",\"lateSurrender\":true,\"limits\":{\"initial\":{\"max\":\"1000\",\"min\":\"10\"}}}},\"departures\":[],\"parameters\":{},\"progress\":{\"counters\":{},\"cycleTurn\":0,\"lastResult\":\"none\",\"lists\":{}},\"status\":\"active\"},\"turn\":0,\"wagers\":[{\"amount\":\"50\",\"target\":\"hand-1\"}]}",
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
      "checkpoint": "{\"answers\":[],\"attempt\":{\"device\":\"device-1\",\"id\":\"attempt-1\",\"owner\":\"owner-1\"},\"content\":{\"category\":\"card-values\",\"coverage\":\"every-rank\",\"id\":\"card-values\",\"length\":20,\"version\":1},\"ending\":null,\"identities\":{\"category\":\"card-values\",\"content\":{\"id\":\"card-values\",\"version\":1},\"engine\":\"0.0.0\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":null},\"items\":[],\"phase\":\"ready\",\"position\":0,\"random\":{\"block\":[0,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":0,\"protocol\":1,\"session\":[8,0]},\"receipts\":[],\"rejected\":0,\"revealedAt\":null,\"schema\":10,\"sequence\":0,\"variant\":\"learn\"}",
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
      "results": "{\"assistanceStep\":null,\"assisted\":true,\"ending\":\"completed\",\"metrics\":{\"betting-adherence\":null,\"card-values\":{\"correct\":5,\"total\":20},\"playing-adherence\":null,\"running-count\":null,\"true-count\":null},\"review\":[{\"card\":{\"rank\":5,\"suit\":\"diamonds\"},\"entered\":0,\"kind\":\"card-value\",\"position\":1,\"reference\":1},{\"card\":{\"rank\":7,\"suit\":\"diamonds\"},\"entered\":0,\"kind\":\"card-value\",\"position\":2,\"reference\":0},{\"card\":{\"rank\":10,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":3,\"reference\":-1},{\"card\":{\"rank\":2,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":4,\"reference\":1},{\"card\":{\"rank\":7,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":5,\"reference\":0},{\"card\":{\"rank\":2,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":6,\"reference\":1},{\"card\":{\"rank\":11,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":7,\"reference\":-1},{\"card\":{\"rank\":4,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":8,\"reference\":1},{\"card\":{\"rank\":6,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":9,\"reference\":1},{\"card\":{\"rank\":11,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":10,\"reference\":-1},{\"card\":{\"rank\":12,\"suit\":\"diamonds\"},\"entered\":0,\"kind\":\"card-value\",\"position\":11,\"reference\":-1},{\"card\":{\"rank\":9,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":12,\"reference\":0},{\"card\":{\"rank\":2,\"suit\":\"diamonds\"},\"entered\":0,\"kind\":\"card-value\",\"position\":13,\"reference\":1},{\"card\":{\"rank\":6,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":14,\"reference\":1},{\"card\":{\"rank\":2,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":15,\"reference\":1},{\"card\":{\"rank\":1,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":16,\"reference\":-1},{\"card\":{\"rank\":9,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":17,\"reference\":0},{\"card\":{\"rank\":8,\"suit\":\"diamonds\"},\"entered\":0,\"kind\":\"card-value\",\"position\":18,\"reference\":0},{\"card\":{\"rank\":3,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":19,\"reference\":1},{\"card\":{\"rank\":13,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":20,\"reference\":-1}]}"
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
      "checkpoint": "{\"answers\":[{\"first\":1,\"last\":1,\"position\":0,\"tries\":1}],\"attempt\":{\"device\":\"device-1\",\"id\":\"attempt-1\",\"owner\":\"owner-1\"},\"content\":{\"category\":\"card-values\",\"coverage\":\"every-rank\",\"id\":\"card-values\",\"length\":20,\"version\":1},\"ending\":null,\"identities\":{\"category\":\"card-values\",\"content\":{\"id\":\"card-values\",\"version\":1},\"engine\":\"0.0.0\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":null},\"items\":[{\"card\":{\"rank\":5,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":7,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":10,\"suit\":\"clubs\"}},{\"card\":{\"rank\":2,\"suit\":\"clubs\"}},{\"card\":{\"rank\":7,\"suit\":\"hearts\"}},{\"card\":{\"rank\":2,\"suit\":\"spades\"}},{\"card\":{\"rank\":11,\"suit\":\"hearts\"}},{\"card\":{\"rank\":4,\"suit\":\"spades\"}},{\"card\":{\"rank\":6,\"suit\":\"hearts\"}},{\"card\":{\"rank\":11,\"suit\":\"clubs\"}},{\"card\":{\"rank\":12,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":9,\"suit\":\"hearts\"}},{\"card\":{\"rank\":2,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":6,\"suit\":\"hearts\"}},{\"card\":{\"rank\":2,\"suit\":\"spades\"}},{\"card\":{\"rank\":1,\"suit\":\"clubs\"}},{\"card\":{\"rank\":9,\"suit\":\"spades\"}},{\"card\":{\"rank\":8,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":3,\"suit\":\"clubs\"}},{\"card\":{\"rank\":13,\"suit\":\"spades\"}}],\"phase\":\"question\",\"position\":1,\"random\":{\"block\":[200,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":0,\"protocol\":1,\"session\":[8,0]},\"receipts\":[{\"command\":\"{\\\"kind\\\":\\\"begin\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":1}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2}],\"rejected\":39,\"revealedAt\":null,\"schema\":10,\"sequence\":3,\"variant\":\"learn\"}",
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
      "results": "{\"assistanceStep\":null,\"assisted\":true,\"ending\":\"completed\",\"metrics\":{\"betting-adherence\":null,\"card-values\":{\"correct\":6,\"total\":20},\"playing-adherence\":null,\"running-count\":null,\"true-count\":null},\"review\":[{\"card\":{\"rank\":5,\"suit\":\"diamonds\"},\"entered\":1,\"kind\":\"card-value\",\"position\":1,\"reference\":1},{\"card\":{\"rank\":7,\"suit\":\"diamonds\"},\"entered\":0,\"kind\":\"card-value\",\"position\":2,\"reference\":0},{\"card\":{\"rank\":10,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":3,\"reference\":-1},{\"card\":{\"rank\":2,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":4,\"reference\":1},{\"card\":{\"rank\":7,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":5,\"reference\":0},{\"card\":{\"rank\":2,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":6,\"reference\":1},{\"card\":{\"rank\":11,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":7,\"reference\":-1},{\"card\":{\"rank\":4,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":8,\"reference\":1},{\"card\":{\"rank\":6,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":9,\"reference\":1},{\"card\":{\"rank\":11,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":10,\"reference\":-1},{\"card\":{\"rank\":12,\"suit\":\"diamonds\"},\"entered\":0,\"kind\":\"card-value\",\"position\":11,\"reference\":-1},{\"card\":{\"rank\":9,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":12,\"reference\":0},{\"card\":{\"rank\":2,\"suit\":\"diamonds\"},\"entered\":0,\"kind\":\"card-value\",\"position\":13,\"reference\":1},{\"card\":{\"rank\":6,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":14,\"reference\":1},{\"card\":{\"rank\":2,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":15,\"reference\":1},{\"card\":{\"rank\":1,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":16,\"reference\":-1},{\"card\":{\"rank\":9,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":17,\"reference\":0},{\"card\":{\"rank\":8,\"suit\":\"diamonds\"},\"entered\":0,\"kind\":\"card-value\",\"position\":18,\"reference\":0},{\"card\":{\"rank\":3,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":19,\"reference\":1},{\"card\":{\"rank\":13,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":20,\"reference\":-1}]}"
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
      "checkpoint": "{\"answers\":[{\"first\":1,\"last\":1,\"position\":0,\"tries\":1},{\"first\":1,\"last\":1,\"position\":1,\"tries\":1}],\"attempt\":{\"device\":\"device-1\",\"id\":\"attempt-1\",\"owner\":\"owner-1\"},\"content\":{\"category\":\"card-values\",\"coverage\":\"every-rank\",\"id\":\"card-values\",\"length\":20,\"version\":1},\"ending\":null,\"identities\":{\"category\":\"card-values\",\"content\":{\"id\":\"card-values\",\"version\":1},\"engine\":\"0.0.0\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":null},\"items\":[{\"card\":{\"rank\":5,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":7,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":10,\"suit\":\"clubs\"}},{\"card\":{\"rank\":2,\"suit\":\"clubs\"}},{\"card\":{\"rank\":7,\"suit\":\"hearts\"}},{\"card\":{\"rank\":2,\"suit\":\"spades\"}},{\"card\":{\"rank\":11,\"suit\":\"hearts\"}},{\"card\":{\"rank\":4,\"suit\":\"spades\"}},{\"card\":{\"rank\":6,\"suit\":\"hearts\"}},{\"card\":{\"rank\":11,\"suit\":\"clubs\"}},{\"card\":{\"rank\":12,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":9,\"suit\":\"hearts\"}},{\"card\":{\"rank\":2,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":6,\"suit\":\"hearts\"}},{\"card\":{\"rank\":2,\"suit\":\"spades\"}},{\"card\":{\"rank\":1,\"suit\":\"clubs\"}},{\"card\":{\"rank\":9,\"suit\":\"spades\"}},{\"card\":{\"rank\":8,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":3,\"suit\":\"clubs\"}},{\"card\":{\"rank\":13,\"suit\":\"spades\"}}],\"phase\":\"explanation\",\"position\":1,\"random\":{\"block\":[200,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":0,\"protocol\":1,\"session\":[8,0]},\"receipts\":[{\"command\":\"{\\\"kind\\\":\\\"begin\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":1}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":1}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3}],\"rejected\":39,\"revealedAt\":null,\"schema\":10,\"sequence\":4,\"variant\":\"learn\"}",
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
      "results": "{\"assistanceStep\":null,\"assisted\":true,\"ending\":\"completed\",\"metrics\":{\"betting-adherence\":null,\"card-values\":{\"correct\":5,\"total\":20},\"playing-adherence\":null,\"running-count\":null,\"true-count\":null},\"review\":[{\"card\":{\"rank\":5,\"suit\":\"diamonds\"},\"entered\":1,\"kind\":\"card-value\",\"position\":1,\"reference\":1},{\"card\":{\"rank\":7,\"suit\":\"diamonds\"},\"entered\":1,\"kind\":\"card-value\",\"position\":2,\"reference\":0},{\"card\":{\"rank\":10,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":3,\"reference\":-1},{\"card\":{\"rank\":2,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":4,\"reference\":1},{\"card\":{\"rank\":7,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":5,\"reference\":0},{\"card\":{\"rank\":2,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":6,\"reference\":1},{\"card\":{\"rank\":11,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":7,\"reference\":-1},{\"card\":{\"rank\":4,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":8,\"reference\":1},{\"card\":{\"rank\":6,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":9,\"reference\":1},{\"card\":{\"rank\":11,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":10,\"reference\":-1},{\"card\":{\"rank\":12,\"suit\":\"diamonds\"},\"entered\":0,\"kind\":\"card-value\",\"position\":11,\"reference\":-1},{\"card\":{\"rank\":9,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":12,\"reference\":0},{\"card\":{\"rank\":2,\"suit\":\"diamonds\"},\"entered\":0,\"kind\":\"card-value\",\"position\":13,\"reference\":1},{\"card\":{\"rank\":6,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":14,\"reference\":1},{\"card\":{\"rank\":2,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":15,\"reference\":1},{\"card\":{\"rank\":1,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":16,\"reference\":-1},{\"card\":{\"rank\":9,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":17,\"reference\":0},{\"card\":{\"rank\":8,\"suit\":\"diamonds\"},\"entered\":0,\"kind\":\"card-value\",\"position\":18,\"reference\":0},{\"card\":{\"rank\":3,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":19,\"reference\":1},{\"card\":{\"rank\":13,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":20,\"reference\":-1}]}"
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
      "checkpoint": "{\"answers\":[{\"first\":1,\"last\":1,\"position\":0,\"tries\":1},{\"first\":1,\"last\":1,\"position\":1,\"tries\":1}],\"attempt\":{\"device\":\"device-1\",\"id\":\"attempt-1\",\"owner\":\"owner-1\"},\"content\":{\"category\":\"card-values\",\"coverage\":\"every-rank\",\"id\":\"card-values\",\"length\":20,\"version\":1},\"ending\":null,\"identities\":{\"category\":\"card-values\",\"content\":{\"id\":\"card-values\",\"version\":1},\"engine\":\"0.0.0\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":null},\"items\":[{\"card\":{\"rank\":5,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":7,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":10,\"suit\":\"clubs\"}},{\"card\":{\"rank\":2,\"suit\":\"clubs\"}},{\"card\":{\"rank\":7,\"suit\":\"hearts\"}},{\"card\":{\"rank\":2,\"suit\":\"spades\"}},{\"card\":{\"rank\":11,\"suit\":\"hearts\"}},{\"card\":{\"rank\":4,\"suit\":\"spades\"}},{\"card\":{\"rank\":6,\"suit\":\"hearts\"}},{\"card\":{\"rank\":11,\"suit\":\"clubs\"}},{\"card\":{\"rank\":12,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":9,\"suit\":\"hearts\"}},{\"card\":{\"rank\":2,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":6,\"suit\":\"hearts\"}},{\"card\":{\"rank\":2,\"suit\":\"spades\"}},{\"card\":{\"rank\":1,\"suit\":\"clubs\"}},{\"card\":{\"rank\":9,\"suit\":\"spades\"}},{\"card\":{\"rank\":8,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":3,\"suit\":\"clubs\"}},{\"card\":{\"rank\":13,\"suit\":\"spades\"}}],\"phase\":\"recorded\",\"position\":1,\"random\":{\"block\":[200,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":0,\"protocol\":1,\"session\":[8,0]},\"receipts\":[{\"command\":\"{\\\"kind\\\":\\\"begin\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":1}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":1}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3}],\"rejected\":39,\"revealedAt\":null,\"schema\":10,\"sequence\":4,\"variant\":\"check\"}",
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
      "results": "{\"assistanceStep\":null,\"assisted\":false,\"ending\":\"completed\",\"metrics\":{\"betting-adherence\":null,\"card-values\":{\"correct\":5,\"total\":20},\"playing-adherence\":null,\"running-count\":null,\"true-count\":null},\"review\":[{\"card\":{\"rank\":5,\"suit\":\"diamonds\"},\"entered\":1,\"kind\":\"card-value\",\"position\":1,\"reference\":1},{\"card\":{\"rank\":7,\"suit\":\"diamonds\"},\"entered\":1,\"kind\":\"card-value\",\"position\":2,\"reference\":0},{\"card\":{\"rank\":10,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":3,\"reference\":-1},{\"card\":{\"rank\":2,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":4,\"reference\":1},{\"card\":{\"rank\":7,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":5,\"reference\":0},{\"card\":{\"rank\":2,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":6,\"reference\":1},{\"card\":{\"rank\":11,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":7,\"reference\":-1},{\"card\":{\"rank\":4,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":8,\"reference\":1},{\"card\":{\"rank\":6,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":9,\"reference\":1},{\"card\":{\"rank\":11,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":10,\"reference\":-1},{\"card\":{\"rank\":12,\"suit\":\"diamonds\"},\"entered\":0,\"kind\":\"card-value\",\"position\":11,\"reference\":-1},{\"card\":{\"rank\":9,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":12,\"reference\":0},{\"card\":{\"rank\":2,\"suit\":\"diamonds\"},\"entered\":0,\"kind\":\"card-value\",\"position\":13,\"reference\":1},{\"card\":{\"rank\":6,\"suit\":\"hearts\"},\"entered\":0,\"kind\":\"card-value\",\"position\":14,\"reference\":1},{\"card\":{\"rank\":2,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":15,\"reference\":1},{\"card\":{\"rank\":1,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":16,\"reference\":-1},{\"card\":{\"rank\":9,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":17,\"reference\":0},{\"card\":{\"rank\":8,\"suit\":\"diamonds\"},\"entered\":0,\"kind\":\"card-value\",\"position\":18,\"reference\":0},{\"card\":{\"rank\":3,\"suit\":\"clubs\"},\"entered\":0,\"kind\":\"card-value\",\"position\":19,\"reference\":1},{\"card\":{\"rank\":13,\"suit\":\"spades\"},\"entered\":0,\"kind\":\"card-value\",\"position\":20,\"reference\":-1}]}"
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
      "checkpoint": "{\"answers\":[{\"first\":3,\"last\":3,\"position\":0,\"tries\":1}],\"attempt\":{\"device\":\"device-1\",\"id\":\"attempt-1\",\"owner\":\"owner-1\"},\"content\":{\"category\":\"running-count\",\"checkpoints\":[13,26,39,52],\"decks\":6,\"id\":\"running-count\",\"length\":52,\"reference\":{\"id\":\"blackjack-reference\",\"version\":1},\"version\":1},\"ending\":null,\"identities\":{\"category\":\"running-count\",\"content\":{\"id\":\"running-count\",\"version\":1},\"engine\":\"0.0.0\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":{\"id\":\"blackjack-reference\",\"version\":1}},\"items\":[{\"card\":{\"rank\":13,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":3,\"suit\":\"hearts\"}},{\"card\":{\"rank\":4,\"suit\":\"clubs\"}},{\"card\":{\"rank\":3,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":3,\"suit\":\"clubs\"}},{\"card\":{\"rank\":4,\"suit\":\"clubs\"}},{\"card\":{\"rank\":12,\"suit\":\"clubs\"}},{\"card\":{\"rank\":11,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":13,\"suit\":\"clubs\"}},{\"card\":{\"rank\":7,\"suit\":\"spades\"}},{\"card\":{\"rank\":11,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":12,\"suit\":\"hearts\"}},{\"card\":{\"rank\":1,\"suit\":\"spades\"}},{\"card\":{\"rank\":6,\"suit\":\"spades\"}},{\"card\":{\"rank\":8,\"suit\":\"hearts\"}},{\"card\":{\"rank\":2,\"suit\":\"hearts\"}},{\"card\":{\"rank\":10,\"suit\":\"hearts\"}},{\"card\":{\"rank\":13,\"suit\":\"clubs\"}},{\"card\":{\"rank\":5,\"suit\":\"clubs\"}},{\"card\":{\"rank\":13,\"suit\":\"hearts\"}},{\"card\":{\"rank\":7,\"suit\":\"spades\"}},{\"card\":{\"rank\":9,\"suit\":\"hearts\"}},{\"card\":{\"rank\":5,\"suit\":\"hearts\"}},{\"card\":{\"rank\":1,\"suit\":\"hearts\"}},{\"card\":{\"rank\":5,\"suit\":\"hearts\"}},{\"card\":{\"rank\":4,\"suit\":\"spades\"}},{\"card\":{\"rank\":9,\"suit\":\"hearts\"}},{\"card\":{\"rank\":6,\"suit\":\"clubs\"}},{\"card\":{\"rank\":3,\"suit\":\"spades\"}},{\"card\":{\"rank\":7,\"suit\":\"clubs\"}},{\"card\":{\"rank\":11,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":1,\"suit\":\"clubs\"}},{\"card\":{\"rank\":9,\"suit\":\"hearts\"}},{\"card\":{\"rank\":12,\"suit\":\"spades\"}},{\"card\":{\"rank\":3,\"suit\":\"clubs\"}},{\"card\":{\"rank\":5,\"suit\":\"hearts\"}},{\"card\":{\"rank\":12,\"suit\":\"clubs\"}},{\"card\":{\"rank\":12,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":7,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":4,\"suit\":\"clubs\"}},{\"card\":{\"rank\":11,\"suit\":\"clubs\"}},{\"card\":{\"rank\":13,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":10,\"suit\":\"spades\"}},{\"card\":{\"rank\":9,\"suit\":\"spades\"}},{\"card\":{\"rank\":9,\"suit\":\"spades\"}},{\"card\":{\"rank\":1,\"suit\":\"spades\"}},{\"card\":{\"rank\":12,\"suit\":\"spades\"}},{\"card\":{\"rank\":10,\"suit\":\"clubs\"}},{\"card\":{\"rank\":10,\"suit\":\"clubs\"}},{\"card\":{\"rank\":8,\"suit\":\"spades\"}},{\"card\":{\"rank\":7,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":7,\"suit\":\"diamonds\"}}],\"phase\":\"explanation\",\"position\":0,\"random\":{\"block\":[77,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":3,\"protocol\":1,\"session\":[8,0]},\"receipts\":[{\"command\":\"{\\\"kind\\\":\\\"begin\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"reveal-count\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":3}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2}],\"rejected\":0,\"revealedAt\":1,\"schema\":10,\"sequence\":3,\"variant\":\"learn\"}",
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
      "results": "{\"assistanceStep\":1,\"assisted\":true,\"ending\":\"completed\",\"metrics\":{\"betting-adherence\":null,\"card-values\":null,\"playing-adherence\":null,\"running-count\":{\"correct\":10,\"total\":52},\"true-count\":null},\"review\":[{\"checkpoint\":1,\"entered\":3,\"error\":4,\"kind\":\"running-count\",\"position\":1,\"reference\":-1},{\"checkpoint\":2,\"entered\":0,\"error\":0,\"kind\":\"running-count\",\"position\":2,\"reference\":0},{\"checkpoint\":3,\"entered\":0,\"error\":-1,\"kind\":\"running-count\",\"position\":3,\"reference\":1},{\"checkpoint\":4,\"entered\":0,\"error\":-2,\"kind\":\"running-count\",\"position\":4,\"reference\":2},{\"checkpoint\":5,\"entered\":0,\"error\":-3,\"kind\":\"running-count\",\"position\":5,\"reference\":3},{\"checkpoint\":6,\"entered\":0,\"error\":-4,\"kind\":\"running-count\",\"position\":6,\"reference\":4},{\"checkpoint\":7,\"entered\":0,\"error\":-3,\"kind\":\"running-count\",\"position\":7,\"reference\":3},{\"checkpoint\":8,\"entered\":0,\"error\":-2,\"kind\":\"running-count\",\"position\":8,\"reference\":2},{\"checkpoint\":9,\"entered\":0,\"error\":-1,\"kind\":\"running-count\",\"position\":9,\"reference\":1},{\"checkpoint\":10,\"entered\":0,\"error\":-1,\"kind\":\"running-count\",\"position\":10,\"reference\":1},{\"checkpoint\":11,\"entered\":0,\"error\":0,\"kind\":\"running-count\",\"position\":11,\"reference\":0},{\"checkpoint\":12,\"entered\":0,\"error\":1,\"kind\":\"running-count\",\"position\":12,\"reference\":-1},{\"checkpoint\":13,\"entered\":0,\"error\":2,\"kind\":\"running-count\",\"position\":13,\"reference\":-2},{\"checkpoint\":14,\"entered\":0,\"error\":1,\"kind\":\"running-count\",\"position\":14,\"reference\":-1},{\"checkpoint\":15,\"entered\":0,\"error\":1,\"kind\":\"running-count\",\"position\":15,\"reference\":-1},{\"checkpoint\":16,\"entered\":0,\"error\":0,\"kind\":\"running-count\",\"position\":16,\"reference\":0},{\"checkpoint\":17,\"entered\":0,\"error\":1,\"kind\":\"running-count\",\"position\":17,\"reference\":-1},{\"checkpoint\":18,\"entered\":0,\"error\":2,\"kind\":\"running-count\",\"position\":18,\"reference\":-2},{\"checkpoint\":19,\"entered\":0,\"error\":1,\"kind\":\"running-count\",\"position\":19,\"reference\":-1},{\"checkpoint\":20,\"entered\":0,\"error\":2,\"kind\":\"running-count\",\"position\":20,\"reference\":-2},{\"checkpoint\":21,\"entered\":0,\"error\":2,\"kind\":\"running-count\",\"position\":21,\"reference\":-2},{\"checkpoint\":22,\"entered\":0,\"error\":2,\"kind\":\"running-count\",\"position\":22,\"reference\":-2},{\"checkpoint\":23,\"entered\":0,\"error\":1,\"kind\":\"running-count\",\"position\":23,\"reference\":-1},{\"checkpoint\":24,\"entered\":0,\"error\":2,\"kind\":\"running-count\",\"position\":24,\"reference\":-2},{\"checkpoint\":25,\"entered\":0,\"error\":1,\"kind\":\"running-count\",\"position\":25,\"reference\":-1},{\"checkpoint\":26,\"entered\":0,\"error\":0,\"kind\":\"running-count\",\"position\":26,\"reference\":0},{\"checkpoint\":27,\"entered\":0,\"error\":0,\"kind\":\"running-count\",\"position\":27,\"reference\":0},{\"checkpoint\":28,\"entered\":0,\"error\":-1,\"kind\":\"running-count\",\"position\":28,\"reference\":1},{\"checkpoint\":29,\"entered\":0,\"error\":-2,\"kind\":\"running-count\",\"position\":29,\"reference\":2},{\"checkpoint\":30,\"entered\":0,\"error\":-2,\"kind\":\"running-count\",\"position\":30,\"reference\":2},{\"checkpoint\":31,\"entered\":0,\"error\":-1,\"kind\":\"running-count\",\"position\":31,\"reference\":1},{\"checkpoint\":32,\"entered\":0,\"error\":0,\"kind\":\"running-count\",\"position\":32,\"reference\":0},{\"checkpoint\":33,\"entered\":0,\"error\":0,\"kind\":\"running-count\",\"position\":33,\"reference\":0},{\"checkpoint\":34,\"entered\":0,\"error\":1,\"kind\":\"running-count\",\"position\":34,\"reference\":-1},{\"checkpoint\":35,\"entered\":0,\"error\":0,\"kind\":\"running-count\",\"position\":35,\"reference\":0},{\"checkpoint\":36,\"entered\":0,\"error\":-1,\"kind\":\"running-count\",\"position\":36,\"reference\":1},{\"checkpoint\":37,\"entered\":0,\"error\":0,\"kind\":\"running-count\",\"position\":37,\"reference\":0},{\"checkpoint\":38,\"entered\":0,\"error\":1,\"kind\":\"running-count\",\"position\":38,\"reference\":-1},{\"checkpoint\":39,\"entered\":0,\"error\":1,\"kind\":\"running-count\",\"position\":39,\"reference\":-1},{\"checkpoint\":40,\"entered\":0,\"error\":0,\"kind\":\"running-count\",\"position\":40,\"reference\":0},{\"checkpoint\":41,\"entered\":0,\"error\":1,\"kind\":\"running-count\",\"position\":41,\"reference\":-1},{\"checkpoint\":42,\"entered\":0,\"error\":2,\"kind\":\"running-count\",\"position\":42,\"reference\":-2},{\"checkpoint\":43,\"entered\":0,\"error\":3,\"kind\":\"running-count\",\"position\":43,\"reference\":-3},{\"checkpoint\":44,\"entered\":0,\"error\":3,\"kind\":\"running-count\",\"position\":44,\"reference\":-3},{\"checkpoint\":45,\"entered\":0,\"error\":3,\"kind\":\"running-count\",\"position\":45,\"reference\":-3},{\"checkpoint\":46,\"entered\":0,\"error\":4,\"kind\":\"running-count\",\"position\":46,\"reference\":-4},{\"checkpoint\":47,\"entered\":0,\"error\":5,\"kind\":\"running-count\",\"position\":47,\"reference\":-5},{\"checkpoint\":48,\"entered\":0,\"error\":6,\"kind\":\"running-count\",\"position\":48,\"reference\":-6},{\"checkpoint\":49,\"entered\":0,\"error\":7,\"kind\":\"running-count\",\"position\":49,\"reference\":-7},{\"checkpoint\":50,\"entered\":0,\"error\":7,\"kind\":\"running-count\",\"position\":50,\"reference\":-7},{\"checkpoint\":51,\"entered\":0,\"error\":7,\"kind\":\"running-count\",\"position\":51,\"reference\":-7},{\"checkpoint\":52,\"entered\":0,\"error\":7,\"kind\":\"running-count\",\"position\":52,\"reference\":-7}]}"
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
      "checkpoint": "{\"answers\":[],\"attempt\":{\"device\":\"device-1\",\"id\":\"attempt-1\",\"owner\":\"owner-1\"},\"content\":{\"category\":\"running-count\",\"checkpoints\":[13,26,39,52],\"decks\":6,\"id\":\"running-count\",\"length\":52,\"reference\":{\"id\":\"blackjack-reference\",\"version\":1},\"version\":1},\"ending\":null,\"identities\":{\"category\":\"running-count\",\"content\":{\"id\":\"running-count\",\"version\":1},\"engine\":\"0.0.0\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":{\"id\":\"blackjack-reference\",\"version\":1}},\"items\":[{\"card\":{\"rank\":13,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":3,\"suit\":\"hearts\"}},{\"card\":{\"rank\":4,\"suit\":\"clubs\"}},{\"card\":{\"rank\":3,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":3,\"suit\":\"clubs\"}},{\"card\":{\"rank\":4,\"suit\":\"clubs\"}},{\"card\":{\"rank\":12,\"suit\":\"clubs\"}},{\"card\":{\"rank\":11,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":13,\"suit\":\"clubs\"}},{\"card\":{\"rank\":7,\"suit\":\"spades\"}},{\"card\":{\"rank\":11,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":12,\"suit\":\"hearts\"}},{\"card\":{\"rank\":1,\"suit\":\"spades\"}},{\"card\":{\"rank\":6,\"suit\":\"spades\"}},{\"card\":{\"rank\":8,\"suit\":\"hearts\"}},{\"card\":{\"rank\":2,\"suit\":\"hearts\"}},{\"card\":{\"rank\":10,\"suit\":\"hearts\"}},{\"card\":{\"rank\":13,\"suit\":\"clubs\"}},{\"card\":{\"rank\":5,\"suit\":\"clubs\"}},{\"card\":{\"rank\":13,\"suit\":\"hearts\"}},{\"card\":{\"rank\":7,\"suit\":\"spades\"}},{\"card\":{\"rank\":9,\"suit\":\"hearts\"}},{\"card\":{\"rank\":5,\"suit\":\"hearts\"}},{\"card\":{\"rank\":1,\"suit\":\"hearts\"}},{\"card\":{\"rank\":5,\"suit\":\"hearts\"}},{\"card\":{\"rank\":4,\"suit\":\"spades\"}},{\"card\":{\"rank\":9,\"suit\":\"hearts\"}},{\"card\":{\"rank\":6,\"suit\":\"clubs\"}},{\"card\":{\"rank\":3,\"suit\":\"spades\"}},{\"card\":{\"rank\":7,\"suit\":\"clubs\"}},{\"card\":{\"rank\":11,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":1,\"suit\":\"clubs\"}},{\"card\":{\"rank\":9,\"suit\":\"hearts\"}},{\"card\":{\"rank\":12,\"suit\":\"spades\"}},{\"card\":{\"rank\":3,\"suit\":\"clubs\"}},{\"card\":{\"rank\":5,\"suit\":\"hearts\"}},{\"card\":{\"rank\":12,\"suit\":\"clubs\"}},{\"card\":{\"rank\":12,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":7,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":4,\"suit\":\"clubs\"}},{\"card\":{\"rank\":11,\"suit\":\"clubs\"}},{\"card\":{\"rank\":13,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":10,\"suit\":\"spades\"}},{\"card\":{\"rank\":9,\"suit\":\"spades\"}},{\"card\":{\"rank\":9,\"suit\":\"spades\"}},{\"card\":{\"rank\":1,\"suit\":\"spades\"}},{\"card\":{\"rank\":12,\"suit\":\"spades\"}},{\"card\":{\"rank\":10,\"suit\":\"clubs\"}},{\"card\":{\"rank\":10,\"suit\":\"clubs\"}},{\"card\":{\"rank\":8,\"suit\":\"spades\"}},{\"card\":{\"rank\":7,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":7,\"suit\":\"diamonds\"}}],\"phase\":\"card\",\"position\":2,\"random\":{\"block\":[77,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":3,\"protocol\":1,\"session\":[8,0]},\"receipts\":[{\"command\":\"{\\\"kind\\\":\\\"begin\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"kind\\\":\\\"reveal-count\\\"}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3}],\"rejected\":0,\"revealedAt\":3,\"schema\":10,\"sequence\":4,\"variant\":\"check\"}",
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
      "facts": "[{\"kind\":\"content-shown\",\"position\":3},{\"kind\":\"content-shown\",\"position\":4},{\"kind\":\"content-shown\",\"position\":5},{\"kind\":\"content-shown\",\"position\":6},{\"kind\":\"content-shown\",\"position\":7},{\"kind\":\"content-shown\",\"position\":8},{\"kind\":\"content-shown\",\"position\":9},{\"kind\":\"content-shown\",\"position\":10},{\"kind\":\"content-shown\",\"position\":11},{\"kind\":\"content-shown\",\"position\":12},{\"kind\":\"answer-accepted\",\"position\":12,\"scored\":true},{\"kind\":\"content-shown\",\"position\":13},{\"kind\":\"content-shown\",\"position\":14},{\"kind\":\"content-shown\",\"position\":15},{\"kind\":\"content-shown\",\"position\":16},{\"kind\":\"content-shown\",\"position\":17},{\"kind\":\"content-shown\",\"position\":18},{\"kind\":\"content-shown\",\"position\":19},{\"kind\":\"content-shown\",\"position\":20},{\"kind\":\"content-shown\",\"position\":21},{\"kind\":\"content-shown\",\"position\":22},{\"kind\":\"content-shown\",\"position\":23},{\"kind\":\"content-shown\",\"position\":24},{\"kind\":\"content-shown\",\"position\":25},{\"kind\":\"answer-accepted\",\"position\":25,\"scored\":true},{\"kind\":\"content-shown\",\"position\":26},{\"kind\":\"content-shown\",\"position\":27},{\"kind\":\"content-shown\",\"position\":28},{\"kind\":\"content-shown\",\"position\":29},{\"kind\":\"content-shown\",\"position\":30},{\"kind\":\"content-shown\",\"position\":31},{\"kind\":\"content-shown\",\"position\":32},{\"kind\":\"content-shown\",\"position\":33},{\"kind\":\"content-shown\",\"position\":34},{\"kind\":\"content-shown\",\"position\":35},{\"kind\":\"content-shown\",\"position\":36},{\"kind\":\"content-shown\",\"position\":37},{\"kind\":\"content-shown\",\"position\":38},{\"kind\":\"answer-accepted\",\"position\":38,\"scored\":true},{\"kind\":\"content-shown\",\"position\":39},{\"kind\":\"content-shown\",\"position\":40},{\"kind\":\"content-shown\",\"position\":41},{\"kind\":\"content-shown\",\"position\":42},{\"kind\":\"content-shown\",\"position\":43},{\"kind\":\"content-shown\",\"position\":44},{\"kind\":\"content-shown\",\"position\":45},{\"kind\":\"content-shown\",\"position\":46},{\"kind\":\"content-shown\",\"position\":47},{\"kind\":\"content-shown\",\"position\":48},{\"kind\":\"content-shown\",\"position\":49},{\"kind\":\"content-shown\",\"position\":50},{\"kind\":\"content-shown\",\"position\":51},{\"kind\":\"answer-accepted\",\"position\":51,\"scored\":true},{\"ending\":\"completed\",\"kind\":\"attempt-ended\"}]",
      "results": "{\"assistanceStep\":3,\"assisted\":true,\"ending\":\"completed\",\"metrics\":{\"betting-adherence\":null,\"card-values\":null,\"playing-adherence\":null,\"running-count\":{\"correct\":1,\"total\":4},\"true-count\":null},\"review\":[{\"checkpoint\":1,\"entered\":0,\"error\":2,\"kind\":\"running-count\",\"position\":13,\"reference\":-2},{\"checkpoint\":2,\"entered\":0,\"error\":0,\"kind\":\"running-count\",\"position\":26,\"reference\":0},{\"checkpoint\":3,\"entered\":0,\"error\":1,\"kind\":\"running-count\",\"position\":39,\"reference\":-1},{\"checkpoint\":4,\"entered\":0,\"error\":7,\"kind\":\"running-count\",\"position\":52,\"reference\":-7}]}"
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
      "checkpoint": "{\"answers\":[{\"first\":\"skip\",\"last\":\"skip\",\"position\":12,\"tries\":1}],\"attempt\":{\"device\":\"device-1\",\"id\":\"attempt-1\",\"owner\":\"owner-1\"},\"content\":{\"category\":\"running-count\",\"checkpoints\":[13,26,39,52],\"decks\":6,\"id\":\"running-count\",\"length\":52,\"reference\":{\"id\":\"blackjack-reference\",\"version\":1},\"version\":1},\"ending\":null,\"identities\":{\"category\":\"running-count\",\"content\":{\"id\":\"running-count\",\"version\":1},\"engine\":\"0.0.0\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":{\"id\":\"blackjack-reference\",\"version\":1}},\"items\":[{\"card\":{\"rank\":13,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":3,\"suit\":\"hearts\"}},{\"card\":{\"rank\":4,\"suit\":\"clubs\"}},{\"card\":{\"rank\":3,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":3,\"suit\":\"clubs\"}},{\"card\":{\"rank\":4,\"suit\":\"clubs\"}},{\"card\":{\"rank\":12,\"suit\":\"clubs\"}},{\"card\":{\"rank\":11,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":13,\"suit\":\"clubs\"}},{\"card\":{\"rank\":7,\"suit\":\"spades\"}},{\"card\":{\"rank\":11,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":12,\"suit\":\"hearts\"}},{\"card\":{\"rank\":1,\"suit\":\"spades\"}},{\"card\":{\"rank\":6,\"suit\":\"spades\"}},{\"card\":{\"rank\":8,\"suit\":\"hearts\"}},{\"card\":{\"rank\":2,\"suit\":\"hearts\"}},{\"card\":{\"rank\":10,\"suit\":\"hearts\"}},{\"card\":{\"rank\":13,\"suit\":\"clubs\"}},{\"card\":{\"rank\":5,\"suit\":\"clubs\"}},{\"card\":{\"rank\":13,\"suit\":\"hearts\"}},{\"card\":{\"rank\":7,\"suit\":\"spades\"}},{\"card\":{\"rank\":9,\"suit\":\"hearts\"}},{\"card\":{\"rank\":5,\"suit\":\"hearts\"}},{\"card\":{\"rank\":1,\"suit\":\"hearts\"}},{\"card\":{\"rank\":5,\"suit\":\"hearts\"}},{\"card\":{\"rank\":4,\"suit\":\"spades\"}},{\"card\":{\"rank\":9,\"suit\":\"hearts\"}},{\"card\":{\"rank\":6,\"suit\":\"clubs\"}},{\"card\":{\"rank\":3,\"suit\":\"spades\"}},{\"card\":{\"rank\":7,\"suit\":\"clubs\"}},{\"card\":{\"rank\":11,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":1,\"suit\":\"clubs\"}},{\"card\":{\"rank\":9,\"suit\":\"hearts\"}},{\"card\":{\"rank\":12,\"suit\":\"spades\"}},{\"card\":{\"rank\":3,\"suit\":\"clubs\"}},{\"card\":{\"rank\":5,\"suit\":\"hearts\"}},{\"card\":{\"rank\":12,\"suit\":\"clubs\"}},{\"card\":{\"rank\":12,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":7,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":4,\"suit\":\"clubs\"}},{\"card\":{\"rank\":11,\"suit\":\"clubs\"}},{\"card\":{\"rank\":13,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":10,\"suit\":\"spades\"}},{\"card\":{\"rank\":9,\"suit\":\"spades\"}},{\"card\":{\"rank\":9,\"suit\":\"spades\"}},{\"card\":{\"rank\":1,\"suit\":\"spades\"}},{\"card\":{\"rank\":12,\"suit\":\"spades\"}},{\"card\":{\"rank\":10,\"suit\":\"clubs\"}},{\"card\":{\"rank\":10,\"suit\":\"clubs\"}},{\"card\":{\"rank\":8,\"suit\":\"spades\"}},{\"card\":{\"rank\":7,\"suit\":\"diamonds\"}},{\"card\":{\"rank\":7,\"suit\":\"diamonds\"}}],\"phase\":\"recorded\",\"position\":12,\"random\":{\"block\":[77,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":3,\"protocol\":1,\"session\":[8,0]},\"receipts\":[{\"command\":\"{\\\"kind\\\":\\\"begin\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-4\",\"disposition\":\"applied\",\"sequence\":4},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-5\",\"disposition\":\"applied\",\"sequence\":5},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-6\",\"disposition\":\"applied\",\"sequence\":6},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-7\",\"disposition\":\"applied\",\"sequence\":7},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-8\",\"disposition\":\"applied\",\"sequence\":8},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-9\",\"disposition\":\"applied\",\"sequence\":9},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-10\",\"disposition\":\"applied\",\"sequence\":10},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-11\",\"disposition\":\"applied\",\"sequence\":11},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-12\",\"disposition\":\"applied\",\"sequence\":12},{\"command\":\"{\\\"kind\\\":\\\"skip\\\"}\",\"commandId\":\"record-13\",\"disposition\":\"applied\",\"sequence\":13}],\"rejected\":0,\"revealedAt\":null,\"schema\":10,\"sequence\":14,\"variant\":\"check\"}",
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
      "facts": "[{\"kind\":\"content-shown\",\"position\":13},{\"kind\":\"content-shown\",\"position\":14},{\"kind\":\"content-shown\",\"position\":15},{\"kind\":\"content-shown\",\"position\":16},{\"kind\":\"content-shown\",\"position\":17},{\"kind\":\"content-shown\",\"position\":18},{\"kind\":\"content-shown\",\"position\":19},{\"kind\":\"content-shown\",\"position\":20},{\"kind\":\"content-shown\",\"position\":21},{\"kind\":\"content-shown\",\"position\":22},{\"kind\":\"content-shown\",\"position\":23},{\"kind\":\"content-shown\",\"position\":24},{\"kind\":\"content-shown\",\"position\":25},{\"kind\":\"answer-accepted\",\"position\":25,\"scored\":true},{\"kind\":\"content-shown\",\"position\":26},{\"kind\":\"content-shown\",\"position\":27},{\"kind\":\"content-shown\",\"position\":28},{\"kind\":\"content-shown\",\"position\":29},{\"kind\":\"content-shown\",\"position\":30},{\"kind\":\"content-shown\",\"position\":31},{\"kind\":\"content-shown\",\"position\":32},{\"kind\":\"content-shown\",\"position\":33},{\"kind\":\"content-shown\",\"position\":34},{\"kind\":\"content-shown\",\"position\":35},{\"kind\":\"content-shown\",\"position\":36},{\"kind\":\"content-shown\",\"position\":37},{\"kind\":\"content-shown\",\"position\":38},{\"kind\":\"answer-accepted\",\"position\":38,\"scored\":true},{\"kind\":\"content-shown\",\"position\":39},{\"kind\":\"content-shown\",\"position\":40},{\"kind\":\"content-shown\",\"position\":41},{\"kind\":\"content-shown\",\"position\":42},{\"kind\":\"content-shown\",\"position\":43},{\"kind\":\"content-shown\",\"position\":44},{\"kind\":\"content-shown\",\"position\":45},{\"kind\":\"content-shown\",\"position\":46},{\"kind\":\"content-shown\",\"position\":47},{\"kind\":\"content-shown\",\"position\":48},{\"kind\":\"content-shown\",\"position\":49},{\"kind\":\"content-shown\",\"position\":50},{\"kind\":\"content-shown\",\"position\":51},{\"kind\":\"answer-accepted\",\"position\":51,\"scored\":true},{\"ending\":\"completed\",\"kind\":\"attempt-ended\"}]",
      "results": "{\"assistanceStep\":null,\"assisted\":false,\"ending\":\"completed\",\"metrics\":{\"betting-adherence\":null,\"card-values\":null,\"playing-adherence\":null,\"running-count\":{\"correct\":1,\"total\":4},\"true-count\":null},\"review\":[{\"checkpoint\":1,\"entered\":\"skip\",\"error\":null,\"kind\":\"running-count\",\"position\":13,\"reference\":-2},{\"checkpoint\":2,\"entered\":0,\"error\":0,\"kind\":\"running-count\",\"position\":26,\"reference\":0},{\"checkpoint\":3,\"entered\":0,\"error\":1,\"kind\":\"running-count\",\"position\":39,\"reference\":-1},{\"checkpoint\":4,\"entered\":0,\"error\":7,\"kind\":\"running-count\",\"position\":52,\"reference\":-7}]}"
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
      "checkpoint": "{\"answers\":[{\"first\":-3,\"last\":-3,\"position\":0,\"tries\":1}],\"attempt\":{\"device\":\"device-1\",\"id\":\"attempt-1\",\"owner\":\"owner-1\"},\"content\":{\"category\":\"conversion\",\"id\":\"conversion\",\"length\":10,\"maxDecks\":6,\"maxRunningCount\":20,\"version\":1},\"ending\":null,\"identities\":{\"category\":\"conversion\",\"content\":{\"id\":\"conversion\",\"version\":1},\"engine\":\"0.0.0\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":null},\"items\":[{\"decks\":5.5,\"running\":-15},{\"decks\":0.5,\"running\":12},{\"decks\":3.5,\"running\":11},{\"decks\":5,\"running\":18},{\"decks\":3.5,\"running\":-19},{\"decks\":1.5,\"running\":0},{\"decks\":4.5,\"running\":14},{\"decks\":5,\"running\":0},{\"decks\":3,\"running\":19},{\"decks\":0.5,\"running\":9}],\"phase\":\"explanation\",\"position\":0,\"random\":{\"block\":[10,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":0,\"protocol\":1,\"session\":[8,0]},\"receipts\":[{\"command\":\"{\\\"kind\\\":\\\"begin\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":-3}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1}],\"rejected\":1,\"revealedAt\":null,\"schema\":10,\"sequence\":2,\"variant\":\"learn\"}",
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
      "results": "{\"assistanceStep\":null,\"assisted\":true,\"ending\":\"completed\",\"metrics\":{\"betting-adherence\":null,\"card-values\":null,\"playing-adherence\":null,\"running-count\":null,\"true-count\":{\"correct\":2,\"total\":10}},\"review\":[{\"decks\":5.5,\"entered\":-3,\"error\":-1,\"kind\":\"conversion\",\"position\":1,\"reference\":-2,\"running\":-15},{\"decks\":0.5,\"entered\":0,\"error\":-24,\"kind\":\"conversion\",\"position\":2,\"reference\":24,\"running\":12},{\"decks\":3.5,\"entered\":0,\"error\":-3,\"kind\":\"conversion\",\"position\":3,\"reference\":3,\"running\":11},{\"decks\":5,\"entered\":0,\"error\":-3,\"kind\":\"conversion\",\"position\":4,\"reference\":3,\"running\":18},{\"decks\":3.5,\"entered\":0,\"error\":5,\"kind\":\"conversion\",\"position\":5,\"reference\":-5,\"running\":-19},{\"decks\":1.5,\"entered\":0,\"error\":0,\"kind\":\"conversion\",\"position\":6,\"reference\":0,\"running\":0},{\"decks\":4.5,\"entered\":0,\"error\":-3,\"kind\":\"conversion\",\"position\":7,\"reference\":3,\"running\":14},{\"decks\":5,\"entered\":0,\"error\":0,\"kind\":\"conversion\",\"position\":8,\"reference\":0,\"running\":0},{\"decks\":3,\"entered\":0,\"error\":-6,\"kind\":\"conversion\",\"position\":9,\"reference\":6,\"running\":19},{\"decks\":0.5,\"entered\":0,\"error\":-18,\"kind\":\"conversion\",\"position\":10,\"reference\":18,\"running\":9}]}"
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
      "checkpoint": "{\"answers\":[{\"first\":-2,\"last\":-2,\"position\":0,\"tries\":1},{\"first\":23,\"last\":23,\"position\":1,\"tries\":1}],\"attempt\":{\"device\":\"device-1\",\"id\":\"attempt-1\",\"owner\":\"owner-1\"},\"content\":{\"category\":\"conversion\",\"id\":\"conversion\",\"length\":10,\"maxDecks\":6,\"maxRunningCount\":20,\"version\":1},\"ending\":null,\"identities\":{\"category\":\"conversion\",\"content\":{\"id\":\"conversion\",\"version\":1},\"engine\":\"0.0.0\",\"random\":{\"key\":[1,2654435769],\"protocol\":1,\"session\":[8,0]},\"reference\":null},\"items\":[{\"decks\":5.5,\"running\":-15},{\"decks\":0.5,\"running\":12},{\"decks\":3.5,\"running\":11},{\"decks\":5,\"running\":18},{\"decks\":3.5,\"running\":-19},{\"decks\":1.5,\"running\":0},{\"decks\":4.5,\"running\":14},{\"decks\":5,\"running\":0},{\"decks\":3,\"running\":19},{\"decks\":0.5,\"running\":9}],\"phase\":\"recorded\",\"position\":1,\"random\":{\"block\":[10,0],\"exhausted\":false,\"key\":[1,2654435769],\"lane\":0,\"protocol\":1,\"session\":[8,0]},\"receipts\":[{\"command\":\"{\\\"kind\\\":\\\"begin\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":-2}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1},{\"command\":\"{\\\"kind\\\":\\\"next-item\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2},{\"command\":\"{\\\"kind\\\":\\\"answer\\\",\\\"value\\\":23}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3}],\"rejected\":1,\"revealedAt\":null,\"schema\":10,\"sequence\":4,\"variant\":\"check\"}",
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
      "results": "{\"assistanceStep\":null,\"assisted\":false,\"ending\":\"completed\",\"metrics\":{\"betting-adherence\":null,\"card-values\":null,\"playing-adherence\":null,\"running-count\":null,\"true-count\":{\"correct\":3,\"total\":10}},\"review\":[{\"decks\":5.5,\"entered\":-2,\"error\":0,\"kind\":\"conversion\",\"position\":1,\"reference\":-2,\"running\":-15},{\"decks\":0.5,\"entered\":23,\"error\":-1,\"kind\":\"conversion\",\"position\":2,\"reference\":24,\"running\":12},{\"decks\":3.5,\"entered\":0,\"error\":-3,\"kind\":\"conversion\",\"position\":3,\"reference\":3,\"running\":11},{\"decks\":5,\"entered\":0,\"error\":-3,\"kind\":\"conversion\",\"position\":4,\"reference\":3,\"running\":18},{\"decks\":3.5,\"entered\":0,\"error\":5,\"kind\":\"conversion\",\"position\":5,\"reference\":-5,\"running\":-19},{\"decks\":1.5,\"entered\":0,\"error\":0,\"kind\":\"conversion\",\"position\":6,\"reference\":0,\"running\":0},{\"decks\":4.5,\"entered\":0,\"error\":-3,\"kind\":\"conversion\",\"position\":7,\"reference\":3,\"running\":14},{\"decks\":5,\"entered\":0,\"error\":0,\"kind\":\"conversion\",\"position\":8,\"reference\":0,\"running\":0},{\"decks\":3,\"entered\":0,\"error\":-6,\"kind\":\"conversion\",\"position\":9,\"reference\":6,\"running\":19},{\"decks\":0.5,\"entered\":0,\"error\":-18,\"kind\":\"conversion\",\"position\":10,\"reference\":18,\"running\":9}]}"
    }
  ]
};
