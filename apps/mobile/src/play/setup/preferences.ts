// #20

import { FUNDING_CEILING } from '@tableside/engine';

import { LAUNCH_GAMES, type GameId } from '@/games';

import { lessUnits } from '../units';

export interface SetupPreferencesStorage {
  read(): Promise<string | null>;
  write(text: string): Promise<void>;
}

export type RememberedBuyIns = Readonly<Partial<Record<GameId, string>>>;

const keepable = (amount: unknown): amount is string => typeof amount === 'string' && /^[1-9]\d*$/.test(amount) && amount.length <= 13 && !lessUnits(FUNDING_CEILING.toString(), amount);

function parse(text: string | null): RememberedBuyIns {
  if (text === null) return {};
  try {
    const value: unknown = JSON.parse(text);
    const buyIns = typeof value === 'object' && value !== null ? (value as { buyIns?: unknown }).buyIns : undefined;
    if (typeof buyIns !== 'object' || buyIns === null) return {};
    const kept: Partial<Record<GameId, string>> = {};
    for (const { id: game } of LAUNCH_GAMES) {
      const amount = (buyIns as Record<string, unknown>)[game];
      if (keepable(amount)) kept[game] = amount;
    }
    return kept;
  } catch {
    return {};
  }
}

export class SetupPreferences {
  private current: RememberedBuyIns = {};
  private changed = false;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly storage: SetupPreferencesStorage) {}

  snapshot = (): RememberedBuyIns => this.current;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async load(): Promise<void> {
    const text = await this.storage.read().catch(() => null);
    if (!this.changed) this.set(parse(text));
  }

  async rememberBuyIn(game: GameId, amount: string): Promise<void> {
    this.changed = true;
    this.set({ ...this.current, [game]: amount });
    await this.storage.write(JSON.stringify({ buyIns: this.current })).catch(() => undefined);
  }

  private set(next: RememberedBuyIns): void {
    this.current = next;
    for (const listener of this.listeners) listener();
  }
}
