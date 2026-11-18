// Spec 3 S3-11 sVqX1, S3-12 l8pMS, pX6CV, S3-13 JJl51, Fvlgc, ZBpF3, Learning NvGyZ; #143, #145

import { BLACKJACK_MODES, CRAPS_STRATEGIES, ROULETTE_STRATEGIES, type BlackjackMode, type LessonHandoff, type LessonSection, type ScriptedTurn, type StrategyStepAnswer, type StrategyStepExample, type StrategyStepExplanation } from '@tableside/definitions';
import type { Explanation, GameId } from '@tableside/engine';

import { findGame } from '@/games';
import { BLACKJACK_MODE_TEXT, moveText } from '@/play/blackjack-text';
import { playHeadline } from '@/play/blackjack-coaching';
import { betsText, prescriptionLine } from '@/play/coaching-text';
import { GAME_WORDS } from '@/play/game-words';

import { CATEGORY_TEXT, NOT_READY_HINT, type AllowanceCopy } from './challenge-text';
import type { LessonStatus } from './lesson-progress';
import type { CatalogCategory, InstructionWithheld, LessonAccess, LessonEntry, LessonView } from './service';

export const LEARNING_TITLE = 'Learning';
export const LEARNING_DETAIL = 'Lessons';
export const LESSONS_LABEL = 'LESSONS';
export const CATALOG_ROW = 'Lesson catalog';
export const LEARNING_NOTE =
  "Lessons never score you, award anything or lock anything. They're available to every account, including when today's challenge attempts are used up. Start here and hint settings stay on this device.";

// Spec 3 Lessons › Entry points; S1-01 olGG6, Learning NvGyZ; #146
export const START_HERE = {
  title: 'Start here',
  text: '24 short lessons on the three games, counting and the app. Open any, in any order.',
  open: 'Open lesson catalog',
  dismiss: 'Dismiss Start here',
  dismissed: 'Start here dismissed. Show it again from More, Settings, Learning.',
} as const;
export const START_HERE_SETTING = 'Show Start here on Home';
export const startHereDetail = (shown: boolean) =>
  shown ? 'On. The card shows on Home on this device until you dismiss it.' : 'Off because you dismissed it. Turn on to show the card again on this device.';

// Spec 3 Lessons › Structure (First-use hints); S1-04 XjwQc, Learning NvGyZ; #146
export const HINTS_LABEL = 'HINTS';
export const HINTS_AGAIN = 'Show first-use hints again';
export const HINTS_AGAIN_DETAIL = 'Bet selector, count entry and the show-count toggle hints reappear the next time you meet them.';
export const HINTS_RESET = 'First-use hints will show again.';
export const hintKicker = (name: string) => `NEW HERE · ${name.toUpperCase()}`;
export const REREAD_FROM_HELP = 'Reread from Help (?)';
export const GOT_IT = 'Got it';
export const gotItLabel = (name: string) => `Got it, hide the ${name} hint`;
export const HELP_LABEL = 'Help';
export const HELP_HINT = "Shows this screen's first-use hints again.";

export function catalogSummary(lessons: readonly LessonEntry[]): string {
  const completed = lessons.filter((lesson) => lesson.status.kind === 'completed' || lesson.status.kind === 'completed-earlier-version').length;
  const inProgress = lessons.filter((lesson) => lesson.status.kind === 'in-progress').length;
  return `${lessons.length} lessons · ${completed} completed · ${inProgress} in progress`;
}

export const LESSONS_TITLE = 'Lessons';
export const CATALOG_INTRO = 'Open any lesson, in any order. Finishing one just marks it completed: no scores, badges or locks.';
export const FINDING_LESSONS = 'Finding your lessons…';

const SECTION_LABEL: Record<LessonSection, string> = {
  app: 'APP',
  blackjack: 'BLACKJACK',
  craps: 'STANDARD CRAPS',
  roulette: 'ROULETTE',
  builder: 'STRATEGY BUILDER',
};

const SECTION_NAME: Record<LessonSection, string> = { app: 'App', blackjack: 'Blackjack', craps: 'Craps', roulette: 'Roulette', builder: 'Strategy builder' };

export const sectionHeading = (section: LessonSection, count: number) => `${SECTION_LABEL[section]} · ${count}`;
export const lessonKind = (section: LessonSection) => `Lesson · ${SECTION_NAME[section]}`;

export function statusText(status: LessonStatus, steps: number | null): string {
  switch (status.kind) {
    case 'not-started':
      return 'Not started';
    case 'in-progress':
      return `In progress · Step ${status.step} of ${steps ?? status.step}`;
    case 'completed':
      return 'Completed';
    case 'completed-earlier-version':
      return 'Completed (earlier version) · restart';
  }
}

// Spec 3 Lessons › Access, Check protection; S3-11 LDmev; #149
export const AFTER_CHECK = 'After your Check attempt';
export const NEEDS_CONNECTION = 'Needs a connection';
const accessText = (access: LessonAccess): string | null => (access.kind === 'after-check' ? AFTER_CHECK : access.kind === 'needs-connection' ? NEEDS_CONNECTION : null);

