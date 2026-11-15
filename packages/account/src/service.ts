// The Account service: the one interface the app uses for anything
// account-shaped (spec 2, *Modules*). It exposes the observable account gate
// and hides Supabase, the network and storage from its callers.

import { type SupabaseClient, createClient } from '@supabase/supabase-js';

import {
  type AgeRange,
  type AgeSignal,
  ELIGIBILITY_REFRESH_MS,
  type EligibilityBand,
  type EligibilityRecord,
  type EligibilitySource,
  type PlatformAgeSignals,
  type RequiredCheck,
  type UnresolvedReason,
  declarationPermitted,
  isEligibleBand,
  isRequiredCheck,
  noPlatformAgeSignals,
  parseEligibilityRecord,
  requiredCheck,
} from './eligibility';
import { type BackendEnvironment, ENVIRONMENT_HEADER, type EnvironmentName, authCallbackUrl, retiredEnvironments } from './environment';
import { type AccountExport, type UnfinishedActivities, accountExport } from './export';
import { type MetricsSink, createMetricsSender, discardMetrics } from './metrics';
import { type AccountPrivacy, accountPrivacy } from './privacy';
import { type DetailResult, type EngineStatus, type HistoryDownload, type HistoryStatus, SyncEngine } from './sync/engine';
import { type AccountRecords, accountRecords } from './sync/records';
import { type RecordType, prerequisitesOf, recordTypes } from './sync/registry';
import { type DevicePorts, SyncSession } from './sync/session';
import type { SyncStore } from './sync/store';
import { RetryAfterWatch, supabaseLiveChannels, supabaseSyncBackend } from './sync/supabase';

/** The account's access state on this installation (spec 2, *Account gate*). Later tickets add the other states. */
export type AccountGate =
  | { readonly state: 'no-account' }
  | { readonly state: 'active'; readonly accountId: string; readonly eligibility: EligibilityBand }
  /** The token expired and hasn't renewed yet: access and records stay, under cached rights. */
  | { readonly state: 'renewal-pending'; readonly accountId: string; readonly eligibility: EligibilityBand }
  /** The account's key or database is lost or unreadable on this installation; nothing was opened or replaced. */
  | { readonly state: 'recovery-needed'; readonly accountId: string }
  /**
   * The account's database is intact but this build can't open it yet: it has
   * a later build's schema (needs-update), or bringing it to this build's
   * schema failed and the next launch tries again (migration-failed).
   */
  | { readonly state: 'database-unavailable'; readonly accountId: string; readonly reason: 'needs-update' | 'migration-failed' }
  /**
   * The player signed out of this installation. The account's database is
   * closed and kept with its key; only an online sign-in to the same account
   * opens it again.
   */
  | { readonly state: 'signed-out'; readonly accountId: string }
  /**
   * The server confirmed this installation's session was revoked (signed out
   * from another device, or by Apple or Google withdrawing a sign-in method):
   * closed and kept with its key like Signed out, until a fresh sign-in to the
   * same account. `revokedAt` is when, in milliseconds since the epoch.
   */
  | { readonly state: 'revoked'; readonly accountId: string; readonly revokedAt: number; readonly by: RevokedBy }
  /**
   * The account's age eligibility isn't established on this installation:
   * ordinary access is closed and only the restricted paths stay (deletion,
   * Contact support, Make a privacy request, billing help, authenticated
   * export). The database stays open for them. Retrying may resolve it.
   */
  | { readonly state: 'age-unresolved'; readonly accountId: string; readonly reason: UnresolvedReason }
  /** The account is established as under 13: ordinary access is closed, with only the restricted paths. */
  | { readonly state: 'age-ineligible'; readonly accountId: string };

/** Who revoked a session: another of the account's devices, or the provider of a sign-in method. */
export type RevokedBy = 'device' | 'provider';

/** Gate states that leave ordinary access open: Renewal pending keeps it, under cached rights, while the token renews. */
export const opensOrdinaryAccess = (gate: AccountGate): gate is Extract<AccountGate, { state: 'active' | 'renewal-pending' }> =>
  gate.state === 'active' || gate.state === 'renewal-pending';

/**
 * Gate states the restricted paths work in (fresh authentication, export;
 * deletion, support and billing help): ordinary access, or an account whose
 * age eligibility isn't established. The one client seam for who reaches
 * them: #103 adds Deletion scheduled (Amendment 1 B2).
 */
export const opensRestrictedPaths = (gate: AccountGate): gate is Extract<AccountGate, { state: 'active' | 'renewal-pending' | 'age-unresolved' | 'age-ineligible' }> =>
  opensOrdinaryAccess(gate) || isAgeRestricted(gate);

/** Which gate states a call needs: ordinary access, or the restricted paths (opensRestrictedPaths). */
type AccessPath = 'ordinary' | 'restricted';

/** Gate states whose age eligibility isn't established: the account is open for its restricted paths only. */
export const isAgeRestricted = (gate: AccountGate): gate is Extract<AccountGate, { state: 'age-unresolved' | 'age-ineligible' }> =>
  gate.state === 'age-unresolved' || gate.state === 'age-ineligible';

/** Signed out locally; `serverSessionEnded` is true only when the server confirmed this session ended. */
export type SignOutResult =
  | { readonly status: 'signed-out'; readonly serverSessionEnded: boolean }
  /** No account was signed in on this installation, so nothing changed. */
  | { readonly status: 'not-signed-in' };

export type SignInMethod = 'apple' | 'google' | 'email';

/** What Settings → Account shows. Parts only the server knows are null while it can't be reached. */
export interface AccountSummary {
  /** The sign-in email: private to the player, never shown to anyone else. */
  readonly email: string | null;
  readonly methods: readonly SignInMethod[];
  /** The account's real-money currency for casino records (ISO 4217). */
  readonly currency: string;
  /** False while any casino session exists, since amounts are never converted. */
  readonly currencyChangeable: boolean | null;
  /** Signed-in devices, this one included, as Devices lists them. */
  readonly devices: number | null;
}

/**
 * A device signed in to the account (S2-19): a registered installation with a
 * live session, or a session that never registered (platform and label
 * null). Platform and label are what the device said about itself: they
 * describe a sign-in, never which physical device it is.
 */
export interface DeviceEntry {
  readonly id: string;
  readonly platform: 'ios' | 'android' | null;
  readonly label: string | null;
  /** Its latest sign-in, token renewal or status check, in milliseconds since the epoch. */
  readonly lastActiveAt: number | null;
  readonly thisDevice: boolean;
}

export type DeviceSignOutResult =
  /** `devices` other devices were signed out; the security email went to `email`. */
  | { readonly status: 'signed-out'; readonly devices: number; readonly email: string | null }
  | { readonly status: 'fresh-authentication-required' }
  /** It isn't signed in any more (signed out meanwhile, say). */
  | { readonly status: 'not-found' }
  | { readonly status: 'failed' };

/**
 * Devices (S2-19). Signing a device out revokes every session it has, and
 * signing out all others keeps only this session; both need Confirm it's you
 * first, and send the account a security email. A signed-out device locks
 * the next time it reaches the server, keeping its records.
 */
export interface Devices {
  /** This device first. Null when no account is signed in, or the server can't be reached. */
  list(): Promise<readonly DeviceEntry[] | null>;
  /** Another device; this one signs out with Sign out instead. */
  signOut(id: string): Promise<DeviceSignOutResult>;
  signOutOthers(): Promise<DeviceSignOutResult>;
}

/** What this device says about itself on Devices: its platform, and a label such as "iPhone 15 · iOS 18". */
export interface DeviceDescription {
  readonly platform: 'ios' | 'android';
  readonly label: string;
}

export type CurrencyChangeResult = { readonly status: 'changed' } | { readonly status: 'locked' } | { readonly status: 'failed' };


/** Which way a player asks for a code: Sign in (an existing account) or Create (a new one). */
export type CodeIntent = 'sign-in' | 'create';

/**
 * eligible: an established 13+ band (on the Create path, an assertion is held for creating the account).
 * ineligible: under 13. unresolved: a required platform check stands in the way, so the answer can't decide.
 */
export type AgeAnswerResult =
  | { readonly status: 'eligible' }
  | { readonly status: 'ineligible' }
  | { readonly status: 'unresolved' }
  | { readonly status: 'failed' };
/** A platform age check's outcome; "question" means the platform proved nothing and the fallback question may decide. */
export type AgeCheckResult = AgeAnswerResult | { readonly status: 'question' };
export type CodeRequestResult =
  | { readonly status: 'sent' }
  /** Too many code requests for this address or network: wait this long before asking again. */
  | { readonly status: 'rate-limited'; readonly retryAfterSeconds: number }
  | { readonly status: 'age-required' }
  | { readonly status: 'failed' };
export type CodeVerificationResult =
  | { readonly status: 'signed-in' }
  | { readonly status: 'invalid-code' }
  | { readonly status: 'failed' };
export type ReviewerSignInResult =
  | { readonly status: 'signed-in' }
  /** Not this address's reviewer account and current reviewer credential (the same for any address). */
  | { readonly status: 'refused' }
  | { readonly status: 'failed' };

/** The identity providers a player can sign in or create an account with. */
export type IdentityProvider = 'apple' | 'google';

export type ProviderSignInResult =
  | { readonly status: 'signed-in' }
  /** The identity has no account, and none was created: offer Create, which asks for age first. */
  | { readonly status: 'no-account' }
  /** The player closed the provider's sheet or page. */
  | { readonly status: 'cancelled' }
  | { readonly status: 'failed' };

export type ProviderCreateResult =
  /** A new, empty account for this identity. */
  | { readonly status: 'created' }
  /** The identity already had an account (Auth returned it), so this signed in to it; nothing was created. */
  | { readonly status: 'signed-in' }
  /** No current age answer: run the age step first. */
  | { readonly status: 'age-required' }
  | { readonly status: 'cancelled' }
  | { readonly status: 'failed' };

/** One way to sign in to the account (S2-18), with the address it goes by: a provider's (an Apple relay address, say), or the email code's. */
export interface SignInMethodEntry {
  readonly id: string;
  readonly method: SignInMethod;
  readonly email: string | null;
}

export type FreshAuthenticationResult =
  | { readonly status: 'confirmed' }
  | { readonly status: 'invalid-code' }
  /** The player signed in to the provider, but as someone who isn't one of this account's methods. */
  | { readonly status: 'not-a-method' }
  | { readonly status: 'cancelled' }
  | { readonly status: 'failed' };

/**
 * Confirm it's you: the player signs in again with one of the account's own
 * methods, and for the next few minutes this session may change the account
 * (method changes, email change, revoking other devices, server export,
 * deletion). Being signed in already never counts, nor does a token refresh;
 * the server checks it for this session on every operation it gates.
 */
