// Spec 3 Lessons › Structure (worked examples); Testing Decisions › Build-time check; #144
import {
  advanceChallenge,
  canonicalJson,
  createChallenge,
  HI_LO_VALUES,
  RANDOM_PROTOCOL_VERSION,
  readChallengeView,
  type ChallengeCard,
  type ChallengeCommand,
  type ChallengeState,
  type HiLoExplanation,
  type HiLoValue,
  type LearnFeedback,
} from '@tableside/engine';

import { CARD_VALUES_CONTENT } from './challenges';

export interface ScriptedResponse<Explanation> {
  readonly correct: boolean;
  readonly explanation: Explanation;
  readonly note: string | null;
}

export interface ScriptedChoice<Answer, Explanation> {
  readonly answer: Answer;
  readonly response: ScriptedResponse<Explanation>;
}

export interface CardValueExample {
  readonly kind: 'card-value';
  readonly step: number;
  readonly card: ChallengeCard;
  readonly choices: readonly ScriptedChoice<HiLoValue, HiLoExplanation>[];
}

export type WorkedExample = CardValueExample;

const SUITS: readonly string[] = ['clubs', 'diamonds', 'hearts', 'spades'];
const isCard = (card: ChallengeCard) => Number.isInteger(card.rank) && card.rank >= 1 && card.rank <= 13 && SUITS.includes(card.suit);
const answerText = (answer: HiLoValue) => (answer > 0 ? `+${answer}` : String(answer));

// Spec 1 Testing Decisions (fixed-scenario fixtures): the scripted card is stacked first, as the reference tests stack a shoe
const REPLAY_STREAM = { protocol: RANDOM_PROTOCOL_VERSION, key: [0, 0], session: [0, 0] } as const;

function commit(state: ChallengeState, command: ChallengeCommand): ChallengeState {
  const result = advanceChallenge(state, { sequence: state.sequence, commandId: `replay-${state.sequence}`, command });
  if (result.status !== 'committed') throw new Error(`${command.kind} was not committed`);
  return result.state;
}

function replayCardValue(card: ChallengeCard, answer: HiLoValue): LearnFeedback {
  const created = createChallenge({ attemptId: 'worked-example', owner: 'worked-example', device: 'build', variant: 'learn', content: CARD_VALUES_CONTENT }, REPLAY_STREAM);
  const begun = commit(created, { kind: 'begin' });
  const stacked: ChallengeState = { ...begun, items: [{ card }, ...begun.items.slice(1)] };
  const view = readChallengeView(commit(stacked, { kind: 'answer', value: answer }));
  if (view.variant !== 'learn' || !view.feedback) throw new Error('the replay gave no Learn feedback');
  return view.feedback;
}

export function workedExampleProblems(example: WorkedExample, steps: number): readonly string[] {
  const problems: string[] = [];
  if (!Number.isInteger(example.step) || example.step < 1 || example.step > steps) problems.push(`the worked example is on step ${example.step}, but the lesson has ${steps} steps`);
  if (example.choices.length < 2) problems.push('a worked example offers at least two choices');
  const seen = new Set<HiLoValue>();
  for (const { answer } of example.choices) {
    if (!HI_LO_VALUES.includes(answer)) problems.push(`worked example choice ${String(answer)} is not a Hi-Lo value`);
    else if (seen.has(answer)) problems.push(`worked example choice ${answerText(answer)} is offered twice`);
    seen.add(answer);
  }
  if (example.choices.filter((choice) => choice.response.correct).length !== 1) problems.push('a worked example has exactly one correct choice');
  if (!isCard(example.card)) problems.push("the worked example's card is not a playing card");
  if (problems.length > 0) return problems;

  for (const { answer, response } of example.choices) {
    const label = `worked example, choice ${answerText(answer)}`;
    let engine: LearnFeedback;
    try {
      engine = replayCardValue(example.card, answer);
    } catch (error) {
      problems.push(`${label}: does not replay through the engine: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (response.correct !== engine.correct) {
      problems.push(`${label}: scripted as ${response.correct ? 'correct' : 'incorrect'}, but the engine marks it ${engine.correct ? 'correct' : 'incorrect'}`);
    }
    const scripted = canonicalJson(response.explanation);
    const replayed = canonicalJson(engine.explanation);
    if (scripted !== replayed) problems.push(`${label}: the scripted explanation ${scripted} differs from the engine's ${replayed}`);
    if (response.note !== null && !response.note.trim()) problems.push(`${label}: an empty note is written as null`);
  }
  return problems;
}
