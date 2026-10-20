// Records this build's unfinished-activity checkpoints for update-compatibility
// testing (#80):
//
//   pnpm --filter @tableside/engine record-checkpoints [--replace]
//
// It writes test/recorded/engine-<ENGINE_VERSION>-schema-<STATE_SCHEMA_VERSION>.ts.
// While that build is unreleased, --replace re-records it (its behaviour may
// still change). When the build is released, its recording's SHA-256 goes in
// test/recorded/released.json; from then on it is never regenerated, edited or
// removed. A new recording must be added to test/recorded/index.ts.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  advanceActivity,
  canonicalJson,
  createActivity,
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
import { PI, ZERO } from '../test/fixtures';
import type { RecordedBuild, RecordedCheckpoint } from '../test/recorded';
import { TEST_COUNTING_SCHEDULE } from '../test/blackjack-strategy.fixtures';
import { DOUBLING, FLAT_EVEN_MONEY } from '../test/strategy.fixtures';

const place = (target: string, amount: string): Command => ({ kind: 'place-wager', target, amount });
const BEGIN: Command = { kind: 'begin-turn' };
const SETTLE: Command = { kind: 'settle-turn' };

interface Scenario {
  readonly name: string;
  readonly specification: ActivitySpecification;
  readonly random: RandomStreamIdentity;
  /** Commands that leave the activity unfinished in the phase under test. */
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
  // Key [1, 0] rolls a six first: the point is on, the pass line is committed.
  { name: 'craps, a point established', specification: CRAPS_SPEC, random: { ...ZERO, key: [1, 0] }, commands: [place('pass', '10'), place('field', '5'), BEGIN, SETTLE] },
  { name: 'blackjack, dealt and waiting for the decision', specification: BJ_SPEC, random: BJ_STREAM, commands: [place('hand-1', '10'), BEGIN] },
  {
    name: 'blackjack guided, counting with the bet schedule, a betting correction waiting',
    specification: { ...BJ_SPEC, strategy: { definition: TEST_COUNTING_SCHEDULE, parameters: {} } },
    random: BJ_STREAM,
    commands: [place('hand-1', '50'), BEGIN],
  },
];

/** The next command toward completion: settle what is revealed, resolve guidance, then stop and settle finally. */
function nextCommand(state: ActivityState): Command {
  const view = readPermittedView(state);
  const legal = view.legalCommands;
  if (state.phase === 'revealing-outcome') return SETTLE;
  if (state.phase === 'final-settlement') return { kind: 'advance-final-settlement' };
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

const exportName = `RECORDED_ENGINE_${ENGINE_VERSION.replaceAll('.', '_')}_SCHEMA_${STATE_SCHEMA_VERSION}`;
const target = fileURLToPath(new URL(`../test/recorded/engine-${ENGINE_VERSION}-schema-${STATE_SCHEMA_VERSION}.ts`, import.meta.url));
const released = JSON.parse(readFileSync(new URL('../test/recorded/released.json', import.meta.url), 'utf8')) as Record<string, string>;
if (basename(target) in released) throw new Error(`${target} is a released build's recording: it is never rewritten`);
if (existsSync(target) && !process.argv.includes('--replace')) throw new Error(`${target} exists: pass --replace to re-record this unreleased build`);

const build: RecordedBuild = { engine: ENGINE_VERSION, schema: STATE_SCHEMA_VERSION, checkpoints: SCENARIOS.map(record) };
writeFileSync(
  target,
  `// Recorded by scripts/record-checkpoints.ts with engine ${ENGINE_VERSION}, state schema ${STATE_SCHEMA_VERSION}. Never edit or remove.\n` +
    `import type { RecordedBuild } from './index';\n\n` +
    `export const ${exportName}: RecordedBuild = ${JSON.stringify(build, null, 2)};\n`,
);
process.stdout.write(`recorded ${build.checkpoints.length} checkpoints to ${target}\n`);
