// Spec 3 Audio and haptics, Learn, Check and assistance, Testing Decisions › Seam 3 (cue dispatch); #132
import { DEFAULT_TABLE_SETUP } from '@tableside/definitions';
import { EMPTY_QUARANTINE_LIST, ENGINE_VERSION, type ChallengeVariant, type ChallengeView, type QuarantineList } from '@tableside/engine';

import { FeedbackService } from '@/feedback/service';
import { DeviceSettings } from '@/feedback/settings';
import { substituteFeedbackPorts } from '@/feedback/testing/substitutes';
import { followTraining } from '@/feedback/training-cues';
import { alwaysAllowed } from '@/practice/adapters';
import { FakeClock, entropyFromWords, PI_WORDS } from '@/practice/testing/substitutes';
import { plentyAllowance } from '@/training/allowance';
import { MemoryTrainingStore } from '@/training/memory-store';
import { TrainingService, type ChallengeSetup, type TrainingSnapshot } from '@/training/service';
import { cardOf, HI_LO_BY_RANK } from '@/training/testing/hi-lo';
import { NO_SCREEN_READER } from '@/training/speech';

const reference = (view: ChallengeView) => HI_LO_BY_RANK[cardOf(view.item).rank]!;
const wrongFor = (view: ChallengeView) => (reference(view) === 1 ? -1 : 1);

async function setup(variant: ChallengeVariant, store = new MemoryTrainingStore(), quarantine: QuarantineList = EMPTY_QUARANTINE_LIST, start: ChallengeSetup = { category: 'card-values', variant }) {
  const clock = new FakeClock(1_790_000_000_000, true);
  let next = 0;
  const service = new TrainingService({ store, access: alwaysAllowed, allowance: plentyAllowance(() => clock.now()), clock, entropy: entropyFromWords(PI_WORDS), newId: () => `attempt-${++next}`, device: 'test-device', owner: 'local', quarantine, speech: NO_SCREEN_READER });
  const ports = substituteFeedbackPorts(null);
  const settings = new DeviceSettings(ports.storage);
  await settings.load();
  const feedback = new FeedbackService(ports, settings);
  const heard: { cue: string; at: number; snapshot: TrainingSnapshot }[] = [];
  const play = ports.sound.play.bind(ports.sound);
  ports.sound.play = (cue, volume) => {
    heard.push({ cue, at: clock.now() - 1_790_000_000_000, snapshot: service.snapshot() });
    play(cue, volume);
  };
  const seen: TrainingSnapshot[] = [];
  service.subscribe(() => seen.push(service.snapshot()));
  const stop = followTraining(service, feedback);
  await service.load();
  await service.startAttempt(start);
  return { service, ports, feedback, heard, stop, store, seen };
}

async function answerAll(service: TrainingService, choose: (view: ChallengeView) => -1 | 0 | 1) {
  for (let guard = 0; guard < 100 && service.snapshot().status === 'active'; guard++) {
    const snapshot = service.snapshot();
    if (snapshot.status !== 'active') break;
    const { view } = snapshot;
    await service.submit(view.phase === 'question' ? { kind: 'answer', value: choose(view) } : { kind: 'next-item' });
  }
}

