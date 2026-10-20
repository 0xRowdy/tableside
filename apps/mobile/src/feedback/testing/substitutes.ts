// Substitute feedback ports for tests: they record what would have played and
// keep the preferences file in memory.

import type { CueName, HapticPattern } from '../catalog';
import type { FeedbackPorts } from '../service';
import type { SettingsStorage } from '../settings';

export class RecordingSound {
  played: { cue: CueName; volume: number }[] = [];
  fail = false;
  play(cue: CueName, volume: number): void {
    if (this.fail) throw new Error('sound unavailable');
    this.played.push({ cue, volume });
  }
}

export class RecordingHaptics {
  fired: HapticPattern[] = [];
  fail = false;
  fire(pattern: HapticPattern): void {
    if (this.fail) throw new Error('haptics unavailable');
    this.fired.push(pattern);
  }
}

export class MemorySettingsStorage implements SettingsStorage {
  failWrites = false;
  constructor(public text: string | null = null) {}
  async read(): Promise<string | null> {
    return this.text;
  }
  async write(text: string): Promise<void> {
    if (this.failWrites) throw new Error('write failed');
    this.text = text;
  }
}

export interface SubstituteFeedbackPorts extends FeedbackPorts {
  readonly sound: RecordingSound;
  readonly haptics: RecordingHaptics;
  readonly storage: MemorySettingsStorage;
  /** Set false to put the app in the background. */
  foreground: boolean;
}

export function substituteFeedbackPorts(stored: string | null = null): SubstituteFeedbackPorts {
  return {
    sound: new RecordingSound(),
    haptics: new RecordingHaptics(),
    storage: new MemorySettingsStorage(stored),
    foreground: true,
    isForeground() {
      return this.foreground;
    },
  };
}