export const lessonDetail = (entry: LessonEntry) =>
  accessText(entry.access) ?? [statusText(entry.status, entry.steps), entry.summary].filter((part) => part !== null).join(' · ');

// Spec 3 S3-11 LDmev; Amendment 1 A2
export const CHECK_BANNER = {
  title: 'A Check attempt is unfinished',
  text: 'The four counting lessons open after it ends. During a Play Check, the four blackjack mode lessons and the bet-schedule lesson wait too. Everything else is open.',
} as const;
export const RETURN_TO_ATTEMPT = 'Return to attempt';

// Spec 3 S3-14 SUUN4, with Amendment 2 §3's narrowing to Amendment 1 A2
export const AFTER_THIS_ATTEMPT = 'This lesson is available after this attempt.';
export const END_TO_VIEW = 'End attempt to view this lesson';
export const ENDING_ABANDONS = "Ending counts as abandoned: today's attempt stays used, there's no record, and progress toward this setting's readiness milestone restarts.";
export function afterCheckText({ category, play }: InstructionWithheld): string {
  const title = CATEGORY_TEXT[category].title;
  return play
    ? `You have an unfinished Play Check attempt in ${title}. The four counting lessons, the four blackjack mode lessons, the bet-schedule lesson and their worked examples wait until it ends. Every other lesson is open now.`
    : `You have an unfinished Check attempt in ${title}. The four counting lessons (card values, running count, true-count conversion, table counting) and their worked examples wait until it ends. Every other lesson is open now.`;
}

// Spec 3 Lessons › Check protection; Amendment 1 A2, Amendment 3; SUUN4's pattern
export const PRACTICE_AFTER_ATTEMPT = 'This practice mode is available after this attempt.';
export const END_TO_PRACTICE = 'End attempt to practice this mode';
export const practiceHeldText = ({ category }: InstructionWithheld, mode: BlackjackMode) =>
  `You have an unfinished Play Check attempt in ${CATEGORY_TEXT[category].title}. Guided practice with ${BLACKJACK_MODE_TEXT[mode].label.toLowerCase()} coaches what the Check tests, so it waits until the attempt ends. Free play and basic strategy guided practice are open now.`;

// Spec 3 S3-12 JsXMJ; Amendment 4 §5
export const NEEDS_CONNECTION_TITLE = 'This lesson needs a connection';
export const needsConnectionText = ({ game, offlineGame }: { readonly game: GameId; readonly offlineGame: GameId | null }) =>
  `You're offline${offlineGame ? `, and ${GAME_WORDS[offlineGame].name} is your offline game,` : ','} so ${GAME_WORDS[game].name} lessons wait until you reconnect. Your place in this lesson is kept.`;
export const offlineLessonsText = (offlineGame: GameId | null) =>
  `Offline you can open ${offlineGame ? `the ${GAME_WORDS[offlineGame].name} lessons, ` : ''}the app orientation lesson and the builder lesson.`;

export const stepText = (step: number, steps: number) => `Step ${step} of ${steps}`;
export const NEXT = 'Next';
export const BACK = 'Back';
export const FINISH = 'Finish';
export const RESTART_LESSON = 'Restart lesson';
export const OPENING_LESSON = 'Opening the lesson…';

export const stoppedAt = (step: number, steps: number) => `You stopped at step ${step} of ${steps}.`;
export const resumeAt = (step: number) => `Resume at step ${step}`;
export const RESTART_FROM_START = 'Restart from step 1';
// #147
export const RESTART_NOTE = 'Restarting keeps your history. Your place is synced, so it follows you to your other devices.';

export const SAVE_FAILED = 'Couldn’t save your place in this lesson. Try again.';

// Spec 3 Lessons › Progress, Amendment 1 C10
export function noticeText(notice: NonNullable<LessonView['notice']>): { readonly title: string; readonly text: string } {
  return notice.kind === 'after-completion'
    ? {
        title: 'Completed (earlier version)',
        text: `This lesson changed after you finished it: ${notice.change}. Restart from step 1 to see the new version. Your earlier completion stays in your history.`,
      }
    : { title: 'Lesson updated', text: `This lesson changed since you were last here: ${notice.change}. It starts again from step 1.` };
}

// Spec 3 S3-12 l8pMS; Amendment 1 B2, C11; Amendment 2 §3 (lesson player); #152
export const PUBLISHED_NOTE_TITLE = 'Our index vs published charts';
export const sourceText = (citation: string) => `Source: ${citation}`;

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const capitalizeFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// Spec 3 S3-12 l8pMS and aJV2y; Lessons › Structure (worked examples); #144
export const TRY_EXAMPLE = 'Try the worked example (optional)';
export const WORKED_EXAMPLE = 'Worked example';
export const EXAMPLE_NOTE = "Practice here is scripted. It never uses an attempt and isn't recorded.";
export const TRY_IT_AGAIN = 'Try it again';
export const CONTINUE = 'Continue';
export const SKIP_EXAMPLE = 'Skip example';