export interface FreshAuthentication {
  /** The methods the player may confirm with, on the restricted paths too. Null when no account is signed in, or offline. */
  methods(): Promise<readonly SignInMethodEntry[] | null>;
  /** With Apple or Google: one of the account's own identities. */
  withProvider(provider: IdentityProvider): Promise<FreshAuthenticationResult>;
  /** Emails a code to the email method's address, under the code-request limits. */
  requestCode(): Promise<CodeRequestResult>;
  withCode(code: string): Promise<FreshAuthenticationResult>;
}

/** Changes that need Confirm it's you first answer this until it's done (or after its few minutes have passed). */
type NeedsFresh = { readonly status: 'fresh-authentication-required' };

export type LinkResult =
  | { readonly status: 'linked' | 'already-linked' }
  /** Another account signs in with this identity: nothing changed, and accounts are never merged. */
  | { readonly status: 'conflict' }
  | NeedsFresh
  | { readonly status: 'cancelled' | 'failed' };

export type EmailMethodResult = { readonly status: 'linked' | 'already-linked' } | { readonly status: 'invalid-code' } | NeedsFresh | { readonly status: 'failed' };

export type RemoveMethodResult =
  | { readonly status: 'removed' }
  /** The account's only method: add another first. */
  | { readonly status: 'last-method' }
  /** This session confirmed with the method being removed: confirm with one that stays. */
  | { readonly status: 'confirm-with-another-method' }
  | NeedsFresh
  | { readonly status: 'failed' };

export type EmailChangeResult =
  /** A code went to the current address and one to the new. */
  | { readonly status: 'codes-sent' }
  /** Another account uses the new address. */
  | { readonly status: 'in-use' }
  | { readonly status: 'same-address' | 'invalid' }
  | NeedsFresh
  | { readonly status: 'failed' };

export type EmailChangeConfirmation =
  | { readonly status: 'changed' }
  | { readonly status: 'invalid-code'; readonly address: 'current' | 'new' }
  | { readonly status: 'failed' };

/** Sign-in methods (S2-18): every change needs Confirm it's you first, and the account always keeps a method. */
export interface SignInMethods {
  /** Null when no account is signed in, or the server can't be reached. */
  list(): Promise<readonly SignInMethodEntry[] | null>;
  /** Adds Apple or Google: the provider's sheet proves the identity. The account gets a security email. */
  link(provider: IdentityProvider): Promise<LinkResult>;
  /** Adding the email code, for the account's own sign-in email: emails it a code. */
  requestEmailMethodCode(): Promise<CodeRequestResult | NeedsFresh>;
  confirmEmailMethod(code: string): Promise<EmailMethodResult>;
  remove(id: string): Promise<RemoveMethodResult>;
  /** Secure Email Change: emails a code to the current and the new address. The current one keeps working until both are confirmed. */
  changeEmail(email: string): Promise<EmailChangeResult>;
  confirmEmailChange(codes: { readonly currentCode: string; readonly newCode: string }): Promise<EmailChangeConfirmation>;
}

/** What a provider's native sheet answered: an ID token whose nonce claim is the hashed nonce it was given. */
export type ProviderToken = { readonly status: 'token'; readonly idToken: string } | { readonly status: 'cancelled' } | { readonly status: 'failed' };

/** What the system browser's sign-in session ended with: the app's callback URL, or the player closing it. */
export type AuthSessionResult = { readonly status: 'returned'; readonly url: string } | { readonly status: 'cancelled' };

/**
 * The device's Apple and Google sign-in (native modules in the app). Apple is
 * native on iOS and goes through the secure system browser on Android; Google
 * is native on both. Every route ends in a provider ID token.
 */
export interface ProviderPorts {
  /** How this platform signs in with each provider. */
  readonly route: Readonly<Record<IdentityProvider, 'native' | 'browser' | 'unavailable'>>;
  /** Opens the provider's native sheet, asking for an ID token carrying `hashedNonce`. */
  nativeIdToken(provider: IdentityProvider, request: { readonly hashedNonce: string }): Promise<ProviderToken>;
  /** Opens `url` in the secure system browser (ASWebAuthenticationSession, Custom Tabs) until it redirects to `callbackUrl`. */
  openAuthSession(url: string, callbackUrl: string): Promise<AuthSessionResult>;
  /** SHA-256 of `text`, as lowercase hex. */
  sha256Hex(text: string): Promise<string>;
}

export interface ProviderSettings {
  readonly ports: ProviderPorts;
  /** How Auth names each provider, when not its own name (a local stack's test identity provider stands in for both). */
  readonly authName?: Partial<Record<IdentityProvider, string>>;
  /** Apple's web authorization, for the browser route: its endpoint and the app's Services ID. */
  readonly appleWeb?: { readonly authorizeUrl: string; readonly clientId: string };
}

