// The audio/haptics service: plays a catalog cue and its paired haptic under
// the device's preferences. Dispatch is fire-and-forget, so a cue never delays
// or gates a state change, and nothing a cue does can fail the caller.

import { cueNamed, type CueName, type HapticPattern } from './catalog';
import type { DeviceSettings, SettingsStorage } from './settings';

export interface SoundPort {
  /** Starts the cue's bundled sound at `volume` (0–1), cutting off any cue still playing. */
  play(cue: CueName, volume: number): void;
}

export interface HapticsPort {
  fire(pattern: HapticPattern): void;
}

export interface FeedbackPorts {
  readonly sound: SoundPort;
  readonly haptics: HapticsPort;
  readonly storage: SettingsStorage;
  /** False while the app is in the background, where nothing plays. */
  isForeground(): boolean;
}

export class FeedbackService {
  private checkActive = false;

  constructor(
    private readonly ports: FeedbackPorts,
    readonly settings: DeviceSettings,
  ) {}

  /**
   * Marks a Check attempt as active or not. While one is, feedback cues and
   * their haptics are withheld, exactly as on-screen feedback is. Spec 3's
   * challenges drive this; until then it is a test fixture.
   */
  setCheckActive(active: boolean): void {
    this.checkActive = active;
  }

  cue(name: CueName): void {
    const cue = cueNamed(name);
    if (cue.kind === 'feedback' && this.checkActive) return;
    if (!this.ports.isForeground()) return;
    const { soundVolume, haptics } = this.settings.snapshot();
    if (soundVolume > 0) {
      try {
        this.ports.sound.play(name, soundVolume / 100);
      } catch {
        // A cue is never required: every one mirrors something already shown.
      }
    }
    if (haptics && cue.haptic) {
      try {
        this.ports.haptics.fire(cue.haptic);
      } catch {
        // As above.
      }
    }
  }
}
