// The strategy operations of the engine interface: Validate definitions and
// configuration, setup compatibility with a chosen table, and Explain
// prescription. Each game module that supports guided practice registers its
// strategy game here (its vocabulary, table conditions and betting
// situation); the session protocol and these operations reach games only
// through this registry.

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
};

/** The strategy game for a game id, when that game supports guided practice. */
export const strategyGame = (game: unknown): StrategyGame<never> | undefined =>
  typeof game === 'string' && Object.hasOwn(GAMES, game) ? GAMES[game] : undefined;

const gameOf = (definition: unknown) =>
  typeof definition === 'object' && definition !== null ? strategyGame((definition as { game?: unknown }).game) : undefined;

/**
 * Validate: diagnostics with instruction paths in five categories, and whether
 * the strategy is runnable (Amendment 7). With parameters, the session's
 * configuration (its chosen targets) is validated too.
 */
export function validateStrategy(definition: unknown, parameters?: unknown): StrategyValidation {
  const game = gameOf(definition);
  if (!game) return { diagnostics: [{ category: 'incomplete', path: '/game', message: 'no strategy vocabulary for this game' }], runnable: false };
  return validateWith(game.vocabulary, definition, parameters);
}

export interface TableCompatibility {
  readonly compatible: boolean;
  readonly requirements: readonly TableRequirement[];
}

/**
 * Whether a runnable strategy with these parameters fits a different table,
 * chosen at setup, naming every requirement it fails. Amounts are never adjusted.
 */
export function strategyTableCompatibility(definition: StrategyDefinition, parameters: unknown, rules: unknown): TableCompatibility {
  const game = gameOf(definition);
  if (!game) return { compatible: false, requirements: [{ path: '/game', requirement: 'game' }] };
  const requirements = compatibilityWith(game.vocabulary, definition, parameters, game.tableForRules(rules));
  return { compatible: requirements.length === 0, requirements };
}

export type ExplainResult =
  | { readonly ok: true; readonly explanation: Explanation }
  | { readonly ok: false; readonly error: string };

/**
 * Explain prescription: what a validated strategy prescribes for one game
 * situation (including balance) and strategy state, or why it pauses, with
 * the structured explanation facts. Pure and read-only: no draws, no effects.
 * It rejects situations the game can't represent or that contradict the rules,
 * and matches what Advance activity prescribes for the same situation and state.
 */
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
  return { ok: true, explanation: prescribe(vocabulary, definition, parameters as Record<string, string>, situation, progress) };
}
