import type { FeedbackSettings } from '@/feedback/settings';

export const volumeText = (volume: number) => (volume === 0 ? 'Off' : `${volume}%`);

export function soundAndHapticsSummary({ soundVolume, haptics }: FeedbackSettings): string {
  return `Sound effects ${volumeText(soundVolume).toLowerCase()} · Haptics ${haptics ? 'on' : 'off'}`;
}
