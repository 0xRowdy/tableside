// Seam 2's multi-device scenario harness (spec 2, *Testing Decisions*),
// reused by later spec 2 tickets and specs 3–6. Node only.

export { type SimulatedDevice, FakeClock, FakeEntropy, MemoryCredentials, createDevice, uniqueEmail } from './device';
export { FaultProxy, type HeldResponse } from './fault-proxy';
export { TestIdentityProvider } from './identity-provider';
export { Mailbox } from './mailbox';
export { type LocalStack, localStack } from './stack';
export { NodeSqliteVault } from './vault';
