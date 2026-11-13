// The Account service: the one interface the app uses for anything
// account-shaped (spec 2, *Modules*). It exposes the observable account gate
// and hides Supabase, the network and storage from its callers.

import { type SupabaseClient, createClient } from '@supabase/supabase-js';

/** The account's access state on this installation (spec 2, *Account gate*). Later tickets add the other states. */
export type AccountGate =
  | { readonly state: 'no-account' }
  | { readonly state: 'active'; readonly accountId: string; readonly eligibility: EligibilityBand }
  /** The token expired and hasn't renewed yet: access and records stay, under cached rights. */
  | { readonly state: 'renewal-pending'; readonly accountId: string; readonly eligibility: EligibilityBand }
  /** The account's key or database is lost or unreadable on this installation; nothing was opened or replaced. */
  | { readonly state: 'recovery-needed'; readonly accountId: string };

/** The fallback age-range question's answers. */
export type AgeRange = 'under-13' | EligibilityBand;
/** An established 13+ age band: the only bands that open ordinary access. */
export type EligibilityBand = '13-15' | '16-17' | '18+';
const ELIGIBLE_BANDS: readonly string[] = ['13-15', '16-17', '18+'] satisfies EligibilityBand[];

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

/** How opening an account's database went. */
export type VaultOpening =
  | { readonly status: 'open' }
  /** The key or database is lost or unreadable: the gate's Recovery needed. */
  | { readonly status: 'recovery-needed' }
  /** A later sign-in or sign-out replaced this one while it waited. */
  | { readonly status: 'superseded' };

/**
 * The account vault (#85): opens and closes this installation's database for
 * an account. The Account service opens it when the gate becomes Active.
 */
export interface AccountVault {
  open(accountId: string): Promise<VaultOpening>;
  close(): Promise<void>;
}

export interface AccountServiceOptions {
  readonly backend: { readonly url: string; readonly publishableKey: string };
  /** The device's network. */
  readonly fetch: typeof fetch;
  readonly credentials: CredentialStorage;
  readonly vault: AccountVault;
  /** Milliseconds since the epoch. */
  readonly clock: () => number;
}

export interface AccountService {
  readonly gate: AccountGate;
  /** Called on every gate change; returns an unsubscribe function. */
  subscribe(listener: (gate: AccountGate) => void): () => void;
  /**
   * Reopens the account this installation last signed in to, with no network:
   * Active, or Renewal pending when its token has expired. Stays at No
   * account when there is none.
   */
  restore(): Promise<void>;
  /** Renews an expired token (Renewal pending → Active). A failure keeps Renewal pending, with access and records. */
  renew(): Promise<void>;
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
  requestEmailCode(request: { readonly email: string; readonly intent: 'create' | 'sign-in' }): Promise<CodeRequestResult>;
  /**
   * Signs in with the emailed code. The gate becomes Active only for an
   * active account with an established 13+ band; other eligibility states are
   * #90's restricted gate states, so until then the sign-in fails.
   */
  verifyEmailCode(request: { readonly email: string; readonly code: string }): Promise<CodeVerificationResult>;
}

interface Assertion {
  readonly token: string;
  readonly expiresAt: number;
}

/** The account this installation last signed in to, kept with its credentials. */
interface AccountRecord {
  readonly v: 1;
  readonly accountId: string;
  readonly eligibility: EligibilityBand;
}

/** Where Supabase keeps the session in the credential storage. */
const SESSION_KEY = 'tableside.auth';
const ACCOUNT_KEY = 'tableside.account';

/** Supabase's stored session: what renewal reads and writes. */
interface StoredSession {
  readonly access_token: string;
  readonly refresh_token: string;
  /** Seconds since the epoch. */
  readonly expires_at: number;
  readonly expires_in: number;
}

