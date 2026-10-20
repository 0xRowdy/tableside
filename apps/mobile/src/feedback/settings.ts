// The two Sound & haptics preferences. They are device-local: kept in a file on
// this device only, never synced, exported or touched by account deletion.

export interface FeedbackSettings {
  /** Sound effects volume as a whole percentage; 0 is off. */
  readonly soundVolume: number;
  readonly haptics: boolean;
}

export const DEFAULT_SETTINGS: FeedbackSettings = { soundVolume: 100, haptics: true };

/** Where the preferences live on this device. */
export interface SettingsStorage {
  read(): Promise<string | null>;
  write(text: string): Promise<void>;
}

const clampVolume = (volume: number) => Math.min(100, Math.max(0, Math.round(volume)));

function parse(text: string | null): FeedbackSettings {
  if (text === null) return DEFAULT_SETTINGS;
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== 'object' || value === null) return DEFAULT_SETTINGS;
    const { soundVolume, haptics } = value as Record<string, unknown>;
    const volumeOk = typeof soundVolume === 'number' && Number.isInteger(soundVolume) && soundVolume >= 0 && soundVolume <= 100;
    return {
      soundVolume: volumeOk ? soundVolume : DEFAULT_SETTINGS.soundVolume,
      haptics: typeof haptics === 'boolean' ? haptics : DEFAULT_SETTINGS.haptics,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export class DeviceSettings {
  private current: FeedbackSettings = DEFAULT_SETTINGS;
  private changed = false;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly storage: SettingsStorage) {}

  snapshot = (): FeedbackSettings => this.current;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Reads the stored preferences; a change made before the read finishes wins. */
  async load(): Promise<void> {
    const text = await this.storage.read().catch(() => null);
    if (!this.changed) this.set(parse(text));
  }

  setSoundVolume(volume: number): Promise<void> {
    return this.change({ ...this.current, soundVolume: clampVolume(volume) });
  }

  setHaptics(on: boolean): Promise<void> {
    return this.change({ ...this.current, haptics: on });
  }

  private async change(next: FeedbackSettings): Promise<void> {
    this.changed = true;
    this.set(next);
    // A failed write keeps the change for this launch; the next change writes again.
    await this.storage.write(JSON.stringify(next)).catch(() => undefined);
  }

  private set(next: FeedbackSettings): void {
    this.current = next;
    for (const listener of this.listeners) listener();
  }
}
