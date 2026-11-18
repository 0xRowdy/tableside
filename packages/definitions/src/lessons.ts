// Spec 3 Modules › Definitions package; Lessons (#48); Amendment 1 B1, C10; #143, #145, #153
import { CHALLENGE_CATEGORIES, type ChallengeCategory, type GameId, type StrategyDefinition } from '@tableside/engine';

import { BLACKJACK_MODES, countingMode, type BlackjackMode } from './blackjack/strategies';
import { BASIC_STRATEGY, BASIC_WITH_DEVIATIONS, BET_SCHEDULE_LESSON, BLACKJACK_BASICS, COUNTING_WITH_BASIC, COUNTING_WITH_DEVIATIONS } from './lessons/blackjack';
import { CARD_VALUES_LESSON, CONVERSION_LESSON, RUNNING_COUNT_LESSON, TABLE_COUNTING_LESSON } from './lessons/counting';
import { CRAPS_STRATEGIES } from './craps-strategies';
import { APP_ORIENTATION, BUILDING_A_STRATEGY } from './lessons/app-and-builder';
import { CRAPS_LESSONS } from './lessons/craps';
import { ROULETTE_LESSONS } from './lessons/roulette';
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
  | { readonly kind: 'guided-practice'; readonly game: GameId; readonly strategy: string | null; readonly betSchedule?: boolean }
  | { readonly kind: 'learn-challenge'; readonly category: ChallengeCategory };

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

// Spec 3 Lessons › Inventory, Amendment 1 B1
export const LESSONS: readonly Lesson[] = [
  APP_ORIENTATION,
  BLACKJACK_BASICS,
  BASIC_STRATEGY,
  BASIC_WITH_DEVIATIONS,
  COUNTING_WITH_BASIC,
  COUNTING_WITH_DEVIATIONS,
  CARD_VALUES_LESSON,
  RUNNING_COUNT_LESSON,
  CONVERSION_LESSON,
  TABLE_COUNTING_LESSON,
  BET_SCHEDULE_LESSON,
  ...CRAPS_LESSONS,
  ...ROULETTE_LESSONS,
  BUILDING_A_STRATEGY,
];

// Spec 3 Lessons › Entry points
export const CHALLENGE_LESSONS: Readonly<Record<ChallengeCategory, string>> = {
  'card-values': 'card-values',
  'running-count': 'running-count',
  conversion: 'true-count-conversion',
  table: 'table-counting',
};

// Spec 3 Lessons › Check protection; Amendment 1 A2
export const CHECK_WITHHELD_LESSONS: { readonly anyCheck: readonly string[]; readonly playCheck: readonly string[] } = {
  anyCheck: Object.values(CHALLENGE_LESSONS),
  playCheck: [BASIC_STRATEGY.id, BASIC_WITH_DEVIATIONS.id, COUNTING_WITH_BASIC.id, COUNTING_WITH_DEVIATIONS.id, BET_SCHEDULE_LESSON.id],
};

// Spec 3 Amendment 1 A2, Amendment 3
export const PLAY_CHECK_WITHHELD_MODES: readonly BlackjackMode[] = ['basic-with-deviations', 'counting-with-basic', 'counting-with-deviations'];

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
  const target = handoff as { kind?: unknown; game?: unknown; strategy?: unknown; category?: unknown; betSchedule?: unknown };
  let game: GameId;
  if (target.kind === 'learn-challenge') {
    if (!CHALLENGE_CATEGORIES.includes(target.category as ChallengeCategory)) return `names no counting challenge: ${String(target.category)}`;
    game = 'blackjack';
  } else if (target.kind === 'free-play' || target.kind === 'guided-practice') {
    if (!GAMES.includes(target.game as GameId)) return `opens no game setup: ${String(target.game)}`;
    game = target.game as GameId;
    if (target.kind === 'guided-practice' && target.strategy !== null && !BUILT_IN_STRATEGIES[game].includes(target.strategy as string)) {
      return `names no built-in ${game} strategy: ${String(target.strategy)}`;
    }
    // Spec 1 S1-02
    if (target.kind === 'guided-practice' && target.betSchedule !== undefined) {
      if (typeof target.betSchedule !== 'boolean') return `has a bet schedule that is neither on nor off: ${String(target.betSchedule)}`;
      if (target.betSchedule && !(game === 'blackjack' && BLACKJACK_MODES.includes(target.strategy as BlackjackMode) && countingMode(target.strategy as BlackjackMode))) {
        return 'turns on the bet schedule outside a counting mode';
      }
    }
  } else {
    return 'is not free play, guided practice or a Learn challenge';
  }
  if (lesson.game !== null && game !== lesson.game) return `opens ${game} setup from a ${lesson.game} lesson`;
  return null;
}
