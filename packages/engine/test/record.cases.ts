// Spec 1 Results
// Spec 1 Completed practice session record, Amendments 2 §A.4 §B, 3 §1-§4, 4 §C
import type { TestCase } from '@tableside/harness';

import {
  advanceActivity,
  canonicalJson,
  classifySession,
  classifyWager,
  completedPracticeRecord,
  countWagers,
  createActivity,
  quarantineStatus,
  summarizeResults,
  type Command,
  type CompletedPracticeSessionRecord,
  type QuarantineList,
  type RecordContext,
  type WagerOutcome,
} from '../src';

import { run, SPEC, STREAM } from './activity.fixtures';
import { CRAPS_SPEC } from './craps.cases';
import { FLAT_PLACE } from './craps-strategy.fixtures';
import { guidedCraps } from './craps-strategy.helpers';
import { PI, throws } from './fixtures';
import { FLAT_EVEN_MONEY } from './strategy.fixtures';

const place = (target: string, amount: string): Command => ({ kind: 'place-wager', target, amount });
const BEGIN: Command = { kind: 'begin-turn' };
const SETTLE: Command = { kind: 'settle-turn' };
const STOP: Command = { kind: 'request-stop' };
const FINAL: Command = { kind: 'advance-final-settlement' };
const RETRY: Command = { kind: 'retry-correction' };
const OVERRIDE: Command = { kind: 'override-correction' };

const CONTEXT: RecordContext = { startedAt: 1000, endedAt: 2000, meteringBasis: 'free-play', allowancePolicyVersion: null };

const outcome = (result: WagerOutcome['result'], net: string, target = 't'): WagerOutcome => ({ turn: 1, target, stake: '10', result, net, returned: '0' });

function record(fields: Partial<CompletedPracticeSessionRecord>): CompletedPracticeSessionRecord {
  const { state, facts } = run(createActivity(SPEC, STREAM), [STOP, FINAL]);
  return { ...completedPracticeRecord(state, facts, CONTEXT), ...fields };
}

const counts = (wins: number, losses: number, pushes: number) => ({ wins, losses, pushes, resolved: wins + losses + pushes });

