// The Account service: the one interface the app uses for anything
// account-shaped (spec 2, *Modules*). It exposes the observable account gate
// and hides Supabase, the network and storage from its callers.

import { type SupabaseClient, createClient } from '@supabase/supabase-js';

import { SyncEngine, type SyncErrorCode } from './sync/engine';
import { recordTypes } from './sync/registry';
import { type DevicePorts, SyncSession } from './sync/session';
import type { SyncStore } from './sync/store';
import { supabaseLiveChannel, supabaseSyncBackend } from './sync/supabase';

/** The account's access state on this installation (spec 2, *Account gate*). Later tickets add the other states. */
export type AccountGate =
  | { readonly state: 'no-account' }
  | { readonly state: 'active'; readonly accountId: string; readonly eligibility: EligibilityBand };

/** The fallback age-range question's answers. */
export type AgeRange = 'under-13' | EligibilityBand;
/** An established 13+ age band: the only bands that open ordinary access. */
export type EligibilityBand = '13-15' | '16-17' | '18+';
const ELIGIBLE_BANDS: readonly string[] = ['13-15', '16-17', '18+'] satisfies EligibilityBand[];

export type AgeAnswerResult = { readonly status: 'eligible' } | { readonly status: 'ineligible' } | { readonly status: 'failed' };
export type CodeRequestResult = { readonly status: 'sent' } | { readonly status: 'age-required' } | { readonly status: 'failed' };
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
}

/** An account's database, open for the current account session. */
export interface VaultSession {
  readonly installationId: string;
  /** The account's store; it refuses to read or write once the account session has ended. */
  readonly store: SyncStore;
}

/** Recovery needed and a superseded opening are the vault's; their gate states arrive with later tickets. */
export type VaultOpening =
  | { readonly status: 'open'; readonly session: VaultSession }
  | { readonly status: 'recovery-needed' }
  | { readonly status: 'superseded' };

export interface SyncStatus {
  /** Whether this device holds the account's live connection (the newest foregrounded device). */
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
  readonly backend: { readonly url: string; readonly publishableKey: string };
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
   * Sends a sign-in code. Create needs a current eligibility assertion.
   * Sign-in never creates an account, and answers the same whether or not one exists.
   */
  requestEmailCode(request: { readonly email: string; readonly intent: 'create' | 'sign-in' }): Promise<CodeRequestResult>;
  /**
   * Signs in with the emailed code. The gate becomes Active only for an
   * active account with an established 13+ band; other eligibility states are
   * #90's restricted gate states, so until then the sign-in fails.
   */
  verifyEmailCode(request: { readonly email: string; readonly code: string }): Promise<CodeVerificationResult>;
  /**
   * The app starting again: reopens the account this installation was signed
   * in to from its stored credentials, without the network. The first-run
   * flow (#88) builds on it.
   */
  resume(): Promise<{ readonly status: 'resumed' | 'no-account' }>;
  readonly sync: AccountSync;
}

/** Where the signed-in account is remembered beside Auth's credentials. */
const REMEMBERED_ACCOUNT = 'tableside.account';

interface Assertion {
  readonly token: string;
  readonly expiresAt: number;
}

export function createAccountService(options: AccountServiceOptions): AccountService {
  const supabase: SupabaseClient = createClient(options.backend.url, options.backend.publishableKey, {
    global: { fetch: options.fetch },
    auth: { storage: options.credentials, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
    ...(options.webSocket ? { realtime: { transport: options.webSocket } } : {}),
  });
  const listeners = new Set<(gate: AccountGate) => void>();
  let gate: AccountGate = { state: 'no-account' };
  let assertion: Assertion | null = null;

  let sync: { readonly engine: SyncEngine; readonly session: SyncSession } | null = null;

  const setGate = (next: AccountGate) => {
    gate = next;
    for (const listener of listeners) listener(next);
  };

  /** Opens the account's database for a new account session, and starts its sync. */
  const openAccount = async (accountId: string, eligibility: EligibilityBand) => {
    sync?.session.end();
    sync = null;
    const opening = await options.vault.open(accountId);
    setGate({ state: 'active', accountId, eligibility });
    if (opening.status !== 'open') return;
    const { store, installationId } = opening.session;
    const engine = new SyncEngine({
      store,
      backend: supabaseSyncBackend(supabase),
      registry: recordTypes,
      installationId,
      newOperationId: () => hex(options.randomBytes(16)),
    });
    sync = { engine, session: new SyncSession(engine, store, options.device, () => supabaseLiveChannel(supabase, accountId)) };
  };

  supabase.auth.onAuthStateChange((event) => {
    if (event === 'TOKEN_REFRESHED') sync?.session.credentialsChanged();
  });

  const currentAssertion = () => (assertion && assertion.expiresAt > options.clock() ? assertion : null);

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
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options:
            intent === 'create' && held
              ? { shouldCreateUser: true, data: { eligibility_assertion: held.token } }
              : { shouldCreateUser: false },
        });
        // Sign-in to an address with no account is refused by Auth; it reads as
        // sent, so the answer never reveals whether the account exists.
        if (!error || (intent === 'sign-in' && error.code === 'otp_disabled')) return { status: 'sent' };
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
        assertion = null;
        await options.credentials.setItem(REMEMBERED_ACCOUNT, JSON.stringify({ accountId: account.account_id, eligibility: account.eligibility }));
        await openAccount(account.account_id, account.eligibility);
        return { status: 'signed-in' };
      } catch {
        return { status: 'failed' };
      }
    },

    async resume() {
      const remembered = parseRemembered(await options.credentials.getItem(REMEMBERED_ACCOUNT));
      const { data } = await supabase.auth.getSession();
      if (!remembered || !data.session) return { status: 'no-account' };
      await openAccount(remembered.accountId, remembered.eligibility);
      return { status: 'resumed' };
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

function parseRemembered(text: string | null): { accountId: string; eligibility: EligibilityBand } | null {
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

function isEligible(band: string | null): band is EligibilityBand {
  return band !== null && ELIGIBLE_BANDS.includes(band);
}
