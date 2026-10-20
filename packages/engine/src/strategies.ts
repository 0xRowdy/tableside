// The strategy operations of the engine interface: Validate definitions and
// configuration, setup compatibility with a chosen table, and Explain
// prescription. Each game module registers its strategy vocabulary here.

import { ROULETTE_VOCABULARY, type RouletteLimits, type RouletteSituation } from './roulette-strategy';
import {
  compatibilityWith,
  parameterProblem,
  prescribe,
  progressProblem,
  validateWith,
  type Explanation,
  type StrategyDefinition,
  type StrategyProgress,
  type StrategyValidation,
  type StrategyVocabulary,
  type TableRequirement,
} from './strategy';
import type { RouletteWheel } from './draws';

interface GameStrategies {
  readonly vocabulary: StrategyVocabulary;
  /** The game's rule content in its vocabulary's table shape. */
  tableForRules(rules: unknown): unknown;
}

const GAMES: Readonly<Record<string, GameStrategies>> = {
  roulette: {
    vocabulary: ROULETTE_VOCABULARY as StrategyVocabulary,
    tableForRules: (rules) => {
      const { wheel, limits } = rules as { wheel: RouletteWheel; limits: RouletteLimits };
      return { wheels: [wheel], limits };
    },
  },
};

const gameOf = (definition: unknown): GameStrategies | undefined =>
  typeof definition === 'object' && definition !== null ? GAMES[(definition as { game?: unknown }).game as string] : undefined;

/** Validate: diagnostics with instruction paths in five categories, and whether the strategy is runnable (Amendment 7). */
export function validateStrategy(definition: unknown): StrategyValidation {
  const game = gameOf(definition);
  if (!game) return { diagnostics: [{ category: 'incomplete', path: '/game', message: 'unknown game' }], runnable: false };
  return validateWith(game.vocabulary, definition);
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
  const game = gameOf(definition) as GameStrategies;
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
export function explainPrescription(definition: StrategyDefinition, parameters: unknown, situation: RouletteSituation, progress: StrategyProgress): ExplainResult {
  const game = gameOf(definition);
  if (!game) return { ok: false, error: 'unknown game' };
  if (!validateWith(game.vocabulary, definition).runnable) return { ok: false, error: 'the strategy is not runnable' };
  const parameterError = parameterProblem(definition, parameters);
  if (parameterError) return { ok: false, error: parameterError };
  const situationError = game.vocabulary.situationProblem(situation);
  if (situationError) return { ok: false, error: situationError };
  if (situation.game !== definition.game) return { ok: false, error: `a ${definition.game} strategy needs a ${definition.game} situation` };
  const mismatch = game.vocabulary.tableMismatch(definition.table, game.vocabulary.tableOf(situation));
  if (mismatch.length > 0) return { ok: false, error: `the strategy isn't declared for this table (${mismatch.map((m) => m.requirement).join(', ')})` };
  const progressError = progressProblem(definition, progress);
  if (progressError) return { ok: false, error: progressError };
  return { ok: true, explanation: prescribe(game.vocabulary, definition, parameters as Record<string, string>, situation, progress) };
}
