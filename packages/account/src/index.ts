export {
  type AccountGate,
  type AccountService,
  type AccountServiceOptions,
  type AccountSync,
  type AccountVault,
  type AgeAnswerResult,
  type AgeRange,
  type CodeRequestResult,
  type CodeVerificationResult,
  type CredentialStorage,
  type EligibilityBand,
  type SyncStatus,
  type VaultOpening,
  type VaultSession,
  createAccountService,
} from './service';
export { type SyncErrorCode } from './sync/engine';
export { type LiveChannel } from './sync/live';
export { PROTOCOL_VERSION, type Disposition, type Envelope, type FeedEntry, type PreparedOperation } from './sync/protocol';
export { type RecordKind, type RecordType, completedPracticeSession, recordTypes } from './sync/registry';
export { type DevicePorts, type DeviceSignal, RECONCILE_INTERVAL_MS } from './sync/session';
export { type AcceptedRecord, type QueuedUpload, type SyncStore } from './sync/store';
