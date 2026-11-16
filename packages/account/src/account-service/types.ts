// The Account service's public types (spec 2, *Modules*): the account gate,
// the operations' answers, and the ports the app supplies. The service itself
// is composed in ../service.ts from one module per area in this directory.

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
  | { readonly state: 'age-ineligible'; readonly accountId: string }
  /**
   * The server confirmed the account's deletion is scheduled (S2-23): ordinary
   * access is closed and sync stops, but the session, the records and the
   * database stay open for the restricted paths (Cancel deletion, deletion
   * status, export with its local supplement, billing and support help).
   * `deadline` is when it is deleted permanently, in milliseconds since the epoch.
   */
  | { readonly state: 'deletion-scheduled'; readonly accountId: string; readonly deadline: number }
  /**
   * The server confirmed the account was deleted permanently: this
   * installation erased it (its database and key, pending uploads, staged
   * files, credentials and the app's export copies) and keeps nothing of it
   * but the status credential, which reads only the deletion's progress. It
   * stays here until the player is done with it, or signs in (a new account
   * for the same address).
   */
  | { readonly state: 'deleted' };

/** Who revoked a session: another of the account's devices, or the provider of a sign-in method. */
export type RevokedBy = 'device' | 'provider';

/** Gate states that open ordinary access: Renewal pending keeps it, under cached rights, while the token renews. */
export type SignedInGate = Extract<AccountGate, { state: 'active' | 'renewal-pending' }>;

/** Gate states that leave ordinary access open: Renewal pending keeps it, under cached rights, while the token renews. */
export const opensOrdinaryAccess = (gate: AccountGate): gate is SignedInGate =>
  gate.state === 'active' || gate.state === 'renewal-pending';

/**
 * Gate states the restricted paths work in (fresh authentication, export;
 * deletion, support and billing help): ordinary access, an account whose age
 * eligibility isn't established, or one whose deletion is scheduled
 * (Amendment 1 B2: Cancel deletion, status and export stay). The one client
 * seam for who reaches them.
 */
export const opensRestrictedPaths = (
  gate: AccountGate,
): gate is Extract<AccountGate, { state: 'active' | 'renewal-pending' | 'age-unresolved' | 'age-ineligible' | 'deletion-scheduled' }> =>
  opensOrdinaryAccess(gate) || isRestricted(gate);

/**
 * Restricted gate states: ordinary access is closed, but the account's
 * database stays open for the restricted paths. The age states and Deletion scheduled.
 */
export function isRestricted(gate: AccountGate): gate is Extract<AccountGate, { state: 'age-unresolved' | 'age-ineligible' | 'deletion-scheduled' }> {
  return isAgeRestricted(gate) || gate.state === 'deletion-scheduled';
}

/** Which gate states a call needs: ordinary access, or the restricted paths (opensRestrictedPaths). */
export type AccessPath = 'ordinary' | 'restricted';

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
  /** 'web': a browser signed in to the web account page (#106). */
  readonly platform: 'ios' | 'android' | 'web' | null;
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

/**
 * Schedule deletion's answer. 'failed' is an unknown outcome (no answer
 * came): asking again reports what happened, never a second scheduling.
 */
export type ScheduleDeletionResult =
  | { readonly status: 'scheduled'; readonly deadline: number }
  | NeedsFresh
  /** Deletion needs a connection: there is no offline queue. */
  | { readonly status: 'offline' }
  | { readonly status: 'failed' };

export type CancelDeletionResult =
  /** The same account is active again, with its records. */
  | { readonly status: 'canceled' }
  /** The deadline has passed: permanent deletion can't be undone. */
  | { readonly status: 'too-late' }
  | NeedsFresh
  | { readonly status: 'offline' }
  | { readonly status: 'failed' };

/** Deletion status, as the server reports it: scheduled with its deadline, or the permanent deletion's progress. */
export type DeletionStatus =
  | { readonly status: 'none' }
  | { readonly status: 'scheduled'; readonly deadline: number; readonly scheduledAt: number }
  | DeletionProgress;

/**
 * A permanent deletion's progress (#104), apart from any deadline: active
 * cleanup is processing or completed; `delayed` when it is past its seven
 * days (`cleanupBy`) or a step is waiting to be retried. The analytics
 * provider's erasure is reported apart: requested, and completed only once
 * the provider said so. `providers` is how the Apple and Google grants were
 * dealt with (null until then; 'not-held' when Tableside had no token to
 * revoke one with). Backup aging is outside active cleanup and is never
 * reported here as complete. Times are milliseconds since the epoch.
 */
export interface DeletionProgress {
  readonly status: 'processing' | 'completed';
  readonly deletedAt: number;
  readonly cleanupBy: number;
  readonly completedAt: number | null;
  readonly delayed: boolean;
  readonly analytics: { readonly requestedAt: number | null; readonly completedAt: number | null };
  readonly providers: 'revoked' | 'not-held' | 'none' | null;
}

/**
 * Delete permanently now's answer. 'deleted': the boundary is crossed and this
 * installation erased the account (the gate is Deleted). 'failed' is an
 * unknown outcome: the server's lifecycle status decides, so asking again
 * never deletes twice and a lost answer still erases once the server says so.
 */
export type DeletePermanentlyResult =
  | { readonly status: 'deleted' }
  | NeedsFresh
  | { readonly status: 'offline' }
  | { readonly status: 'failed' };

