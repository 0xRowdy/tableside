// Spec 2 Modules

import type { AgeRange, EligibilityBand, PlatformAgeSignals, UnresolvedReason } from '../eligibility';
import type { BackendEnvironment, EnvironmentName } from '../environment';
import type { AccountExport, UnfinishedActivities } from '../export';
import type { MetricsSink } from '../metrics';
import type { AccountPrivacy } from '../privacy';
import type { DetailResult, EngineStatus, HistoryDownload, HistoryStatus, UnconfirmedDecision } from '../sync/engine';
import type { AccountRecords } from '../sync/records';
import type { RecordType } from '../sync/registry';
import type { DevicePorts } from '../sync/session';
import type { SyncStore } from '../sync/store';

// Spec 2 Account gate
export type AccountGate =
  | { readonly state: 'no-account' }
  | { readonly state: 'active'; readonly accountId: string; readonly eligibility: EligibilityBand }
  | { readonly state: 'renewal-pending'; readonly accountId: string; readonly eligibility: EligibilityBand }
  | { readonly state: 'recovery-needed'; readonly accountId: string }
  | { readonly state: 'database-unavailable'; readonly accountId: string; readonly reason: 'needs-update' | 'migration-failed' }
  | { readonly state: 'signed-out'; readonly accountId: string }
  | { readonly state: 'revoked'; readonly accountId: string; readonly revokedAt: number; readonly by: RevokedBy }
  | { readonly state: 'age-unresolved'; readonly accountId: string; readonly reason: UnresolvedReason }
  | { readonly state: 'age-ineligible'; readonly accountId: string }
  // Spec 2 S2-23
  | { readonly state: 'deletion-scheduled'; readonly accountId: string; readonly deadline: number }
  | { readonly state: 'deleted' };

export type RevokedBy = 'device' | 'provider';

export type SignedInGate = Extract<AccountGate, { state: 'active' | 'renewal-pending' }>;

export const opensOrdinaryAccess = (gate: AccountGate): gate is SignedInGate =>
  gate.state === 'active' || gate.state === 'renewal-pending';

// Spec 2 Amendment 1 B2
export const opensRestrictedPaths = (
  gate: AccountGate,
): gate is Extract<AccountGate, { state: 'active' | 'renewal-pending' | 'age-unresolved' | 'age-ineligible' | 'deletion-scheduled' }> =>
  opensOrdinaryAccess(gate) || isRestricted(gate);

export function isRestricted(gate: AccountGate): gate is Extract<AccountGate, { state: 'age-unresolved' | 'age-ineligible' | 'deletion-scheduled' }> {
  return isAgeRestricted(gate) || gate.state === 'deletion-scheduled';
}

export type AccessPath = 'ordinary' | 'restricted';

export const isAgeRestricted = (gate: AccountGate): gate is Extract<AccountGate, { state: 'age-unresolved' | 'age-ineligible' }> =>
  gate.state === 'age-unresolved' || gate.state === 'age-ineligible';

export type SignOutResult =
  | { readonly status: 'signed-out'; readonly serverSessionEnded: boolean }
  | { readonly status: 'not-signed-in' };

export type SignInMethod = 'apple' | 'google' | 'email';

export interface AccountSummary {
  readonly email: string | null;
  readonly methods: readonly SignInMethod[];
  readonly currency: string;
  readonly currencyChangeable: boolean | null;
  readonly devices: number | null;
}

// Spec 2 S2-19
export interface DeviceEntry {
  readonly id: string;
  // #106
  readonly platform: 'ios' | 'android' | 'web' | null;
  readonly label: string | null;
  readonly lastActiveAt: number | null;
  readonly thisDevice: boolean;
}

export type DeviceSignOutResult =
  | { readonly status: 'signed-out'; readonly devices: number; readonly email: string | null }
  | { readonly status: 'fresh-authentication-required' }
  | { readonly status: 'not-found' }
  | { readonly status: 'failed' };

// Spec 2 S2-19
export interface Devices {
  list(): Promise<readonly DeviceEntry[] | null>;
  signOut(id: string): Promise<DeviceSignOutResult>;
  signOutOthers(): Promise<DeviceSignOutResult>;
}

export interface DeviceDescription {
  readonly platform: 'ios' | 'android';
  readonly label: string;
}

export type ScheduleDeletionResult =
  | { readonly status: 'scheduled'; readonly deadline: number }
  | NeedsFresh
  | { readonly status: 'offline' }
  | { readonly status: 'failed' };

export type CancelDeletionResult =
  | { readonly status: 'canceled' }
  | { readonly status: 'too-late' }
  | NeedsFresh
  | { readonly status: 'offline' }
  | { readonly status: 'failed' };

export type DeletionStatus =
  | { readonly status: 'none' }
  | { readonly status: 'scheduled'; readonly deadline: number; readonly scheduledAt: number }
  | DeletionProgress;

// #104
export interface DeletionProgress {
  readonly status: 'processing' | 'completed';
  readonly deletedAt: number;
  readonly cleanupBy: number;
  readonly completedAt: number | null;
  readonly delayed: boolean;
  readonly analytics: { readonly requestedAt: number | null; readonly completedAt: number | null };
  readonly providers: 'revoked' | 'not-held' | 'none' | null;
}

