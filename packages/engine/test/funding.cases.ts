// Practice funding through the engine interface: buy-in, explicit rebuys, the
// funding ceiling, net result and buy-in-adjusted drawdown. Expected values come
// from spec #51 (Session funding, Rebuys, Ending, Results; the worked example
// 1,000 → 600 → rebuy 1,000 → win 100 gives current drawdown 300, max 400),
// Amendment 4 §B (training bankroll: no rebuys, the allocation is the funding)
// and CONTEXT.md "Session drawdown" (the fall from the previous peak). Spins come
// from the "pi digits" stream: 27, 0, 25, 31, 9 (draws.cases).
import type { TestCase } from '@tableside/harness';

import {
  advanceActivity,
  createActivity,
  decodeCheckpoint,
  encodeCheckpoint,
  readPermittedView,
  summarizeFunding,
  decodeMoney,
  type ActivityState,
  type Command,
  type DomainFact,
} from '../src';

import { run, SPEC, status, step, STREAM } from './activity.fixtures';
import { throws } from './fixtures';

const place = (target: string, amount: string): Command => ({ kind: 'place-wager', target, amount });
const rebuy = (amount: string): Command => ({ kind: 'rebuy', amount });
const BEGIN: Command = { kind: 'begin-turn' };
const SETTLE: Command = { kind: 'settle-turn' };
const STOP: Command = { kind: 'request-stop' };
const FINAL: Command = { kind: 'advance-final-settlement' };
const fresh = (funding = '1000') => createActivity({ ...SPEC, funding }, STREAM);
const training = (funding = '1000') => createActivity({ ...SPEC, fundingSource: 'training-bankroll', funding }, STREAM);
/** Funds off the table plus stakes at their original value (all whole units here). */
const sessionValue = (state: ActivityState) =>
  decodeMoney(String(state.wagers.reduce((sum, wager) => sum + BigInt(wager.amount), BigInt(state.balance))));
const result = (state: ActivityState) => summarizeFunding(state.funding, sessionValue(state));
const drawdown = (state: ActivityState) => [result(state).currentDrawdown, state.funding.maxDrawdown];
const envelope = (state: ActivityState, command: Command) => ({ sequence: state.sequence, commandId: `probe${state.sequence}`, command });
const kinds = (facts: readonly DomainFact[]) => facts.map((fact) => fact.kind);