/** Where refresh credentials live: SecureStore on a device. */
export interface CredentialStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * The account vault (#85): opens and closes this installation's database for
 * an account. The Account service opens it when the gate becomes Active.
 */
export interface AccountVault {
  open(accountId: string): Promise<VaultOpening>;
  close(): Promise<void>;
  /** Removes every database, key and installation identity another environment left on this device. */
  removeEnvironment(environment: EnvironmentName): Promise<void>;
}

/** An account's database, open for the current account session. */
export interface VaultSession {
  readonly installationId: string;
  /** The account's store; it refuses to read or write once the account session has ended. The local supplement reads its unfinished activities. */
  readonly store: SyncStore & Partial<UnfinishedActivities>;
}

/**
 * Every other outcome opens nothing, so no sync runs: Recovery needed (the key
 * or database is lost or unreadable), a later build's schema (needs-update), a
 * failed migration (retried at the next open), or an opening a later sign-in
 * superseded. The first three are gate states; a superseded opening changes nothing.
 */
export type VaultOpening =
  | { readonly status: 'open'; readonly session: VaultSession }
  | { readonly status: 'recovery-needed' | 'needs-update' | 'migration-failed' | 'superseded' };

export type { DetailResult, HistoryDownload, HistoryStatus };

/** What sync status (S2-20) shows: the engine's status, the live connection and the first download. */
export interface SyncStatus extends EngineStatus {
  /** Whether this installation holds the account's live connection (the newest foregrounded one). */
  readonly live: boolean;
}

/**
 * Queueing a record for upload (spec 2, *Record-type registry*): queued, with
 * its originating-device position for a per-device type; or refused, when no
 * account session is open, the type isn't registered or is server-authored
 * (no client writes it), the payload is online only (sent at once, never
 * queued), or the payload isn't the type's.
 */
export type QueueResult =
  | { readonly status: 'queued'; readonly id: string; readonly position?: number }
  | { readonly status: 'refused'; readonly reason: 'no-account' | 'unknown-type' | 'server-authored' | 'online-only' | 'invalid-payload' };

/** Synchronization for the open account session. Triggers run it by themselves; these are for asking. */
export interface AccountSync {
  readonly status: SyncStatus;
  /**
   * Queues an account-state operation or result for upload, committed locally
   * before it resolves, then uploaded by itself. It waits for its barriers:
   * any pending upload of a barrier type that affects it, and, for a purge,
   * the target's own pending upload. A purge removes the target from this
   * installation at once.
   */
  queue(recordType: string, payload: unknown): Promise<QueueResult>;
  /** Called when the status changes; returns an unsubscribe function. */
  subscribe(listener: (status: SyncStatus) => void): () => void;
  /**
   * A deliberate retry ("Sync now", "Retry now"): uploads and fetches now, past
   * any backoff (never before a server's retry-after); resolves when that has
   * finished. Coalesces with work already going.
   */
  reconcile(): Promise<void>;
  /** "Retry this record": tries a failing or flagged record again now, with the records waiting for it. */
  retryRecord(id: string): Promise<void>;
  /**
   * Download all history (spec 2, *History*): keeps every record's detail on
   * this installation, for offline trips. It carries on by itself, across
   * restarts, until done; asking again resumes one stopped for storage. Its
   * progress is the status's `download`. Resolves when this run has finished.
   */
  downloadAllHistory(): Promise<void>;
  /** Resolves once no synchronization is running. */
  idle(): Promise<void>;
  /** How many saved records haven't reached the account yet; 0 with no open account session. */
  countWaiting(): Promise<number>;
}

const NO_SYNC: SyncStatus = {
  live: false,
  error: null,
  lastSyncedAt: null,
  uploads: [],
  update: null,
  history: { state: 'complete' },
  download: { state: 'not-requested' },
};

export interface AccountServiceOptions {
  /** The one backend this build talks to, fixed when it was built. */
  readonly backend: BackendEnvironment;
  /** The device's network. */
  readonly fetch: typeof fetch;
  readonly credentials: CredentialStorage;
  readonly vault: AccountVault;
  /** Milliseconds since the epoch. */
  readonly clock: () => number;
  /** Foreground, connectivity and timers. */
  readonly device: DevicePorts;
  /** Secure random bytes. */
  readonly randomBytes: (count: number) => Uint8Array;
  /** The device locale's currency (ISO 4217), if it has one: a new account's default currency. */
  readonly localeCurrency: () => string | null;
  /** The device's WebSocket, for the live connection. */
  readonly webSocket?: typeof WebSocket;
  /** Apple and Google sign-in. Without it, only email codes work. */
  readonly providers?: ProviderSettings;
  /** The registered record types: this build's own by default; seam 2 adds its test-only types. */
  readonly recordTypes?: ReadonlyMap<string, RecordType>;
  /** The platform's age signal; none by default (the fallback question). */
  readonly ageSignals?: PlatformAgeSignals;
  /** The operational metrics provider (spec 7); discarded by default. Only what the gate and the catalog allow reaches it (metrics.ts). */
  readonly metrics?: MetricsSink;
  /** The device's free storage in bytes, or null when it can't tell: downloads stop before they would run it short. */
  readonly freeStorage?: () => number | null;
  /** How this device describes itself on Devices. */
  readonly deviceDescription: () => DeviceDescription;
}

export interface AccountService {
  readonly gate: AccountGate;
  /** Called on every gate change; returns an unsubscribe function. */
  subscribe(listener: (gate: AccountGate) => void): () => void;
  /** Whether this device can ask the platform for an age range; when false, the age step is the fallback question. */
  readonly platformAgeCheck: boolean;
  /**
   * The platform age check, which may show the system's prompt: on the Create
   * path's age step (with no account), or to retry an unresolved account.
   * Under 13 on the Create path ends there without contacting the server; an
   * established range on the Create path obtains an eligibility assertion; on
   * an unresolved account it replaces the account's record. "question" when the
   * platform proved nothing and the fallback question may decide; "unresolved"
   * when a required check stands in the way.
   */
  checkAge(): Promise<AgeCheckResult>;
  /**
   * The fallback age-range question. On the Create path, under 13 ends here
   * without contacting the server; any other range obtains a short-lived,
   * single-use eligibility assertion for creating the account. On an
   * unresolved account it decides the record only when no required check or
   * platform answer stands in the way ("unresolved" otherwise); it needs a connection.
   */
  answerAgeQuestion(range: AgeRange): Promise<AgeAnswerResult>;
  /**
   * Refreshes eligibility for the open account: asks the platform without a
   * prompt (applied at once, offline too), reports a range it established,
   * then takes the server's current record. Runs by itself on reopening, on
   * entering the foreground, on reconnection and every minute while
   * foregrounded and connected; resolves when that has finished. Established
   * eligibility never lapses offline or with time.
   */
  refreshEligibility(): Promise<void>;
  /**
   * Sends a code. Every request sends an email: the code when the address has
   * an account, otherwise a "No account for this address" email. The answer
   * is the same either way. Create needs a current eligibility assertion;
   * sign-in never creates an account.
   */
  requestEmailCode(request: { readonly email: string; readonly intent: CodeIntent }): Promise<CodeRequestResult>;
  /**
   * Signs in with the emailed code. The account's server record governs its
   * eligibility, and required platform checks still run: the gate becomes
   * Active for an established 13+ band, otherwise Age unresolved or Age ineligible.
   */
  verifyEmailCode(request: { readonly email: string; readonly code: string }): Promise<CodeVerificationResult>;
  /**
   * App review: signs in to a reviewer account with its reviewer credential,
   * with no email code. The credential works only for that one account, in
   * this build's environment; the session, gate and eligibility are then
   * those of any sign-in.
   */
  signInAsReviewer(request: { readonly email: string; readonly credential: string }): Promise<ReviewerSignInResult>;
  /**
   * Sign in with Apple or Google. Never creates an account: an identity with
   * no account answers No account, leaving no Auth user, and is held briefly
   * so Create can use it without asking the provider again.
   */
  signInWithProvider(provider: IdentityProvider): Promise<ProviderSignInResult>;
  /**
   * Create with Apple or Google, after the age step: binds the eligibility
   * assertion to the provider identity, so Auth creates that identity's user
   * with it. It asks the provider who the player is, unless `sameIdentity`:
   * Create from "No account for this Apple ID / Google account" uses the
   * identity that Sign in just found. An identity that already has an account
   * signs in to it.
   */
  createWithProvider(provider: IdentityProvider, options?: { readonly sameIdentity?: boolean }): Promise<ProviderCreateResult>;
  /**
   * The app starting again: reopens the account this installation was signed
   * in to from its stored credentials, without the network. The gate becomes
   * Active, or Renewal pending when its token has expired (access and records
   * stay), the remembered age state, or the state its database is in. After a
   * sign-out it is Signed out, opening nothing. Stays at No account when there is none.
   */
  resume(): Promise<{ readonly status: 'resumed' | 'signed-out' | 'no-account' }>;
  /**
   * Renews an expired token (Renewal pending → Active; a restricted state keeps
   * its state, with its token renewed). A failure keeps Renewal pending, with access and records.
   */
  renew(): Promise<void>;
  /**
   * Signs out of this installation only (the current session, never every
   * session). It first runs the session-ending handlers (an open practice
   * session suspends), then closes the database, keeping it and its
   * key, clears the credentials and moves the gate to Signed out, all without
   * the network. Only then does it tell the server; offline it never claims
   * the server session ended.
   */
  signOut(): Promise<SignOutResult>;
  /**
   * Runs `handler` before the account session ends, while its database is
   * still open: the practice controller suspends and lets a save in flight
   * finish. Returns an unsubscribe function.
   */
  onAccountSessionEnding(handler: () => Promise<void>): () => void;
  /** Settings → Account. Null when no account is signed in, or the account changed while asking. */
  accountSummary(): Promise<AccountSummary | null>;
  /** Changes the account currency (online only). Locked while any casino session exists. */
  setAccountCurrency(currency: string): Promise<CurrencyChangeResult>;
  readonly sync: AccountSync;
  /** Revisioned items, their conflicts, and lifetime totals for the open account. */
  readonly records: AccountRecords;
  /** The account's privacy choices: analytics consent and the ad-data opt-out (#105). */
  readonly privacy: AccountPrivacy;
  readonly freshAuthentication: FreshAuthentication;
  readonly signInMethods: SignInMethods;
  readonly devices: Devices;
  /** Export my data: the server export and the local supplement, on the restricted paths too. */
  readonly export: AccountExport;
}


/** Where the signed-in account is remembered, in the environment's credentials (so it goes with them). */
const rememberedAccountKey = (environment: EnvironmentName) => `tableside.${environment}.account`;

/**
 * The account this installation is signed in to, as this device last knew
 * it: the account's eligibility record (the server's, or a range this
 * device's platform established), this device's own platform state, and the
 * currency it last heard of. After a sign-out only this stays: the account
 * whose database is kept here, locked.
 */
interface RememberedAccount {
  readonly accountId: string;
  readonly eligibility: EligibilityRecord;
  /** A required platform check this device still owes: it restricts this device only. */
  readonly check?: RequiredCheck;
  /** The last range this device's platform established, applied once; a later change elsewhere isn't overridden by repeating it. */
  readonly signal?: AgeRange;
  /** The last range the server accepted from this device, so each is reported once. */
  readonly reported?: AgeRange;
  readonly currency: string | null;
  readonly signedOut: boolean;
  /** When and by whom the server confirmed this installation's session was revoked; the account is locked (signedOut) since. */
  readonly revoked?: { readonly at: number; readonly by: RevokedBy } | undefined;
}

/** The eligibility part of what is remembered. */
type RememberedEligibility = Pick<RememberedAccount, 'eligibility' | 'check' | 'signal' | 'reported'>;

const UNAVAILABLE: AgeSignal = { kind: 'unavailable' };
const sameRecord = (a: EligibilityRecord, b: EligibilityRecord) => a.status === b.status && a.source === b.source;

/** The eligibility after a platform answer: a required check is owed (or cleared), or a newly established range applies. */
function afterSignal(base: RememberedEligibility, signal: AgeSignal): RememberedEligibility {
  const owed = requiredCheck(signal);
  const next: RememberedEligibility = {
    eligibility: base.eligibility,
    ...(owed ? { check: owed } : {}),
    ...(base.signal ? { signal: base.signal } : {}),
    ...(base.reported ? { reported: base.reported } : {}),
  };
  if (signal.kind !== 'range' || signal.range === base.signal) return next;
  // Under 13 goes to support review: no platform answer raises it here (#42).
  if (base.eligibility.status === 'under-13') return next;
  return { ...next, eligibility: { status: signal.range, source: 'platform-signal' }, signal: signal.range };
}

/** Only the eligibility fields of `next`, over everything else `base` holds. */
const withEligibility = (base: RememberedAccount, next: RememberedEligibility): RememberedAccount => ({
  accountId: base.accountId,
  currency: base.currency,
  signedOut: base.signedOut,
  ...(base.revoked ? { revoked: base.revoked } : {}),
  eligibility: next.eligibility,
  ...(next.check ? { check: next.check } : {}),
  ...(next.signal ? { signal: next.signal } : {}),
  ...(next.reported ? { reported: next.reported } : {}),
});

/** The gate an open account is in. */
function gateFor(remembered: RememberedAccount, renewing: boolean): AccountGate {
  const { accountId, eligibility, check } = remembered;
  if (eligibility.status === 'under-13') return { state: 'age-ineligible', accountId };
  if (check) return { state: 'age-unresolved', accountId, reason: check === 'unmet' ? 'check-unmet' : 'check-pending' };
  if (isEligibleBand(eligibility.status)) return { state: renewing ? 'renewal-pending' : 'active', accountId, eligibility: eligibility.status };
  return { state: 'age-unresolved', accountId, reason: eligibility.source === 'platform-signal' ? 'check-pending' : 'not-established' };
}

/** Who the provider says the player is: an ID token minted for `nonce` (whose hash is its nonce claim). Memory only. */
interface ProviderCredential {
  readonly provider: IdentityProvider;
  readonly idToken: string;
  readonly nonce: string;
}

/** How long a Sign in that found no account is held for Create: well inside an Apple ID token's ten minutes. */
const HELD_CREDENTIAL_MS = 5 * 60_000;

interface Assertion {
  readonly token: string;
  readonly expiresAt: number;
}

/** Supabase's stored session: what resuming, renewal and sign-out read and write. */
interface StoredSession {
  readonly access_token: string;
  readonly refresh_token: string;
  /** Seconds since the epoch. */
  readonly expires_at: number;
  readonly expires_in: number;
  readonly user?: { readonly email?: string; readonly identities?: readonly { readonly provider?: string }[] };
}

const SIGN_IN_METHODS: readonly string[] = ['apple', 'google', 'email'] satisfies SignInMethod[];
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
/** The currency an account without one on record shows: the server's own default. */
const DEFAULT_CURRENCY = 'USD';

/** Gate states that open ordinary access: Renewal pending keeps it while the token renews. */
export type SignedInGate = Extract<AccountGate, { state: 'active' | 'renewal-pending' }>;
export const isSignedIn: (gate: AccountGate) => gate is SignedInGate = opensOrdinaryAccess;

export function createAccountService(options: AccountServiceOptions): AccountService {
  const { backend } = options;
  const registry = options.recordTypes ?? recordTypes;
  // This environment's credentials: Auth's session, and the remembered account beside it.
  const credentials = namespacedCredentials(options.credentials, backend.name);
  // Nothing restores credentials, opens an account database or sends anything
  // until every retired environment's namespace is gone: the client is made
  // only after that, since making it reads the stored credentials.
  // Every server call in this service goes through `connect`.
  let client: Promise<SupabaseClient> | null = null;
  const retryAfter = new RetryAfterWatch(options.clock);
  const connect = (): Promise<SupabaseClient> =>
    (client ??= (async () => {
      await removeRetiredEnvironments(options);
      const created = createClient(backend.url, backend.publishableKey, {
        global: { fetch: retryAfter.wrap(options.fetch), headers: { [ENVIRONMENT_HEADER]: backend.name } },
        auth: {
          storage: credentials,
          storageKey: credentialsKey(backend.name),
          persistSession: true,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        ...(options.webSocket ? { realtime: { transport: options.webSocket } } : {}),
      });
      // A refreshed token re-subscribes the live connection with it.
      created.auth.onAuthStateChange((event) => {
        if (event === 'TOKEN_REFRESHED') sync?.session.credentialsChanged();
      });
      return created;
    })().catch((error: unknown) => {
      client = null;
      throw error;
    }));
  /** A request to the backend outside the Supabase client, naming this environment like every other. */
  const post = async (path: string, body: unknown, headers: Record<string, string> = {}): Promise<Response> => {
    await connect();
    return options.fetch(`${backend.url}${path}`, {
      method: 'POST',
      headers: { apikey: backend.publishableKey, [ENVIRONMENT_HEADER]: backend.name, 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  };
  const listeners = new Set<(gate: AccountGate) => void>();
  const accountSessionEnding = new Set<() => Promise<void>>();
  const ageSignals = options.ageSignals ?? noPlatformAgeSignals;
  let gate: AccountGate = { state: 'no-account' };
  const metrics = createMetricsSender({ gate: () => gate, sink: options.metrics ?? discardMetrics });
  let assertion: Assertion | null = null;
  /** The Create path's platform check found a required check in the way: the fallback answer can't decide. */
  let declarationBlocked = false;
  /**
   * The account-session generation: it moves on at every sign-in, sign-out and
   * account switch, and an answer that arrives after it moved touches nothing.
   */
  let generation = 0;
  let signingOut: Promise<SignOutResult> | null = null;

  let sync: { readonly engine: SyncEngine; readonly session: SyncSession; readonly store: SyncStore } | null = null;
  /**
   * The open account session: its database, what this device knows of the
   * account, and whether its token awaits renewal. A new object for each
   * session, so an answer for an earlier one (`opened !== current`) changes nothing.
   */
  type OpenSession = {
    readonly session: VaultSession;
    remembered: RememberedAccount;
    renewing: boolean;
    /** Whether this session is registered to this installation (and so may sync, and learn of its revocation). */
    registered: boolean;
    readonly stopWatch: () => void;
  };
  let opened: OpenSession | null = null;
  /** The eligibility refresh in flight, for the session it belongs to. */
  let refreshing: { readonly session: OpenSession; readonly run: Promise<void> } | null = null;
  const syncListeners = new Set<(status: SyncStatus) => void>();
  const syncStatus = (): SyncStatus => (sync ? { ...sync.engine.status, live: sync.session.isLive } : NO_SYNC);
  const syncChanged = () => {
    const status = syncStatus();
    for (const listener of syncListeners) listener(status);
  };

  const setGate = (next: AccountGate) => {
    if (JSON.stringify(next) === JSON.stringify(gate)) return;
    gate = next;
    for (const listener of listeners) listener(next);
  };

  // Writes to the credentials go one at a time, so a late renewal can't write
  // its token back after a sign-out cleared it.
  let credentialWrites: Promise<unknown> = Promise.resolve();
  const writeCredentials = (write: () => Promise<void>): Promise<void> => {
    const next = credentialWrites.then(write);
    credentialWrites = next.catch(() => undefined);
    return next;
  };
  const remember = (account: RememberedAccount) => credentials.setItem(rememberedAccountKey(backend.name), JSON.stringify(account));
  const readRemembered = async () => parseRemembered(await credentials.getItem(rememberedAccountKey(backend.name)));

  /**
   * Sync runs only while ordinary access is open, and once the session is
   * registered to this installation (the server takes uploads from the
   * caller's own installation only): a restricted account's database stays
   * open for its restricted paths only.
   */
  const updateSync = async () => {
    if (!opensOrdinaryAccess(gate)) {
      if (!sync) return;
      sync.session.end();
      sync = null;
      syncChanged();
      return;
    }
    if (sync || !opened?.registered) return;
    const current = opened;
    const supabase = await connect();
    // The gate may have closed, or another session opened, meanwhile.
    if (opened !== current || sync || !opensOrdinaryAccess(gate)) return;
    const { store, installationId } = current.session;
    const engine = new SyncEngine({
      store,
      backend: supabaseSyncBackend(supabase, retryAfter),
      registry,
      installationId,
      newOperationId: () => hex(options.randomBytes(16)),
      clock: options.clock,
      random: () => uniform(options.randomBytes(4)),
      metrics,
      ...(options.freeStorage ? { storage: options.freeStorage } : {}),
    });
    engine.onChange(syncChanged);
    // Its status read from the store first (the first download's progress among it), so it never shows a default.
    await engine.idle();
    // A sign-out, another sign-in or a closing gate while it read: not this one's to start.
    if (opened !== current || sync || !opensOrdinaryAccess(gate)) return engine.stop();
    sync = {
      engine,
      store,
      session: new SyncSession(engine, store, options.device, supabaseLiveChannels(supabase, current.remembered.accountId, retryAfter), options.clock),
    };
    syncChanged();
  };

  /**
   * Keeps what this device knows of the open account's eligibility (with its
   * credentials, over whatever else is remembered, such as the currency) and
   * moves the gate.
   */
  const rememberEligibility = async (current: OpenSession, next: RememberedEligibility) => {
    if (opened !== current) return;
    current.remembered = withEligibility(current.remembered, next);
    await writeCredentials(async () => {
      const stored = await readRemembered();
      if (opened === current) await remember(withEligibility(stored ?? current.remembered, next));
    });
    if (opened !== current) return;
    setGate(gateFor(current.remembered, current.renewing));
    await updateSync();
  };

  /**
   * Opens the account's database for a new account session and moves the gate
   * (starting sync when ordinary access is open). Nothing changes when a later
   * sign-in overtook this one.
   */
  const openAccount = async (remembered: RememberedAccount, renewing = false) => {
    generation++;
    opened?.stopWatch();
    opened = null;
    sync?.session.end();
    sync = null;
    syncChanged();
    const opening = await options.vault.open(remembered.accountId);
    if (opening.status === 'superseded') return;
    const { accountId } = remembered;
    if (opening.status === 'recovery-needed') return setGate({ state: 'recovery-needed', accountId });
    if (opening.status !== 'open') return setGate({ state: 'database-unavailable', accountId, reason: opening.status });
    const current: OpenSession = { session: opening.session, remembered, renewing, registered: false, stopWatch: watchEligibility() };
    opened = current;
    setGate(gateFor(remembered, renewing));
    await registerDevice(current);
    await updateSync();
  };

  /** This session's status credential, kept with the credentials while the session lasts. */
  const storedStatus = async (accountId: string): Promise<string | null> => {
    const stored = parseJson(await credentials.getItem(statusKey(backend.name))) as { accountId?: unknown; token?: unknown } | null;
    return stored?.accountId === accountId && typeof stored.token === 'string' ? stored.token : null;
  };

  /**
   * Registers this session to this installation, once per session: online,
   * with an unexpired token. The installation's secret (kept across sign-outs)
   * proves it is the installation that first registered for the account. A
   * failure leaves it unregistered, and the next refresh tries again.
   */
  const registerDevice = async (current: OpenSession): Promise<void> => {
    if (current.registered) return;
    const { accountId } = current.remembered;
    if (await storedStatus(accountId)) {
      if (opened === current) current.registered = true;
      return;
    }
    if (!(await canAskServer(current, { renew: false }))) return;
    const { installationId } = current.session;
    const secretKey = installationSecretKey(backend.name, installationId, accountId);
    try {
      // The secret is this device's before the server hears it, so a lost answer or a kill never strands the installation.
      let secret = await credentials.getItem(secretKey);
      if (!secret) {
        const created = hex(options.randomBytes(32));
        await writeCredentials(() => credentials.setItem(secretKey, created));
        secret = created;
      }
      const { platform, label } = options.deviceDescription();
      const supabase = await connect();
      const { data, error } = await supabase.rpc('register_device_v1', { installation: installationId, secret, platform, label });
      const answer = data as { status?: unknown; status_token?: unknown } | null;
      if (error || answer?.status !== 'registered' || typeof answer.status_token !== 'string') return;
      const token = answer.status_token;
      await writeCredentials(async () => {
        if (opened !== current) return;
        await credentials.setItem(statusKey(backend.name), JSON.stringify({ accountId, token }));
        current.registered = true;
      });
    } catch {
      // Offline, or the answer was lost: the next refresh registers.
    }
  };

  /**
   * Asks the server, with this session's status credential, what became of the
   * account and session. Only its answer that the session was revoked moves the
   * gate to Revoked: a timeout, a lost answer, an expired token or a refused
   * renewal never does. (Deletion scheduled and Deleted are #103's and #104's.)
   */
  const checkLifecycle = async (current: OpenSession): Promise<void> => {
    if (!options.device.online.current()) return;
    const token = await storedStatus(current.remembered.accountId);
    if (!token || opened !== current) return;
    try {
      const response = await post('/rest/v1/rpc/lifecycle_status_v1', { token });
      const answer = (await response.json().catch(() => null)) as { status?: unknown; at?: unknown; by?: unknown } | null;
      if (!response.ok || opened !== current || answer?.status !== 'revoked') return;
      const at = typeof answer.at === 'string' ? Date.parse(answer.at) : Number.NaN;
      await lockRevoked(current, { at: Number.isFinite(at) ? at : options.clock(), by: answer.by === 'provider' ? 'provider' : 'device' });
    } catch {
      // Offline or the answer was lost: nothing is known.
    }
  };

  /**
   * The server confirmed this session was revoked: an open practice session
   * suspends at once (as on sign-out), then the database closes, kept with its
   * key, and the credentials go. A fresh sign-in to the same account reopens it.
   */
  const lockRevoked = async (current: OpenSession, revoked: { readonly at: number; readonly by: RevokedBy }): Promise<void> => {
    if (signingOut) return;
    const { accountId } = current.remembered;
    for (const handler of [...accountSessionEnding]) await handler().catch(() => undefined);
    if (opened !== current || signingOut) return;
    await closeAccountSession(accountId, revoked);
    setGate({ state: 'revoked', accountId, revokedAt: revoked.at, by: revoked.by });
  };

  /**
   * Locks the account on this installation, once the session-ending handlers
   * have run (sign-out or revocation): the account session ends, its database
   * closes, kept with its key, and its credentials go, all without the network.
   */
  const closeAccountSession = async (accountId: string, revoked?: RememberedAccount['revoked']): Promise<void> => {
    generation++;
    opened?.stopWatch();
    opened = null;
    sync?.session.end();
    sync = null;
    syncChanged();
    await options.vault.close();
    await writeCredentials(async () => {
      const remembered = await readRemembered();
      // The lock first: a kill between the writes still reopens locked (an earlier revocation is no longer why).
      if (remembered) await remember({ ...remembered, accountId, signedOut: true, revoked });
      await credentials.removeItem(credentialsKey(backend.name));
      await credentials.removeItem(statusKey(backend.name));
    });
  };

  /** Refreshes eligibility on entering the foreground, on reconnection and every minute while foregrounded and connected. */
  const watchEligibility = (): (() => void) => {
    const { device } = options;
    const refresh = () => {
      if (device.foreground.current() && device.online.current()) void refreshEligibility().catch(() => undefined);
    };
    const stops = [
      device.foreground.subscribe((foreground) => foreground && refresh()),
      device.online.subscribe((online) => online && refresh()),
      device.every(ELIGIBILITY_REFRESH_MS, refresh),
    ];
    return () => stops.forEach((stop) => stop());
  };

  /** Renews an expired token, once; a failure leaves it awaiting renewal, with access and records. */
  const renewSession = async (current: OpenSession): Promise<void> => {
    if (!current.renewing) return;
    const session = await storedSession();
    if (!session) return;
    try {
      const response = await post('/auth/v1/token?grant_type=refresh_token', { refresh_token: session.refresh_token });
      if (!response.ok) {
        await response.arrayBuffer();
        // A refused renewal proves nothing by itself; the server's status may (a revoked session).
        await checkLifecycle(current);
        return;
      }
      const renewed = (await response.json()) as StoredSession;
      const expiresAt = Math.floor(options.clock() / 1000) + renewed.expires_in;
      // A sign-out or another account while this was in flight: touch nothing.
      let applied = false;
      await writeCredentials(async () => {
        if (opened !== current) return;
        await credentials.setItem(credentialsKey(backend.name), JSON.stringify({ ...renewed, expires_at: expiresAt }));
        applied = true;
      });
      if (!applied || opened !== current) return;
      current.renewing = false;
      setGate(gateFor(current.remembered, false));
      // The live connection re-subscribes with the renewed token, as on Supabase's own refresh.
      sync?.session.credentialsChanged();
      await registerDevice(current);
      await updateSync();
    } catch {
      // Offline or the response was lost: still awaiting renewal.
    }
  };

  /**
   * Whether the server can be asked now: online, with a token that hasn't
   * expired (Supabase would otherwise try to renew it itself). The player's own
   * retry or answer renews an expired token first; background refreshes leave
   * renewal to its own trigger.
   */
  const canAskServer = async (current: OpenSession, { renew }: { readonly renew: boolean }): Promise<boolean> => {
    if (!options.device.online.current()) return false;
    if (renew) await renewSession(current);
    return opened === current && !current.renewing;
  };

  /** The server's current record for the signed-in account, or null when it can't say (the gate denies, or the answer was lost). */
  const serverRecord = async (): Promise<EligibilityRecord | null> => {
    try {
      const supabase = await connect();
      const { data, error } = await supabase.rpc('current_account');
      return error ? null : parseEligibilityRecord(data);
    } catch {
      return null;
    }
  };

  /** Reports a decision; the server's answer becomes the account's record. False when it couldn't be sent. */
  const report = async (current: OpenSession, record: EligibilityRecord): Promise<boolean> => {
    try {
      const supabase = await connect();
      const { data, error } = await supabase.rpc('record_eligibility_v1', { band: record.status, source: record.source });
      const answer = error ? null : parseEligibilityRecord(data);
      if (!answer || opened !== current) return false;
      const accepted = (data as { accepted?: unknown }).accepted === true;
      const reported = accepted && record.source === 'platform-signal' && isAgeRange(record.status) ? record.status : current.remembered.reported;
      await rememberEligibility(current, { ...current.remembered, eligibility: answer, ...(reported ? { reported } : {}) });
      return true;
    } catch {
      return false;
    }
  };

  /** Sends the range this device's platform established, once. */
  const reportSignal = async (current: OpenSession): Promise<void> => {
    const { signal, reported } = current.remembered;
    if (signal && signal !== reported) await report(current, { status: signal, source: 'platform-signal' });
  };

  const refreshOnce = async (current: OpenSession) => {
    // What became of the session first: a revoked one locks, and nothing else runs for it.
    await checkLifecycle(current);
    if (opened !== current) return;
    const signal = await ageSignals.check({ interactive: false }).catch(() => UNAVAILABLE);
    if (opened !== current) return;
    // What the platform says applies at once, offline too: restrictions never wait for the server.
    await rememberEligibility(current, afterSignal(current.remembered, signal));
    if (!(await canAskServer(current, { renew: false }))) return;
    await registerDevice(current);
    await updateSync();
    await reportSignal(current);
    const record = await serverRecord();
    if (!record || opened !== current || sameRecord(record, current.remembered.eligibility)) return;
    await rememberEligibility(current, { ...current.remembered, eligibility: record });
  };

  const refreshEligibility = (): Promise<void> => {
    const current = opened;
    if (!current) return Promise.resolve();
    if (refreshing?.session === current) return refreshing.run;
    const run = refreshOnce(current).finally(() => {
      if (refreshing?.run === run) refreshing = null;
    });
    refreshing = { session: current, run };
    return run;
  };

  /** The Create path: a short-lived, single-use assertion for an established range, carrying the device locale's currency. */
  const obtainAssertion = async (range: EligibilityBand, source: EligibilitySource): Promise<AgeAnswerResult> => {
    try {
      const supabase = await connect();
      const { data, error } = await supabase.rpc('issue_eligibility_assertion', { age_range: range, currency: options.localeCurrency(), source });
      if (error) return { status: 'failed' };
      const issued = data as { assertion: string; expires_at: string };
      assertion = { token: issued.assertion, expiresAt: Date.parse(issued.expires_at) };
      return { status: 'eligible' };
    } catch {
      return { status: 'failed' };
    }
  };

  /** What an unresolved account's retry ended in. */
  const retryOutcome = (): AgeAnswerResult => {
    if (gate.state === 'age-ineligible') return { status: 'ineligible' };
    if (gate.state === 'age-unresolved') return { status: 'unresolved' };
    return { status: 'eligible' };
  };

  const currentAssertion = () => (assertion && assertion.expiresAt > options.clock() ? assertion : null);

  /**
   * After Auth signed in: opens the account. Its server record governs its
   * eligibility, and required platform checks still run on this device: the
   * gate becomes Active, or Age unresolved or Age ineligible.
   */
  const finishSignIn = async (supabase: SupabaseClient): Promise<boolean> => {
    const { data, error } = await supabase.rpc('current_account');
    const account = data as { account_id?: unknown; currency?: unknown } | null;
    const record = error ? null : parseEligibilityRecord(data);
    if (!account || typeof account.account_id !== 'string' || !record) {
      await supabase.auth.signOut({ scope: 'local' });
      return false;
    }
    assertion = null;
    declarationBlocked = false;
    heldCredential = null;
    const signal = await ageSignals.check({ interactive: false }).catch(() => UNAVAILABLE);
    const remembered = withEligibility(
      { accountId: account.account_id, eligibility: record, currency: isCurrency(account.currency) ? account.currency : null, signedOut: false },
      afterSignal({ eligibility: record }, signal),
    );
    await writeCredentials(async () => {
      // An earlier session's status credential: this session registers afresh.
      await credentials.removeItem(statusKey(backend.name));
      await remember(remembered);
    });
    await openAccount(remembered);
    if (opened) await reportSignal(opened);
    return true;
  };

  /** A Sign in that found no account, kept in memory only so Create can use it without asking the provider again. */
  let heldCredential: (ProviderCredential & { readonly until: number }) | null = null;

  /**
   * Asks the provider who the player is, ending in an ID token minted for a
   * fresh nonce: from the native sheet, or from Apple's web page in the
   * system browser.
   */
  const obtainCredential = async (provider: IdentityProvider, nonce = hex(options.randomBytes(32))): Promise<ProviderCredential | 'cancelled' | 'failed'> => {
    const settings = options.providers;
    const route = settings?.ports.route[provider] ?? 'unavailable';
    if (!settings || route === 'unavailable') return 'failed';
    const { ports } = settings;
    const hashedNonce = await ports.sha256Hex(nonce);
    if (route === 'native') {
      const answer = await ports.nativeIdToken(provider, { hashedNonce });
      return answer.status === 'token' ? { provider, idToken: answer.idToken, nonce } : answer.status;
    }
    return browserCredential(provider, settings, nonce, hashedNonce);
  };

  /**
   * Apple's web flow, for Android. Apple posts its answer to the
   * provider-callback function, which keeps the ID token under the flow's
   * challenge and sends the browser back to this environment's callback URL
   * with only the state. The token is redeemed with the verifier, which never
   * leaves this device until then, so only the request that started the flow
   * can collect it, and no token appears in any URL.
   */
  const browserCredential = async (
    provider: IdentityProvider,
    { ports, appleWeb }: ProviderSettings,
    nonce: string,
    hashedNonce: string,
  ): Promise<ProviderCredential | 'cancelled' | 'failed'> => {
    if (!appleWeb) return 'failed';
    const verifier = hex(options.randomBytes(32));
    const state = `${backend.name}~${await ports.sha256Hex(verifier)}`;
    const callbackUrl = authCallbackUrl(backend.name);
    const authorize = `${appleWeb.authorizeUrl}?${queryString({
      client_id: appleWeb.clientId,
      redirect_uri: `${backend.url}/functions/v1/provider-callback?provider=${encodeURIComponent(authName(provider))}`,
      response_type: 'code id_token',
      response_mode: 'form_post',
      scope: 'email',
      state,
      nonce: hashedNonce,
    })}`;
    await connect();
    const session = await ports.openAuthSession(authorize, callbackUrl);
    if (session.status === 'cancelled') return 'cancelled';
    // Only this environment's callback, answering this flow.
    const [returnedTo, returnedQuery = ''] = session.url.split('?', 2);
    const returned = parseQuery(returnedQuery);
    if (returnedTo !== callbackUrl || returned.state !== state) return 'failed';
    if (returned.error) return returned.error === 'cancelled' ? 'cancelled' : 'failed';
    const supabase = await connect();
    const { data, error } = await supabase.rpc('redeem_provider_flow', { verifier });
    return !error && typeof data === 'string' && data ? { provider, idToken: data, nonce } : 'failed';
  };

  /** Binds the age step's assertion to the credential's identity (bind-provider-assertion). */
  const bindAssertion = async (
    credential: ProviderCredential,
    ageAssertion: Assertion,
  ): Promise<'bound' | 'existing' | 'age-required' | 'invalid-token' | 'failed'> => {
    const response = await post('/functions/v1/bind-provider-assertion', {
      provider: authName(credential.provider),
      idToken: credential.idToken,
      nonce: credential.nonce,
      assertion: ageAssertion.token,
    });
    const status = ((await response.json().catch(() => null)) as { status?: string } | null)?.status;
    if (response.ok && (status === 'bound' || status === 'existing')) return status;
    if (response.status === 403 && status === 'age-required') return status;
    if (response.status === 401 && status === 'invalid-token') return status;
    return 'failed';
  };

  const authName = (provider: IdentityProvider): string => options.providers?.authName?.[provider] ?? provider;

  /** Signs in to Auth with a provider credential; Auth checks its issuer, audience, signature, expiry and nonce. */
  const signInWithIdToken = async (supabase: SupabaseClient, credential: ProviderCredential) => {
    const { error } = await supabase.auth.signInWithIdToken({ provider: authName(credential.provider), token: credential.idToken, nonce: credential.nonce });
    if (!error) return 'signed-in' as const;
    // The before-user-created hook refused a new Auth user: nobody has this identity.
    return /eligibility_assertion_required/.test(error.message) ? ('no-account' as const) : ('failed' as const);
  };

  const storedSession = async (): Promise<StoredSession | null> => {
    const parsed = parseJson(await credentials.getItem(credentialsKey(backend.name))) as Partial<StoredSession> | null;
    return parsed && typeof parsed.refresh_token === 'string' && typeof parsed.expires_at === 'number' ? (parsed as StoredSession) : null;
  };

  /**
   * Asks the server to end this session only (current-session scope). True
   * only when it confirmed. An expired access token (Renewal pending) is
   * renewed first, since the server refuses to end a session for it.
   */
  const endServerSession = async (session: StoredSession): Promise<boolean> => {
    try {
      let accessToken = session.access_token;
      if (session.expires_at * 1000 <= options.clock()) {
        const renewal = await post('/auth/v1/token?grant_type=refresh_token', { refresh_token: session.refresh_token });
        if (!renewal.ok) {
          await renewal.arrayBuffer().catch(() => undefined);
          return false;
        }
        accessToken = ((await renewal.json()) as StoredSession).access_token;
      }
      const response = await post('/auth/v1/logout?scope=local', {}, { authorization: `Bearer ${accessToken}` });
      await response.arrayBuffer().catch(() => undefined);
      return response.ok;
    } catch {
      return false;
    }
  };

  /** What this installation knows without the network: the stored session's user and the remembered currency. */
  const localSummary = async (): Promise<AccountSummary> => {
    const user = (await storedSession())?.user;
    const methods = (user?.identities ?? []).map((identity) => identity.provider).filter(isSignInMethod);
    return {
      email: user?.email ?? null,
      methods: [...new Set(methods)],
      currency: (await readRemembered())?.currency ?? DEFAULT_CURRENCY,
      currencyChangeable: null,
      devices: null,
    };
  };

  /** Records the currency the server answered with, unless the account session moved on meanwhile. */
  const rememberCurrency = (at: number, currency: string) =>
    writeCredentials(async () => {
      const remembered = await readRemembered();
      if (at === generation && remembered && !remembered.signedOut) await remember({ ...remembered, currency });
    });

  /** Whether the gate is open for ordinary access, or for the restricted paths (fresh authentication and export among them). */
  const allows = (path: AccessPath) => (path === 'ordinary' ? isSignedIn(gate) : opensRestrictedPaths(gate));

  /** The signed-in session's access token, renewed first when it has expired; null when there is none. */
  const bearer = async (): Promise<string | null> => (await (await connect()).auth.getSession()).data.session?.access_token ?? null;

  /**
   * Calls one of the functions that act for the signed-in player (fresh-auth,
   * link-method) with this session's token. Null when the gate denies the
   * path, or the account session moved on before it answered.
   */
  const actAsPlayer = async (
    name: string,
    body: unknown,
    path: AccessPath = 'ordinary',
  ): Promise<{ readonly code: number; readonly status: string | undefined; readonly retryAfter?: unknown; readonly body: Record<string, unknown> | null } | null> => {
    if (!allows(path)) return null;
    const at = generation;
    try {
      const token = await bearer();
      if (!token) return null;
      const response = await post(`/functions/v1/${name}`, body, { authorization: `Bearer ${token}` });
      const answer = (await response.json().catch(() => null)) as { status?: string; retryAfter?: unknown } | null;
      return at === generation ? { code: response.status, status: answer?.status, retryAfter: answer?.retryAfter, body: answer } : null;
    } catch {
      return null;
    }
  };

  /** A request straight to Auth with this session's token (outside the Supabase client, so its stored session doesn't change). */
  const authRequest = async (method: 'PUT' | 'POST', path: string, body: unknown, token?: string) => {
    await connect();
    const response = await options.fetch(`${backend.url}/auth/v1${path}`, {
      method,
      headers: {
        apikey: backend.publishableKey,
        [ENVIRONMENT_HEADER]: backend.name,
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    return { ok: response.ok, body: (await response.json().catch(() => null)) as Record<string, unknown> | null };
  };

  /** The answer of a database operation the gate allows on `path`, or null. */
  const operation = async (name: string, args?: Record<string, unknown>, path: AccessPath = 'ordinary'): Promise<unknown> => {
    if (!allows(path)) return null;
    const at = generation;
    try {
      const { data, error } = await (await connect()).rpc(name, args);
      return error || at !== generation ? null : data;
    } catch {
      return null;
    }
  };

  /** The account's methods as the server lists them, or null. */
  const parseMethods = (data: unknown): SignInMethodEntry[] | null => {
    if (!Array.isArray(data)) return null;
    return (data as { id?: unknown; provider?: unknown; email?: unknown }[]).flatMap((identity) => {
      const method = methodOf(identity.provider);
      return method && typeof identity.id === 'string' ? [{ id: identity.id, method, email: typeof identity.email === 'string' ? identity.email : null }] : [];
    });
  };

  /** Which of Apple, Google and the email code an Auth provider name is. */
  const methodOf = (provider: unknown): SignInMethod | null => {
    if (provider === 'email') return 'email';
    for (const candidate of ['apple', 'google'] as const) if (authName(candidate) === provider) return candidate;
    return null;
  };

  /** An email change under way: its two addresses, and which of them has confirmed. Memory only. */
  let emailChange: { readonly current: string; readonly new: string; currentConfirmed: boolean; newConfirmed: boolean } | null = null;

  const sendCode = async ({ email, intent }: { readonly email: string; readonly intent: CodeIntent }): Promise<CodeRequestResult> => {
    const held = currentAssertion();
    if (intent === 'create' && !held) return { status: 'age-required' };
    try {
      const response = await post('/functions/v1/request-code', { email, intent, ...(intent === 'create' && held ? { assertion: held.token } : {}) });
      const body = (await response.json().catch(() => null)) as { status?: string; retryAfter?: unknown } | null;
      if (response.ok && body?.status === 'sent') return { status: 'sent' };
      if (response.status === 429 && typeof body?.retryAfter === 'number') return { status: 'rate-limited', retryAfterSeconds: body.retryAfter };
      if (response.status === 403 && body?.status === 'age-required') {
        assertion = null;
        return { status: 'age-required' };
      }
      return { status: 'failed' };
    } catch {
      return { status: 'failed' };
    }
  };

  /**
   * An ID token for one of the provider's identities, for a function acting
   * for the player: minted for a nonce the server issued to this session for
   * this proof alone, so no earlier sign-in's token can stand in for it.
   */
  const providerProof = async (provider: IdentityProvider) => {
    const nonce = await operation('issue_proof_nonce_v1', undefined, 'restricted');
    if (typeof nonce !== 'string') return 'failed' as const;
    const credential = await obtainCredential(provider, nonce);
    return typeof credential === 'string' ? credential : { provider: authName(provider), idToken: credential.idToken, nonce: credential.nonce };
  };

  // On the restricted paths too: an age-restricted account confirms before it exports.
  const freshAuthentication: FreshAuthentication = {
    async methods() {
      const data = await operation('fresh_authentication_methods_v1', undefined, 'restricted');
      return parseMethods(data);
    },
    async withProvider(provider) {
      if (!opensRestrictedPaths(gate)) return { status: 'failed' };
      try {
        const proof = await providerProof(provider);
        if (typeof proof === 'string') return { status: proof };
        const answer = await actAsPlayer('fresh-auth', { method: 'provider', ...proof }, 'restricted');
        if (answer?.code === 200 && answer.status === 'confirmed') return { status: 'confirmed' };
        if (answer?.code === 403 && answer.status === 'not-a-method') return { status: 'not-a-method' };
        return { status: 'failed' };
      } catch {
        return { status: 'failed' };
      }
    },
    async requestCode() {
      const caller = (await operation('caller_session_v1', undefined, 'restricted')) as { email?: unknown } | null;
      return typeof caller?.email === 'string' ? sendCode({ email: caller.email, intent: 'sign-in' }) : { status: 'failed' };
    },
    async withCode(code) {
      const answer = await actAsPlayer('fresh-auth', { method: 'email', code: code.trim() }, 'restricted');
      if (answer?.code === 200 && answer.status === 'confirmed') return { status: 'confirmed' };
      if (answer?.code === 401 && answer.status === 'invalid-code') return { status: 'invalid-code' };
      return { status: 'failed' };
    },
  };

  const linkAnswer = (answer: Awaited<ReturnType<typeof actAsPlayer>>): Extract<LinkResult, { status: 'linked' | 'already-linked' | 'conflict' | 'fresh-authentication-required' }> | null => {
    const status = answer?.status;
    if (answer?.code === 200 && (status === 'linked' || status === 'already-linked')) return { status };
    if (answer?.code === 409 && status === 'conflict') return { status };
    if (answer?.code === 403 && status === 'fresh-authentication-required') return { status };
    return null;
  };

  const signInMethods: SignInMethods = {
    async list() {
      return parseMethods(await operation('sign_in_methods_v1'));
    },
    async link(provider) {
      if (!isSignedIn(gate)) return { status: 'failed' };
      try {
        const proof = await providerProof(provider);
        if (typeof proof === 'string') return { status: proof };
        return linkAnswer(await actAsPlayer('link-method', { method: 'provider', ...proof })) ?? { status: 'failed' };
      } catch {
        return { status: 'failed' };
      }
    },
    async requestEmailMethodCode() {
      const answer = await actAsPlayer('link-method', { method: 'email', step: 'send' });
      if (answer?.code === 200 && answer.status === 'sent') return { status: 'sent' };
      if (answer?.code === 429 && typeof answer.retryAfter === 'number') return { status: 'rate-limited', retryAfterSeconds: answer.retryAfter };
      if (answer?.code === 403 && answer.status === 'fresh-authentication-required') return { status: answer.status };
      return { status: 'failed' };
    },
    async confirmEmailMethod(code) {
      const answer = await actAsPlayer('link-method', { method: 'email', code: code.trim() });
      if (answer?.code === 401 && answer.status === 'invalid-code') return { status: 'invalid-code' };
      const linked = linkAnswer(answer);
      return linked?.status === 'conflict' || !linked ? { status: 'failed' } : linked;
    },
    async remove(id) {
      const status = ((await operation('remove_sign_in_method_v1', { identity: id })) as { status?: unknown } | null)?.status;
      return status === 'removed' || status === 'last-method' || status === 'confirm-with-another-method' || status === 'fresh-authentication-required'
        ? { status }
        : { status: 'failed' };
    },
    async changeEmail(email) {
      const address = email.trim();
      const at = generation;
      const status = ((await operation('authorize_email_change_v1', { new_email: address })) as { status?: unknown } | null)?.status;
      if (status === 'fresh-authentication-required' || status === 'same-address' || status === 'invalid') return { status };
      if (status !== 'authorized') return { status: 'failed' };
      try {
        const token = await bearer();
        if (!token) return { status: 'failed' };
        // Auth emails both addresses through the send-email hook.
        const { ok, body } = await authRequest('PUT', '/user', { email: address }, token);
        if (at !== generation) return { status: 'failed' };
        if (!ok) return { status: body?.error_code === 'email_exists' ? 'in-use' : 'failed' };
        const current = typeof body?.email === 'string' ? body.email : null;
        if (!current) return { status: 'failed' };
        emailChange = { current, new: address, currentConfirmed: false, newConfirmed: false };
        return { status: 'codes-sent' };
      } catch {
        return { status: 'failed' };
      }
    },
    async confirmEmailChange({ currentCode, newCode }) {
      const change = emailChange;
      if (!change || !isSignedIn(gate)) return { status: 'failed' };
      try {
        for (const [address, email, code] of [
          ['current', change.current, currentCode],
          ['new', change.new, newCode],
        ] as const) {
          const confirmed = address === 'current' ? 'currentConfirmed' : 'newConfirmed';
          if (change[confirmed]) continue;
          const { ok, body } = await authRequest('POST', '/verify', { type: 'email_change', email, token: code.trim() });
          if (!ok) return body?.error_code === 'otp_expired' ? { status: 'invalid-code', address } : { status: 'failed' };
          change[confirmed] = true;
          // Confirming the second address signs in as well: that session is ended at once, so only this device's own stays.
          if (typeof body?.access_token === 'string') await authRequest('POST', '/logout?scope=local', {}, body.access_token);
        }
        emailChange = null;
        return { status: 'changed' };
      } catch {
        return { status: 'failed' };
      }
    },
  };

  /** Signs another device, or every other device, out (revoke-devices). */
  const revokeDevices = async (body: { readonly device: string } | { readonly others: true }): Promise<DeviceSignOutResult> => {
    const answer = await actAsPlayer('revoke-devices', body);
    if (answer?.code === 200 && answer.status === 'signed-out') {
      const { devices: count, email } = answer.body ?? {};
      return { status: 'signed-out', devices: typeof count === 'number' ? count : 0, email: typeof email === 'string' ? email : null };
    }
    if (answer?.code === 403 && answer.status === 'fresh-authentication-required') return { status: answer.status };
    if (answer?.code === 404 && answer.status === 'not-found') return { status: answer.status };
    return { status: 'failed' };
  };

  const devices: Devices = {
    async list() {
      const data = await operation('devices_v1');
      if (!Array.isArray(data)) return null;
      return (data as { id?: unknown; platform?: unknown; label?: unknown; last_active_at?: unknown; this_device?: unknown }[]).flatMap((entry) => {
        if (typeof entry.id !== 'string') return [];
        const lastActiveAt = typeof entry.last_active_at === 'string' ? Date.parse(entry.last_active_at) : Number.NaN;
        return [
          {
            id: entry.id,
            platform: entry.platform === 'ios' || entry.platform === 'android' ? entry.platform : null,
            label: typeof entry.label === 'string' ? entry.label : null,
            lastActiveAt: Number.isFinite(lastActiveAt) ? lastActiveAt : null,
            thisDevice: entry.this_device === true,
          },
        ];
      });
    },
    signOut: (id) => revokeDevices({ device: id }),
    signOutOthers: () => revokeDevices({ others: true }),
  };

  const service: AccountService = {
    get gate() {
      return gate;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    onAccountSessionEnding(handler) {
      accountSessionEnding.add(handler);
      return () => accountSessionEnding.delete(handler);
    },

    platformAgeCheck: ageSignals.supported,

    async checkAge() {
      if (gate.state === 'no-account') {
        assertion = null;
        declarationBlocked = false;
        const signal = await ageSignals.check({ interactive: true }).catch(() => UNAVAILABLE);
        if (requiredCheck(signal)) {
          declarationBlocked = true;
          return { status: 'unresolved' };
        }
        if (signal.kind !== 'range') return { status: 'question' };
        if (signal.range === 'under-13') {
          // Under 13 ends here: nothing is sent, and nothing is kept, not even who a provider said they were.
          heldCredential = null;
          return { status: 'ineligible' };
        }
        return obtainAssertion(signal.range, 'platform-signal');
      }
      const current = opened;
      if (gate.state !== 'age-unresolved' || !current) return { status: 'failed' };
      const signal = await ageSignals.check({ interactive: true }).catch(() => UNAVAILABLE);
      if (opened !== current) return { status: 'failed' };
      await rememberEligibility(current, afterSignal(current.remembered, signal));
      if (await canAskServer(current, { renew: true })) await reportSignal(current);
      // The platform proved nothing: the record stands, and the question may decide only if nothing sufficient is on it.
      if (gate.state === 'age-unresolved' && declarationPermitted(current.remembered.eligibility, current.remembered.check ?? null)) return { status: 'question' };
      return retryOutcome();
    },

    async answerAgeQuestion(range) {
      const current = opened;
      if (gate.state === 'age-unresolved' && current) {
        if (!declarationPermitted(current.remembered.eligibility, current.remembered.check ?? null)) return { status: 'unresolved' };
        if (!(await canAskServer(current, { renew: true })) || !(await report(current, { status: range, source: 'declaration' }))) return { status: 'failed' };
        return retryOutcome();
      }
      assertion = null;
      if (declarationBlocked) return { status: 'unresolved' };
      if (range === 'under-13') {
        // Nothing about an under-13 player is kept, not even who a provider said they were.
        heldCredential = null;
        return { status: 'ineligible' };
      }
      return obtainAssertion(range, 'declaration');
    },

    refreshEligibility,

    requestEmailCode: sendCode,

    async verifyEmailCode({ email, code }) {
      try {
        const supabase = await connect();
        const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
        if (error) return { status: error.code === 'otp_expired' ? 'invalid-code' : 'failed' };
        return (await finishSignIn(supabase)) ? { status: 'signed-in' } : { status: 'failed' };
      } catch {
        return { status: 'failed' };
      }
    },

    async signInAsReviewer({ email, credential }) {
      try {
        const response = await post('/functions/v1/reviewer-sign-in', { email, credential });
        const body = (await response.json().catch(() => null)) as { status?: string; session?: { access_token?: unknown; refresh_token?: unknown } } | null;
        if (response.status === 401 && body?.status === 'refused') return { status: 'refused' };
        const session = body?.session;
        if (!response.ok || typeof session?.access_token !== 'string' || typeof session.refresh_token !== 'string') return { status: 'failed' };
        const supabase = await connect();
        const { error } = await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
        if (error) return { status: 'failed' };
        return (await finishSignIn(supabase)) ? { status: 'signed-in' } : { status: 'failed' };
      } catch {
        return { status: 'failed' };
      }
    },

    async signInWithProvider(provider) {
      heldCredential = null;
      try {
        const credential = await obtainCredential(provider);
        if (typeof credential === 'string') return { status: credential };
        const supabase = await connect();
        const outcome = await signInWithIdToken(supabase, credential);
        if (outcome === 'no-account') {
          heldCredential = { ...credential, until: options.clock() + HELD_CREDENTIAL_MS };
          return { status: 'no-account' };
        }
        if (outcome === 'failed') return { status: 'failed' };
        return (await finishSignIn(supabase)) ? { status: 'signed-in' } : { status: 'failed' };
      } catch {
        return { status: 'failed' };
      }
    },

    async createWithProvider(provider, { sameIdentity = false } = {}) {
      const kept = sameIdentity && heldCredential?.provider === provider && heldCredential.until > options.clock() ? heldCredential : null;
      heldCredential = null;
      const ageAssertion = currentAssertion();
      if (!ageAssertion) return { status: 'age-required' };
      try {
        let credential = kept ?? (await obtainCredential(provider));
        if (typeof credential === 'string') return { status: credential };
        let bound = await bindAssertion(credential, ageAssertion);
        // The token Sign in found has expired since: ask the provider again, once.
        if (bound === 'invalid-token' && kept) {
          credential = await obtainCredential(provider);
          if (typeof credential === 'string') return { status: credential };
          bound = await bindAssertion(credential, ageAssertion);
        }
        if (bound === 'age-required') {
          assertion = null;
          return { status: 'age-required' };
        }
        if (bound !== 'bound' && bound !== 'existing') return { status: 'failed' };
        const supabase = await connect();
        const signedIn = await signInWithIdToken(supabase, credential);
        if (signedIn === 'no-account') {
          // The assertion ran out between binding and Auth creating the user.
          assertion = null;
          return { status: 'age-required' };
        }
        if (signedIn === 'failed') return { status: 'failed' };
        // Whether Auth made a user with this assertion, or returned one that already
        // existed (verified same-email linking): the server knows, never an email comparison.
        const created = (await supabase.rpc('account_created_by', { assertion: ageAssertion.token })).data === true;
        if (!(await finishSignIn(supabase))) return { status: 'failed' };
        return { status: created ? 'created' : 'signed-in' };
      } catch {
        return { status: 'failed' };
      }
    },

    async resume() {
      if (gate.state === 'signed-out' || gate.state === 'revoked') return { status: 'signed-out' };
      if (gate.state !== 'no-account') return { status: 'resumed' };
      // Removes a retired environment's namespace before reading any credentials.
      await connect();
      const remembered = await readRemembered();
      if (remembered?.signedOut) {
        const { accountId, revoked } = remembered;
        setGate(revoked ? { state: 'revoked', accountId, revokedAt: revoked.at, by: revoked.by } : { state: 'signed-out', accountId });
        return { status: 'signed-out' };
      }
      // Read straight from storage: Supabase's own read would try to renew an
      // expired token over the network, retrying for half a minute offline.
      const session = await storedSession();
      if (!remembered || !session) return { status: 'no-account' };
      await openAccount(remembered, session.expires_at * 1000 <= options.clock());
      // Signals refresh when online; offline the remembered state stands, with no deadline.
      if (options.device.foreground.current() && options.device.online.current()) void refreshEligibility().catch(() => undefined);
      return { status: 'resumed' };
    },

    async renew() {
      if (opened) await renewSession(opened);
    },

    signOut() {
      // A second tap while signing out joins the first.
      if (signingOut) return signingOut;
      if (!isSignedIn(gate) && !isAgeRestricted(gate)) return Promise.resolve({ status: 'not-signed-in' });
      const { accountId } = gate;
      signingOut = (async (): Promise<SignOutResult> => {
        // An open practice session suspends while the database is still open.
        for (const handler of [...accountSessionEnding]) await handler().catch(() => undefined);
        const session = await storedSession();
        await closeAccountSession(accountId);
        setGate({ state: 'signed-out', accountId });
        // Locally signed out already; the server learns only if it can be reached.
        return { status: 'signed-out', serverSessionEnded: session ? await endServerSession(session) : false };
      })().finally(() => {
        signingOut = null;
      });
      return signingOut;
    },

    async accountSummary() {
      if (!isSignedIn(gate)) return null;
      const at = generation;
      let summary = await localSummary();
      try {
        const supabase = await connect();
        const { data, error } = await supabase.rpc('account_summary_v1');
        const answer = parseSummary(error ? null : data);
        if (answer && at === generation) {
          summary = answer;
          await rememberCurrency(at, answer.currency);
        }
      } catch {
        // Offline: what this installation already knows.
      }
      return at === generation && isSignedIn(gate) ? summary : null;
    },

    async setAccountCurrency(currency) {
      if (!isSignedIn(gate) || !isCurrency(currency)) return { status: 'failed' };
      const at = generation;
      try {
        const supabase = await connect();
        const { data, error } = await supabase.rpc('set_account_currency_v1', { new_currency: currency });
        const status = (data as { status?: unknown } | null)?.status;
        if (error || (status !== 'changed' && status !== 'locked')) return { status: 'failed' };
        if (status === 'changed') await rememberCurrency(at, currency);
        return { status };
      } catch {
        return { status: 'failed' };
      }
    },

    sync: {
      get status() {
        return syncStatus();
      },
      subscribe(listener) {
        syncListeners.add(listener);
        return () => syncListeners.delete(listener);
      },
      reconcile: () => sync?.engine.reconcile('deliberate') ?? Promise.resolve(),
      retryRecord: (id) => sync?.engine.retryRecord(id) ?? Promise.resolve(),
      downloadAllHistory: () => sync?.engine.downloadAllHistory() ?? Promise.resolve(),
      idle: () => sync?.engine.idle() ?? Promise.resolve(),
      async queue(recordType, payload) {
        const store = sync?.store;
        if (!store) return { status: 'refused', reason: 'no-account' };
        const type = registry.get(recordType);
        if (!type) return { status: 'refused', reason: 'unknown-type' };
        if (type.kind === 'server-authored-state') return { status: 'refused', reason: 'server-authored' };
        if (!type.isPayload(payload)) return { status: 'refused', reason: 'invalid-payload' };
        if (type.onlineOnly?.(payload)) return { status: 'refused', reason: 'online-only' };
        const queued = await store.queueUpload({
          id: `${type.name}/${hex(options.randomBytes(16))}`,
          recordType: type.name,
          item: type.identity.of(payload),
          payload,
          dependencies: prerequisitesOf(registry, type, payload, await store.readUploadQueue()),
          positioned: type.ordering === 'per-device',
          purges: type.purges?.(payload) ?? null,
        });
        return { status: 'queued', id: queued.id, ...(queued.position !== undefined ? { position: queued.position } : {}) };
      },
      async countWaiting() {
        try {
          return (await sync?.store.readUploadQueue())?.length ?? 0;
        } catch {
          // The account session ended while counting.
          return 0;
        }
      },
    },

    records: accountRecords(() => sync, registry),
    privacy: accountPrivacy({
      session: () => sync,
      queue: (recordType, payload) => service.sync.queue(recordType, payload),
      gate: () => gate,
      newChoiceId: () => hex(options.randomBytes(16)),
    }),
    freshAuthentication,
    signInMethods,
    devices,
    export: accountExport({
      operation: (name) => operation(name, undefined, 'restricted'),
      async download(path) {
        if (!opensRestrictedPaths(gate)) return null;
        const at = generation;
        try {
          const token = await bearer();
          if (!token) return null;
          // The bucket's storage policy authorizes it against live state; the path is the account's own object.
          const response = await options.fetch(`${backend.url}/storage/v1/object/authenticated/account-exports/${path.split('/').map(encodeURIComponent).join('/')}`, {
            headers: { apikey: backend.publishableKey, [ENVIRONMENT_HEADER]: backend.name, authorization: `Bearer ${token}` },
          });
          if (at === generation) return response;
          await response.body?.cancel();
          return null;
        } catch {
          return null;
        }
      },
      openStore: () =>
        opened && opensRestrictedPaths(gate)
          ? { accountId: gate.accountId, installationId: opened.session.installationId, store: opened.session.store }
          : null,
      registry,
      clock: options.clock,
    }),
  };
  return service;
}

function isSignInMethod(provider: string | undefined): provider is SignInMethod {
  return typeof provider === 'string' && SIGN_IN_METHODS.includes(provider);
}

function isCurrency(value: unknown): value is string {
  return typeof value === 'string' && CURRENCY_PATTERN.test(value);
}

/** The server's account summary, or null when it isn't one. */
function parseSummary(data: unknown): AccountSummary | null {
  const value = data as { email?: unknown; methods?: unknown; currency?: unknown; currency_changeable?: unknown; devices?: unknown } | null;
  if (!value || !isCurrency(value.currency) || !Array.isArray(value.methods) || typeof value.currency_changeable !== 'boolean' || typeof value.devices !== 'number') {
    return null;
  }
  return {
    email: typeof value.email === 'string' ? value.email : null,
    methods: (value.methods as unknown[]).filter((method): method is SignInMethod => typeof method === 'string' && isSignInMethod(method)),
    currency: value.currency,
    currencyChangeable: value.currency_changeable,
    devices: value.devices,
  };
}

function parseJson(text: string | null): unknown {
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** A query string, without the leading "?". (Hermes has no full URL implementation, so URLs are built by hand.) */
function queryString(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
    .join('&');
}

function parseQuery(query: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const [name = '', value = ''] = pair.split('=', 2);
    try {
      out[decodeURIComponent(name.replace(/\+/g, ' '))] = decodeURIComponent(value.replace(/\+/g, ' '));
    } catch {
      // A malformed pair says nothing.
    }
  }
  return out;
}

function parseRemembered(text: string | null): RememberedAccount | null {
  const value = parseJson(text) as
    | {
        accountId?: unknown;
        eligibility?: unknown;
        check?: unknown;
        signal?: unknown;
        reported?: unknown;
        currency?: unknown;
        signedOut?: unknown;
        revoked?: { at?: unknown; by?: unknown };
      }
    | null;
  if (!value || typeof value.accountId !== 'string') return null;
  // Remembered before #90 as the bare band, which was always declared.
  const eligibility = parseEligibilityRecord(typeof value.eligibility === 'string' ? { eligibility: value.eligibility } : value.eligibility);
  if (!eligibility) return null;
  return {
    accountId: value.accountId,
    eligibility,
    ...(isRequiredCheck(value.check) ? { check: value.check } : {}),
    ...(isAgeRange(value.signal) ? { signal: value.signal } : {}),
    ...(isAgeRange(value.reported) ? { reported: value.reported } : {}),
    currency: isCurrency(value.currency) ? value.currency : null,
    signedOut: value.signedOut === true,
    ...(value.signedOut === true && typeof value.revoked?.at === 'number'
      ? { revoked: { at: value.revoked.at, by: value.revoked.by === 'provider' ? ('provider' as const) : ('device' as const) } }
      : {}),
  };
}

const isAgeRange = (value: unknown): value is AgeRange => value === 'under-13' || (typeof value === 'string' && isEligibleBand(value));

/** Four random bytes as a uniform number in [0, 1). */
const uniform = (bytes: Uint8Array): number => (((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0) / 2 ** 32;

const hex = (bytes: Uint8Array): string => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

/** Erases what each environment this build retires left on the device: its credentials, then its vault namespace. */
async function removeRetiredEnvironments({ backend, credentials, vault }: AccountServiceOptions): Promise<void> {
  for (const retired of retiredEnvironments(backend.name)) {
    await removeCredentials(credentials, retired);
    await vault.removeEnvironment(retired);
  }
}

/** Where Auth keeps an environment's credentials in secure storage: every entry's name starts with it. */
const credentialsKey = (environment: EnvironmentName) => `tableside.${environment}.auth`;
/** The current session's status credential (lifecycle_status_v1), with the account it is for. */
const statusKey = (environment: EnvironmentName) => `tableside.${environment}.status`;
/** An installation's secret for an account, kept across sign-outs: it proves the installation when a later session registers. */
const installationSecretKey = (environment: EnvironmentName, installationId: string, accountId: string) =>
  `tableside.${environment}.${installationId}.${accountId}.device`;
/** The list of credential entries an environment has written, so they can all be removed. */
const credentialsIndex = (environment: EnvironmentName) => `tableside.${environment}.credentials`;

/**
 * An environment's credentials. Secure storage can't list its entries, so each
 * entry's name is recorded before the entry is written, and removing the
 * environment's credentials removes every recorded entry.
 */
function namespacedCredentials(storage: CredentialStorage, environment: EnvironmentName): CredentialStorage {
  const index = credentialsIndex(environment);
  return {
    getItem: (key) => storage.getItem(key),
    async setItem(key, value) {
      const names = await readIndex(storage, index);
      if (!names.includes(key)) await storage.setItem(index, JSON.stringify([...names, key]));
      await storage.setItem(key, value);
    },
    removeItem: (key) => storage.removeItem(key),
  };
}

async function removeCredentials(storage: CredentialStorage, environment: EnvironmentName): Promise<void> {
  const index = credentialsIndex(environment);
  for (const key of new Set([credentialsKey(environment), ...(await readIndex(storage, index))])) await storage.removeItem(key);
  await storage.removeItem(index);
}

async function readIndex(storage: CredentialStorage, index: string): Promise<string[]> {
  try {
    const names: unknown = JSON.parse((await storage.getItem(index)) ?? '[]');
    return Array.isArray(names) ? names.filter((name): name is string => typeof name === 'string') : [];
  } catch {
    return [];
  }
}
