// A simulated device for seam 2 scenarios: an Account service with its own
// store, credentials, installation, entropy, clock, foreground state and
// connectivity, talking to the local stack only through its fault-injection proxy.
//
// The store is the app's own: the account vault and SQLCipher account store
// (apps/mobile/src/account) on real SQLCipher under Node, with spec 1's
// practice controller playing on it. The device's files and keychain outlive
// the app process, so a scenario can kill the app at any point and start it again.

import { randomUUID } from 'node:crypto';

// The app's account store and practice controller, imported by path: the
// harness is test-only, and the app doesn't depend on this package.
import { forAccountSession } from '../../../../apps/mobile/src/account/practice';
import type { SqliteActivityStore } from '../../../../apps/mobile/src/account/sqlite-store';
import { nodeSqlCipherDriver } from '../../../../apps/mobile/src/account/testing/node-sqlcipher';
import { TestDevice } from '../../../../apps/mobile/src/account/testing/vault-substitutes';
import type { AccountVault as AppVault, VaultOpening as AppVaultOpening } from '../../../../apps/mobile/src/account/vault';
import { PracticeController } from '../../../../apps/mobile/src/practice/controller';
import type { CompletedPracticeSession } from '../../../../apps/mobile/src/practice/store';
import { FakeClock as PracticeClock, substituteAdapters } from '../../../../apps/mobile/src/practice/testing/substitutes';
import {
  type AccountService,
  type AccountVault,
  type CodeVerificationResult,
  type CredentialStorage,
  type EligibilityBand,
  createAccountService,
} from '../service';
import type { DevicePorts, DeviceSignal } from '../sync/session';
import { FaultProxy } from './fault-proxy';
import { Mailbox } from './mailbox';
import type { LocalStack } from './stack';

/** A clock the scenario moves by hand. Moving it runs the timers that fall due. */
export class FakeClock {
  private readonly timers = new Set<{ readonly period: number; next: number; readonly run: () => void }>();

  constructor(private time: number = Date.now()) {}

  readonly now = (): number => this.time;

  advance(milliseconds: number): void {
    const end = this.time + milliseconds;
    for (;;) {
      const due = [...this.timers].filter((timer) => timer.next <= end).sort((a, b) => a.next - b.next)[0];
      if (!due) break;
      this.time = due.next;
      due.next += due.period;
      due.run();
    }
    this.time = end;
  }

  /** Runs `run` every `milliseconds` of this clock until cancelled. */
  every(milliseconds: number, run: () => void): () => void {
    const timer = { period: milliseconds, next: this.time + milliseconds, run };
    this.timers.add(timer);
    return () => this.timers.delete(timer);
  }
}

/** Deterministic bytes from a seed (xorshift32), so a scenario's identifiers repeat run to run. */
export class FakeEntropy {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }
  bytes(count: number): Uint8Array {
    const out = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      this.state ^= this.state << 13;
      this.state ^= this.state >>> 17;
      this.state ^= this.state << 5;
      out[i] = this.state & 0xff;
    }
    return out;
  }
}

/** SecureStore's stand-in. */
export class MemoryCredentials implements CredentialStorage {
  readonly items = new Map<string, string>();
  async getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  async setItem(key: string, value: string) {
    this.items.set(key, value);
  }
  async removeItem(key: string) {
    this.items.delete(key);
  }
}

