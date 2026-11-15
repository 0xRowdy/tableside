// The Account service: the one interface the app uses for anything
// account-shaped (spec 2, *Modules*). It exposes the observable account gate
// and hides Supabase, the network and storage from its callers.

import { type SupabaseClient, createClient } from '@supabase/supabase-js';

import { type BackendEnvironment, ENVIRONMENT_HEADER, type EnvironmentName, retiredEnvironments } from './environment';

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
  open(accountId: string): Promise<void>;
  close(): Promise<void>;
  /** Removes every database, key and installation identity another environment left on this device. */
  removeEnvironment(environment: EnvironmentName): Promise<void>;
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
}

interface Assertion {
  readonly token: string;
  readonly expiresAt: number;
}

export function createAccountService(options: AccountServiceOptions): AccountService {
  const { backend } = options;
  // Nothing restores credentials, opens an account database or sends anything
  // until every retired environment's namespace is gone: the client is made
  // only after that, since making it reads the stored credentials.
  // Every server call in this service goes through `connect`.
  let client: Promise<SupabaseClient> | null = null;
  const connect = (): Promise<SupabaseClient> =>
    (client ??= (async () => {
      await removeRetiredEnvironments(options);
      return createClient(backend.url, backend.publishableKey, {
        global: { fetch: options.fetch, headers: { [ENVIRONMENT_HEADER]: backend.name } },
        auth: {
          storage: namespacedCredentials(options.credentials, backend.name),
          storageKey: credentialsKey(backend.name),
          persistSession: true,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });
    })().catch((error: unknown) => {
      client = null;
      throw error;
    }));
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
        const supabase = await connect();
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options:
            intent === 'create' && held
              ? { shouldCreateUser: true, data: { eligibility_assertion: held.token, environment: backend.name } }
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
        const supabase = await connect();
        const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
        if (error) return { status: error.code === 'otp_expired' ? 'invalid-code' : 'failed' };
        const { data, error: accountError } = await supabase.rpc('current_account');
        const account = data as { account_id: string; eligibility: string | null } | null;
        if (accountError || !account || !isEligible(account.eligibility)) {
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

function isEligible(band: string | null): band is EligibilityBand {
  return band !== null && ELIGIBLE_BANDS.includes(band);
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
