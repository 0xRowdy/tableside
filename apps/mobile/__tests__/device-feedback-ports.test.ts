// The device ports' platform configuration, with the native audio, haptics and
// file modules replaced by recorders. What the platforms then do (the silent
// switch, mixing, system haptics) is checked on physical devices (gate 8).

import { AppState, Platform, type AppStateStatus } from 'react-native';

jest.unmock('@/feedback/device-ports');

const mockAudio = {
  mode: [] as object[],
  players: [] as { source: unknown; volume: number; plays: number; pauses: number; seeks: number[] }[],
};
jest.mock('expo-audio', () => ({
  setAudioModeAsync: async (mode: object) => {
    mockAudio.mode.push(mode);
  },
  createAudioPlayer: (source: unknown) => {
    const player = {
      source,
      volume: 1,
      plays: 0,
      pauses: 0,
      seeks: [] as number[],
      play() {
        player.plays++;
      },
      pause() {
        player.pauses++;
      },
      seekTo: async (seconds: number) => {
        player.seeks.push(seconds);
      },
    };
    mockAudio.players.push(player);
    return player;
  },
}));

const mockHaptics: string[] = [];
jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  selectionAsync: async () => void mockHaptics.push('selection'),
  impactAsync: async (style: string) => void mockHaptics.push(`impact ${style}`),
  notificationAsync: async (type: string) => void mockHaptics.push(`notification ${type}`),
  AndroidHaptics: {
    Segment_Tick: 'segment-tick',
    Clock_Tick: 'clock-tick',
    Context_Click: 'context-click',
    Long_Press: 'long-press',
    Confirm: 'confirm',
    Gesture_End: 'gesture-end',
    Reject: 'reject',
  },
  performAndroidHapticsAsync: async (type: string) => void mockHaptics.push(`android ${type}`),
}));

const mockFiles = new Map<string, string>();
jest.mock('expo-file-system', () => ({
  Paths: { document: 'documents' },
  File: class {
    private readonly path: string;
    constructor(directory: string, name: string) {
      this.path = `${directory}/${name}`;
    }
    get exists() {
      return mockFiles.has(this.path);
    }
    async text() {
      return mockFiles.get(this.path) as string;
    }
    async write(text: string) {
      mockFiles.set(this.path, text);
    }
  },
}));

import { CUES } from '@/feedback/catalog';
import { createDevicePorts } from '@/feedback/device-ports';
import { CUE_SOUNDS } from '@/feedback/sounds';

let appStateListener: ((state: AppStateStatus) => void) | null = null;

beforeEach(() => {
  mockAudio.mode = [];
  mockAudio.players = [];
  mockHaptics.length = 0;
  mockFiles.clear();
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListener = listener as (state: AppStateStatus) => void;
    return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
  });
});

describe('device feedback ports', () => {
  it('respects the silent switch, mixes with other audio and never plays in the background', () => {
    createDevicePorts();

    expect(mockAudio.mode).toEqual([
      { playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false, allowsRecording: false },
    ]);
  });

  it('loads every cue from a sound bundled with the app', () => {
    createDevicePorts();

    expect(mockAudio.players.map((player) => player.source)).toEqual(CUES.map((cue) => CUE_SOUNDS[cue.name]));
    for (const player of mockAudio.players) expect(typeof player.source).toBe('number');
  });

  it('plays a cue from its start at the given volume, cutting off the one still playing', () => {
    const ports = createDevicePorts();
    const [cardDealt, stakeSet] = mockAudio.players;

    ports.sound.play('card-dealt', 1);
    ports.sound.play('stake-set', 0.7);

    expect(cardDealt).toMatchObject({ plays: 1, pauses: 1, seeks: [0] });
    expect(stakeSet).toMatchObject({ plays: 1, pauses: 0, seeks: [0], volume: 0.7 });
  });

  it('stops a playing cue and reports the background when the app leaves the foreground', () => {
    const ports = createDevicePorts();
    ports.sound.play('ball-landed', 1);

    appStateListener?.('background');

    expect(mockAudio.players[4]?.pauses).toBe(1);
    expect(ports.isForeground()).toBe(false);
    appStateListener?.('active');
    expect(ports.isForeground()).toBe(true);
  });

  it('fires the standard platform pattern for each haptic, through the system feedback that follows the haptics setting', () => {
    const ports = createDevicePorts();

    for (const pattern of ['selection', 'impact-light', 'impact-medium', 'impact-heavy', 'success', 'warning', 'error'] as const) {
      ports.haptics.fire(pattern);
    }

    if (Platform.OS === 'android') {
      expect(mockHaptics).toEqual([
        'android segment-tick',
        'android clock-tick',
        'android context-click',
        'android long-press',
        'android confirm',
        'android gesture-end',
        'android reject',
      ]);
      return;
    }
    expect(mockHaptics).toEqual([
      'selection',
      'impact light',
      'impact medium',
      'impact heavy',
      'notification success',
      'notification warning',
      'notification error',
    ]);
  });

  it('keeps the preferences in a file on this device', async () => {
    const ports = createDevicePorts();
    expect(await ports.storage.read()).toBeNull();

    await ports.storage.write('{"soundVolume":70,"haptics":true}');

    expect(mockFiles.get('documents/sound-and-haptics.json')).toBe('{"soundVolume":70,"haptics":true}');
    expect(await createDevicePorts().storage.read()).toBe('{"soundVolume":70,"haptics":true}');
  });
});
