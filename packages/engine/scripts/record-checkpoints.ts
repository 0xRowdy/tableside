// #80 docs/development.md Releases: recorded checkpoints and the quarantine list
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  advanceActivity,
  advanceChallenge,
  canonicalJson,
  challengeResults,
  createActivity,
  createChallenge,
  encodeChallengeCheckpoint,
  readChallengeView,
  type ChallengeCommand,
  type ChallengeFact,
  type ChallengeSpecification,
  type ChallengeState,
  encodeCheckpoint,
  ENGINE_VERSION,
  readPermittedView,
  STATE_SCHEMA_VERSION,
  type ActivitySpecification,
  type ActivityState,
  type Command,
  type DomainFact,
  type RandomStreamIdentity,
} from '../src';
import { SPEC } from '../test/activity.fixtures';
import { BJ_SPEC, BJ_STREAM } from '../test/blackjack.fixtures';
import { CRAPS_SPEC } from '../test/craps.cases';
import { PASS_WITH_ODDS } from '../test/craps-strategy.fixtures';
import { PI, ZERO } from '../test/fixtures';
import type { RecordedBuild, RecordedChallenge, RecordedCheckpoint } from '../test/recorded';
import { CHECK, CONVERSION_CHECK, CONVERSION_LEARN, COUNT_CHECK, COUNT_LEARN, LEARN, seed } from '../test/challenge.fixtures';
import { TEST_COUNTING_SCHEDULE } from '../test/blackjack-strategy.fixtures';
import { TABLE_CHECK, TABLE_LEARN, tableSpec, withExtraPlayers } from '../test/table.fixtures';
import { DOUBLING, FLAT_EVEN_MONEY } from '../test/strategy.fixtures';

const place = (target: string, amount: string): Command => ({ kind: 'place-wager', target, amount });
const BEGIN: Command = { kind: 'begin-turn' };
const SETTLE: Command = { kind: 'settle-turn' };

interface Scenario {
  readonly name: string;
  readonly specification: ActivitySpecification;
  readonly random: RandomStreamIdentity;
  readonly commands: readonly Command[];
}

const SCENARIOS: Scenario[] = [
  { name: 'roulette, wagers placed before the spin', specification: SPEC, random: PI, commands: [place('red', '10'), place('straight-17', '5')] },
  { name: 'roulette, the ball landed but not yet settled', specification: SPEC, random: PI, commands: [place('red', '10'), BEGIN] },
  { name: 'roulette, a spin settled', specification: SPEC, random: PI, commands: [place('red', '10'), BEGIN, SETTLE, place('black', '20')] },
  { name: 'roulette, stopped with a wager down, final settlement under way', specification: SPEC, random: PI, commands: [place('red', '10'), BEGIN, SETTLE, place('even', '10'), { kind: 'request-stop' }] },
  {
    name: 'roulette guided, a correction waiting for retry or override',
    specification: { ...SPEC, strategy: { definition: FLAT_EVEN_MONEY, parameters: { target: 'red' } } },
    random: PI,
    commands: [place('red', '50'), BEGIN],
  },
  {
    name: 'roulette guided, a progression cycle ended by an override',
    specification: { ...SPEC, strategy: { definition: DOUBLING, parameters: {} } },
    random: PI,
    commands: [place('red', '50'), BEGIN, { kind: 'override-correction' }, SETTLE],
  },
  { name: 'craps, a point established', specification: CRAPS_SPEC, random: { ...ZERO, key: [1, 0] }, commands: [place('pass', '10'), place('field', '5'), BEGIN, SETTLE] },
  {
    name: 'craps guided, Stop strategy with the pass line contract settling',
    specification: { ...CRAPS_SPEC, strategy: { definition: PASS_WITH_ODDS, parameters: {} } },
    random: { ...ZERO, key: [1, 0] },
    commands: [place('pass', '10'), BEGIN, SETTLE, { kind: 'stop-strategy' }],
  },
  { name: 'blackjack, dealt and waiting for the decision', specification: BJ_SPEC, random: BJ_STREAM, commands: [place('hand-1', '10'), BEGIN] },
  {
    name: 'blackjack guided, counting with the bet schedule, a betting correction waiting',
    specification: { ...BJ_SPEC, strategy: { definition: TEST_COUNTING_SCHEDULE, parameters: {} } },
    random: BJ_STREAM,
    commands: [place('hand-1', '50'), BEGIN],
  },
];

