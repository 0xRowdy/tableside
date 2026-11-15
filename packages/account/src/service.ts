// The Account service: the one interface the app uses for anything
// account-shaped (spec 2, *Modules*). It exposes the observable account gate
// and hides Supabase, the network and storage from its callers.

import { type SupabaseClient, createClient } from '@supabase/supabase-js';

import { type BackendEnvironment, ENVIRONMENT_HEADER, type EnvironmentName, authCallbackUrl, retiredEnvironments } from './environment';
import { type EngineStatus, SyncEngine } from './sync/engine';
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
  | { readonly state: 'signed-out'; readonly accountId: string };

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
  /** Signed-in devices: the account's server sessions, this one included (each maps to an installation). */
  readonly devices: number | null;
}

export type CurrencyChangeResult = { readonly status: 'changed' } | { readonly status: 'locked' } | { readonly status: 'failed' };


/** The fallback age-range question's answers. */
export type AgeRange = 'under-13' | EligibilityBand;
/** An established 13+ age band: the only bands that open ordinary access. */
export type EligibilityBand = '13-15' | '16-17' | '18+';
const ELIGIBLE_BANDS: readonly string[] = ['13-15', '16-17', '18+'] satisfies EligibilityBand[];

/** Which way a player asks for a code: Sign in (an existing account) or Create (a new one). */
export type CodeIntent = 'sign-in' | 'create';

export type AgeAnswerResult = { readonly status: 'eligible' } | { readonly status: 'ineligible' } | { readonly status: 'failed' };
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
  /** The account's store; it refuses to read or write once the account session has ended. */
  readonly store: SyncStore;
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

/**
 * The first download on a new device (#96): complete, or how far summaries
 * and totals and the last 90 days of detail have come, as fractions from 0 to 1.
 * Until #96 bootstraps a device, its history is complete.
 */
export type HistoryStatus =
  | { readonly state: 'complete' }
  | { readonly state: 'incomplete'; readonly summaries: number; readonly detail: number };

/** What sync status (S2-20) shows: the engine's status, the live connection and the first download. */
export interface SyncStatus extends EngineStatus {
  /** Whether this installation holds the account's live connection (the newest foregrounded one). */
  readonly live: boolean;
  readonly history: HistoryStatus;
}

/**
 * Queueing a record for upload (spec 2, *Record-type registry*): queued, with
 * its originating-device position for a per-device type; or refused, when no
 * account session is open, the type isn't registered or is server-authored
 * (no client writes it), or the payload isn't the type's.
 */
export type QueueResult =
  | { readonly status: 'queued'; readonly id: string; readonly position?: number }
  | { readonly status: 'refused'; readonly reason: 'no-account' | 'unknown-type' | 'server-authored' | 'invalid-payload' };

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
  /** Resolves once no synchronization is running. */
  idle(): Promise<void>;
  /** How many saved records haven't reached the account yet; 0 with no open account session. */
  countWaiting(): Promise<number>;
}

const NO_SYNC: SyncStatus = { live: false, error: null, lastSyncedAt: null, uploads: [], update: null, history: { state: 'complete' } };

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
}

export interface AccountService {
  readonly gate: AccountGate;
  /** Called on every gate change; returns an unsubscribe function. */
  subscribe(listener: (gate: AccountGate) => void): () => void;
  /**
   * The Create path's age step. Under 13 ends here without contacting the
   * server; any other range obtains a short-lived, single-use eligibility
   * assertion for creating the account.
   */
  answerAgeQuestion(range: AgeRange): Promise<AgeAnswerResult>;
  /**
   * Sends a code. Every request sends an email: the code when the address has
   * an account, otherwise a "No account for this address" email. The answer
   * is the same either way. Create needs a current eligibility assertion;
   * sign-in never creates an account.
   */
  requestEmailCode(request: { readonly email: string; readonly intent: CodeIntent }): Promise<CodeRequestResult>;
  /**
   * Signs in with the emailed code. The gate becomes Active only for an
   * active account with an established 13+ band; other eligibility states are
   * #90's restricted gate states, so until then the sign-in fails.
   */
  verifyEmailCode(request: { readonly email: string; readonly code: string }): Promise<CodeVerificationResult>;
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
   * stay), or the state its database is in. After a sign-out it is Signed
   * out, opening nothing. Stays at No account when there is none.
   */
  resume(): Promise<{ readonly status: 'resumed' | 'signed-out' | 'no-account' }>;
  /** Renews an expired token (Renewal pending → Active). A failure keeps Renewal pending, with access and records. */
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
}


/** Where the signed-in account is remembered, in the environment's credentials (so it goes with them). */
const rememberedAccountKey = (environment: EnvironmentName) => `tableside.${environment}.account`;

/**
 * The account this installation is signed in to, with its established band
 * and the currency it last heard of. After a sign-out only this stays: the
 * account whose database is kept here, locked.
 */
