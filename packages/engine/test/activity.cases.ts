// The engine interface (seam 1) through the single-zero roulette tracer:
// create, advance, read permitted view, encode/decode checkpoint. Payouts and
// colors come from the launch rules (#3) and the published single-zero
// layout (red: 1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36);
// spins come from the protocol's reference vectors (draws.cases).
import type { TestCase } from '@tableside/harness';

import {
  advanceActivity,
  checkpointHash,
  createActivity,
  decodeCheckpoint,
  encodeCheckpoint,
  ENGINE_VERSION,
  readPermittedView,
  RandomStream,
  uniformInt,
  type ActivityState,
  type Command,
  type DomainFact,
} from '../src';

import { run, SPEC, status, step, STREAM } from './activity.fixtures';
import { throws, ZERO } from './fixtures';

const RED = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const place = (target: string, amount: string): Command => ({ kind: 'place-wager', target, amount });
const BEGIN: Command = { kind: 'begin-turn' };
const SETTLE: Command = { kind: 'settle-turn' };
const STOP: Command = { kind: 'request-stop' };
const FINAL: Command = { kind: 'advance-final-settlement' };
const fresh = () => createActivity(SPEC, STREAM);
const settled = (facts: readonly DomainFact[]) =>
  facts.filter((fact) => fact.kind === 'wager-settled').map((fact) => [fact.turn, fact.target, fact.result, fact.net, fact.returned]);
const envelope = (state: ActivityState, command: Command, commandId = `c${state.sequence}`) => ({
  sequence: state.sequence,
  commandId,
  command,
});

