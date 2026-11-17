// Spec 6 contracts, Amendment 6
import type { TestCase } from '@tableside/harness';

import {
  advanceActivity,
  canonicalSpecification,
  canonicalStrategy,
  defaultSelection,
  checkpointHash,
  deriveExposureBound,
  exposureBoundProblems,
  RandomStream,
  readPermittedView,
  recordExposureProblems,
  runStandardizedSession,
  serverStreamIdentity,
  shoeCount,
  STANDARD_CRAPS,
  startStandardizedSession,
  stepStandardizedSession,
  verifySpecification,
  type BenchmarkProfile,
  type BlackjackActivityState,
  type StandardizedSession,
  type StrategyDefinition,
  type Words2,
} from '../src';

import { TEST_BASIC, TEST_COUNTING_SCHEDULE } from './blackjack-strategy.fixtures';
import { CERTIFIED_BLACKJACK } from './certified-blackjack.fixtures';
import { S17_LS, TEST_STRATEGY } from './blackjack.fixtures';
import { CRAPS_BUILT_INS, PASS_WITH_ODDS } from './craps-strategy.fixtures';
import { FLAT_EVEN_MONEY, LABOUCHERE, MARTINGALE, PARLAY, TWO_DOZENS } from './strategy.fixtures';
import { throws } from './fixtures';

const PROTOCOL = { version: 1, funding: '1000', base: '10', opportunities: 200, finalSettlement: 'complete', reference: null } as const;
const ROULETTE_LIMITS = { inside: { min: '1', max: '100' }, outside: { min: '10', max: '1000' } };

export const SINGLE_ZERO: BenchmarkProfile = {
  id: 'benchmark-roulette-single-zero',
  ...PROTOCOL,
  game: 'roulette',
  rules: { id: 'roulette-single-zero', version: 1, wheel: 'single-zero', limits: ROULETTE_LIMITS },
  exposureBound: '191755000',
};
export const DOUBLE_ZERO: BenchmarkProfile = {
  id: 'benchmark-roulette-double-zero',
  ...PROTOCOL,
  game: 'roulette',
  rules: { id: 'roulette-double-zero', version: 1, wheel: 'double-zero', limits: ROULETTE_LIMITS },
  exposureBound: '194649400',
};
export const CRAPS: BenchmarkProfile = {
  id: 'benchmark-craps-standard',
  ...PROTOCOL,
  game: 'craps',
  rules: { id: STANDARD_CRAPS.id, version: STANDARD_CRAPS.version, odds: '3-4-5x', field: 'triple-12', limits: { flat: { min: '10', max: '1000' }, props: { min: '1', max: '100' } } },
  exposureBound: '750213400',
};
export const BLACKJACK_S17_LS: BenchmarkProfile = {
  id: 'benchmark-blackjack-S17_LS',
  ...PROTOCOL,
  game: 'blackjack',
  rules: { ...S17_LS, players: { learnerSeat: 1, otherWagers: ['10'], strategy: TEST_STRATEGY } },
  // docs/development.md Blackjack reference
  reference: { id: 'blackjack-coaching-reference@9892826d10a6d377', version: 1 },
  exposureBound: '5126500',
};

export const KEY: Words2 = [0x7f4a7c15, 0x9e3779b9];

export const TRACED: readonly { readonly profile: BenchmarkProfile; readonly definition: StrategyDefinition }[] = [
  ...[FLAT_EVEN_MONEY, TWO_DOZENS, MARTINGALE, PARLAY, LABOUCHERE].flatMap((definition) => [SINGLE_ZERO, DOUBLE_ZERO].map((profile) => ({ profile, definition }))),
  ...CRAPS_BUILT_INS.map((definition) => ({ profile: CRAPS, definition })),
  { profile: BLACKJACK_S17_LS, definition: TEST_BASIC },
  { profile: BLACKJACK_S17_LS, definition: TEST_COUNTING_SCHEDULE },
  ...Object.values(CERTIFIED_BLACKJACK).map(({ profile, strategy }) => ({ profile, definition: strategy })),
];

export const TRACED_INDICES = [0, 1];

const defaults = (definition: StrategyDefinition) => Object.fromEntries(definition.parameters.map((p) => [p.id, p.default]));
const run = (profile: BenchmarkProfile, definition: StrategyDefinition, index: number, key: Words2 = KEY) =>
  runStandardizedSession({ profile, strategy: { definition, parameters: defaults(definition) }, key, index });

