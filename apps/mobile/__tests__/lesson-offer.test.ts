// docs/decisions/lessons-entry-points.md; Counting hub u8a0o, rwwOU; table Help qylNY
import type { LessonEntry } from '@/training/service';
import { countingLessonOffer, gameLessonOffer } from '@/training/lesson-offer';
import type { LessonStatus } from '@/training/lesson-progress';

const entry = (id: string, section: LessonEntry['section'], status: LessonStatus = { kind: 'not-started' }, extra: Partial<LessonEntry> = {}): LessonEntry => ({
  id,
  title: id,
  summary: null,
  section,
  steps: 4,
  access: { kind: 'available' },
  status,
  lastActive: null,
  ...extra,
});

const COUNTING = ['card-values', 'running-count', 'true-count-conversion', 'table-counting'];
const catalog = (overrides: Record<string, Partial<LessonEntry>> = {}): LessonEntry[] =>
  ['app-orientation', 'blackjack-basics', 'basic-strategy', ...COUNTING, 'craps-basics', 'pass-with-odds', 'building-a-strategy'].map((id) =>
    entry(id, id === 'app-orientation' ? 'app' : id === 'building-a-strategy' ? 'builder' : id.startsWith('craps') || id === 'pass-with-odds' ? 'craps' : 'blackjack', undefined, overrides[id]),
  );
const afterCheck: LessonEntry['access'] = { kind: 'after-check', attempt: { category: 'running-count', play: false } };
const done: LessonStatus = { kind: 'completed' };

describe('the Counting hub lesson offer', () => {
  it('starts the counting path at Card values when nothing is started, and says it is the first', () => {
    expect(countingLessonOffer(catalog())).toEqual({ kind: 'start', lesson: expect.objectContaining({ id: 'card-values' }), first: true });
  });

  it('continues the in-progress lesson with the latest progress, in any section', () => {
    const offer = countingLessonOffer(
      catalog({
        'running-count': { status: { kind: 'in-progress', step: 3 }, lastActive: 4 },
        'pass-with-odds': { status: { kind: 'in-progress', step: 2 }, lastActive: 9 },
      }),
    );
    expect(offer).toEqual({ kind: 'continue', lesson: expect.objectContaining({ id: 'pass-with-odds' }), step: 2 });
  });

  it('moves to the next counting lesson not yet completed, counting an earlier-version completion as done', () => {
    const offer = countingLessonOffer(catalog({ 'card-values': { status: done }, 'running-count': { status: { kind: 'completed-earlier-version' } } }));
    expect(offer).toEqual({ kind: 'start', lesson: expect.objectContaining({ id: 'true-count-conversion' }), first: false });
  });

  it('offers nothing once all four counting lessons are completed', () => {
    expect(countingLessonOffer(catalog(Object.fromEntries(COUNTING.map((id) => [id, { status: done }]))))).toBeNull();
  });

  it('skips lessons it cannot open: withheld, offline or not written yet', () => {
    const offer = countingLessonOffer(
      catalog({
        'card-values': { access: afterCheck },
        'running-count': { access: { kind: 'needs-connection', game: 'blackjack', offlineGame: 'craps' } },
        'true-count-conversion': { steps: null },
      }),
    );
    expect(offer).toEqual({ kind: 'start', lesson: expect.objectContaining({ id: 'table-counting' }), first: true });
  });

  it('does not continue a withheld lesson', () => {
    const offer = countingLessonOffer(catalog({ 'running-count': { status: { kind: 'in-progress', step: 2 }, lastActive: 3, access: afterCheck } }));
    expect(offer).toEqual({ kind: 'start', lesson: expect.objectContaining({ id: 'card-values' }), first: false });
  });

  it('says the counting lessons wait for the Check attempt when every remaining one is withheld', () => {
    expect(countingLessonOffer(catalog(Object.fromEntries(COUNTING.map((id) => [id, { access: afterCheck }]))))).toEqual({ kind: 'after-check' });
  });
});

describe("a table's Help lesson offer", () => {
  it("continues the game's in-progress lesson with the latest progress", () => {
    const offer = gameLessonOffer(
      catalog({ 'basic-strategy': { status: { kind: 'in-progress', step: 2 }, lastActive: 1 }, 'card-values': { status: { kind: 'in-progress', step: 3 }, lastActive: 5 } }),
      'blackjack',
    );
    expect(offer).toEqual({ kind: 'continue', lesson: expect.objectContaining({ id: 'card-values' }), step: 3 });
  });

  it("never continues another game's lesson", () => {
    const offer = gameLessonOffer(catalog({ 'pass-with-odds': { status: { kind: 'in-progress', step: 2 }, lastActive: 9 } }), 'blackjack');
    expect(offer).toEqual({ kind: 'start', lesson: expect.objectContaining({ id: 'blackjack-basics' }), first: true });
  });

  it("starts the game's first lesson not yet completed, skipping withheld ones, and offers nothing when none is left", () => {
    expect(gameLessonOffer(catalog({ 'craps-basics': { status: done } }), 'craps')).toEqual({ kind: 'start', lesson: expect.objectContaining({ id: 'pass-with-odds' }), first: false });
    expect(gameLessonOffer(catalog({ 'craps-basics': { status: done }, 'pass-with-odds': { status: done } }), 'craps')).toBeNull();
    expect(gameLessonOffer(catalog({ 'craps-basics': { access: afterCheck }, 'pass-with-odds': { access: afterCheck } }), 'craps')).toBeNull();
  });
});
