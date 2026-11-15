export {
  type BackendEnvironment,
  ENVIRONMENT_HEADER,
  ENVIRONMENT_NAMES,
  type EnvironmentName,
  authCallbackUrl,
  backendEnvironment,
  retiredEnvironments,
} from './environment';
export {
  type AgeRange,
  type AgeSignal,
  type EligibilityBand,
  type EligibilityRecord,
  type EligibilitySource,
  type EligibilityStatus,
  type PlatformAgeSignals,
  type UnresolvedReason,
  declarationPermitted,
  noPlatformAgeSignals,
} from './eligibility';
export {
  type AccountGate,
  type AccountService,
  type AccountServiceOptions,
  type AccountSync,
  type AccountVault,
  type AgeAnswerResult,
  type AgeCheckResult,
  type CodeIntent,
  type CodeRequestResult,
  type CodeVerificationResult,
  type CredentialStorage,
  type SyncStatus,
  type VaultOpening,
  type VaultSession,
  createAccountService,
  opensOrdinaryAccess,
} from './service';
export { type MetricPurpose, metricPermitted } from './metrics';
export { type SyncErrorCode } from './sync/engine';
export { type LiveChannel } from './sync/live';
export {
  CHUNK_BYTES,
  PROTOCOL_VERSION,
  REQUEST_LIMIT_BYTES,
  type ContentManifest,
  type Disposition,
  type Envelope,
  type FeedEntry,
  type PreparedOperation,
  type StagedChunk,
} from './sync/protocol';
export { PLATFORM_TABLES, type RecordKind, type RecordType, completedPracticeSession, recordTypes } from './sync/registry';
export { type DevicePorts, type DeviceSignal, RECONCILE_INTERVAL_MS } from './sync/session';
export { type AcceptedRecord, type QueuedUpload, type SyncStore } from './sync/store';
