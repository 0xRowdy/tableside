// The Account service: the one interface the app uses for anything
// account-shaped (spec 2, *Modules*). It exposes the observable account gate
// and hides Supabase, the network and storage from its callers.

import { type SupabaseClient, createClient } from '@supabase/supabase-js';

import { type BackendEnvironment, ENVIRONMENT_HEADER, type EnvironmentName, retiredEnvironments } from './environment';
import { SyncEngine, type SyncErrorCode } from './sync/engine';
import { type AccountRecords, accountRecords } from './sync/records';
import { type RecordType, recordTypes } from './sync/registry';
import { type DevicePorts, SyncSession } from './sync/session';
import type { SyncStore } from './sync/store';
import { supabaseLiveChannels, supabaseSyncBackend } from './sync/supabase';

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
  | { readonly state: 'database-unavailable'; readonly accountId: string; readonly reason: 'needs-update' | 'migration-failed' };


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

export interface SyncStatus {
  /** Whether this installation holds the account's live connection (the newest foregrounded one). */
  readonly live: boolean;
  /** How the last synchronization run ended, if on an error. */
  readonly error: SyncErrorCode | null;
}

/** Synchronization for the open account session. Triggers run it by themselves; these are for asking. */
export interface AccountSync {
  readonly status: SyncStatus;
  /** Uploads and fetches now; resolves when that has finished. Coalesces with work already going. */
  reconcile(): Promise<void>;
  /** Resolves once no synchronization is running. */
  idle(): Promise<void>;
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
  /** The device's WebSocket, for the live connection. */
  readonly webSocket?: typeof WebSocket;
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
   * The app starting again: reopens the account this installation was signed
   * in to from its stored credentials, without the network. The gate becomes
   * Active, or Renewal pending when its token has expired (access and records
   * stay), or the state its database is in. Stays at No account when there is none.
   */
  resume(): Promise<{ readonly status: 'resumed' | 'no-account' }>;
  /** Renews an expired token (Renewal pending → Active). A failure keeps Renewal pending, with access and records. */
  renew(): Promise<void>;
  readonly sync: AccountSync;
  /** Revisioned items, their conflicts, and lifetime totals for the open account. */
  readonly records: AccountRecords;
}

/** Where the signed-in account is remembered, in the environment's credentials (so it goes with them). */
const rememberedAccountKey = (environment: EnvironmentName) => `tableside.${environment}.account`;

/** The account this installation is signed in to, with its established band. */
interface RememberedAccount {
  readonly accountId: string;
  readonly eligibility: EligibilityBand;
}

interface Assertion {
  readonly token: string;
  readonly expiresAt: number;
}

