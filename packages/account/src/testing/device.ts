// A simulated device for seam 2 scenarios: an Account service with its own
// store, credentials, installation, entropy, clock and connectivity, talking
// to the local stack only through its fault-injection proxy.

import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { EnvironmentName } from '../environment';
import {
  type AccountService,
  type CodeVerificationResult,
  type CredentialStorage,
  type EligibilityBand,
  createAccountService,
} from '../service';
import { FaultProxy } from './fault-proxy';
import { Mailbox } from './mailbox';
import type { LocalStack } from './stack';
import { NodeSqliteVault } from './vault';

/** A clock the scenario moves by hand. */
export class FakeClock {
  constructor(private time: number = Date.now()) {}
  readonly now = (): number => this.time;
  advance(milliseconds: number): void {
    this.time += milliseconds;
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

export interface SimulatedDevice {
  readonly name: string;
  /** The backend environment the device's build talks to. */
  readonly environment: EnvironmentName;
  /** Where the device keeps its files; a build installed over this one keeps them. */
  readonly directory: string;
  readonly installationId: string;
  readonly account: AccountService;
  readonly proxy: FaultProxy;
  readonly clock: FakeClock;
  readonly entropy: FakeEntropy;
  readonly credentials: MemoryCredentials;
  readonly vault: NodeSqliteVault;
  readonly mailbox: Mailbox;
  /**
   * The app quit and opened again: a new Account service (and vault) over the
   * same credentials, files, clock and network, restored from this device.
   */
  relaunch(): Promise<SimulatedDevice>;
  /** Closes the store and removes the device's files. */
  dispose(): void;
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
}

export function createDevice(stack: LocalStack, options: DeviceOptions): SimulatedDevice {
  const entropy = new FakeEntropy(seed++);
  const installationId = Buffer.from(entropy.bytes(16)).toString('hex');
  return launch(stack, {
    name: options.name,
    environment: options.environment ?? stack.environment,
    installationId,
    directory: options.installedOver?.directory ?? mkdtempSync(path.join(tmpdir(), `tableside-${options.name}-`)),
    entropy,
    proxy: new FaultProxy(),
    clock: new FakeClock(),
    credentials: options.installedOver?.credentials ?? new MemoryCredentials(),
    mailbox: new Mailbox(stack.mailUrl),
  });
}

/** What a device keeps from one launch of the app to the next. */
interface DeviceParts {
  readonly name: string;
  readonly environment: EnvironmentName;
  readonly installationId: string;
  readonly directory: string;
  readonly entropy: FakeEntropy;
  readonly proxy: FaultProxy;
  readonly clock: FakeClock;
  readonly credentials: MemoryCredentials;
  readonly mailbox: Mailbox;
}

function launch(stack: LocalStack, parts: DeviceParts): SimulatedDevice {
  const vault = new NodeSqliteVault(parts.directory, parts.environment, parts.installationId);
  const account = createAccountService({
    backend: { name: parts.environment, url: stack.url, publishableKey: stack.publishableKey },
    fetch: parts.proxy.fetch,
    credentials: parts.credentials,
    vault,
    clock: parts.clock.now,
  });
  return {
    ...parts,
    account,
    vault,
    async relaunch() {
      await vault.close();
      const next = launch(stack, parts);
      await next.account.restore();
      return next;
    },
    dispose() {
      void vault.close();
      rmSync(parts.directory, { recursive: true, force: true });
    },
  };
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
