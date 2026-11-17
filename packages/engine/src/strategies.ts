import { CRAPS_STRATEGY } from './craps-strategy';
import { BLACKJACK_STRATEGY, playSituationProblem, policyOf, prescribePlay, type BlackjackPlayRules, type PlayExplanation } from './blackjack-strategy';
import { ROULETTE_STRATEGY } from './roulette-strategy';
import {
  compatibilityWith,
  parameterProblem,
  prescribe,
  progressProblem,
  validateWith,
  type Explanation,
  type StrategyDefinition,
  type StrategyGame,
  type StrategyProgress,
  type StrategyValidation,
  type TableRequirement,
} from './strategy';

const GAMES: Readonly<Record<string, StrategyGame<never>>> = {
  roulette: ROULETTE_STRATEGY as StrategyGame<never>,
  craps: CRAPS_STRATEGY as StrategyGame<never>,
  blackjack: BLACKJACK_STRATEGY as unknown as StrategyGame<never>,
};

export const strategyGame = (game: unknown): StrategyGame<never> | undefined =>
  typeof game === 'string' && Object.hasOwn(GAMES, game) ? GAMES[game] : undefined;

const gameOf = (definition: unknown) =>
  typeof definition === 'object' && definition !== null ? strategyGame((definition as { game?: unknown }).game) : undefined;

// Spec 1 Amendment 7
export function validateStrategy(definition: unknown, parameters?: unknown): StrategyValidation {
  const game = gameOf(definition);
  if (!game) return { diagnostics: [{ category: 'incomplete', path: '/game', message: 'no strategy vocabulary for this game' }], runnable: false };
  return validateWith(game.vocabulary, definition, parameters);
}

export interface TableCompatibility {
  readonly compatible: boolean;
  readonly requirements: readonly TableRequirement[];
}

export function strategyTableCompatibility(definition: StrategyDefinition, parameters: unknown, rules: unknown): TableCompatibility {
  const game = gameOf(definition);
  if (!game) return { compatible: false, requirements: [{ path: '/game', requirement: 'game' }] };
  const requirements = compatibilityWith(game.vocabulary, definition, parameters, game.tableForRules(rules));
  return { compatible: requirements.length === 0, requirements };
}

export type ExplainResult =
  | { readonly ok: true; readonly explanation: Explanation }
  | { readonly ok: false; readonly error: string };

export function explainPrescription(definition: StrategyDefinition, parameters: unknown, situation: unknown, progress: StrategyProgress): ExplainResult {
  const game = gameOf(definition);
  if (!game) return { ok: false, error: 'no strategy vocabulary for this game' };
  const { vocabulary } = game;
  if (!validateWith(vocabulary, definition).runnable) return { ok: false, error: 'the strategy is not runnable' };
  const parameterError = parameterProblem(definition, parameters);
  if (parameterError) return { ok: false, error: parameterError };
  const situationError = vocabulary.situationProblem(situation);
  if (situationError) return { ok: false, error: situationError };
  const mismatch = vocabulary.tableMismatch(definition.table, vocabulary.tableOf(situation));
  if (mismatch.length > 0) return { ok: false, error: `the strategy isn't declared for this table (${mismatch.map((m) => m.requirement).join(', ')})` };
  const progressError = progressProblem(definition, progress);
  if (progressError) return { ok: false, error: progressError };
  return { ok: true, explanation: prescribe(vocabulary, { definition, parameters: parameters as Record<string, string> }, situation, progress) };
}

export type ExplainPlayResult = { readonly ok: true; readonly explanation: PlayExplanation } | { readonly ok: false; readonly error: string };

export function explainPlay(definition: StrategyDefinition, situation: unknown): ExplainPlayResult {
  if (gameOf(definition) !== GAMES.blackjack) return { ok: false, error: 'no playing policy for this game' };
  if (!validateStrategy(definition).runnable) return { ok: false, error: 'the strategy is not runnable' };
  const policy = policyOf(definition);
  if (!policy) return { ok: false, error: 'the strategy has no playing policy' };
  const problem = playSituationProblem(situation);
  if (problem) return { ok: false, error: problem };
  const playing = situation as Parameters<typeof prescribePlay>[1];
  const table = definition.table as BlackjackPlayRules;
  if (table.dealer !== playing.rules.dealer || table.lateSurrender !== playing.rules.lateSurrender) return { ok: false, error: "the strategy isn't declared for these rules" };
  return { ok: true, explanation: prescribePlay(policy, playing) };
}