function nextCommand(state: ActivityState): Command {
  const view = readPermittedView(state);
  const legal = view.legalCommands;
  if (state.phase === 'revealing-outcome') return SETTLE;
  if (state.phase === 'final-settlement') return { kind: 'advance-final-settlement' };
  if (state.phase === 'strategy-settlement') return { kind: 'advance-strategy-settlement' };
  if (state.phase === 'correction') return { kind: 'retry-correction' };
  if (view.game === 'blackjack' && view.playActions.length > 0) {
    return { kind: 'play', action: view.playActions.includes('decline-insurance') ? 'decline-insurance' : 'stand' };
  }
  if (legal.includes('settle-turn')) return SETTLE;
  if (legal.includes('request-stop')) return { kind: 'request-stop' };
  throw new Error(`no way on from ${state.phase}: ${legal.join(', ')}`);
}

function advance(state: ActivityState, command: Command): { state: ActivityState; facts: readonly DomainFact[] } {
  const result = advanceActivity(state, { sequence: state.sequence, commandId: `record-${state.sequence}`, command });
  if (result.status !== 'committed') throw new Error(`refused ${JSON.stringify(command)}: ${JSON.stringify(result)}`);
  return result;
}

function record(scenario: Scenario): RecordedCheckpoint {
  let state: ActivityState = createActivity(scenario.specification, scenario.random);
  for (const command of scenario.commands) state = advance(state, command).state;
  const checkpoint = encodeCheckpoint(state);
  const phase = state.phase;
  const continuation: Command[] = [];
  const facts: DomainFact[] = [];
  while (state.phase !== 'completed') {
    if (continuation.length > 500) throw new Error(`${scenario.name} never completes`);
    const command = nextCommand(state);
    const next = advance(state, command);
    continuation.push(command);
    facts.push(...next.facts);
    state = next.state;
  }
  return {
    name: scenario.name,
    game: scenario.specification.game,
    phase,
    specification: JSON.parse(canonicalJson(scenario.specification)),
    random: JSON.parse(canonicalJson(scenario.random)),
    checkpoint,
    continuation,
    facts: canonicalJson(facts),
    finalBalance: state.balance,
  };
}

// #158
interface ChallengeScenario {
  readonly name: string;
  readonly specification: ChallengeSpecification;
  readonly random: RandomStreamIdentity;
  readonly commands: readonly ChallengeCommand[];
}

const CHALLENGE_SCENARIOS: ChallengeScenario[] = [
  { name: 'card values Learn, created and not yet begun', specification: LEARN, random: seed(1), commands: [] },
  { name: 'card values Learn, a card waiting for its answer', specification: LEARN, random: seed(1), commands: [{ kind: 'begin' }, { kind: 'answer', value: 1 }, { kind: 'next-item' }] },
  { name: 'card values Learn, a wrong answer explained', specification: LEARN, random: seed(1), commands: [{ kind: 'begin' }, { kind: 'answer', value: 1 }, { kind: 'next-item' }, { kind: 'answer', value: 1 }] },
  // #132
  { name: 'card values Check, an answer recorded', specification: CHECK, random: seed(1), commands: [{ kind: 'begin' }, { kind: 'answer', value: 1 }, { kind: 'next-item' }, { kind: 'answer', value: 1 }] },
  // #133
  { name: 'running count Learn, a wrong count explained after the count was shown', specification: COUNT_LEARN, random: seed(1), commands: [{ kind: 'begin' }, { kind: 'reveal-count' }, { kind: 'answer', value: 3 }] },
  {
    name: 'running count Check, a card between checkpoints after the count was shown',
    specification: COUNT_CHECK,
    random: seed(1),
    commands: [{ kind: 'begin' }, { kind: 'next-item' }, { kind: 'next-item' }, { kind: 'reveal-count' }],
  },
  {
    name: 'running count Check, the first checkpoint skipped',
    specification: COUNT_CHECK,
    random: seed(1),
    commands: [{ kind: 'begin' }, ...Array.from({ length: 12 }, (): ChallengeCommand => ({ kind: 'next-item' })), { kind: 'skip' }],
  },
  // #134
  { name: 'conversion Learn, a wrong true count explained', specification: CONVERSION_LEARN, random: seed(1), commands: [{ kind: 'begin' }, { kind: 'answer', value: -3 }] },
  {
    name: 'conversion Check, a true count recorded',
    specification: CONVERSION_CHECK,
    random: seed(1),
    commands: [{ kind: 'begin' }, { kind: 'answer', value: -2 }, { kind: 'next-item' }, { kind: 'answer', value: 23 }],
  },
  // #137
  {
    name: 'table Observe Learn N=1, a wrong running count after round 1 explained',
    specification: TABLE_LEARN,
    random: seed(1),
    commands: [
      { kind: 'begin' },
      { kind: 'answer', value: 0 },
      { kind: 'next-item' },
      { kind: 'answer', value: 0 },
      { kind: 'next-item' },
      ...Array.from({ length: 8 }, (): ChallengeCommand => ({ kind: 'next-item' })),
      { kind: 'answer', value: 4 },
    ],
  },
  {
    name: 'table Observe Check N=3, mid-round with the count revealed',
    specification: tableSpec('check', { interval: 3 }),
    random: seed(1),
    commands: [{ kind: 'begin' }, { kind: 'next-item' }, { kind: 'next-item' }, { kind: 'reveal-count' }],
  },
  pastReshuffle('table Observe Check, four extra players at 50%, past a reshuffle', tableSpec('check', withExtraPlayers(4, 50))),
  { name: 'table Observe Check N=1, created and not yet begun', specification: TABLE_CHECK, random: seed(3), commands: [] },
];

