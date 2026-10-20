// The feedback service's ports on a real device: expo-audio for the bundled
// cues, expo-haptics for the standard platform patterns, and a file in the
// app's document directory for the two preferences.

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { AppState, Platform } from 'react-native';

import type { CueName, HapticPattern } from './catalog';
import type { FeedbackPorts } from './service';
import { CUE_SOUNDS } from './sounds';

/**
 * The silent switch and silent or vibrate mode silence every app sound
 * (playsInSilentMode is true by default, so it is set off explicitly). Cues
 * mix with other apps' audio without ducking it or taking Android audio focus,
 * and nothing plays in the background.
 */
export const AUDIO_MODE = {
  playsInSilentMode: false,
  interruptionMode: 'mixWithOthers',
  shouldPlayInBackground: false,
  allowsRecording: false,
} as const;

/** iOS: the standard feedback generators, which follow the system haptics setting. */
const IOS_HAPTICS: Record<HapticPattern, () => Promise<void>> = {
  selection: () => Haptics.selectionAsync(),
  'impact-light': () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  'impact-medium': () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  'impact-heavy': () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
};

/**
 * Android: the system haptic feedback constants (View.performHapticFeedback),
 * which follow the system touch-feedback setting, unlike the vibrator that
 * impactAsync and notificationAsync use there. The nearest constant stands in
 * for each pattern; how each feels is measured on devices (gate 8).
 */
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

  // One player per cue, loaded up front so a cue starts without load time.
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
        // A new cue cuts off one still playing.
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
