// A simulated device for seam 2 scenarios: an Account service with its own
// store, credentials, installation, entropy, clock and connectivity, talking
// to the local stack only through its fault-injection proxy.

import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { type AccountService, type CredentialStorage, createAccountService } from '../service';
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

export interface SimulatedDevice {
  readonly name: string;
  readonly installationId: string;
  readonly account: AccountService;
  readonly proxy: FaultProxy;
  readonly clock: FakeClock;
  readonly entropy: FakeEntropy;
  readonly credentials: MemoryCredentials;
  readonly vault: NodeSqliteVault;
  readonly mailbox: Mailbox;
  /** Closes the store and removes the device's files. */
  dispose(): void;
}

let seed = 1;

export function createDevice(stack: LocalStack, options: { readonly name: string }): SimulatedDevice {
  const entropy = new FakeEntropy(seed++);
  const installationId = Buffer.from(entropy.bytes(16)).toString('hex');
  const directory = mkdtempSync(path.join(tmpdir(), `tableside-${options.name}-`));
  const proxy = new FaultProxy();
  const clock = new FakeClock();
  const credentials = new MemoryCredentials();
  const vault = new NodeSqliteVault(directory, installationId);
  const account = createAccountService({
    backend: { url: stack.url, publishableKey: stack.publishableKey },
    fetch: proxy.fetch,
    credentials,
    vault,
    clock: clock.now,
  });
  return {
    name: options.name,
    installationId,
    account,
    proxy,
    clock,
    entropy,
    credentials,
    vault,
    mailbox: new Mailbox(stack.mailUrl),
    dispose() {
      void vault.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

/** An address no earlier run has used. */
export function uniqueEmail(label: string): string {
  return `${label}-${randomUUID().slice(0, 8)}@example.com`;
}
