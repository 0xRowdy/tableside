// The audio/haptics service on substitute ports: cue dispatch per the launch
// catalog, the two device-local preferences and Check suppression.

import { CUES, type CueName } from '@/feedback/catalog';
import { FeedbackService } from '@/feedback/service';
import { DEFAULT_SETTINGS, DeviceSettings } from '@/feedback/settings';
import { substituteFeedbackPorts } from '@/feedback/testing/substitutes';

function setup(stored: string | null = null) {
  const ports = substituteFeedbackPorts(stored);
  const settings = new DeviceSettings(ports.storage);
  return { ports, settings, service: new FeedbackService(ports, settings) };
}

// The accepted pairing, written out from #49 rather than read from the catalog.
const HAPTICS: Record<CueName, string | null> = {
  'card-dealt': null,
  'stake-set': 'selection',
  'wager-removed': null,
  'dice-thrown': 'impact-medium',
  'ball-landed': 'impact-light',
  'net-win': 'success',
  'net-loss': 'impact-heavy',
  'net-even': null,
  'input-rejected': 'error',
  'answer-accepted': 'selection',
  'checkpoint-due': null,
  'attempt-ended': 'impact-light',
  correct: null,
  incorrect: 'error',
  'correction-offered': 'warning',
  milestone: 'success',
};

describe('the cue catalog', () => {
  it('has sixteen cues: 1–12 event cues and 13–16 feedback cues', () => {
    expect(CUES.map((cue) => cue.number)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    expect(CUES.filter((cue) => cue.kind === 'event').map((cue) => cue.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(CUES.filter((cue) => cue.kind === 'feedback').map((cue) => cue.number)).toEqual([13, 14, 15, 16]);
  });

  it('leaves cues 10, 11, 13, 14 and 16 to be first exercised by spec 3', () => {
    expect(CUES.filter((cue) => cue.firstExercisedBy === 'spec 3').map((cue) => cue.number)).toEqual([10, 11, 13, 14, 16]);
  });

  it('names a visible equivalent for every cue', () => {
    for (const cue of CUES) expect(cue.visibleEquivalent).not.toBe('');
  });
});

describe('the feedback service', () => {
  it('plays every cue at full volume with its paired haptic by default', () => {
    const { ports, service } = setup();

    for (const cue of CUES) service.cue(cue.name);

    expect(ports.sound.played).toEqual(CUES.map((cue) => ({ cue: cue.name, volume: 1 })));
    expect(ports.haptics.fired).toEqual(
      CUES.flatMap((cue) => HAPTICS[cue.name] ?? []),
    );
  });

  it('defaults to sound effects on at full volume and haptics on', () => {
    expect(DEFAULT_SETTINGS).toEqual({ soundVolume: 100, haptics: true });
    expect(setup().settings.snapshot()).toEqual(DEFAULT_SETTINGS);
  });

  it('plays at the chosen volume, and plays nothing at zero', async () => {
    const { ports, settings, service } = setup();

    await settings.setSoundVolume(40);
    service.cue('stake-set');
    await settings.setSoundVolume(0);
    service.cue('stake-set');

    expect(ports.sound.played).toEqual([{ cue: 'stake-set', volume: 0.4 }]);
    expect(ports.haptics.fired).toHaveLength(2);
  });

  it('fires no haptic when haptics are off, but still plays the sound', async () => {
    const { ports, settings, service } = setup();

    await settings.setHaptics(false);
    service.cue('net-win');

    expect(ports.haptics.fired).toEqual([]);
    expect(ports.sound.played).toEqual([{ cue: 'net-win', volume: 1 }]);
  });

  it('withholds feedback cues and their haptics while a Check attempt is active, but not event cues', () => {
    const { ports, service } = setup();

    service.setCheckActive(true);
    for (const cue of CUES) service.cue(cue.name);

    const events = CUES.filter((cue) => cue.kind === 'event').map((cue) => cue.name);
    expect(ports.sound.played.map((play) => play.cue)).toEqual(events);
    expect(ports.haptics.fired).toEqual(events.flatMap((name) => HAPTICS[name] ?? []));

    service.setCheckActive(false);
    service.cue('correct');
    expect(ports.sound.played.at(-1)).toEqual({ cue: 'correct', volume: 1 });
  });

  it('plays the same answer-accepted cue for right and wrong answers', () => {
    const { ports, service } = setup();
    service.setCheckActive(true);

    service.cue('answer-accepted'); // a right answer
    service.cue('answer-accepted'); // a wrong answer

    expect(ports.sound.played[0]).toEqual(ports.sound.played[1]);
    expect(ports.haptics.fired[0]).toEqual(ports.haptics.fired[1]);
  });

  it('plays and fires nothing while the app is in the background', () => {
    const { ports, service } = setup();

    ports.foreground = false;
    service.cue('net-loss');

    expect(ports.sound.played).toEqual([]);
    expect(ports.haptics.fired).toEqual([]);
  });

  it('never lets a failing sound or haptic reach the caller', () => {
    const { ports, service } = setup();
    ports.sound.fail = true;
    ports.haptics.fail = true;

    expect(() => service.cue('dice-thrown')).not.toThrow();
  });
});

describe('device-local settings', () => {
  it('stores both preferences on this device and reads them back on the next launch', async () => {
    const first = setup();
    await first.settings.setSoundVolume(70);
    await first.settings.setHaptics(false);

    const next = setup(first.ports.storage.text);
    await next.settings.load();

    expect(next.settings.snapshot()).toEqual({ soundVolume: 70, haptics: false });
  });

  it('falls back to the defaults when nothing usable is stored', async () => {
    for (const stored of [null, 'not json', '{"soundVolume":"loud","haptics":1}', '{"soundVolume":250}']) {
      const { settings } = setup(stored);
      await settings.load();
      expect(settings.snapshot()).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('keeps volumes whole percentages from 0 to 100', async () => {
    const { settings } = setup();

    await settings.setSoundVolume(130);
    expect(settings.snapshot().soundVolume).toBe(100);
    await settings.setSoundVolume(-5);
    expect(settings.snapshot().soundVolume).toBe(0);
    await settings.setSoundVolume(33.6);
    expect(settings.snapshot().soundVolume).toBe(34);
  });

  it('keeps a change for this launch even when it cannot be written', async () => {
    const { ports, settings } = setup();
    ports.storage.failWrites = true;

    await settings.setHaptics(false);

    expect(settings.snapshot().haptics).toBe(false);
  });

  it('does not let a late load overwrite a change made meanwhile', async () => {
    const { settings } = setup('{"soundVolume":20,"haptics":true}');
    const loading = settings.load();
    await settings.setSoundVolume(60);
    await loading;

    expect(settings.snapshot().soundVolume).toBe(60);
  });
});
