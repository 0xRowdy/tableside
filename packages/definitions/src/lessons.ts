// Spec 3 Modules › Definitions package; Lessons (#48); Amendment 1 B1, C10; #143, #145
import type { GameId, StrategyDefinition } from '@tableside/engine';

import { BLACKJACK_MODES } from './blackjack/strategies';
import { CATALOG_CATEGORIES, type CatalogCategory } from './challenges';
import { CRAPS_STRATEGIES } from './craps-strategies';
import { APP_ORIENTATION, BUILDING_A_STRATEGY } from './lessons/app-and-builder';
import { ROULETTE_STRATEGIES } from './roulette-strategies';
import { workedExampleProblems, type WorkedExample } from './worked-examples';

export type LessonSection = 'app' | 'blackjack' | 'craps' | 'roulette' | 'builder';

export interface LessonStep {
  readonly heading: string;
  readonly paragraphs: readonly string[];
}

// Spec 3 Lessons › Structure (Handoff)
export type LessonHandoff =
  | { readonly kind: 'free-play'; readonly game: GameId }
  // Spec 1 Built-in strategies
  | { readonly kind: 'guided-practice'; readonly game: GameId; readonly strategy: string | null }
  | { readonly kind: 'learn-challenge'; readonly category: CatalogCategory };

// Spec 3 Lessons › Content requirements; Amendment 1 C11
export interface LessonSource {
  readonly citation: string;
  readonly url: string | null;
}

export interface LessonContent {
  readonly version: number;
  // Spec 3 Amendment 1 C10
  readonly materialVersion: number;
  readonly change: string | null;
  readonly steps: readonly LessonStep[];
  readonly workedExample: WorkedExample | null;
  readonly handoffs: readonly LessonHandoff[];
  readonly sources: readonly LessonSource[];
}

export interface Lesson {
  readonly id: string;
  readonly title: string;
  readonly summary: string | null;
  readonly section: LessonSection;
  readonly game: GameId | null;
  readonly content: LessonContent | null;
}

// Spec 3 Lessons › Access
const sectionGame = (section: LessonSection): GameId | null => (section === 'app' || section === 'builder' ? null : section);

export { APP_ORIENTATION };

const slot = (section: LessonSection, id: string, title: string): Lesson => ({ id, title, summary: null, section, game: sectionGame(section), content: null });

// Spec 3 Lessons › Inventory, Amendment 1 B1
export const LESSONS: readonly Lesson[] = [
  APP_ORIENTATION,
  slot('blackjack', 'blackjack-basics', 'Blackjack basics'),
  slot('blackjack', 'basic-strategy', 'Basic strategy'),
  slot('blackjack', 'basic-with-deviations', 'Basic with deviations'),
  slot('blackjack', 'counting-with-basic', 'Counting with basic'),
  slot('blackjack', 'counting-with-deviations', 'Counting with deviations'),
  slot('blackjack', 'card-values', 'Card values'),
  slot('blackjack', 'running-count', 'Running count'),
  slot('blackjack', 'true-count-conversion', 'True-count conversion'),
  slot('blackjack', 'table-counting', 'Table counting'),
  slot('blackjack', 'bet-schedule', 'Bet schedule'),
  slot('craps', 'craps-basics', 'Craps basics'),
  slot('craps', 'pass-with-odds', 'Pass with odds'),
  slot('craps', 'flat-place-6-8', 'Flat place 6 and 8'),
  slot('craps', 'dont-pass-with-lay-odds', "Don't pass with lay odds"),
  slot('craps', 'three-point-molly', 'Three-point Molly (bounded)'),
  slot('craps', 'press-and-collect-6-8', 'Press-and-collect 6 and 8 (capped)'),
  slot('roulette', 'roulette-basics', 'Roulette basics'),
  slot('roulette', 'flat-even-money', 'Flat even-money'),
  slot('roulette', 'fixed-two-dozen-coverage', 'Fixed two-dozen coverage'),
  slot('roulette', 'capped-martingale', 'Capped Martingale'),
  slot('roulette', 'three-win-parlay', 'Three-win parlay'),
  slot('roulette', 'bounded-labouchere', 'Bounded Labouchere'),
  BUILDING_A_STRATEGY,
];

