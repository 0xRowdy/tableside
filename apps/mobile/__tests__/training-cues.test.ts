// Spec 3 Audio and haptics, Learn, Check and assistance, Testing Decisions › Seam 3 (cue dispatch); #132
import type { ChallengeVariant, ChallengeView } from '@tableside/engine';

import { FeedbackService } from '@/feedback/service';
import { DeviceSettings } from '@/feedback/settings';
import { substituteFeedbackPorts } from '@/feedback/testing/substitutes';
import { followTraining } from '@/feedback/training-cues';
import { alwaysAllowed } from '@/practice/adapters';
import { FakeClock, entropyFromWords, PI_WORDS } from '@/practice/testing/substitutes';
import { MemoryTrainingStore } from '@/training/memory-store';
import { TrainingService, type TrainingSnapshot } from '@/training/service';

// Spec 1 Game rules, Counting (Hi-Lo)
const HI_LO: Record<number, -1 | 0 | 1> = { 1: -1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 0, 8: 0, 9: 0, 10: -1, 11: -1, 12: -1, 13: -1 };

const reference = (view: ChallengeView) => HI_LO[view.item!.card.rank]!;
const wrongFor = (view: ChallengeView) => (reference(view) === 1 ? -1 : 1);

async function setup(variant: ChallengeVariant, store = new MemoryTrainingStore()) {
  const clock = new FakeClock(1_790_000_000_000, true);
  const service = new TrainingService({ store, access: alwaysAllowed, clock, entropy: entropyFromWords(PI_WORDS), newId: () => 'attempt-1', device: 'test-device', owner: 'local' });
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
  const stop = followTraining(service, feedback);
  await service.load();
  await service.startAttempt({ category: 'card-values', variant });
  return { service, ports, feedback, heard, stop, store };
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

    const expected = ['card-dealt', ...Array.from({ length: 19 }, () => ['answer-accepted', 'card-dealt']).flat(), 'answer-accepted', 'attempt-ended'];
    expect(right.ports.sound.played.map((play) => play.cue)).toEqual(expected);
    expect(right.ports.haptics.fired).toEqual([...Array.from({ length: 20 }, () => 'selection'), 'impact-light']);
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
    await later.service.submit({ kind: 'answer', value: 1 });
    expect(later.ports.sound.played.map((play) => play.cue)).toEqual(['answer-accepted', 'card-dealt']);
  });
});