export const activityCases: TestCase[] = [
  {
    name: 'activity: create records owner, device, identity, sequence and pinned identities apart from the schema version',
    run: (t) => {
      const state = createActivity(SPEC, STREAM);
      t.equal(state.activity, { id: 'activity-1', owner: 'local', device: 'device-1' });
      t.equal(state.sequence, 0);
      t.equal(state.identities, {
        engine: ENGINE_VERSION,
        game: 'roulette',
        rules: { id: 'roulette-single-zero', version: 1 },
        strategy: null,
        reference: null,
        random: STREAM,
      });
      t.equal(state.schema, 2);
      t.equal([state.phase, state.turn, state.balance, state.wagers], ['open-decision', 0, '1000', []]);
      // The state is plain data: it survives a JSON round trip unchanged.
      t.equal(JSON.parse(JSON.stringify(state)), state);
    },
  },
  {
    name: 'activity: create grants no access and consumes no allowance (it holds no such fields and returns no facts)',
    run: (t) => {
      const state = createActivity(SPEC, STREAM);
      t.equal(
        Object.keys(state).sort(),
        ['activity', 'balance', 'funding', 'identities', 'outcome', 'phase', 'random', 'receipts', 'rules', 'schema', 'sequence', 'turn', 'wagers'],
      );
      t.equal(state.receipts, []);
    },
  },
  {
    name: 'activity: create refuses an incomplete or out-of-range specification',
    run: (t) => {
      t.equal(throws(() => createActivity({ ...SPEC, activityId: '' }, STREAM)), 'ActivitySpecificationError');
      t.equal(throws(() => createActivity({ ...SPEC, funding: '0' }, STREAM)), 'ActivitySpecificationError');
      t.equal(throws(() => createActivity({ ...SPEC, funding: '1000000001' }, STREAM)), 'ActivitySpecificationError');
      t.equal(
        throws(() =>
          createActivity({ ...SPEC, rules: { ...SPEC.rules, limits: { ...SPEC.rules.limits, inside: { min: '100', max: '1' } } } }, STREAM),
        ),
        'ActivitySpecificationError',
      );
      t.equal(throws(() => createActivity(SPEC, { ...STREAM, key: [0, -1] } as never)), 'ActivitySpecificationError');
    },
  },

  // ---- settlement -------------------------------------------------------
  {
    name: 'activity: straight-up pays 35:1 and red 1:1 on a red pocket (27)',
    run: (t) => {
      let { state, facts } = run(fresh(), [place('red', '10'), place('straight-27', '5'), BEGIN]);
      t.equal(facts.filter((fact) => fact.kind === 'outcome-generated'), [{ kind: 'outcome-generated', turn: 1, pocket: 27 }]);
      t.equal([state.phase, state.balance], ['revealing-outcome', '985']);
      ({ state, facts } = step(state, SETTLE));
      t.equal(settled(facts), [
        [1, 'straight-27', 'win', '175', '180'],
        [1, 'red', 'win', '10', '20'],
      ]);
      t.equal([state.phase, state.balance, state.wagers], ['settled-outcome', '1185', []]);
    },
  },
  {
    name: 'activity: on zero, even-money red loses its whole stake and straight-up 0 pays 35:1',
    run: (t) => {
      const first = run(fresh(), [place('red', '10'), BEGIN, SETTLE]).state;
      const { state, facts } = run(first, [place('straight-0', '2'), place('straight-17', '1'), place('red', '10'), place('black', '10'), BEGIN, SETTLE]);
      t.equal(state.outcome, { turn: 2, pocket: 0 });
      t.equal(settled(facts), [
        [2, 'straight-0', 'win', '70', '72'],
        [2, 'straight-17', 'loss', '-1', '0'],
        [2, 'red', 'loss', '-10', '0'],
        [2, 'black', 'loss', '-10', '0'],
      ]);
      // 1,010 after turn 1; 23 staked; 72 returned.
      t.equal(state.balance, '1059');
    },
  },
  {
    name: 'activity: black loses on a red pocket and wins on a black one',
    run: (t) => {
      // Spins 27, 0, 25, 31, 9: 31 is black.
      const spins = run(fresh(), [place('black', '10'), BEGIN, SETTLE, place('black', '10'), BEGIN, SETTLE, place('black', '10'), BEGIN, SETTLE, place('black', '10'), BEGIN, SETTLE]);
      t.equal(settled(spins.facts), [
        [1, 'black', 'loss', '-10', '0'],
        [2, 'black', 'loss', '-10', '0'],
        [3, 'black', 'loss', '-10', '0'],
        [4, 'black', 'win', '10', '20'],
      ]);
      t.equal(spins.state.balance, '980');
    },
  },
  {
    name: 'activity: money is conserved and payouts match the layout over random play (property)',
    run: (t) => {
      const driver = RandomStream.create({ ...ZERO, key: [0x726f756c, 0x65747465] });
      const targets = [...Array.from({ length: 37 }, (_, i) => `straight-${i}`), 'red', 'black', 'split-1-2'];
      let state = createActivity({ ...SPEC, funding: '5000' }, STREAM);
      let netTotal = 0n;
      let committed = new Map<string, string>();
      let turns = 0;
      // Random play, then a stop (in whichever phase play reached) and final settlement.
      for (let i = 0; state.phase !== 'completed'; i++) {
        const roll = uniformInt(driver, 10);
        const command: Command =
          state.phase === 'final-settlement'
            ? FINAL
            : i >= 1500 && roll === 0
              ? STOP
              : state.phase === 'revealing-outcome'
                ? SETTLE
                : roll < 7
                  ? place(targets[uniformInt(driver, targets.length)] as string, String(uniformInt(driver, 120)))
                  : BEGIN;
        const { state: next, facts } = step(state, command);
        for (const fact of facts) {
          if (fact.kind === 'turn-began') committed = new Map(fact.wagers.map((wager) => [wager.target, wager.amount]));
          if (fact.kind === 'wager-settled') {
            // No settlement without a committed wager, at its committed stake.
            t.equal(committed.get(fact.target), fact.stake);
            const pocket = (next.outcome as { pocket: number }).pocket;
            const covered = fact.target === 'red' ? RED.includes(pocket) : fact.target === 'black' ? pocket !== 0 && !RED.includes(pocket) : fact.target === `straight-${pocket}`;
            const stake = BigInt(fact.stake);
            const expectedNet = covered ? stake * (fact.target.startsWith('straight') ? 35n : 1n) : -stake;
            t.equal([fact.net, fact.returned], [String(expectedNet), String(covered ? stake + expectedNet : 0n)]);
            netTotal += expectedNet;
          }
          if (fact.kind === 'turn-began') turns++;
        }
        state = next;
        // Balance plus stakes on the table always equals funding plus net results.
        const staked = state.wagers.reduce((sum, wager) => sum + BigInt(wager.amount), 0n);
        t.equal(BigInt(state.balance) + staked, 5000n + netTotal);
      }
      t.equal(turns > 100, true);
      t.equal(state.wagers, []);
      t.record('final', { balance: state.balance, turns, hash: checkpointHash(state) });
    },
  },

  // ---- legality ---------------------------------------------------------
  {
    name: 'activity: an illegal wager is a durable assessment with wagers and balance unchanged',
    run: (t) => {
      const base = run(fresh(), [place('red', '990')]).state;
      const attempts: [Command, string][] = [
        [place('red', '5'), 'below-minimum'],
        [place('straight-7', '101'), 'above-maximum'],
        [place('red', '1001'), 'above-maximum'],
        [place('straight-7', '5/2'), 'not-whole-units'],
        [place('straight-37', '1'), 'unknown-target'],
        [place('split-1-2', '1'), 'unknown-target'],
        [place('straight-7', '11'), 'insufficient-funds'],
        [place('black', '0'), 'no-wager-to-remove'],
      ];
      for (const [command, reason] of attempts) {
        const result = advanceActivity(base, envelope(base, command));
        if (result.status !== 'committed') throw new Error(`expected an assessment for ${reason}`);
        t.equal(result.facts, [{ kind: 'illegal-action', command, reason }]);
        t.equal(result.receipt, { commandId: 'c1', sequence: 1, command: JSON.stringify(command, Object.keys(command).sort()), disposition: 'assessed' });
        t.equal([result.state.sequence, result.state.balance, result.state.wagers, result.state.phase], [2, '10', [{ target: 'red', amount: '990' }], 'open-decision']);
      }
      // Topping up to the exact remaining balance is legal.
      t.equal(step(base, place('straight-7', '10')).state.balance, '0');
    },
  },
  {
    name: 'activity: beginning a turn with no wager is assessed, draws nothing and leaves the phase',
    run: (t) => {
      const base = fresh();
      const { state, facts } = step(base, BEGIN);
      t.equal(facts, [{ kind: 'illegal-action', command: BEGIN, reason: 'no-wager' }]);
      t.equal([state.phase, state.turn, state.random], ['open-decision', 0, base.random]);
    },
  },
  {
    name: 'activity: resending an assessed or applied command returns its receipt and records no second attempt',
    run: (t) => {
      const base = fresh();
      const sent = envelope(base, place('red', '5'));
      const first = advanceActivity(base, sent);
      if (first.status !== 'committed') throw new Error('expected an assessment');
      const again = advanceActivity(first.state, sent);
      t.equal(again, { status: 'duplicate', receipt: first.receipt });
      const spun = step(step(first.state, place('red', '10')).state, BEGIN).state;
      const spinAgain = advanceActivity(spun, { sequence: 2, commandId: 'c2', command: BEGIN });
      t.equal(spinAgain.status, 'duplicate');
      t.equal(spun.receipts.length, 3);
    },
  },
  {
    name: 'activity: a malformed, stale or conflicting envelope is rejected without a receipt',
    run: (t) => {
      const base = step(fresh(), place('red', '10')).state;
      const rejections: [unknown, string][] = [
        [{ sequence: 1, command: BEGIN }, 'rejected:malformed'],
        [{ sequence: -1, commandId: 'x', command: BEGIN }, 'rejected:malformed'],
        [{ sequence: 1, commandId: '', command: BEGIN }, 'rejected:malformed'],
        [{ sequence: 1, commandId: 'x', command: { kind: 'shuffle' } }, 'rejected:malformed'],
        [{ sequence: 1, commandId: 'x', command: { kind: 'begin-turn', fast: true } }, 'rejected:malformed'],
        [{ sequence: 1, commandId: 'x', command: place('red', '-10') }, 'rejected:malformed'],
        [{ sequence: 1, commandId: 'x', command: place('red', '010') }, 'rejected:malformed'],
        [{ sequence: 1, commandId: 'x', command: place('red', 10 as never) }, 'rejected:malformed'],
        [{ sequence: 1, commandId: 'x', command: BEGIN, extra: 1 }, 'rejected:malformed'],
        [{ sequence: 0, commandId: 'x', command: BEGIN }, 'rejected:stale'],
        [{ sequence: 2, commandId: 'x', command: BEGIN }, 'rejected:stale'],
        [{ sequence: 1, commandId: 'c0', command: BEGIN }, 'rejected:conflicting-command-id'],
        [{ sequence: 1, commandId: 'x', command: SETTLE }, 'rejected:not-legal-in-phase'],
        [{ sequence: 1, commandId: 'x', command: FINAL }, 'rejected:not-legal-in-phase'],
      ];
      t.equal(
        rejections.map(([sent]) => status(advanceActivity(base, sent as never))),
        rejections.map(([, expected]) => expected),
      );
    },
  },

  // ---- phases -----------------------------------------------------------
  {
    name: 'activity: each phase allows only its commands',
    run: (t) => {
      const legal = (state: ActivityState) => readPermittedView(state).legalCommands;
      const open = fresh();
      const revealing = run(open, [place('red', '10'), BEGIN]).state;
      const settledOutcome = step(revealing, SETTLE).state;
      const final = step(settledOutcome, STOP).state;
      const completed = step(final, FINAL).state;
      t.equal(
        [open, revealing, settledOutcome, final, completed].map((state) => [state.phase, legal(state)]),
        [
          ['open-decision', ['place-wager', 'begin-turn', 'request-stop', 'rebuy']],
          ['revealing-outcome', ['settle-turn', 'request-stop']],
          ['settled-outcome', ['place-wager', 'begin-turn', 'request-stop', 'rebuy']],
          ['final-settlement', ['advance-final-settlement']],
          ['completed', []],
        ],
      );
      const all: Command[] = [place('red', '10'), BEGIN, SETTLE, STOP, FINAL, { kind: 'rebuy', amount: '100' }];
      for (const state of [open, revealing, settledOutcome, final, completed]) {
        const accepted = all.filter((command) => advanceActivity(state, envelope(state, command, 'probe')).status === 'committed');
        t.equal(accepted.map((command) => command.kind), legal(state));
      }
    },
  },
  {
    name: 'activity: stopping in a decision returns removable wagers, settles nothing and draws nothing',
    run: (t) => {
      const before = run(fresh(), [place('red', '10'), place('straight-5', '3')]).state;
      const { state, facts } = run(before, [STOP, FINAL]);
      t.equal(facts, [
        { kind: 'stop-requested', phase: 'open-decision' },
        { kind: 'wager-returned', target: 'straight-5', amount: '3' },
        { kind: 'wager-returned', target: 'red', amount: '10' },
        { kind: 'activity-completed', balance: '1000' },
      ]);
      t.equal([state.phase, state.balance, state.random], ['completed', '1000', before.random]);
    },
  },
  {
    name: 'activity: stopping mid-spin keeps committed wagers for automatic final settlement, never interactive play',
    run: (t) => {
      const stopped = run(fresh(), [place('red', '10'), BEGIN, STOP]).state;
      t.equal([stopped.phase, readPermittedView(stopped).wagersCommitted], ['final-settlement', true]);
      for (const command of [place('red', '20'), BEGIN, SETTLE, STOP]) {
        t.equal(status(advanceActivity(stopped, envelope(stopped, command))), 'rejected:not-legal-in-phase');
      }
      const { state, facts } = step(stopped, FINAL);
      t.equal(settled(facts), [[1, 'red', 'win', '10', '20']]);
      t.equal(facts.at(-1), { kind: 'activity-completed', balance: '1010' });
      for (const command of [place('red', '20'), BEGIN, SETTLE, STOP, FINAL]) {
        t.equal(status(advanceActivity(state, envelope(state, command))), 'rejected:not-legal-in-phase');
      }
    },
  },

  // ---- permitted view ---------------------------------------------------
  {
    name: 'activity: the permitted view holds no random state and is the same whatever the stream holds next',
    run: (t) => {
      const keys: string[] = [];
      const collect = (value: unknown): void => {
        if (Array.isArray(value)) value.forEach(collect);
        else if (typeof value === 'object' && value !== null) {
          for (const [key, inner] of Object.entries(value)) {
            keys.push(key);
            collect(inner);
          }
        }
      };
      const commands = [place('red', '10'), place('straight-9', '1')];
      const a = run(createActivity(SPEC, STREAM), commands).state;
      const b = run(createActivity(SPEC, ZERO), commands).state;
      t.equal(readPermittedView(a), readPermittedView(b));
      collect(readPermittedView(step(a, BEGIN).state));
      t.equal(keys.filter((key) => ['random', 'key', 'session', 'block', 'lane', 'identities', 'receipts'].includes(key)), []);
      t.equal(Object.keys(readPermittedView(a)).sort(), [
        'activityId', 'balance', 'funding', 'legalCommands', 'outcome', 'phase', 'sequence', 'table', 'turn', 'wagers', 'wagersCommitted',
      ]);
      // readPermittedView takes the state alone: no caller flag can widen it.
      t.equal(readPermittedView.length, 1);
    },
  },
  {
    name: 'activity: the view lists the table placements with their limits and payouts',
    run: (t) => {
      const placements = readPermittedView(fresh()).table.placements;
      t.equal(placements.length, 39);
      t.equal(placements[0], { target: 'straight-0', limitClass: 'inside', min: '1', max: '100', payout: '35:1' });
      t.equal(placements.at(-1), { target: 'black', limitClass: 'outside', min: '10', max: '1000', payout: '1:1' });
    },
  },

  // ---- determinism and retries -------------------------------------------
  {
    name: 'activity: retries and views consume no draws; a turn takes exactly one spin',
    run: (t) => {
      const ready = step(fresh(), place('red', '10')).state;
      const before = encodeCheckpoint(ready);
      readPermittedView(ready);
      checkpointHash(ready);
      t.equal(encodeCheckpoint(ready), before);
      const once = advanceActivity(ready, envelope(ready, BEGIN));
      const twice = advanceActivity(ready, envelope(ready, BEGIN));
      t.equal(once, twice);
      if (once.status !== 'committed') throw new Error('expected a spin');
      // Pocket 27 is the stream's first accepted draw (Python reference): block 0, lane 1.
      t.equal([once.state.random.block, once.state.random.lane], [[0, 0], 1]);
      t.equal(advanceActivity(once.state, envelope(ready, BEGIN)).status, 'duplicate');
    },
  },

  // ---- checkpoints ------------------------------------------------------
  {
    name: 'activity: checkpoints round-trip exactly in every phase',
    run: (t) => {
      const states = [fresh()];
      for (const command of [place('red', '10'), BEGIN, SETTLE, place('straight-0', '1'), BEGIN, STOP, FINAL]) {
        states.push(step(states.at(-1) as ActivityState, command).state);
      }
      for (const state of states) {
        const text = encodeCheckpoint(state);
        const decoded = decodeCheckpoint(text);
        if (!decoded.ok) throw new Error(decoded.error.message);
        t.equal(decoded.state, state);
        t.equal(encodeCheckpoint(decoded.state), text);
      }
      // A decoded checkpoint continues exactly as the original.
      const middle = states[1] as ActivityState;
      const resumed = decodeCheckpoint(encodeCheckpoint(middle));
      if (!resumed.ok) throw new Error('round trip failed');
      t.equal(checkpointHash(step(resumed.state, BEGIN).state), checkpointHash(states[2] as ActivityState));
    },
  },
  {
    name: 'activity: damaged or non-canonical checkpoints return a damaged recovery error',
    run: (t) => {
      const state = run(fresh(), [place('red', '10'), BEGIN]).state;
      const text = encodeCheckpoint(state);
      const edit = (change: (value: Record<string, unknown>) => void) => {
        const value = JSON.parse(text) as Record<string, unknown>;
        change(value);
        return JSON.stringify(value);
      };
      const damaged = [
        '',
        'not json',
        text.slice(0, -1),
        JSON.stringify(state, null, 1),
        edit((v) => (v.balance = '-1')),
        edit((v) => (v.balance = '990.0')),
        edit((v) => (v.phase = 'spinning')),
        edit((v) => (v.wagers = [])),
        edit((v) => (v.wagers = [{ target: 'red', amount: '10' }, { target: 'red', amount: '10' }])),
        edit((v) => (v.receipts = [])),
        edit((v) => ((v.receipts as Record<string, unknown>[])[0]!.command = '{"kind":"shuffle"}')),
        edit((v) => ((v.receipts as Record<string, unknown>[])[0]!.command = '{ "kind": "begin-turn" }')),
        edit((v) => (v.outcome = { turn: 1, pocket: 37 })),
        edit((v) => ((v.random as Record<string, unknown>).lane = 4)),
        edit((v) => ((v.random as Record<string, unknown>).key = [1, 2])),
        edit((v) => delete v.turn),
        edit((v) => (v.extra = true)),
        'null',
        '[]',
      ];
      t.equal(
        damaged.map((input) => {
          const result = decodeCheckpoint(input);
          return result.ok ? 'ok' : result.error.kind;
        }),
        damaged.map(() => 'damaged'),
      );
    },
  },
  {
    name: 'activity: a checkpoint from an unsupported schema, engine, rule set or protocol returns an unsupported recovery error',
    run: (t) => {
      const text = encodeCheckpoint(fresh());
      const edit = (change: (value: Record<string, Record<string, unknown>>) => void) => {
        const value = JSON.parse(text) as Record<string, Record<string, unknown>>;
        change(value);
        return JSON.stringify(value);
      };
      const unsupported = [
        edit((v) => ((v as Record<string, unknown>).schema = 1)),
        edit((v) => (v.identities!.engine = '9.9.9')),
        edit((v) => (v.identities!.game = 'blackjack')),
        edit((v) => (v.identities!.rules = { id: 'roulette-double-zero', version: 1 })),
        edit((v) => (v.identities!.rules = { id: 'roulette-single-zero', version: 2 })),
        edit((v) => ((v.identities!.random as Record<string, unknown>).protocol = 2)),
      ];
      t.equal(
        unsupported.map((input) => {
          const result = decodeCheckpoint(input);
          return result.ok ? 'ok' : result.error.kind;
        }),
        unsupported.map(() => 'unsupported'),
      );
    },
  },

  // ---- cross-runtime trace ----------------------------------------------
  {
    name: 'activity: a full transition trace with checkpoint hashes (compared across runtimes)',
    run: (t) => {
      let state = fresh();
      const trace: unknown[] = [checkpointHash(state)];
      const commands = [
        place('red', '10'), place('straight-27', '5'), place('red', '20'), BEGIN, SETTLE,
        place('straight-0', '2'), place('black', '10'), BEGIN, SETTLE,
        place('black', '20'), BEGIN, STOP, FINAL,
      ];
      for (const command of commands) {
        const next = step(state, command);
        state = next.state;
        trace.push({ facts: next.facts, view: readPermittedView(state), hash: checkpointHash(state) });
      }
      t.equal([state.phase, state.balance], ['completed', '1235']);
      t.record('trace', trace);
      t.record('checkpoint', encodeCheckpoint(state));
    },
  },
];