/** A device value the scenario sets, which the app hears change. */
class Signal<T> implements DeviceSignal<T> {
  private readonly listeners = new Set<(value: T) => void>();
  constructor(private value: T) {}
  current = (): T => this.value;
  set(value: T): void {
    if (value === this.value) return;
    this.value = value;
    for (const listener of this.listeners) listener(value);
  }
  subscribe(listener: (value: T) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

/** The vault as the open app process has it. */
export interface DeviceVault {
  /** The account whose database is open, if any. */
  readonly openAccount: string | null;
  /** The open account session's store. Throws when none is open. */
  store(): SqliteActivityStore;
}

export interface SimulatedDevice {
  readonly name: string;
  /** The running app's Account service; a restart replaces it. */
  readonly account: AccountService;
  readonly vault: DeviceVault;
  readonly proxy: FaultProxy;
  readonly clock: FakeClock;
  readonly entropy: FakeEntropy;
  readonly credentials: MemoryCredentials;
  readonly mailbox: Mailbox;
  /** Whether the app is in the foreground. */
  foreground: boolean;
  /** While true, every database write fails (an I/O error), so its transaction rolls back. */
  diskFailing: boolean;
  /**
   * Plays one practice session to its end (roulette: a 10-unit red wager on a
   * 1,000 buy-in, one spin) on the open account and returns its saved result.
   */
  playPracticeSession(): Promise<CompletedPracticeSession>;
  /** The app process dies where it is: nothing it had in flight completes on the device. */
  kill(): void;
  /** Starts the app again after a kill (or kills it first), reopening the remembered account. */
  restart(): Promise<void>;
  /** Stops the app and removes the device's files. */
  dispose(): void;
}

/** One run of the app on the device, from launch until it is killed. */
interface AppProcess {
  readonly account: AccountService;
  readonly vault: DeviceVault;
  readonly appVault: AppVault;
  kill(): void;
}

let seed = 1;

export function createDevice(stack: LocalStack, options: { readonly name: string }): SimulatedDevice {
  const entropy = new FakeEntropy(seed++);
  const proxy = new FaultProxy();
  const clock = new FakeClock();
  const credentials = new MemoryCredentials();
  const hardware = new TestDevice();
  const foreground = new Signal(true);
  const disk = { failing: false };
  const driver = nodeSqlCipherDriver({ fault: () => (disk.failing ? 'io' : undefined) });

  const launch = (): AppProcess => {
    let dead = false;
    const cancels: (() => void)[] = [];
    const appVault = hardware.vault('local', driver);
    let opening: AppVaultOpening | null = null;

    const vault: AccountVault = {
      async open(accountId) {
        opening = await appVault.open(accountId);
        return opening;
      },
      async close() {
        opening = null;
        await appVault.close();
      },
    };
    const deviceVault: DeviceVault = {
      get openAccount() {
        return opening?.status === 'open' ? opening.session.accountId : null;
      },
      store() {
        if (opening?.status !== 'open') throw new Error('no account database is open');
        return opening.session.store;
      },
    };
    // Nothing reaches a dead process: its answers are lost, its timers and signals stop.
    const processFetch: typeof fetch = async (input, init) => {
      if (dead) throw new TypeError('the app is not running');
      const response = await proxy.fetch(input, init);
      if (dead) throw new TypeError('the app is not running');
      return response;
    };
    const live = <T>(signal: DeviceSignal<T>): DeviceSignal<T> => ({
      current: signal.current,
      subscribe(listener) {
        const stop = signal.subscribe((value) => !dead && listener(value));
        cancels.push(stop);
        return stop;
      },
    });
    // The process's live connections close with it.
    const sockets = new Set<WebSocket>();
    const ProcessWebSocket = class extends proxy.WebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        if (dead) this.close();
        sockets.add(this);
      }
    };
    const online = new Signal(proxy.online);
    cancels.push(proxy.onOnlineChange((value) => online.set(value)));
    const ports: DevicePorts = {
      foreground: live(foreground),
      online: live(online),
      every(milliseconds, run) {
        const stop = clock.every(milliseconds, () => !dead && run());
        cancels.push(stop);
        return stop;
      },
    };
    const account = createAccountService({
      backend: { url: stack.url, publishableKey: stack.publishableKey },
      fetch: processFetch,
      credentials,
      vault,
      clock: clock.now,
      device: ports,
      randomBytes: (count) => entropy.bytes(count),
      webSocket: ProcessWebSocket,
    });
    return {
      account,
      vault: deviceVault,
      appVault,
      kill() {
        dead = true;
        cancels.splice(0).forEach((cancel) => cancel());
        sockets.forEach((socket) => socket.close());
        void appVault.close();
      },
    };
  };

  let app = launch();

  return {
    name: options.name,
    get account() {
      return app.account;
    },
    get vault() {
      return app.vault;
    },
    proxy,
    clock,
    entropy,
    credentials,
    mailbox: new Mailbox(stack.mailUrl),
    get foreground() {
      return foreground.current();
    },
    set foreground(value: boolean) {
      foreground.set(value);
    },
    get diskFailing() {
      return disk.failing;
    },
    set diskFailing(value: boolean) {
      disk.failing = value;
    },
    async playPracticeSession() {
      const opening = openSession(app);
      const controller = new PracticeController(forAccountSession(substituteAdapters({ clock: new PracticeClock(undefined, true) }), opening));
      await controller.load();
      await controller.start({ game: 'roulette', buyIn: '1000' });
      await controller.placeWager('red', '10');
      await controller.spin();
      await controller.endSession();
      const snapshot = controller.snapshot();
      if (snapshot.status !== 'completed') throw new Error(`the practice session did not complete (${snapshot.status})`);
      return snapshot.result;
    },
    kill() {
      app.kill();
    },
    async restart() {
      app.kill();
      app = launch();
      const { status } = await app.account.resume();
      if (status !== 'resumed') throw new Error('the app did not reopen its account');
    },
    dispose() {
      app.kill();
      hardware.remove();
    },
  };
}

/** The open account session, as spec 1's practice adapters take it. */
function openSession(app: AppProcess) {
  const store = app.vault.store();
  const { identity } = store;
  return { ...identity, generation: app.appVault.generation, store };
}

/** An address no earlier run has used. */
export function uniqueEmail(label: string): string {
  return `${label}-${randomUUID().slice(0, 8)}@example.com`;
}

/** The Create path end to end on a device: age step, code request, the emailed code. */
export async function createAccountByEmail(
  device: SimulatedDevice,
  email: string,
  band: EligibilityBand = '18+',
): Promise<CodeVerificationResult> {
  if ((await device.account.answerAgeQuestion(band)).status !== 'eligible') return { status: 'failed' };
  if ((await device.account.requestEmailCode({ email, intent: 'create' })).status !== 'sent') return { status: 'failed' };
  return device.account.verifyEmailCode({ email, code: await device.mailbox.latestCode(email) });
}

/** Signs in to an existing account by email code on a device. */
export async function signInByEmail(device: SimulatedDevice, email: string): Promise<CodeVerificationResult> {
  const previous = (await device.mailbox.messages(email)).length > 0 ? await device.mailbox.latestCode(email) : undefined;
  if ((await device.account.requestEmailCode({ email, intent: 'sign-in' })).status !== 'sent') return { status: 'failed' };
  return device.account.verifyEmailCode({ email, code: await device.mailbox.latestCode(email, previous ? { after: previous } : {}) });
}