describe('cues during a challenge attempt', () => {
  it('Check: every accepted answer plays cue 10 with the selection haptic, the same sound, haptic and timing for right and wrong, and no feedback cue', async () => {
    const right = await setup('check');
    await answerAll(right.service, reference);
    const wrong = await setup('check');
    await answerAll(wrong.service, wrongFor);

    // each run's first completed attempt sets its group's personal best (#140)
    const expected = ['card-dealt', ...Array.from({ length: 19 }, () => ['answer-accepted', 'card-dealt']).flat(), 'answer-accepted', 'attempt-ended', 'milestone'];
    expect(right.ports.sound.played.map((play) => play.cue)).toEqual(expected);
    expect(right.ports.haptics.fired).toEqual([...Array.from({ length: 20 }, () => 'selection'), 'impact-light', 'success']);
    const heard = (run: typeof right) => run.heard.map(({ cue, at }) => ({ cue, at }));
    expect(heard(wrong)).toEqual(heard(right));
    expect([wrong.ports.sound.played, wrong.ports.haptics.fired]).toEqual([right.ports.sound.played, right.ports.haptics.fired]);
  });

  it('Check: a skip is an accepted submission with the same cue 10', async () => {
    const { service, ports } = await setup('check');
    await service.submit({ kind: 'skip' });
    expect(ports.sound.played.map((play) => play.cue)).toEqual(['card-dealt', 'answer-accepted', 'card-dealt']);
    expect(ports.haptics.fired).toEqual(['selection']);
  });

  it('Check: cue 10 plays once the recorded view is published, before anything is scored', async () => {
    const { service, heard } = await setup('check');
    await service.submit({ kind: 'answer', value: 1 });
    const accepted = heard.find((entry) => entry.cue === 'answer-accepted')!;
    expect(accepted.snapshot).toMatchObject({ status: 'active', view: { phase: 'recorded', entered: 1, results: null } });
    expect(accepted.snapshot.status === 'active' && accepted.snapshot.view).not.toHaveProperty('feedback');
  });

  it('holds feedback cues while a Check attempt is unfinished, and lets them play again once it ends', async () => {
    const { service, ports, feedback } = await setup('check');
    feedback.cue('milestone');
    feedback.cue('correct');
    expect(ports.sound.played.map((play) => play.cue)).toEqual(['card-dealt']);
    await answerAll(service, reference);
    feedback.cue('milestone');
    expect(ports.sound.played.at(-1)?.cue).toBe('milestone');
  });

  // #132 handoff; #135
  it('keeps holding feedback cues while a Check attempt is paused or suspended, and plays no cue for pausing or resuming', async () => {
    const { service, ports, feedback } = await setup('check');
    service.pause();
    feedback.cue('correct');
    await service.resume();
    service.suspend('navigation');
    feedback.cue('milestone');
    await service.resume();
    expect(ports.sound.played.map((play) => play.cue)).toEqual(['card-dealt']);
  });

  // Spec 3 Audio and haptics (cue 12); #135
  it('plays cue 12 when the learner ends an attempt from it, and not when it is ended to set up another', async () => {
    const shown = await setup('check');
    await shown.service.end();
    expect(shown.ports.sound.played.map((play) => play.cue)).toEqual(['card-dealt', 'attempt-ended']);

    const hidden = await setup('check');
    await hidden.service.end({ showResults: false });
    expect(hidden.ports.sound.played.map((play) => play.cue)).toEqual(['card-dealt']);
  });

  // Spec 3 Audio and haptics (cue 12), Amendment 1 C3; #135
  it('plays no cue 12 for an attempt that ends unusable as the app starts', async () => {
    const first = await setup('check');
    const later = await setup('check', first.store.reopen(), { version: 2, entries: [{ id: 'defect', match: { engine: ENGINE_VERSION }, explanation: 'A defect.' }] });
    expect(later.service.snapshot()).toMatchObject({ status: 'ended', record: { endingReason: 'unusable' } });
    expect(later.ports.sound.played.map((play) => play.cue)).not.toContain('attempt-ended');
    expect(later.seen.map((snapshot) => snapshot.status)).not.toContain('active');
  });

  it('Learn: a right answer plays cue 13 and a wrong one cue 14 with its haptic; Learn never plays cue 10', async () => {
    const { service, ports } = await setup('learn');
    const first = service.snapshot();
    if (first.status !== 'active') throw new Error('not active');
    await service.submit({ kind: 'answer', value: reference(first.view) });
    await service.submit({ kind: 'next-item' });
    const second = service.snapshot();
    if (second.status !== 'active') throw new Error('not active');
    await service.submit({ kind: 'answer', value: wrongFor(second.view) });
    await service.submit({ kind: 'retry-item' });
    await service.submit({ kind: 'answer', value: reference(second.view) });

    expect(ports.sound.played.map((play) => play.cue)).toEqual(['card-dealt', 'correct', 'card-dealt', 'incorrect', 'correct']);
    expect(ports.haptics.fired).toEqual(['error']);
  });

  it('plays nothing for an attempt picked up after a restart until something new happens', async () => {
    const first = await setup('check');
    await first.service.submit({ kind: 'answer', value: 1 });
    first.stop();
    const later = await setup('check', first.store.reopen());
    expect(later.ports.sound.played).toEqual([]);
    // Spec 3 Amendment 1 C1; #135
    await later.service.resume();
    expect(later.ports.sound.played).toEqual([]);
    await later.service.submit({ kind: 'answer', value: 1 });
    expect(later.ports.sound.played.map((play) => play.cue)).toEqual(['answer-accepted', 'card-dealt']);
  });

  // Spec 3 Comparison groups, records and progression (Milestones); Audio and haptics (cue 16); #140
  it('plays cue 16 with the success haptic on the results of an attempt that sets a personal best, and not on one that sets none', async () => {
    const { service, ports } = await setup('learn');
    await answerAll(service, reference);
    expect(service.snapshot()).toMatchObject({ status: 'ended', earned: { bests: ['card-values'] } });
    expect(ports.sound.played.map((play) => play.cue).slice(-2)).toEqual(['attempt-ended', 'milestone']);
    expect(ports.haptics.fired.at(-1)).toBe('success');

    const before = ports.sound.played.length;
    await service.retry();
    await answerAll(service, wrongFor);
    expect(service.snapshot()).toMatchObject({ status: 'ended', earned: { bests: [], fastest: null } });
    expect(ports.sound.played.slice(before).map((play) => play.cue)).not.toContain('milestone');
  });

  // #141
  it('plays cue 16 with the success haptic on the results of the Check that earns a readiness milestone, even with no new personal best', async () => {
    const { service, ports } = await setup('check');
    await answerAll(service, reference);
    const before = ports.sound.played.length;
    await service.retry();
    await answerAll(service, reference);
    expect(service.snapshot()).toMatchObject({ status: 'ended', earned: { bests: [], fastest: null, readiness: { kind: 'earned' } } });
    expect(ports.sound.played.slice(before).map((play) => play.cue).slice(-2)).toEqual(['attempt-ended', 'milestone']);
    expect(ports.haptics.fired.at(-1)).toBe('success');
  });

  it('plays no cue 16 for an abandoned attempt', async () => {
    const { service, ports } = await setup('check');
    await service.end();
    expect(ports.sound.played.map((play) => play.cue)).toEqual(['card-dealt', 'attempt-ended']);
  });

  // Spec 3 Audio and haptics; #139
  it('Play: each wager plays cue 2 as it is shown and each round\'s result plays cue 6, 7 or 8 once the round is seen to resolve, Check included', async () => {
    const table = { ...DEFAULT_TABLE_SETUP, seat: 'play', betSchedule: true } as const;
    const { service, ports } = await setup('check', new MemoryTrainingStore(), EMPTY_QUARANTINE_LIST, { category: 'table', variant: 'check', table });
    const nets: string[] = [];
    for (let guard = 0; guard < 3000 && service.snapshot().status === 'active'; guard++) {
      const snapshot = service.snapshot();
      if (snapshot.status !== 'active') break;
      const { view } = snapshot;
      const before = ports.sound.played.length;
      await service.submit(
        view.phase === 'question'
          ? { kind: 'skip' }
          : view.phase === 'bet'
            ? { kind: 'bet', amount: view.table?.bet?.amounts[0] as string }
            : view.phase === 'decision'
              ? { kind: 'play', action: view.table?.decision?.kind === 'insurance' ? 'decline-insurance' : 'stand' }
              : { kind: 'next-item' },
      );
      const after = service.snapshot();
      const played = ports.sound.played.slice(before).map((play) => play.cue);
      if (after.status === 'active' && played.some((cue) => cue.startsWith('net-'))) nets.push(`${after.view.table?.settled}`);
    }
    const heard = ports.sound.played.map((play) => play.cue);
    expect(heard.filter((cue) => cue === 'stake-set').length).toBeGreaterThanOrEqual(10);
    expect(heard.filter((cue) => cue.startsWith('net-')).length).toBe(10);
    expect(nets.every((settled) => settled === 'true')).toBe(true);
    expect(heard.filter((cue) => cue === 'correct' || cue === 'incorrect' || cue === 'correction-offered')).toEqual([]);
  });
});
