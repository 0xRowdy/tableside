// Spec 3 Lessons › Structure (worked examples); Testing Decisions › Build-time check; #144, #155
import {
  advanceActivity,
  canonicalJson,
  createActivity,
  explainStrategyBets,
  RANDOM_PROTOCOL_VERSION,
  ODDS_CAPS,
  type ActivityState,
  type Command,
  type CrapsActivityState,
  type DomainFact,
  type Explanation,
  type GameId,
  type OddsCap,
  type RouletteActivityState,
  type RoulettePocket,
  type StrategyDefinition,
  type Wager,
} from '@tableside/engine';

import { CRAPS_STRATEGIES } from './craps-strategies';
import { standardCraps } from './craps';
import { ROULETTE_PRESETS } from './roulette';
import { ROULETTE_STRATEGIES } from './roulette-strategies';
import type { ScriptedChoice } from './worked-examples';

export interface ScriptedTurn {
  readonly wagers: readonly Wager[];
  readonly outcome: ScriptedOutcome;
}

export type ScriptedOutcome = { readonly pocket: RoulettePocket } | { readonly dice: readonly [number, number] };

// TODO(#152)
export interface StrategyBetsAnswer {
  readonly kind: 'bets';
  readonly bets: readonly Wager[];
}

export type StrategyStepAnswer = StrategyBetsAnswer;

// Spec 3 Lessons › Structure (worked examples)
export type StrategyStepExplanation = Explanation;

export interface StrategyStepExample {
  readonly kind: 'strategy-step';
  readonly step: number;
  readonly game: GameId;
  // Spec 1 Built-in strategies
  readonly strategy: string;
  readonly parameters: Readonly<Record<string, string>>;
  readonly table: string;
  readonly practiceFunding: string;
  readonly turns: readonly ScriptedTurn[];
  readonly choices: readonly ScriptedChoice<StrategyStepAnswer, StrategyStepExplanation>[];
}

// Spec 1 Testing Decisions (fixed-scenario fixtures)
const REPLAY_STREAM = { protocol: RANDOM_PROTOCOL_VERSION, key: [0, 0], session: [0, 0] } as const;

interface Stage {
  readonly strategies: readonly StrategyDefinition[];
  start(example: StrategyStepExample, definition: StrategyDefinition): ActivityState;
  stack(state: ActivityState, outcome: ScriptedOutcome): ActivityState;
}

const identity = { activityId: 'worked-example', owner: 'worked-example', device: 'build' } as const;

const ROULETTE_STAGE: Stage = {
  strategies: ROULETTE_STRATEGIES,
  start: (example, definition) => {
    const rules = ROULETTE_PRESETS[example.table as keyof typeof ROULETTE_PRESETS];
    if (!rules) throw new Error(`${example.table} is not a roulette wheel`);
    return createActivity(
      { ...identity, game: 'roulette', rules, strategy: { definition, parameters: example.parameters }, reference: null, fundingSource: 'practice-funding', funding: example.practiceFunding },
      REPLAY_STREAM,
    );
  },
  stack: (state, outcome) => {
    const roulette = state as RouletteActivityState;
    if (!roulette.outcome || !('pocket' in outcome)) throw new Error('no spin to stack a pocket on');
    return { ...roulette, outcome: { ...roulette.outcome, pocket: outcome.pocket } };
  },
};

// #154
const CRAPS_STAGE: Stage = {
  strategies: CRAPS_STRATEGIES,
  start: (example, definition) => {
    if (!ODDS_CAPS.includes(example.table as OddsCap)) throw new Error(`${example.table} is not a craps odds cap`);
    return createActivity(
      { ...identity, game: 'craps', rules: standardCraps(example.table as OddsCap), strategy: { definition, parameters: example.parameters }, reference: null, fundingSource: 'practice-funding', funding: example.practiceFunding },
      REPLAY_STREAM,
    );
  },
  stack: (state, outcome) => {
    const craps = state as CrapsActivityState;
    if (!craps.outcome || !('dice' in outcome)) throw new Error('no roll to stack dice on');
    return { ...craps, outcome: { ...craps.outcome, dice: outcome.dice } };
  },
};