const funded = (profile: BenchmarkProfile, funding: string): BenchmarkProfile => ({ ...profile, funding });

function replayFacts(session: StandardizedSession, definition: StrategyDefinition) {
  let state = startStandardizedSession({ profile: BLACKJACK_S17_LS, strategy: { definition, parameters: {} }, key: KEY, index: session.index }).activity;
  const facts = [];
  for (const receipt of session.activity.receipts) {
    const result = advanceActivity(state, { sequence: receipt.sequence, commandId: receipt.commandId, command: JSON.parse(receipt.command) });
    if (result.status !== 'committed') throw new Error('replay failed');
    state = result.state;
    facts.push(...result.facts);
  }
  return facts;
}

const SIMPLE: StrategyDefinition = {
  format: 1,
  id: 'flat-red',
  revision: 3,
  name: 'Flat red',
  game: 'roulette',
  table: { wheels: ['single-zero'], limits: { inside: { min: '1', max: '100' }, outside: { min: '10', max: '1000' } } },
  parameters: [],
  counters: [],
  instructions: [{ id: 'flat', label: 'Red, every spin', when: { always: true }, bets: [{ target: { target: 'red' }, amount: { lit: '10' } }] }],
  adjustments: [],
  stopWhen: null,
};

const AFTER_RED: StrategyDefinition = {
  ...SIMPLE,
  id: 'after-red',
  name: 'Black after red',
  instructions: [{ id: 'after-red', label: 'Black after red', when: { subject: 'last-pocket-color', is: 'red' }, bets: [{ target: { target: 'black' }, amount: { lit: '10' } }] }],
};

const ANALYSIS = { id: 'standardized-analysis', version: 1 };
const fingerprint = (definition: StrategyDefinition, profile: BenchmarkProfile = SINGLE_ZERO) => canonicalSpecification({ strategy: defaultSelection(definition), profile, analysis: ANALYSIS }).fingerprint;

