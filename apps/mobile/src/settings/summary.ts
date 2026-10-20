import type { FeedbackSettings } from '@/feedback/settings';

/** A Sound effects volume in words: "Off" at zero, else a percentage. */
export const volumeText = (volume: number) => (volume === 0 ? 'Off' : `${volume}%`);

/** The Sound & haptics row's summary, e.g. "Sound effects 70% · Haptics on". */
export function soundAndHapticsSummary({ soundVolume, haptics }: FeedbackSettings): string {
  return `Sound effects ${volumeText(soundVolume).toLowerCase()} · Haptics ${haptics ? 'on' : 'off'}`;
}