export type DeletePermanentlyResult =
  | { readonly status: 'deleted' }
  | NeedsFresh
  | { readonly status: 'offline' }
  | { readonly status: 'failed' };

// Spec 2 S2-22, S2-23
export interface AccountDeletion {
  schedule(): Promise<ScheduleDeletionResult>;
  cancel(): Promise<CancelDeletionResult>;
  // #104
  deletePermanently(): Promise<DeletePermanentlyResult>;
  status(): Promise<DeletionStatus | null>;
  dismiss(): Promise<void>;
}

export type CurrencyChangeResult = { readonly status: 'changed' } | { readonly status: 'locked' } | { readonly status: 'failed' };

export type CodeIntent = 'sign-in' | 'create';

export type AgeAnswerResult =
  | { readonly status: 'eligible' }
  | { readonly status: 'ineligible' }
  | { readonly status: 'unresolved' }
  | { readonly status: 'failed' };
export type AgeCheckResult = AgeAnswerResult | { readonly status: 'question' };
export type CodeRequestResult =
  | { readonly status: 'sent' }
  | { readonly status: 'rate-limited'; readonly retryAfterSeconds: number }
  | { readonly status: 'age-required' }
  | { readonly status: 'failed' };
export type CodeVerificationResult =
  | { readonly status: 'signed-in' }
  | { readonly status: 'invalid-code' }
  | { readonly status: 'failed' };
export type ReviewerSignInResult =
  | { readonly status: 'signed-in' }
  | { readonly status: 'refused' }
  | { readonly status: 'failed' };

export type IdentityProvider = 'apple' | 'google';

export type ProviderSignInResult =
  | { readonly status: 'signed-in' }
  | { readonly status: 'no-account' }
  | { readonly status: 'canceled' }
  | { readonly status: 'failed' };

export type ProviderCreateResult =
  | { readonly status: 'created' }
  | { readonly status: 'signed-in' }
  | { readonly status: 'age-required' }
  | { readonly status: 'canceled' }
  | { readonly status: 'failed' };

// Spec 2 S2-18
export interface SignInMethodEntry {
  readonly id: string;
  readonly method: SignInMethod;
  readonly email: string | null;
}

export type FreshAuthenticationResult =
  | { readonly status: 'confirmed' }
  | { readonly status: 'invalid-code' }
  | { readonly status: 'not-a-method' }
  | { readonly status: 'canceled' }
  | { readonly status: 'failed' };

export interface FreshAuthentication {
  methods(): Promise<readonly SignInMethodEntry[] | null>;
  withProvider(provider: IdentityProvider): Promise<FreshAuthenticationResult>;
  requestCode(): Promise<CodeRequestResult>;
  withCode(code: string): Promise<FreshAuthenticationResult>;
}

export type NeedsFresh = { readonly status: 'fresh-authentication-required' };

export type LinkResult =
  | { readonly status: 'linked' | 'already-linked' }
  | { readonly status: 'conflict' }
  | NeedsFresh
  | { readonly status: 'canceled' | 'failed' };

export type EmailMethodResult = { readonly status: 'linked' | 'already-linked' } | { readonly status: 'invalid-code' } | NeedsFresh | { readonly status: 'failed' };

export type RemoveMethodResult =
  | { readonly status: 'removed' }
  | { readonly status: 'last-method' }
  | { readonly status: 'confirm-with-another-method' }
  | NeedsFresh
  | { readonly status: 'failed' };

export type EmailChangeResult =
  | { readonly status: 'codes-sent' }
  | { readonly status: 'in-use' }
  | { readonly status: 'same-address' | 'invalid' }
  | NeedsFresh
  | { readonly status: 'failed' };

export type EmailChangeConfirmation =
  | { readonly status: 'changed' }
  | { readonly status: 'invalid-code'; readonly address: 'current' | 'new' }
  | { readonly status: 'failed' };

// Spec 2 S2-18
export interface SignInMethods {
  list(): Promise<readonly SignInMethodEntry[] | null>;
  link(provider: IdentityProvider): Promise<LinkResult>;
  requestEmailMethodCode(): Promise<CodeRequestResult | NeedsFresh>;
  confirmEmailMethod(code: string): Promise<EmailMethodResult>;
  remove(id: string): Promise<RemoveMethodResult>;
  changeEmail(email: string): Promise<EmailChangeResult>;
  confirmEmailChange(codes: { readonly currentCode: string; readonly newCode: string }): Promise<EmailChangeConfirmation>;
}

export type ProviderToken =
  | { readonly status: 'token'; readonly idToken: string; readonly authorizationCode?: string }
  | { readonly status: 'canceled' }
  | { readonly status: 'failed' };

export type AuthSessionResult = { readonly status: 'returned'; readonly url: string } | { readonly status: 'canceled' };

