import type { FeedbackSettings } from '@/feedback/settings';

/** The Sound & haptics row's summary, e.g. "Sound effects 70% · Haptics on". */
export function soundAndHapticsSummary({ soundVolume, haptics }: FeedbackSettings): string {
  return `Sound effects ${soundVolume === 0 ? 'off' : `${soundVolume}%`} · Haptics ${haptics ? 'on' : 'off'}`;
}
