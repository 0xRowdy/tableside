// Spec 3 Synchronized record types › Lesson-progress event; Amendment 1 C8, C10; #147

import type { RecordType } from './sync/registry';
import { isJsonObject, isPositiveInteger } from './values';

export type LessonProgressChange = { readonly kind: 'bookmark'; readonly step: number } | { readonly kind: 'completed' } | { readonly kind: 'restarted' };

export const LESSON_PROGRESS_RECORD_VERSION = 1 as const;

export interface UnsequencedLessonEvent {
  readonly recordVersion: typeof LESSON_PROGRESS_RECORD_VERSION;
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


function isChange(value: unknown): value is LessonProgressChange {
  if (!isJsonObject(value)) return false;
  switch (value.kind) {
    case 'bookmark':
      return isPositiveInteger(value.step);
    case 'completed':
    case 'restarted':
      return true;
    default:
      return false;
  }
}

function isEvent(value: unknown): value is LessonProgressEvent {
  return (
    isJsonObject(value) &&
    value.recordVersion === LESSON_PROGRESS_RECORD_VERSION &&
    typeof value.eventId === 'string' &&
    typeof value.owner === 'string' &&
    typeof value.installation === 'string' &&
    isPositiveInteger(value.deviceSequence) &&
    isJsonObject(value.lesson) &&
    typeof value.lesson.id === 'string' &&
    isPositiveInteger(value.lesson.version) &&
    isPositiveInteger(value.lesson.materialVersion) &&
    isChange(value.event) &&
    Number.isSafeInteger(value.recordedAt)
  );
}

export const lessonProgressEvent: RecordType<LessonProgressEvent> = {
  name: 'lesson-progress',
  kind: 'immutable-result',
  payloadVersion: 1,
  identity: { scheme: 'event-id', of: (event) => event.eventId },
  isPayload: isEvent,
  barriers: [],
  ordering: 'per-device',
  acceptance: 'private.accept_lesson_progress_event_v1',
  // Spec 3 Amendment 1 C8
  snapshot: 'private.snapshot_lesson_progress_events',
  fromChange(change) {
    const record = isJsonObject(change) ? change.record : undefined;
    return isEvent(record) ? record : null;
  },
  contribution: null,
  export: { csv: null, json: (event) => event },
  deletion: { serverTables: ['private.lesson_progress_events'] },
};