export interface ProviderPorts {
  readonly route: Readonly<Record<IdentityProvider, 'native' | 'browser' | 'unavailable'>>;
  nativeIdToken(provider: IdentityProvider, request: { readonly hashedNonce: string }): Promise<ProviderToken>;
  openAuthSession(url: string, callbackUrl: string): Promise<AuthSessionResult>;
  sha256Hex(text: string): Promise<string>;
}

export interface ProviderSettings {
  readonly ports: ProviderPorts;
  readonly authName?: Partial<Record<IdentityProvider, string>>;
  readonly appleWeb?: { readonly authorizeUrl: string; readonly clientId: string };
}

export interface CredentialStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

// #85
export interface AccountVault {
  open(accountId: string): Promise<AccountVaultOpening>;
  close(): Promise<void>;
  erase(accountId: string): Promise<void>;
  removeEnvironment(environment: EnvironmentName): Promise<void>;
  recover(accountId: string): Promise<void>;
}

export interface VaultSession {
  readonly installationId: string;
  readonly store: SyncStore & UnfinishedActivities;
}

export type AccountVaultOpening =
  | { readonly status: 'open'; readonly session: VaultSession }
  | { readonly status: 'recovery-needed' | 'needs-update' | 'migration-failed' | 'superseded' };

export type { DetailResult, HistoryDownload, HistoryStatus };

export const NO_SYNC: SyncStatus = {
  live: false,
  error: null,
  lastSyncedAt: null,
  uploads: [],
  update: null,
  history: { state: 'complete' },
  download: { state: 'not-requested' },
};

// Spec 2 S2-20
export interface SyncStatus extends EngineStatus {
  readonly live: boolean;
}

// Spec 2 Record-type registry
export type QueueResult =
  | { readonly status: 'queued'; readonly id: string; readonly position?: number }
  | { readonly status: 'refused'; readonly reason: 'no-account' | 'unknown-type' | 'server-authored' | 'online-only' | 'invalid-payload' };

export interface AccountSync {
  readonly status: SyncStatus;
  queue(recordType: string, payload: unknown): Promise<QueueResult>;
  subscribe(listener: (status: SyncStatus) => void): () => void;
  reconcile(): Promise<void>;
  retryRecord(id: string): Promise<void>;
  // Spec 2 Compaction and stale devices
  decideUnconfirmed(id: string, decision: UnconfirmedDecision): Promise<void>;
  // Spec 2 History
  downloadAllHistory(): Promise<void>;
  idle(): Promise<void>;
  countWaiting(): Promise<number>;
}

export interface AccountServiceOptions {
  readonly backend: BackendEnvironment;
  readonly fetch: typeof fetch;
  readonly credentials: CredentialStorage;
  readonly vault: AccountVault;
  readonly clock: () => number;
  readonly device: DevicePorts;
  readonly randomBytes: (count: number) => Uint8Array;
  readonly localeCurrency: () => string | null;
  readonly webSocket?: typeof WebSocket;
  readonly providers?: ProviderSettings;
  readonly recordTypes?: ReadonlyMap<string, RecordType>;
  readonly ageSignals?: PlatformAgeSignals;
  // Spec 7
  readonly metrics?: MetricsSink;
  readonly freeStorage?: () => number | null;
  readonly deviceDescription: () => DeviceDescription;
  readonly eraseAppData?: (accountId: string) => Promise<void>;
}

export interface AccountService {
  readonly gate: AccountGate;
  subscribe(listener: (gate: AccountGate) => void): () => void;
  readonly platformAgeCheck: boolean;
  checkAge(): Promise<AgeCheckResult>;
  answerAgeQuestion(range: AgeRange): Promise<AgeAnswerResult>;
  refreshEligibility(): Promise<void>;
  requestEmailCode(request: { readonly email: string; readonly intent: CodeIntent }): Promise<CodeRequestResult>;
  verifyEmailCode(request: { readonly email: string; readonly code: string }): Promise<CodeVerificationResult>;
  signInAsReviewer(request: { readonly email: string; readonly credential: string }): Promise<ReviewerSignInResult>;
  signInWithProvider(provider: IdentityProvider): Promise<ProviderSignInResult>;
  createWithProvider(provider: IdentityProvider, options?: { readonly sameIdentity?: boolean }): Promise<ProviderCreateResult>;
  resume(): Promise<{ readonly status: 'resumed' | 'signed-out' | 'deleted' | 'no-account' }>;
  renew(): Promise<void>;
  recover(): Promise<{ readonly status: 'sign-in-needed' | 'failed' }>;
  signOut(): Promise<SignOutResult>;
  onAccountSessionEnding(handler: () => Promise<void>): () => void;
  accountSummary(): Promise<AccountSummary | null>;
  setAccountCurrency(currency: string): Promise<CurrencyChangeResult>;
  readonly sync: AccountSync;
  readonly records: AccountRecords;
  // #105
  readonly privacy: AccountPrivacy;
  readonly freshAuthentication: FreshAuthentication;
  readonly signInMethods: SignInMethods;
  readonly devices: Devices;
  readonly export: AccountExport;
  // #103, #104
  readonly deletion: AccountDeletion;
}