export const recordCases: TestCase[] = [
  {
    name: 'record: a free-play roulette session carries identities, times, rules and limits, funding, turns, ending reason and per-wager outcomes with their turn',
    run: (t) => {
      const { state, facts } = run(createActivity(SPEC, STREAM), [
        place('red', '10'), place('black', '10'), BEGIN, SETTLE,
        place('red', '10'), BEGIN, SETTLE,
        { kind: 'request-stop', cause: 'switch' }, FINAL,
      ]);
      const result = completedPracticeRecord(state, facts, { ...CONTEXT, meteringBasis: 'turns', allowancePolicyVersion: 'allowance-3' });
      t.equal(result, {
        recordVersion: 1,
        activityId: 'activity-1',
        owner: 'local',
        device: 'device-1',
        game: 'roulette',
        identities: { engine: '0.0.0', rules: { id: 'roulette-single-zero', version: 1 }, strategy: null, reference: null, randomProtocol: 1 },
        startedAt: 1000,
        endedAt: 2000,
        mode: 'free-play',
        blackjackMode: null,
        betSchedule: null,
        strategy: null,
        rules: {
          id: 'roulette-single-zero',
          version: 1,
          content: { wheel: 'single-zero', limits: { inside: { min: '1', max: '100' }, outside: { min: '10', max: '1000' } } },
        },
        fundingSource: 'practice-funding',
        meteringBasis: 'turns',
        allowancePolicyVersion: 'allowance-3',
        buyIn: '1000',
        rebuys: [],
        cumulativeFunding: '1000',
        finalCashOut: '990',
        netResult: '-10',
        maxDrawdown: '10',
        turnsPlayed: 2,
        endingReason: 'switch',
        overrideAffected: false,
        wagers: counts(1, 2, 0),
        noBet: false,
        outcomes: [
          { turn: 1, target: 'red', stake: '10', result: 'win', net: '10', returned: '20' },
          { turn: 1, target: 'black', stake: '10', result: 'loss', net: '-10', returned: '0' },
          { turn: 2, target: 'red', stake: '10', result: 'loss', net: '-10', returned: '0' },
        ],
        guidance: null,
      });
      t.equal(typeof canonicalJson(result), 'string');
    },
  },
  {
    name: 'record: the ending reason defaults to stop; an access-ended stop is recorded as such',
    run: (t) => {
      const plain = run(createActivity(SPEC, STREAM), [STOP, FINAL]);
      t.equal(completedPracticeRecord(plain.state, plain.facts, CONTEXT).endingReason, 'stop');
      const ended = run(createActivity(SPEC, STREAM), [{ kind: 'request-stop', cause: 'access-ended' }, FINAL]);
      t.equal(completedPracticeRecord(ended.state, ended.facts, CONTEXT).endingReason, 'access-ended');
    },
  },
  {
    name: 'record: a content-removal stop is recorded apart from an access-ended stop (Amendment 6 §2, §5)',
    run: (t) => {
      const removed = run(createActivity(SPEC, STREAM), [{ kind: 'request-stop', cause: 'content-removed' }, FINAL]);
      t.equal(completedPracticeRecord(removed.state, removed.facts, CONTEXT).endingReason, 'content-removed');
    },
  },
  {
    name: 'record: a stop cause outside stop, reset, switch, access-ended and content-removed is a malformed command',
    run: (t) => {
      const state = createActivity(SPEC, STREAM);
      const result = advanceActivity(state, { sequence: 0, commandId: 'c0', command: { kind: 'request-stop', cause: 'bored' } as unknown as Command });
      t.equal(result.status === 'rejected' && result.reason, 'malformed');
    },
  },
  {
    name: 'record: a session with no bet is flagged no-bet, with zero turns, zero resolved wagers and an unchanged result',
    run: (t) => {
      const { state, facts } = run(createActivity(SPEC, STREAM), [place('red', '10'), STOP, FINAL]);
      const result = completedPracticeRecord(state, facts, CONTEXT);
      t.equal([result.noBet, result.turnsPlayed, result.wagers, result.netResult, classifySession(result)], [true, 0, counts(0, 0, 0), '0', 'unchanged']);
      t.equal(result.outcomes, [{ turn: 0, target: 'red', stake: '10', result: 'returned', net: '0', returned: '10' }]);
    },
  },
  {
    name: 'record: a turn with nothing at stake is no bet, and final-settlement rolls are not turns played (as the standardized record derives them)',
    run: (t) => {
      const idle = run(guidedCraps(FLAT_PLACE, PI), [BEGIN, SETTLE, STOP, FINAL]);
      const idleRecord = completedPracticeRecord(idle.state, idle.facts, CONTEXT);
      t.equal([idleRecord.noBet, idleRecord.turnsPlayed], [true, 1]);
      const ended = run(createActivity(CRAPS_SPEC, PI), [place('pass', '10'), BEGIN, SETTLE, STOP, FINAL, FINAL, FINAL, FINAL, FINAL]);
      t.equal(ended.state.phase, 'completed');
      const endedRecord = completedPracticeRecord(ended.state, ended.facts, CONTEXT);
      t.equal([endedRecord.noBet, endedRecord.turnsPlayed, endedRecord.netResult], [false, 1, '10']);
    },
  },
  {
    name: 'record: craps keeps the chosen odds cap and counts come odds that were off as returned, outside W/L/P',
    run: (t) => {
      const { state, facts } = run(createActivity({ ...CRAPS_SPEC, rules: { ...CRAPS_SPEC.rules, odds: '5x' } }, PI), [
        place('pass', '10'), BEGIN, SETTLE,
        place('pass-odds', '50'), place('come', '10'), BEGIN, SETTLE,
        place('come', '10'), BEGIN, SETTLE,
        place('come-6-odds', '50'), place('come', '10'), BEGIN, SETTLE,
        place('come-4-odds', '30'), BEGIN, SETTLE,
        BEGIN, SETTLE,
        BEGIN, SETTLE,
        BEGIN, SETTLE,
        STOP, FINAL,
      ]);
      const result = completedPracticeRecord(state, facts, CONTEXT);
      t.equal(result.rules, { id: 'standard-craps', version: 2, content: { odds: '5x', field: 'triple-12', limits: { flat: { min: '10', max: '1000' }, props: { min: '1', max: '100' } } } });
      t.equal([result.turnsPlayed, result.netResult, result.wagers], [8, '50', counts(4, 2, 0)]);
      t.equal(
        result.outcomes.filter((o) => o.turn === 7),
        [
          { turn: 7, target: 'come-6', stake: '10', result: 'win', net: '10', returned: '20' },
          { turn: 7, target: 'come-6-odds', stake: '50', result: 'returned', net: '0', returned: '50' },
        ],
      );
    },
  },
  {
    name: 'record: guided practice keeps the strategy revision and choices, betting adherence apart from money, the override flag and the departure log in order with stable ids',
    run: (t) => {
      const initial = createActivity({ ...SPEC, strategy: { definition: FLAT_EVEN_MONEY, parameters: { target: 'red' } } }, STREAM);
      const { state, facts } = run(initial, [
        place('red', '50'), BEGIN, RETRY, BEGIN, SETTLE,
        place('black', '10'), BEGIN, OVERRIDE, SETTLE,
        STOP, FINAL,
      ]);
      const result = completedPracticeRecord(state, facts, CONTEXT);
      t.equal([result.mode, result.strategy], ['guided', { id: 'test-flat-even-money', revision: 1, name: 'Flat even-money', parameters: { target: 'red' } }]);
      t.equal(result.identities.strategy, { id: 'test-flat-even-money', version: 1 });
      t.equal([result.netResult, result.overrideAffected, result.wagers], ['0', true, counts(1, 1, 0)]);
      t.equal(result.guidance?.adherence, { betting: { decisions: 2, followed: 0 }, playing: null, counting: null });
      t.equal(
        result.guidance?.departures.map((d) => [d.id, d.turn, d.resolution, d.actual]),
        [
          ['activity-1/departure/1', 1, 'retried', [{ target: 'red', amount: '50' }]],
          ['activity-1/departure/6', 2, 'overridden', [{ target: 'black', amount: '10' }]],
        ],
      );
      const recorded = facts.flatMap((fact) => (fact.kind === 'departure-recorded' ? [fact.departure] : []));
      t.equal(result.guidance?.departures, recorded);
    },
  },
  {
    name: 'record: only a completed activity has a record',
    run: (t) => {
      const open = createActivity(SPEC, STREAM);
      t.equal(throws(() => completedPracticeRecord(open, [], CONTEXT)), 'Error');
    },
  },
  {
    name: 'results: each resolved wager is classified by net result after commission; surrender is a loss; a return is outside W/L/P',
    run: (t) => {
      t.equal(
        [
          classifyWager(outcome('win', '19/20')),
          classifyWager(outcome('loss', '-5')),
          classifyWager(outcome('push', '0')),
          classifyWager(outcome('returned', '0')),
          classifyWager(outcome('win', '-1/20')),
        ],
        ['win', 'loss', 'push', null, 'loss'],
      );
      t.equal(
        countWagers([
          outcome('win', '10', 'hand-1'),
          outcome('loss', '-10', 'hand-2'),
          outcome('loss', '-5', 'insurance'),
          outcome('win', '30', 'horn-2'),
          outcome('loss', '-1', 'horn-3'),
          outcome('loss', '-1', 'horn-11'),
          outcome('loss', '-1', 'horn-12'),
          outcome('returned', '0', 'come-6-odds'),
        ]),
        counts(2, 5, 0),
      );
    },
  },
  {
    name: 'results: sessions are profitable, losing or unchanged by net result',
    run: (t) => {
      t.equal(['120', '-300', '0', '1/2'].map((netResult) => classifySession({ netResult })), ['profitable', 'losing', 'unchanged', 'profitable']);
    },
  },
  {
    name: 'results: shares pool as sum over sum across sessions, unavailable at zero; no-bet sessions stay in session denominators',
    run: (t) => {
      const records = [
        record({ netResult: '120', maxDrawdown: '85', wagers: counts(2, 1, 0), noBet: false }),
        record({ netResult: '-300', maxDrawdown: '400', wagers: counts(0, 1, 1), noBet: false }),
        record({ netResult: '0', maxDrawdown: '0', wagers: counts(0, 0, 0), noBet: true }),
      ];
      const summary = summarizeResults(records);
      t.equal(summary.sessions, { count: 3, profitable: 1, losing: 1, unchanged: 1, noBet: 1, quarantined: 0 });
      t.equal(summary.sessionShares, { profitable: { count: 1, of: 3 }, losing: { count: 1, of: 3 }, unchanged: { count: 1, of: 3 } });
      t.equal(summary.wagers, counts(2, 2, 1));
      t.equal(summary.wagerShares, { win: { count: 2, of: 5 }, loss: { count: 2, of: 5 }, push: { count: 1, of: 5 } });
      t.equal(summary.drawdown, { median: '85', worst: '400' });
      const none = summarizeResults([record({ wagers: counts(0, 0, 0), noBet: true })]);
      t.equal([none.wagerShares, none.sessionShares.unchanged], [{ win: null, loss: null, push: null }, { count: 1, of: 1 }]);
      t.equal(summarizeResults([]).drawdown, { median: null, worst: null });
    },
  },
  {
    name: 'results: the drawdown median of an even count is the mean of the middle two, as exact money',
    run: (t) => {
      t.equal(summarizeResults([record({ maxDrawdown: '400' }), record({ maxDrawdown: '85' })]).drawdown, { median: '485/2', worst: '400' });
    },
  },
  {
    name: 'results: adherence pools followed over assessed decisions per kind, kept apart; free play adds nothing',
    run: (t) => {
      const guided = (decisions: number, followed: number) =>
        record({ mode: 'guided', guidance: { adherence: { betting: { decisions, followed }, playing: null, counting: null }, departures: [] } });
      const summary = summarizeResults([guided(10, 9), guided(5, 2), record({})]);
      t.equal(summary.adherence, { betting: { count: 11, of: 15 }, playing: null, counting: null });
    },
  },
  {
    name: 'quarantine: status is derived by matching pinned identities against the shipped list, so an accepted session can become quarantined later',
    run: (t) => {
      const accepted = record({});
      const list: QuarantineList = {
        version: 2,
        entries: [{ id: 'q-1', match: { engine: '0.0.0', rules: { id: 'roulette-single-zero', version: 1 } }, explanation: 'A single-zero settlement defect in engine 0.0.0.' }],
      };
      t.equal(quarantineStatus(accepted, { version: 1, entries: [] }), { quarantined: false });
      t.equal(quarantineStatus(accepted, { version: 1, entries: [{ id: 'q-0', match: {}, explanation: 'none' }] }), { quarantined: false });
      t.equal(quarantineStatus(accepted, list), { quarantined: true, entry: 'q-1', explanation: 'A single-zero settlement defect in engine 0.0.0.' });
      t.equal(quarantineStatus({ ...accepted, identities: { ...accepted.identities, rules: { id: 'roulette-double-zero', version: 1 } } }, list), { quarantined: false });
      t.equal(quarantineStatus({ ...accepted, identities: { ...accepted.identities, engine: '0.0.1' } }, list), { quarantined: false });
      t.equal(Object.keys(accepted).filter((key) => key.toLowerCase().includes('quarantin')), []);
      const summary = summarizeResults([accepted, record({ identities: { ...accepted.identities, engine: '0.0.1' }, netResult: '5' })], list);
      t.equal([summary.sessions.count, summary.sessions.quarantined, summary.sessions.profitable], [1, 1, 1]);
    },
  },
];
