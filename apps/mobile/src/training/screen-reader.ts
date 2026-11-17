// Spec 3 User stories 64–65; Attempt lifecycle › Automatic pacing; #136
import { AccessibilityInfo, Platform } from 'react-native';

import type { ScreenReaderSpeech } from './speech';

// shortcut: #161
const TALKBACK_MS_PER_CHARACTER = 70;
const VOICEOVER_FINISH_LIMIT_MS = 10_000;

export function screenReaderSpeech(platform: typeof Platform.OS = Platform.OS, now: () => number = Date.now): ScreenReaderSpeech {
  let enabled = false;
  let pending: { readonly message: string; readonly until: number } | null = null;
  void AccessibilityInfo.isScreenReaderEnabled().then(
    (on) => void (enabled = on),
    () => undefined,
  );
  AccessibilityInfo.addEventListener('screenReaderChanged', (on: boolean) => {
    enabled = on;
    if (!on) pending = null;
  });
  AccessibilityInfo.addEventListener('announcementFinished', ({ announcement, success }: { announcement: string; success: boolean }) => {
    if (success && pending?.message === announcement) pending = null;
  });
  return {
    announce(message) {
      AccessibilityInfo.announceForAccessibility(message);
      if (!enabled) return;
      const lasts = platform === 'ios' ? VOICEOVER_FINISH_LIMIT_MS : message.length * TALKBACK_MS_PER_CHARACTER;
      pending = { message, until: now() + lasts };
    },
    speaking: () => pending !== null && now() < pending.until,
  };
}