export const fundingCases: TestCase[] = [
  {
    name: 'funding: the worked example 1,000 → 600 → rebuy 1,000 → win 100 gives current drawdown 300 and max 400',
    run: (t) => {
      // Spin 1 is 27 (red): black 400 loses.
      const lost = run(fresh(), [place('black', '400'), BEGIN, SETTLE]).state;
      t.equal([lost.balance, ...drawdown(lost)], ['600', '400', '400']);
      const rebought = step(lost, rebuy('1000')).state;
      t.equal([rebought.balance, ...drawdown(rebought)], ['1600', '400', '400']);
      // Spin 2 is 0: straight 0 (3) wins 105 and straight 1 (5) loses 5, so the turn wins 100.
      const won = run(rebought, [place('straight-0', '3'), place('straight-1', '5'), BEGIN, SETTLE]).state;
      t.equal([won.balance, ...drawdown(won)], ['1700', '300', '400']);
      const ended = run(won, [STOP, FINAL]).state;
      t.equal(result(ended), {
        source: 'practice-funding',
        buyIn: '1000',
        rebuys: ['1000'],
        cumulativeFunding: '2000',
        finalCashOut: '1700',
        netResult: '-300',
        currentDrawdown: '300',
        maxDrawdown: '400',
      });
    },
  },
  {
    name: 'funding: drawdown is the fall from the previous peak of the game result, and stakes count at their original value',
    run: (t) => {
      // Spin 1 (27): straight 27 (10) wins 350, so the game result peaks at +350.
      const peaked = run(fresh(), [place('straight-27', '10'), BEGIN, SETTLE]).state;
      t.equal([peaked.balance, ...drawdown(peaked)], ['1350', '0', '0']);
      // Staking 100 on red moves it from balance to the table: no drawdown yet.
      const staked = step(peaked, place('red', '100')).state;
      t.equal(drawdown(staked), ['0', '0']);
      // The outcome is generated but the stake keeps its original value until settlement.
      const revealing = step(staked, BEGIN).state;
      t.equal(drawdown(revealing), ['0', '0']);
      // Spin 2 is 0: red loses 100, a fall of 100 from the +350 peak.
      const settled = step(revealing, SETTLE).state;
      t.equal([settled.balance, ...drawdown(settled)], ['1250', '100', '100']);
    },
  },
  {
    name: 'funding: simultaneous settlement updates drawdown once, after every wager in the turn settles',
    run: (t) => {
      // Spin 1 (27): straight 27 (1) wins 35 and black (30) loses 30, settled in layout order.
      // Settled one by one, the result would reach +35 then fall 30; settled together it is +5.
      const state = run(fresh(), [place('straight-27', '1'), place('black', '30'), BEGIN, SETTLE]).state;
      t.equal([state.balance, ...drawdown(state)], ['1005', '0', '0']);
    },
  },
  {
    name: 'funding: maximum drawdown includes final settlement',
    run: (t) => {
      const stopped = run(fresh(), [place('black', '400'), BEGIN, STOP]).state;
      t.equal([stopped.phase, ...drawdown(stopped)], ['final-settlement', '0', '0']);
      const ended = step(stopped, FINAL).state;
      t.equal([ended.phase, ended.balance, ...drawdown(ended), result(ended).netResult], ['completed', '600', '400', '400', '-400']);
    },
  },
  {
    name: 'funding: a rebuy is offered only while the activity waits for input, never once final settlement starts',
    run: (t) => {
      const open = fresh();
      const revealing = run(open, [place('red', '10'), BEGIN]).state;
      const settled = step(revealing, SETTLE).state;
      const final = step(settled, STOP).state;
      const completed = step(final, FINAL).state;
      t.equal(
        [open, revealing, settled, final, completed].map((state) => readPermittedView(state).legalCommands.includes('rebuy')),
        [true, false, true, false, false],
      );
      t.equal(
        [revealing, final, completed].map((state) => status(advanceActivity(state, envelope(state, rebuy('100'))))),
        ['rejected:not-legal-in-phase', 'rejected:not-legal-in-phase', 'rejected:not-legal-in-phase'],
      );
    },
  },
  {
    name: 'funding: a rebuy before an unaffordable wager adds funds only: no payout, no departure, the wager is not placed for you',
    run: (t) => {
      const short = run(fresh(), [place('black', '400'), BEGIN, SETTLE]).state;
      // 600 can't cover 1,000 on red: assessed, nothing placed.
      const refused = step(short, place('red', '1000'));
      t.equal(refused.facts, [{ kind: 'illegal-action', command: place('red', '1000'), reason: 'insufficient-funds' }]);
      const { state, facts } = step(refused.state, rebuy('1000'));
      t.equal(facts, [{ kind: 'funding-added', amount: '1000', cumulative: '2000', balance: '1600' }]);
      t.equal([state.phase, state.balance, state.wagers, state.random], ['settled-outcome', '1600', [], short.random]);
      // The player places it again, explicitly.
      const placed = step(state, place('red', '1000')).state;
      t.equal([placed.balance, placed.wagers], ['600', [{ target: 'red', amount: '1000' }]]);
      t.equal(kinds(run(fresh(), [rebuy('500'), rebuy('250')]).facts), ['funding-added', 'funding-added']);
    },
  },
  {
    name: 'funding: a rebuy beyond the unused headroom is refused, not adjusted; cumulative funding stops at 1,000,000,000',
    run: (t) => {
      const near = fresh('999997000');
      t.equal(readPermittedView(near).funding.headroom, '3000');
      const over = step(near, rebuy('5000'));
      t.equal(over.facts, [{ kind: 'illegal-action', command: rebuy('5000'), reason: 'over-funding-ceiling' }]);
      t.equal([over.state.balance, over.state.funding.rebuys], ['999997000', []]);
      const full = step(over.state, rebuy('3000')).state;
      t.equal([full.balance, full.funding.rebuys, readPermittedView(full).funding], [
        '1000000000',
        ['3000'],
        { source: 'practice-funding', buyIn: '999997000', rebuys: ['3000'], cumulative: '1000000000', headroom: '0' },
      ]);
      t.equal(step(full, rebuy('1')).facts, [{ kind: 'illegal-action', command: rebuy('1'), reason: 'over-funding-ceiling' }]);
      // Zero, negative or fractional amounts are malformed or assessed, never rounded.
      t.equal(status(advanceActivity(near, envelope(near, rebuy('0')))), 'rejected:malformed');
      t.equal(status(advanceActivity(near, envelope(near, rebuy('-5')))), 'rejected:malformed');
      t.equal(step(near, rebuy('5/2')).facts, [{ kind: 'illegal-action', command: rebuy('5/2'), reason: 'not-whole-units' }]);
    },
  },
  {
    name: 'funding: payouts and balances are never clipped at the funding ceiling',
    run: (t) => {
      // Spin 1 (27): red 1,000 wins 1,000 on a balance already at the ceiling.
      const state = run(fresh('1000000000'), [place('red', '1000'), BEGIN, SETTLE, STOP, FINAL]).state;
      t.equal([state.balance, result(state).netResult], ['1000001000', '1000']);
    },
  },
  {
    name: 'funding: a training-bankroll session has no rebuys and uses the allocated amount as its funding',
    run: (t) => {
      const start = training('750');
      t.equal(readPermittedView(start).legalCommands, ['place-wager', 'begin-turn', 'request-stop']);
      t.equal(status(advanceActivity(start, envelope(start, rebuy('100')))), 'rejected:not-legal-in-phase');
      const ended = run(start, [place('black', '400'), BEGIN, SETTLE, STOP, FINAL]).state;
      t.equal(result(ended), {
        source: 'training-bankroll',
        buyIn: '750',
        rebuys: [],
        cumulativeFunding: '750',
        finalCashOut: '350',
        netResult: '-400',
        currentDrawdown: '400',
        maxDrawdown: '400',
      });
      t.equal(throws(() => createActivity({ ...SPEC, fundingSource: 'wallet' as never }, STREAM)), 'ActivitySpecificationError');
    },
  },
  {
    name: 'funding: checkpoints keep funding exactly, so resuming is not a fresh buy-in; damaged funding is refused',
    run: (t) => {
      const state = run(fresh(), [place('black', '400'), BEGIN, SETTLE, rebuy('1000')]).state;
      const text = encodeCheckpoint(state);
      const decoded = decodeCheckpoint(text);
      t.equal(decoded.ok && decoded.state.funding, {
        source: 'practice-funding',
        buyIn: '1000',
        rebuys: ['1000'],
        peak: '0',
        maxDrawdown: '400',
      });
      const edit = (change: (funding: Record<string, unknown>) => void) => {
        const value = JSON.parse(text) as { funding: Record<string, unknown> };
        change(value.funding);
        return JSON.stringify(value);
      };
      const damaged = [
        edit((f) => (f.source = 'wallet')),
        edit((f) => (f.buyIn = '0')),
        edit((f) => (f.rebuys = ['0'])),
        edit((f) => (f.rebuys = ['1000000000'])),
        edit((f) => (f.peak = '-1')),
        edit((f) => (f.maxDrawdown = '-1')),
        edit((f) => (f.source = 'training-bankroll')),
        edit((f) => delete f.peak),
      ];
      t.equal(
        damaged.map((input) => {
          const decodedInput = decodeCheckpoint(input);
          return decodedInput.ok ? 'ok' : decodedInput.error.kind;
        }),
        damaged.map(() => 'damaged'),
      );
    },
  },
];
