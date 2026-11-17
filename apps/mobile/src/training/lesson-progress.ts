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
  // display only
  readonly recordedAt: number;
}

export interface LessonProgressEvent extends UnsequencedLessonEvent {
  readonly deviceSequence: number;
}