interface RememberedAccount {
  readonly accountId: string;
  readonly eligibility: EligibilityBand;
  readonly currency: string | null;
  readonly signedOut: boolean;
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
export const isSignedIn = (gate: AccountGate): gate is SignedInGate => gate.state === 'active' || gate.state === 'renewal-pending';

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
  let gate: AccountGate = { state: 'no-account' };
  let assertion: Assertion | null = null;
  /**
   * The account-session generation: it moves on at every sign-in, sign-out and
   * account switch, and an answer that arrives after it moved touches nothing.
   */
  let generation = 0;
  let signingOut: Promise<SignOutResult> | null = null;

  let sync: { readonly engine: SyncEngine; readonly session: SyncSession; readonly store: SyncStore } | null = null;
  const syncListeners = new Set<(status: SyncStatus) => void>();
  const syncStatus = (): SyncStatus => (sync ? { ...sync.engine.status, live: sync.session.isLive, history: { state: 'complete' } } : NO_SYNC);
  const syncChanged = () => {
    const status = syncStatus();
    for (const listener of syncListeners) listener(status);
  };

  const setGate = (next: AccountGate) => {
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
   * Opens the account's database for a new account session, moves the gate,
   * and starts its sync. Nothing changes when a later sign-in overtook this one.
   */
  const openAccount = async ({ accountId, eligibility }: RememberedAccount, state: 'active' | 'renewal-pending' = 'active') => {
    generation++;
    sync?.session.end();
    sync = null;
    syncChanged();
    const opening = await options.vault.open(accountId);
    if (opening.status === 'superseded') return;
    if (opening.status === 'recovery-needed') return setGate({ state: 'recovery-needed', accountId });
    if (opening.status !== 'open') return setGate({ state: 'database-unavailable', accountId, reason: opening.status });
    setGate({ state, accountId, eligibility });
    const supabase = await connect();
    const { store, installationId } = opening.session;
    const engine = new SyncEngine({
      store,
      backend: supabaseSyncBackend(supabase, retryAfter),
      registry,
      installationId,
      newOperationId: () => hex(options.randomBytes(16)),
      clock: options.clock,
      random: () => uniform(options.randomBytes(4)),
    });
    engine.onChange(syncChanged);
    sync = {
      engine,
      store,
      session: new SyncSession(engine, store, options.device, supabaseLiveChannels(supabase, accountId, retryAfter), options.clock),
    };
  };

  const currentAssertion = () => (assertion && assertion.expiresAt > options.clock() ? assertion : null);

  /**
   * After Auth signed in: opens the account when it is active with an
   * established 13+ band. Other eligibility states are #90's restricted gate
   * states, so until then the sign-in is undone and fails.
   */
  const finishSignIn = async (supabase: SupabaseClient): Promise<boolean> => {
    const { data, error } = await supabase.rpc('current_account');
    const account = data as { account_id: string; eligibility: string | null; currency?: unknown } | null;
    if (error || !account || !isEligible(account.eligibility)) {
      await supabase.auth.signOut({ scope: 'local' });
      return false;
    }
    assertion = null;
    heldCredential = null;
    const remembered: RememberedAccount = {
      accountId: account.account_id,
      eligibility: account.eligibility,
      currency: isCurrency(account.currency) ? account.currency : null,
      signedOut: false,
    };
    await writeCredentials(() => remember(remembered));
    await openAccount(remembered);
    return true;
  };

  /** A Sign in that found no account, kept in memory only so Create can use it without asking the provider again. */
  let heldCredential: (ProviderCredential & { readonly until: number }) | null = null;

  /**
   * Asks the provider who the player is, ending in an ID token minted for a
   * fresh nonce: from the native sheet, or from Apple's web page in the
   * system browser.
   */
  const obtainCredential = async (provider: IdentityProvider): Promise<ProviderCredential | 'cancelled' | 'failed'> => {
    const settings = options.providers;
    const route = settings?.ports.route[provider] ?? 'unavailable';
    if (!settings || route === 'unavailable') return 'failed';
    const { ports } = settings;
    const nonce = hex(options.randomBytes(32));
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

  return {
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

    async answerAgeQuestion(range) {
      assertion = null;
      if (range === 'under-13') {
        // Nothing about an under-13 player is kept, not even who a provider said they were.
        heldCredential = null;
        return { status: 'ineligible' };
      }
      try {
        const supabase = await connect();
        // The device locale's currency rides with the age answer, so whichever way the account is created, it starts with it.
        const { data, error } = await supabase.rpc('issue_eligibility_assertion', { age_range: range, currency: options.localeCurrency() });
        if (error) return { status: 'failed' };
        const issued = data as { assertion: string; expires_at: string };
        assertion = { token: issued.assertion, expiresAt: Date.parse(issued.expires_at) };
        return { status: 'eligible' };
      } catch {
        return { status: 'failed' };
      }
    },

    async requestEmailCode({ email, intent }) {
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
    },

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
      if (gate.state === 'signed-out') return { status: 'signed-out' };
      if (gate.state !== 'no-account') return { status: 'resumed' };
      // Removes a retired environment's namespace before reading any credentials.
      await connect();
      const remembered = await readRemembered();
      if (remembered?.signedOut) {
        setGate({ state: 'signed-out', accountId: remembered.accountId });
        return { status: 'signed-out' };
      }
      // Read straight from storage: Supabase's own read would try to renew an
      // expired token over the network, retrying for half a minute offline.
      const session = await storedSession();
      if (!remembered || !session) return { status: 'no-account' };
      await openAccount(remembered, session.expires_at * 1000 > options.clock() ? 'active' : 'renewal-pending');
      return { status: 'resumed' };
    },

    async renew() {
      if (gate.state !== 'renewal-pending') return;
      const pending = gate;
      const session = await storedSession();
      if (!session) return;
      try {
        // One attempt: a failure leaves Renewal pending to try again later.
        const response = await post('/auth/v1/token?grant_type=refresh_token', { refresh_token: session.refresh_token });
        if (!response.ok) {
          await response.arrayBuffer();
          return;
        }
        const renewed = (await response.json()) as StoredSession;
        const expiresAt = Math.floor(options.clock() / 1000) + renewed.expires_in;
        // A sign-out or another account while this was in flight: touch nothing.
        let applied = false;
        await writeCredentials(async () => {
          if (gate !== pending) return;
          await credentials.setItem(credentialsKey(backend.name), JSON.stringify({ ...renewed, expires_at: expiresAt }));
          applied = true;
        });
        if (!applied || gate !== pending) return;
        setGate({ ...pending, state: 'active' });
        // The live connection re-subscribes with the renewed token, as on Supabase's own refresh.
        sync?.session.credentialsChanged();
      } catch {
        // Offline or the response was lost: still Renewal pending.
      }
    },

    signOut() {
      // A second tap while signing out joins the first.
      if (signingOut) return signingOut;
      if (!isSignedIn(gate)) return Promise.resolve({ status: 'not-signed-in' });
      const { accountId, eligibility } = gate;
      signingOut = (async (): Promise<SignOutResult> => {
        // An open practice session suspends while the database is still open.
        for (const handler of [...accountSessionEnding]) await handler().catch(() => undefined);
        generation++;
        sync?.session.end();
        sync = null;
        await options.vault.close();
        const session = await storedSession();
        await writeCredentials(async () => {
          const remembered = await readRemembered();
          // The lock first: a kill between the two writes still reopens Signed out.
          await remember({ accountId, eligibility, currency: remembered?.currency ?? null, signedOut: true });
          await credentials.removeItem(credentialsKey(backend.name));
        });
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
      idle: () => sync?.engine.idle() ?? Promise.resolve(),
      async queue(recordType, payload) {
        const store = sync?.store;
        if (!store) return { status: 'refused', reason: 'no-account' };
        const type = registry.get(recordType);
        if (!type) return { status: 'refused', reason: 'unknown-type' };
        if (type.kind === 'server-authored-state') return { status: 'refused', reason: 'server-authored' };
        if (!type.isPayload(payload)) return { status: 'refused', reason: 'invalid-payload' };
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
  };
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
  const value = parseJson(text) as { accountId?: unknown; eligibility?: unknown; currency?: unknown; signedOut?: unknown } | null;
  if (value && typeof value.accountId === 'string' && typeof value.eligibility === 'string' && isEligible(value.eligibility)) {
    return {
      accountId: value.accountId,
      eligibility: value.eligibility,
      currency: isCurrency(value.currency) ? value.currency : null,
      signedOut: value.signedOut === true,
    };
  }
  return null;
}

/** Four random bytes as a uniform number in [0, 1). */
const uniform = (bytes: Uint8Array): number => (((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0) / 2 ** 32;

const hex = (bytes: Uint8Array): string => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

function isEligible(band: string | null | undefined): band is EligibilityBand {
  return typeof band === 'string' && ELIGIBLE_BANDS.includes(band);
}

/** Erases what each environment this build retires left on the device: its credentials, then its vault namespace. */
async function removeRetiredEnvironments({ backend, credentials, vault }: AccountServiceOptions): Promise<void> {
  for (const retired of retiredEnvironments(backend.name)) {
    await removeCredentials(credentials, retired);
    await vault.removeEnvironment(retired);
  }
}

/** Where Auth keeps an environment's credentials in secure storage: every entry's name starts with it. */
const credentialsKey = (environment: EnvironmentName) => `tableside.${environment}.auth`;
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
