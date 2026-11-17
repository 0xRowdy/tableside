// Spec 3 Lessons › Entry points, Structure (First-use hints), Amendment 1 C7; #146
import { HINT_IDS, type Hint, type HintId } from '@tableside/definitions';

import type { DevicePreferences } from './store';

export const START_HERE_DISMISSED = 'learning.start-here-dismissed';
export const HINTS_SEEN = 'learning.hints-seen';

export interface LearningPreferences {
  readonly startHere: boolean;
  readonly unseenHints: readonly HintId[];
}

type SeenVersions = Partial<Record<HintId, number>>;

interface Saved {
  readonly dismissed: boolean;
  readonly seen: SeenVersions;
}

export class DeviceLearningPreferences {
  private saved: Promise<Saved> | null = null;

  constructor(
    private readonly store: DevicePreferences,
    private readonly hints: Readonly<Record<HintId, Hint>>,
  ) {}

  async read(): Promise<LearningPreferences> {
    const { dismissed, seen } = await this.load();
    return { startHere: !dismissed, unseenHints: HINT_IDS.filter((id) => seen[id] !== this.hints[id].version) };
  }

  async setStartHere(shown: boolean): Promise<void> {
    const saved = await this.load();
    this.saved = Promise.resolve({ ...saved, dismissed: !shown });
    await this.store.writePreference(START_HERE_DISMISSED, JSON.stringify(!shown)).catch(() => undefined);
  }

  async hintSeen(id: HintId): Promise<void> {
    const saved = await this.load();
    await this.saveSeen(saved, { ...saved.seen, [id]: this.hints[id].version });
  }

  async resetHints(): Promise<void> {
    await this.saveSeen(await this.load(), {});
  }

  private async saveSeen(saved: Saved, seen: SeenVersions): Promise<void> {
    this.saved = Promise.resolve({ ...saved, seen });
    await this.store.writePreference(HINTS_SEEN, JSON.stringify(seen)).catch(() => undefined);
  }

  private load(): Promise<Saved> {
    this.saved ??= Promise.all([this.readJson(START_HERE_DISMISSED), this.readJson(HINTS_SEEN)]).then(([dismissed, seen]) => ({
      dismissed: dismissed === true,
      seen: seenVersions(seen),
    }));
    return this.saved;
  }

  private async readJson(key: string): Promise<unknown> {
    const text = await this.store.readPreference(key).catch(() => null);
    if (text === null) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return null;
    }
  }
}

function seenVersions(value: unknown): SeenVersions {
  if (typeof value !== 'object' || value === null) return {};
  return Object.fromEntries(Object.entries(value).filter(([id, version]) => HINT_IDS.includes(id as HintId) && typeof version === 'number'));
}
