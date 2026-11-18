import { describe, expect, it } from 'vitest';

import { type LessonProgressEvent, lessonProgressEvent } from './lesson-progress-record';
import { recordTypes } from './sync/registry';

const event: LessonProgressEvent = {
  recordVersion: 1,
  eventId: 'event-7',
  owner: 'account-1',
  installation: 'installation-1',
  deviceSequence: 3,
  lesson: { id: 'running-count', version: 2, materialVersion: 1 },
  event: { kind: 'bookmark', step: 4 },
  recordedAt: Date.UTC(2026, 10, 17, 9, 0, 0),
};

describe('the lesson-progress registration (spec 3 Synchronized record types)', () => {
  it('is a registered immutable result, ordered per device and named by its event ID', () => {
    expect(recordTypes.get('lesson-progress')).toBe(lessonProgressEvent);
    expect(lessonProgressEvent.kind).toBe('immutable-result');
    expect(lessonProgressEvent.ordering).toBe('per-device');
    expect(lessonProgressEvent.identity.of(event)).toBe('event-7');
  });

  it('uploads a bookmark, completed or restarted event for a versioned lesson', () => {
    expect(lessonProgressEvent.isPayload(event)).toBe(true);
    expect(lessonProgressEvent.isPayload({ ...event, event: { kind: 'completed' } })).toBe(true);
    expect(lessonProgressEvent.isPayload({ ...event, event: { kind: 'restarted' } })).toBe(true);
    expect(lessonProgressEvent.isPayload({ ...event, event: { kind: 'bookmark', step: 0 } })).toBe(false);
    expect(lessonProgressEvent.isPayload({ ...event, event: { kind: 'bookmark' } })).toBe(false);
    expect(lessonProgressEvent.isPayload({ ...event, event: { kind: 'skipped' } })).toBe(false);
    expect(lessonProgressEvent.isPayload({ ...event, recordVersion: 2 })).toBe(false);
    expect(lessonProgressEvent.isPayload({ ...event, deviceSequence: 0 })).toBe(false);
    expect(lessonProgressEvent.isPayload({ ...event, lesson: { id: 'running-count', version: 2 } })).toBe(false);
    expect(lessonProgressEvent.isPayload({ ...event, lesson: { id: 'running-count', version: 0, materialVersion: 1 } })).toBe(false);
  });

  it('adds nothing to practice totals', () => {
    expect(lessonProgressEvent.contribution).toBeNull();
  });

  // Spec 3 Amendment 1 C8
  it('is summary data: bootstrapped whole, with no detail to fetch', () => {
    expect(lessonProgressEvent.detail).toBeUndefined();
    expect(lessonProgressEvent.fromChange({ record: event, origin: { installation: 'installation-1', position: 3 } })).toEqual(event);
    expect(lessonProgressEvent.fromChange({ record: { ...event, recordVersion: 2 } })).toBeNull();
    expect(lessonProgressEvent.fromChange(null)).toBeNull();
  });

  it('exports each event as JSON, with no CSV', () => {
    expect(lessonProgressEvent.export.json(event)).toEqual(event);
    expect(lessonProgressEvent.export.csv).toBeNull();
    expect(lessonProgressEvent.deletion.serverTables).toEqual(['private.lesson_progress_events']);
  });
});
