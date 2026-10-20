// Setup preferences: the last buy-in chosen for each game. A preference only
// prefills the next setup's field; it is never a balance or a wallet (#20).
// Kept in a file on this device.

import type { GameId } from '@/games';

/** Where the preferences live on this device. */
export interface SetupPreferencesStorage {
  read(): Promise<string | null>;
  write(text: string): Promise<void>;
}

/** Each game's last buy-in, canonical whole units. */
export type RememberedBuyIns = Readonly<Partial<Record<GameId, string>>>;

const GAMES: readonly GameId[] = ['blackjack', 'craps', 'roulette'];

function parse(text: string | null): RememberedBuyIns {
  if (text === null) return {};
  try {
    const value: unknown = JSON.parse(text);
    const buyIns = typeof value === 'object' && value !== null ? (value as { buyIns?: unknown }).buyIns : undefined;
    if (typeof buyIns !== 'object' || buyIns === null) return {};
    const kept: Partial<Record<GameId, string>> = {};
    for (const game of GAMES) {
      const amount = (buyIns as Record<string, unknown>)[game];
      if (typeof amount === 'string' && /^[1-9]\d{0,9}$/.test(amount)) kept[game] = amount;
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

  /** Reads the stored preferences; a buy-in remembered before the read finishes wins. */
  async load(): Promise<void> {
    const text = await this.storage.read().catch(() => null);
    if (!this.changed) this.set(parse(text));
  }

  /** Remembers a game's buy-in for its next setup. */
  async rememberBuyIn(game: GameId, amount: string): Promise<void> {
    this.changed = true;
    this.set({ ...this.current, [game]: amount });
    // A failed write keeps the preference for this launch; the next one writes again.
    await this.storage.write(JSON.stringify({ buyIns: this.current })).catch(() => undefined);
  }

  private set(next: RememberedBuyIns): void {
    this.current = next;
    for (const listener of this.listeners) listener();
  }
}
