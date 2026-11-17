// Spec 3 Synchronized record types › Lesson-progress event; Amendment 1 C8, C10; #143

// Spec 2 registry
export const LESSON_PROGRESS_RECORD_TYPE = 'lesson-progress';

export type LessonProgressChange = { readonly kind: 'bookmark'; readonly step: number } | { readonly kind: 'completed' } | { readonly kind: 'restarted' };

export interface UnsequencedLessonEvent {
  readonly recordVersion: 1;
  readonly eventId: string;
  readonly owner: string;
  readonly installation: string;
  readonly lesson: { readonly id: string; readonly version: number; readonly materialVersion: number };
  readonly event: LessonProgressChange;
  readonly recordedAt: number;
}

export interface LessonProgressEvent extends UnsequencedLessonEvent {
  readonly deviceSequence: number;
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

// Spec 3 Amendment 1 C10
export function lessonProgress(events: readonly LessonProgressEvent[], lesson: { readonly id: string; readonly materialVersion: number; readonly steps: number }): LessonProgress {
  // TODO(#147)
  const own = events.filter((event) => event.lesson.id === lesson.id).sort((a, b) => a.deviceSequence - b.deviceSequence);
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
