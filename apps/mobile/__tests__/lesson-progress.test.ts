// Spec 3 Synchronized record types › Lesson-progress event; Amendment 1 C10; #147
import { acceptanceOrder, lessonProgress, type LessonProgressChange, type LessonProgressEvent } from '@/training/lesson-progress';

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

describe('the lesson-progress projection (Amendment 1 C10)', () => {
  it('takes the bookmark from the latest server-accepted event, even when another device recorded it earlier', () => {
    const phone = event('phone', 1, step(5));
    const lateTablet = event('tablet', 1, step(2));
    const events = acceptanceOrder(
      [
        { sequence: 8, event: lateTablet },
        { sequence: 3, event: phone },
      ],
      [],
    );
    expect(events).toEqual([phone, lateTablet]);
    expect(lessonProgress(events, LESSON)).toEqual({ status: { kind: 'in-progress', step: 2 }, bookmark: 2, changed: null });
  });

  it('shows this device’s unsynced bookmark after every accepted one until it syncs, in its own device order', () => {
    const theirs = event('tablet', 1, step(5));
    const first = event('phone', 1, step(2));
    const second = event('phone', 2, step(3));
    const events = acceptanceOrder([{ sequence: 4, event: theirs }], [second, first]);
    expect(events).toEqual([theirs, first, second]);
    expect(lessonProgress(events, LESSON).bookmark).toBe(3);
  });

  it('counts an accepted local event once, at its acceptance', () => {
    const mine = event('phone', 1, step(4));
    const theirs = event('tablet', 1, step(2));
    const events = acceptanceOrder(
      [
        { sequence: 2, event: mine },
        { sequence: 5, event: theirs },
      ],
      [mine],
    );
    expect(events).toEqual([mine, theirs]);
    expect(lessonProgress(events, LESSON).bookmark).toBe(2);
  });

  it('is completed when any device completed it, and a restart from another device keeps completion', () => {
    const events = acceptanceOrder(
      [
        { sequence: 1, event: event('tablet', 1, { kind: 'completed' }) },
        { sequence: 2, event: event('phone', 1, step(3)) },
        { sequence: 3, event: event('phone', 2, { kind: 'restarted' }) },
      ],
      [],
    );
    expect(lessonProgress(events, LESSON)).toEqual({ status: { kind: 'completed' }, bookmark: 1, changed: null });
  });

  it('keys the bookmark on the last material-change version and keeps an earlier version’s completion in history', () => {
    const events = acceptanceOrder(
      [
        { sequence: 1, event: event('tablet', 1, { kind: 'completed' }, 1) },
        { sequence: 2, event: event('tablet', 2, step(4), 1) },
      ],
      [],
    );
    expect(lessonProgress(events, LESSON)).toEqual({ status: { kind: 'completed-earlier-version' }, bookmark: null, changed: 'after-completion' });
    expect(lessonProgress(events, { ...LESSON, materialVersion: 1 })).toEqual({ status: { kind: 'completed' }, bookmark: 4, changed: null });
  });
});
