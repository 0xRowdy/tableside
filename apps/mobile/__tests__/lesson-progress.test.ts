// Spec 3 Synchronized record types › Lesson-progress event; Amendment 1 C10; #147
import { acceptanceOrder, lessonProgress, type AcceptedLessonEvent, type LessonHistory, type LessonProgressChange, type LessonProgressEvent } from '@/training/lesson-progress';

const LESSON = { id: 'running-count', materialVersion: 2, steps: 6 };

let ids = 0;
function event(installation: string, deviceSequence: number, change: LessonProgressChange, materialVersion = 2): LessonProgressEvent {
  return {
    recordVersion: 1,
    eventId: `${installation}-${++ids}`,
    owner: 'account-1',
    installation,
    deviceSequence,
    lesson: { id: LESSON.id, version: materialVersion + 1, materialVersion },
    event: change,
    recordedAt: 1_790_000_000_000 + ids,
  };
}

const step = (n: number): LessonProgressChange => ({ kind: 'bookmark', step: n });

const history = (accepted: readonly AcceptedLessonEvent[], local: readonly LessonProgressEvent[] = [], refused: readonly string[] = []): LessonHistory => ({
  accepted,
  local,
  refused,
});

describe('the lesson-progress projection (Amendment 1 C10)', () => {
  it('takes the bookmark from the latest server-accepted event, even when another device recorded it earlier', () => {
    const phone = event('phone', 1, step(5));
    const lateTablet = event('tablet', 1, step(2));
    const synced = history([
      { sequence: 8, event: lateTablet },
      { sequence: 3, event: phone },
    ]);
    expect(acceptanceOrder(synced)).toEqual([phone, lateTablet]);
    expect(lessonProgress(synced, LESSON)).toEqual({ status: { kind: 'in-progress', step: 2 }, bookmark: 2, changed: null });
  });

  it('shows this device’s unsynced bookmark after every accepted one until it syncs, in its own device order', () => {
    const theirs = event('tablet', 1, step(5));
    const first = event('phone', 1, step(2));
    const second = event('phone', 2, step(3));
    const pending = history([{ sequence: 4, event: theirs }], [second, first]);
    expect(acceptanceOrder(pending)).toEqual([theirs, first, second]);
    expect(lessonProgress(pending, LESSON).bookmark).toBe(3);
  });

  it('counts an accepted local event once, at its acceptance', () => {
    const mine = event('phone', 1, step(4));
    const theirs = event('tablet', 1, step(2));
    const synced = history(
      [
        { sequence: 2, event: mine },
        { sequence: 5, event: theirs },
      ],
      [mine],
    );
    expect(acceptanceOrder(synced)).toEqual([mine, theirs]);
    expect(lessonProgress(synced, LESSON).bookmark).toBe(2);
  });

  it('leaves out a local event the server refused, so it never outranks synced progress', () => {
    const theirs = event('tablet', 1, step(4));
    const refused = event('phone', 1, step(2));
    const settled = history([{ sequence: 1, event: theirs }], [refused], [refused.eventId]);
    expect(acceptanceOrder(settled)).toEqual([theirs]);
    expect(lessonProgress(settled, LESSON).bookmark).toBe(4);
  });

  it('is completed when any device completed it, and a restart from another device keeps completion', () => {
    const synced = history([
      { sequence: 1, event: event('tablet', 1, { kind: 'completed' }) },
      { sequence: 2, event: event('phone', 1, step(3)) },
      { sequence: 3, event: event('phone', 2, { kind: 'restarted' }) },
    ]);
    expect(lessonProgress(synced, LESSON)).toEqual({ status: { kind: 'completed' }, bookmark: 1, changed: null });
  });

  it('keys the bookmark on the last material-change version and keeps an earlier version’s completion in history', () => {
    const synced = history([
      { sequence: 1, event: event('tablet', 1, { kind: 'completed' }, 1) },
      { sequence: 2, event: event('tablet', 2, step(4), 1) },
    ]);
    expect(lessonProgress(synced, LESSON)).toEqual({ status: { kind: 'completed-earlier-version' }, bookmark: null, changed: 'after-completion' });
    expect(lessonProgress(synced, { ...LESSON, materialVersion: 1 })).toEqual({ status: { kind: 'completed' }, bookmark: 4, changed: null });
  });
});
