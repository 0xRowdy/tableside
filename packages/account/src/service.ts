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
import { type BackendEnvironment, ENVIRONMENT_HEADER, type EnvironmentName, retiredEnvironments } from './environment';
import { SyncEngine, type SyncErrorCode } from './sync/engine';
import { recordTypes } from './sync/registry';
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
  | { readonly state: 'database-unavailable'; readonly accountId: string; readonly reason: 'needs-update' | 'migration-failed' }
  /**
   * The account's age eligibility isn't established: ordinary access is closed
   * and only the restricted paths stay (deletion, Contact support, Make a
   * privacy request, billing help, authenticated export). The database stays
   * open for them. Retrying may resolve it.
   */
  | { readonly state: 'age-unresolved'; readonly accountId: string; readonly reason: UnresolvedReason }
  /** The account is established as under 13: ordinary access is closed, with only the restricted paths. */
  | { readonly state: 'age-ineligible'; readonly accountId: string };

/** Gate states that leave ordinary access open: Renewal pending keeps it, under cached rights, while the token renews. */
export const opensOrdinaryAccess = (gate: AccountGate): gate is Extract<AccountGate, { state: 'active' | 'renewal-pending' }> =>
  gate.state === 'active' || gate.state === 'renewal-pending';

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
  /** The platform's age signal; none by default (the fallback question). */
  readonly ageSignals?: PlatformAgeSignals;
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
   * prompt (applied at once, offline too), reports what it established, then
   * takes the server's current record. Runs by itself on entering the
   * foreground, on reconnection and every minute while foregrounded and
   * connected; resolves when that has finished. Established eligibility never
   * lapses offline or with time.
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
   * The app starting again: reopens the account this installation was signed
   * in to from its stored credentials, without the network. The gate becomes
   * Active, or Renewal pending when its token has expired (access and records
   * stay), the remembered age state, or the state its database is in. Stays at
   * No account when there is none.
   */
  resume(): Promise<{ readonly status: 'resumed' | 'no-account' }>;
  /**
   * Renews an expired token (Renewal pending → Active; a restricted state keeps
   * its state, with its token renewed). A failure keeps Renewal pending, with access and records.
   */
  renew(): Promise<void>;
  readonly sync: AccountSync;
}

/** Where the signed-in account is remembered, in the environment's credentials (so it goes with them). */
const rememberedAccountKey = (environment: EnvironmentName) => `tableside.${environment}.account`;

