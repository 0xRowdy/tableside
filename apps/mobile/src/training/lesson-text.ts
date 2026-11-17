// Spec 3 S3-11 sVqX1, S3-12 l8pMS, pX6CV, S3-13 JJl51, Fvlgc, ZBpF3, Learning NvGyZ; #143, #145

import { BLACKJACK_MODES, CRAPS_STRATEGIES, ROULETTE_STRATEGIES, type LessonHandoff, type LessonSection } from '@tableside/definitions';
import type { GameId } from '@tableside/engine';

import { findGame } from '@/games';
import { BLACKJACK_MODE_TEXT } from '@/play/blackjack-text';

import { CATEGORY_TEXT, NOT_READY_HINT, type AllowanceCopy } from './challenge-text';
import type { LessonStatus } from './lesson-progress';
import type { CatalogCategory, LessonEntry, LessonView } from './service';

export const LEARNING_TITLE = 'Learning';
export const LEARNING_DETAIL = 'Lessons';
export const LESSONS_LABEL = 'LESSONS';
export const CATALOG_ROW = 'Lesson catalog';
export const LEARNING_NOTE = "Lessons never score you, award anything or lock anything. They're available to every account, including when today's challenge attempts are used up.";

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

export const lessonDetail = (entry: LessonEntry) => [statusText(entry.status, entry.steps), entry.summary].filter((part) => part !== null).join(' · ');

export const stepText = (step: number, steps: number) => `Step ${step} of ${steps}`;
export const NEXT = 'Next';
export const BACK = 'Back';
export const FINISH = 'Finish';
export const RESTART_LESSON = 'Restart lesson';
export const OPENING_LESSON = 'Opening the lesson…';

export const stoppedAt = (step: number, steps: number) => `You stopped at step ${step} of ${steps}.`;
export const resumeAt = (step: number) => `Resume at step ${step}`;
export const RESTART_FROM_START = 'Restart from step 1';
export const RESTART_NOTE = 'Restarting keeps your history.';

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

// Spec 3 S3-12 l8pMS and aJV2y; Lessons › Structure (worked examples); #144
export const TRY_EXAMPLE = 'Try the worked example (optional)';
export const WORKED_EXAMPLE = 'Worked example';
export const EXAMPLE_NOTE = "Practice here is scripted. It never uses an attempt and isn't recorded.";
export const TRY_IT_AGAIN = 'Try it again';
export const CONTINUE = 'Continue';
export const SKIP_EXAMPLE = 'Skip example';

// Spec 3 Lessons › Structure (Handoff); S3-12 pX6CV, S3-13 ZBpF3; #145
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
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
export const learnThisSkillDetail = (lesson: LessonEntry) => `${lesson.title} lesson · ${lesson.steps === null ? NOT_READY_HINT : `${lesson.steps} short steps`}`;
export const LEARN_THIS_GAME = 'Learn this game';
export const lessonCount = (count: number) => `${count} ${count === 1 ? 'lesson' : 'lessons'}`;
export const LEARN_THIS_GAME_DETAIL: Record<GameId, string> = {
  blackjack: 'Blackjack basics, the four strategy modes, counting and the bet schedule. Optional, and lessons never use allowance.',
  craps: 'Craps basics and the five strategy lessons. Optional, and lessons never use allowance.',
  roulette: 'Roulette basics and the five strategy lessons. Optional, and lessons never use allowance.',
};

// Spec 3 S3-12 hGHha; Amendment 1 C11; #154
export const SOURCES_HEADING = 'Sources';
export const sourcesStepText = (step: number) => `Step ${step} of ${step} · ${SOURCES_HEADING}`;
export const SOURCES_INTRO = "Tableside wrote this lesson. Where it draws on other work, the exact page, section or video time is linked below. Those authors didn't write or approve it.";
export const CREDITS_HEADING = 'Credits';
export const CREDITS_NOTE = 'Links open in your browser; these credits are bundled for offline reading.';
