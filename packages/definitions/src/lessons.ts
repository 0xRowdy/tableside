// Spec 3 Modules › Definitions package; Lessons (#48); Amendment 1 B1, C10; #143, #145
import type { GameId, StrategyDefinition } from '@tableside/engine';

import { BLACKJACK_MODES } from './blackjack/strategies';
import { BASIC_STRATEGY, BASIC_WITH_DEVIATIONS, BET_SCHEDULE_LESSON, BLACKJACK_BASICS, COUNTING_WITH_BASIC, COUNTING_WITH_DEVIATIONS } from './lessons/blackjack';
import { CATALOG_CATEGORIES, type CatalogCategory } from './challenges';
import { CRAPS_STRATEGIES } from './craps-strategies';
import { ROULETTE_STRATEGIES } from './roulette-strategies';
import { workedExampleProblems, type WorkedExample } from './worked-examples';

export type LessonSection = 'app' | 'blackjack' | 'craps' | 'roulette' | 'builder';

export interface LessonStep {
  readonly heading: string;
  readonly paragraphs: readonly string[];
  // Spec 3 Amendment 1 B2; Amendment 2 §3 (lesson player); S3-12 l8pMS
  readonly publishedNote?: PublishedNote;
  // Spec 3 Lessons › Content requirements; Amendment 1 C11; Amendment 2 §3 (lesson player)
  readonly source?: LessonSource;
}

// Spec 3 Amendment 1 B2; Amendment 2 §3 (lesson player); S3-12 l8pMS
export interface PublishedNote {
  readonly paragraphs: readonly string[];
  readonly source: LessonSource;
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

const slot = (section: LessonSection, id: string, title: string): Lesson => ({ id, title, summary: null, section, game: sectionGame(section), content: null });

export const APP_ORIENTATION: Lesson = {
  id: 'app-orientation',
  title: 'App orientation',
  summary: 'Tabs, help, practice vs casino records',
  section: 'app',
  game: null,
  content: {
    version: 1,
    materialVersion: 1,
    change: null,
    steps: [
      {
        heading: 'Find your way around',
        paragraphs: [
          'Six tabs sit along the bottom of every screen. Home has the three games. Play is the practice table. Counting holds the four counting challenges. Community is for strategies other players share. Saved keeps what you record. More holds Settings.',
          'Nothing is in a fixed order. Open any tab, any game or any lesson whenever you like.',
        ],
      },
      {
        heading: 'Help when you need it',
        paragraphs: [
          'The first time you meet an unfamiliar control, such as the bet selector or count entry, a short hint explains it. Dismiss it and it stays dismissed on this device.',
          'Every lesson, this one included, stays in More › Settings › Learning, where you can also bring the hints back. During a Check attempt, help with entering answers, pausing and skipping stays open; teaching waits until the attempt ends.',
        ],
      },
      {
        heading: 'Practice records and casino records',
        paragraphs: [
          'Tableside keeps two kinds of records apart. A practice session is simulated play with practice funding, and its results add up to your practice totals. A casino session is real play you record yourself, in your own currency, with your buy-ins and cash-out. Casino sessions are private and describe only what you recorded.',
          "Counting challenge results are kept apart again: they score your accuracy, never winnings. None of these records predicts how you'll do next time.",
        ],
      },
      {
        heading: 'Lessons at your own pace',
        paragraphs: [
          'A lesson keeps your place. Leave at any step, and next time you can resume there or restart from step 1.',
          "Finishing a lesson just marks it completed. It never scores you, awards anything or unlocks anything, and there's no test at the end.",
        ],
      },
    ],
    workedExample: null,
    handoffs: [],
    sources: [],
  },
};

// Spec 3 Lessons › Inventory, Amendment 1 B1
export const LESSONS: readonly Lesson[] = [
  APP_ORIENTATION,
  BLACKJACK_BASICS,
  BASIC_STRATEGY,
  BASIC_WITH_DEVIATIONS,
  COUNTING_WITH_BASIC,
  COUNTING_WITH_DEVIATIONS,
  slot('blackjack', 'card-values', 'Card values'),
  slot('blackjack', 'running-count', 'Running count'),
  slot('blackjack', 'true-count-conversion', 'True-count conversion'),
  slot('blackjack', 'table-counting', 'Table counting'),
  BET_SCHEDULE_LESSON,
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
  slot('builder', 'building-a-strategy', 'Building a strategy'),
];

// Spec 3 Lessons › Entry points
export const CHALLENGE_LESSONS: Readonly<Record<CatalogCategory, string>> = {
  'card-values': 'card-values',
  'running-count': 'running-count',
  conversion: 'true-count-conversion',
  table: 'table-counting',
};

const IDENTITY = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const sameSource = (a: LessonSource, b: LessonSource) => a.citation === b.citation && a.url === b.url;
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
      if (step.publishedNote && !step.publishedNote.paragraphs.some((paragraph) => paragraph.trim())) report(`step ${index + 1} has an empty note on the published value`);
      if (step.publishedNote && step.source) report(`step ${index + 1} cites its source twice: a note on the published value carries the step's source`);
      const cited = step.publishedNote?.source ?? step.source;
      if (cited && !content.sources.some((source) => sameSource(source, cited))) report(`step ${index + 1} cites a source missing from the lesson’s sources`);
    });
    content.sources.forEach((source, index) => {
      if (!source.citation.trim()) report(`source ${index + 1} has no citation`);
      else if (source.url !== null && !source.url.startsWith('https://')) report(`source ${index + 1} is not an https link`);
      else if (content.sources.slice(0, index).some((earlier) => sameSource(earlier, source))) report(`source ${index + 1} repeats an earlier one`);
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