/** Supabase's stored session: what resuming and renewal read and write. */
interface StoredSession {
  readonly access_token: string;
  readonly refresh_token: string;
  /** Seconds since the epoch. */
  readonly expires_at: number;
  readonly expires_in: number;
}

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
  const connect = (): Promise<SupabaseClient> =>
    (client ??= (async () => {
      await removeRetiredEnvironments(options);
      const created = createClient(backend.url, backend.publishableKey, {
        global: { fetch: options.fetch, headers: { [ENVIRONMENT_HEADER]: backend.name } },
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
  /** A JSON request to the backend outside the Supabase client, naming this environment like every other. */
  const post = async (path: string, body: unknown): Promise<Response> => {
    await connect();
    return options.fetch(`${backend.url}${path}`, {
      method: 'POST',
      headers: { apikey: backend.publishableKey, [ENVIRONMENT_HEADER]: backend.name, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  };
  const listeners = new Set<(gate: AccountGate) => void>();
  let gate: AccountGate = { state: 'no-account' };
  let assertion: Assertion | null = null;

  let sync: { readonly engine: SyncEngine; readonly session: SyncSession; readonly store: SyncStore } | null = null;

  const setGate = (next: AccountGate) => {
    gate = next;
    for (const listener of listeners) listener(next);
  };

  /**
   * Opens the account's database for a new account session, moves the gate,
   * and starts its sync. Nothing changes when a later sign-in overtook this one.
   */
  const openAccount = async ({ accountId, eligibility }: RememberedAccount, state: 'active' | 'renewal-pending' = 'active') => {
    sync?.session.end();
    sync = null;
    const opening = await options.vault.open(accountId);
    if (opening.status === 'superseded') return;
    if (opening.status === 'recovery-needed') return setGate({ state: 'recovery-needed', accountId });
    if (opening.status !== 'open') return setGate({ state: 'database-unavailable', accountId, reason: opening.status });
    setGate({ state, accountId, eligibility });
    const supabase = await connect();
    const { store, installationId } = opening.session;
    const engine = new SyncEngine({
      store,
      backend: supabaseSyncBackend(supabase),
      registry,
      installationId,
      newOperationId: () => hex(options.randomBytes(16)),
    });
    sync = { engine, store, session: new SyncSession(engine, store, options.device, supabaseLiveChannels(supabase, accountId)) };
  };

  const currentAssertion = () => (assertion && assertion.expiresAt > options.clock() ? assertion : null);

  const storedSession = async (): Promise<StoredSession | null> => {
    const parsed = parseJson(await credentials.getItem(credentialsKey(backend.name))) as Partial<StoredSession> | null;
    return parsed && typeof parsed.refresh_token === 'string' && typeof parsed.expires_at === 'number' ? (parsed as StoredSession) : null;
  };

  return {
    get gate() {
      return gate;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async answerAgeQuestion(range) {
      assertion = null;
      if (range === 'under-13') return { status: 'ineligible' };
      try {
        const supabase = await connect();
        const { data, error } = await supabase.rpc('issue_eligibility_assertion', { age_range: range });
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
        const { data, error: accountError } = await supabase.rpc('current_account');
        const account = data as { account_id: string; eligibility: string | null } | null;
        if (accountError || !account || !isEligible(account.eligibility)) {
          await supabase.auth.signOut({ scope: 'local' });
          return { status: 'failed' };
        }
        assertion = null;
        const remembered: RememberedAccount = { accountId: account.account_id, eligibility: account.eligibility };
        await credentials.setItem(rememberedAccountKey(backend.name), JSON.stringify(remembered));
        await openAccount(remembered);
        return { status: 'signed-in' };
      } catch {
        return { status: 'failed' };
      }
    },

    async resume() {
      if (gate.state !== 'no-account') return { status: 'resumed' };
      // Removes a retired environment's namespace before reading any credentials.
      await connect();
      const remembered = parseRemembered(await credentials.getItem(rememberedAccountKey(backend.name)));
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
        // A sign-out or another account while this was in flight: touch nothing.
        if (gate !== pending) return;
        const expiresAt = Math.floor(options.clock() / 1000) + renewed.expires_in;
        await credentials.setItem(credentialsKey(backend.name), JSON.stringify({ ...renewed, expires_at: expiresAt }));
        if (gate !== pending) return;
        setGate({ ...pending, state: 'active' });
        // The live connection re-subscribes with the renewed token, as on Supabase's own refresh.
        sync?.session.credentialsChanged();
      } catch {
        // Offline or the response was lost: still Renewal pending.
      }
    },

    sync: {
      get status(): SyncStatus {
        return { live: sync?.session.isLive ?? false, error: sync?.engine.error ?? null };
      },
      reconcile: () => sync?.engine.reconcile() ?? Promise.resolve(),
      idle: () => sync?.engine.idle() ?? Promise.resolve(),
    },

    records: accountRecords(() => sync, registry),
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

function parseRemembered(text: string | null): RememberedAccount | null {
  try {
    const value = JSON.parse(text ?? 'null') as { accountId?: unknown; eligibility?: unknown } | null;
    if (value && typeof value.accountId === 'string' && typeof value.eligibility === 'string' && isEligible(value.eligibility)) {
      return { accountId: value.accountId, eligibility: value.eligibility };
    }
  } catch {
    // Nothing usable remembered.
  }
  return null;
}

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
