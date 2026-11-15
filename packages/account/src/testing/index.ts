// Seam 2's multi-device scenario harness (spec 2, *Testing Decisions*),
// reused by later spec 2 tickets and specs 3–6. Node only.

export {
  type DeviceVault,
  type SimulatedDevice,
  FakeClock,
  FakeEntropy,
  MemoryCredentials,
  accessTokenOf,
  createAccountByEmail,
  createDevice,
  signInByEmail,
  uniqueEmail,
} from './device';
export { FaultProxy, type HeldResponse } from './fault-proxy';
export { TestIdentityProvider } from './identity-provider';
export { Mailbox } from './mailbox';
export { type LocalStack, localStack } from './stack';
export {
  TEST_RECORD_TYPES,
  type TestAttempt,
  type TestContribution,
  type TestExperimentAssignment,
  type TestReconciliation,
  type TestResult,
  type TestResultPurge,
  type TestTransfer,
  type TestSharingWithdrawal,
  installTestRecordTypes,
  testAllowanceReconciliation,
  testAllowanceTransfer,
  testAttempt,
  testContribution,
  testExperimentAssignment,
  testRegistry,
  testResult,
  testResultPurge,
  testSharingWithdrawal,
} from './record-types';
