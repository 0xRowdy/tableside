import { cueNamed, type CueName, type HapticPattern } from './catalog';
import type { DeviceSettings, SettingsStorage } from './settings';

export interface SoundPort {
  play(cue: CueName, volume: number): void;
}

export interface HapticsPort {
  fire(pattern: HapticPattern): void;
}

export interface FeedbackPorts {
  readonly sound: SoundPort;
  readonly haptics: HapticsPort;
  readonly storage: SettingsStorage;
  isForeground(): boolean;
}

export class FeedbackService {
  private checkActive = false;

  constructor(
    private readonly ports: FeedbackPorts,
    readonly settings: DeviceSettings,
  ) {}

  // Spec 3 Audio and haptics
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
      } catch {}
    }
    if (haptics && cue.haptic) {
      try {
        this.ports.haptics.fire(cue.haptic);
      } catch {}
    }
  }
}
