// Spec 3 Lessons › Structure (worked examples); Testing Decisions › Build-time check; #144, #155
import {
  advanceActivity,
  canonicalJson,
  canonicalShoe,
  createActivity,
  explainStrategyBets,
  RANDOM_PROTOCOL_VERSION,
  ODDS_CAPS,
  strategyPlay,
  type ActivityState,
  type BlackjackActivityState,
  type Command,
  type CrapsActivityState,
  type DomainFact,
  type Explanation,
  type GameId,
  type OddsCap,
  type PlayExplanation,
  type PlayMove,
  type Rank,
  type RouletteActivityState,
  type RoulettePocket,
  type StrategyDefinition,
  type Wager,
} from '@tableside/engine';

import { basicStrategy, BLACKJACK_PRESETS, playingDeviations, type BlackjackPreset, type CardValue } from './blackjack/reference';
import { blackjackRules } from './blackjack/rules';
import { BLACKJACK_MODES, BLACKJACK_REFERENCE_IDENTITY, blackjackStrategy, countingMode, type BlackjackMode } from './blackjack/strategies';
import { CRAPS_STRATEGIES } from './craps-strategies';
import { standardCraps } from './craps';
import { ROULETTE_PRESETS } from './roulette';
import { ROULETTE_STRATEGIES } from './roulette-strategies';
import type { ScriptedChoice } from './worked-examples';

export interface ScriptedTurn {
  readonly wagers: readonly Wager[];
  readonly outcome: ScriptedOutcome;
}

export interface RouletteOutcome {
  readonly pocket: RoulettePocket;
}

export interface CrapsOutcome {
  readonly dice: readonly [number, number];
}

// #152
export interface BlackjackOutcome {
  readonly shown: readonly Rank[];
  readonly dealt: readonly Rank[];
}

export type ScriptedOutcome = RouletteOutcome | CrapsOutcome | BlackjackOutcome;

export interface StrategyBetsAnswer {
  readonly kind: 'bets';
  readonly bets: readonly Wager[];
}

// #152
export interface StrategyPlayAnswer {
  readonly kind: 'play';
  readonly move: PlayMove;
}

export type StrategyStepAnswer = StrategyBetsAnswer | StrategyPlayAnswer;

// Spec 3 Lessons › Structure (worked examples)
export type StrategyStepExplanation = Explanation | PlayExplanation;

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
  // #152
  readonly definition?: (example: StrategyStepExample) => StrategyDefinition | undefined;
  readonly replayTurn?: (state: ActivityState, turn: ScriptedTurn, open: boolean) => ActivityState;
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


// #152
const RANK_TEXT = (rank: Rank) => (rank === 1 ? 'A' : rank >= 10 ? 'T' : String(rank));

function stackShoe(state: BlackjackActivityState, outcome: BlackjackOutcome): BlackjackActivityState {
  const cards = canonicalShoe(state.rules.decks);
  const order = state.shoe?.order ?? cards.map((_, index) => index);
  const next = state.shoe?.next ?? 0;
  const remaining = order.slice(next);
  const top = [...outcome.shown, ...outcome.dealt].map((rank) => {
    const at = remaining.findIndex((index) => cards[index]!.rank === rank);
    if (at < 0) throw new Error(`no ${RANK_TEXT(rank)} left to stack`);
    return remaining.splice(at, 1)[0]!;
  });
  const cut = Math.floor((cards.length * state.rules.penetration) / 100);
  return { ...state, shoe: { order: [...order.slice(0, next), ...top, ...remaining], next: next + outcome.shown.length, cut } };
}

const isBlackjackOutcome = (outcome: ScriptedOutcome): outcome is BlackjackOutcome => 'dealt' in outcome;
const MAX_SCRIPTED_DECISIONS = 20;