export function createAccountService(options: AccountServiceOptions): AccountService {
  const { backend, credentials } = options;
  const supabase: SupabaseClient = createClient(backend.url, backend.publishableKey, {
    global: { fetch: options.fetch },
    auth: { storage: credentials, storageKey: SESSION_KEY, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const listeners = new Set<(gate: AccountGate) => void>();
  let gate: AccountGate = { state: 'no-account' };
  let assertion: Assertion | null = null;

  const setGate = (next: AccountGate) => {
    gate = next;
    for (const listener of listeners) listener(next);
  };

  const currentAssertion = () => (assertion && assertion.expiresAt > options.clock() ? assertion : null);

  /** Opens the account's database and moves the gate; nothing changes when a later sign-in overtook this one. */
  const enter = async (record: AccountRecord, state: 'active' | 'renewal-pending') => {
    const opening = await options.vault.open(record.accountId);
    if (opening.status === 'superseded') return;
    if (opening.status === 'recovery-needed') setGate({ state: 'recovery-needed', accountId: record.accountId });
    else setGate({ state, accountId: record.accountId, eligibility: record.eligibility });
  };

  const storedSession = async (): Promise<StoredSession | null> => {
    const parsed = parseJson(await credentials.getItem(SESSION_KEY)) as Partial<StoredSession> | null;
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

    async restore() {
      if (gate.state !== 'no-account') return;
      const record = parseAccountRecord(await credentials.getItem(ACCOUNT_KEY));
      const session = await storedSession();
      if (!record || !session) return;
      await enter(record, session.expires_at * 1000 > options.clock() ? 'active' : 'renewal-pending');
    },

    async renew() {
      if (gate.state !== 'renewal-pending') return;
      const pending = gate;
      const session = await storedSession();
      if (!session) return;
      try {
        // Supabase's own refresh retries for half a minute offline; one attempt
        // is enough, since a failure leaves Renewal pending to try again later.
        const response = await options.fetch(`${backend.url}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: { apikey: backend.publishableKey, 'content-type': 'application/json' },
          body: JSON.stringify({ refresh_token: session.refresh_token }),
        });
        if (!response.ok) {
          await response.arrayBuffer();
          return;
        }
        const renewed = (await response.json()) as StoredSession;
        const expiresAt = Math.floor(options.clock() / 1000) + renewed.expires_in;
        await credentials.setItem(SESSION_KEY, JSON.stringify({ ...renewed, expires_at: expiresAt }));
        // A sign-out or another account while this was in flight: leave the gate alone.
        if (gate === pending) setGate({ ...pending, state: 'active' });
      } catch {
        // Offline or the response was lost: still Renewal pending.
      }
    },

    async answerAgeQuestion(range) {
      assertion = null;
      if (range === 'under-13') return { status: 'ineligible' };
      try {
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
        const response = await options.fetch(`${backend.url}/functions/v1/request-code`, {
          method: 'POST',
          headers: { apikey: backend.publishableKey, 'content-type': 'application/json' },
          body: JSON.stringify({ email, intent, ...(intent === 'create' && held ? { assertion: held.token } : {}) }),
        });
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
        const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
        if (error) return { status: error.code === 'otp_expired' ? 'invalid-code' : 'failed' };
        const { data, error: accountError } = await supabase.rpc('current_account');
        const account = data as { account_id: string; eligibility: string | null } | null;
        if (accountError || !account || !isEligible(account.eligibility)) {
          await supabase.auth.signOut({ scope: 'local' });
          return { status: 'failed' };
        }
        const record: AccountRecord = { v: 1, accountId: account.account_id, eligibility: account.eligibility };
        await credentials.setItem(ACCOUNT_KEY, JSON.stringify(record));
        assertion = null;
        await enter(record, 'active');
        return { status: 'signed-in' };
      } catch {
        return { status: 'failed' };
      }
    },
  };
}

function isEligible(band: string | null | undefined): band is EligibilityBand {
  return typeof band === 'string' && ELIGIBLE_BANDS.includes(band);
}

function parseJson(text: string | null): unknown {
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseAccountRecord(text: string | null): AccountRecord | null {
  const value = parseJson(text) as Partial<AccountRecord> | null;
  return value?.v === 1 && typeof value.accountId === 'string' && isEligible(value.eligibility)
    ? { v: 1, accountId: value.accountId, eligibility: value.eligibility }
    : null;
}