const STAGES: Partial<Record<GameId, Stage>> = { roulette: ROULETTE_STAGE, craps: CRAPS_STAGE };

function send(state: ActivityState, command: Command): { state: ActivityState; facts: readonly DomainFact[] } {
  const result = advanceActivity(state, { sequence: state.sequence, commandId: `replay-${state.sequence}`, command });
  if (result.status !== 'committed') throw new Error(`${command.kind} was ${result.status}`);
  return { state: result.state, facts: result.facts };
}

function place(state: ActivityState, wagers: readonly Wager[]): ActivityState {
  return wagers.reduce((current, wager) => send(current, { kind: 'place-wager', target: wager.target, amount: wager.amount }).state, state);
}

const corrected = (facts: readonly DomainFact[]) => facts.find((fact) => fact.kind === 'correction-offered') as (DomainFact & { explanation: Explanation }) | undefined;

const diagnosticBets = (bets: readonly Wager[]) => (bets.length === 0 ? 'no bets' : bets.map((bet) => `${bet.amount} on ${bet.target}`).join(' and '));

// Spec 3 Testing Decisions › Build-time check; Spec 1 Guided practice
export function strategyStepProblems(example: StrategyStepExample): readonly string[] {
  const problems: string[] = [];
  const stage = STAGES[example.game];
  if (!stage) return [`no worked-example replay for ${example.game} strategies yet`];
  const definition = stage.strategies.find((strategy) => strategy.id === example.strategy);
  if (!definition) return [`the worked example names no built-in ${example.game} strategy: ${example.strategy}`];
  const seen = new Set<string>();
  for (const { answer } of example.choices) {
    const key = canonicalJson([...answer.bets].sort((a, b) => a.target.localeCompare(b.target)));
    if (answer.bets.length === 0) problems.push('a worked example choice places at least one bet');
    else if (seen.has(key)) problems.push(`worked example choice ${diagnosticBets(answer.bets)} is offered twice`);
    seen.add(key);
  }
  if (problems.length > 0) return problems;

  let state: ActivityState;
  try {
    state = stage.start(example, definition);
    example.turns.forEach((turn, index) => {
      const begun = send(place(state, turn.wagers), { kind: 'begin-turn' });
      if (corrected(begun.facts)) throw new Error(`scripted turn ${index + 1} (${diagnosticBets(turn.wagers)}) does not follow ${definition.name}`);
      state = send(stage.stack(begun.state, turn.outcome), { kind: 'settle-turn' }).state;
    });
  } catch (error) {
    return [`the worked example does not replay through the engine: ${error instanceof Error ? error.message : String(error)}`];
  }
  const run = state.strategy;
  if (!run || run.status !== 'active') return [`after the scripted turns ${definition.name} has no next bet (its cycle ended)`];
  const engine = explainStrategyBets(state)!;
  if (engine.prescription.status !== 'prescribed') return [`after the scripted turns ${definition.name} places no new bets (${engine.prescription.status})`];
  const replayed = canonicalJson(engine);

  for (const { answer, response } of example.choices) {
    const label = `worked example, choice ${diagnosticBets(answer.bets)}`;
    let correction: Explanation | undefined;
    try {
      correction = corrected(send(place(state, answer.bets), { kind: 'begin-turn' }).facts)?.explanation;
    } catch (error) {
      problems.push(`${label}: does not replay through the engine: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const correct = correction === undefined;
    if (response.correct !== correct) problems.push(`${label}: scripted as ${response.correct ? 'correct' : 'incorrect'}, but the engine marks it ${correct ? 'correct' : 'incorrect'}`);
    if (correction && canonicalJson(correction) !== replayed) problems.push(`${label}: the engine's correction differs from its prescription`);
    const scripted = canonicalJson(response.explanation);
    if (scripted !== replayed) problems.push(`${label}: the scripted explanation ${scripted} differs from the engine's ${replayed}`);
    if (response.note !== null && !response.note.trim()) problems.push(`${label}: an empty note is written as null`);
  }
  if (example.choices.filter((choice) => choice.response.correct).length !== 1) problems.push('a worked example has exactly one correct choice');
  return problems;
}