export const standardizedCases: TestCase[] = [
  {
    name: 'standardized: server streams take the coordinator key with session words = the session index',
    run: (t) => {
      const stream = RandomStream.create(serverStreamIdentity([0, 0], 0));
      t.equal([0, 1, 2, 3].map(() => stream.nextUint32().toString(16).padStart(8, '0')), ['6627e8d5', 'e169c58d', 'bc57ac4c', '9b00dbd8']);
      t.equal(serverStreamIdentity(KEY, 2 ** 32 + 3), { protocol: 1, key: [0x7f4a7c15, 0x9e3779b9], session: [3, 1] });
      t.equal(serverStreamIdentity(KEY, 99_999).session, [99_999, 0]);
      t.equal(throws(() => serverStreamIdentity(KEY, -1)), 'RangeError');
      t.equal(throws(() => serverStreamIdentity([2 ** 32, 0], 0)), 'RandomStreamStateError');
      t.equal(startStandardizedSession({ profile: SINGLE_ZERO, strategy: { definition: SIMPLE, parameters: {} }, key: KEY, index: 7 }).activity.identities.random.session, [7, 0]);
    },
  },
  {
    name: 'standardized: each profile has a finite exposure bound, derived from its rules',
    run: (t) => {
      t.equal(deriveExposureBound(SINGLE_ZERO), '191755000');
      t.equal(deriveExposureBound(DOUBLE_ZERO), '194649400');
      t.equal(deriveExposureBound(CRAPS), '750213400');
      t.equal(deriveExposureBound(BLACKJACK_S17_LS), '5126500');
      t.equal([SINGLE_ZERO, DOUBLE_ZERO, CRAPS, BLACKJACK_S17_LS].flatMap(exposureBoundProblems), []);
      t.equal(exposureBoundProblems({ ...SINGLE_ZERO, exposureBound: '1000' }), ['benchmark-roulette-single-zero: the exposure bound is 1000, the rules imply 191755000']);
      const record = run(SINGLE_ZERO, FLAT_EVEN_MONEY, 0).record;
      t.equal(recordExposureProblems(record, SINGLE_ZERO), []);
      t.equal(recordExposureProblems(record, { ...SINGLE_ZERO, exposureBound: '100' }).length > 0, true);
    },
  },
  {
    name: 'standardized: a flat strategy plays all 200 spins, then the stop path settles',
    run: (t) => {
      const { record, session } = run(SINGLE_ZERO, FLAT_EVEN_MONEY, 0);
      t.equal(record.stopCause, 'horizon');
      t.equal(record.opportunities, 200);
      t.equal(session.activity.turn, 200);
      t.equal(record.resolved, 200);
      t.equal(record.turnover, '2000');
      t.equal(BigInt(record.net), 10n * BigInt(record.wins - record.losses));
      t.equal(BigInt(record.finalBalance) - 1000n, BigInt(record.net));
      t.equal(record.settlementLength, 0);
      t.equal(record.noBet, false);
      t.equal(record.literalZero, false);
    },
  },
  {
    name: 'standardized: completed cycles restart at once with the remaining balance; a cap stops new bets',
    run: (t) => {
      const { record, session } = run(SINGLE_ZERO, MARTINGALE, 1);
      const strategy = session.activity.strategy;
      t.equal((strategy?.cycle.number ?? 0) > 1, true);
      t.equal(session.activity.funding.rebuys, []);
      t.equal(record.stopCause, 'cap');
      t.equal(record.opportunities < 200, true);
      t.equal(record.opportunities, session.activity.turn);
    },
  },
  {
    name: 'standardized: an unaffordable next bet with money left is distinct from a literal zero',
    run: (t) => {
      const short = run(funded(SINGLE_ZERO, '15'), MARTINGALE, 2).record;
      t.equal(short.stopCause, 'unaffordable');
      t.equal(short.literalZero, false);
      t.equal(short.finalBalance, '5');
      const zero = run(funded(SINGLE_ZERO, '10'), FLAT_EVEN_MONEY, 2).record;
      t.equal(zero.stopCause, 'unaffordable');
      t.equal(zero.literalZero, true);
      t.equal(zero.finalBalance, '0');
      t.equal(zero.net, '-10');
    },
  },
  {
    name: 'standardized: craps contracts outliving the horizon settle in full; their rolls are the settlement length',
    run: (t) => {
      const lengths = [0, 1, 2].map((index) => run(CRAPS, PASS_WITH_ODDS, index).record);
      for (const record of lengths) {
        t.equal(record.stopCause, 'horizon');
        t.equal(record.opportunities, 200);
      }
      t.equal(lengths.some((record) => record.settlementLength > 0), true);
      const { session } = run(CRAPS, PASS_WITH_ODDS, 0);
      t.equal(session.activity.phase, 'completed');
      t.equal(session.activity.wagers, []);
    },
  },
  {
    name: 'standardized: the blackjack benchmark seat plays ahead of the evaluated player, outside every metric',
    run: (t) => {
      const { record, session } = run(BLACKJACK_S17_LS, TEST_BASIC, 0);
      const facts = replayFacts(session, TEST_BASIC);
      const seat = facts.filter((fact) => fact.kind === 'seat-settled');
      const learner = facts.filter((fact) => fact.kind === 'wager-settled');
      t.equal(seat.length >= 200, true);
      t.equal([...new Set(seat.map((fact) => (fact.kind === 'seat-settled' ? fact.stake : '')))].sort(), ['10', '20']);
      t.equal(record.resolved, learner.filter((fact) => fact.kind === 'wager-settled' && fact.result !== 'returned').length);
      const first = facts.find((fact) => fact.kind === 'card-dealt');
      t.equal(first?.kind === 'card-dealt' ? first.to : null, 'seat-1-hand-1');
      t.equal(record.opportunities, 200);
      t.equal(readPermittedView(session.activity).phase, 'completed');
      const hiLo = (rank: number) => (rank >= 2 && rank <= 6 ? 1 : rank >= 7 && rank <= 9 ? 0 : -1);
      let running = 0;
      for (const fact of facts) {
        if (fact.kind === 'shoe-shuffled') running = 0;
        if ((fact.kind === 'card-dealt' && fact.card !== null) || fact.kind === 'hole-card-revealed') running += hiLo((fact.card as { rank: number }).rank);
      }
      t.equal(shoeCount(session.activity as BlackjackActivityState).running, running);
    },
  },
  {
    name: 'standardized: a session resumes from any checkpoint to the identical record',
    run: (t) => {
      const whole = run(CRAPS, CRAPS_BUILT_INS[3] as StrategyDefinition, 1);
      let session = startStandardizedSession({ profile: CRAPS, strategy: { definition: CRAPS_BUILT_INS[3] as StrategyDefinition, parameters: {} }, key: KEY, index: 1 });
      for (let i = 0; i < 300; i++) session = stepStandardizedSession(session);
      const resumed = JSON.parse(JSON.stringify(session)) as StandardizedSession;
      let rest = resumed;
      while (rest.activity.phase !== 'completed') rest = stepStandardizedSession(rest);
      t.equal(checkpointHash(rest.activity), checkpointHash(whole.session.activity));
      t.equal(stepStandardizedSession(rest), rest);
    },
  },
  {
    name: 'standardized: waiting counts: a strategy that waits for a pattern spins on with nothing at stake',
    run: (t) => {
      const { record, session } = run(SINGLE_ZERO, AFTER_RED, 0);
      t.equal(record.stopCause, 'horizon');
      t.equal(record.opportunities, 200);
      t.equal(session.activity.turn, 200);
      t.equal(record.resolved > 50 && record.resolved < 150, true);
      t.equal(record.turnover, String(10 * record.resolved));
    },
  },
  {
    name: 'guided roulette: while the strategy places nothing yet, the spin is a waiting spin',
    run: (t) => {
      let state = startStandardizedSession({ profile: SINGLE_ZERO, strategy: { definition: AFTER_RED, parameters: {} }, key: KEY, index: 0 }).activity;
      const send = (command: Parameters<typeof advanceActivity>[1]['command']) => {
        const result = advanceActivity(state, { sequence: state.sequence, commandId: `c${state.sequence}`, command });
        if (result.status !== 'committed') throw new Error(result.status);
        state = result.state;
        return result.facts.map((fact) => fact.kind);
      };
      t.equal(send({ kind: 'begin-turn' }), ['turn-began', 'outcome-generated']);
      t.equal([state.phase, state.turn, state.wagers], ['revealing-outcome', 1, []]);
      t.equal(send({ kind: 'settle-turn' }), []);
      t.equal([state.phase, state.balance], ['settled-outcome', '1000']);
      const free = { ...state, strategy: null, identities: { ...state.identities, strategy: null } } as typeof state;
      const refused = advanceActivity(free, { sequence: free.sequence, commandId: 'free', command: { kind: 'begin-turn' } });
      t.equal(refused.status === 'committed' ? refused.facts.map((fact) => fact.kind) : refused.status, ['illegal-action']);
    },
  },
  {
    name: 'standardized: built-in traces (compared across runtimes; replayed by the runner)',
    run: (t) => {
      for (const { profile, definition } of TRACED) {
        for (const index of TRACED_INDICES) {
          const { record, session } = run(profile, definition, index);
          t.record(`${profile.id} ${definition.id} ${index}`, { profile, strategy: canonicalStrategy(defaultSelection(definition)), key: KEY, index, record, checkpoint: checkpointHash(session.activity) });
        }
      }
    },
  },
  {
    name: 'canonical encoding: names, prose, ids and equal numbers leave the fingerprint unchanged',
    run: (t) => {
      const spec = canonicalSpecification({ strategy: defaultSelection(SIMPLE), profile: SINGLE_ZERO, analysis: ANALYSIS });
      t.equal(
        spec.manifest.startsWith(
          '{"encoding":{"instructionSchema":1,"normalization":1,"version":1},"identities":{"analysis":{"id":"standardized-analysis","version":1},"engine":"0.0.0","randomProtocol":1,"reference":null,"rules":{"id":"roulette-single-zero","version":1}},"profile":{',
        ),
        true,
      );
      t.equal(
        spec.manifest.endsWith(
          '"strategy":{"adjustments":[],"completeWhen":null,"counters":[],"format":1,"game":"roulette","instructions":[{"bets":[{"amount":{"lit":"10"},"cap":null,"target":"red"}],"overrides":[],"priority":null,"when":{"always":true}}],"lists":[],"play":null,"stopWhen":null,"table":{"limits":{"inside":{"max":"100","min":"1"},"outside":{"max":"1000","min":"10"}},"wheels":["single-zero"]}}}',
        ),
        true,
      );
      t.equal(spec.fingerprint, '90c5cd08807bfeb03972322faea9c7dbd35f9da905bc88a761a55873a6153cc6');
      const base = fingerprint(SIMPLE);
      const instruction = SIMPLE.instructions[0] as StrategyDefinition['instructions'][number];
      const renamed: StrategyDefinition = { ...SIMPLE, id: 'other', revision: 9, name: 'Renamed', note: 'A note', instructions: [{ ...instruction, id: 'renamed', label: 'Reworded', note: 'Why' }] };
      t.equal(fingerprint(renamed), base);
      const rewritten: StrategyDefinition = { ...SIMPLE, instructions: [{ ...instruction, bets: [{ target: { target: 'red' }, amount: { add: [{ lit: '5' }, { lit: '5' }] } }] }] };
      t.equal(fingerprint(rewritten), base);
      const parameterized: StrategyDefinition = { ...SIMPLE, parameters: [{ id: 'color', label: 'Color', choices: ['red', 'black'], default: 'red' }], instructions: [{ ...instruction, bets: [{ target: { param: 'color' }, amount: { lit: '10' } }] }] };
      t.equal(fingerprint(parameterized), base);
      t.equal(fingerprint({ ...MARTINGALE, id: 'x', name: 'y', counters: MARTINGALE.counters.map((c) => ({ ...c })) }), fingerprint(MARTINGALE));
    },
  },
  {
    name: 'canonical encoding: any execution-affecting change changes the fingerprint',
    run: (t) => {
      const base = fingerprint(SIMPLE);
      const instruction = SIMPLE.instructions[0] as StrategyDefinition['instructions'][number];
      const variants: StrategyDefinition[] = [
        { ...SIMPLE, instructions: [{ ...instruction, bets: [{ target: { target: 'black' }, amount: { lit: '10' } }] }] },
        { ...SIMPLE, instructions: [{ ...instruction, bets: [{ target: { target: 'red' }, amount: { lit: '20' } }] }] },
        { ...SIMPLE, instructions: [{ ...instruction, bets: [{ target: { target: 'red' }, amount: { lit: '10' }, cap: '10' }] }] },
        { ...SIMPLE, instructions: [{ ...instruction, priority: 1 }] },
        { ...SIMPLE, instructions: [{ ...instruction, when: { subject: 'last-result', is: 'win' } }] },
        { ...SIMPLE, stopWhen: { subject: 'last-result', is: 'loss' } },
      ];
      const prints = variants.map((variant) => fingerprint(variant));
      t.equal(new Set([base, ...prints]).size, variants.length + 1);
      const odd = { ...instruction, id: 'odd', bets: [{ target: { target: 'odd' }, amount: { lit: '10' } }] };
      t.equal(fingerprint({ ...SIMPLE, instructions: [instruction, odd] }) === fingerprint({ ...SIMPLE, instructions: [odd, instruction] }), false);
      t.equal(fingerprint(SIMPLE, { ...SINGLE_ZERO, opportunities: 199 }) === base, false);
      t.equal(fingerprint(SIMPLE, { ...SINGLE_ZERO, version: 2 }) === base, false);
      t.equal(fingerprint(SIMPLE, { ...SINGLE_ZERO, reference: { id: 'r', version: 1 } }) === base, false);
      t.equal(canonicalSpecification({ strategy: defaultSelection(SIMPLE), profile: SINGLE_ZERO, analysis: { ...ANALYSIS, version: 2 } }).fingerprint === base, false);
    },
  },
  {
    name: 'canonical encoding: a fingerprint that does not match its manifest is an integrity error',
    run: (t) => {
      const spec = canonicalSpecification({ strategy: defaultSelection(SIMPLE), profile: SINGLE_ZERO, analysis: ANALYSIS });
      t.equal(throws(() => verifySpecification(spec)), 'no error');
      t.equal(throws(() => verifySpecification({ ...spec, manifest: spec.manifest.replace('"10"', '"20"') })), 'FingerprintIntegrityError');
      t.equal(throws(() => canonicalStrategy(defaultSelection({ ...SIMPLE, instructions: [] }))), 'FingerprintIntegrityError');
      t.equal(throws(() => canonicalStrategy({ definition: FLAT_EVEN_MONEY, parameters: { target: 'green' } })), 'FingerprintIntegrityError');
    },
  },
];
