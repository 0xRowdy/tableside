// The Account service: the one interface the app uses for anything
// account-shaped (spec 2, *Modules*). It exposes the observable account gate
// and hides Supabase, the network and storage from its callers.

import { type SupabaseClient, createClient } from '@supabase/supabase-js';

/** The account's access state on this installation (spec 2, *Account gate*). Later tickets add the other states. */
export type AccountGate =
  | { readonly state: 'no-account' }
  | { readonly state: 'active'; readonly accountId: string; readonly eligibility: EligibilityBand };

/** The fallback age-range question's answers. */
export type AgeRange = 'under-13' | '13-15' | '16-17' | '18+';
/** An established eligibility band. */
export type EligibilityBand = AgeRange;

export type AgeAnswer = { readonly status: 'eligible' } | { readonly status: 'ineligible' } | { readonly status: 'failed' };
export type CodeRequest = { readonly status: 'sent' } | { readonly status: 'age-required' } | { readonly status: 'failed' };
export type CodeVerification = { readonly status: 'signed-in' } | { readonly status: 'invalid-code' } | { readonly status: 'failed' };

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
  open(accountId: string): Promise<void>;
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
   * The Create path's age step. Under 13 ends here without contacting the
   * server; any other range obtains a short-lived, single-use eligibility
   * assertion for creating the account.
   */
  answerAgeQuestion(range: AgeRange): Promise<AgeAnswer>;
  /**
   * Sends a sign-in code. Create needs a current eligibility assertion.
   * Sign-in never creates an account, and answers the same whether or not one exists.
   */
  requestEmailCode(request: { readonly email: string; readonly intent: 'create' | 'sign-in' }): Promise<CodeRequest>;
  verifyEmailCode(request: { readonly email: string; readonly code: string }): Promise<CodeVerification>;
}

interface Assertion {
  readonly token: string;
  readonly expiresAt: number;
}

export function createAccountService(options: AccountServiceOptions): AccountService {
  const supabase: SupabaseClient = createClient(options.backend.url, options.backend.publishableKey, {
    global: { fetch: options.fetch },
    auth: { storage: options.credentials, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const listeners = new Set<(gate: AccountGate) => void>();
  let gate: AccountGate = { state: 'no-account' };
  let assertion: Assertion | null = null;

  const setGate = (next: AccountGate) => {
    gate = next;
    for (const listener of listeners) listener(next);
  };

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
        const account = data as { account_id: string; eligibility: EligibilityBand } | null;
        if (accountError || !account) {
          await supabase.auth.signOut({ scope: 'local' });
          return { status: 'failed' };
        }
        await options.vault.open(account.account_id);
        assertion = null;
        setGate({ state: 'active', accountId: account.account_id, eligibility: account.eligibility });
        return { status: 'signed-in' };
      } catch {
        return { status: 'failed' };
      }
    },
  };
}
