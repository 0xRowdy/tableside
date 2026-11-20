// docs/decisions/lessons-entry-points.md; S3-01 u8a0o, rwwOU; S1-04 qylNY
import { CHALLENGE_LESSONS } from '@tableside/definitions';
import type { GameId } from '@tableside/engine';

import type { LessonEntry } from './lesson-service';

export type LessonOffer =
  | { readonly kind: 'continue'; readonly lesson: LessonEntry; readonly step: number }
  | { readonly kind: 'start'; readonly lesson: LessonEntry; readonly first: boolean }
  | { readonly kind: 'after-check' };

const COUNTING_PATH: readonly string[] = Object.values(CHALLENGE_LESSONS);

const opens = (lesson: LessonEntry) => lesson.steps !== null && lesson.access.kind === 'available';
const done = (lesson: LessonEntry) => lesson.status.kind === 'completed' || lesson.status.kind === 'completed-earlier-version';

function latestInProgress(lessons: readonly LessonEntry[]): LessonOffer | null {
  const latest = lessons
    .filter((lesson) => lesson.status.kind === 'in-progress' && opens(lesson))
    .reduce<LessonEntry | null>((best, lesson) => (best === null || (lesson.lastActive ?? -1) > (best.lastActive ?? -1) ? lesson : best), null);
  return latest?.status.kind === 'in-progress' ? { kind: 'continue', lesson: latest, step: latest.status.step } : null;
}

function firstUndone(path: readonly LessonEntry[]): LessonOffer | null {
  const next = path.find((lesson) => !done(lesson) && opens(lesson));
  return next ? { kind: 'start', lesson: next, first: path.every((lesson) => lesson.status.kind === 'not-started') } : null;
}

export function countingLessonOffer(lessons: readonly LessonEntry[]): LessonOffer | null {
  const path = COUNTING_PATH.flatMap((id) => lessons.filter((lesson) => lesson.id === id));
  const offer = latestInProgress(lessons) ?? firstUndone(path);
  if (offer) return offer;
  const remaining = path.filter((lesson) => !done(lesson));
  return remaining.length > 0 && remaining.every((lesson) => lesson.access.kind === 'after-check') ? { kind: 'after-check' } : null;
}

export function gameLessonOffer(lessons: readonly LessonEntry[], game: GameId): LessonOffer | null {
  const section = lessons.filter((lesson) => lesson.section === game);
  return latestInProgress(section) ?? firstUndone(section);
}
