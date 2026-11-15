// Recorded by scripts/record-databases.ts with store schema 1 (engine 0.0.0, state schema 7). Never edit or remove.
import type { RecordedStoreSchema } from './index';

export const RECORDED_STORE_SCHEMA_1: RecordedStoreSchema = {
  "storeSchema": 1,
  "engine": "0.0.0",
  "stateSchema": 7,
  "databases": [
    {
      "name": "roulette, wagers placed before the spin",
      "environment": "production",
      "accountId": "recorded-account",
      "installationId": "recorded-installation",
      "unfinished": {
        "activityId": "activity-1",
        "game": "roulette",
        "phase": "open-decision",
        "finalCashOut": "1000"
      },
      "schema": [
        "CREATE TABLE meta (name TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT",
        "CREATE TABLE activities (\n    activity_id TEXT PRIMARY KEY,\n    position INTEGER NOT NULL UNIQUE,\n    status TEXT NOT NULL CHECK (status IN ('unfinished', 'completed', 'incomplete')),\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL\n  ) STRICT",
        "CREATE INDEX activities_unfinished ON activities (status, position)",
        "CREATE TABLE transitions (\n    activity_id TEXT NOT NULL REFERENCES activities (activity_id),\n    command_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    PRIMARY KEY (activity_id, command_id),\n    UNIQUE (activity_id, sequence)\n  ) STRICT",
        "CREATE TABLE effects (\n    activity_id TEXT NOT NULL REFERENCES activities (activity_id),\n    effect_key TEXT NOT NULL,\n    position INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    PRIMARY KEY (activity_id, effect_key)\n  ) STRICT",
        "CREATE TABLE outgoing (\n    id TEXT PRIMARY KEY,\n    activity_id TEXT UNIQUE REFERENCES activities (activity_id),\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    revisioned INTEGER NOT NULL CHECK (revisioned IN (0, 1)),\n    position INTEGER NOT NULL UNIQUE,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    dependencies TEXT NOT NULL,\n    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),\n    operation_id TEXT UNIQUE,\n    request TEXT,\n    request_sha256 TEXT,\n    receipt TEXT,\n    receipt_sequence INTEGER,\n    failures INTEGER NOT NULL DEFAULT 0 CHECK (failures >= 0),\n    flagged INTEGER NOT NULL DEFAULT 0 CHECK (flagged IN (0, 1)),\n    device_position INTEGER\n  ) STRICT",
        "CREATE INDEX outgoing_pending ON outgoing (status, position)",
        "CREATE INDEX outgoing_items ON outgoing (record_type, item_id, position)",
        "CREATE TABLE accepted_records (\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    installation_id TEXT,\n    device_position INTEGER,\n    summary_at INTEGER,\n    PRIMARY KEY (record_type, item_id)\n  ) STRICT",
        "CREATE INDEX accepted_summaries ON accepted_records (summary_at) WHERE summary_at IS NOT NULL",
        "CREATE TABLE device_positions (record_type TEXT PRIMARY KEY, last INTEGER NOT NULL) STRICT",
        "CREATE TABLE purged_records (record_type TEXT NOT NULL, item_id TEXT NOT NULL, PRIMARY KEY (record_type, item_id)) STRICT",
        "CREATE TABLE feed_cursor (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), sequence INTEGER NOT NULL, synced_at INTEGER) STRICT",
        "CREATE TABLE bootstrap (\n    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),\n    installed INTEGER NOT NULL CHECK (installed IN (0, 1)),\n    body TEXT, body_format INTEGER, body_length INTEGER, body_sha256 TEXT,\n    staged INTEGER NOT NULL DEFAULT 0 CHECK (staged >= 0),\n    after_ordinal INTEGER NOT NULL DEFAULT 0 CHECK (after_ordinal >= 0)\n  ) STRICT",
        "CREATE TABLE bootstrap_rows (\n    position INTEGER PRIMARY KEY,\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    installation_id TEXT,\n    device_position INTEGER,\n    summary_at INTEGER\n  ) STRICT",
        "CREATE TABLE history (\n    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),\n    recent INTEGER CHECK (recent >= 0),\n    download_requested INTEGER NOT NULL CHECK (download_requested IN (0, 1)),\n    download_total INTEGER CHECK (download_total >= 0)\n  ) STRICT"
      ],
      "rows": {
        "meta": [
          {
            "name": "environment",
            "value": "production"
          },
          {
            "name": "account_id",
            "value": "recorded-account"
          },
          {
            "name": "installation_id",
            "value": "recorded-installation"
          },
          {
            "name": "schema_version",
            "value": "1"
          }
        ],
        "activities": [
          {
            "activity_id": "activity-1",
            "position": 1,
            "status": "unfinished",
            "sequence": 2,
            "body": "{\"activityId\":\"activity-1\",\"admission\":{\"meteringBasis\":\"free-play\",\"provenance\":\"recorded\"},\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"activity-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"985\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":null,\\\"phase\\\":\\\"open-decision\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":0,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"5\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"straight-17\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":2,\\\"strategy\\\":null,\\\"turn\\\":0,\\\"wagers\\\":[{\\\"amount\\\":\\\"5\\\",\\\"target\\\":\\\"straight-17\\\"},{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"red\\\"}]}\",\"completion\":null,\"createdAt\":1790000000000,\"incomplete\":null,\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"sequence\":2,\"specification\":{\"activityId\":\"activity-1\",\"device\":\"recorded-installation\",\"funding\":\"1000\",\"fundingSource\":\"practice-funding\",\"game\":\"roulette\",\"owner\":\"recorded-account\",\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"version\":1,\"wheel\":\"single-zero\"},\"strategy\":null}}",
            "body_format": 1,
            "body_length": 1969,
            "body_sha256": "81e3eb8d064d6466bb5849770032a73059f4907adab916e3fd7b64d53e11b5e9"
          }
        ],
        "transitions": [
          {
            "activity_id": "activity-1",
            "command_id": "record-0",
            "sequence": 0,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"activity-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"990\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":null,\\\"phase\\\":\\\"open-decision\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":0,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":1,\\\"strategy\\\":null,\\\"turn\\\":0,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"red\\\"}]}\",\"facts\":[{\"amount\":\"10\",\"kind\":\"wager-changed\",\"previous\":\"0\",\"target\":\"red\"}],\"receipt\":{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"red\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0}}",
            "body_format": 1,
            "body_length": 1357,
            "body_sha256": "f86d4879a4994a0492555629f48470e84cefcfe20e603ea2fe42bded456fdd80"
          },
          {
            "activity_id": "activity-1",
            "command_id": "record-1",
            "sequence": 1,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"activity-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"985\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":null,\\\"phase\\\":\\\"open-decision\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":0,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"5\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"straight-17\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":2,\\\"strategy\\\":null,\\\"turn\\\":0,\\\"wagers\\\":[{\\\"amount\\\":\\\"5\\\",\\\"target\\\":\\\"straight-17\\\"},{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"red\\\"}]}\",\"facts\":[{\"amount\":\"5\",\"kind\":\"wager-changed\",\"previous\":\"0\",\"target\":\"straight-17\"}],\"receipt\":{\"command\":\"{\\\"amount\\\":\\\"5\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"straight-17\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1}}",
            "body_format": 1,
            "body_length": 1600,
            "body_sha256": "8944e631acae9e4b5bb2f795c5990ad8932cda6e2c992a4e5351f9f56c62d7c2"
          }
        ],
        "effects": [],
        "outgoing": [],
        "accepted_records": [],
        "device_positions": [],
        "purged_records": [],
        "feed_cursor": [
          {
            "singleton": 1,
            "sequence": 0,
            "synced_at": null
          }
        ],
        "bootstrap": [
          {
            "singleton": 1,
            "installed": 0,
            "body": null,
            "body_format": null,
            "body_length": null,
            "body_sha256": null,
            "staged": 0,
            "after_ordinal": 0
          }
        ],
        "bootstrap_rows": [],
        "history": [
          {
            "singleton": 1,
            "recent": null,
            "download_requested": 0,
            "download_total": null
          }
        ]
      }
    },
    {
      "name": "roulette, the ball landed but not yet settled",
      "environment": "production",
      "accountId": "recorded-account",
      "installationId": "recorded-installation",
      "unfinished": {
        "activityId": "activity-1",
        "game": "roulette",
        "phase": "revealing-outcome",
        "finalCashOut": "1010"
      },
      "schema": [
        "CREATE TABLE meta (name TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT",
        "CREATE TABLE activities (\n    activity_id TEXT PRIMARY KEY,\n    position INTEGER NOT NULL UNIQUE,\n    status TEXT NOT NULL CHECK (status IN ('unfinished', 'completed', 'incomplete')),\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL\n  ) STRICT",
        "CREATE INDEX activities_unfinished ON activities (status, position)",
        "CREATE TABLE transitions (\n    activity_id TEXT NOT NULL REFERENCES activities (activity_id),\n    command_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    PRIMARY KEY (activity_id, command_id),\n    UNIQUE (activity_id, sequence)\n  ) STRICT",
        "CREATE TABLE effects (\n    activity_id TEXT NOT NULL REFERENCES activities (activity_id),\n    effect_key TEXT NOT NULL,\n    position INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    PRIMARY KEY (activity_id, effect_key)\n  ) STRICT",
        "CREATE TABLE outgoing (\n    id TEXT PRIMARY KEY,\n    activity_id TEXT UNIQUE REFERENCES activities (activity_id),\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    revisioned INTEGER NOT NULL CHECK (revisioned IN (0, 1)),\n    position INTEGER NOT NULL UNIQUE,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    dependencies TEXT NOT NULL,\n    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),\n    operation_id TEXT UNIQUE,\n    request TEXT,\n    request_sha256 TEXT,\n    receipt TEXT,\n    receipt_sequence INTEGER,\n    failures INTEGER NOT NULL DEFAULT 0 CHECK (failures >= 0),\n    flagged INTEGER NOT NULL DEFAULT 0 CHECK (flagged IN (0, 1)),\n    device_position INTEGER\n  ) STRICT",
        "CREATE INDEX outgoing_pending ON outgoing (status, position)",
        "CREATE INDEX outgoing_items ON outgoing (record_type, item_id, position)",
        "CREATE TABLE accepted_records (\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    installation_id TEXT,\n    device_position INTEGER,\n    summary_at INTEGER,\n    PRIMARY KEY (record_type, item_id)\n  ) STRICT",
        "CREATE INDEX accepted_summaries ON accepted_records (summary_at) WHERE summary_at IS NOT NULL",
        "CREATE TABLE device_positions (record_type TEXT PRIMARY KEY, last INTEGER NOT NULL) STRICT",
        "CREATE TABLE purged_records (record_type TEXT NOT NULL, item_id TEXT NOT NULL, PRIMARY KEY (record_type, item_id)) STRICT",
        "CREATE TABLE feed_cursor (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), sequence INTEGER NOT NULL, synced_at INTEGER) STRICT",
        "CREATE TABLE bootstrap (\n    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),\n    installed INTEGER NOT NULL CHECK (installed IN (0, 1)),\n    body TEXT, body_format INTEGER, body_length INTEGER, body_sha256 TEXT,\n    staged INTEGER NOT NULL DEFAULT 0 CHECK (staged >= 0),\n    after_ordinal INTEGER NOT NULL DEFAULT 0 CHECK (after_ordinal >= 0)\n  ) STRICT",
        "CREATE TABLE bootstrap_rows (\n    position INTEGER PRIMARY KEY,\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    installation_id TEXT,\n    device_position INTEGER,\n    summary_at INTEGER\n  ) STRICT",
        "CREATE TABLE history (\n    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),\n    recent INTEGER CHECK (recent >= 0),\n    download_requested INTEGER NOT NULL CHECK (download_requested IN (0, 1)),\n    download_total INTEGER CHECK (download_total >= 0)\n  ) STRICT"
      ],
      "rows": {
        "meta": [
          {
            "name": "environment",
            "value": "production"
          },
          {
            "name": "account_id",
            "value": "recorded-account"
          },
          {
            "name": "installation_id",
            "value": "recorded-installation"
          },
          {
            "name": "schema_version",
            "value": "1"
          }
        ],
        "activities": [
          {
            "activity_id": "activity-1",
            "position": 1,
            "status": "unfinished",
            "sequence": 2,
            "body": "{\"activityId\":\"activity-1\",\"admission\":{\"meteringBasis\":\"free-play\",\"provenance\":\"recorded\"},\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"activity-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"990\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":{\\\"pocket\\\":27,\\\"turn\\\":1},\\\"phase\\\":\\\"revealing-outcome\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":1,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":2,\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"red\\\"}]}\",\"completion\":null,\"createdAt\":1790000000000,\"incomplete\":null,\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"sequence\":2,\"specification\":{\"activityId\":\"activity-1\",\"device\":\"recorded-installation\",\"funding\":\"1000\",\"fundingSource\":\"practice-funding\",\"game\":\"roulette\",\"owner\":\"recorded-account\",\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"version\":1,\"wheel\":\"single-zero\"},\"strategy\":null}}",
            "body_format": 1,
            "body_length": 1888,
            "body_sha256": "a1b32b4332eecde07c110db6e762003816e031cf04c414e3436ffec9e57d9836"
          }
        ],
        "transitions": [
          {
            "activity_id": "activity-1",
            "command_id": "record-0",
            "sequence": 0,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"activity-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"990\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":null,\\\"phase\\\":\\\"open-decision\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":0,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":1,\\\"strategy\\\":null,\\\"turn\\\":0,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"red\\\"}]}\",\"facts\":[{\"amount\":\"10\",\"kind\":\"wager-changed\",\"previous\":\"0\",\"target\":\"red\"}],\"receipt\":{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"red\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0}}",
            "body_format": 1,
            "body_length": 1357,
            "body_sha256": "f86d4879a4994a0492555629f48470e84cefcfe20e603ea2fe42bded456fdd80"
          },
          {
            "activity_id": "activity-1",
            "command_id": "record-1",
            "sequence": 1,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"activity-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"990\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":{\\\"pocket\\\":27,\\\"turn\\\":1},\\\"phase\\\":\\\"revealing-outcome\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":1,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":2,\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"red\\\"}]}\",\"facts\":[{\"kind\":\"turn-began\",\"turn\":1,\"wagers\":[{\"amount\":\"10\",\"target\":\"red\"}]},{\"kind\":\"outcome-generated\",\"pocket\":27,\"turn\":1}],\"receipt\":{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1}}",
            "body_format": 1,
            "body_length": 1521,
            "body_sha256": "ba8e71b5daa6761ba35aaaf65fcc1083b2bed3293a985754de6d34e81a24f106"
          }
        ],
        "effects": [],
        "outgoing": [],
        "accepted_records": [],
        "device_positions": [],
        "purged_records": [],
        "feed_cursor": [
          {
            "singleton": 1,
            "sequence": 0,
            "synced_at": null
          }
        ],
        "bootstrap": [
          {
            "singleton": 1,
            "installed": 0,
            "body": null,
            "body_format": null,
            "body_length": null,
            "body_sha256": null,
            "staged": 0,
            "after_ordinal": 0
          }
        ],
        "bootstrap_rows": [],
        "history": [
          {
            "singleton": 1,
            "recent": null,
            "download_requested": 0,
            "download_total": null
          }
        ]
      }
    },
    {
      "name": "roulette, a spin settled",
      "environment": "production",
      "accountId": "recorded-account",
      "installationId": "recorded-installation",
      "unfinished": {
        "activityId": "activity-1",
        "game": "roulette",
        "phase": "open-decision",
        "finalCashOut": "1010"
      },
      "schema": [
        "CREATE TABLE meta (name TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT",
        "CREATE TABLE activities (\n    activity_id TEXT PRIMARY KEY,\n    position INTEGER NOT NULL UNIQUE,\n    status TEXT NOT NULL CHECK (status IN ('unfinished', 'completed', 'incomplete')),\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL\n  ) STRICT",
        "CREATE INDEX activities_unfinished ON activities (status, position)",
        "CREATE TABLE transitions (\n    activity_id TEXT NOT NULL REFERENCES activities (activity_id),\n    command_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    PRIMARY KEY (activity_id, command_id),\n    UNIQUE (activity_id, sequence)\n  ) STRICT",
        "CREATE TABLE effects (\n    activity_id TEXT NOT NULL REFERENCES activities (activity_id),\n    effect_key TEXT NOT NULL,\n    position INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    PRIMARY KEY (activity_id, effect_key)\n  ) STRICT",
        "CREATE TABLE outgoing (\n    id TEXT PRIMARY KEY,\n    activity_id TEXT UNIQUE REFERENCES activities (activity_id),\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    revisioned INTEGER NOT NULL CHECK (revisioned IN (0, 1)),\n    position INTEGER NOT NULL UNIQUE,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    dependencies TEXT NOT NULL,\n    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),\n    operation_id TEXT UNIQUE,\n    request TEXT,\n    request_sha256 TEXT,\n    receipt TEXT,\n    receipt_sequence INTEGER,\n    failures INTEGER NOT NULL DEFAULT 0 CHECK (failures >= 0),\n    flagged INTEGER NOT NULL DEFAULT 0 CHECK (flagged IN (0, 1)),\n    device_position INTEGER\n  ) STRICT",
        "CREATE INDEX outgoing_pending ON outgoing (status, position)",
        "CREATE INDEX outgoing_items ON outgoing (record_type, item_id, position)",
        "CREATE TABLE accepted_records (\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    installation_id TEXT,\n    device_position INTEGER,\n    summary_at INTEGER,\n    PRIMARY KEY (record_type, item_id)\n  ) STRICT",
        "CREATE INDEX accepted_summaries ON accepted_records (summary_at) WHERE summary_at IS NOT NULL",
        "CREATE TABLE device_positions (record_type TEXT PRIMARY KEY, last INTEGER NOT NULL) STRICT",
        "CREATE TABLE purged_records (record_type TEXT NOT NULL, item_id TEXT NOT NULL, PRIMARY KEY (record_type, item_id)) STRICT",
        "CREATE TABLE feed_cursor (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), sequence INTEGER NOT NULL, synced_at INTEGER) STRICT",
        "CREATE TABLE bootstrap (\n    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),\n    installed INTEGER NOT NULL CHECK (installed IN (0, 1)),\n    body TEXT, body_format INTEGER, body_length INTEGER, body_sha256 TEXT,\n    staged INTEGER NOT NULL DEFAULT 0 CHECK (staged >= 0),\n    after_ordinal INTEGER NOT NULL DEFAULT 0 CHECK (after_ordinal >= 0)\n  ) STRICT",
        "CREATE TABLE bootstrap_rows (\n    position INTEGER PRIMARY KEY,\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    installation_id TEXT,\n    device_position INTEGER,\n    summary_at INTEGER\n  ) STRICT",
        "CREATE TABLE history (\n    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),\n    recent INTEGER CHECK (recent >= 0),\n    download_requested INTEGER NOT NULL CHECK (download_requested IN (0, 1)),\n    download_total INTEGER CHECK (download_total >= 0)\n  ) STRICT"
      ],
      "rows": {
        "meta": [
          {
            "name": "environment",
            "value": "production"
          },
          {
            "name": "account_id",
            "value": "recorded-account"
          },
          {
            "name": "installation_id",
            "value": "recorded-installation"
          },
          {
            "name": "schema_version",
            "value": "1"
          }
        ],
        "activities": [
          {
            "activity_id": "activity-1",
            "position": 1,
            "status": "unfinished",
            "sequence": 4,
            "body": "{\"activityId\":\"activity-1\",\"admission\":{\"meteringBasis\":\"free-play\",\"provenance\":\"recorded\"},\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"activity-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"990\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"10\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":{\\\"pocket\\\":27,\\\"turn\\\":1},\\\"phase\\\":\\\"open-decision\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":1,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"settle-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-2\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":2},{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"20\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"black\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-3\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":3}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":4,\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[{\\\"amount\\\":\\\"20\\\",\\\"target\\\":\\\"black\\\"}]}\",\"completion\":null,\"createdAt\":1790000000000,\"incomplete\":null,\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"sequence\":4,\"specification\":{\"activityId\":\"activity-1\",\"device\":\"recorded-installation\",\"funding\":\"1000\",\"fundingSource\":\"practice-funding\",\"game\":\"roulette\",\"owner\":\"recorded-account\",\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"version\":1,\"wheel\":\"single-zero\"},\"strategy\":null}}",
            "body_format": 1,
            "body_length": 2188,
            "body_sha256": "937a1598a81946d541282c860ed0651d9c7f2e69e73f949c3c30d5dcd5541538"
          }
        ],
        "transitions": [
          {
            "activity_id": "activity-1",
            "command_id": "record-0",
            "sequence": 0,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"activity-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"990\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":null,\\\"phase\\\":\\\"open-decision\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":0,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":1,\\\"strategy\\\":null,\\\"turn\\\":0,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"red\\\"}]}\",\"facts\":[{\"amount\":\"10\",\"kind\":\"wager-changed\",\"previous\":\"0\",\"target\":\"red\"}],\"receipt\":{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"red\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0}}",
            "body_format": 1,
            "body_length": 1357,
            "body_sha256": "f86d4879a4994a0492555629f48470e84cefcfe20e603ea2fe42bded456fdd80"
          },
          {
            "activity_id": "activity-1",
            "command_id": "record-1",
            "sequence": 1,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"activity-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"990\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":{\\\"pocket\\\":27,\\\"turn\\\":1},\\\"phase\\\":\\\"revealing-outcome\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":1,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":2,\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"red\\\"}]}\",\"facts\":[{\"kind\":\"turn-began\",\"turn\":1,\"wagers\":[{\"amount\":\"10\",\"target\":\"red\"}]},{\"kind\":\"outcome-generated\",\"pocket\":27,\"turn\":1}],\"receipt\":{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1}}",
            "body_format": 1,
            "body_length": 1521,
            "body_sha256": "ba8e71b5daa6761ba35aaaf65fcc1083b2bed3293a985754de6d34e81a24f106"
          },
          {
            "activity_id": "activity-1",
            "command_id": "record-2",
            "sequence": 2,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"activity-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"1010\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"10\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":{\\\"pocket\\\":27,\\\"turn\\\":1},\\\"phase\\\":\\\"settled-outcome\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":1,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"settle-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-2\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":2}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":3,\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[]}\",\"facts\":[{\"kind\":\"wager-settled\",\"net\":\"10\",\"result\":\"win\",\"returned\":\"20\",\"stake\":\"10\",\"target\":\"red\",\"turn\":1}],\"receipt\":{\"command\":\"{\\\"kind\\\":\\\"settle-turn\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2}}",
            "body_format": 1,
            "body_length": 1588,
            "body_sha256": "beff4ad65d60545a227a02d9986aa8a36f18708ebdce4093412e989c610ed60a"
          },
          {
            "activity_id": "activity-1",
            "command_id": "record-3",
            "sequence": 3,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"activity-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"990\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"10\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":{\\\"pocket\\\":27,\\\"turn\\\":1},\\\"phase\\\":\\\"open-decision\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":1,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"settle-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-2\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":2},{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"20\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"black\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-3\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":3}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":4,\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[{\\\"amount\\\":\\\"20\\\",\\\"target\\\":\\\"black\\\"}]}\",\"facts\":[{\"amount\":\"20\",\"kind\":\"wager-changed\",\"previous\":\"0\",\"target\":\"black\"}],\"receipt\":{\"command\":\"{\\\"amount\\\":\\\"20\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"black\\\"}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3}}",
            "body_format": 1,
            "body_length": 1809,
            "body_sha256": "eeef61e4d1b5616a3e3a6299d42844e80f64060483bf6edac1f0f883946ea98a"
          }
        ],
        "effects": [],
        "outgoing": [],
        "accepted_records": [],
        "device_positions": [],
        "purged_records": [],
        "feed_cursor": [
          {
            "singleton": 1,
            "sequence": 0,
            "synced_at": null
          }
        ],
        "bootstrap": [
          {
            "singleton": 1,
            "installed": 0,
            "body": null,
            "body_format": null,
            "body_length": null,
            "body_sha256": null,
            "staged": 0,
            "after_ordinal": 0
          }
        ],
        "bootstrap_rows": [],
        "history": [
          {
            "singleton": 1,
            "recent": null,
            "download_requested": 0,
            "download_total": null
          }
        ]
      }
    },
    {
      "name": "roulette, stopped with a wager down, final settlement under way",
      "environment": "production",
      "accountId": "recorded-account",
      "installationId": "recorded-installation",
      "unfinished": {
        "activityId": "activity-1",
        "game": "roulette",
        "phase": "final-settlement",
        "finalCashOut": "1010"
      },
      "schema": [
        "CREATE TABLE meta (name TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT",
        "CREATE TABLE activities (\n    activity_id TEXT PRIMARY KEY,\n    position INTEGER NOT NULL UNIQUE,\n    status TEXT NOT NULL CHECK (status IN ('unfinished', 'completed', 'incomplete')),\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL\n  ) STRICT",
        "CREATE INDEX activities_unfinished ON activities (status, position)",
        "CREATE TABLE transitions (\n    activity_id TEXT NOT NULL REFERENCES activities (activity_id),\n    command_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    PRIMARY KEY (activity_id, command_id),\n    UNIQUE (activity_id, sequence)\n  ) STRICT",
        "CREATE TABLE effects (\n    activity_id TEXT NOT NULL REFERENCES activities (activity_id),\n    effect_key TEXT NOT NULL,\n    position INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    PRIMARY KEY (activity_id, effect_key)\n  ) STRICT",
        "CREATE TABLE outgoing (\n    id TEXT PRIMARY KEY,\n    activity_id TEXT UNIQUE REFERENCES activities (activity_id),\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    revisioned INTEGER NOT NULL CHECK (revisioned IN (0, 1)),\n    position INTEGER NOT NULL UNIQUE,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    dependencies TEXT NOT NULL,\n    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),\n    operation_id TEXT UNIQUE,\n    request TEXT,\n    request_sha256 TEXT,\n    receipt TEXT,\n    receipt_sequence INTEGER,\n    failures INTEGER NOT NULL DEFAULT 0 CHECK (failures >= 0),\n    flagged INTEGER NOT NULL DEFAULT 0 CHECK (flagged IN (0, 1)),\n    device_position INTEGER\n  ) STRICT",
        "CREATE INDEX outgoing_pending ON outgoing (status, position)",
        "CREATE INDEX outgoing_items ON outgoing (record_type, item_id, position)",
        "CREATE TABLE accepted_records (\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    installation_id TEXT,\n    device_position INTEGER,\n    summary_at INTEGER,\n    PRIMARY KEY (record_type, item_id)\n  ) STRICT",
        "CREATE INDEX accepted_summaries ON accepted_records (summary_at) WHERE summary_at IS NOT NULL",
        "CREATE TABLE device_positions (record_type TEXT PRIMARY KEY, last INTEGER NOT NULL) STRICT",
        "CREATE TABLE purged_records (record_type TEXT NOT NULL, item_id TEXT NOT NULL, PRIMARY KEY (record_type, item_id)) STRICT",
        "CREATE TABLE feed_cursor (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), sequence INTEGER NOT NULL, synced_at INTEGER) STRICT",
        "CREATE TABLE bootstrap (\n    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),\n    installed INTEGER NOT NULL CHECK (installed IN (0, 1)),\n    body TEXT, body_format INTEGER, body_length INTEGER, body_sha256 TEXT,\n    staged INTEGER NOT NULL DEFAULT 0 CHECK (staged >= 0),\n    after_ordinal INTEGER NOT NULL DEFAULT 0 CHECK (after_ordinal >= 0)\n  ) STRICT",
        "CREATE TABLE bootstrap_rows (\n    position INTEGER PRIMARY KEY,\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    installation_id TEXT,\n    device_position INTEGER,\n    summary_at INTEGER\n  ) STRICT",
        "CREATE TABLE history (\n    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),\n    recent INTEGER CHECK (recent >= 0),\n    download_requested INTEGER NOT NULL CHECK (download_requested IN (0, 1)),\n    download_total INTEGER CHECK (download_total >= 0)\n  ) STRICT"
      ],
      "rows": {
        "meta": [
          {
            "name": "environment",
            "value": "production"
          },
          {
            "name": "account_id",
            "value": "recorded-account"
          },
          {
            "name": "installation_id",
            "value": "recorded-installation"
          },
          {
            "name": "schema_version",
            "value": "1"
          }
        ],
        "activities": [
          {
            "activity_id": "activity-1",
            "position": 1,
            "status": "unfinished",
            "sequence": 5,
            "body": "{\"activityId\":\"activity-1\",\"admission\":{\"meteringBasis\":\"free-play\",\"provenance\":\"recorded\"},\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"activity-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"1010\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"10\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":{\\\"pocket\\\":27,\\\"turn\\\":1},\\\"phase\\\":\\\"final-settlement\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":1,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"settle-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-2\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":2},{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"even\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-3\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":3},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"request-stop\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-4\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":4}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":5,\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[]}\",\"completion\":null,\"createdAt\":1790000000000,\"incomplete\":null,\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"sequence\":5,\"specification\":{\"activityId\":\"activity-1\",\"device\":\"recorded-installation\",\"funding\":\"1000\",\"fundingSource\":\"practice-funding\",\"game\":\"roulette\",\"owner\":\"recorded-account\",\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"version\":1,\"wheel\":\"single-zero\"},\"strategy\":null}}",
            "body_format": 1,
            "body_length": 2275,
            "body_sha256": "767beb25ca9c535636e327616d9f700d2660c79cfabf0ca0cb4256a347dd2083"
          }
        ],
        "transitions": [
          {
            "activity_id": "activity-1",
            "command_id": "record-0",
            "sequence": 0,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"activity-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"990\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":null,\\\"phase\\\":\\\"open-decision\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":0,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":1,\\\"strategy\\\":null,\\\"turn\\\":0,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"red\\\"}]}\",\"facts\":[{\"amount\":\"10\",\"kind\":\"wager-changed\",\"previous\":\"0\",\"target\":\"red\"}],\"receipt\":{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"red\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0}}",
            "body_format": 1,
            "body_length": 1357,
            "body_sha256": "f86d4879a4994a0492555629f48470e84cefcfe20e603ea2fe42bded456fdd80"
          },
          {
            "activity_id": "activity-1",
            "command_id": "record-1",
            "sequence": 1,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"activity-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"990\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":{\\\"pocket\\\":27,\\\"turn\\\":1},\\\"phase\\\":\\\"revealing-outcome\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":1,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":2,\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"red\\\"}]}\",\"facts\":[{\"kind\":\"turn-began\",\"turn\":1,\"wagers\":[{\"amount\":\"10\",\"target\":\"red\"}]},{\"kind\":\"outcome-generated\",\"pocket\":27,\"turn\":1}],\"receipt\":{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1}}",
            "body_format": 1,
            "body_length": 1521,
            "body_sha256": "ba8e71b5daa6761ba35aaaf65fcc1083b2bed3293a985754de6d34e81a24f106"
          },
          {
            "activity_id": "activity-1",
            "command_id": "record-2",
            "sequence": 2,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"activity-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"1010\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"10\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":{\\\"pocket\\\":27,\\\"turn\\\":1},\\\"phase\\\":\\\"settled-outcome\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":1,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"settle-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-2\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":2}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":3,\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[]}\",\"facts\":[{\"kind\":\"wager-settled\",\"net\":\"10\",\"result\":\"win\",\"returned\":\"20\",\"stake\":\"10\",\"target\":\"red\",\"turn\":1}],\"receipt\":{\"command\":\"{\\\"kind\\\":\\\"settle-turn\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2}}",
            "body_format": 1,
            "body_length": 1588,
            "body_sha256": "beff4ad65d60545a227a02d9986aa8a36f18708ebdce4093412e989c610ed60a"
          },
          {
            "activity_id": "activity-1",
            "command_id": "record-3",
            "sequence": 3,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"activity-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"1000\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"10\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":{\\\"pocket\\\":27,\\\"turn\\\":1},\\\"phase\\\":\\\"open-decision\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":1,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"settle-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-2\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":2},{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"even\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-3\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":3}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":4,\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"even\\\"}]}\",\"facts\":[{\"amount\":\"10\",\"kind\":\"wager-changed\",\"previous\":\"0\",\"target\":\"even\"}],\"receipt\":{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"even\\\"}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3}}",
            "body_format": 1,
            "body_length": 1806,
            "body_sha256": "3151f16e3bb9bc9a1cec95e171109b88fd378cca1f4b11dcc47be645a2787f8c"
          },
          {
            "activity_id": "activity-1",
            "command_id": "record-4",
            "sequence": 4,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"activity-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"1010\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"10\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":{\\\"pocket\\\":27,\\\"turn\\\":1},\\\"phase\\\":\\\"final-settlement\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":1,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"settle-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-2\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":2},{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"even\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-3\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":3},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"request-stop\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-4\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":4}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":5,\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[]}\",\"facts\":[{\"kind\":\"stop-requested\",\"phase\":\"open-decision\"},{\"amount\":\"10\",\"kind\":\"wager-returned\",\"target\":\"even\"}],\"receipt\":{\"command\":\"{\\\"kind\\\":\\\"request-stop\\\"}\",\"commandId\":\"record-4\",\"disposition\":\"applied\",\"sequence\":4}}",
            "body_format": 1,
            "body_length": 1893,
            "body_sha256": "c901055fc4a6b788cd9b70775d60b8a620a5fab35718cc10c20f9a9db265a654"
          }
        ],
        "effects": [],
        "outgoing": [],
        "accepted_records": [],
        "device_positions": [],
        "purged_records": [],
        "feed_cursor": [
          {
            "singleton": 1,
            "sequence": 0,
            "synced_at": null
          }
        ],
        "bootstrap": [
          {
            "singleton": 1,
            "installed": 0,
            "body": null,
            "body_format": null,
            "body_length": null,
            "body_sha256": null,
            "staged": 0,
            "after_ordinal": 0
          }
        ],
        "bootstrap_rows": [],
        "history": [
          {
            "singleton": 1,
            "recent": null,
            "download_requested": 0,
            "download_total": null
          }
        ]
      }
    },
    {
      "name": "roulette guided, a correction waiting for retry or override",
      "environment": "production",
      "accountId": "recorded-account",
      "installationId": "recorded-installation",
      "unfinished": {
        "activityId": "activity-1",
        "game": "roulette",
        "phase": "correction",
        "finalCashOut": "1000"
      },
      "schema": [
        "CREATE TABLE meta (name TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT",
        "CREATE TABLE activities (\n    activity_id TEXT PRIMARY KEY,\n    position INTEGER NOT NULL UNIQUE,\n    status TEXT NOT NULL CHECK (status IN ('unfinished', 'completed', 'incomplete')),\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL\n  ) STRICT",
        "CREATE INDEX activities_unfinished ON activities (status, position)",
        "CREATE TABLE transitions (\n    activity_id TEXT NOT NULL REFERENCES activities (activity_id),\n    command_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    PRIMARY KEY (activity_id, command_id),\n    UNIQUE (activity_id, sequence)\n  ) STRICT",
        "CREATE TABLE effects (\n    activity_id TEXT NOT NULL REFERENCES activities (activity_id),\n    effect_key TEXT NOT NULL,\n    position INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    PRIMARY KEY (activity_id, effect_key)\n  ) STRICT",
        "CREATE TABLE outgoing (\n    id TEXT PRIMARY KEY,\n    activity_id TEXT UNIQUE REFERENCES activities (activity_id),\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    revisioned INTEGER NOT NULL CHECK (revisioned IN (0, 1)),\n    position INTEGER NOT NULL UNIQUE,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    dependencies TEXT NOT NULL,\n    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),\n    operation_id TEXT UNIQUE,\n    request TEXT,\n    request_sha256 TEXT,\n    receipt TEXT,\n    receipt_sequence INTEGER,\n    failures INTEGER NOT NULL DEFAULT 0 CHECK (failures >= 0),\n    flagged INTEGER NOT NULL DEFAULT 0 CHECK (flagged IN (0, 1)),\n    device_position INTEGER\n  ) STRICT",
        "CREATE INDEX outgoing_pending ON outgoing (status, position)",
        "CREATE INDEX outgoing_items ON outgoing (record_type, item_id, position)",
        "CREATE TABLE accepted_records (\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    installation_id TEXT,\n    device_position INTEGER,\n    summary_at INTEGER,\n    PRIMARY KEY (record_type, item_id)\n  ) STRICT",
        "CREATE INDEX accepted_summaries ON accepted_records (summary_at) WHERE summary_at IS NOT NULL",
        "CREATE TABLE device_positions (record_type TEXT PRIMARY KEY, last INTEGER NOT NULL) STRICT",
        "CREATE TABLE purged_records (record_type TEXT NOT NULL, item_id TEXT NOT NULL, PRIMARY KEY (record_type, item_id)) STRICT",
        "CREATE TABLE feed_cursor (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), sequence INTEGER NOT NULL, synced_at INTEGER) STRICT",
        "CREATE TABLE bootstrap (\n    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),\n    installed INTEGER NOT NULL CHECK (installed IN (0, 1)),\n    body TEXT, body_format INTEGER, body_length INTEGER, body_sha256 TEXT,\n    staged INTEGER NOT NULL DEFAULT 0 CHECK (staged >= 0),\n    after_ordinal INTEGER NOT NULL DEFAULT 0 CHECK (after_ordinal >= 0)\n  ) STRICT",
        "CREATE TABLE bootstrap_rows (\n    position INTEGER PRIMARY KEY,\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    installation_id TEXT,\n    device_position INTEGER,\n    summary_at INTEGER\n  ) STRICT",
        "CREATE TABLE history (\n    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),\n    recent INTEGER CHECK (recent >= 0),\n    download_requested INTEGER NOT NULL CHECK (download_requested IN (0, 1)),\n    download_total INTEGER CHECK (download_total >= 0)\n  ) STRICT"
      ],
      "rows": {
        "meta": [
          {
            "name": "environment",
            "value": "production"
          },
          {
            "name": "account_id",
            "value": "recorded-account"
          },
          {
            "name": "installation_id",
            "value": "recorded-installation"
          },
          {
            "name": "schema_version",
            "value": "1"
          }
        ],
        "activities": [
          {
            "activity_id": "activity-1",
            "position": 1,
            "status": "unfinished",
            "sequence": 2,
            "body": "{\"activityId\":\"activity-1\",\"admission\":{\"meteringBasis\":\"free-play\",\"provenance\":\"recorded\"},\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"activity-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"950\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":{\\\"id\\\":\\\"test-flat-even-money\\\",\\\"version\\\":1}},\\\"outcome\\\":null,\\\"phase\\\":\\\"correction\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":0,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"50\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"assessed\\\",\\\"sequence\\\":1}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":2,\\\"strategy\\\":{\\\"coachedTurn\\\":false,\\\"correction\\\":{\\\"actual\\\":[{\\\"amount\\\":\\\"50\\\",\\\"target\\\":\\\"red\\\"}],\\\"explanation\\\":{\\\"fallback\\\":null,\\\"instructions\\\":[{\\\"id\\\":\\\"flat\\\",\\\"label\\\":\\\"1 unit on the target, every spin\\\"}],\\\"prescription\\\":{\\\"bets\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"red\\\"}],\\\"held\\\":[],\\\"status\\\":\\\"prescribed\\\"},\\\"situation\\\":{\\\"available\\\":\\\"1000\\\",\\\"subjects\\\":{\\\"last-pocket-color\\\":\\\"none\\\",\\\"last-result\\\":\\\"none\\\"},\\\"values\\\":{}},\\\"state\\\":{\\\"counters\\\":{},\\\"cycleTurn\\\":0,\\\"lastResult\\\":\\\"none\\\",\\\"lists\\\":{}}},\\\"id\\\":\\\"activity-1/departure/1\\\",\\\"turn\\\":1},\\\"cycle\\\":{\\\"number\\\":1,\\\"turns\\\":[]},\\\"cycleEnd\\\":null,\\\"decisions\\\":{\\\"betting\\\":0,\\\"playing\\\":0},\\\"deferred\\\":null,\\\"definition\\\":{\\\"adjustments\\\":[],\\\"counters\\\":[],\\\"format\\\":1,\\\"game\\\":\\\"roulette\\\",\\\"id\\\":\\\"test-flat-even-money\\\",\\\"instructions\\\":[{\\\"bets\\\":[{\\\"amount\\\":{\\\"lit\\\":\\\"10\\\"},\\\"target\\\":{\\\"param\\\":\\\"target\\\"}}],\\\"id\\\":\\\"flat\\\",\\\"label\\\":\\\"1 unit on the target, every spin\\\",\\\"when\\\":{\\\"always\\\":true}}],\\\"name\\\":\\\"Flat even-money\\\",\\\"parameters\\\":[{\\\"choices\\\":[\\\"red\\\",\\\"black\\\",\\\"odd\\\",\\\"even\\\",\\\"low\\\",\\\"high\\\"],\\\"default\\\":\\\"red\\\",\\\"id\\\":\\\"target\\\",\\\"label\\\":\\\"Target\\\"}],\\\"revision\\\":1,\\\"stopWhen\\\":null,\\\"table\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheels\\\":[\\\"single-zero\\\",\\\"double-zero\\\"]}},\\\"departures\\\":[],\\\"parameters\\\":{\\\"target\\\":\\\"red\\\"},\\\"progress\\\":{\\\"counters\\\":{},\\\"cycleTurn\\\":0,\\\"lastResult\\\":\\\"none\\\",\\\"lists\\\":{}},\\\"status\\\":\\\"active\\\"},\\\"turn\\\":0,\\\"wagers\\\":[{\\\"amount\\\":\\\"50\\\",\\\"target\\\":\\\"red\\\"}]}\",\"completion\":null,\"createdAt\":1790000000000,\"incomplete\":null,\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"sequence\":2,\"specification\":{\"activityId\":\"activity-1\",\"device\":\"recorded-installation\",\"funding\":\"1000\",\"fundingSource\":\"practice-funding\",\"game\":\"roulette\",\"owner\":\"recorded-account\",\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"version\":1,\"wheel\":\"single-zero\"},\"strategy\":{\"definition\":{\"adjustments\":[],\"counters\":[],\"format\":1,\"game\":\"roulette\",\"id\":\"test-flat-even-money\",\"instructions\":[{\"bets\":[{\"amount\":{\"lit\":\"10\"},\"target\":{\"param\":\"target\"}}],\"id\":\"flat\",\"label\":\"1 unit on the target, every spin\",\"when\":{\"always\":true}}],\"name\":\"Flat even-money\",\"parameters\":[{\"choices\":[\"red\",\"black\",\"odd\",\"even\",\"low\",\"high\"],\"default\":\"red\",\"id\":\"target\",\"label\":\"Target\"}],\"revision\":1,\"stopWhen\":null,\"table\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheels\":[\"single-zero\",\"double-zero\"]}},\"parameters\":{\"target\":\"red\"}}}}",
            "body_format": 1,
            "body_length": 4003,
            "body_sha256": "c65c76c84a823d3060e03f2eac1c120c1304b207daa69329d75f5f91ee98cf0f"
          }
        ],
        "transitions": [
          {
            "activity_id": "activity-1",
            "command_id": "record-0",
            "sequence": 0,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"activity-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"950\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":{\\\"id\\\":\\\"test-flat-even-money\\\",\\\"version\\\":1}},\\\"outcome\\\":null,\\\"phase\\\":\\\"open-decision\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":0,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"50\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":1,\\\"strategy\\\":{\\\"coachedTurn\\\":false,\\\"correction\\\":null,\\\"cycle\\\":{\\\"number\\\":1,\\\"turns\\\":[]},\\\"cycleEnd\\\":null,\\\"decisions\\\":{\\\"betting\\\":0,\\\"playing\\\":0},\\\"deferred\\\":null,\\\"definition\\\":{\\\"adjustments\\\":[],\\\"counters\\\":[],\\\"format\\\":1,\\\"game\\\":\\\"roulette\\\",\\\"id\\\":\\\"test-flat-even-money\\\",\\\"instructions\\\":[{\\\"bets\\\":[{\\\"amount\\\":{\\\"lit\\\":\\\"10\\\"},\\\"target\\\":{\\\"param\\\":\\\"target\\\"}}],\\\"id\\\":\\\"flat\\\",\\\"label\\\":\\\"1 unit on the target, every spin\\\",\\\"when\\\":{\\\"always\\\":true}}],\\\"name\\\":\\\"Flat even-money\\\",\\\"parameters\\\":[{\\\"choices\\\":[\\\"red\\\",\\\"black\\\",\\\"odd\\\",\\\"even\\\",\\\"low\\\",\\\"high\\\"],\\\"default\\\":\\\"red\\\",\\\"id\\\":\\\"target\\\",\\\"label\\\":\\\"Target\\\"}],\\\"revision\\\":1,\\\"stopWhen\\\":null,\\\"table\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheels\\\":[\\\"single-zero\\\",\\\"double-zero\\\"]}},\\\"departures\\\":[],\\\"parameters\\\":{\\\"target\\\":\\\"red\\\"},\\\"progress\\\":{\\\"counters\\\":{},\\\"cycleTurn\\\":0,\\\"lastResult\\\":\\\"none\\\",\\\"lists\\\":{}},\\\"status\\\":\\\"active\\\"},\\\"turn\\\":0,\\\"wagers\\\":[{\\\"amount\\\":\\\"50\\\",\\\"target\\\":\\\"red\\\"}]}\",\"facts\":[{\"amount\":\"50\",\"kind\":\"wager-changed\",\"previous\":\"0\",\"target\":\"red\"}],\"receipt\":{\"command\":\"{\\\"amount\\\":\\\"50\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"red\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0}}",
            "body_format": 1,
            "body_length": 2387,
            "body_sha256": "28a971c09e7e0985868465e10ea5ba00f5742b422d780c31754bea94a7c06906"
          },
          {
            "activity_id": "activity-1",
            "command_id": "record-1",
            "sequence": 1,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"activity-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"950\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":{\\\"id\\\":\\\"test-flat-even-money\\\",\\\"version\\\":1}},\\\"outcome\\\":null,\\\"phase\\\":\\\"correction\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":0,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"50\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"assessed\\\",\\\"sequence\\\":1}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":2,\\\"strategy\\\":{\\\"coachedTurn\\\":false,\\\"correction\\\":{\\\"actual\\\":[{\\\"amount\\\":\\\"50\\\",\\\"target\\\":\\\"red\\\"}],\\\"explanation\\\":{\\\"fallback\\\":null,\\\"instructions\\\":[{\\\"id\\\":\\\"flat\\\",\\\"label\\\":\\\"1 unit on the target, every spin\\\"}],\\\"prescription\\\":{\\\"bets\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"red\\\"}],\\\"held\\\":[],\\\"status\\\":\\\"prescribed\\\"},\\\"situation\\\":{\\\"available\\\":\\\"1000\\\",\\\"subjects\\\":{\\\"last-pocket-color\\\":\\\"none\\\",\\\"last-result\\\":\\\"none\\\"},\\\"values\\\":{}},\\\"state\\\":{\\\"counters\\\":{},\\\"cycleTurn\\\":0,\\\"lastResult\\\":\\\"none\\\",\\\"lists\\\":{}}},\\\"id\\\":\\\"activity-1/departure/1\\\",\\\"turn\\\":1},\\\"cycle\\\":{\\\"number\\\":1,\\\"turns\\\":[]},\\\"cycleEnd\\\":null,\\\"decisions\\\":{\\\"betting\\\":0,\\\"playing\\\":0},\\\"deferred\\\":null,\\\"definition\\\":{\\\"adjustments\\\":[],\\\"counters\\\":[],\\\"format\\\":1,\\\"game\\\":\\\"roulette\\\",\\\"id\\\":\\\"test-flat-even-money\\\",\\\"instructions\\\":[{\\\"bets\\\":[{\\\"amount\\\":{\\\"lit\\\":\\\"10\\\"},\\\"target\\\":{\\\"param\\\":\\\"target\\\"}}],\\\"id\\\":\\\"flat\\\",\\\"label\\\":\\\"1 unit on the target, every spin\\\",\\\"when\\\":{\\\"always\\\":true}}],\\\"name\\\":\\\"Flat even-money\\\",\\\"parameters\\\":[{\\\"choices\\\":[\\\"red\\\",\\\"black\\\",\\\"odd\\\",\\\"even\\\",\\\"low\\\",\\\"high\\\"],\\\"default\\\":\\\"red\\\",\\\"id\\\":\\\"target\\\",\\\"label\\\":\\\"Target\\\"}],\\\"revision\\\":1,\\\"stopWhen\\\":null,\\\"table\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheels\\\":[\\\"single-zero\\\",\\\"double-zero\\\"]}},\\\"departures\\\":[],\\\"parameters\\\":{\\\"target\\\":\\\"red\\\"},\\\"progress\\\":{\\\"counters\\\":{},\\\"cycleTurn\\\":0,\\\"lastResult\\\":\\\"none\\\",\\\"lists\\\":{}},\\\"status\\\":\\\"active\\\"},\\\"turn\\\":0,\\\"wagers\\\":[{\\\"amount\\\":\\\"50\\\",\\\"target\\\":\\\"red\\\"}]}\",\"facts\":[{\"actual\":[{\"amount\":\"50\",\"target\":\"red\"}],\"departureId\":\"activity-1/departure/1\",\"explanation\":{\"fallback\":null,\"instructions\":[{\"id\":\"flat\",\"label\":\"1 unit on the target, every spin\"}],\"prescription\":{\"bets\":[{\"amount\":\"10\",\"target\":\"red\"}],\"held\":[],\"status\":\"prescribed\"},\"situation\":{\"available\":\"1000\",\"subjects\":{\"last-pocket-color\":\"none\",\"last-result\":\"none\"},\"values\":{}},\"state\":{\"counters\":{},\"cycleTurn\":0,\"lastResult\":\"none\",\"lists\":{}}},\"kind\":\"correction-offered\",\"turn\":1}],\"receipt\":{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"assessed\",\"sequence\":1}}",
            "body_format": 1,
            "body_length": 3417,
            "body_sha256": "586c1fb131d7edb88baf78e4883314820054e5a41e17eca3d123512b39ea3f1e"
          }
        ],
        "effects": [],
        "outgoing": [],
        "accepted_records": [],
        "device_positions": [],
        "purged_records": [],
        "feed_cursor": [
          {
            "singleton": 1,
            "sequence": 0,
            "synced_at": null
          }
        ],
        "bootstrap": [
          {
            "singleton": 1,
            "installed": 0,
            "body": null,
            "body_format": null,
            "body_length": null,
            "body_sha256": null,
            "staged": 0,
            "after_ordinal": 0
          }
        ],
        "bootstrap_rows": [],
        "history": [
          {
            "singleton": 1,
            "recent": null,
            "download_requested": 0,
            "download_total": null
          }
        ]
      }
    },
    {
      "name": "roulette guided, a progression cycle ended by an override",
      "environment": "production",
      "accountId": "recorded-account",
      "installationId": "recorded-installation",
      "unfinished": {
        "activityId": "activity-1",
        "game": "roulette",
        "phase": "cycle-completion",
        "finalCashOut": "1050"
      },
      "schema": [
        "CREATE TABLE meta (name TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT",
        "CREATE TABLE activities (\n    activity_id TEXT PRIMARY KEY,\n    position INTEGER NOT NULL UNIQUE,\n    status TEXT NOT NULL CHECK (status IN ('unfinished', 'completed', 'incomplete')),\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL\n  ) STRICT",
        "CREATE INDEX activities_unfinished ON activities (status, position)",
        "CREATE TABLE transitions (\n    activity_id TEXT NOT NULL REFERENCES activities (activity_id),\n    command_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    PRIMARY KEY (activity_id, command_id),\n    UNIQUE (activity_id, sequence)\n  ) STRICT",
        "CREATE TABLE effects (\n    activity_id TEXT NOT NULL REFERENCES activities (activity_id),\n    effect_key TEXT NOT NULL,\n    position INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    PRIMARY KEY (activity_id, effect_key)\n  ) STRICT",
        "CREATE TABLE outgoing (\n    id TEXT PRIMARY KEY,\n    activity_id TEXT UNIQUE REFERENCES activities (activity_id),\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    revisioned INTEGER NOT NULL CHECK (revisioned IN (0, 1)),\n    position INTEGER NOT NULL UNIQUE,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    dependencies TEXT NOT NULL,\n    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),\n    operation_id TEXT UNIQUE,\n    request TEXT,\n    request_sha256 TEXT,\n    receipt TEXT,\n    receipt_sequence INTEGER,\n    failures INTEGER NOT NULL DEFAULT 0 CHECK (failures >= 0),\n    flagged INTEGER NOT NULL DEFAULT 0 CHECK (flagged IN (0, 1)),\n    device_position INTEGER\n  ) STRICT",
        "CREATE INDEX outgoing_pending ON outgoing (status, position)",
        "CREATE INDEX outgoing_items ON outgoing (record_type, item_id, position)",
        "CREATE TABLE accepted_records (\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    installation_id TEXT,\n    device_position INTEGER,\n    summary_at INTEGER,\n    PRIMARY KEY (record_type, item_id)\n  ) STRICT",
        "CREATE INDEX accepted_summaries ON accepted_records (summary_at) WHERE summary_at IS NOT NULL",
        "CREATE TABLE device_positions (record_type TEXT PRIMARY KEY, last INTEGER NOT NULL) STRICT",
        "CREATE TABLE purged_records (record_type TEXT NOT NULL, item_id TEXT NOT NULL, PRIMARY KEY (record_type, item_id)) STRICT",
        "CREATE TABLE feed_cursor (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), sequence INTEGER NOT NULL, synced_at INTEGER) STRICT",
        "CREATE TABLE bootstrap (\n    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),\n    installed INTEGER NOT NULL CHECK (installed IN (0, 1)),\n    body TEXT, body_format INTEGER, body_length INTEGER, body_sha256 TEXT,\n    staged INTEGER NOT NULL DEFAULT 0 CHECK (staged >= 0),\n    after_ordinal INTEGER NOT NULL DEFAULT 0 CHECK (after_ordinal >= 0)\n  ) STRICT",
        "CREATE TABLE bootstrap_rows (\n    position INTEGER PRIMARY KEY,\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    installation_id TEXT,\n    device_position INTEGER,\n    summary_at INTEGER\n  ) STRICT",
        "CREATE TABLE history (\n    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),\n    recent INTEGER CHECK (recent >= 0),\n    download_requested INTEGER NOT NULL CHECK (download_requested IN (0, 1)),\n    download_total INTEGER CHECK (download_total >= 0)\n  ) STRICT"
      ],
      "rows": {
        "meta": [
          {
            "name": "environment",
            "value": "production"
          },
          {
            "name": "account_id",
            "value": "recorded-account"
          },
          {
            "name": "installation_id",
            "value": "recorded-installation"
          },
          {
            "name": "schema_version",
            "value": "1"
          }
        ],
        "activities": [
          {
            "activity_id": "activity-1",
            "position": 1,
            "status": "unfinished",
            "sequence": 4,
            "body": "{\"activityId\":\"activity-1\",\"admission\":{\"meteringBasis\":\"free-play\",\"provenance\":\"recorded\"},\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"activity-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"1050\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"50\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":{\\\"id\\\":\\\"test-doubling\\\",\\\"version\\\":3}},\\\"outcome\\\":{\\\"pocket\\\":27,\\\"turn\\\":1},\\\"phase\\\":\\\"cycle-completion\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":1,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"50\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"assessed\\\",\\\"sequence\\\":1},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"override-correction\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-2\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":2},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"settle-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-3\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":3}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":4,\\\"strategy\\\":{\\\"coachedTurn\\\":false,\\\"correction\\\":null,\\\"cycle\\\":{\\\"number\\\":1,\\\"turns\\\":[{\\\"followed\\\":false,\\\"net\\\":\\\"50\\\",\\\"outcome\\\":\\\"27\\\",\\\"turn\\\":1,\\\"wagers\\\":[{\\\"amount\\\":\\\"50\\\",\\\"target\\\":\\\"red\\\"}]}]},\\\"cycleEnd\\\":\\\"override\\\",\\\"decisions\\\":{\\\"betting\\\":1,\\\"playing\\\":0},\\\"deferred\\\":null,\\\"definition\\\":{\\\"adjustments\\\":[{\\\"counter\\\":\\\"stake\\\",\\\"id\\\":\\\"double\\\",\\\"on\\\":\\\"loss\\\",\\\"to\\\":{\\\"mul\\\":[{\\\"counter\\\":\\\"stake\\\"},{\\\"lit\\\":\\\"2\\\"}]}},{\\\"counter\\\":\\\"stake\\\",\\\"id\\\":\\\"reset\\\",\\\"on\\\":\\\"win\\\",\\\"to\\\":{\\\"lit\\\":\\\"10\\\"}}],\\\"counters\\\":[{\\\"cap\\\":\\\"320\\\",\\\"id\\\":\\\"stake\\\",\\\"initial\\\":\\\"10\\\"}],\\\"format\\\":1,\\\"game\\\":\\\"roulette\\\",\\\"id\\\":\\\"test-doubling\\\",\\\"instructions\\\":[{\\\"bets\\\":[{\\\"amount\\\":{\\\"counter\\\":\\\"stake\\\"},\\\"target\\\":{\\\"target\\\":\\\"red\\\"}}],\\\"id\\\":\\\"bet\\\",\\\"label\\\":\\\"The stake on red\\\",\\\"when\\\":{\\\"always\\\":true}}],\\\"name\\\":\\\"Doubling on red\\\",\\\"parameters\\\":[],\\\"revision\\\":3,\\\"stopWhen\\\":null,\\\"table\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheels\\\":[\\\"single-zero\\\",\\\"double-zero\\\"]}},\\\"departures\\\":[{\\\"actual\\\":[{\\\"amount\\\":\\\"50\\\",\\\"target\\\":\\\"red\\\"}],\\\"explanation\\\":{\\\"fallback\\\":null,\\\"instructions\\\":[{\\\"id\\\":\\\"bet\\\",\\\"label\\\":\\\"The stake on red\\\"}],\\\"prescription\\\":{\\\"bets\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"red\\\"}],\\\"held\\\":[],\\\"status\\\":\\\"prescribed\\\"},\\\"situation\\\":{\\\"available\\\":\\\"1000\\\",\\\"subjects\\\":{\\\"last-pocket-color\\\":\\\"none\\\",\\\"last-result\\\":\\\"none\\\"},\\\"values\\\":{}},\\\"state\\\":{\\\"counters\\\":{\\\"stake\\\":\\\"10\\\"},\\\"cycleTurn\\\":0,\\\"lastResult\\\":\\\"none\\\",\\\"lists\\\":{}}},\\\"id\\\":\\\"activity-1/departure/1\\\",\\\"resolution\\\":\\\"overridden\\\",\\\"turn\\\":1}],\\\"parameters\\\":{},\\\"progress\\\":{\\\"counters\\\":{\\\"stake\\\":\\\"10\\\"},\\\"cycleTurn\\\":0,\\\"lastResult\\\":\\\"none\\\",\\\"lists\\\":{}},\\\"status\\\":\\\"cycle-ended\\\"},\\\"turn\\\":1,\\\"wagers\\\":[]}\",\"completion\":null,\"createdAt\":1790000000000,\"incomplete\":null,\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"sequence\":4,\"specification\":{\"activityId\":\"activity-1\",\"device\":\"recorded-installation\",\"funding\":\"1000\",\"fundingSource\":\"practice-funding\",\"game\":\"roulette\",\"owner\":\"recorded-account\",\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"version\":1,\"wheel\":\"single-zero\"},\"strategy\":{\"definition\":{\"adjustments\":[{\"counter\":\"stake\",\"id\":\"double\",\"on\":\"loss\",\"to\":{\"mul\":[{\"counter\":\"stake\"},{\"lit\":\"2\"}]}},{\"counter\":\"stake\",\"id\":\"reset\",\"on\":\"win\",\"to\":{\"lit\":\"10\"}}],\"counters\":[{\"cap\":\"320\",\"id\":\"stake\",\"initial\":\"10\"}],\"format\":1,\"game\":\"roulette\",\"id\":\"test-doubling\",\"instructions\":[{\"bets\":[{\"amount\":{\"counter\":\"stake\"},\"target\":{\"target\":\"red\"}}],\"id\":\"bet\",\"label\":\"The stake on red\",\"when\":{\"always\":true}}],\"name\":\"Doubling on red\",\"parameters\":[],\"revision\":3,\"stopWhen\":null,\"table\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheels\":[\"single-zero\",\"double-zero\"]}},\"parameters\":{}}}}",
            "body_format": 1,
            "body_length": 4569,
            "body_sha256": "6a114ce221c07b10f9d7d79c7afe178543ca02efe8c40521f0e40e44243d6a58"
          }
        ],
        "transitions": [
          {
            "activity_id": "activity-1",
            "command_id": "record-0",
            "sequence": 0,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"activity-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"950\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":{\\\"id\\\":\\\"test-doubling\\\",\\\"version\\\":3}},\\\"outcome\\\":null,\\\"phase\\\":\\\"open-decision\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":0,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"50\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":1,\\\"strategy\\\":{\\\"coachedTurn\\\":false,\\\"correction\\\":null,\\\"cycle\\\":{\\\"number\\\":1,\\\"turns\\\":[]},\\\"cycleEnd\\\":null,\\\"decisions\\\":{\\\"betting\\\":0,\\\"playing\\\":0},\\\"deferred\\\":null,\\\"definition\\\":{\\\"adjustments\\\":[{\\\"counter\\\":\\\"stake\\\",\\\"id\\\":\\\"double\\\",\\\"on\\\":\\\"loss\\\",\\\"to\\\":{\\\"mul\\\":[{\\\"counter\\\":\\\"stake\\\"},{\\\"lit\\\":\\\"2\\\"}]}},{\\\"counter\\\":\\\"stake\\\",\\\"id\\\":\\\"reset\\\",\\\"on\\\":\\\"win\\\",\\\"to\\\":{\\\"lit\\\":\\\"10\\\"}}],\\\"counters\\\":[{\\\"cap\\\":\\\"320\\\",\\\"id\\\":\\\"stake\\\",\\\"initial\\\":\\\"10\\\"}],\\\"format\\\":1,\\\"game\\\":\\\"roulette\\\",\\\"id\\\":\\\"test-doubling\\\",\\\"instructions\\\":[{\\\"bets\\\":[{\\\"amount\\\":{\\\"counter\\\":\\\"stake\\\"},\\\"target\\\":{\\\"target\\\":\\\"red\\\"}}],\\\"id\\\":\\\"bet\\\",\\\"label\\\":\\\"The stake on red\\\",\\\"when\\\":{\\\"always\\\":true}}],\\\"name\\\":\\\"Doubling on red\\\",\\\"parameters\\\":[],\\\"revision\\\":3,\\\"stopWhen\\\":null,\\\"table\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheels\\\":[\\\"single-zero\\\",\\\"double-zero\\\"]}},\\\"departures\\\":[],\\\"parameters\\\":{},\\\"progress\\\":{\\\"counters\\\":{\\\"stake\\\":\\\"10\\\"},\\\"cycleTurn\\\":0,\\\"lastResult\\\":\\\"none\\\",\\\"lists\\\":{}},\\\"status\\\":\\\"active\\\"},\\\"turn\\\":0,\\\"wagers\\\":[{\\\"amount\\\":\\\"50\\\",\\\"target\\\":\\\"red\\\"}]}\",\"facts\":[{\"amount\":\"50\",\"kind\":\"wager-changed\",\"previous\":\"0\",\"target\":\"red\"}],\"receipt\":{\"command\":\"{\\\"amount\\\":\\\"50\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"red\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0}}",
            "body_format": 1,
            "body_length": 2482,
            "body_sha256": "126e2e2c9e2a8173044555ca9ea315522e1f6bc1b00198eaef4fe6f8f198dce4"
          },
          {
            "activity_id": "activity-1",
            "command_id": "record-1",
            "sequence": 1,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"activity-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"950\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":{\\\"id\\\":\\\"test-doubling\\\",\\\"version\\\":3}},\\\"outcome\\\":null,\\\"phase\\\":\\\"correction\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":0,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"50\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"assessed\\\",\\\"sequence\\\":1}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":2,\\\"strategy\\\":{\\\"coachedTurn\\\":false,\\\"correction\\\":{\\\"actual\\\":[{\\\"amount\\\":\\\"50\\\",\\\"target\\\":\\\"red\\\"}],\\\"explanation\\\":{\\\"fallback\\\":null,\\\"instructions\\\":[{\\\"id\\\":\\\"bet\\\",\\\"label\\\":\\\"The stake on red\\\"}],\\\"prescription\\\":{\\\"bets\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"red\\\"}],\\\"held\\\":[],\\\"status\\\":\\\"prescribed\\\"},\\\"situation\\\":{\\\"available\\\":\\\"1000\\\",\\\"subjects\\\":{\\\"last-pocket-color\\\":\\\"none\\\",\\\"last-result\\\":\\\"none\\\"},\\\"values\\\":{}},\\\"state\\\":{\\\"counters\\\":{\\\"stake\\\":\\\"10\\\"},\\\"cycleTurn\\\":0,\\\"lastResult\\\":\\\"none\\\",\\\"lists\\\":{}}},\\\"id\\\":\\\"activity-1/departure/1\\\",\\\"turn\\\":1},\\\"cycle\\\":{\\\"number\\\":1,\\\"turns\\\":[]},\\\"cycleEnd\\\":null,\\\"decisions\\\":{\\\"betting\\\":0,\\\"playing\\\":0},\\\"deferred\\\":null,\\\"definition\\\":{\\\"adjustments\\\":[{\\\"counter\\\":\\\"stake\\\",\\\"id\\\":\\\"double\\\",\\\"on\\\":\\\"loss\\\",\\\"to\\\":{\\\"mul\\\":[{\\\"counter\\\":\\\"stake\\\"},{\\\"lit\\\":\\\"2\\\"}]}},{\\\"counter\\\":\\\"stake\\\",\\\"id\\\":\\\"reset\\\",\\\"on\\\":\\\"win\\\",\\\"to\\\":{\\\"lit\\\":\\\"10\\\"}}],\\\"counters\\\":[{\\\"cap\\\":\\\"320\\\",\\\"id\\\":\\\"stake\\\",\\\"initial\\\":\\\"10\\\"}],\\\"format\\\":1,\\\"game\\\":\\\"roulette\\\",\\\"id\\\":\\\"test-doubling\\\",\\\"instructions\\\":[{\\\"bets\\\":[{\\\"amount\\\":{\\\"counter\\\":\\\"stake\\\"},\\\"target\\\":{\\\"target\\\":\\\"red\\\"}}],\\\"id\\\":\\\"bet\\\",\\\"label\\\":\\\"The stake on red\\\",\\\"when\\\":{\\\"always\\\":true}}],\\\"name\\\":\\\"Doubling on red\\\",\\\"parameters\\\":[],\\\"revision\\\":3,\\\"stopWhen\\\":null,\\\"table\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheels\\\":[\\\"single-zero\\\",\\\"double-zero\\\"]}},\\\"departures\\\":[],\\\"parameters\\\":{},\\\"progress\\\":{\\\"counters\\\":{\\\"stake\\\":\\\"10\\\"},\\\"cycleTurn\\\":0,\\\"lastResult\\\":\\\"none\\\",\\\"lists\\\":{}},\\\"status\\\":\\\"active\\\"},\\\"turn\\\":0,\\\"wagers\\\":[{\\\"amount\\\":\\\"50\\\",\\\"target\\\":\\\"red\\\"}]}\",\"facts\":[{\"actual\":[{\"amount\":\"50\",\"target\":\"red\"}],\"departureId\":\"activity-1/departure/1\",\"explanation\":{\"fallback\":null,\"instructions\":[{\"id\":\"bet\",\"label\":\"The stake on red\"}],\"prescription\":{\"bets\":[{\"amount\":\"10\",\"target\":\"red\"}],\"held\":[],\"status\":\"prescribed\"},\"situation\":{\"available\":\"1000\",\"subjects\":{\"last-pocket-color\":\"none\",\"last-result\":\"none\"},\"values\":{}},\"state\":{\"counters\":{\"stake\":\"10\"},\"cycleTurn\":0,\"lastResult\":\"none\",\"lists\":{}}},\"kind\":\"correction-offered\",\"turn\":1}],\"receipt\":{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"assessed\",\"sequence\":1}}",
            "body_format": 1,
            "body_length": 3506,
            "body_sha256": "19fd5c1efa269eec1190947de54017598e3f4f702d1489308ed8ec6f3d06c302"
          },
          {
            "activity_id": "activity-1",
            "command_id": "record-2",
            "sequence": 2,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"activity-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"950\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":{\\\"id\\\":\\\"test-doubling\\\",\\\"version\\\":3}},\\\"outcome\\\":{\\\"pocket\\\":27,\\\"turn\\\":1},\\\"phase\\\":\\\"revealing-outcome\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":1,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"50\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"assessed\\\",\\\"sequence\\\":1},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"override-correction\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-2\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":2}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":3,\\\"strategy\\\":{\\\"coachedTurn\\\":false,\\\"correction\\\":null,\\\"cycle\\\":{\\\"number\\\":1,\\\"turns\\\":[]},\\\"cycleEnd\\\":\\\"override\\\",\\\"decisions\\\":{\\\"betting\\\":1,\\\"playing\\\":0},\\\"deferred\\\":null,\\\"definition\\\":{\\\"adjustments\\\":[{\\\"counter\\\":\\\"stake\\\",\\\"id\\\":\\\"double\\\",\\\"on\\\":\\\"loss\\\",\\\"to\\\":{\\\"mul\\\":[{\\\"counter\\\":\\\"stake\\\"},{\\\"lit\\\":\\\"2\\\"}]}},{\\\"counter\\\":\\\"stake\\\",\\\"id\\\":\\\"reset\\\",\\\"on\\\":\\\"win\\\",\\\"to\\\":{\\\"lit\\\":\\\"10\\\"}}],\\\"counters\\\":[{\\\"cap\\\":\\\"320\\\",\\\"id\\\":\\\"stake\\\",\\\"initial\\\":\\\"10\\\"}],\\\"format\\\":1,\\\"game\\\":\\\"roulette\\\",\\\"id\\\":\\\"test-doubling\\\",\\\"instructions\\\":[{\\\"bets\\\":[{\\\"amount\\\":{\\\"counter\\\":\\\"stake\\\"},\\\"target\\\":{\\\"target\\\":\\\"red\\\"}}],\\\"id\\\":\\\"bet\\\",\\\"label\\\":\\\"The stake on red\\\",\\\"when\\\":{\\\"always\\\":true}}],\\\"name\\\":\\\"Doubling on red\\\",\\\"parameters\\\":[],\\\"revision\\\":3,\\\"stopWhen\\\":null,\\\"table\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheels\\\":[\\\"single-zero\\\",\\\"double-zero\\\"]}},\\\"departures\\\":[{\\\"actual\\\":[{\\\"amount\\\":\\\"50\\\",\\\"target\\\":\\\"red\\\"}],\\\"explanation\\\":{\\\"fallback\\\":null,\\\"instructions\\\":[{\\\"id\\\":\\\"bet\\\",\\\"label\\\":\\\"The stake on red\\\"}],\\\"prescription\\\":{\\\"bets\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"red\\\"}],\\\"held\\\":[],\\\"status\\\":\\\"prescribed\\\"},\\\"situation\\\":{\\\"available\\\":\\\"1000\\\",\\\"subjects\\\":{\\\"last-pocket-color\\\":\\\"none\\\",\\\"last-result\\\":\\\"none\\\"},\\\"values\\\":{}},\\\"state\\\":{\\\"counters\\\":{\\\"stake\\\":\\\"10\\\"},\\\"cycleTurn\\\":0,\\\"lastResult\\\":\\\"none\\\",\\\"lists\\\":{}}},\\\"id\\\":\\\"activity-1/departure/1\\\",\\\"resolution\\\":\\\"overridden\\\",\\\"turn\\\":1}],\\\"parameters\\\":{},\\\"progress\\\":{\\\"counters\\\":{\\\"stake\\\":\\\"10\\\"},\\\"cycleTurn\\\":0,\\\"lastResult\\\":\\\"none\\\",\\\"lists\\\":{}},\\\"status\\\":\\\"cycle-ended\\\"},\\\"turn\\\":1,\\\"wagers\\\":[{\\\"amount\\\":\\\"50\\\",\\\"target\\\":\\\"red\\\"}]}\",\"facts\":[{\"departure\":{\"actual\":[{\"amount\":\"50\",\"target\":\"red\"}],\"explanation\":{\"fallback\":null,\"instructions\":[{\"id\":\"bet\",\"label\":\"The stake on red\"}],\"prescription\":{\"bets\":[{\"amount\":\"10\",\"target\":\"red\"}],\"held\":[],\"status\":\"prescribed\"},\"situation\":{\"available\":\"1000\",\"subjects\":{\"last-pocket-color\":\"none\",\"last-result\":\"none\"},\"values\":{}},\"state\":{\"counters\":{\"stake\":\"10\"},\"cycleTurn\":0,\"lastResult\":\"none\",\"lists\":{}}},\"id\":\"activity-1/departure/1\",\"resolution\":\"overridden\",\"turn\":1},\"kind\":\"departure-recorded\"},{\"kind\":\"cycle-ended\",\"reason\":\"override\"},{\"kind\":\"turn-began\",\"turn\":1,\"wagers\":[{\"amount\":\"50\",\"target\":\"red\"}]},{\"kind\":\"outcome-generated\",\"pocket\":27,\"turn\":1}],\"receipt\":{\"command\":\"{\\\"kind\\\":\\\"override-correction\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2}}",
            "body_format": 1,
            "body_length": 3918,
            "body_sha256": "45181fa0074977c180170294439e1d02647fc94cf582d896f9e461c11081f82f"
          },
          {
            "activity_id": "activity-1",
            "command_id": "record-3",
            "sequence": 3,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"activity-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"1050\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"50\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":{\\\"id\\\":\\\"test-doubling\\\",\\\"version\\\":3}},\\\"outcome\\\":{\\\"pocket\\\":27,\\\"turn\\\":1},\\\"phase\\\":\\\"cycle-completion\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":1,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"50\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"assessed\\\",\\\"sequence\\\":1},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"override-correction\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-2\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":2},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"settle-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-3\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":3}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":4,\\\"strategy\\\":{\\\"coachedTurn\\\":false,\\\"correction\\\":null,\\\"cycle\\\":{\\\"number\\\":1,\\\"turns\\\":[{\\\"followed\\\":false,\\\"net\\\":\\\"50\\\",\\\"outcome\\\":\\\"27\\\",\\\"turn\\\":1,\\\"wagers\\\":[{\\\"amount\\\":\\\"50\\\",\\\"target\\\":\\\"red\\\"}]}]},\\\"cycleEnd\\\":\\\"override\\\",\\\"decisions\\\":{\\\"betting\\\":1,\\\"playing\\\":0},\\\"deferred\\\":null,\\\"definition\\\":{\\\"adjustments\\\":[{\\\"counter\\\":\\\"stake\\\",\\\"id\\\":\\\"double\\\",\\\"on\\\":\\\"loss\\\",\\\"to\\\":{\\\"mul\\\":[{\\\"counter\\\":\\\"stake\\\"},{\\\"lit\\\":\\\"2\\\"}]}},{\\\"counter\\\":\\\"stake\\\",\\\"id\\\":\\\"reset\\\",\\\"on\\\":\\\"win\\\",\\\"to\\\":{\\\"lit\\\":\\\"10\\\"}}],\\\"counters\\\":[{\\\"cap\\\":\\\"320\\\",\\\"id\\\":\\\"stake\\\",\\\"initial\\\":\\\"10\\\"}],\\\"format\\\":1,\\\"game\\\":\\\"roulette\\\",\\\"id\\\":\\\"test-doubling\\\",\\\"instructions\\\":[{\\\"bets\\\":[{\\\"amount\\\":{\\\"counter\\\":\\\"stake\\\"},\\\"target\\\":{\\\"target\\\":\\\"red\\\"}}],\\\"id\\\":\\\"bet\\\",\\\"label\\\":\\\"The stake on red\\\",\\\"when\\\":{\\\"always\\\":true}}],\\\"name\\\":\\\"Doubling on red\\\",\\\"parameters\\\":[],\\\"revision\\\":3,\\\"stopWhen\\\":null,\\\"table\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheels\\\":[\\\"single-zero\\\",\\\"double-zero\\\"]}},\\\"departures\\\":[{\\\"actual\\\":[{\\\"amount\\\":\\\"50\\\",\\\"target\\\":\\\"red\\\"}],\\\"explanation\\\":{\\\"fallback\\\":null,\\\"instructions\\\":[{\\\"id\\\":\\\"bet\\\",\\\"label\\\":\\\"The stake on red\\\"}],\\\"prescription\\\":{\\\"bets\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"red\\\"}],\\\"held\\\":[],\\\"status\\\":\\\"prescribed\\\"},\\\"situation\\\":{\\\"available\\\":\\\"1000\\\",\\\"subjects\\\":{\\\"last-pocket-color\\\":\\\"none\\\",\\\"last-result\\\":\\\"none\\\"},\\\"values\\\":{}},\\\"state\\\":{\\\"counters\\\":{\\\"stake\\\":\\\"10\\\"},\\\"cycleTurn\\\":0,\\\"lastResult\\\":\\\"none\\\",\\\"lists\\\":{}}},\\\"id\\\":\\\"activity-1/departure/1\\\",\\\"resolution\\\":\\\"overridden\\\",\\\"turn\\\":1}],\\\"parameters\\\":{},\\\"progress\\\":{\\\"counters\\\":{\\\"stake\\\":\\\"10\\\"},\\\"cycleTurn\\\":0,\\\"lastResult\\\":\\\"none\\\",\\\"lists\\\":{}},\\\"status\\\":\\\"cycle-ended\\\"},\\\"turn\\\":1,\\\"wagers\\\":[]}\",\"facts\":[{\"kind\":\"wager-settled\",\"net\":\"50\",\"result\":\"win\",\"returned\":\"100\",\"stake\":\"50\",\"target\":\"red\",\"turn\":1}],\"receipt\":{\"command\":\"{\\\"kind\\\":\\\"settle-turn\\\"}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3}}",
            "body_format": 1,
            "body_length": 3536,
            "body_sha256": "6fdaa8c1f86a71fc4e12cd7842f8adea22af6f955feb86e37131473747f5e744"
          }
        ],
        "effects": [],
        "outgoing": [],
        "accepted_records": [],
        "device_positions": [],
        "purged_records": [],
        "feed_cursor": [
          {
            "singleton": 1,
            "sequence": 0,
            "synced_at": null
          }
        ],
        "bootstrap": [
          {
            "singleton": 1,
            "installed": 0,
            "body": null,
            "body_format": null,
            "body_length": null,
            "body_sha256": null,
            "staged": 0,
            "after_ordinal": 0
          }
        ],
        "bootstrap_rows": [],
        "history": [
          {
            "singleton": 1,
            "recent": null,
            "download_requested": 0,
            "download_total": null
          }
        ]
      }
    },
    {
      "name": "craps, a point established",
      "environment": "production",
      "accountId": "recorded-account",
      "installationId": "recorded-installation",
      "unfinished": {
        "activityId": "craps-1",
        "game": "craps",
        "phase": "settled-outcome",
        "finalCashOut": "1010"
      },
      "schema": [
        "CREATE TABLE meta (name TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT",
        "CREATE TABLE activities (\n    activity_id TEXT PRIMARY KEY,\n    position INTEGER NOT NULL UNIQUE,\n    status TEXT NOT NULL CHECK (status IN ('unfinished', 'completed', 'incomplete')),\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL\n  ) STRICT",
        "CREATE INDEX activities_unfinished ON activities (status, position)",
        "CREATE TABLE transitions (\n    activity_id TEXT NOT NULL REFERENCES activities (activity_id),\n    command_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    PRIMARY KEY (activity_id, command_id),\n    UNIQUE (activity_id, sequence)\n  ) STRICT",
        "CREATE TABLE effects (\n    activity_id TEXT NOT NULL REFERENCES activities (activity_id),\n    effect_key TEXT NOT NULL,\n    position INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    PRIMARY KEY (activity_id, effect_key)\n  ) STRICT",
        "CREATE TABLE outgoing (\n    id TEXT PRIMARY KEY,\n    activity_id TEXT UNIQUE REFERENCES activities (activity_id),\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    revisioned INTEGER NOT NULL CHECK (revisioned IN (0, 1)),\n    position INTEGER NOT NULL UNIQUE,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    dependencies TEXT NOT NULL,\n    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),\n    operation_id TEXT UNIQUE,\n    request TEXT,\n    request_sha256 TEXT,\n    receipt TEXT,\n    receipt_sequence INTEGER,\n    failures INTEGER NOT NULL DEFAULT 0 CHECK (failures >= 0),\n    flagged INTEGER NOT NULL DEFAULT 0 CHECK (flagged IN (0, 1)),\n    device_position INTEGER\n  ) STRICT",
        "CREATE INDEX outgoing_pending ON outgoing (status, position)",
        "CREATE INDEX outgoing_items ON outgoing (record_type, item_id, position)",
        "CREATE TABLE accepted_records (\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    installation_id TEXT,\n    device_position INTEGER,\n    summary_at INTEGER,\n    PRIMARY KEY (record_type, item_id)\n  ) STRICT",
        "CREATE INDEX accepted_summaries ON accepted_records (summary_at) WHERE summary_at IS NOT NULL",
        "CREATE TABLE device_positions (record_type TEXT PRIMARY KEY, last INTEGER NOT NULL) STRICT",
        "CREATE TABLE purged_records (record_type TEXT NOT NULL, item_id TEXT NOT NULL, PRIMARY KEY (record_type, item_id)) STRICT",
        "CREATE TABLE feed_cursor (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), sequence INTEGER NOT NULL, synced_at INTEGER) STRICT",
        "CREATE TABLE bootstrap (\n    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),\n    installed INTEGER NOT NULL CHECK (installed IN (0, 1)),\n    body TEXT, body_format INTEGER, body_length INTEGER, body_sha256 TEXT,\n    staged INTEGER NOT NULL DEFAULT 0 CHECK (staged >= 0),\n    after_ordinal INTEGER NOT NULL DEFAULT 0 CHECK (after_ordinal >= 0)\n  ) STRICT",
        "CREATE TABLE bootstrap_rows (\n    position INTEGER PRIMARY KEY,\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    installation_id TEXT,\n    device_position INTEGER,\n    summary_at INTEGER\n  ) STRICT",
        "CREATE TABLE history (\n    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),\n    recent INTEGER CHECK (recent >= 0),\n    download_requested INTEGER NOT NULL CHECK (download_requested IN (0, 1)),\n    download_total INTEGER CHECK (download_total >= 0)\n  ) STRICT"
      ],
      "rows": {
        "meta": [
          {
            "name": "environment",
            "value": "production"
          },
          {
            "name": "account_id",
            "value": "recorded-account"
          },
          {
            "name": "installation_id",
            "value": "recorded-installation"
          },
          {
            "name": "schema_version",
            "value": "1"
          }
        ],
        "activities": [
          {
            "activity_id": "craps-1",
            "position": 1,
            "status": "unfinished",
            "sequence": 4,
            "body": "{\"activityId\":\"craps-1\",\"admission\":{\"meteringBasis\":\"free-play\",\"provenance\":\"recorded\"},\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"craps-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"990\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"craps\\\",\\\"random\\\":{\\\"key\\\":[1,0],\\\"protocol\\\":1,\\\"session\\\":[0,0]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"standard-craps\\\",\\\"version\\\":2},\\\"strategy\\\":null},\\\"instructions\\\":[],\\\"outcome\\\":{\\\"dice\\\":[5,1],\\\"turn\\\":1},\\\"phase\\\":\\\"settled-outcome\\\",\\\"point\\\":6,\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[1,0],\\\"lane\\\":2,\\\"protocol\\\":1,\\\"session\\\":[0,0]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"pass\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"5\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"field\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"assessed\\\",\\\"sequence\\\":1},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-2\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":2},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"settle-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-3\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":3}],\\\"rules\\\":{\\\"field\\\":\\\"triple-12\\\",\\\"limits\\\":{\\\"flat\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"},\\\"props\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"}},\\\"odds\\\":\\\"3-4-5x\\\"},\\\"schema\\\":7,\\\"sequence\\\":4,\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"pass\\\"}]}\",\"completion\":null,\"createdAt\":1790000000000,\"incomplete\":null,\"random\":{\"key\":[1,0],\"protocol\":1,\"session\":[0,0]},\"sequence\":4,\"specification\":{\"activityId\":\"craps-1\",\"device\":\"recorded-installation\",\"funding\":\"1000\",\"fundingSource\":\"practice-funding\",\"game\":\"craps\",\"owner\":\"recorded-account\",\"reference\":null,\"rules\":{\"field\":\"triple-12\",\"id\":\"standard-craps\",\"limits\":{\"flat\":{\"max\":\"1000\",\"min\":\"10\"},\"props\":{\"max\":\"100\",\"min\":\"1\"}},\"odds\":\"3-4-5x\",\"version\":2},\"strategy\":null}}",
            "body_format": 1,
            "body_length": 2123,
            "body_sha256": "656945f832c1b02d39c8c07ff300f9bf42027b03419dbdc6f176c12e91702a5b"
          }
        ],
        "transitions": [
          {
            "activity_id": "craps-1",
            "command_id": "record-0",
            "sequence": 0,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"craps-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"990\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"craps\\\",\\\"random\\\":{\\\"key\\\":[1,0],\\\"protocol\\\":1,\\\"session\\\":[0,0]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"standard-craps\\\",\\\"version\\\":2},\\\"strategy\\\":null},\\\"instructions\\\":[],\\\"outcome\\\":null,\\\"phase\\\":\\\"open-decision\\\",\\\"point\\\":null,\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[1,0],\\\"lane\\\":0,\\\"protocol\\\":1,\\\"session\\\":[0,0]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"pass\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0}],\\\"rules\\\":{\\\"field\\\":\\\"triple-12\\\",\\\"limits\\\":{\\\"flat\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"},\\\"props\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"}},\\\"odds\\\":\\\"3-4-5x\\\"},\\\"schema\\\":7,\\\"sequence\\\":1,\\\"strategy\\\":null,\\\"turn\\\":0,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"pass\\\"}]}\",\"facts\":[{\"amount\":\"10\",\"kind\":\"wager-changed\",\"previous\":\"0\",\"target\":\"pass\"}],\"receipt\":{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"pass\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0}}",
            "body_format": 1,
            "body_length": 1334,
            "body_sha256": "f420c6794b9f1edeb29faaccdbefdca34ed460fdd06ac012b194b67bfbe73c11"
          },
          {
            "activity_id": "craps-1",
            "command_id": "record-1",
            "sequence": 1,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"craps-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"990\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"craps\\\",\\\"random\\\":{\\\"key\\\":[1,0],\\\"protocol\\\":1,\\\"session\\\":[0,0]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"standard-craps\\\",\\\"version\\\":2},\\\"strategy\\\":null},\\\"instructions\\\":[],\\\"outcome\\\":null,\\\"phase\\\":\\\"open-decision\\\",\\\"point\\\":null,\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[1,0],\\\"lane\\\":0,\\\"protocol\\\":1,\\\"session\\\":[0,0]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"pass\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"5\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"field\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"assessed\\\",\\\"sequence\\\":1}],\\\"rules\\\":{\\\"field\\\":\\\"triple-12\\\",\\\"limits\\\":{\\\"flat\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"},\\\"props\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"}},\\\"odds\\\":\\\"3-4-5x\\\"},\\\"schema\\\":7,\\\"sequence\\\":2,\\\"strategy\\\":null,\\\"turn\\\":0,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"pass\\\"}]}\",\"facts\":[{\"command\":{\"amount\":\"5\",\"kind\":\"place-wager\",\"target\":\"field\"},\"kind\":\"illegal-action\",\"reason\":\"below-minimum\"}],\"receipt\":{\"command\":\"{\\\"amount\\\":\\\"5\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"field\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"assessed\",\"sequence\":1}}",
            "body_format": 1,
            "body_length": 1557,
            "body_sha256": "7540012878791cc7a670b6648f98a6f683931fcb8b2a87c37dadc58cf15864fa"
          },
          {
            "activity_id": "craps-1",
            "command_id": "record-2",
            "sequence": 2,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"craps-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"990\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"craps\\\",\\\"random\\\":{\\\"key\\\":[1,0],\\\"protocol\\\":1,\\\"session\\\":[0,0]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"standard-craps\\\",\\\"version\\\":2},\\\"strategy\\\":null},\\\"instructions\\\":[],\\\"outcome\\\":{\\\"dice\\\":[5,1],\\\"turn\\\":1},\\\"phase\\\":\\\"revealing-outcome\\\",\\\"point\\\":null,\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[1,0],\\\"lane\\\":2,\\\"protocol\\\":1,\\\"session\\\":[0,0]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"pass\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"5\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"field\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"assessed\\\",\\\"sequence\\\":1},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-2\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":2}],\\\"rules\\\":{\\\"field\\\":\\\"triple-12\\\",\\\"limits\\\":{\\\"flat\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"},\\\"props\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"}},\\\"odds\\\":\\\"3-4-5x\\\"},\\\"schema\\\":7,\\\"sequence\\\":3,\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"pass\\\"}]}\",\"facts\":[{\"kind\":\"turn-began\",\"turn\":1,\"wagers\":[{\"amount\":\"10\",\"target\":\"pass\"}]},{\"dice\":[5,1],\"kind\":\"dice-rolled\",\"turn\":1}],\"receipt\":{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2}}",
            "body_format": 1,
            "body_length": 1671,
            "body_sha256": "1e057baf5693471eb734dd2aafe04c063bce49d07ec0d59827b4adc9283be4d4"
          },
          {
            "activity_id": "craps-1",
            "command_id": "record-3",
            "sequence": 3,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"craps-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"990\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"craps\\\",\\\"random\\\":{\\\"key\\\":[1,0],\\\"protocol\\\":1,\\\"session\\\":[0,0]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"standard-craps\\\",\\\"version\\\":2},\\\"strategy\\\":null},\\\"instructions\\\":[],\\\"outcome\\\":{\\\"dice\\\":[5,1],\\\"turn\\\":1},\\\"phase\\\":\\\"settled-outcome\\\",\\\"point\\\":6,\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[1,0],\\\"lane\\\":2,\\\"protocol\\\":1,\\\"session\\\":[0,0]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"pass\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"5\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"field\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"assessed\\\",\\\"sequence\\\":1},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-2\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":2},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"settle-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-3\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":3}],\\\"rules\\\":{\\\"field\\\":\\\"triple-12\\\",\\\"limits\\\":{\\\"flat\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"},\\\"props\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"}},\\\"odds\\\":\\\"3-4-5x\\\"},\\\"schema\\\":7,\\\"sequence\\\":4,\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"pass\\\"}]}\",\"facts\":[{\"kind\":\"point-changed\",\"point\":6,\"turn\":1}],\"receipt\":{\"command\":\"{\\\"kind\\\":\\\"settle-turn\\\"}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3}}",
            "body_format": 1,
            "body_length": 1715,
            "body_sha256": "8af6391c2d947b1b18d69cdce869f753097b511d93ac2aeec6d822b321908216"
          }
        ],
        "effects": [],
        "outgoing": [],
        "accepted_records": [],
        "device_positions": [],
        "purged_records": [],
        "feed_cursor": [
          {
            "singleton": 1,
            "sequence": 0,
            "synced_at": null
          }
        ],
        "bootstrap": [
          {
            "singleton": 1,
            "installed": 0,
            "body": null,
            "body_format": null,
            "body_length": null,
            "body_sha256": null,
            "staged": 0,
            "after_ordinal": 0
          }
        ],
        "bootstrap_rows": [],
        "history": [
          {
            "singleton": 1,
            "recent": null,
            "download_requested": 0,
            "download_total": null
          }
        ]
      }
    },
    {
      "name": "craps guided, Stop strategy with the pass line contract settling",
      "environment": "production",
      "accountId": "recorded-account",
      "installationId": "recorded-installation",
      "unfinished": {
        "activityId": "craps-1",
        "game": "craps",
        "phase": "strategy-settlement",
        "finalCashOut": "1010"
      },
      "schema": [
        "CREATE TABLE meta (name TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT",
        "CREATE TABLE activities (\n    activity_id TEXT PRIMARY KEY,\n    position INTEGER NOT NULL UNIQUE,\n    status TEXT NOT NULL CHECK (status IN ('unfinished', 'completed', 'incomplete')),\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL\n  ) STRICT",
        "CREATE INDEX activities_unfinished ON activities (status, position)",
        "CREATE TABLE transitions (\n    activity_id TEXT NOT NULL REFERENCES activities (activity_id),\n    command_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    PRIMARY KEY (activity_id, command_id),\n    UNIQUE (activity_id, sequence)\n  ) STRICT",
        "CREATE TABLE effects (\n    activity_id TEXT NOT NULL REFERENCES activities (activity_id),\n    effect_key TEXT NOT NULL,\n    position INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    PRIMARY KEY (activity_id, effect_key)\n  ) STRICT",
        "CREATE TABLE outgoing (\n    id TEXT PRIMARY KEY,\n    activity_id TEXT UNIQUE REFERENCES activities (activity_id),\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    revisioned INTEGER NOT NULL CHECK (revisioned IN (0, 1)),\n    position INTEGER NOT NULL UNIQUE,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    dependencies TEXT NOT NULL,\n    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),\n    operation_id TEXT UNIQUE,\n    request TEXT,\n    request_sha256 TEXT,\n    receipt TEXT,\n    receipt_sequence INTEGER,\n    failures INTEGER NOT NULL DEFAULT 0 CHECK (failures >= 0),\n    flagged INTEGER NOT NULL DEFAULT 0 CHECK (flagged IN (0, 1)),\n    device_position INTEGER\n  ) STRICT",
        "CREATE INDEX outgoing_pending ON outgoing (status, position)",
        "CREATE INDEX outgoing_items ON outgoing (record_type, item_id, position)",
        "CREATE TABLE accepted_records (\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    installation_id TEXT,\n    device_position INTEGER,\n    summary_at INTEGER,\n    PRIMARY KEY (record_type, item_id)\n  ) STRICT",
        "CREATE INDEX accepted_summaries ON accepted_records (summary_at) WHERE summary_at IS NOT NULL",
        "CREATE TABLE device_positions (record_type TEXT PRIMARY KEY, last INTEGER NOT NULL) STRICT",
        "CREATE TABLE purged_records (record_type TEXT NOT NULL, item_id TEXT NOT NULL, PRIMARY KEY (record_type, item_id)) STRICT",
        "CREATE TABLE feed_cursor (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), sequence INTEGER NOT NULL, synced_at INTEGER) STRICT",
        "CREATE TABLE bootstrap (\n    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),\n    installed INTEGER NOT NULL CHECK (installed IN (0, 1)),\n    body TEXT, body_format INTEGER, body_length INTEGER, body_sha256 TEXT,\n    staged INTEGER NOT NULL DEFAULT 0 CHECK (staged >= 0),\n    after_ordinal INTEGER NOT NULL DEFAULT 0 CHECK (after_ordinal >= 0)\n  ) STRICT",
        "CREATE TABLE bootstrap_rows (\n    position INTEGER PRIMARY KEY,\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    installation_id TEXT,\n    device_position INTEGER,\n    summary_at INTEGER\n  ) STRICT",
        "CREATE TABLE history (\n    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),\n    recent INTEGER CHECK (recent >= 0),\n    download_requested INTEGER NOT NULL CHECK (download_requested IN (0, 1)),\n    download_total INTEGER CHECK (download_total >= 0)\n  ) STRICT"
      ],
      "rows": {
        "meta": [
          {
            "name": "environment",
            "value": "production"
          },
          {
            "name": "account_id",
            "value": "recorded-account"
          },
          {
            "name": "installation_id",
            "value": "recorded-installation"
          },
          {
            "name": "schema_version",
            "value": "1"
          }
        ],
        "activities": [
          {
            "activity_id": "craps-1",
            "position": 1,
            "status": "unfinished",
            "sequence": 4,
            "body": "{\"activityId\":\"craps-1\",\"admission\":{\"meteringBasis\":\"free-play\",\"provenance\":\"recorded\"},\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"craps-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"990\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"craps\\\",\\\"random\\\":{\\\"key\\\":[1,0],\\\"protocol\\\":1,\\\"session\\\":[0,0]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"standard-craps\\\",\\\"version\\\":2},\\\"strategy\\\":{\\\"id\\\":\\\"test-pass-with-odds\\\",\\\"version\\\":1}},\\\"instructions\\\":[],\\\"outcome\\\":{\\\"dice\\\":[5,1],\\\"turn\\\":1},\\\"phase\\\":\\\"strategy-settlement\\\",\\\"point\\\":6,\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[1,0],\\\"lane\\\":2,\\\"protocol\\\":1,\\\"session\\\":[0,0]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"pass\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"settle-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-2\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":2},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"stop-strategy\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-3\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":3}],\\\"rules\\\":{\\\"field\\\":\\\"triple-12\\\",\\\"limits\\\":{\\\"flat\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"},\\\"props\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"}},\\\"odds\\\":\\\"3-4-5x\\\"},\\\"schema\\\":7,\\\"sequence\\\":4,\\\"strategy\\\":{\\\"coachedTurn\\\":false,\\\"correction\\\":null,\\\"cycle\\\":{\\\"number\\\":1,\\\"turns\\\":[{\\\"followed\\\":true,\\\"net\\\":\\\"0\\\",\\\"outcome\\\":\\\"5+1\\\",\\\"turn\\\":1,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"pass\\\"}]}]},\\\"cycleEnd\\\":null,\\\"decisions\\\":{\\\"betting\\\":1,\\\"playing\\\":0},\\\"deferred\\\":null,\\\"definition\\\":{\\\"adjustments\\\":[],\\\"counters\\\":[],\\\"format\\\":1,\\\"game\\\":\\\"craps\\\",\\\"id\\\":\\\"test-pass-with-odds\\\",\\\"instructions\\\":[{\\\"bets\\\":[{\\\"amount\\\":{\\\"lit\\\":\\\"10\\\"},\\\"target\\\":{\\\"target\\\":\\\"pass\\\"}}],\\\"id\\\":\\\"come-out\\\",\\\"label\\\":\\\"Pass 10 on the come-out\\\",\\\"when\\\":{\\\"is\\\":\\\"none\\\",\\\"subject\\\":\\\"point\\\"}},{\\\"bets\\\":[{\\\"amount\\\":{\\\"lit\\\":\\\"10\\\"},\\\"target\\\":{\\\"target\\\":\\\"pass\\\"}},{\\\"amount\\\":{\\\"lit\\\":\\\"10\\\"},\\\"target\\\":{\\\"target\\\":\\\"pass-odds\\\"}}],\\\"id\\\":\\\"odds\\\",\\\"label\\\":\\\"10 odds behind the pass line\\\",\\\"when\\\":{\\\"any\\\":[{\\\"all\\\":[{\\\"is\\\":\\\"4\\\",\\\"subject\\\":\\\"point\\\"},{\\\"is\\\":\\\"on\\\",\\\"subject\\\":\\\"pass\\\"}]},{\\\"all\\\":[{\\\"is\\\":\\\"5\\\",\\\"subject\\\":\\\"point\\\"},{\\\"is\\\":\\\"on\\\",\\\"subject\\\":\\\"pass\\\"}]},{\\\"all\\\":[{\\\"is\\\":\\\"6\\\",\\\"subject\\\":\\\"point\\\"},{\\\"is\\\":\\\"on\\\",\\\"subject\\\":\\\"pass\\\"}]},{\\\"all\\\":[{\\\"is\\\":\\\"8\\\",\\\"subject\\\":\\\"point\\\"},{\\\"is\\\":\\\"on\\\",\\\"subject\\\":\\\"pass\\\"}]},{\\\"all\\\":[{\\\"is\\\":\\\"9\\\",\\\"subject\\\":\\\"point\\\"},{\\\"is\\\":\\\"on\\\",\\\"subject\\\":\\\"pass\\\"}]},{\\\"all\\\":[{\\\"is\\\":\\\"10\\\",\\\"subject\\\":\\\"point\\\"},{\\\"is\\\":\\\"on\\\",\\\"subject\\\":\\\"pass\\\"}]}]}}],\\\"name\\\":\\\"Pass with odds\\\",\\\"parameters\\\":[],\\\"revision\\\":1,\\\"stopWhen\\\":null,\\\"table\\\":{\\\"limits\\\":{\\\"flat\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"},\\\"props\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"}},\\\"odds\\\":[\\\"1x\\\",\\\"2x\\\",\\\"3-4-5x\\\",\\\"5x\\\",\\\"10x\\\"]}},\\\"departures\\\":[],\\\"parameters\\\":{},\\\"progress\\\":{\\\"counters\\\":{},\\\"cycleTurn\\\":1,\\\"lastResult\\\":\\\"push\\\",\\\"lists\\\":{}},\\\"status\\\":\\\"stopped\\\"},\\\"turn\\\":1,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"pass\\\"}]}\",\"completion\":null,\"createdAt\":1790000000000,\"incomplete\":null,\"random\":{\"key\":[1,0],\"protocol\":1,\"session\":[0,0]},\"sequence\":4,\"specification\":{\"activityId\":\"craps-1\",\"device\":\"recorded-installation\",\"funding\":\"1000\",\"fundingSource\":\"practice-funding\",\"game\":\"craps\",\"owner\":\"recorded-account\",\"reference\":null,\"rules\":{\"field\":\"triple-12\",\"id\":\"standard-craps\",\"limits\":{\"flat\":{\"max\":\"1000\",\"min\":\"10\"},\"props\":{\"max\":\"100\",\"min\":\"1\"}},\"odds\":\"3-4-5x\",\"version\":2},\"strategy\":{\"definition\":{\"adjustments\":[],\"counters\":[],\"format\":1,\"game\":\"craps\",\"id\":\"test-pass-with-odds\",\"instructions\":[{\"bets\":[{\"amount\":{\"lit\":\"10\"},\"target\":{\"target\":\"pass\"}}],\"id\":\"come-out\",\"label\":\"Pass 10 on the come-out\",\"when\":{\"is\":\"none\",\"subject\":\"point\"}},{\"bets\":[{\"amount\":{\"lit\":\"10\"},\"target\":{\"target\":\"pass\"}},{\"amount\":{\"lit\":\"10\"},\"target\":{\"target\":\"pass-odds\"}}],\"id\":\"odds\",\"label\":\"10 odds behind the pass line\",\"when\":{\"any\":[{\"all\":[{\"is\":\"4\",\"subject\":\"point\"},{\"is\":\"on\",\"subject\":\"pass\"}]},{\"all\":[{\"is\":\"5\",\"subject\":\"point\"},{\"is\":\"on\",\"subject\":\"pass\"}]},{\"all\":[{\"is\":\"6\",\"subject\":\"point\"},{\"is\":\"on\",\"subject\":\"pass\"}]},{\"all\":[{\"is\":\"8\",\"subject\":\"point\"},{\"is\":\"on\",\"subject\":\"pass\"}]},{\"all\":[{\"is\":\"9\",\"subject\":\"point\"},{\"is\":\"on\",\"subject\":\"pass\"}]},{\"all\":[{\"is\":\"10\",\"subject\":\"point\"},{\"is\":\"on\",\"subject\":\"pass\"}]}]}}],\"name\":\"Pass with odds\",\"parameters\":[],\"revision\":1,\"stopWhen\":null,\"table\":{\"limits\":{\"flat\":{\"max\":\"1000\",\"min\":\"10\"},\"props\":{\"max\":\"100\",\"min\":\"1\"}},\"odds\":[\"1x\",\"2x\",\"3-4-5x\",\"5x\",\"10x\"]}},\"parameters\":{}}}}",
            "body_format": 1,
            "body_length": 4900,
            "body_sha256": "b2f979028fd01d235c0a205932d7c9a130536b4759a8e4e2033733375a4a57f1"
          }
        ],
        "transitions": [
          {
            "activity_id": "craps-1",
            "command_id": "record-0",
            "sequence": 0,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"craps-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"990\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"craps\\\",\\\"random\\\":{\\\"key\\\":[1,0],\\\"protocol\\\":1,\\\"session\\\":[0,0]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"standard-craps\\\",\\\"version\\\":2},\\\"strategy\\\":{\\\"id\\\":\\\"test-pass-with-odds\\\",\\\"version\\\":1}},\\\"instructions\\\":[],\\\"outcome\\\":null,\\\"phase\\\":\\\"open-decision\\\",\\\"point\\\":null,\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[1,0],\\\"lane\\\":0,\\\"protocol\\\":1,\\\"session\\\":[0,0]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"pass\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0}],\\\"rules\\\":{\\\"field\\\":\\\"triple-12\\\",\\\"limits\\\":{\\\"flat\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"},\\\"props\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"}},\\\"odds\\\":\\\"3-4-5x\\\"},\\\"schema\\\":7,\\\"sequence\\\":1,\\\"strategy\\\":{\\\"coachedTurn\\\":false,\\\"correction\\\":null,\\\"cycle\\\":{\\\"number\\\":1,\\\"turns\\\":[]},\\\"cycleEnd\\\":null,\\\"decisions\\\":{\\\"betting\\\":0,\\\"playing\\\":0},\\\"deferred\\\":null,\\\"definition\\\":{\\\"adjustments\\\":[],\\\"counters\\\":[],\\\"format\\\":1,\\\"game\\\":\\\"craps\\\",\\\"id\\\":\\\"test-pass-with-odds\\\",\\\"instructions\\\":[{\\\"bets\\\":[{\\\"amount\\\":{\\\"lit\\\":\\\"10\\\"},\\\"target\\\":{\\\"target\\\":\\\"pass\\\"}}],\\\"id\\\":\\\"come-out\\\",\\\"label\\\":\\\"Pass 10 on the come-out\\\",\\\"when\\\":{\\\"is\\\":\\\"none\\\",\\\"subject\\\":\\\"point\\\"}},{\\\"bets\\\":[{\\\"amount\\\":{\\\"lit\\\":\\\"10\\\"},\\\"target\\\":{\\\"target\\\":\\\"pass\\\"}},{\\\"amount\\\":{\\\"lit\\\":\\\"10\\\"},\\\"target\\\":{\\\"target\\\":\\\"pass-odds\\\"}}],\\\"id\\\":\\\"odds\\\",\\\"label\\\":\\\"10 odds behind the pass line\\\",\\\"when\\\":{\\\"any\\\":[{\\\"all\\\":[{\\\"is\\\":\\\"4\\\",\\\"subject\\\":\\\"point\\\"},{\\\"is\\\":\\\"on\\\",\\\"subject\\\":\\\"pass\\\"}]},{\\\"all\\\":[{\\\"is\\\":\\\"5\\\",\\\"subject\\\":\\\"point\\\"},{\\\"is\\\":\\\"on\\\",\\\"subject\\\":\\\"pass\\\"}]},{\\\"all\\\":[{\\\"is\\\":\\\"6\\\",\\\"subject\\\":\\\"point\\\"},{\\\"is\\\":\\\"on\\\",\\\"subject\\\":\\\"pass\\\"}]},{\\\"all\\\":[{\\\"is\\\":\\\"8\\\",\\\"subject\\\":\\\"point\\\"},{\\\"is\\\":\\\"on\\\",\\\"subject\\\":\\\"pass\\\"}]},{\\\"all\\\":[{\\\"is\\\":\\\"9\\\",\\\"subject\\\":\\\"point\\\"},{\\\"is\\\":\\\"on\\\",\\\"subject\\\":\\\"pass\\\"}]},{\\\"all\\\":[{\\\"is\\\":\\\"10\\\",\\\"subject\\\":\\\"point\\\"},{\\\"is\\\":\\\"on\\\",\\\"subject\\\":\\\"pass\\\"}]}]}}],\\\"name\\\":\\\"Pass with odds\\\",\\\"parameters\\\":[],\\\"revision\\\":1,\\\"stopWhen\\\":null,\\\"table\\\":{\\\"limits\\\":{\\\"flat\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"},\\\"props\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"}},\\\"odds\\\":[\\\"1x\\\",\\\"2x\\\",\\\"3-4-5x\\\",\\\"5x\\\",\\\"10x\\\"]}},\\\"departures\\\":[],\\\"parameters\\\":{},\\\"progress\\\":{\\\"counters\\\":{},\\\"cycleTurn\\\":0,\\\"lastResult\\\":\\\"none\\\",\\\"lists\\\":{}},\\\"status\\\":\\\"active\\\"},\\\"turn\\\":0,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"pass\\\"}]}\",\"facts\":[{\"amount\":\"10\",\"kind\":\"wager-changed\",\"previous\":\"0\",\"target\":\"pass\"}],\"receipt\":{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"pass\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0}}",
            "body_format": 1,
            "body_length": 2973,
            "body_sha256": "1f75c05403bc2d8d93ef3dabc283ae6bde63837ef5a361dc6eb230f79110b2e8"
          },
          {
            "activity_id": "craps-1",
            "command_id": "record-1",
            "sequence": 1,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"craps-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"990\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"craps\\\",\\\"random\\\":{\\\"key\\\":[1,0],\\\"protocol\\\":1,\\\"session\\\":[0,0]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"standard-craps\\\",\\\"version\\\":2},\\\"strategy\\\":{\\\"id\\\":\\\"test-pass-with-odds\\\",\\\"version\\\":1}},\\\"instructions\\\":[],\\\"outcome\\\":{\\\"dice\\\":[5,1],\\\"turn\\\":1},\\\"phase\\\":\\\"revealing-outcome\\\",\\\"point\\\":null,\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[1,0],\\\"lane\\\":2,\\\"protocol\\\":1,\\\"session\\\":[0,0]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"pass\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1}],\\\"rules\\\":{\\\"field\\\":\\\"triple-12\\\",\\\"limits\\\":{\\\"flat\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"},\\\"props\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"}},\\\"odds\\\":\\\"3-4-5x\\\"},\\\"schema\\\":7,\\\"sequence\\\":2,\\\"strategy\\\":{\\\"coachedTurn\\\":true,\\\"correction\\\":null,\\\"cycle\\\":{\\\"number\\\":1,\\\"turns\\\":[]},\\\"cycleEnd\\\":null,\\\"decisions\\\":{\\\"betting\\\":1,\\\"playing\\\":0},\\\"deferred\\\":null,\\\"definition\\\":{\\\"adjustments\\\":[],\\\"counters\\\":[],\\\"format\\\":1,\\\"game\\\":\\\"craps\\\",\\\"id\\\":\\\"test-pass-with-odds\\\",\\\"instructions\\\":[{\\\"bets\\\":[{\\\"amount\\\":{\\\"lit\\\":\\\"10\\\"},\\\"target\\\":{\\\"target\\\":\\\"pass\\\"}}],\\\"id\\\":\\\"come-out\\\",\\\"label\\\":\\\"Pass 10 on the come-out\\\",\\\"when\\\":{\\\"is\\\":\\\"none\\\",\\\"subject\\\":\\\"point\\\"}},{\\\"bets\\\":[{\\\"amount\\\":{\\\"lit\\\":\\\"10\\\"},\\\"target\\\":{\\\"target\\\":\\\"pass\\\"}},{\\\"amount\\\":{\\\"lit\\\":\\\"10\\\"},\\\"target\\\":{\\\"target\\\":\\\"pass-odds\\\"}}],\\\"id\\\":\\\"odds\\\",\\\"label\\\":\\\"10 odds behind the pass line\\\",\\\"when\\\":{\\\"any\\\":[{\\\"all\\\":[{\\\"is\\\":\\\"4\\\",\\\"subject\\\":\\\"point\\\"},{\\\"is\\\":\\\"on\\\",\\\"subject\\\":\\\"pass\\\"}]},{\\\"all\\\":[{\\\"is\\\":\\\"5\\\",\\\"subject\\\":\\\"point\\\"},{\\\"is\\\":\\\"on\\\",\\\"subject\\\":\\\"pass\\\"}]},{\\\"all\\\":[{\\\"is\\\":\\\"6\\\",\\\"subject\\\":\\\"point\\\"},{\\\"is\\\":\\\"on\\\",\\\"subject\\\":\\\"pass\\\"}]},{\\\"all\\\":[{\\\"is\\\":\\\"8\\\",\\\"subject\\\":\\\"point\\\"},{\\\"is\\\":\\\"on\\\",\\\"subject\\\":\\\"pass\\\"}]},{\\\"all\\\":[{\\\"is\\\":\\\"9\\\",\\\"subject\\\":\\\"point\\\"},{\\\"is\\\":\\\"on\\\",\\\"subject\\\":\\\"pass\\\"}]},{\\\"all\\\":[{\\\"is\\\":\\\"10\\\",\\\"subject\\\":\\\"point\\\"},{\\\"is\\\":\\\"on\\\",\\\"subject\\\":\\\"pass\\\"}]}]}}],\\\"name\\\":\\\"Pass with odds\\\",\\\"parameters\\\":[],\\\"revision\\\":1,\\\"stopWhen\\\":null,\\\"table\\\":{\\\"limits\\\":{\\\"flat\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"},\\\"props\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"}},\\\"odds\\\":[\\\"1x\\\",\\\"2x\\\",\\\"3-4-5x\\\",\\\"5x\\\",\\\"10x\\\"]}},\\\"departures\\\":[],\\\"parameters\\\":{},\\\"progress\\\":{\\\"counters\\\":{},\\\"cycleTurn\\\":0,\\\"lastResult\\\":\\\"none\\\",\\\"lists\\\":{}},\\\"status\\\":\\\"active\\\"},\\\"turn\\\":1,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"pass\\\"}]}\",\"facts\":[{\"kind\":\"turn-began\",\"turn\":1,\"wagers\":[{\"amount\":\"10\",\"target\":\"pass\"}]},{\"dice\":[5,1],\"kind\":\"dice-rolled\",\"turn\":1}],\"receipt\":{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1}}",
            "body_format": 1,
            "body_length": 3131,
            "body_sha256": "8a906c9ad1358dc42193eaf3238147ce9de573ade59fefa28e9c0fd96dc740e9"
          },
          {
            "activity_id": "craps-1",
            "command_id": "record-2",
            "sequence": 2,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"craps-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"990\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"craps\\\",\\\"random\\\":{\\\"key\\\":[1,0],\\\"protocol\\\":1,\\\"session\\\":[0,0]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"standard-craps\\\",\\\"version\\\":2},\\\"strategy\\\":{\\\"id\\\":\\\"test-pass-with-odds\\\",\\\"version\\\":1}},\\\"instructions\\\":[],\\\"outcome\\\":{\\\"dice\\\":[5,1],\\\"turn\\\":1},\\\"phase\\\":\\\"settled-outcome\\\",\\\"point\\\":6,\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[1,0],\\\"lane\\\":2,\\\"protocol\\\":1,\\\"session\\\":[0,0]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"pass\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"settle-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-2\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":2}],\\\"rules\\\":{\\\"field\\\":\\\"triple-12\\\",\\\"limits\\\":{\\\"flat\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"},\\\"props\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"}},\\\"odds\\\":\\\"3-4-5x\\\"},\\\"schema\\\":7,\\\"sequence\\\":3,\\\"strategy\\\":{\\\"coachedTurn\\\":false,\\\"correction\\\":null,\\\"cycle\\\":{\\\"number\\\":1,\\\"turns\\\":[{\\\"followed\\\":true,\\\"net\\\":\\\"0\\\",\\\"outcome\\\":\\\"5+1\\\",\\\"turn\\\":1,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"pass\\\"}]}]},\\\"cycleEnd\\\":null,\\\"decisions\\\":{\\\"betting\\\":1,\\\"playing\\\":0},\\\"deferred\\\":null,\\\"definition\\\":{\\\"adjustments\\\":[],\\\"counters\\\":[],\\\"format\\\":1,\\\"game\\\":\\\"craps\\\",\\\"id\\\":\\\"test-pass-with-odds\\\",\\\"instructions\\\":[{\\\"bets\\\":[{\\\"amount\\\":{\\\"lit\\\":\\\"10\\\"},\\\"target\\\":{\\\"target\\\":\\\"pass\\\"}}],\\\"id\\\":\\\"come-out\\\",\\\"label\\\":\\\"Pass 10 on the come-out\\\",\\\"when\\\":{\\\"is\\\":\\\"none\\\",\\\"subject\\\":\\\"point\\\"}},{\\\"bets\\\":[{\\\"amount\\\":{\\\"lit\\\":\\\"10\\\"},\\\"target\\\":{\\\"target\\\":\\\"pass\\\"}},{\\\"amount\\\":{\\\"lit\\\":\\\"10\\\"},\\\"target\\\":{\\\"target\\\":\\\"pass-odds\\\"}}],\\\"id\\\":\\\"odds\\\",\\\"label\\\":\\\"10 odds behind the pass line\\\",\\\"when\\\":{\\\"any\\\":[{\\\"all\\\":[{\\\"is\\\":\\\"4\\\",\\\"subject\\\":\\\"point\\\"},{\\\"is\\\":\\\"on\\\",\\\"subject\\\":\\\"pass\\\"}]},{\\\"all\\\":[{\\\"is\\\":\\\"5\\\",\\\"subject\\\":\\\"point\\\"},{\\\"is\\\":\\\"on\\\",\\\"subject\\\":\\\"pass\\\"}]},{\\\"all\\\":[{\\\"is\\\":\\\"6\\\",\\\"subject\\\":\\\"point\\\"},{\\\"is\\\":\\\"on\\\",\\\"subject\\\":\\\"pass\\\"}]},{\\\"all\\\":[{\\\"is\\\":\\\"8\\\",\\\"subject\\\":\\\"point\\\"},{\\\"is\\\":\\\"on\\\",\\\"subject\\\":\\\"pass\\\"}]},{\\\"all\\\":[{\\\"is\\\":\\\"9\\\",\\\"subject\\\":\\\"point\\\"},{\\\"is\\\":\\\"on\\\",\\\"subject\\\":\\\"pass\\\"}]},{\\\"all\\\":[{\\\"is\\\":\\\"10\\\",\\\"subject\\\":\\\"point\\\"},{\\\"is\\\":\\\"on\\\",\\\"subject\\\":\\\"pass\\\"}]}]}}],\\\"name\\\":\\\"Pass with odds\\\",\\\"parameters\\\":[],\\\"revision\\\":1,\\\"stopWhen\\\":null,\\\"table\\\":{\\\"limits\\\":{\\\"flat\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"},\\\"props\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"}},\\\"odds\\\":[\\\"1x\\\",\\\"2x\\\",\\\"3-4-5x\\\",\\\"5x\\\",\\\"10x\\\"]}},\\\"departures\\\":[],\\\"parameters\\\":{},\\\"progress\\\":{\\\"counters\\\":{},\\\"cycleTurn\\\":1,\\\"lastResult\\\":\\\"push\\\",\\\"lists\\\":{}},\\\"status\\\":\\\"active\\\"},\\\"turn\\\":1,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"pass\\\"}]}\",\"facts\":[{\"kind\":\"point-changed\",\"point\":6,\"turn\":1}],\"receipt\":{\"command\":\"{\\\"kind\\\":\\\"settle-turn\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2}}",
            "body_format": 1,
            "body_length": 3293,
            "body_sha256": "1570d512ee5d21e1182b3f73957b317e633f1b2e482f4d385286b97aefa23979"
          },
          {
            "activity_id": "craps-1",
            "command_id": "record-3",
            "sequence": 3,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"craps-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"990\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"craps\\\",\\\"random\\\":{\\\"key\\\":[1,0],\\\"protocol\\\":1,\\\"session\\\":[0,0]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"standard-craps\\\",\\\"version\\\":2},\\\"strategy\\\":{\\\"id\\\":\\\"test-pass-with-odds\\\",\\\"version\\\":1}},\\\"instructions\\\":[],\\\"outcome\\\":{\\\"dice\\\":[5,1],\\\"turn\\\":1},\\\"phase\\\":\\\"strategy-settlement\\\",\\\"point\\\":6,\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[1,0],\\\"lane\\\":2,\\\"protocol\\\":1,\\\"session\\\":[0,0]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"pass\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"settle-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-2\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":2},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"stop-strategy\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-3\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":3}],\\\"rules\\\":{\\\"field\\\":\\\"triple-12\\\",\\\"limits\\\":{\\\"flat\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"},\\\"props\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"}},\\\"odds\\\":\\\"3-4-5x\\\"},\\\"schema\\\":7,\\\"sequence\\\":4,\\\"strategy\\\":{\\\"coachedTurn\\\":false,\\\"correction\\\":null,\\\"cycle\\\":{\\\"number\\\":1,\\\"turns\\\":[{\\\"followed\\\":true,\\\"net\\\":\\\"0\\\",\\\"outcome\\\":\\\"5+1\\\",\\\"turn\\\":1,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"pass\\\"}]}]},\\\"cycleEnd\\\":null,\\\"decisions\\\":{\\\"betting\\\":1,\\\"playing\\\":0},\\\"deferred\\\":null,\\\"definition\\\":{\\\"adjustments\\\":[],\\\"counters\\\":[],\\\"format\\\":1,\\\"game\\\":\\\"craps\\\",\\\"id\\\":\\\"test-pass-with-odds\\\",\\\"instructions\\\":[{\\\"bets\\\":[{\\\"amount\\\":{\\\"lit\\\":\\\"10\\\"},\\\"target\\\":{\\\"target\\\":\\\"pass\\\"}}],\\\"id\\\":\\\"come-out\\\",\\\"label\\\":\\\"Pass 10 on the come-out\\\",\\\"when\\\":{\\\"is\\\":\\\"none\\\",\\\"subject\\\":\\\"point\\\"}},{\\\"bets\\\":[{\\\"amount\\\":{\\\"lit\\\":\\\"10\\\"},\\\"target\\\":{\\\"target\\\":\\\"pass\\\"}},{\\\"amount\\\":{\\\"lit\\\":\\\"10\\\"},\\\"target\\\":{\\\"target\\\":\\\"pass-odds\\\"}}],\\\"id\\\":\\\"odds\\\",\\\"label\\\":\\\"10 odds behind the pass line\\\",\\\"when\\\":{\\\"any\\\":[{\\\"all\\\":[{\\\"is\\\":\\\"4\\\",\\\"subject\\\":\\\"point\\\"},{\\\"is\\\":\\\"on\\\",\\\"subject\\\":\\\"pass\\\"}]},{\\\"all\\\":[{\\\"is\\\":\\\"5\\\",\\\"subject\\\":\\\"point\\\"},{\\\"is\\\":\\\"on\\\",\\\"subject\\\":\\\"pass\\\"}]},{\\\"all\\\":[{\\\"is\\\":\\\"6\\\",\\\"subject\\\":\\\"point\\\"},{\\\"is\\\":\\\"on\\\",\\\"subject\\\":\\\"pass\\\"}]},{\\\"all\\\":[{\\\"is\\\":\\\"8\\\",\\\"subject\\\":\\\"point\\\"},{\\\"is\\\":\\\"on\\\",\\\"subject\\\":\\\"pass\\\"}]},{\\\"all\\\":[{\\\"is\\\":\\\"9\\\",\\\"subject\\\":\\\"point\\\"},{\\\"is\\\":\\\"on\\\",\\\"subject\\\":\\\"pass\\\"}]},{\\\"all\\\":[{\\\"is\\\":\\\"10\\\",\\\"subject\\\":\\\"point\\\"},{\\\"is\\\":\\\"on\\\",\\\"subject\\\":\\\"pass\\\"}]}]}}],\\\"name\\\":\\\"Pass with odds\\\",\\\"parameters\\\":[],\\\"revision\\\":1,\\\"stopWhen\\\":null,\\\"table\\\":{\\\"limits\\\":{\\\"flat\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"},\\\"props\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"}},\\\"odds\\\":[\\\"1x\\\",\\\"2x\\\",\\\"3-4-5x\\\",\\\"5x\\\",\\\"10x\\\"]}},\\\"departures\\\":[],\\\"parameters\\\":{},\\\"progress\\\":{\\\"counters\\\":{},\\\"cycleTurn\\\":1,\\\"lastResult\\\":\\\"push\\\",\\\"lists\\\":{}},\\\"status\\\":\\\"stopped\\\"},\\\"turn\\\":1,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"pass\\\"}]}\",\"facts\":[{\"kind\":\"strategy-stopped\"}],\"receipt\":{\"command\":\"{\\\"kind\\\":\\\"stop-strategy\\\"}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3}}",
            "body_format": 1,
            "body_length": 3409,
            "body_sha256": "e9d6f477458edbc4dded1b0bd45f3a86db6c77ec9a5d49b6b275fc5af516f243"
          }
        ],
        "effects": [],
        "outgoing": [],
        "accepted_records": [],
        "device_positions": [],
        "purged_records": [],
        "feed_cursor": [
          {
            "singleton": 1,
            "sequence": 0,
            "synced_at": null
          }
        ],
        "bootstrap": [
          {
            "singleton": 1,
            "installed": 0,
            "body": null,
            "body_format": null,
            "body_length": null,
            "body_sha256": null,
            "staged": 0,
            "after_ordinal": 0
          }
        ],
        "bootstrap_rows": [],
        "history": [
          {
            "singleton": 1,
            "recent": null,
            "download_requested": 0,
            "download_total": null
          }
        ]
      }
    },
    {
      "name": "blackjack, dealt and waiting for the decision",
      "environment": "production",
      "accountId": "recorded-account",
      "installationId": "recorded-installation",
      "unfinished": {
        "activityId": "blackjack-1",
        "game": "blackjack",
        "phase": "open-decision",
        "finalCashOut": "1010"
      },
      "schema": [
        "CREATE TABLE meta (name TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT",
        "CREATE TABLE activities (\n    activity_id TEXT PRIMARY KEY,\n    position INTEGER NOT NULL UNIQUE,\n    status TEXT NOT NULL CHECK (status IN ('unfinished', 'completed', 'incomplete')),\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL\n  ) STRICT",
        "CREATE INDEX activities_unfinished ON activities (status, position)",
        "CREATE TABLE transitions (\n    activity_id TEXT NOT NULL REFERENCES activities (activity_id),\n    command_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    PRIMARY KEY (activity_id, command_id),\n    UNIQUE (activity_id, sequence)\n  ) STRICT",
        "CREATE TABLE effects (\n    activity_id TEXT NOT NULL REFERENCES activities (activity_id),\n    effect_key TEXT NOT NULL,\n    position INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    PRIMARY KEY (activity_id, effect_key)\n  ) STRICT",
        "CREATE TABLE outgoing (\n    id TEXT PRIMARY KEY,\n    activity_id TEXT UNIQUE REFERENCES activities (activity_id),\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    revisioned INTEGER NOT NULL CHECK (revisioned IN (0, 1)),\n    position INTEGER NOT NULL UNIQUE,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    dependencies TEXT NOT NULL,\n    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),\n    operation_id TEXT UNIQUE,\n    request TEXT,\n    request_sha256 TEXT,\n    receipt TEXT,\n    receipt_sequence INTEGER,\n    failures INTEGER NOT NULL DEFAULT 0 CHECK (failures >= 0),\n    flagged INTEGER NOT NULL DEFAULT 0 CHECK (flagged IN (0, 1)),\n    device_position INTEGER\n  ) STRICT",
        "CREATE INDEX outgoing_pending ON outgoing (status, position)",
        "CREATE INDEX outgoing_items ON outgoing (record_type, item_id, position)",
        "CREATE TABLE accepted_records (\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    installation_id TEXT,\n    device_position INTEGER,\n    summary_at INTEGER,\n    PRIMARY KEY (record_type, item_id)\n  ) STRICT",
        "CREATE INDEX accepted_summaries ON accepted_records (summary_at) WHERE summary_at IS NOT NULL",
        "CREATE TABLE device_positions (record_type TEXT PRIMARY KEY, last INTEGER NOT NULL) STRICT",
        "CREATE TABLE purged_records (record_type TEXT NOT NULL, item_id TEXT NOT NULL, PRIMARY KEY (record_type, item_id)) STRICT",
        "CREATE TABLE feed_cursor (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), sequence INTEGER NOT NULL, synced_at INTEGER) STRICT",
        "CREATE TABLE bootstrap (\n    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),\n    installed INTEGER NOT NULL CHECK (installed IN (0, 1)),\n    body TEXT, body_format INTEGER, body_length INTEGER, body_sha256 TEXT,\n    staged INTEGER NOT NULL DEFAULT 0 CHECK (staged >= 0),\n    after_ordinal INTEGER NOT NULL DEFAULT 0 CHECK (after_ordinal >= 0)\n  ) STRICT",
        "CREATE TABLE bootstrap_rows (\n    position INTEGER PRIMARY KEY,\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    installation_id TEXT,\n    device_position INTEGER,\n    summary_at INTEGER\n  ) STRICT",
        "CREATE TABLE history (\n    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),\n    recent INTEGER CHECK (recent >= 0),\n    download_requested INTEGER NOT NULL CHECK (download_requested IN (0, 1)),\n    download_total INTEGER CHECK (download_total >= 0)\n  ) STRICT"
      ],
      "rows": {
        "meta": [
          {
            "name": "environment",
            "value": "production"
          },
          {
            "name": "account_id",
            "value": "recorded-account"
          },
          {
            "name": "installation_id",
            "value": "recorded-installation"
          },
          {
            "name": "schema_version",
            "value": "1"
          }
        ],
        "activities": [
          {
            "activity_id": "blackjack-1",
            "position": 1,
            "status": "unfinished",
            "sequence": 2,
            "body": "{\"activityId\":\"blackjack-1\",\"admission\":{\"meteringBasis\":\"free-play\",\"provenance\":\"recorded\"},\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"blackjack-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"990\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"blackjack\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"blackjack-six-deck\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":{\\\"active\\\":0,\\\"dealer\\\":[{\\\"deck\\\":1,\\\"rank\\\":10,\\\"suit\\\":\\\"spades\\\"},{\\\"deck\\\":3,\\\"rank\\\":6,\\\"suit\\\":\\\"spades\\\"}],\\\"hands\\\":[{\\\"cards\\\":[{\\\"deck\\\":2,\\\"rank\\\":10,\\\"suit\\\":\\\"spades\\\"},{\\\"deck\\\":1,\\\"rank\\\":11,\\\"suit\\\":\\\"diamonds\\\"}],\\\"done\\\":false,\\\"doubled\\\":false,\\\"surrendered\\\":false,\\\"target\\\":\\\"hand-1\\\"}],\\\"holeRevealed\\\":false,\\\"insurance\\\":\\\"not-offered\\\",\\\"others\\\":[],\\\"peek\\\":\\\"no-blackjack\\\"},\\\"phase\\\":\\\"open-decision\\\",\\\"random\\\":{\\\"block\\\":[77,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":3,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"hand-1\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1}],\\\"rules\\\":{\\\"dealer\\\":\\\"S17\\\",\\\"decks\\\":6,\\\"lateSurrender\\\":true,\\\"limits\\\":{\\\"initial\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"penetration\\\":75,\\\"players\\\":{\\\"learnerSeat\\\":0,\\\"otherWagers\\\":[],\\\"strategy\\\":null}},\\\"schema\\\":7,\\\"sequence\\\":2,\\\"shoe\\\":{\\\"cut\\\":234,\\\"next\\\":4,\\\"order\\\":[152,100,75,200,65,35,242,282,199,132,190,280,241,71,178,116,209,74,95,225,151,16,155,72,268,18,239,39,187,191,119,156,188,123,231,186,243,276,91,208,179,32,279,184,109,196,27,53,29,263,44,61,234,11,41,33,183,106,244,114,122,262,54,289,235,133,120,181,150,229,292,307,103,232,67,141,189,217,167,245,115,129,51,285,76,73,161,134,0,13,8,126,83,298,63,64,124,185,7,146,137,306,224,138,30,59,297,154,164,250,213,201,34,98,9,219,77,211,10,284,93,88,136,104,43,286,270,40,130,110,149,24,171,17,112,157,36,304,274,256,153,246,58,172,197,139,143,162,267,26,214,94,160,203,227,78,45,113,247,21,301,278,79,14,87,80,273,218,135,23,308,2,252,302,1,253,66,111,261,221,305,55,228,163,92,57,175,22,281,264,6,15,210,216,147,81,68,290,85,125,19,283,117,192,170,56,265,176,287,127,140,168,173,174,311,237,108,177,220,204,266,82,212,248,158,69,60,255,233,296,159,293,28,166,5,207,294,20,142,25,105,84,309,12,238,275,128,259,37,295,303,165,90,193,180,198,257,271,277,121,230,182,97,260,310,249,269,223,101,300,215,206,4,31,50,38,47,48,42,102,131,194,195,49,288,240,96,118,52,226,145,205,202,99,299,272,169,3,222,144,62,89,254,291,46,236,107,251,86,148,258,70]},\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"hand-1\\\"}]}\",\"completion\":null,\"createdAt\":1790000000000,\"incomplete\":null,\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"sequence\":2,\"specification\":{\"activityId\":\"blackjack-1\",\"device\":\"recorded-installation\",\"funding\":\"1000\",\"fundingSource\":\"practice-funding\",\"game\":\"blackjack\",\"owner\":\"recorded-account\",\"reference\":null,\"rules\":{\"dealer\":\"S17\",\"decks\":6,\"id\":\"blackjack-six-deck\",\"lateSurrender\":true,\"limits\":{\"initial\":{\"max\":\"1000\",\"min\":\"10\"}},\"penetration\":75,\"players\":{\"learnerSeat\":0,\"otherWagers\":[],\"strategy\":null},\"version\":1},\"strategy\":null}}",
            "body_format": 1,
            "body_length": 3596,
            "body_sha256": "63c1fec75ef7641be823f5f55c196634632df6b615ca5d4e316272d4d963bfd7"
          }
        ],
        "transitions": [
          {
            "activity_id": "blackjack-1",
            "command_id": "record-0",
            "sequence": 0,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"blackjack-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"990\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"blackjack\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"blackjack-six-deck\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":null,\\\"phase\\\":\\\"open-decision\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":0,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"hand-1\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0}],\\\"rules\\\":{\\\"dealer\\\":\\\"S17\\\",\\\"decks\\\":6,\\\"lateSurrender\\\":true,\\\"limits\\\":{\\\"initial\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"penetration\\\":75,\\\"players\\\":{\\\"learnerSeat\\\":0,\\\"otherWagers\\\":[],\\\"strategy\\\":null}},\\\"schema\\\":7,\\\"sequence\\\":1,\\\"shoe\\\":null,\\\"strategy\\\":null,\\\"turn\\\":0,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"hand-1\\\"}]}\",\"facts\":[{\"amount\":\"10\",\"kind\":\"wager-changed\",\"previous\":\"0\",\"target\":\"hand-1\"}],\"receipt\":{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"hand-1\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0}}",
            "body_format": 1,
            "body_length": 1456,
            "body_sha256": "23328c1067fd2e4ca5e0c06fcbb8cdbcdeab47a88b8c6cf0ce49fa6aae654bda"
          },
          {
            "activity_id": "blackjack-1",
            "command_id": "record-1",
            "sequence": 1,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"blackjack-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"990\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"blackjack\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"blackjack-six-deck\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":{\\\"active\\\":0,\\\"dealer\\\":[{\\\"deck\\\":1,\\\"rank\\\":10,\\\"suit\\\":\\\"spades\\\"},{\\\"deck\\\":3,\\\"rank\\\":6,\\\"suit\\\":\\\"spades\\\"}],\\\"hands\\\":[{\\\"cards\\\":[{\\\"deck\\\":2,\\\"rank\\\":10,\\\"suit\\\":\\\"spades\\\"},{\\\"deck\\\":1,\\\"rank\\\":11,\\\"suit\\\":\\\"diamonds\\\"}],\\\"done\\\":false,\\\"doubled\\\":false,\\\"surrendered\\\":false,\\\"target\\\":\\\"hand-1\\\"}],\\\"holeRevealed\\\":false,\\\"insurance\\\":\\\"not-offered\\\",\\\"others\\\":[],\\\"peek\\\":\\\"no-blackjack\\\"},\\\"phase\\\":\\\"open-decision\\\",\\\"random\\\":{\\\"block\\\":[77,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":3,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"hand-1\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1}],\\\"rules\\\":{\\\"dealer\\\":\\\"S17\\\",\\\"decks\\\":6,\\\"lateSurrender\\\":true,\\\"limits\\\":{\\\"initial\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"penetration\\\":75,\\\"players\\\":{\\\"learnerSeat\\\":0,\\\"otherWagers\\\":[],\\\"strategy\\\":null}},\\\"schema\\\":7,\\\"sequence\\\":2,\\\"shoe\\\":{\\\"cut\\\":234,\\\"next\\\":4,\\\"order\\\":[152,100,75,200,65,35,242,282,199,132,190,280,241,71,178,116,209,74,95,225,151,16,155,72,268,18,239,39,187,191,119,156,188,123,231,186,243,276,91,208,179,32,279,184,109,196,27,53,29,263,44,61,234,11,41,33,183,106,244,114,122,262,54,289,235,133,120,181,150,229,292,307,103,232,67,141,189,217,167,245,115,129,51,285,76,73,161,134,0,13,8,126,83,298,63,64,124,185,7,146,137,306,224,138,30,59,297,154,164,250,213,201,34,98,9,219,77,211,10,284,93,88,136,104,43,286,270,40,130,110,149,24,171,17,112,157,36,304,274,256,153,246,58,172,197,139,143,162,267,26,214,94,160,203,227,78,45,113,247,21,301,278,79,14,87,80,273,218,135,23,308,2,252,302,1,253,66,111,261,221,305,55,228,163,92,57,175,22,281,264,6,15,210,216,147,81,68,290,85,125,19,283,117,192,170,56,265,176,287,127,140,168,173,174,311,237,108,177,220,204,266,82,212,248,158,69,60,255,233,296,159,293,28,166,5,207,294,20,142,25,105,84,309,12,238,275,128,259,37,295,303,165,90,193,180,198,257,271,277,121,230,182,97,260,310,249,269,223,101,300,215,206,4,31,50,38,47,48,42,102,131,194,195,49,288,240,96,118,52,226,145,205,202,99,299,272,169,3,222,144,62,89,254,291,46,236,107,251,86,148,258,70]},\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"hand-1\\\"}]}\",\"facts\":[{\"cards\":312,\"cut\":234,\"kind\":\"shoe-shuffled\"},{\"kind\":\"turn-began\",\"turn\":1,\"wagers\":[{\"amount\":\"10\",\"target\":\"hand-1\"}]},{\"card\":{\"deck\":2,\"rank\":10,\"suit\":\"spades\"},\"kind\":\"card-dealt\",\"to\":\"hand-1\",\"turn\":1},{\"card\":{\"deck\":1,\"rank\":10,\"suit\":\"spades\"},\"kind\":\"card-dealt\",\"to\":\"dealer\",\"turn\":1},{\"card\":{\"deck\":1,\"rank\":11,\"suit\":\"diamonds\"},\"kind\":\"card-dealt\",\"to\":\"hand-1\",\"turn\":1},{\"card\":null,\"kind\":\"card-dealt\",\"to\":\"dealer\",\"turn\":1},{\"kind\":\"peeked\",\"result\":\"no-blackjack\",\"turn\":1}],\"receipt\":{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1}}",
            "body_format": 1,
            "body_length": 3536,
            "body_sha256": "fef06241e026c8f56b08167bb05f2a4cb640d2018dcd74d69ce2ffcffe1d9a82"
          }
        ],
        "effects": [],
        "outgoing": [],
        "accepted_records": [],
        "device_positions": [],
        "purged_records": [],
        "feed_cursor": [
          {
            "singleton": 1,
            "sequence": 0,
            "synced_at": null
          }
        ],
        "bootstrap": [
          {
            "singleton": 1,
            "installed": 0,
            "body": null,
            "body_format": null,
            "body_length": null,
            "body_sha256": null,
            "staged": 0,
            "after_ordinal": 0
          }
        ],
        "bootstrap_rows": [],
        "history": [
          {
            "singleton": 1,
            "recent": null,
            "download_requested": 0,
            "download_total": null
          }
        ]
      }
    },
    {
      "name": "blackjack guided, counting with the bet schedule, a betting correction waiting",
      "environment": "production",
      "accountId": "recorded-account",
      "installationId": "recorded-installation",
      "unfinished": {
        "activityId": "blackjack-1",
        "game": "blackjack",
        "phase": "correction",
        "finalCashOut": "1000"
      },
      "schema": [
        "CREATE TABLE meta (name TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT",
        "CREATE TABLE activities (\n    activity_id TEXT PRIMARY KEY,\n    position INTEGER NOT NULL UNIQUE,\n    status TEXT NOT NULL CHECK (status IN ('unfinished', 'completed', 'incomplete')),\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL\n  ) STRICT",
        "CREATE INDEX activities_unfinished ON activities (status, position)",
        "CREATE TABLE transitions (\n    activity_id TEXT NOT NULL REFERENCES activities (activity_id),\n    command_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    PRIMARY KEY (activity_id, command_id),\n    UNIQUE (activity_id, sequence)\n  ) STRICT",
        "CREATE TABLE effects (\n    activity_id TEXT NOT NULL REFERENCES activities (activity_id),\n    effect_key TEXT NOT NULL,\n    position INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    PRIMARY KEY (activity_id, effect_key)\n  ) STRICT",
        "CREATE TABLE outgoing (\n    id TEXT PRIMARY KEY,\n    activity_id TEXT UNIQUE REFERENCES activities (activity_id),\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    revisioned INTEGER NOT NULL CHECK (revisioned IN (0, 1)),\n    position INTEGER NOT NULL UNIQUE,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    dependencies TEXT NOT NULL,\n    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),\n    operation_id TEXT UNIQUE,\n    request TEXT,\n    request_sha256 TEXT,\n    receipt TEXT,\n    receipt_sequence INTEGER,\n    failures INTEGER NOT NULL DEFAULT 0 CHECK (failures >= 0),\n    flagged INTEGER NOT NULL DEFAULT 0 CHECK (flagged IN (0, 1)),\n    device_position INTEGER\n  ) STRICT",
        "CREATE INDEX outgoing_pending ON outgoing (status, position)",
        "CREATE INDEX outgoing_items ON outgoing (record_type, item_id, position)",
        "CREATE TABLE accepted_records (\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    installation_id TEXT,\n    device_position INTEGER,\n    summary_at INTEGER,\n    PRIMARY KEY (record_type, item_id)\n  ) STRICT",
        "CREATE INDEX accepted_summaries ON accepted_records (summary_at) WHERE summary_at IS NOT NULL",
        "CREATE TABLE device_positions (record_type TEXT PRIMARY KEY, last INTEGER NOT NULL) STRICT",
        "CREATE TABLE purged_records (record_type TEXT NOT NULL, item_id TEXT NOT NULL, PRIMARY KEY (record_type, item_id)) STRICT",
        "CREATE TABLE feed_cursor (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), sequence INTEGER NOT NULL, synced_at INTEGER) STRICT",
        "CREATE TABLE bootstrap (\n    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),\n    installed INTEGER NOT NULL CHECK (installed IN (0, 1)),\n    body TEXT, body_format INTEGER, body_length INTEGER, body_sha256 TEXT,\n    staged INTEGER NOT NULL DEFAULT 0 CHECK (staged >= 0),\n    after_ordinal INTEGER NOT NULL DEFAULT 0 CHECK (after_ordinal >= 0)\n  ) STRICT",
        "CREATE TABLE bootstrap_rows (\n    position INTEGER PRIMARY KEY,\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    installation_id TEXT,\n    device_position INTEGER,\n    summary_at INTEGER\n  ) STRICT",
        "CREATE TABLE history (\n    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),\n    recent INTEGER CHECK (recent >= 0),\n    download_requested INTEGER NOT NULL CHECK (download_requested IN (0, 1)),\n    download_total INTEGER CHECK (download_total >= 0)\n  ) STRICT"
      ],
      "rows": {
        "meta": [
          {
            "name": "environment",
            "value": "production"
          },
          {
            "name": "account_id",
            "value": "recorded-account"
          },
          {
            "name": "installation_id",
            "value": "recorded-installation"
          },
          {
            "name": "schema_version",
            "value": "1"
          }
        ],
        "activities": [
          {
            "activity_id": "blackjack-1",
            "position": 1,
            "status": "unfinished",
            "sequence": 2,
            "body": "{\"activityId\":\"blackjack-1\",\"admission\":{\"meteringBasis\":\"free-play\",\"provenance\":\"recorded\"},\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"blackjack-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"950\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"blackjack\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"blackjack-six-deck\\\",\\\"version\\\":1},\\\"strategy\\\":{\\\"id\\\":\\\"test-blackjack-counting-schedule\\\",\\\"version\\\":1}},\\\"outcome\\\":null,\\\"phase\\\":\\\"correction\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":0,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"50\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"hand-1\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"assessed\\\",\\\"sequence\\\":1}],\\\"rules\\\":{\\\"dealer\\\":\\\"S17\\\",\\\"decks\\\":6,\\\"lateSurrender\\\":true,\\\"limits\\\":{\\\"initial\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"penetration\\\":75,\\\"players\\\":{\\\"learnerSeat\\\":0,\\\"otherWagers\\\":[],\\\"strategy\\\":null}},\\\"schema\\\":7,\\\"sequence\\\":2,\\\"shoe\\\":null,\\\"strategy\\\":{\\\"coachedTurn\\\":false,\\\"correction\\\":{\\\"actual\\\":[{\\\"amount\\\":\\\"50\\\",\\\"target\\\":\\\"hand-1\\\"}],\\\"explanation\\\":{\\\"fallback\\\":null,\\\"instructions\\\":[{\\\"id\\\":\\\"below-1\\\",\\\"label\\\":\\\"Below +1: 1 unit\\\"}],\\\"prescription\\\":{\\\"bets\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"hand-1\\\"}],\\\"held\\\":[],\\\"status\\\":\\\"prescribed\\\"},\\\"situation\\\":{\\\"available\\\":\\\"1000\\\",\\\"subjects\\\":{\\\"last-result\\\":\\\"none\\\"},\\\"values\\\":{\\\"true-count\\\":\\\"0\\\"}},\\\"state\\\":{\\\"counters\\\":{},\\\"cycleTurn\\\":0,\\\"lastResult\\\":\\\"none\\\",\\\"lists\\\":{}}},\\\"id\\\":\\\"blackjack-1/departure/1\\\",\\\"turn\\\":1},\\\"cycle\\\":{\\\"number\\\":1,\\\"turns\\\":[]},\\\"cycleEnd\\\":null,\\\"decisions\\\":{\\\"betting\\\":0,\\\"playing\\\":0},\\\"deferred\\\":null,\\\"definition\\\":{\\\"adjustments\\\":[],\\\"counters\\\":[],\\\"format\\\":1,\\\"game\\\":\\\"blackjack\\\",\\\"id\\\":\\\"test-blackjack-counting-schedule\\\",\\\"instructions\\\":[{\\\"bets\\\":[{\\\"amount\\\":{\\\"lit\\\":\\\"10\\\"},\\\"target\\\":{\\\"target\\\":\\\"hand-1\\\"}}],\\\"id\\\":\\\"below-1\\\",\\\"label\\\":\\\"Below +1: 1 unit\\\",\\\"priority\\\":0,\\\"when\\\":{\\\"always\\\":true}},{\\\"bets\\\":[{\\\"amount\\\":{\\\"lit\\\":\\\"20\\\"},\\\"target\\\":{\\\"target\\\":\\\"hand-1\\\"}}],\\\"id\\\":\\\"from-1\\\",\\\"label\\\":\\\"+1: 2 units\\\",\\\"priority\\\":1,\\\"when\\\":{\\\"compare\\\":{\\\"value\\\":\\\"true-count\\\"},\\\"op\\\":\\\"ge\\\",\\\"to\\\":{\\\"lit\\\":\\\"1\\\"}}},{\\\"bets\\\":[{\\\"amount\\\":{\\\"lit\\\":\\\"40\\\"},\\\"target\\\":{\\\"target\\\":\\\"hand-1\\\"}}],\\\"id\\\":\\\"from-2\\\",\\\"label\\\":\\\"+2: 4 units\\\",\\\"priority\\\":2,\\\"when\\\":{\\\"compare\\\":{\\\"value\\\":\\\"true-count\\\"},\\\"op\\\":\\\"ge\\\",\\\"to\\\":{\\\"lit\\\":\\\"2\\\"}}},{\\\"bets\\\":[{\\\"amount\\\":{\\\"lit\\\":\\\"60\\\"},\\\"target\\\":{\\\"target\\\":\\\"hand-1\\\"}}],\\\"id\\\":\\\"from-3\\\",\\\"label\\\":\\\"+3: 6 units\\\",\\\"priority\\\":3,\\\"when\\\":{\\\"compare\\\":{\\\"value\\\":\\\"true-count\\\"},\\\"op\\\":\\\"ge\\\",\\\"to\\\":{\\\"lit\\\":\\\"3\\\"}}},{\\\"bets\\\":[{\\\"amount\\\":{\\\"lit\\\":\\\"80\\\"},\\\"target\\\":{\\\"target\\\":\\\"hand-1\\\"}}],\\\"id\\\":\\\"from-4\\\",\\\"label\\\":\\\"+4 or more: 8 units\\\",\\\"priority\\\":4,\\\"when\\\":{\\\"compare\\\":{\\\"value\\\":\\\"true-count\\\"},\\\"op\\\":\\\"ge\\\",\\\"to\\\":{\\\"lit\\\":\\\"4\\\"}}}],\\\"name\\\":\\\"Counting with basic\\\",\\\"parameters\\\":[],\\\"play\\\":{\\\"count\\\":\\\"player\\\",\\\"deviations\\\":[],\\\"fallbacks\\\":{\\\"double\\\":{\\\"hard\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"],\\\"pair\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"SHHHHHSHHS\\\",\\\"SSSSSSSSSS\\\"],\\\"soft\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HSSSSSSSHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"]},\\\"doubleOnOriginalLateSurrender\\\":{\\\"hard\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHR\\\",\\\"RSSSSSHHRR\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"],\\\"pair\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"SHHHHHSHHS\\\",\\\"SSSSSSSSSS\\\"],\\\"soft\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HSSSSSSSHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"]},\\\"splitByBalance\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"RSSSSSHHRR\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"],\\\"splitByRule\\\":[\\\"SSSSSSSSSS\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HDDDDDDDDH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"],\\\"surrender\\\":{\\\"hard\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHDDDDHHHH\\\",\\\"HDDDDDDDDH\\\",\\\"HDDDDDDDDD\\\",\\\"HHHSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"],\\\"pair\\\":[\\\"PPPPPPPPPP\\\",\\\"HPPPPPPHHH\\\",\\\"HPPPPPPHHH\\\",\\\"HHHHPPHHHH\\\",\\\"HDDDDDDDDH\\\",\\\"HPPPPPHHHH\\\",\\\"HPPPPPPHHH\\\",\\\"PPPPPPPPPP\\\",\\\"SPPPPPSPPS\\\",\\\"SSSSSSSSSS\\\"],\\\"soft\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHDDHHHH\\\",\\\"HHHHDDHHHH\\\",\\\"HHHDDDHHHH\\\",\\\"HHHDDDHHHH\\\",\\\"HHDDDDHHHH\\\",\\\"HSDDDDSSHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"]}},\\\"first\\\":{\\\"hard\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHDDDDHHHH\\\",\\\"HDDDDDDDDH\\\",\\\"HDDDDDDDDD\\\",\\\"HHHSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHR\\\",\\\"RSSSSSHHRR\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"],\\\"pair\\\":[\\\"PPPPPPPPPP\\\",\\\"HPPPPPPHHH\\\",\\\"HPPPPPPHHH\\\",\\\"HHHHPPHHHH\\\",\\\"HDDDDDDDDH\\\",\\\"HPPPPPHHHH\\\",\\\"HPPPPPPHHH\\\",\\\"PPPPPPPPPP\\\",\\\"SPPPPPSPPS\\\",\\\"SSSSSSSSSS\\\"],\\\"soft\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHDDHHHH\\\",\\\"HHHHDDHHHH\\\",\\\"HHHDDDHHHH\\\",\\\"HHHDDDHHHH\\\",\\\"HHDDDDHHHH\\\",\\\"HSDDDDSSHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"]},\\\"later\\\":{\\\"hard\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHDDDDHHHH\\\",\\\"HDDDDDDDDH\\\",\\\"HDDDDDDDDD\\\",\\\"HHHSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"],\\\"soft\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHDDHHHH\\\",\\\"HHHHDDHHHH\\\",\\\"HHHDDDHHHH\\\",\\\"HHHDDDHHHH\\\",\\\"HHDDDDHHHH\\\",\\\"HSDDDDSSHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"]},\\\"laterWithoutDouble\\\":{\\\"hard\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"],\\\"soft\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HSSSSSSSHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"]}},\\\"revision\\\":1,\\\"stopWhen\\\":null,\\\"table\\\":{\\\"dealer\\\":\\\"S17\\\",\\\"lateSurrender\\\":true,\\\"limits\\\":{\\\"initial\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}}}},\\\"departures\\\":[],\\\"parameters\\\":{},\\\"progress\\\":{\\\"counters\\\":{},\\\"cycleTurn\\\":0,\\\"lastResult\\\":\\\"none\\\",\\\"lists\\\":{}},\\\"status\\\":\\\"active\\\"},\\\"turn\\\":0,\\\"wagers\\\":[{\\\"amount\\\":\\\"50\\\",\\\"target\\\":\\\"hand-1\\\"}]}\",\"completion\":null,\"createdAt\":1790000000000,\"incomplete\":null,\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"sequence\":2,\"specification\":{\"activityId\":\"blackjack-1\",\"device\":\"recorded-installation\",\"funding\":\"1000\",\"fundingSource\":\"practice-funding\",\"game\":\"blackjack\",\"owner\":\"recorded-account\",\"reference\":null,\"rules\":{\"dealer\":\"S17\",\"decks\":6,\"id\":\"blackjack-six-deck\",\"lateSurrender\":true,\"limits\":{\"initial\":{\"max\":\"1000\",\"min\":\"10\"}},\"penetration\":75,\"players\":{\"learnerSeat\":0,\"otherWagers\":[],\"strategy\":null},\"version\":1},\"strategy\":{\"definition\":{\"adjustments\":[],\"counters\":[],\"format\":1,\"game\":\"blackjack\",\"id\":\"test-blackjack-counting-schedule\",\"instructions\":[{\"bets\":[{\"amount\":{\"lit\":\"10\"},\"target\":{\"target\":\"hand-1\"}}],\"id\":\"below-1\",\"label\":\"Below +1: 1 unit\",\"priority\":0,\"when\":{\"always\":true}},{\"bets\":[{\"amount\":{\"lit\":\"20\"},\"target\":{\"target\":\"hand-1\"}}],\"id\":\"from-1\",\"label\":\"+1: 2 units\",\"priority\":1,\"when\":{\"compare\":{\"value\":\"true-count\"},\"op\":\"ge\",\"to\":{\"lit\":\"1\"}}},{\"bets\":[{\"amount\":{\"lit\":\"40\"},\"target\":{\"target\":\"hand-1\"}}],\"id\":\"from-2\",\"label\":\"+2: 4 units\",\"priority\":2,\"when\":{\"compare\":{\"value\":\"true-count\"},\"op\":\"ge\",\"to\":{\"lit\":\"2\"}}},{\"bets\":[{\"amount\":{\"lit\":\"60\"},\"target\":{\"target\":\"hand-1\"}}],\"id\":\"from-3\",\"label\":\"+3: 6 units\",\"priority\":3,\"when\":{\"compare\":{\"value\":\"true-count\"},\"op\":\"ge\",\"to\":{\"lit\":\"3\"}}},{\"bets\":[{\"amount\":{\"lit\":\"80\"},\"target\":{\"target\":\"hand-1\"}}],\"id\":\"from-4\",\"label\":\"+4 or more: 8 units\",\"priority\":4,\"when\":{\"compare\":{\"value\":\"true-count\"},\"op\":\"ge\",\"to\":{\"lit\":\"4\"}}}],\"name\":\"Counting with basic\",\"parameters\":[],\"play\":{\"count\":\"player\",\"deviations\":[],\"fallbacks\":{\"double\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SHHHHHSHHS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"doubleOnOriginalLateSurrender\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHR\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"SHHHHHSHHS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"splitByBalance\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"splitByRule\":[\"SSSSSSSSSS\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HDDDDDDDDH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"surrender\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"PPPPPPPPPP\",\"HPPPPPPHHH\",\"HPPPPPPHHH\",\"HHHHPPHHHH\",\"HDDDDDDDDH\",\"HPPPPPHHHH\",\"HPPPPPPHHH\",\"PPPPPPPPPP\",\"SPPPPPSPPS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]}},\"first\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHR\",\"RSSSSSHHRR\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"pair\":[\"PPPPPPPPPP\",\"HPPPPPPHHH\",\"HPPPPPPHHH\",\"HHHHPPHHHH\",\"HDDDDDDDDH\",\"HPPPPPHHHH\",\"HPPPPPPHHH\",\"PPPPPPPPPP\",\"SPPPPPSPPS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"later\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHDDDDHHHH\",\"HDDDDDDDDH\",\"HDDDDDDDDD\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHDDHHHH\",\"HHHHDDHHHH\",\"HHHDDDHHHH\",\"HHHDDDHHHH\",\"HHDDDDHHHH\",\"HSDDDDSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]},\"laterWithoutDouble\":{\"hard\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"HSSSSSHHHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"],\"soft\":[\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HHHHHHHHHH\",\"HSSSSSSSHH\",\"SSSSSSSSSS\",\"SSSSSSSSSS\",\"SSSSSSSSSS\"]}},\"revision\":1,\"stopWhen\":null,\"table\":{\"dealer\":\"S17\",\"lateSurrender\":true,\"limits\":{\"initial\":{\"max\":\"1000\",\"min\":\"10\"}}}},\"parameters\":{}}}}",
            "body_format": 1,
            "body_length": 12391,
            "body_sha256": "2505c35dc825688aeef652e0709f76a543809914be8153a4757af0d975d418b2"
          }
        ],
        "transitions": [
          {
            "activity_id": "blackjack-1",
            "command_id": "record-0",
            "sequence": 0,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"blackjack-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"950\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"blackjack\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"blackjack-six-deck\\\",\\\"version\\\":1},\\\"strategy\\\":{\\\"id\\\":\\\"test-blackjack-counting-schedule\\\",\\\"version\\\":1}},\\\"outcome\\\":null,\\\"phase\\\":\\\"open-decision\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":0,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"50\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"hand-1\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0}],\\\"rules\\\":{\\\"dealer\\\":\\\"S17\\\",\\\"decks\\\":6,\\\"lateSurrender\\\":true,\\\"limits\\\":{\\\"initial\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"penetration\\\":75,\\\"players\\\":{\\\"learnerSeat\\\":0,\\\"otherWagers\\\":[],\\\"strategy\\\":null}},\\\"schema\\\":7,\\\"sequence\\\":1,\\\"shoe\\\":null,\\\"strategy\\\":{\\\"coachedTurn\\\":false,\\\"correction\\\":null,\\\"cycle\\\":{\\\"number\\\":1,\\\"turns\\\":[]},\\\"cycleEnd\\\":null,\\\"decisions\\\":{\\\"betting\\\":0,\\\"playing\\\":0},\\\"deferred\\\":null,\\\"definition\\\":{\\\"adjustments\\\":[],\\\"counters\\\":[],\\\"format\\\":1,\\\"game\\\":\\\"blackjack\\\",\\\"id\\\":\\\"test-blackjack-counting-schedule\\\",\\\"instructions\\\":[{\\\"bets\\\":[{\\\"amount\\\":{\\\"lit\\\":\\\"10\\\"},\\\"target\\\":{\\\"target\\\":\\\"hand-1\\\"}}],\\\"id\\\":\\\"below-1\\\",\\\"label\\\":\\\"Below +1: 1 unit\\\",\\\"priority\\\":0,\\\"when\\\":{\\\"always\\\":true}},{\\\"bets\\\":[{\\\"amount\\\":{\\\"lit\\\":\\\"20\\\"},\\\"target\\\":{\\\"target\\\":\\\"hand-1\\\"}}],\\\"id\\\":\\\"from-1\\\",\\\"label\\\":\\\"+1: 2 units\\\",\\\"priority\\\":1,\\\"when\\\":{\\\"compare\\\":{\\\"value\\\":\\\"true-count\\\"},\\\"op\\\":\\\"ge\\\",\\\"to\\\":{\\\"lit\\\":\\\"1\\\"}}},{\\\"bets\\\":[{\\\"amount\\\":{\\\"lit\\\":\\\"40\\\"},\\\"target\\\":{\\\"target\\\":\\\"hand-1\\\"}}],\\\"id\\\":\\\"from-2\\\",\\\"label\\\":\\\"+2: 4 units\\\",\\\"priority\\\":2,\\\"when\\\":{\\\"compare\\\":{\\\"value\\\":\\\"true-count\\\"},\\\"op\\\":\\\"ge\\\",\\\"to\\\":{\\\"lit\\\":\\\"2\\\"}}},{\\\"bets\\\":[{\\\"amount\\\":{\\\"lit\\\":\\\"60\\\"},\\\"target\\\":{\\\"target\\\":\\\"hand-1\\\"}}],\\\"id\\\":\\\"from-3\\\",\\\"label\\\":\\\"+3: 6 units\\\",\\\"priority\\\":3,\\\"when\\\":{\\\"compare\\\":{\\\"value\\\":\\\"true-count\\\"},\\\"op\\\":\\\"ge\\\",\\\"to\\\":{\\\"lit\\\":\\\"3\\\"}}},{\\\"bets\\\":[{\\\"amount\\\":{\\\"lit\\\":\\\"80\\\"},\\\"target\\\":{\\\"target\\\":\\\"hand-1\\\"}}],\\\"id\\\":\\\"from-4\\\",\\\"label\\\":\\\"+4 or more: 8 units\\\",\\\"priority\\\":4,\\\"when\\\":{\\\"compare\\\":{\\\"value\\\":\\\"true-count\\\"},\\\"op\\\":\\\"ge\\\",\\\"to\\\":{\\\"lit\\\":\\\"4\\\"}}}],\\\"name\\\":\\\"Counting with basic\\\",\\\"parameters\\\":[],\\\"play\\\":{\\\"count\\\":\\\"player\\\",\\\"deviations\\\":[],\\\"fallbacks\\\":{\\\"double\\\":{\\\"hard\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"],\\\"pair\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"SHHHHHSHHS\\\",\\\"SSSSSSSSSS\\\"],\\\"soft\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HSSSSSSSHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"]},\\\"doubleOnOriginalLateSurrender\\\":{\\\"hard\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHR\\\",\\\"RSSSSSHHRR\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"],\\\"pair\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"SHHHHHSHHS\\\",\\\"SSSSSSSSSS\\\"],\\\"soft\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HSSSSSSSHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"]},\\\"splitByBalance\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"RSSSSSHHRR\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"],\\\"splitByRule\\\":[\\\"SSSSSSSSSS\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HDDDDDDDDH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"],\\\"surrender\\\":{\\\"hard\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHDDDDHHHH\\\",\\\"HDDDDDDDDH\\\",\\\"HDDDDDDDDD\\\",\\\"HHHSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"],\\\"pair\\\":[\\\"PPPPPPPPPP\\\",\\\"HPPPPPPHHH\\\",\\\"HPPPPPPHHH\\\",\\\"HHHHPPHHHH\\\",\\\"HDDDDDDDDH\\\",\\\"HPPPPPHHHH\\\",\\\"HPPPPPPHHH\\\",\\\"PPPPPPPPPP\\\",\\\"SPPPPPSPPS\\\",\\\"SSSSSSSSSS\\\"],\\\"soft\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHDDHHHH\\\",\\\"HHHHDDHHHH\\\",\\\"HHHDDDHHHH\\\",\\\"HHHDDDHHHH\\\",\\\"HHDDDDHHHH\\\",\\\"HSDDDDSSHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"]}},\\\"first\\\":{\\\"hard\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHDDDDHHHH\\\",\\\"HDDDDDDDDH\\\",\\\"HDDDDDDDDD\\\",\\\"HHHSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHR\\\",\\\"RSSSSSHHRR\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"],\\\"pair\\\":[\\\"PPPPPPPPPP\\\",\\\"HPPPPPPHHH\\\",\\\"HPPPPPPHHH\\\",\\\"HHHHPPHHHH\\\",\\\"HDDDDDDDDH\\\",\\\"HPPPPPHHHH\\\",\\\"HPPPPPPHHH\\\",\\\"PPPPPPPPPP\\\",\\\"SPPPPPSPPS\\\",\\\"SSSSSSSSSS\\\"],\\\"soft\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHDDHHHH\\\",\\\"HHHHDDHHHH\\\",\\\"HHHDDDHHHH\\\",\\\"HHHDDDHHHH\\\",\\\"HHDDDDHHHH\\\",\\\"HSDDDDSSHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"]},\\\"later\\\":{\\\"hard\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHDDDDHHHH\\\",\\\"HDDDDDDDDH\\\",\\\"HDDDDDDDDD\\\",\\\"HHHSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"],\\\"soft\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHDDHHHH\\\",\\\"HHHHDDHHHH\\\",\\\"HHHDDDHHHH\\\",\\\"HHHDDDHHHH\\\",\\\"HHDDDDHHHH\\\",\\\"HSDDDDSSHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"]},\\\"laterWithoutDouble\\\":{\\\"hard\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"],\\\"soft\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HSSSSSSSHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"]}},\\\"revision\\\":1,\\\"stopWhen\\\":null,\\\"table\\\":{\\\"dealer\\\":\\\"S17\\\",\\\"lateSurrender\\\":true,\\\"limits\\\":{\\\"initial\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}}}},\\\"departures\\\":[],\\\"parameters\\\":{},\\\"progress\\\":{\\\"counters\\\":{},\\\"cycleTurn\\\":0,\\\"lastResult\\\":\\\"none\\\",\\\"lists\\\":{}},\\\"status\\\":\\\"active\\\"},\\\"turn\\\":0,\\\"wagers\\\":[{\\\"amount\\\":\\\"50\\\",\\\"target\\\":\\\"hand-1\\\"}]}\",\"facts\":[{\"amount\":\"50\",\"kind\":\"wager-changed\",\"previous\":\"0\",\"target\":\"hand-1\"}],\"receipt\":{\"command\":\"{\\\"amount\\\":\\\"50\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"hand-1\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0}}",
            "body_format": 1,
            "body_length": 6927,
            "body_sha256": "4f7839f7c72d73c99fbb3bcf8ac916dd4f557f6b150b7b652b58f918b91c43d8"
          },
          {
            "activity_id": "blackjack-1",
            "command_id": "record-1",
            "sequence": 1,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"blackjack-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"950\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"blackjack\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"blackjack-six-deck\\\",\\\"version\\\":1},\\\"strategy\\\":{\\\"id\\\":\\\"test-blackjack-counting-schedule\\\",\\\"version\\\":1}},\\\"outcome\\\":null,\\\"phase\\\":\\\"correction\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":0,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"50\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"hand-1\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"assessed\\\",\\\"sequence\\\":1}],\\\"rules\\\":{\\\"dealer\\\":\\\"S17\\\",\\\"decks\\\":6,\\\"lateSurrender\\\":true,\\\"limits\\\":{\\\"initial\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"penetration\\\":75,\\\"players\\\":{\\\"learnerSeat\\\":0,\\\"otherWagers\\\":[],\\\"strategy\\\":null}},\\\"schema\\\":7,\\\"sequence\\\":2,\\\"shoe\\\":null,\\\"strategy\\\":{\\\"coachedTurn\\\":false,\\\"correction\\\":{\\\"actual\\\":[{\\\"amount\\\":\\\"50\\\",\\\"target\\\":\\\"hand-1\\\"}],\\\"explanation\\\":{\\\"fallback\\\":null,\\\"instructions\\\":[{\\\"id\\\":\\\"below-1\\\",\\\"label\\\":\\\"Below +1: 1 unit\\\"}],\\\"prescription\\\":{\\\"bets\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"hand-1\\\"}],\\\"held\\\":[],\\\"status\\\":\\\"prescribed\\\"},\\\"situation\\\":{\\\"available\\\":\\\"1000\\\",\\\"subjects\\\":{\\\"last-result\\\":\\\"none\\\"},\\\"values\\\":{\\\"true-count\\\":\\\"0\\\"}},\\\"state\\\":{\\\"counters\\\":{},\\\"cycleTurn\\\":0,\\\"lastResult\\\":\\\"none\\\",\\\"lists\\\":{}}},\\\"id\\\":\\\"blackjack-1/departure/1\\\",\\\"turn\\\":1},\\\"cycle\\\":{\\\"number\\\":1,\\\"turns\\\":[]},\\\"cycleEnd\\\":null,\\\"decisions\\\":{\\\"betting\\\":0,\\\"playing\\\":0},\\\"deferred\\\":null,\\\"definition\\\":{\\\"adjustments\\\":[],\\\"counters\\\":[],\\\"format\\\":1,\\\"game\\\":\\\"blackjack\\\",\\\"id\\\":\\\"test-blackjack-counting-schedule\\\",\\\"instructions\\\":[{\\\"bets\\\":[{\\\"amount\\\":{\\\"lit\\\":\\\"10\\\"},\\\"target\\\":{\\\"target\\\":\\\"hand-1\\\"}}],\\\"id\\\":\\\"below-1\\\",\\\"label\\\":\\\"Below +1: 1 unit\\\",\\\"priority\\\":0,\\\"when\\\":{\\\"always\\\":true}},{\\\"bets\\\":[{\\\"amount\\\":{\\\"lit\\\":\\\"20\\\"},\\\"target\\\":{\\\"target\\\":\\\"hand-1\\\"}}],\\\"id\\\":\\\"from-1\\\",\\\"label\\\":\\\"+1: 2 units\\\",\\\"priority\\\":1,\\\"when\\\":{\\\"compare\\\":{\\\"value\\\":\\\"true-count\\\"},\\\"op\\\":\\\"ge\\\",\\\"to\\\":{\\\"lit\\\":\\\"1\\\"}}},{\\\"bets\\\":[{\\\"amount\\\":{\\\"lit\\\":\\\"40\\\"},\\\"target\\\":{\\\"target\\\":\\\"hand-1\\\"}}],\\\"id\\\":\\\"from-2\\\",\\\"label\\\":\\\"+2: 4 units\\\",\\\"priority\\\":2,\\\"when\\\":{\\\"compare\\\":{\\\"value\\\":\\\"true-count\\\"},\\\"op\\\":\\\"ge\\\",\\\"to\\\":{\\\"lit\\\":\\\"2\\\"}}},{\\\"bets\\\":[{\\\"amount\\\":{\\\"lit\\\":\\\"60\\\"},\\\"target\\\":{\\\"target\\\":\\\"hand-1\\\"}}],\\\"id\\\":\\\"from-3\\\",\\\"label\\\":\\\"+3: 6 units\\\",\\\"priority\\\":3,\\\"when\\\":{\\\"compare\\\":{\\\"value\\\":\\\"true-count\\\"},\\\"op\\\":\\\"ge\\\",\\\"to\\\":{\\\"lit\\\":\\\"3\\\"}}},{\\\"bets\\\":[{\\\"amount\\\":{\\\"lit\\\":\\\"80\\\"},\\\"target\\\":{\\\"target\\\":\\\"hand-1\\\"}}],\\\"id\\\":\\\"from-4\\\",\\\"label\\\":\\\"+4 or more: 8 units\\\",\\\"priority\\\":4,\\\"when\\\":{\\\"compare\\\":{\\\"value\\\":\\\"true-count\\\"},\\\"op\\\":\\\"ge\\\",\\\"to\\\":{\\\"lit\\\":\\\"4\\\"}}}],\\\"name\\\":\\\"Counting with basic\\\",\\\"parameters\\\":[],\\\"play\\\":{\\\"count\\\":\\\"player\\\",\\\"deviations\\\":[],\\\"fallbacks\\\":{\\\"double\\\":{\\\"hard\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"],\\\"pair\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"SHHHHHSHHS\\\",\\\"SSSSSSSSSS\\\"],\\\"soft\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HSSSSSSSHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"]},\\\"doubleOnOriginalLateSurrender\\\":{\\\"hard\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHR\\\",\\\"RSSSSSHHRR\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"],\\\"pair\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"SHHHHHSHHS\\\",\\\"SSSSSSSSSS\\\"],\\\"soft\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HSSSSSSSHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"]},\\\"splitByBalance\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"RSSSSSHHRR\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"],\\\"splitByRule\\\":[\\\"SSSSSSSSSS\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HDDDDDDDDH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"],\\\"surrender\\\":{\\\"hard\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHDDDDHHHH\\\",\\\"HDDDDDDDDH\\\",\\\"HDDDDDDDDD\\\",\\\"HHHSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"],\\\"pair\\\":[\\\"PPPPPPPPPP\\\",\\\"HPPPPPPHHH\\\",\\\"HPPPPPPHHH\\\",\\\"HHHHPPHHHH\\\",\\\"HDDDDDDDDH\\\",\\\"HPPPPPHHHH\\\",\\\"HPPPPPPHHH\\\",\\\"PPPPPPPPPP\\\",\\\"SPPPPPSPPS\\\",\\\"SSSSSSSSSS\\\"],\\\"soft\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHDDHHHH\\\",\\\"HHHHDDHHHH\\\",\\\"HHHDDDHHHH\\\",\\\"HHHDDDHHHH\\\",\\\"HHDDDDHHHH\\\",\\\"HSDDDDSSHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"]}},\\\"first\\\":{\\\"hard\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHDDDDHHHH\\\",\\\"HDDDDDDDDH\\\",\\\"HDDDDDDDDD\\\",\\\"HHHSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHR\\\",\\\"RSSSSSHHRR\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"],\\\"pair\\\":[\\\"PPPPPPPPPP\\\",\\\"HPPPPPPHHH\\\",\\\"HPPPPPPHHH\\\",\\\"HHHHPPHHHH\\\",\\\"HDDDDDDDDH\\\",\\\"HPPPPPHHHH\\\",\\\"HPPPPPPHHH\\\",\\\"PPPPPPPPPP\\\",\\\"SPPPPPSPPS\\\",\\\"SSSSSSSSSS\\\"],\\\"soft\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHDDHHHH\\\",\\\"HHHHDDHHHH\\\",\\\"HHHDDDHHHH\\\",\\\"HHHDDDHHHH\\\",\\\"HHDDDDHHHH\\\",\\\"HSDDDDSSHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"]},\\\"later\\\":{\\\"hard\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHDDDDHHHH\\\",\\\"HDDDDDDDDH\\\",\\\"HDDDDDDDDD\\\",\\\"HHHSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"],\\\"soft\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHDDHHHH\\\",\\\"HHHHDDHHHH\\\",\\\"HHHDDDHHHH\\\",\\\"HHHDDDHHHH\\\",\\\"HHDDDDHHHH\\\",\\\"HSDDDDSSHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"]},\\\"laterWithoutDouble\\\":{\\\"hard\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"HSSSSSHHHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"],\\\"soft\\\":[\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HHHHHHHHHH\\\",\\\"HSSSSSSSHH\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\",\\\"SSSSSSSSSS\\\"]}},\\\"revision\\\":1,\\\"stopWhen\\\":null,\\\"table\\\":{\\\"dealer\\\":\\\"S17\\\",\\\"lateSurrender\\\":true,\\\"limits\\\":{\\\"initial\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}}}},\\\"departures\\\":[],\\\"parameters\\\":{},\\\"progress\\\":{\\\"counters\\\":{},\\\"cycleTurn\\\":0,\\\"lastResult\\\":\\\"none\\\",\\\"lists\\\":{}},\\\"status\\\":\\\"active\\\"},\\\"turn\\\":0,\\\"wagers\\\":[{\\\"amount\\\":\\\"50\\\",\\\"target\\\":\\\"hand-1\\\"}]}\",\"facts\":[{\"actual\":[{\"amount\":\"50\",\"target\":\"hand-1\"}],\"departureId\":\"blackjack-1/departure/1\",\"explanation\":{\"fallback\":null,\"instructions\":[{\"id\":\"below-1\",\"label\":\"Below +1: 1 unit\"}],\"prescription\":{\"bets\":[{\"amount\":\"10\",\"target\":\"hand-1\"}],\"held\":[],\"status\":\"prescribed\"},\"situation\":{\"available\":\"1000\",\"subjects\":{\"last-result\":\"none\"},\"values\":{\"true-count\":\"0\"}},\"state\":{\"counters\":{},\"cycleTurn\":0,\"lastResult\":\"none\",\"lists\":{}}},\"kind\":\"correction-offered\",\"turn\":1}],\"receipt\":{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"assessed\",\"sequence\":1}}",
            "body_format": 1,
            "body_length": 7917,
            "body_sha256": "a854e1b317432103cdea2e9e5dd821e5cc223a3cc72e62104e02851fa5ff4ae0"
          }
        ],
        "effects": [],
        "outgoing": [],
        "accepted_records": [],
        "device_positions": [],
        "purged_records": [],
        "feed_cursor": [
          {
            "singleton": 1,
            "sequence": 0,
            "synced_at": null
          }
        ],
        "bootstrap": [
          {
            "singleton": 1,
            "installed": 0,
            "body": null,
            "body_format": null,
            "body_length": null,
            "body_sha256": null,
            "staged": 0,
            "after_ordinal": 0
          }
        ],
        "bootstrap_rows": [],
        "history": [
          {
            "singleton": 1,
            "recent": null,
            "download_requested": 0,
            "download_total": null
          }
        ]
      }
    },
    {
      "name": "finished practice",
      "environment": "production",
      "accountId": "recorded-account",
      "installationId": "recorded-installation",
      "unfinished": null,
      "schema": [
        "CREATE TABLE meta (name TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT",
        "CREATE TABLE activities (\n    activity_id TEXT PRIMARY KEY,\n    position INTEGER NOT NULL UNIQUE,\n    status TEXT NOT NULL CHECK (status IN ('unfinished', 'completed', 'incomplete')),\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL\n  ) STRICT",
        "CREATE INDEX activities_unfinished ON activities (status, position)",
        "CREATE TABLE transitions (\n    activity_id TEXT NOT NULL REFERENCES activities (activity_id),\n    command_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    PRIMARY KEY (activity_id, command_id),\n    UNIQUE (activity_id, sequence)\n  ) STRICT",
        "CREATE TABLE effects (\n    activity_id TEXT NOT NULL REFERENCES activities (activity_id),\n    effect_key TEXT NOT NULL,\n    position INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    PRIMARY KEY (activity_id, effect_key)\n  ) STRICT",
        "CREATE TABLE outgoing (\n    id TEXT PRIMARY KEY,\n    activity_id TEXT UNIQUE REFERENCES activities (activity_id),\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    revisioned INTEGER NOT NULL CHECK (revisioned IN (0, 1)),\n    position INTEGER NOT NULL UNIQUE,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    dependencies TEXT NOT NULL,\n    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),\n    operation_id TEXT UNIQUE,\n    request TEXT,\n    request_sha256 TEXT,\n    receipt TEXT,\n    receipt_sequence INTEGER,\n    failures INTEGER NOT NULL DEFAULT 0 CHECK (failures >= 0),\n    flagged INTEGER NOT NULL DEFAULT 0 CHECK (flagged IN (0, 1)),\n    device_position INTEGER\n  ) STRICT",
        "CREATE INDEX outgoing_pending ON outgoing (status, position)",
        "CREATE INDEX outgoing_items ON outgoing (record_type, item_id, position)",
        "CREATE TABLE accepted_records (\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    installation_id TEXT,\n    device_position INTEGER,\n    summary_at INTEGER,\n    PRIMARY KEY (record_type, item_id)\n  ) STRICT",
        "CREATE INDEX accepted_summaries ON accepted_records (summary_at) WHERE summary_at IS NOT NULL",
        "CREATE TABLE device_positions (record_type TEXT PRIMARY KEY, last INTEGER NOT NULL) STRICT",
        "CREATE TABLE purged_records (record_type TEXT NOT NULL, item_id TEXT NOT NULL, PRIMARY KEY (record_type, item_id)) STRICT",
        "CREATE TABLE feed_cursor (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), sequence INTEGER NOT NULL, synced_at INTEGER) STRICT",
        "CREATE TABLE bootstrap (\n    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),\n    installed INTEGER NOT NULL CHECK (installed IN (0, 1)),\n    body TEXT, body_format INTEGER, body_length INTEGER, body_sha256 TEXT,\n    staged INTEGER NOT NULL DEFAULT 0 CHECK (staged >= 0),\n    after_ordinal INTEGER NOT NULL DEFAULT 0 CHECK (after_ordinal >= 0)\n  ) STRICT",
        "CREATE TABLE bootstrap_rows (\n    position INTEGER PRIMARY KEY,\n    record_type TEXT NOT NULL,\n    item_id TEXT NOT NULL,\n    sequence INTEGER NOT NULL,\n    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,\n    installation_id TEXT,\n    device_position INTEGER,\n    summary_at INTEGER\n  ) STRICT",
        "CREATE TABLE history (\n    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),\n    recent INTEGER CHECK (recent >= 0),\n    download_requested INTEGER NOT NULL CHECK (download_requested IN (0, 1)),\n    download_total INTEGER CHECK (download_total >= 0)\n  ) STRICT"
      ],
      "rows": {
        "meta": [
          {
            "name": "environment",
            "value": "production"
          },
          {
            "name": "account_id",
            "value": "recorded-account"
          },
          {
            "name": "installation_id",
            "value": "recorded-installation"
          },
          {
            "name": "schema_version",
            "value": "1"
          }
        ],
        "activities": [
          {
            "activity_id": "completed-1",
            "position": 1,
            "status": "completed",
            "sequence": 6,
            "body": "{\"activityId\":\"completed-1\",\"admission\":{\"meteringBasis\":\"free-play\",\"provenance\":\"recorded\"},\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"completed-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"1010\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"10\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":{\\\"pocket\\\":27,\\\"turn\\\":1},\\\"phase\\\":\\\"completed\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":1,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"settle-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-2\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":2},{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"even\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-3\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":3},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"request-stop\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-4\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":4},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"advance-final-settlement\\\\\\\"}\\\",\\\"commandId\\\":\\\"continue-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":5}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":6,\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[]}\",\"completion\":{\"activityId\":\"completed-1\",\"allowancePolicyVersion\":null,\"betSchedule\":null,\"blackjackMode\":null,\"buyIn\":\"1000\",\"cumulativeFunding\":\"1000\",\"device\":\"recorded-installation\",\"endedAt\":1790000600000,\"endingReason\":\"stop\",\"finalCashOut\":\"1010\",\"fundingSource\":\"practice-funding\",\"game\":\"roulette\",\"guidance\":null,\"identities\":{\"engine\":\"0.0.0\",\"randomProtocol\":1,\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"version\":1},\"strategy\":null},\"maxDrawdown\":\"0\",\"meteringBasis\":\"free-play\",\"mode\":\"free-play\",\"netResult\":\"10\",\"noBet\":false,\"outcomes\":[{\"net\":\"10\",\"result\":\"win\",\"returned\":\"20\",\"stake\":\"10\",\"target\":\"red\",\"turn\":1},{\"net\":\"0\",\"result\":\"returned\",\"returned\":\"10\",\"stake\":\"10\",\"target\":\"even\",\"turn\":1}],\"overrideAffected\":false,\"owner\":\"recorded-account\",\"rebuys\":[],\"recordVersion\":1,\"rules\":{\"content\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheel\":\"single-zero\"},\"id\":\"roulette-single-zero\",\"version\":1},\"startedAt\":1790000000000,\"strategy\":null,\"turnsPlayed\":1,\"wagers\":{\"losses\":0,\"pushes\":0,\"resolved\":1,\"wins\":1}},\"createdAt\":1790000000000,\"incomplete\":null,\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"sequence\":6,\"specification\":{\"activityId\":\"completed-1\",\"device\":\"recorded-installation\",\"funding\":\"1000\",\"fundingSource\":\"practice-funding\",\"game\":\"roulette\",\"owner\":\"recorded-account\",\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"version\":1,\"wheel\":\"single-zero\"},\"strategy\":null}}",
            "body_format": 1,
            "body_length": 3484,
            "body_sha256": "1c2628d0b3dd03636d5241f562b311f7954eeefa6b1f491537bce328af902f9e"
          },
          {
            "activity_id": "completed-2",
            "position": 2,
            "status": "completed",
            "sequence": 6,
            "body": "{\"activityId\":\"completed-2\",\"admission\":{\"meteringBasis\":\"free-play\",\"provenance\":\"recorded\"},\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"completed-2\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"1010\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"10\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":{\\\"pocket\\\":27,\\\"turn\\\":1},\\\"phase\\\":\\\"completed\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":1,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"settle-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-2\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":2},{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"even\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-3\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":3},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"request-stop\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-4\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":4},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"advance-final-settlement\\\\\\\"}\\\",\\\"commandId\\\":\\\"continue-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":5}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":6,\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[]}\",\"completion\":{\"activityId\":\"completed-2\",\"allowancePolicyVersion\":null,\"betSchedule\":null,\"blackjackMode\":null,\"buyIn\":\"1000\",\"cumulativeFunding\":\"1000\",\"device\":\"recorded-installation\",\"endedAt\":1790000900000,\"endingReason\":\"stop\",\"finalCashOut\":\"1010\",\"fundingSource\":\"practice-funding\",\"game\":\"roulette\",\"guidance\":null,\"identities\":{\"engine\":\"0.0.0\",\"randomProtocol\":1,\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"version\":1},\"strategy\":null},\"maxDrawdown\":\"0\",\"meteringBasis\":\"free-play\",\"mode\":\"free-play\",\"netResult\":\"10\",\"noBet\":false,\"outcomes\":[{\"net\":\"10\",\"result\":\"win\",\"returned\":\"20\",\"stake\":\"10\",\"target\":\"red\",\"turn\":1},{\"net\":\"0\",\"result\":\"returned\",\"returned\":\"10\",\"stake\":\"10\",\"target\":\"even\",\"turn\":1}],\"overrideAffected\":false,\"owner\":\"recorded-account\",\"rebuys\":[],\"recordVersion\":1,\"rules\":{\"content\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheel\":\"single-zero\"},\"id\":\"roulette-single-zero\",\"version\":1},\"startedAt\":1790000700000,\"strategy\":null,\"turnsPlayed\":1,\"wagers\":{\"losses\":0,\"pushes\":0,\"resolved\":1,\"wins\":1}},\"createdAt\":1790000000000,\"incomplete\":null,\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"sequence\":6,\"specification\":{\"activityId\":\"completed-2\",\"device\":\"recorded-installation\",\"funding\":\"1000\",\"fundingSource\":\"practice-funding\",\"game\":\"roulette\",\"owner\":\"recorded-account\",\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"version\":1,\"wheel\":\"single-zero\"},\"strategy\":null}}",
            "body_format": 1,
            "body_length": 3484,
            "body_sha256": "1652361d2fd9ce0c408979288c30ee8ec2cd31aba2326317f8e0f5bf17767e49"
          },
          {
            "activity_id": "incomplete-1",
            "position": 3,
            "status": "incomplete",
            "sequence": 5,
            "body": "{\"activityId\":\"incomplete-1\",\"admission\":{\"meteringBasis\":\"free-play\",\"provenance\":\"recorded\"},\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"incomplete-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"1010\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"10\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":{\\\"pocket\\\":27,\\\"turn\\\":1},\\\"phase\\\":\\\"final-settlement\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":1,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"settle-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-2\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":2},{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"even\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-3\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":3},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"request-stop\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-4\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":4}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":5,\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[]}\",\"completion\":null,\"createdAt\":1790000000000,\"incomplete\":{\"detail\":\"recorded: an unreadable checkpoint\",\"kind\":\"damaged\"},\"random\":{\"key\":[2752067618,698298832],\"protocol\":1,\"session\":[320440878,57701188]},\"sequence\":5,\"specification\":{\"activityId\":\"incomplete-1\",\"device\":\"recorded-installation\",\"funding\":\"1000\",\"fundingSource\":\"practice-funding\",\"game\":\"roulette\",\"owner\":\"recorded-account\",\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"version\":1,\"wheel\":\"single-zero\"},\"strategy\":null}}",
            "body_format": 1,
            "body_length": 2341,
            "body_sha256": "897803955d1988639ae3c0be7694577e6cb2001a55747cfd7dc6693c5074ce09"
          }
        ],
        "transitions": [
          {
            "activity_id": "completed-1",
            "command_id": "record-0",
            "sequence": 0,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"completed-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"990\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":null,\\\"phase\\\":\\\"open-decision\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":0,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":1,\\\"strategy\\\":null,\\\"turn\\\":0,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"red\\\"}]}\",\"facts\":[{\"amount\":\"10\",\"kind\":\"wager-changed\",\"previous\":\"0\",\"target\":\"red\"}],\"receipt\":{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"red\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0}}",
            "body_format": 1,
            "body_length": 1358,
            "body_sha256": "efeec198139d13e9a6fd1b01b01d0e869720ead858a4654c33c3affe8ea56984"
          },
          {
            "activity_id": "completed-1",
            "command_id": "record-1",
            "sequence": 1,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"completed-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"990\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":{\\\"pocket\\\":27,\\\"turn\\\":1},\\\"phase\\\":\\\"revealing-outcome\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":1,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":2,\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"red\\\"}]}\",\"facts\":[{\"kind\":\"turn-began\",\"turn\":1,\"wagers\":[{\"amount\":\"10\",\"target\":\"red\"}]},{\"kind\":\"outcome-generated\",\"pocket\":27,\"turn\":1}],\"receipt\":{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1}}",
            "body_format": 1,
            "body_length": 1522,
            "body_sha256": "15eb5e998bea1395d273c2a3ef8abeaf1291c812383c691f22d2572ab8a23abb"
          },
          {
            "activity_id": "completed-1",
            "command_id": "record-2",
            "sequence": 2,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"completed-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"1010\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"10\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":{\\\"pocket\\\":27,\\\"turn\\\":1},\\\"phase\\\":\\\"settled-outcome\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":1,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"settle-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-2\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":2}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":3,\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[]}\",\"facts\":[{\"kind\":\"wager-settled\",\"net\":\"10\",\"result\":\"win\",\"returned\":\"20\",\"stake\":\"10\",\"target\":\"red\",\"turn\":1}],\"receipt\":{\"command\":\"{\\\"kind\\\":\\\"settle-turn\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2}}",
            "body_format": 1,
            "body_length": 1589,
            "body_sha256": "d05388d1dd10f39086b509e6696a9e5df60c21354b8d70dc3dc2589cb1f771ad"
          },
          {
            "activity_id": "completed-1",
            "command_id": "record-3",
            "sequence": 3,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"completed-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"1000\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"10\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":{\\\"pocket\\\":27,\\\"turn\\\":1},\\\"phase\\\":\\\"open-decision\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":1,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"settle-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-2\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":2},{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"even\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-3\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":3}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":4,\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"even\\\"}]}\",\"facts\":[{\"amount\":\"10\",\"kind\":\"wager-changed\",\"previous\":\"0\",\"target\":\"even\"}],\"receipt\":{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"even\\\"}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3}}",
            "body_format": 1,
            "body_length": 1807,
            "body_sha256": "bb5cb70f9de3124a57054230fa871d13725da6545c57feb5fd4744dabbafff7c"
          },
          {
            "activity_id": "completed-1",
            "command_id": "record-4",
            "sequence": 4,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"completed-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"1010\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"10\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":{\\\"pocket\\\":27,\\\"turn\\\":1},\\\"phase\\\":\\\"final-settlement\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":1,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"settle-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-2\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":2},{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"even\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-3\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":3},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"request-stop\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-4\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":4}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":5,\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[]}\",\"facts\":[{\"kind\":\"stop-requested\",\"phase\":\"open-decision\"},{\"amount\":\"10\",\"kind\":\"wager-returned\",\"target\":\"even\"}],\"receipt\":{\"command\":\"{\\\"kind\\\":\\\"request-stop\\\"}\",\"commandId\":\"record-4\",\"disposition\":\"applied\",\"sequence\":4}}",
            "body_format": 1,
            "body_length": 1894,
            "body_sha256": "2ae29dd9c66d008f8b3e1049b59b1888f444baef19f65098324f1dea9c2e4e81"
          },
          {
            "activity_id": "completed-1",
            "command_id": "continue-0",
            "sequence": 5,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"completed-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"1010\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"10\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":{\\\"pocket\\\":27,\\\"turn\\\":1},\\\"phase\\\":\\\"completed\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":1,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"settle-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-2\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":2},{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"even\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-3\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":3},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"request-stop\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-4\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":4},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"advance-final-settlement\\\\\\\"}\\\",\\\"commandId\\\":\\\"continue-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":5}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":6,\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[]}\",\"facts\":[{\"balance\":\"1010\",\"kind\":\"activity-completed\"}],\"receipt\":{\"command\":\"{\\\"kind\\\":\\\"advance-final-settlement\\\"}\",\"commandId\":\"continue-0\",\"disposition\":\"applied\",\"sequence\":5}}",
            "body_format": 1,
            "body_length": 1980,
            "body_sha256": "ce99b87f61326e32acafb849b28fc74e9a398997f5aefc1a1e51bc57d2f53624"
          },
          {
            "activity_id": "completed-2",
            "command_id": "record-0",
            "sequence": 0,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"completed-2\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"990\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":null,\\\"phase\\\":\\\"open-decision\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":0,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":1,\\\"strategy\\\":null,\\\"turn\\\":0,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"red\\\"}]}\",\"facts\":[{\"amount\":\"10\",\"kind\":\"wager-changed\",\"previous\":\"0\",\"target\":\"red\"}],\"receipt\":{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"red\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0}}",
            "body_format": 1,
            "body_length": 1358,
            "body_sha256": "7c4aebfed7ed950be78353c792ac10fb2e857bc698bb2a041b9fd8a3ab1ade44"
          },
          {
            "activity_id": "completed-2",
            "command_id": "record-1",
            "sequence": 1,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"completed-2\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"990\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":{\\\"pocket\\\":27,\\\"turn\\\":1},\\\"phase\\\":\\\"revealing-outcome\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":1,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":2,\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"red\\\"}]}\",\"facts\":[{\"kind\":\"turn-began\",\"turn\":1,\"wagers\":[{\"amount\":\"10\",\"target\":\"red\"}]},{\"kind\":\"outcome-generated\",\"pocket\":27,\"turn\":1}],\"receipt\":{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1}}",
            "body_format": 1,
            "body_length": 1522,
            "body_sha256": "18b047626f3f69a2df39a0bfeec62956b2b998191484319d06b79180907c4f19"
          },
          {
            "activity_id": "completed-2",
            "command_id": "record-2",
            "sequence": 2,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"completed-2\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"1010\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"10\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":{\\\"pocket\\\":27,\\\"turn\\\":1},\\\"phase\\\":\\\"settled-outcome\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":1,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"settle-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-2\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":2}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":3,\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[]}\",\"facts\":[{\"kind\":\"wager-settled\",\"net\":\"10\",\"result\":\"win\",\"returned\":\"20\",\"stake\":\"10\",\"target\":\"red\",\"turn\":1}],\"receipt\":{\"command\":\"{\\\"kind\\\":\\\"settle-turn\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2}}",
            "body_format": 1,
            "body_length": 1589,
            "body_sha256": "7280de810bbf990b539e22e49867838ca031043d13281fe7599a0a59490d82c2"
          },
          {
            "activity_id": "completed-2",
            "command_id": "record-3",
            "sequence": 3,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"completed-2\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"1000\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"10\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":{\\\"pocket\\\":27,\\\"turn\\\":1},\\\"phase\\\":\\\"open-decision\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":1,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"settle-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-2\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":2},{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"even\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-3\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":3}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":4,\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"even\\\"}]}\",\"facts\":[{\"amount\":\"10\",\"kind\":\"wager-changed\",\"previous\":\"0\",\"target\":\"even\"}],\"receipt\":{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"even\\\"}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3}}",
            "body_format": 1,
            "body_length": 1807,
            "body_sha256": "9034e1ba829c7c47b8c80e6a64e17affa7d027beb4f4efb4082ac4940fdb748e"
          },
          {
            "activity_id": "completed-2",
            "command_id": "record-4",
            "sequence": 4,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"completed-2\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"1010\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"10\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":{\\\"pocket\\\":27,\\\"turn\\\":1},\\\"phase\\\":\\\"final-settlement\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":1,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"settle-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-2\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":2},{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"even\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-3\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":3},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"request-stop\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-4\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":4}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":5,\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[]}\",\"facts\":[{\"kind\":\"stop-requested\",\"phase\":\"open-decision\"},{\"amount\":\"10\",\"kind\":\"wager-returned\",\"target\":\"even\"}],\"receipt\":{\"command\":\"{\\\"kind\\\":\\\"request-stop\\\"}\",\"commandId\":\"record-4\",\"disposition\":\"applied\",\"sequence\":4}}",
            "body_format": 1,
            "body_length": 1894,
            "body_sha256": "4a845084c7cf9640f589a55de79b619e6f06bf1d988a234c06e641ec5254e6b1"
          },
          {
            "activity_id": "completed-2",
            "command_id": "continue-0",
            "sequence": 5,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"completed-2\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"1010\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"10\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":{\\\"pocket\\\":27,\\\"turn\\\":1},\\\"phase\\\":\\\"completed\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":1,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"settle-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-2\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":2},{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"even\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-3\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":3},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"request-stop\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-4\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":4},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"advance-final-settlement\\\\\\\"}\\\",\\\"commandId\\\":\\\"continue-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":5}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":6,\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[]}\",\"facts\":[{\"balance\":\"1010\",\"kind\":\"activity-completed\"}],\"receipt\":{\"command\":\"{\\\"kind\\\":\\\"advance-final-settlement\\\"}\",\"commandId\":\"continue-0\",\"disposition\":\"applied\",\"sequence\":5}}",
            "body_format": 1,
            "body_length": 1980,
            "body_sha256": "07a501f89485ca251a76ca94914082279becfa3be858288c7f2266d857ec8c45"
          },
          {
            "activity_id": "incomplete-1",
            "command_id": "record-0",
            "sequence": 0,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"incomplete-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"990\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":null,\\\"phase\\\":\\\"open-decision\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":0,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":1,\\\"strategy\\\":null,\\\"turn\\\":0,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"red\\\"}]}\",\"facts\":[{\"amount\":\"10\",\"kind\":\"wager-changed\",\"previous\":\"0\",\"target\":\"red\"}],\"receipt\":{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"red\\\"}\",\"commandId\":\"record-0\",\"disposition\":\"applied\",\"sequence\":0}}",
            "body_format": 1,
            "body_length": 1359,
            "body_sha256": "d4d876b5679a260711697827e0050f3b0463f5b17c301313fb98f717b17e1a3d"
          },
          {
            "activity_id": "incomplete-1",
            "command_id": "record-1",
            "sequence": 1,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"incomplete-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"990\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"0\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":{\\\"pocket\\\":27,\\\"turn\\\":1},\\\"phase\\\":\\\"revealing-outcome\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":1,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":2,\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"red\\\"}]}\",\"facts\":[{\"kind\":\"turn-began\",\"turn\":1,\"wagers\":[{\"amount\":\"10\",\"target\":\"red\"}]},{\"kind\":\"outcome-generated\",\"pocket\":27,\"turn\":1}],\"receipt\":{\"command\":\"{\\\"kind\\\":\\\"begin-turn\\\"}\",\"commandId\":\"record-1\",\"disposition\":\"applied\",\"sequence\":1}}",
            "body_format": 1,
            "body_length": 1523,
            "body_sha256": "f543e7d10af9160d496fac260c217e367afc7f1fb50a7503b23b705f85e57751"
          },
          {
            "activity_id": "incomplete-1",
            "command_id": "record-2",
            "sequence": 2,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"incomplete-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"1010\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"10\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":{\\\"pocket\\\":27,\\\"turn\\\":1},\\\"phase\\\":\\\"settled-outcome\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":1,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"settle-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-2\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":2}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":3,\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[]}\",\"facts\":[{\"kind\":\"wager-settled\",\"net\":\"10\",\"result\":\"win\",\"returned\":\"20\",\"stake\":\"10\",\"target\":\"red\",\"turn\":1}],\"receipt\":{\"command\":\"{\\\"kind\\\":\\\"settle-turn\\\"}\",\"commandId\":\"record-2\",\"disposition\":\"applied\",\"sequence\":2}}",
            "body_format": 1,
            "body_length": 1590,
            "body_sha256": "c2d6096c75726302bd8e9f4b8df693733b375c31070211669f45301d10ab1e23"
          },
          {
            "activity_id": "incomplete-1",
            "command_id": "record-3",
            "sequence": 3,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"incomplete-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"1000\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"10\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":{\\\"pocket\\\":27,\\\"turn\\\":1},\\\"phase\\\":\\\"open-decision\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":1,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"settle-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-2\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":2},{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"even\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-3\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":3}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":4,\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[{\\\"amount\\\":\\\"10\\\",\\\"target\\\":\\\"even\\\"}]}\",\"facts\":[{\"amount\":\"10\",\"kind\":\"wager-changed\",\"previous\":\"0\",\"target\":\"even\"}],\"receipt\":{\"command\":\"{\\\"amount\\\":\\\"10\\\",\\\"kind\\\":\\\"place-wager\\\",\\\"target\\\":\\\"even\\\"}\",\"commandId\":\"record-3\",\"disposition\":\"applied\",\"sequence\":3}}",
            "body_format": 1,
            "body_length": 1808,
            "body_sha256": "8efa5b40fa6a82820a2ff8c23510a7184bb8b0c0834f991565b03845213c3339"
          },
          {
            "activity_id": "incomplete-1",
            "command_id": "record-4",
            "sequence": 4,
            "body": "{\"checkpoint\":\"{\\\"activity\\\":{\\\"device\\\":\\\"recorded-installation\\\",\\\"id\\\":\\\"incomplete-1\\\",\\\"owner\\\":\\\"recorded-account\\\"},\\\"balance\\\":\\\"1010\\\",\\\"funding\\\":{\\\"buyIn\\\":\\\"1000\\\",\\\"maxDrawdown\\\":\\\"0\\\",\\\"peak\\\":\\\"10\\\",\\\"rebuys\\\":[],\\\"source\\\":\\\"practice-funding\\\"},\\\"identities\\\":{\\\"engine\\\":\\\"0.0.0\\\",\\\"game\\\":\\\"roulette\\\",\\\"random\\\":{\\\"key\\\":[2752067618,698298832],\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"reference\\\":null,\\\"rules\\\":{\\\"id\\\":\\\"roulette-single-zero\\\",\\\"version\\\":1},\\\"strategy\\\":null},\\\"outcome\\\":{\\\"pocket\\\":27,\\\"turn\\\":1},\\\"phase\\\":\\\"final-settlement\\\",\\\"random\\\":{\\\"block\\\":[0,0],\\\"exhausted\\\":false,\\\"key\\\":[2752067618,698298832],\\\"lane\\\":1,\\\"protocol\\\":1,\\\"session\\\":[320440878,57701188]},\\\"receipts\\\":[{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"red\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-0\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":0},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"begin-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-1\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":1},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"settle-turn\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-2\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":2},{\\\"command\\\":\\\"{\\\\\\\"amount\\\\\\\":\\\\\\\"10\\\\\\\",\\\\\\\"kind\\\\\\\":\\\\\\\"place-wager\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"even\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-3\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":3},{\\\"command\\\":\\\"{\\\\\\\"kind\\\\\\\":\\\\\\\"request-stop\\\\\\\"}\\\",\\\"commandId\\\":\\\"record-4\\\",\\\"disposition\\\":\\\"applied\\\",\\\"sequence\\\":4}],\\\"rules\\\":{\\\"limits\\\":{\\\"inside\\\":{\\\"max\\\":\\\"100\\\",\\\"min\\\":\\\"1\\\"},\\\"outside\\\":{\\\"max\\\":\\\"1000\\\",\\\"min\\\":\\\"10\\\"}},\\\"wheel\\\":\\\"single-zero\\\"},\\\"schema\\\":7,\\\"sequence\\\":5,\\\"strategy\\\":null,\\\"turn\\\":1,\\\"wagers\\\":[]}\",\"facts\":[{\"kind\":\"stop-requested\",\"phase\":\"open-decision\"},{\"amount\":\"10\",\"kind\":\"wager-returned\",\"target\":\"even\"}],\"receipt\":{\"command\":\"{\\\"kind\\\":\\\"request-stop\\\"}\",\"commandId\":\"record-4\",\"disposition\":\"applied\",\"sequence\":4}}",
            "body_format": 1,
            "body_length": 1895,
            "body_sha256": "06656972bd6f68148ca9cfd62f3185d123d888dd05c02a38d9dd692684931dbf"
          }
        ],
        "effects": [
          {
            "activity_id": "completed-1",
            "effect_key": "[\"recorded-grant\",\"completed-1\",1]",
            "position": 1,
            "body": "{\"amount\":\"1\",\"effectId\":{\"activity\":\"completed-1\",\"grant\":\"recorded-grant\",\"sequence\":1},\"kind\":\"turn-charge\"}",
            "body_format": 1,
            "body_length": 111,
            "body_sha256": "12e9e318a450b54a024eddd7a042dc1aac19406d6994a21350ae33042bef2de6"
          }
        ],
        "outgoing": [
          {
            "id": "completed/completed-1",
            "activity_id": "completed-1",
            "record_type": "completed-practice-session",
            "item_id": "completed-1",
            "revisioned": 0,
            "position": 1,
            "body": "{\"id\":\"completed/completed-1\",\"kind\":\"completed-practice-session\",\"record\":{\"activityId\":\"completed-1\",\"allowancePolicyVersion\":null,\"betSchedule\":null,\"blackjackMode\":null,\"buyIn\":\"1000\",\"cumulativeFunding\":\"1000\",\"device\":\"recorded-installation\",\"endedAt\":1790000600000,\"endingReason\":\"stop\",\"finalCashOut\":\"1010\",\"fundingSource\":\"practice-funding\",\"game\":\"roulette\",\"guidance\":null,\"identities\":{\"engine\":\"0.0.0\",\"randomProtocol\":1,\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"version\":1},\"strategy\":null},\"maxDrawdown\":\"0\",\"meteringBasis\":\"free-play\",\"mode\":\"free-play\",\"netResult\":\"10\",\"noBet\":false,\"outcomes\":[{\"net\":\"10\",\"result\":\"win\",\"returned\":\"20\",\"stake\":\"10\",\"target\":\"red\",\"turn\":1},{\"net\":\"0\",\"result\":\"returned\",\"returned\":\"10\",\"stake\":\"10\",\"target\":\"even\",\"turn\":1}],\"overrideAffected\":false,\"owner\":\"recorded-account\",\"rebuys\":[],\"recordVersion\":1,\"rules\":{\"content\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheel\":\"single-zero\"},\"id\":\"roulette-single-zero\",\"version\":1},\"startedAt\":1790000000000,\"strategy\":null,\"turnsPlayed\":1,\"wagers\":{\"losses\":0,\"pushes\":0,\"resolved\":1,\"wins\":1}}}",
            "body_format": 1,
            "body_length": 1155,
            "body_sha256": "aefc2a662eb45d8a327f2855951d53715dc0f616477d3a83d87310c8c5bb6c52",
            "dependencies": "[]",
            "status": "accepted",
            "operation_id": "11111111111111111111111111111111",
            "request": "{\"installation\":\"recorded-installation\",\"item\":\"completed-1\",\"operation\":\"11111111111111111111111111111111\",\"payload\":{\"activityId\":\"completed-1\",\"allowancePolicyVersion\":null,\"betSchedule\":null,\"blackjackMode\":null,\"buyIn\":\"1000\",\"cumulativeFunding\":\"1000\",\"device\":\"recorded-installation\",\"endedAt\":1790000600000,\"endingReason\":\"stop\",\"finalCashOut\":\"1010\",\"fundingSource\":\"practice-funding\",\"game\":\"roulette\",\"guidance\":null,\"identities\":{\"engine\":\"0.0.0\",\"randomProtocol\":1,\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"version\":1},\"strategy\":null},\"maxDrawdown\":\"0\",\"meteringBasis\":\"free-play\",\"mode\":\"free-play\",\"netResult\":\"10\",\"noBet\":false,\"outcomes\":[{\"net\":\"10\",\"result\":\"win\",\"returned\":\"20\",\"stake\":\"10\",\"target\":\"red\",\"turn\":1},{\"net\":\"0\",\"result\":\"returned\",\"returned\":\"10\",\"stake\":\"10\",\"target\":\"even\",\"turn\":1}],\"overrideAffected\":false,\"owner\":\"recorded-account\",\"rebuys\":[],\"recordVersion\":1,\"rules\":{\"content\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheel\":\"single-zero\"},\"id\":\"roulette-single-zero\",\"version\":1},\"startedAt\":1790000000000,\"strategy\":null,\"turnsPlayed\":1,\"wagers\":{\"losses\":0,\"pushes\":0,\"resolved\":1,\"wins\":1}},\"payloadVersion\":1,\"protocol\":1,\"recordType\":\"completed-practice-session\"}",
            "request_sha256": "1ffe3ff5d062ce8843d92e1dedea74b56c26b59da7749b8880de3efdc6e37d47",
            "receipt": "{\"operation\":\"11111111111111111111111111111111\",\"requestHash\":\"1ffe3ff5d062ce8843d92e1dedea74b56c26b59da7749b8880de3efdc6e37d47\",\"sequence\":1,\"status\":\"accepted\"}",
            "receipt_sequence": 1,
            "failures": 0,
            "flagged": 0,
            "device_position": null
          },
          {
            "id": "completed/completed-2",
            "activity_id": "completed-2",
            "record_type": "completed-practice-session",
            "item_id": "completed-2",
            "revisioned": 0,
            "position": 2,
            "body": "{\"id\":\"completed/completed-2\",\"kind\":\"completed-practice-session\",\"record\":{\"activityId\":\"completed-2\",\"allowancePolicyVersion\":null,\"betSchedule\":null,\"blackjackMode\":null,\"buyIn\":\"1000\",\"cumulativeFunding\":\"1000\",\"device\":\"recorded-installation\",\"endedAt\":1790000900000,\"endingReason\":\"stop\",\"finalCashOut\":\"1010\",\"fundingSource\":\"practice-funding\",\"game\":\"roulette\",\"guidance\":null,\"identities\":{\"engine\":\"0.0.0\",\"randomProtocol\":1,\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"version\":1},\"strategy\":null},\"maxDrawdown\":\"0\",\"meteringBasis\":\"free-play\",\"mode\":\"free-play\",\"netResult\":\"10\",\"noBet\":false,\"outcomes\":[{\"net\":\"10\",\"result\":\"win\",\"returned\":\"20\",\"stake\":\"10\",\"target\":\"red\",\"turn\":1},{\"net\":\"0\",\"result\":\"returned\",\"returned\":\"10\",\"stake\":\"10\",\"target\":\"even\",\"turn\":1}],\"overrideAffected\":false,\"owner\":\"recorded-account\",\"rebuys\":[],\"recordVersion\":1,\"rules\":{\"content\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheel\":\"single-zero\"},\"id\":\"roulette-single-zero\",\"version\":1},\"startedAt\":1790000700000,\"strategy\":null,\"turnsPlayed\":1,\"wagers\":{\"losses\":0,\"pushes\":0,\"resolved\":1,\"wins\":1}}}",
            "body_format": 1,
            "body_length": 1155,
            "body_sha256": "30a835d7d62e360f23924a88995033a60161cffc066b57cf61f0a2c352efc775",
            "dependencies": "[]",
            "status": "pending",
            "operation_id": "22222222222222222222222222222222",
            "request": "{\"installation\":\"recorded-installation\",\"item\":\"completed-2\",\"operation\":\"22222222222222222222222222222222\",\"payload\":{\"activityId\":\"completed-2\",\"allowancePolicyVersion\":null,\"betSchedule\":null,\"blackjackMode\":null,\"buyIn\":\"1000\",\"cumulativeFunding\":\"1000\",\"device\":\"recorded-installation\",\"endedAt\":1790000900000,\"endingReason\":\"stop\",\"finalCashOut\":\"1010\",\"fundingSource\":\"practice-funding\",\"game\":\"roulette\",\"guidance\":null,\"identities\":{\"engine\":\"0.0.0\",\"randomProtocol\":1,\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"version\":1},\"strategy\":null},\"maxDrawdown\":\"0\",\"meteringBasis\":\"free-play\",\"mode\":\"free-play\",\"netResult\":\"10\",\"noBet\":false,\"outcomes\":[{\"net\":\"10\",\"result\":\"win\",\"returned\":\"20\",\"stake\":\"10\",\"target\":\"red\",\"turn\":1},{\"net\":\"0\",\"result\":\"returned\",\"returned\":\"10\",\"stake\":\"10\",\"target\":\"even\",\"turn\":1}],\"overrideAffected\":false,\"owner\":\"recorded-account\",\"rebuys\":[],\"recordVersion\":1,\"rules\":{\"content\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheel\":\"single-zero\"},\"id\":\"roulette-single-zero\",\"version\":1},\"startedAt\":1790000700000,\"strategy\":null,\"turnsPlayed\":1,\"wagers\":{\"losses\":0,\"pushes\":0,\"resolved\":1,\"wins\":1}},\"payloadVersion\":1,\"protocol\":1,\"recordType\":\"completed-practice-session\"}",
            "request_sha256": "84780d6f6df764fb05d45f8eb9a51914f958155b4a49878e92b49f9a58c5e437",
            "receipt": null,
            "receipt_sequence": null,
            "failures": 0,
            "flagged": 0,
            "device_position": null
          }
        ],
        "accepted_records": [
          {
            "record_type": "completed-practice-session",
            "item_id": "completed-1",
            "sequence": 1,
            "body": "{\"activityId\":\"completed-1\",\"allowancePolicyVersion\":null,\"betSchedule\":null,\"blackjackMode\":null,\"buyIn\":\"1000\",\"cumulativeFunding\":\"1000\",\"device\":\"recorded-installation\",\"endedAt\":1790000600000,\"endingReason\":\"stop\",\"finalCashOut\":\"1010\",\"fundingSource\":\"practice-funding\",\"game\":\"roulette\",\"guidance\":null,\"identities\":{\"engine\":\"0.0.0\",\"randomProtocol\":1,\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"version\":1},\"strategy\":null},\"maxDrawdown\":\"0\",\"meteringBasis\":\"free-play\",\"mode\":\"free-play\",\"netResult\":\"10\",\"noBet\":false,\"outcomes\":[{\"net\":\"10\",\"result\":\"win\",\"returned\":\"20\",\"stake\":\"10\",\"target\":\"red\",\"turn\":1},{\"net\":\"0\",\"result\":\"returned\",\"returned\":\"10\",\"stake\":\"10\",\"target\":\"even\",\"turn\":1}],\"overrideAffected\":false,\"owner\":\"recorded-account\",\"rebuys\":[],\"recordVersion\":1,\"rules\":{\"content\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheel\":\"single-zero\"},\"id\":\"roulette-single-zero\",\"version\":1},\"startedAt\":1790000000000,\"strategy\":null,\"turnsPlayed\":1,\"wagers\":{\"losses\":0,\"pushes\":0,\"resolved\":1,\"wins\":1}}",
            "body_format": 1,
            "body_length": 1079,
            "body_sha256": "61f27f26ac647df0ba6e1c58be38450fd00404c58638c0634fd3142481d3482e",
            "installation_id": null,
            "device_position": null,
            "summary_at": null
          },
          {
            "record_type": "completed-practice-session",
            "item_id": "elsewhere-1",
            "sequence": 2,
            "body": "{\"activityId\":\"elsewhere-1\",\"allowancePolicyVersion\":null,\"betSchedule\":null,\"blackjackMode\":null,\"buyIn\":\"1000\",\"cumulativeFunding\":\"1000\",\"device\":\"recorded-other-installation\",\"endedAt\":1790000600000,\"endingReason\":\"stop\",\"finalCashOut\":\"1010\",\"fundingSource\":\"practice-funding\",\"game\":\"roulette\",\"guidance\":null,\"identities\":{\"engine\":\"0.0.0\",\"randomProtocol\":1,\"reference\":null,\"rules\":{\"id\":\"roulette-single-zero\",\"version\":1},\"strategy\":null},\"maxDrawdown\":\"0\",\"meteringBasis\":\"free-play\",\"mode\":\"free-play\",\"netResult\":\"10\",\"noBet\":false,\"outcomes\":[{\"net\":\"10\",\"result\":\"win\",\"returned\":\"20\",\"stake\":\"10\",\"target\":\"red\",\"turn\":1},{\"net\":\"0\",\"result\":\"returned\",\"returned\":\"10\",\"stake\":\"10\",\"target\":\"even\",\"turn\":1}],\"overrideAffected\":false,\"owner\":\"recorded-account\",\"rebuys\":[],\"recordVersion\":1,\"rules\":{\"content\":{\"limits\":{\"inside\":{\"max\":\"100\",\"min\":\"1\"},\"outside\":{\"max\":\"1000\",\"min\":\"10\"}},\"wheel\":\"single-zero\"},\"id\":\"roulette-single-zero\",\"version\":1},\"startedAt\":1790000000000,\"strategy\":null,\"turnsPlayed\":1,\"wagers\":{\"losses\":0,\"pushes\":0,\"resolved\":1,\"wins\":1}}",
            "body_format": 1,
            "body_length": 1085,
            "body_sha256": "cf6f92f8d5f50c66d84c4c2f1af1a0fa79b65336dda20315d43c14f4325a97c8",
            "installation_id": null,
            "device_position": null,
            "summary_at": null
          }
        ],
        "device_positions": [],
        "purged_records": [],
        "feed_cursor": [
          {
            "singleton": 1,
            "sequence": 2,
            "synced_at": null
          }
        ],
        "bootstrap": [
          {
            "singleton": 1,
            "installed": 0,
            "body": null,
            "body_format": null,
            "body_length": null,
            "body_sha256": null,
            "staged": 0,
            "after_ordinal": 0
          }
        ],
        "bootstrap_rows": [],
        "history": [
          {
            "singleton": 1,
            "recent": null,
            "download_requested": 0,
            "download_total": null
          }
        ]
      }
    }
  ]
};