/**
 * The account this installation is signed in to, as this device last knew
 * it: the account's eligibility record (the server's, or a range this
 * device's platform established), and this device's own platform state.
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
}

const UNAVAILABLE: AgeSignal = { kind: 'unavailable' };
const sameRecord = (a: EligibilityRecord, b: EligibilityRecord) => a.status === b.status && a.source === b.source;

/** The remembered account after a platform answer: a required check is owed (or cleared), or a newly established range applies. */
function afterSignal(base: RememberedAccount, signal: AgeSignal): RememberedAccount {
  const owed = requiredCheck(signal);
  const next: RememberedAccount = {
    accountId: base.accountId,
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

/** The gate an open account is in. */
function gateFor(remembered: RememberedAccount, renewing: boolean): AccountGate {
  const { accountId, eligibility, check } = remembered;
  if (eligibility.status === 'under-13') return { state: 'age-ineligible', accountId };
  if (check) return { state: 'age-unresolved', accountId, reason: check === 'unmet' ? 'check-unmet' : 'check-pending' };
  if (isEligibleBand(eligibility.status)) return { state: renewing ? 'renewal-pending' : 'active', accountId, eligibility: eligibility.status };
  return { state: 'age-unresolved', accountId, reason: eligibility.source === 'platform-signal' ? 'check-pending' : 'not-established' };
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
  const ageSignals = options.ageSignals ?? noPlatformAgeSignals;
  let gate: AccountGate = { state: 'no-account' };
  let assertion: Assertion | null = null;
  /** The Create path's platform check found a required check in the way: the fallback answer can't decide. */
  let declarationBlocked = false;

  let sync: { readonly engine: SyncEngine; readonly session: SyncSession } | null = null;
  /**
   * The open account session: its database, what this device knows of the
   * account, and whether its token awaits renewal. A new object for each
   * session, so an answer for an earlier one (`opened !== current`) changes nothing.
   */
  type OpenSession = { readonly session: VaultSession; remembered: RememberedAccount; renewing: boolean; readonly stopWatch: () => void };
  let opened: OpenSession | null = null;
  /** The eligibility refresh in flight, for the session it belongs to. */
  let refreshing: { readonly session: OpenSession; readonly run: Promise<void> } | null = null;

  const setGate = (next: AccountGate) => {
    if (JSON.stringify(next) === JSON.stringify(gate)) return;
    gate = next;
    for (const listener of listeners) listener(next);
  };

  /** Sync runs only while ordinary access is open: a restricted account's database stays open for its restricted paths only. */
  const updateSync = async () => {
    if (!opensOrdinaryAccess(gate)) {
      sync?.session.end();
      sync = null;
      return;
    }
    if (sync || !opened) return;
    const current = opened;
    const supabase = await connect();
    // The gate may have closed, or another session opened, meanwhile.
    if (opened !== current || sync || !opensOrdinaryAccess(gate)) return;
    const { store, installationId } = current.session;
    const engine = new SyncEngine({
      store,
      backend: supabaseSyncBackend(supabase),
      registry: recordTypes,
      installationId,
      newOperationId: () => hex(options.randomBytes(16)),
    });
    sync = { engine, session: new SyncSession(engine, store, options.device, supabaseLiveChannels(supabase, current.remembered.accountId)) };
  };

  /** Keeps what this device knows of the open account (with its credentials, so it goes with them) and moves the gate. */
  const remember = async (current: OpenSession, next: RememberedAccount) => {
    if (opened !== current) return;
    current.remembered = next;
    await credentials.setItem(rememberedAccountKey(backend.name), JSON.stringify(next));
    if (opened !== current) return;
    setGate(gateFor(next, current.renewing));
    await updateSync();
  };

  /**
   * Opens the account's database for a new account session and moves the gate
   * (starting sync when ordinary access is open). Nothing changes when a later
   * sign-in overtook this one.
   */
  const openAccount = async (remembered: RememberedAccount, renewing = false) => {
    opened?.stopWatch();
    opened = null;
    sync?.session.end();
    sync = null;
    const opening = await options.vault.open(remembered.accountId);
    if (opening.status === 'superseded') return;
    const { accountId } = remembered;
    if (opening.status === 'recovery-needed') return setGate({ state: 'recovery-needed', accountId });
    if (opening.status !== 'open') return setGate({ state: 'database-unavailable', accountId, reason: opening.status });
    opened = { session: opening.session, remembered, renewing, stopWatch: watchEligibility() };
    setGate(gateFor(remembered, renewing));
    await updateSync();
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

  const storedSession = async (): Promise<StoredSession | null> => {
    const parsed = parseJson(await credentials.getItem(credentialsKey(backend.name))) as Partial<StoredSession> | null;
    return parsed && typeof parsed.refresh_token === 'string' && typeof parsed.expires_at === 'number' ? (parsed as StoredSession) : null;
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
        return;
      }
      const renewed = (await response.json()) as StoredSession;
      // A sign-out or another account while this was in flight: touch nothing.
      if (opened !== current) return;
      const expiresAt = Math.floor(options.clock() / 1000) + renewed.expires_in;
      await credentials.setItem(credentialsKey(backend.name), JSON.stringify({ ...renewed, expires_at: expiresAt }));
      if (opened !== current) return;
      current.renewing = false;
      setGate(gateFor(current.remembered, false));
      // The live connection re-subscribes with the renewed token, as on Supabase's own refresh.
      sync?.session.credentialsChanged();
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
      await remember(current, { ...current.remembered, eligibility: answer, ...(reported ? { reported } : {}) });
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
    const signal = await ageSignals.check({ interactive: false }).catch(() => UNAVAILABLE);
    if (opened !== current) return;
    // What the platform says applies at once, offline too: restrictions never wait for the server.
    await remember(current, afterSignal(current.remembered, signal));
    if (!(await canAskServer(current, { renew: false }))) return;
    await reportSignal(current);
    const record = await serverRecord();
    if (!record || opened !== current || sameRecord(record, current.remembered.eligibility)) return;
    await remember(current, { ...current.remembered, eligibility: record });
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

  const currentAssertion = () => (assertion && assertion.expiresAt > options.clock() ? assertion : null);

  /** The Create path: a short-lived, single-use assertion for an established range, from the declaration or the platform. */
  const obtainAssertion = async (range: EligibilityBand, source: EligibilitySource): Promise<AgeAnswerResult> => {
    try {
      const supabase = await connect();
      const { data, error } = await supabase.rpc('issue_eligibility_assertion', { age_range: range, source });
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

  return {
    get gate() {
      return gate;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
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
        // Under 13 ends here: nothing is sent, so nothing is kept.
        if (signal.range === 'under-13') return { status: 'ineligible' };
        return obtainAssertion(signal.range, 'platform-signal');
      }
      const current = opened;
      if (gate.state !== 'age-unresolved' || !current) return { status: 'failed' };
      const signal = await ageSignals.check({ interactive: true }).catch(() => UNAVAILABLE);
      if (opened !== current) return { status: 'failed' };
      await remember(current, afterSignal(current.remembered, signal));
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
      if (range === 'under-13') return { status: 'ineligible' };
      return obtainAssertion(range, 'declaration');
    },

    refreshEligibility,

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
        const accountId = (data as { account_id?: unknown } | null)?.account_id;
        const record = accountError ? null : parseEligibilityRecord(data);
        if (typeof accountId !== 'string' || !record) {
          await supabase.auth.signOut({ scope: 'local' });
          return { status: 'failed' };
        }
        assertion = null;
        declarationBlocked = false;
        // The account's server record governs; required platform checks still run on this device.
        const signal = await ageSignals.check({ interactive: false }).catch(() => UNAVAILABLE);
        const remembered = afterSignal({ accountId, eligibility: record }, signal);
        await credentials.setItem(rememberedAccountKey(backend.name), JSON.stringify(remembered));
        await openAccount(remembered);
        const current = opened;
        if (current) await reportSignal(current);
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
      await openAccount(remembered, session.expires_at * 1000 <= options.clock());
      // Signals refresh when online; offline the remembered state stands, with no deadline.
      if (options.device.foreground.current() && options.device.online.current()) void refreshEligibility().catch(() => undefined);
      return { status: 'resumed' };
    },

    async renew() {
      if (opened) await renewSession(opened);
    },

    sync: {
      get status(): SyncStatus {
        return { live: sync?.session.isLive ?? false, error: sync?.engine.error ?? null };
      },
      reconcile: () => sync?.engine.reconcile() ?? Promise.resolve(),
      idle: () => sync?.engine.idle() ?? Promise.resolve(),
    },
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
  const value = parseJson(text) as { accountId?: unknown; eligibility?: unknown; check?: unknown; signal?: unknown; reported?: unknown } | null;
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
  };
}

const isAgeRange = (value: unknown): value is AgeRange => value === 'under-13' || (typeof value === 'string' && isEligibleBand(value));

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
