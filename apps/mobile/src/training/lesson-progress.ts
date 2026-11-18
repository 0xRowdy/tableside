// Spec 3 Synchronized record types › Lesson-progress event; Amendment 1 C8, C10; #143, #147
import { lessonProgressEvent, type LessonProgressChange, type LessonProgressEvent, type UnsequencedLessonEvent } from '@tableside/account';

// Spec 2 registry
export const LESSON_PROGRESS_RECORD_TYPE = lessonProgressEvent.name;

export type { LessonProgressChange, LessonProgressEvent, UnsequencedLessonEvent };

// #147
export interface AcceptedLessonEvent {
  readonly sequence: number;
  readonly event: LessonProgressEvent;
}

export type LessonStatus =
  | { readonly kind: 'not-started' }
  | { readonly kind: 'in-progress'; readonly step: number }
  | { readonly kind: 'completed' }
  | { readonly kind: 'completed-earlier-version' };

export type LessonChange = 'after-completion' | 'since-last-visit';

export interface LessonProgress {
  readonly status: LessonStatus;
  readonly bookmark: number | null;
  readonly changed: LessonChange | null;
}

// Spec 3 Amendment 1 C10: server-acceptance order, then this device's unsynced events in device order
export function acceptanceOrder(accepted: readonly AcceptedLessonEvent[], local: readonly LessonProgressEvent[]): LessonProgressEvent[] {
  const synced = new Set(accepted.map(({ event }) => event.eventId));
  return [
    ...[...accepted].sort((a, b) => a.sequence - b.sequence).map(({ event }) => event),
    ...local.filter((event) => !synced.has(event.eventId)).sort((a, b) => a.deviceSequence - b.deviceSequence),
  ];
}

// Spec 3 Amendment 1 C10; events in acceptanceOrder
export function lessonProgress(events: readonly LessonProgressEvent[], lesson: { readonly id: string; readonly materialVersion: number; readonly steps: number }): LessonProgress {
  const own = events.filter((event) => event.lesson.id === lesson.id);
  const current = own.filter((event) => event.lesson.materialVersion === lesson.materialVersion);
  const completedNow = current.some((event) => event.event.kind === 'completed');
  const completedBefore = own.some((event) => event.event.kind === 'completed');
  const last = current.at(-1)?.event;
  const bookmark = !last || last.kind === 'completed' ? null : last.kind === 'restarted' ? 1 : Math.min(Math.max(last.step, 1), lesson.steps);
  const status: LessonStatus = completedNow
    ? { kind: 'completed' }
    : bookmark !== null
      ? { kind: 'in-progress', step: bookmark }
      : completedBefore
        ? { kind: 'completed-earlier-version' }
        : { kind: 'not-started' };
  const changed: LessonChange | null = current.length > 0 || own.length === 0 ? null : completedBefore ? 'after-completion' : 'since-last-visit';
  return { status, bookmark, changed };
}
