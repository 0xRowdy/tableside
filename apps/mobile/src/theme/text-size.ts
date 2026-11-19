// docs/decisions/text-size-type-floor.md; spec 2 Amendment 10 §3

import { TEXT_STEPS, type TextStep } from './tokens';

export interface TextSizeStorage {
  read(): Promise<string | null>;
  write(text: string): Promise<void>;
}

export interface TextSizeState {
  readonly loaded: boolean;
  readonly step: TextStep;
  readonly chosen: boolean;
}

const isStep = (value: unknown): value is TextStep => typeof value === 'string' && (TEXT_STEPS as readonly string[]).includes(value);

export function parseTextSize(text: string | null): { step: TextStep; chosen: boolean } {
  if (text === null) return { step: 'standard', chosen: false };
  try {
    const value: unknown = JSON.parse(text);
    const step = typeof value === 'object' && value !== null ? (value as { step?: unknown }).step : undefined;
    return isStep(step) ? { step, chosen: true } : { step: 'standard', chosen: false };
  } catch {
    return { step: 'standard', chosen: false };
  }
}

export class TextSizeSetting {
  private current: TextSizeState = { loaded: false, step: 'standard', chosen: false };
  private readonly listeners = new Set<() => void>();

  constructor(private readonly storage: TextSizeStorage) {}

  snapshot = (): TextSizeState => this.current;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async load(): Promise<void> {
    const text = await this.storage.read().catch(() => null);
    if (this.current.loaded) return;
    this.set({ loaded: true, ...parseTextSize(text) });
  }

  async choose(step: TextStep): Promise<void> {
    this.set({ loaded: true, step, chosen: true });
    await this.storage.write(JSON.stringify({ step })).catch(() => undefined);
  }

  private set(next: TextSizeState): void {
    this.current = next;
    for (const listener of this.listeners) listener();
  }
}
