// The practice controller with substitute adapters, followed by the feedback
// service on recording ports: which cues a roulette session fires, and that
// play is identical with sound and haptics off.
// Spins come from the Random123 "pi digits" stream: 27 (red), 0, 25 (red).

import { followPractice } from '@/feedback/practice-cues';
import { FeedbackService } from '@/feedback/service';
import { DeviceSettings } from '@/feedback/settings';
import { substituteFeedbackPorts } from '@/feedback/testing/substitutes';
import { PracticeController } from '@/practice/controller';
import { FakeClock, substituteAdapters } from '@/practice/testing/substitutes';

async function setup(stored: string | null = null) {
  const adapters = substituteAdapters({ clock: new FakeClock(undefined, true) });
  const controller = new PracticeController(adapters);
  const ports = substituteFeedbackPorts(stored);
  const settings = new DeviceSettings(ports.storage);
  await settings.load();
  const service = new FeedbackService(ports, settings);
  const stop = followPractice(controller, service);
  // Every published state with the time it was published at.
  const timeline: unknown[] = [];
  controller.subscribe(() => {
    const snapshot = controller.snapshot();
    timeline.push({ at: adapters.clock.now(), snapshot });
  });
  await controller.load();
  await controller.start({ game: 'roulette', buyIn: '1000' });
  return { controller, ports, service, stop, timeline };
}

/** A session that wins, loses and breaks even, with a removed wager and a rejected stake. */
async function playScript(controller: PracticeController) {
  await controller.placeWager('red', '10');
  await controller.placeWager('red', '0');
  await controller.placeWager('red', '10');
  await controller.placeWager('straight-27', '5');
  await controller.placeWager('black', '5'); // below the outside minimum of 10
  await controller.spin(); // 27: red and straight 27 win
  await controller.placeWager('red', '10');
  await controller.spin(); // 0: red loses
  await controller.placeWager('red', '10');
  await controller.placeWager('black', '10');
  await controller.spin(); // 25: red wins 10, black loses 10
  await controller.placeWager('red', '10');
  await controller.endSession(); // the red wager comes back, then the result
}

describe('cues during roulette play', () => {
  it('fires one cue per visible change and one net-result cue per spin', async () => {
    const { controller, ports } = await setup();

    await playScript(controller);

    expect(controller.snapshot().status).toBe('completed');
    expect(ports.sound.played.map((play) => play.cue)).toEqual([
      'stake-set',
      'wager-removed',
      'stake-set',
      'stake-set',
      'input-rejected',
      'ball-landed',
      'net-win',
      'stake-set',
      'ball-landed',
      'net-loss',
      'stake-set',
      'stake-set',
      'ball-landed',
      'net-even',
      'stake-set',
      'wager-removed',
      'attempt-ended',
    ]);
    expect(ports.haptics.fired).toEqual([
      'selection',
      'selection',
      'selection',
      'error',
      'impact-light',
      'success',
      'selection',
      'impact-light',
      'impact-heavy',
      'selection',
      'selection',
      'impact-light',
      'selection',
      'impact-light',
    ]);
  });

  it('plays nothing for a resumed session until something new happens', async () => {
    const adapters = substituteAdapters({ clock: new FakeClock(undefined, true) });
    const first = new PracticeController(adapters);
    await first.load();
    await first.start({ game: 'roulette', buyIn: '1000' });
    await first.placeWager('red', '10');
    // The next launch resumes the session from the same store.
    const resumed = new PracticeController(adapters);
    const ports = substituteFeedbackPorts();
    followPractice(resumed, new FeedbackService(ports, new DeviceSettings(ports.storage)));

    // The launch finds it suspended; the player resumes it.
    await resumed.load();
    await resumed.resume();
    expect(resumed.snapshot().status).toBe('active');
    expect(ports.sound.played).toEqual([]);

    await resumed.placeWager('red', '20');
    expect(ports.sound.played.map((play) => play.cue)).toEqual(['stake-set']);
  });

  it('stops following when asked', async () => {
    const { controller, ports, stop } = await setup();
    stop();

    await controller.placeWager('red', '10');

    expect(ports.sound.played).toEqual([]);
  });
});

describe('sound and haptics off', () => {
  it('produce the same states at the same times as both on', async () => {
    const on = await setup();
    const soundOff = await setup('{"soundVolume":0,"haptics":true}');
    const hapticsOff = await setup('{"soundVolume":100,"haptics":false}');
    const bothOff = await setup('{"soundVolume":0,"haptics":false}');

    for (const run of [on, soundOff, hapticsOff, bothOff]) await playScript(run.controller);

    expect(on.ports.sound.played.length).toBeGreaterThan(0);
    expect(on.ports.haptics.fired.length).toBeGreaterThan(0);
    expect(soundOff.ports.sound.played).toEqual([]);
    expect(hapticsOff.ports.haptics.fired).toEqual([]);
    expect(bothOff.ports.sound.played).toEqual([]);
    expect(bothOff.ports.haptics.fired).toEqual([]);
    for (const run of [soundOff, hapticsOff, bothOff]) expect(run.timeline).toEqual(on.timeline);
  });
});