// Spec 3 Lessons › Entry points
export const CHALLENGE_LESSONS: Readonly<Record<CatalogCategory, string>> = {
  'card-values': 'card-values',
  'running-count': 'running-count',
  conversion: 'true-count-conversion',
  table: 'table-counting',
};

const IDENTITY = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const isVersion = (value: number) => Number.isInteger(value) && value > 0;

// Spec 3 Testing Decisions › Build-time check
export function lessonProblems(lessons: readonly Lesson[]): readonly string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const lesson of lessons) {
    const report = (problem: string) => problems.push(`${lesson.id}: ${problem}`);
    if (seen.has(lesson.id)) report('the identity is used twice');
    seen.add(lesson.id);
    if (!IDENTITY.test(lesson.id)) report('the identity is not lowercase words joined by hyphens');
    const game = sectionGame(lesson.section);
    if (lesson.game !== game) report(`a lesson in the ${lesson.section} section must be associated with ${game ?? 'no game'}, not ${lesson.game ?? 'no game'}`);
    const { content } = lesson;
    if (!content) continue;
    if (!isVersion(content.version) || !isVersion(content.materialVersion)) report('the version is not a positive whole number');
    else if (content.materialVersion > content.version) report('the material-change version is after the current version');
    else if (content.materialVersion > 1 && !content.change) report('a material change needs its explanation');
    else if (content.materialVersion === 1 && content.change !== null) report('only a material change has an explanation');
    if (content.steps.length === 0) report('a lesson has at least one step');
    content.steps.forEach((step, index) => {
      if (!step.heading.trim()) report(`step ${index + 1} has no heading`);
      if (!step.paragraphs.some((paragraph) => paragraph.trim())) report(`step ${index + 1} has no text`);
    });
    if (content.workedExample) workedExampleProblems(content.workedExample, content.steps.length).forEach(report);
    const offered = new Set<string>();
    content.handoffs.forEach((handoff, index) => {
      const problem = handoffProblem(lesson, handoff);
      const key = JSON.stringify(handoff);
      if (problem) report(`handoff ${index + 1} ${problem}`);
      else if (offered.has(key)) report(`handoff ${index + 1} repeats an earlier one`);
      offered.add(key);
    });
  }
  return problems;
}

const strategyIds = (strategies: readonly StrategyDefinition[]) => strategies.map((strategy) => strategy.id);
const BUILT_IN_STRATEGIES: Readonly<Record<GameId, readonly string[]>> = {
  blackjack: BLACKJACK_MODES,
  craps: strategyIds(CRAPS_STRATEGIES),
  roulette: strategyIds(ROULETTE_STRATEGIES),
};
const GAMES = Object.keys(BUILT_IN_STRATEGIES) as GameId[];

// Spec 3 Testing Decisions › Build-time check
function handoffProblem(lesson: Lesson, handoff: LessonHandoff): string | null {
  const target = handoff as { kind?: unknown; game?: unknown; strategy?: unknown; category?: unknown };
  let game: GameId;
  if (target.kind === 'learn-challenge') {
    if (!CATALOG_CATEGORIES.includes(target.category as CatalogCategory)) return `names no counting challenge: ${String(target.category)}`;
    game = 'blackjack';
  } else if (target.kind === 'free-play' || target.kind === 'guided-practice') {
    if (!GAMES.includes(target.game as GameId)) return `opens no game setup: ${String(target.game)}`;
    game = target.game as GameId;
    if (target.kind === 'guided-practice' && target.strategy !== null && !BUILT_IN_STRATEGIES[game].includes(target.strategy as string)) {
      return `names no built-in ${game} strategy: ${String(target.strategy)}`;
    }
  } else {
    return 'is not free play, guided practice or a Learn challenge';
  }
  if (lesson.game !== null && game !== lesson.game) return `opens ${game} setup from a ${lesson.game} lesson`;
  return null;
}
