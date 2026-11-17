// Spec 2 Timing, Retries

import type { ReconcileTrigger, SyncEngine } from './engine';
import { type LiveChannel, LiveUpdates } from './live';
import type { SyncStore } from './store';

export interface DeviceSignal<T> {
  current(): T;
  subscribe(listener: (value: T) => void): () => void;
}

export interface DevicePorts {
  readonly foreground: DeviceSignal<boolean>;
  readonly online: DeviceSignal<boolean>;
  every(milliseconds: number, run: () => void): () => void;
  after(milliseconds: number, run: () => void): () => void;
}

export const RECONCILE_INTERVAL_MS = 60_000;

export class SyncSession {
  private readonly live: LiveUpdates;
  private readonly stops: (() => void)[] = [];
  private cancelRetry: (() => void) | null = null;
  private retryScheduledAt: number | null = null;

  constructor(
    private readonly engine: SyncEngine,
    store: SyncStore,
    private readonly device: DevicePorts,
    connect: () => LiveChannel,
    private readonly clock: () => number,
  ) {
    this.live = new LiveUpdates(connect, () => this.reconcile('automatic'));
    this.stops.push(
      store.onUploadQueued(() => this.reconcile('automatic')),
      device.foreground.subscribe((foreground) => this.activeChanged(foreground)),
      device.online.subscribe((online) => this.activeChanged(online)),
      device.every(RECONCILE_INTERVAL_MS, () => {
        if (this.active()) this.reconcile('automatic');
      }),
      engine.onChange(() => this.scheduleRetry()),
    );
    this.reconcile('deliberate');
    this.goLive();
  }

  get isLive(): boolean {
    return this.live.live;
  }

  credentialsChanged(): void {
    this.live.renew();
  }

  end(): void {
    this.engine.stop();
    this.live.end();
    this.cancelRetry?.();
    for (const stop of this.stops.splice(0)) stop();
  }

  private activeChanged(entered: boolean): void {
    if (!entered) return this.live.close();
    this.reconcile('deliberate');
    this.goLive();
  }

  private active(): boolean {
    return this.device.foreground.current() && this.device.online.current();
  }

  private goLive(): void {
    if (this.active()) this.live.start();
  }

  private scheduleRetry(): void {
    const at = this.engine.retryAt;
    if (at === this.retryScheduledAt) return;
    this.cancelRetry?.();
    this.cancelRetry = null;
    this.retryScheduledAt = at;
    if (at === null) return;
    this.cancelRetry = this.device.after(Math.max(0, at - this.clock()), () => {
      this.cancelRetry = null;
      this.retryScheduledAt = null;
      if (this.active()) this.reconcile('automatic');
    });
  }

  private reconcile(trigger: ReconcileTrigger): void {
    this.engine.reconcile(trigger).catch(() => undefined);
  }
}