// Spec 1 Built-in strategies, Guided practice
const BLACKJACK_STAGE: Stage = {
  strategies: [],
  definition: (example) => {
    const preset = example.table as BlackjackPreset;
    const mode = example.strategy as BlackjackMode;
    if (!BLACKJACK_PRESETS.includes(preset) || !BLACKJACK_MODES.includes(mode)) return undefined;
    const schedule = example.parameters['bet-schedule'] === 'on';
    return schedule && !countingMode(mode) ? undefined : blackjackStrategy(preset, mode, schedule);
  },
  start: (example, definition) =>
    createActivity(
      {
        ...identity,
        game: 'blackjack',
        rules: blackjackRules(example.table as BlackjackPreset),
        strategy: { definition, parameters: {} },
        reference: { ...BLACKJACK_REFERENCE_IDENTITY },
        fundingSource: 'practice-funding',
        funding: example.practiceFunding,
      },
      REPLAY_STREAM,
    ),
  stack: (state, outcome) => {
    if (!isBlackjackOutcome(outcome)) throw new Error('a blackjack turn stacks cards');
    return stackShoe(state as BlackjackActivityState, outcome);
  },
  replayTurn: (state, turn, open) => {
    const begun = send(BLACKJACK_STAGE.stack(place(state, turn.wagers), turn.outcome), { kind: 'begin-turn' });
    if (corrected(begun.facts)) throw new Error(`the scripted bet (${diagnosticBets(turn.wagers)}) does not follow the strategy`);
    let current = begun.state;
    if (open) return current;
    for (let decision = 0; decision < MAX_SCRIPTED_DECISIONS; decision++) {
      if (current.phase === 'revealing-outcome') return send(current, { kind: 'settle-turn' }).state;
      const command = strategyPlay(current);
      if (!command) throw new Error(`the scripted round stops at a ${current.phase} the strategy can't play`);
      current = send(current, command).state;
    }
    throw new Error('the scripted round never finishes');
  },
};

const STAGES: Partial<Record<GameId, Stage>> = { roulette: ROULETTE_STAGE, craps: CRAPS_STAGE, blackjack: BLACKJACK_STAGE };

function send(state: ActivityState, command: Command): { state: ActivityState; facts: readonly DomainFact[] } {
  const result = advanceActivity(state, { sequence: state.sequence, commandId: `replay-${state.sequence}`, command });
  if (result.status !== 'committed') throw new Error(`${command.kind} was ${result.status}`);
  return { state: result.state, facts: result.facts };
}

function place(state: ActivityState, wagers: readonly Wager[]): ActivityState {
  return wagers.reduce((current, wager) => send(current, { kind: 'place-wager', target: wager.target, amount: wager.amount }).state, state);
}

const corrected = (facts: readonly DomainFact[]) => facts.find((fact) => fact.kind === 'correction-offered') as (DomainFact & { explanation: StrategyStepExplanation }) | undefined;

const diagnosticBets = (bets: readonly Wager[]) => (bets.length === 0 ? 'no bets' : bets.map((bet) => `${bet.amount} on ${bet.target}`).join(' and '));

// Spec 3 Testing Decisions › Build-time check; Spec 1 Guided practice
export function strategyStepProblems(example: StrategyStepExample): readonly string[] {
  const problems: string[] = [];
  const stage = STAGES[example.game];
  if (!stage) return [`no worked-example replay for ${example.game} strategies yet`];
  const definition = stage.definition ? stage.definition(example) : stage.strategies.find((strategy) => strategy.id === example.strategy);
  if (!definition) return [`the worked example names no built-in ${example.game} strategy: ${example.strategy}`];
  const playing = example.choices.some((choice) => choice.answer.kind === 'play');
  if (playing && (!stage.replayTurn || example.choices.some((choice) => choice.answer.kind !== 'play'))) return ['a worked example asks for bets or for a play, not both, in a game with plays'];
  if (playing && example.turns.length === 0) return ['a worked example asking for a play deals the hand in its last turn'];
  const seen = new Set<string>();
  for (const { answer } of example.choices) {
    const key = answer.kind === 'play' ? canonicalJson(answer.move) : canonicalJson([...answer.bets].sort((a, b) => a.target.localeCompare(b.target)));
    if (answer.kind === 'bets' && answer.bets.length === 0) problems.push('a worked example choice places at least one bet');
    else if (seen.has(key)) problems.push(`worked example choice ${answerText(answer)} is offered twice`);
    seen.add(key);
  }
  if (problems.length > 0) return problems;

  let state: ActivityState;
  try {
    state = stage.start(example, definition);
    example.turns.forEach((turn, index) => {
      if (stage.replayTurn) {
        state = stage.replayTurn(state, turn, playing && index === example.turns.length - 1);
        return;
      }
      const begun = send(place(state, turn.wagers), { kind: 'begin-turn' });
      if (corrected(begun.facts)) throw new Error(`scripted turn ${index + 1} (${diagnosticBets(turn.wagers)}) does not follow ${definition.name}`);
      state = send(stage.stack(begun.state, turn.outcome), { kind: 'settle-turn' }).state;
    });
  } catch (error) {
    return [`the worked example does not replay through the engine: ${error instanceof Error ? error.message : String(error)}`];
  }
  return playing ? playProblems(example, state) : betProblems(example, state, definition);
}

