// A simulated device for seam 2 scenarios: an Account service with its own
// store, credentials, installation, entropy, clock, foreground state and
// connectivity, talking to the local stack only through its fault-injection proxy.
//
// The store is the app's own: the account vault and SQLCipher account store
// (apps/mobile/src/account) on real SQLCipher under Node, with spec 1's
// practice controller playing on it. The device's files and keychain outlive
// the app process, so a scenario can kill the app at any point and start it again.

import { randomUUID } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';

import { canonicalJson } from '@tableside/engine';

// The app's account store and practice controller, imported by path: the
// harness is test-only, and the app doesn't depend on this package.
import { followAccountGate, withAccountGate } from '../../../../apps/mobile/src/account/gate-access';
import { forAccountSession } from '../../../../apps/mobile/src/account/practice';
import type { SqliteActivityStore } from '../../../../apps/mobile/src/account/sqlite-store';
import type { StoreMigration } from '../../../../apps/mobile/src/account/store-schema';
import { nodeSqlCipherDriver } from '../../../../apps/mobile/src/account/testing/node-sqlcipher';
import { TestDevice } from '../../../../apps/mobile/src/account/testing/vault-substitutes';
import type { AccountVault as AppVault, VaultOpening as AppVaultOpening } from '../../../../apps/mobile/src/account/vault';
import { PracticeController } from '../../../../apps/mobile/src/practice/controller';
import type { CompletedPracticeSession } from '../../../../apps/mobile/src/practice/store';
import { FakeClock as PracticeClock, substituteAdapters } from '../../../../apps/mobile/src/practice/testing/substitutes';
import type { AgeSignal, EligibilityBand, PlatformAgeSignals } from '../eligibility';
import type { EnvironmentName } from '../environment';
import type { MetricsSink } from '../metrics';
import {
  type AccountService,
  type AccountVault,
  type CodeVerificationResult,
  type CredentialStorage,
  createAccountService,
} from '../service';
import type { RecordType } from '../sync/registry';
import type { DevicePorts, DeviceSignal } from '../sync/session';
import { FaultProxy } from './fault-proxy';
import type { TestIdentityProvider, TestProviderPorts } from './identity-provider';
import { Mailbox } from './mailbox';
import { testRecordTypes } from './record-types';
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

  /** Runs `run` once, `milliseconds` from now on this clock, unless canceled. */
  after(milliseconds: number, run: () => void): () => void {
    const cancel = this.every(Math.max(1, milliseconds), () => {
      cancel();
      run();
    });
    return cancel;
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
  /** Every access in order, as "get <key>", "set <key>" or "remove <key>". */
  readonly log: string[] = [];
  async getItem(key: string) {
    this.log.push(`get ${key}`);
    return this.items.get(key) ?? null;
  }
  async setItem(key: string, value: string) {
    this.log.push(`set ${key}`);
    this.items.set(key, value);
  }
  async removeItem(key: string) {
    this.log.push(`remove ${key}`);
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

/**
 * The device's platform age signal, which the scenario sets: unsupported (an
 * older OS) by default. It records each check, and whether it could prompt.
 */
export class FakeAgeSignals implements PlatformAgeSignals {
  /** What the platform answers next. */
  signal: AgeSignal = { kind: 'unavailable' };
  readonly checks: ('interactive' | 'silent')[] = [];
  constructor(public supported = false) {}
  async check({ interactive }: { readonly interactive: boolean }): Promise<AgeSignal> {
    this.checks.push(interactive ? 'interactive' : 'silent');
    return this.signal;
  }
}

/** The vault as the open app process has it. */
export interface DeviceVault {
  /** The account whose database is open, if any. */
  readonly openAccount: string | null;
  /** Ends the account session: closes its database, keeping it. */
  close(): Promise<void>;
  /** Whether any of an environment's data is still on the device. */
  holds(environment: EnvironmentName): boolean;
  /** Whether any file of the account's database (or its sidecars and backups) is still on the device, in this build's environment. */
  holdsAccount(accountId: string): boolean;
  /** The accounts whose app data (export copies, offline game) the app erased, in order. */
  readonly erasedAppData: readonly string[];
  /** The environments whose namespaces this app process removed, in order. */
  readonly removed: readonly EnvironmentName[];
  /** The open account session's store. Throws when none is open. */
  store(): SqliteActivityStore;
}

export interface SimulatedDevice {
  readonly name: string;
  /** The backend environment the device's build talks to. */
  readonly environment: EnvironmentName;
  /** The running app's Account service; a restart replaces it. */
  readonly account: AccountService;
  readonly vault: DeviceVault;
  readonly proxy: FaultProxy;
  readonly clock: FakeClock;
  readonly entropy: FakeEntropy;
  readonly credentials: MemoryCredentials;
  readonly mailbox: Mailbox;
  /** The platform's age signal; a restart keeps it (it is the device's). */
  readonly ageSignals: FakeAgeSignals;
  /** Who is signed in at Apple and Google on the device, and what their sheets and browser did. Null without an identity provider. */
  readonly providers: TestProviderPorts | null;
  /** Whether the app is in the foreground. */
  foreground: boolean;
  /** While true, every database write fails (an I/O error), so its transaction rolls back. */
  diskFailing: boolean;
  /** The device's free storage in bytes, as the app reads it; null (can't tell) by default. A restart keeps it. */
  freeStorage: number | null;
  /**
   * Plays one practice session to its end (roulette: a 10-unit red wager on a
   * 1,000 buy-in, one spin) on the open account and returns its saved result.
   * `activityId` names it instead of the device's entropy (a malformed one, say).
   * With `longerThan`, the result saved is at least that many bytes of
   * canonical JSON, its wager outcomes repeated: a stand-in for a session
   * thousands of turns long, which would take minutes to play.
   */
  playPracticeSession(options?: { readonly activityId?: string; readonly longerThan?: number }): Promise<CompletedPracticeSession>;
  /**
   * Starts a practice session (roulette, 1,000 buy-in) on the open account and
   * leaves it open, its controller wired to the account as the app wires it:
   * the controller hears the account session end, so sign-out suspends it,
   * and its access supervisor is behind the account gate. Its clock advances
   * by itself unless the scenario passes one it moves by hand.
   */
  startPracticeSession(options?: { readonly clock?: PracticeClock }): Promise<PracticeController>;
  /** The app process dies where it is: nothing it had in flight completes on the device. */
  kill(): void;
  /** Starts the app again after a kill (or kills it first), reopening the remembered account (or its signed-out lock). */
  restart(): Promise<void>;
  /** Stops the app and removes the device's files. */
  dispose(): void;
}

/** One run of the app on the device, from launch until it is killed. */
interface AppProcess {
  readonly account: AccountService;
  readonly vault: DeviceVault;
  readonly appVault: AppVault;
  /** Kills the process. Resolves once its database connection is closed: what it had queued ended, as a dead process's locks do. */
  kill(): Promise<void>;
}

let seed = 1;

export interface DeviceOptions {
  readonly name: string;
  /** The environment the device's build talks to; the stack's own by default. Its endpoint is always the stack. */
  readonly environment?: EnvironmentName;
  /**
   * A store-track update: this build is installed over another on the same
   * device, keeping its files and secure storage.
   */
  readonly installedOver?: SimulatedDevice;
  /** Whether the device's OS offers a platform age signal; false (an older OS) by default. */
  readonly platformAgeSignals?: boolean;
  /** The build's store migrations (a later build's, say); this build's by default. */
  readonly migrations?: readonly StoreMigration[];
  /** The device locale's currency; US dollars by default. */
  readonly localeCurrency?: string | null;
  /** The test identity provider standing in for Apple and Google on this device. */
  readonly identityProvider?: TestIdentityProvider;
  /**
   * Which platform's sign-in routes the device takes: on iOS Apple and Google
   * are native; on Android Google is native and Apple goes through the system
   * browser. iOS by default.
   */
  readonly platform?: 'ios' | 'android';
  /** The registered record types: this build's own and seam 2's test-only types by default. */
  readonly recordTypes?: ReadonlyMap<string, RecordType>;
  /** Where the device's operational metrics go; discarded by default. */
  readonly metrics?: MetricsSink;
  /** How the device describes itself on Devices: its platform and "<name> · iOS 18" by default. */
  readonly label?: string;
}

export function createDevice(stack: LocalStack, options: DeviceOptions): SimulatedDevice {
  const environment = options.environment ?? stack.environment;
  const entropy = new FakeEntropy(seed++);
  const proxy = new FaultProxy();
  const clock = new FakeClock();
  // The files, keychain and secure storage outlive the app process, and a build
  // installed over another keeps them. Installing ends the earlier build's process.
  options.installedOver?.kill();
  const earlier = options.installedOver ? installed.get(options.installedOver) : undefined;
  const credentials = earlier?.credentials ?? new MemoryCredentials();
  const storage = earlier?.storage ?? new TestDevice();
  const foreground = new Signal(true);
  const free: { bytes: number | null } = { bytes: null };
  const disk = { failing: false };
  const driver = nodeSqlCipherDriver({ fault: () => (disk.failing ? 'io' : undefined) });
  const ageSignals = new FakeAgeSignals(options.platformAgeSignals ?? false);
  const { identityProvider } = options;
  const providers =
    identityProvider?.devicePorts(options.platform === 'android' ? { apple: 'browser', google: 'native' } : { apple: 'native', google: 'native' }) ?? null;

  const launch = (): AppProcess => {
    let dead = false;
    const cancels: (() => void)[] = [];
    const appVault = storage.vault(environment, driver, options.migrations);
    let opening: AppVaultOpening | null = null;
    const removed: EnvironmentName[] = [];

    const vault: AccountVault = {
      async open(accountId) {
        opening = await appVault.open(accountId);
        return opening;
      },
      async close() {
        opening = null;
        await appVault.close();
      },
      async erase(accountId) {
        if (opening?.status === 'open' && opening.session.accountId === accountId) opening = null;
        await appVault.erase(accountId);
      },
      async removeEnvironment(other) {
        await appVault.removeEnvironment(other);
        removed.push(other);
      },
    };
    const erasedAppData: string[] = [];
    const deviceVault: DeviceVault = {
      get openAccount() {
        return opening?.status === 'open' ? opening.session.accountId : null;
      },
      close: () => vault.close(),
      holds: (other) => existsSync(`${storage.root}/${other}`),
      holdsAccount: (accountId) => {
        const directory = `${storage.root}/${environment}`;
        if (!existsSync(directory)) return false;
        return readdirSync(directory, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .some((entry) => readdirSync(`${directory}/${entry.name}`).some((file) => file.startsWith(`${accountId}.db`)));
      },
      erasedAppData,
      removed,
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
      after(milliseconds, run) {
        const stop = clock.after(milliseconds, () => !dead && run());
        cancels.push(stop);
        return stop;
      },
    };
    const account = createAccountService({
      backend: { name: environment, url: stack.url, publishableKey: stack.publishableKey },
      fetch: processFetch,
      credentials,
      vault,
      clock: clock.now,
      device: ports,
      randomBytes: (count) => entropy.bytes(count),
      localeCurrency: () => (options.localeCurrency === undefined ? 'USD' : options.localeCurrency),
      webSocket: ProcessWebSocket,
      ageSignals,
      ...(identityProvider && providers ? { providers: identityProvider.settings(providers) } : {}),
      recordTypes: options.recordTypes ?? testRecordTypes,
      ...(options.metrics ? { metrics: options.metrics } : {}),
      freeStorage: () => free.bytes,
      eraseAppData: async (accountId) => {
        erasedAppData.push(accountId);
      },
      deviceDescription: () => ({
        platform: options.platform ?? 'ios',
        label: options.label ?? `${options.name} · ${options.platform === 'android' ? 'Android 15' : 'iOS 18'}`,
      }),
    });
    return {
      account,
      vault: deviceVault,
      appVault,
      kill() {
        dead = true;
        cancels.splice(0).forEach((cancel) => cancel());
        sockets.forEach((socket) => socket.close());
        return appVault.close().catch(() => undefined);
      },
    };
  };

  let app = launch();

  /**
   * Starts a practice session on the open account; `activityId` names it
   * instead of the device's entropy, with `longerThan` its saved result is
   * lengthened to at least that many bytes, and `clock` replaces one that
   * advances by itself.
   */
  const startPractice = async ({
    activityId,
    longerThan,
    clock: practiceClock = new PracticeClock(undefined, true),
  }: { readonly activityId?: string; readonly longerThan?: number; readonly clock?: PracticeClock } = {}) => {
    const opening = openSession(app);
    const { account } = app;
    // Each practice session gets its own random ID, from the device's entropy.
    const base = substituteAdapters({ clock: practiceClock });
    // The access supervisor sits behind the account gate, as in the app; the controller hears the gate close.
    const adapters = { ...base, access: withAccountGate(base.access, () => account.gate), newId: () => activityId ?? `activity-${hex(entropy.bytes(16))}` };
    const controller = new PracticeController(
      forAccountSession(adapters, longerThan === undefined ? opening : { ...opening, store: lengthened(opening.store, longerThan) }),
    );
    followAccountGate(account, controller);
    await controller.load();
    await controller.start({ game: 'roulette', buyIn: '1000' });
    return controller;
  };

  const device: SimulatedDevice = {
    name: options.name,
    environment,
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
    ageSignals,
    providers,
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
    get freeStorage() {
      return free.bytes;
    },
    set freeStorage(value: number | null) {
      free.bytes = value;
    },
    async playPracticeSession(options = {}) {
      const controller = await startPractice(options);
      await controller.placeWager('red', '10');
      await controller.spin();
      await controller.endSession();
      const snapshot = controller.snapshot();
      if (snapshot.status !== 'completed') throw new Error(`the practice session did not complete (${snapshot.status})`);
      return snapshot.result;
    },
    async startPracticeSession({ clock } = {}) {
      const controller = await startPractice(clock ? { clock } : {});
      // As the app's practice provider does.
      app.account.onAccountSessionEnding(() => controller.accountSessionEnding());
      return controller;
    },
    kill() {
      void app.kill();
    },
    async restart() {
      // A killed process holds no lock: the relaunch opens the database once the dead one's connection is gone.
      await app.kill();
      app = launch();
      const { status } = await app.account.resume();
      if (status === 'no-account') throw new Error('the app did not reopen its account');
    },
    dispose() {
      void app.kill();
      storage.remove();
    },
  };
  installed.set(device, { storage, credentials });
  return device;
}

/** What a build installed over a device keeps: its files, keychain and secure storage. */
const installed = new WeakMap<SimulatedDevice, { readonly storage: TestDevice; readonly credentials: MemoryCredentials }>();

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

/** The store, except that the result it saves has its wager outcomes repeated until it is at least `bytes` long. */
function lengthened(store: SqliteActivityStore, bytes: number): SqliteActivityStore {
  const complete = (record: CompletedPracticeSession) => {
    const repeats = Math.ceil(bytes / Buffer.byteLength(canonicalJson(record.outcomes)));
    return store.complete({ ...record, outcomes: Array.from({ length: repeats }, () => record.outcomes).flat() });
  };
  return new Proxy(store, {
    get(target, key) {
      if (key === 'complete') return complete;
      const value: unknown = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

/** The access token a device's Auth session holds, from its credential storage: for calling the stack directly as it. */
export function accessToken(device: SimulatedDevice): string {
  for (const value of device.credentials.items.values()) {
    try {
      const token = (JSON.parse(value) as { access_token?: unknown }).access_token;
      if (typeof token === 'string') return token;
    } catch {
      // Not the session.
    }
  }
  throw new Error(`${device.name} holds no session`);
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