// Spec 3 Lessons › Structure (worked examples); #155
export const SO_FAR = 'So far';
export const strategyName = (id: string) => STRATEGY_NAMES.get(id) ?? id;
// #152
const BET_SCHEDULE_NAME = 'the bet schedule';
export const exampleStrategyName = (example: Pick<StrategyStepExample, 'strategy' | 'parameters'>) =>
  example.parameters['bet-schedule'] === 'on' ? BET_SCHEDULE_NAME : strategyName(example.strategy);
export const strategyPrompt = (name: string, answer: StrategyStepAnswer['kind']) => (answer === 'play' ? `What’s the play here in ${lowerFirst(name)}?` : `What does ${name} bet next?`);
export const strategyChoiceText = (game: GameId, answer: StrategyStepAnswer) =>
  capitalizeFirst(answer.kind === 'play' ? moveText(answer.move) : betsText(answer.bets, GAME_WORDS[game]));

export const scriptedResponseLine = (name: string, explanation: StrategyStepExplanation, game: GameId) =>
  'kind' in explanation && explanation.kind === 'play' ? playHeadline(capitalizeFirst(name), explanation) : prescriptionLine(capitalizeFirst(name), explanation as Explanation, GAME_WORDS[game]);

export function scriptedTurnLine(game: GameId, turn: ScriptedTurn, index: number, atDecision = false): string {
  const words = GAME_WORDS[game];
  const wagers = turn.wagers.length > 0 ? betsText(turn.wagers, words) : 'no bets';
  return `${words.Turn} ${index + 1}: ${wagers}. ${words.scriptedOutcome(turn.outcome, atDecision)}`;
}

// Spec 3 Lessons › Structure (Handoff); S3-12 pX6CV, S3-13 ZBpF3; #145
const gameTitle = (game: GameId) => findGame(game)?.title ?? game;
const STRATEGY_NAMES: ReadonlyMap<string, string> = new Map([
  ...BLACKJACK_MODES.map((mode) => [mode, BLACKJACK_MODE_TEXT[mode].label] as const),
  ...[...CRAPS_STRATEGIES, ...ROULETTE_STRATEGIES].map((strategy) => [strategy.id, strategy.name] as const),
]);

export function handoffLabel(handoff: LessonHandoff): string {
  switch (handoff.kind) {
    case 'learn-challenge':
      return `Learn challenge · ${CATEGORY_TEXT[handoff.category].title}`;
    case 'free-play':
      return `Free play · ${gameTitle(handoff.game)}`;
    case 'guided-practice': {
      const strategy = handoff.strategy && STRATEGY_NAMES.get(handoff.strategy);
      return `Guided practice · ${gameTitle(handoff.game)}${strategy ? `, ${lowerFirst(strategy)}` : ''}`;
    }
  }
}

export const HANDOFF_TITLE = 'Practice what you learned';
export const HANDOFF_INTRO = 'Each option opens its normal setup screen with this filled in. Nothing starts, and no allowance is used, until you press Start there.';
export const BACK_TO_LESSONS = 'Back to lessons';
const opensSetup = (game: GameId) => `Opens ${gameTitle(game).toLowerCase()} setup.`;

// Spec 3 Amendment 4 §2
export function handoffDetail(handoff: LessonHandoff, allowance: AllowanceCopy | undefined): string {
  switch (handoff.kind) {
    case 'learn-challenge':
      return allowance?.setup.text ?? '';
    case 'free-play':
      return opensSetup(handoff.game);
    case 'guided-practice':
      return allowance?.standing === 'premium' ? opensSetup(handoff.game) : 'Uses guided-practice allowance once you start.';
  }
}

// Spec 3 Lessons › Entry points; S3-01 PDCaD, S3-02 buD2R, S1-02 FxxAj
export const lessonLinkLabel = (category: CatalogCategory) => `Lesson: ${lowerFirst(CATEGORY_TEXT[category].title)}`;
export const LEARN_THIS_SKILL = 'Learn this skill';
export const learnThisSkillDetail = (lesson: LessonEntry) =>
  `${lesson.title} lesson · ${lesson.steps === null ? NOT_READY_HINT : (accessText(lesson.access) ?? `${lesson.steps} short steps`)}`;
export const LEARN_THIS_GAME = 'Learn this game';
export const lessonCount = (count: number) => `${count} ${count === 1 ? 'lesson' : 'lessons'}`;
export const LEARN_THIS_GAME_DETAIL: Record<GameId, string> = {
  blackjack: 'Blackjack basics, the four strategy modes, counting and the bet schedule. Optional, and lessons never use allowance.',
  craps: 'Craps basics and the five strategy lessons. Optional, and lessons never use allowance.',
  roulette: 'Roulette basics and the five strategy lessons. Optional, and lessons never use allowance.',
};

// Spec 3 S3-12 hGHha; Amendment 1 C11; #154
export const SOURCES_HEADING = 'Sources';
export const sourcesStepText = (step: number, steps: number) => `${stepText(step, steps)} · ${SOURCES_HEADING}`;
export const SOURCES_INTRO = "Tableside wrote this lesson. Where it draws on other work, the exact page, section or video time is linked below. Those authors didn't write or approve it.";
export const CREDITS_HEADING = 'Credits';
export const CREDITS_NOTE = 'Links open in your browser; these credits are bundled for offline reading.';
