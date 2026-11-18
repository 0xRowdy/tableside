// Spec 3 Synchronized record types › Lesson-progress event; Amendment 1 C8, C10; #147

import type { RecordType } from './sync/registry';

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

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isCount = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 1;

function isChange(value: unknown): value is LessonProgressChange {
  if (!isObject(value)) return false;
  switch (value.kind) {
    case 'bookmark':
      return isCount(value.step);
    case 'completed':
    case 'restarted':
      return true;
    default:
      return false;
  }
}

function isEvent(value: unknown): value is LessonProgressEvent {
  return (
    isObject(value) &&
    value.recordVersion === 1 &&
    typeof value.eventId === 'string' &&
    typeof value.owner === 'string' &&
    typeof value.installation === 'string' &&
    isCount(value.deviceSequence) &&
    isObject(value.lesson) &&
    typeof value.lesson.id === 'string' &&
    isCount(value.lesson.version) &&
    isCount(value.lesson.materialVersion) &&
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
    const record = isObject(change) ? change.record : undefined;
    return isEvent(record) ? record : null;
  },
  contribution: null,
  export: { csv: null, json: (event) => event },
  deletion: { serverTables: ['private.lesson_progress_events'] },
};
