// When sync runs, for one account session (spec 2, *Timing* and *Retries*):
// upload after a save; reconcile when the session opens, on entering the
// foreground, on reconnection and every 60 s while foregrounded and
// connected; on a live "account changed" hint, which only the newest
// foregrounded installation receives; and when a retry falls due while
// foregrounded and connected. Saves, hints, the cadence and retries are
// automatic and wait out a backoff; opening, foregrounding and reconnecting
// are new chances and don't. Every trigger coalesces into the engine's one
// run, so a hint arriving with pending work makes no extra request. Ending
// the session stops everything: timers, the live connection, and any answer
// still in flight.

import type { ReconcileTrigger, SyncEngine } from './engine';
import { type LiveChannel, LiveUpdates } from './live';
import type { SyncStore } from './store';

/** A value the device reports, with changes. */
export interface DeviceSignal<T> {
  current(): T;
  /** Returns an unsubscribe function. */
  subscribe(listener: (value: T) => void): () => void;
}

/** What the device tells the Account service about itself. */
export interface DevicePorts {
  /** Whether the app is in the foreground. */
  readonly foreground: DeviceSignal<boolean>;
  /** Whether the device has a network connection. */
  readonly online: DeviceSignal<boolean>;
  /** Runs `run` every `milliseconds` until canceled. */
  every(milliseconds: number, run: () => void): () => void;
  /** Runs `run` once after `milliseconds`, unless canceled. */
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
      // Entering the foreground and reconnecting both reconcile and go live; leaving either ends the live connection.
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

  /** Whether this installation holds the live connection. */
  get isLive(): boolean {
    return this.live.live;
  }

  /** The credentials changed: the live connection joins again with them. */
  credentialsChanged(): void {
    this.live.renew();
  }

  /** Ends the session's sync (sign-out or account switch). */
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

  /** One timer for the engine's next due retry. It runs only while foregrounded and connected; otherwise the next deliberate trigger runs. */
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
    // Failures are the engine's status; the next trigger tries again.
    this.engine.reconcile(trigger).catch(() => undefined);
  }
}
