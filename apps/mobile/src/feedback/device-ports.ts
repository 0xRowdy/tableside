import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { AppState, Platform } from 'react-native';

import type { CueName, HapticPattern } from './catalog';
import type { FeedbackPorts } from './service';
import { CUE_SOUNDS } from './sounds';

// Spec 1 Audio and haptics
export const AUDIO_MODE = {
  playsInSilentMode: false,
  interruptionMode: 'mixWithOthers',
  shouldPlayInBackground: false,
  allowsRecording: false,
} as const;

const IOS_HAPTICS: Record<HapticPattern, () => Promise<void>> = {
  selection: () => Haptics.selectionAsync(),
  'impact-light': () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  'impact-medium': () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  'impact-heavy': () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
};

// Spec 1 Launch gates 8
const ANDROID_HAPTICS: Record<HapticPattern, Haptics.AndroidHaptics> = {
  selection: Haptics.AndroidHaptics.Segment_Tick,
  'impact-light': Haptics.AndroidHaptics.Clock_Tick,
  'impact-medium': Haptics.AndroidHaptics.Context_Click,
  'impact-heavy': Haptics.AndroidHaptics.Long_Press,
  success: Haptics.AndroidHaptics.Confirm,
  warning: Haptics.AndroidHaptics.Gesture_End,
  error: Haptics.AndroidHaptics.Reject,
};

const fireHaptic = (pattern: HapticPattern) =>
  Platform.OS === 'android' ? Haptics.performAndroidHapticsAsync(ANDROID_HAPTICS[pattern]) : IOS_HAPTICS[pattern]();

export const SETTINGS_FILE = 'sound-and-haptics.json';

export function createDevicePorts(): FeedbackPorts {
  void setAudioModeAsync(AUDIO_MODE).catch(() => undefined);

  const players = new Map((Object.keys(CUE_SOUNDS) as CueName[]).map((cue) => [cue, createAudioPlayer(CUE_SOUNDS[cue])]));

  let playing: AudioPlayer | null = null;
  let foreground = AppState.currentState === 'active';
  AppState.addEventListener('change', (state) => {
    foreground = state === 'active';
    if (!foreground) playing?.pause();
  });

  const file = new File(Paths.document, SETTINGS_FILE);

  return {
    sound: {
      play(cue, volume) {
        playing?.pause();
        const next = players.get(cue) as AudioPlayer;
        next.volume = volume;
        void next.seekTo(0).catch(() => undefined);
        next.play();
        playing = next;
      },
    },
    haptics: {
      fire(pattern) {
        void fireHaptic(pattern).catch(() => undefined);
      },
    },
    storage: {
      read: async () => (file.exists ? file.text() : null),
      write: async (text) => {
        await file.write(text);
      },
    },
    isForeground: () => foreground,
  };
}
