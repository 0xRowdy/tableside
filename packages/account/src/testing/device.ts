import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

import { canonicalJson } from '@tableside/engine';

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

  every(milliseconds: number, run: () => void): () => void {
    const timer = { period: milliseconds, next: this.time + milliseconds, run };
    this.timers.add(timer);
    return () => this.timers.delete(timer);
  }

  after(milliseconds: number, run: () => void): () => void {
    const cancel = this.every(Math.max(1, milliseconds), () => {
      cancel();
      run();
    });
    return cancel;
  }
}

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

export class MemoryCredentials implements CredentialStorage {
  readonly items = new Map<string, string>();
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

export class FakeAgeSignals implements PlatformAgeSignals {
  signal: AgeSignal = { kind: 'unavailable' };
  readonly checks: ('interactive' | 'silent')[] = [];
  constructor(public supported = false) {}
  async check({ interactive }: { readonly interactive: boolean }): Promise<AgeSignal> {
    this.checks.push(interactive ? 'interactive' : 'silent');
    return this.signal;
  }
}

export interface DeviceVault {
  readonly openAccount: string | null;
  close(): Promise<void>;
  holds(environment: EnvironmentName): boolean;
  holdsAccount(accountId: string): boolean;
  readonly erasedAppData: readonly string[];
  readonly removed: readonly EnvironmentName[];
  store(): SqliteActivityStore;
  loseKey(accountId: string): void;
  accountFiles(accountId: string): Record<string, string>;
}

export interface SimulatedDevice {
  readonly name: string;
  readonly environment: EnvironmentName;
  readonly account: AccountService;
  readonly vault: DeviceVault;
  readonly proxy: FaultProxy;
  readonly clock: FakeClock;
  readonly entropy: FakeEntropy;
  readonly credentials: MemoryCredentials;
  readonly mailbox: Mailbox;
  readonly ageSignals: FakeAgeSignals;
  readonly providers: TestProviderPorts | null;
  foreground: boolean;
  diskFailing: boolean;
  freeStorage: number | null;
  playPracticeSession(options?: { readonly activityId?: string; readonly longerThan?: number }): Promise<CompletedPracticeSession>;
  startPracticeSession(options?: { readonly clock?: PracticeClock }): Promise<PracticeController>;
  kill(): void;
  restart(): Promise<void>;
  dispose(): void;
}

interface AppProcess {
  readonly account: AccountService;
  readonly vault: DeviceVault;
  readonly appVault: AppVault;
  kill(): Promise<void>;
}

let seed = 1;

export interface DeviceOptions {
  readonly name: string;
  readonly environment?: EnvironmentName;
  readonly installedOver?: SimulatedDevice;
  readonly platformAgeSignals?: boolean;
  readonly migrations?: readonly StoreMigration[];
  readonly localeCurrency?: string | null;
  readonly identityProvider?: TestIdentityProvider;
  readonly platform?: 'ios' | 'android';
  readonly recordTypes?: ReadonlyMap<string, RecordType>;
  readonly metrics?: MetricsSink;
  readonly label?: string;
}

export function createDevice(stack: LocalStack, options: DeviceOptions): SimulatedDevice {
  const environment = options.environment ?? stack.environment;
  const entropy = new FakeEntropy(seed++);
  const proxy = new FaultProxy();
  const clock = new FakeClock();
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
      async recover(accountId) {
        if (opening?.status === 'open' && opening.session.accountId === accountId) opening = null;
        await appVault.recover(accountId);
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
      loseKey: (accountId) => {
        for (const [name] of storage.keychain.entries()) if (name.endsWith(`.${accountId}.key`)) storage.keychain.forget(name);
      },
      accountFiles: (accountId) => {
        const directory = `${storage.root}/${environment}`;
        const files: Record<string, string> = {};
        if (!existsSync(directory)) return files;
        for (const installation of readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
          for (const file of readdirSync(`${directory}/${installation.name}`).filter((name) => name.startsWith(`${accountId}.db`))) {
            const path = `${directory}/${installation.name}/${file}`;
            files[path] = createHash('sha256').update(readFileSync(path)).digest('hex');
          }
        }
        return files;
      },
      store() {
        if (opening?.status !== 'open') throw new Error('no account database is open');
        return opening.session.store;
      },
    };
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
    const notRunning = () => Promise.reject(new Error('the app is not running'));
    const processCredentials: CredentialStorage = {
      getItem: (key) => (dead ? notRunning() : credentials.getItem(key)),
      setItem: (key, value) => (dead ? notRunning() : credentials.setItem(key, value)),
      removeItem: (key) => (dead ? notRunning() : credentials.removeItem(key)),
    };
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
      credentials: processCredentials,
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

  const startPractice = async ({
    activityId,
    longerThan,
    clock: practiceClock = new PracticeClock(undefined, true),
  }: { readonly activityId?: string; readonly longerThan?: number; readonly clock?: PracticeClock } = {}) => {
    const opening = openSession(app);
    const { account } = app;
    const base = substituteAdapters({ clock: practiceClock });
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
      app.account.onAccountSessionEnding(() => controller.accountSessionEnding());
      return controller;
    },
    kill() {
      void app.kill();
    },
    async restart() {
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

const installed = new WeakMap<SimulatedDevice, { readonly storage: TestDevice; readonly credentials: MemoryCredentials }>();

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

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

export function accessToken(device: SimulatedDevice): string {
  for (const value of device.credentials.items.values()) {
    try {
      const token = (JSON.parse(value) as { access_token?: unknown }).access_token;
      if (typeof token === 'string') return token;
    } catch {
    }
  }
  throw new Error(`${device.name} holds no session`);
}

function openSession(app: AppProcess) {
  const store = app.vault.store();
  const { identity } = store;
  return { ...identity, generation: app.appVault.generation, store };
}

export function uniqueEmail(label: string): string {
  return `${label}-${randomUUID().slice(0, 8)}@example.com`;
}

export async function createAccountByEmail(
  device: SimulatedDevice,
  email: string,
  band: EligibilityBand = '18+',
): Promise<CodeVerificationResult> {
  if ((await device.account.answerAgeQuestion(band)).status !== 'eligible') return { status: 'failed' };
  if ((await device.account.requestEmailCode({ email, intent: 'create' })).status !== 'sent') return { status: 'failed' };
  return device.account.verifyEmailCode({ email, code: await device.mailbox.latestCode(email) });
}

export async function signInByEmail(device: SimulatedDevice, email: string): Promise<CodeVerificationResult> {
  const previous = (await device.mailbox.messages(email)).length > 0 ? await device.mailbox.latestCode(email) : undefined;
  if ((await device.account.requestEmailCode({ email, intent: 'sign-in' })).status !== 'sent') return { status: 'failed' };
  return device.account.verifyEmailCode({ email, code: await device.mailbox.latestCode(email, previous ? { after: previous } : {}) });
}