/** Delete account (S2-22) and the deletion-scheduled restricted paths (S2-23). Every action needs Confirm it's you. */
export interface AccountDeletion {
  /** Schedules deletion with a 30-day undo; the gate becomes Deletion scheduled. */
  schedule(): Promise<ScheduleDeletionResult>;
  /** Cancels a scheduled deletion; the gate reopens the same account. */
  cancel(): Promise<CancelDeletionResult>;
  /**
   * Delete permanently now (#104): crosses the irreversible boundary, from an
   * open account or one whose deletion is scheduled. Online only. This
   * installation then erases the account, and the gate becomes Deleted.
   */
  deletePermanently(): Promise<DeletePermanentlyResult>;
  /** Deletion status, or null when it can't be asked. While Deleted, the permanent deletion's progress. */
  status(): Promise<DeletionStatus | null>;
  /** Done with Deleted: forgets the status credential, and the gate becomes No account. */
  dismiss(): Promise<void>;
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
  | { readonly status: 'canceled' }
  | { readonly status: 'failed' };

export type ProviderCreateResult =
  /** A new, empty account for this identity. */
  | { readonly status: 'created' }
  /** The identity already had an account (Auth returned it), so this signed in to it; nothing was created. */
  | { readonly status: 'signed-in' }
  /** No current age answer: run the age step first. */
  | { readonly status: 'age-required' }
  | { readonly status: 'canceled' }
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
  | { readonly status: 'canceled' }
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
export type NeedsFresh = { readonly status: 'fresh-authentication-required' };

export type LinkResult =
  | { readonly status: 'linked' | 'already-linked' }
  /** Another account signs in with this identity: nothing changed, and accounts are never merged. */
  | { readonly status: 'conflict' }
  | NeedsFresh
  | { readonly status: 'canceled' | 'failed' };

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

/**
 * What a provider's native sheet answered: an ID token whose nonce claim is
 * the hashed nonce it was given, and the authorization code it gave the app
 * when it gives one (Sign in with Apple does; Google's native ID-token sign-in
 * doesn't). The code is exchanged on the server for the grant that permanent
 * deletion revokes.
 */
export type ProviderToken =
  | { readonly status: 'token'; readonly idToken: string; readonly authorizationCode?: string }
  | { readonly status: 'canceled' }
  | { readonly status: 'failed' };

/** What the system browser's sign-in session ended with: the app's callback URL, or the player closing it. */
export type AuthSessionResult = { readonly status: 'returned'; readonly url: string } | { readonly status: 'canceled' };

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
  open(accountId: string): Promise<AccountVaultOpening>;
  close(): Promise<void>;
  /**
   * Erases the account's database on this installation, after the server
   * confirmed its permanent deletion: the database (its pending uploads and
   * staged files with it), its sidecars and backups, and its key. Closes it
   * first if it is open. Never touches another account's.
   */
  erase(accountId: string): Promise<void>;
  /** Removes every database, key and installation identity another environment left on this device. */
  removeEnvironment(environment: EnvironmentName): Promise<void>;
  /**
   * Recovery needed's way on: gives the account a new, empty database under a
   * new installation of its own, for its synced history to be restored into,
   * and keeps the unreadable original exactly as it was (never overwritten,
   * moved or deleted). The next open opens the new database.
   */
  recover(accountId: string): Promise<void>;
}

/** An account's database, open for the current account session. */
export interface VaultSession {
  readonly installationId: string;
  /** The account's store; it refuses to read or write once the account session has ended. The local supplement reads its unfinished activities. */
  readonly store: SyncStore & UnfinishedActivities;
}

/**
 * Every other outcome opens nothing, so no sync runs: Recovery needed (the key
 * or database is lost or unreadable), a later build's schema (needs-update), a
 * failed migration (retried at the next open), or an opening a later sign-in
 * superseded. The first three are gate states; a superseded opening changes nothing.
 */
export type AccountVaultOpening =
  | { readonly status: 'open'; readonly session: VaultSession }
  | { readonly status: 'recovery-needed' | 'needs-update' | 'migration-failed' | 'superseded' };

export type { DetailResult, HistoryDownload, HistoryStatus };

/** Sync status before an account session opens one. */
export const NO_SYNC: SyncStatus = {
  live: false,
  error: null,
  lastSyncedAt: null,
  uploads: [],
  update: null,
  history: { state: 'complete' },
  download: { state: 'not-requested' },
};

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
   * The player's decision on an unconfirmed record (spec 2, *Compaction and
   * stale devices*): send it again, or set it aside. Any other record is left as it is.
   */
  decideUnconfirmed(id: string, decision: UnconfirmedDecision): Promise<void>;
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
  /**
   * Erases what the app keeps of an account outside the vault and the
   * credentials (its export copies, its offline game choice), when the server
   * confirmed its permanent deletion.
   */
  readonly eraseAppData?: (accountId: string) => Promise<void>;
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
   * sign-out it is Signed out, opening nothing. After the account was deleted
   * it is Deleted (finishing the erase, if a kill interrupted it). Stays at No
   * account when there is none.
   */
  resume(): Promise<{ readonly status: 'resumed' | 'signed-out' | 'deleted' | 'no-account' }>;
  /**
   * Renews an expired token (Renewal pending → Active; a restricted state keeps
   * its state, with its token renewed). A failure keeps Renewal pending, with access and records.
   */
  renew(): Promise<void>;
  /**
   * Recovery needed: restores the account's synced history into a fresh
   * database on this device, keeping the unreadable original's bytes as they
   * are. The fresh database belongs to a new installation, which registers
   * with a new sign-in: this signs out first ('sign-in-needed'), and signing
   * in to the same account (online) opens the fresh database and downloads
   * the synced history into it. Records that hadn't reached the account stay
   * only in the kept original. 'failed' outside Recovery needed.
   */
  recover(): Promise<{ readonly status: 'sign-in-needed' | 'failed' }>;
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
  /** Delete account: schedule with a 30-day undo (#103), cancel, delete permanently now (#104), and status. */
  readonly deletion: AccountDeletion;
}