const answerText = (answer: StrategyStepAnswer) => (answer.kind === 'play' ? answer.move.action : diagnosticBets(answer.bets));

function betProblems(example: StrategyStepExample, state: ActivityState, definition: StrategyDefinition): readonly string[] {
  const problems: string[] = [];
  const run = state.strategy;
  if (!run || run.status !== 'active') return [`after the scripted turns ${definition.name} has no next bet (its cycle ended)`];
  const engine = explainStrategyBets(state)!;
  if (engine.prescription.status !== 'prescribed') return [`after the scripted turns ${definition.name} places no new bets (${engine.prescription.status})`];
  const replayed = canonicalJson(engine);

  for (const { answer, response } of example.choices) {
    if (answer.kind !== 'bets') continue;
    const label = `worked example, choice ${diagnosticBets(answer.bets)}`;
    let correction: StrategyStepExplanation | undefined;
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

const moveCommand = (move: PlayMove): Command =>
  move.action === 'insure' ? { kind: 'place-wager', target: 'insurance', amount: move.amount ?? '0' } : { kind: 'play', action: move.action };

// #152; Spec 1 Guided practice (corrections); the certified basic and index files
function playProblems(example: StrategyStepExample, state: ActivityState): readonly string[] {
  const problems: string[] = [];
  const replays = example.choices.map(({ answer, response }) => {
    const move = (answer as StrategyPlayAnswer).move;
    const label = `worked example, choice ${move.action}`;
    try {
      return { label, response, correction: corrected(send(state, moveCommand(move)).facts)?.explanation as PlayExplanation | undefined };
    } catch (error) {
      problems.push(`${label}: does not replay through the engine: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  });
  const engine = replays.find((replay) => replay?.correction)?.correction;
  if (!engine) return [...problems, 'a worked example offers at least one play the strategy corrects'];
  const replayed = canonicalJson(engine);
  for (const replay of replays) {
    if (!replay) continue;
    const { label, response, correction } = replay;
    const correct = correction === undefined;
    if (response.correct !== correct) problems.push(`${label}: scripted as ${response.correct ? 'correct' : 'incorrect'}, but the engine marks it ${correct ? 'correct' : 'incorrect'}`);
    if (correction && canonicalJson(correction) !== replayed) problems.push(`${label}: the engine explains this decision differently for another choice`);
    const scripted = canonicalJson(response.explanation);
    if (scripted !== replayed) problems.push(`${label}: the scripted explanation ${scripted} differs from the engine's ${replayed}`);
    if (response.note !== null && !response.note.trim()) problems.push(`${label}: an empty note is written as null`);
  }
  if (example.choices.filter((choice) => choice.response.correct).length !== 1) problems.push('a worked example has exactly one correct choice');
  return [...problems, ...certifiedProblems(engine, example.table as BlackjackPreset)];
}

// Spec 3 Lessons › Structure (worked examples): prescriptions match the certified reference
function certifiedProblems(explanation: PlayExplanation, preset: BlackjackPreset): readonly string[] {
  const problems: string[] = [];
  const { cell, deviation } = explanation;
  if (cell?.table === 'first') {
    const reference = basicStrategy(preset, cell.kind, cell.hand, cell.up as CardValue).action;
    if (reference !== cell.play) problems.push(`the engine plays ${cell.kind} ${cell.hand} vs ${cell.up} as ${cell.play}, but the certified ${preset} table says ${reference}`);
  }
  if (deviation) {
    const row = playingDeviations(preset).find((candidate) => `${candidate.dealerRule} ${candidate.situation}` === deviation.id);
    if (row?.threshold !== deviation.threshold) problems.push(`the engine's index for ${deviation.situation} is not the certified ${preset} value`);
  }
  return problems;
}