// #137: the first seed whose shoe is reshuffled, stopped on the round after the reshuffle
function pastReshuffle(name: string, specification: ChallengeSpecification): ChallengeScenario {
  const shuffled = (state: ChallengeState) => state.items.some((item, index) => 'step' in item && item.step === 'shuffle' && index < state.position);
  for (let n = 1; n < 400; n++) {
    let state = createChallenge(specification, seed(n));
    const commands: ChallengeCommand[] = [];
    while (state.phase !== 'ended' && !shuffled(state)) {
      const command = nextChallengeCommand(state);
      commands.push(command);
      state = advanceAttempt(state, command).state;
    }
    if (state.phase !== 'ended') return { name, specification, random: seed(n), commands };
  }
  throw new Error(`${name}: no seed reshuffles`);
}

function advanceAttempt(state: ChallengeState, command: ChallengeCommand): { state: ChallengeState; facts: readonly ChallengeFact[] } {
  const result = advanceChallenge(state, { sequence: state.sequence, commandId: `record-${state.sequence}`, command });
  if (result.status !== 'committed') throw new Error(`refused ${JSON.stringify(command)}: ${JSON.stringify(result)}`);
  return result;
}

function nextChallengeCommand(state: ChallengeState): ChallengeCommand {
  const view = readChallengeView(state);
  if (view.legalCommands.includes('begin')) return { kind: 'begin' };
  if (view.legalCommands.includes('next-item')) return { kind: 'next-item' };
  return { kind: 'answer', value: 0 };
}

function recordChallenge(scenario: ChallengeScenario): RecordedChallenge {
  let state = createChallenge(scenario.specification, scenario.random);
  for (const command of scenario.commands) state = advanceAttempt(state, command).state;
  const checkpoint = encodeChallengeCheckpoint(state);
  const phase = state.phase;
  const continuation: ChallengeCommand[] = [];
  const facts: ChallengeFact[] = [];
  while (state.phase !== 'ended') {
    const command = nextChallengeCommand(state);
    const next = advanceAttempt(state, command);
    continuation.push(command);
    facts.push(...next.facts);
    state = next.state;
  }
  return {
    name: scenario.name,
    category: scenario.specification.content.category,
    phase,
    specification: JSON.parse(canonicalJson(scenario.specification)),
    random: JSON.parse(canonicalJson(scenario.random)),
    checkpoint,
    continuation,
    facts: canonicalJson(facts),
    results: canonicalJson(challengeResults(state)),
  };
}

const exportName = `RECORDED_ENGINE_${ENGINE_VERSION.replaceAll('.', '_')}_SCHEMA_${STATE_SCHEMA_VERSION}`;
const target = fileURLToPath(new URL(`../test/recorded/engine-${ENGINE_VERSION}-schema-${STATE_SCHEMA_VERSION}.ts`, import.meta.url));
const released = JSON.parse(readFileSync(new URL('../test/recorded/released.json', import.meta.url), 'utf8')) as Record<string, string>;
if (basename(target) in released) throw new Error(`${target} is a released build's recording: it is never rewritten`);
if (existsSync(target) && !process.argv.includes('--replace')) throw new Error(`${target} exists: pass --replace to re-record this unreleased build`);

const build: RecordedBuild = { engine: ENGINE_VERSION, schema: STATE_SCHEMA_VERSION, checkpoints: SCENARIOS.map(record), challenges: CHALLENGE_SCENARIOS.map(recordChallenge) };
writeFileSync(
  target,
  '// docs/development.md Releases: recorded checkpoints and the quarantine list\n' +
    `import type { RecordedBuild } from './index';\n\n` +
    `export const ${exportName}: RecordedBuild = ${JSON.stringify(build, null, 2)};\n`,
);
process.stdout.write(`recorded ${build.checkpoints.length} checkpoints to ${target}\n`);
