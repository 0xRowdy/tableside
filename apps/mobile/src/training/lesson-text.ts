// Spec 3 S3-11 sVqX1, S3-12 l8pMS, S3-13 JJl51 and Fvlgc, Settings › Learning NvGyZ; #143

import type { LessonSection } from '@tableside/definitions';

import type { LessonStatus } from './lesson-progress';
import type { LessonEntry, LessonView } from './service';

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
