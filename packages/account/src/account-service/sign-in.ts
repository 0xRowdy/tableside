// Spec 2 Sign-in, linking and recovery

import type { SupabaseClient } from '@supabase/supabase-js';

import { parseEligibilityRecord } from '../eligibility';
import { authCallbackUrl } from '../environment';
import { instant, isCurrency } from '../values';

import type { AgeEligibility } from './age';
import type { ServiceContext } from './context';
import { UNAVAILABLE, afterSignal, withEligibility } from './remembered';
import type { AccountSession } from './session';
import { deletedKey, statusKey } from './credentials';
import { codeRequestAnswer } from '../lifecycle-answers';
import type { AccountService, CodeIntent, CodeRequestResult, IdentityProvider, ProviderSettings, SignInMethod, SignInMethodEntry } from './types';

export interface ProviderCredential {
  readonly provider: IdentityProvider;
  readonly idToken: string;
  readonly nonce: string;
  readonly code?: { readonly value: string; readonly flow: 'native' | 'web'; readonly redirectUri?: string };
}

const HELD_CREDENTIAL_MS = 5 * 60_000;

export type SignIn = ReturnType<typeof createSignIn>;

export function createSignIn(ctx: ServiceContext, session: AccountSession, age: AgeEligibility) {
  const { options } = ctx;
  const { backend } = options;
  let heldCredential: (ProviderCredential & { readonly until: number }) | null = null;
  age.onPlayerForgotten(() => {
    heldCredential = null;
  });

  const authName = (provider: IdentityProvider): string => options.providers?.authName?.[provider] ?? provider;

  const methodOf = (provider: unknown): SignInMethod | null => {
    if (provider === 'email') return 'email';
    for (const candidate of ['apple', 'google'] as const) if (authName(candidate) === provider) return candidate;
    return null;
  };

  const parseMethods = (data: unknown): SignInMethodEntry[] | null => {
    if (!Array.isArray(data)) return null;
    return (data as { id?: unknown; provider?: unknown; email?: unknown }[]).flatMap((identity) => {
      const method = methodOf(identity.provider);
      return method && typeof identity.id === 'string' ? [{ id: identity.id, method, email: typeof identity.email === 'string' ? identity.email : null }] : [];
    });
  };

  const finishSignIn = async (supabase: SupabaseClient): Promise<boolean> => {
    const { data, error } = await supabase.rpc('current_account');
    const account = data as { account_id?: unknown; currency?: unknown; deletion_deadline?: unknown } | null;
    const record = error ? null : parseEligibilityRecord(data);
    if (!account || typeof account.account_id !== 'string' || !record) {
      await supabase.auth.signOut({ scope: 'local' });
      return false;
    }
    age.signedIn();
    heldCredential = null;
    const signal = await age.ageSignals.check({ interactive: false }).catch(() => UNAVAILABLE);
    const deletionDeadline = instant(account.deletion_deadline);
    const remembered = withEligibility(
      {
        accountId: account.account_id,
        eligibility: record,
        currency: isCurrency(account.currency) ? account.currency : null,
        signedOut: false,
        ...(deletionDeadline !== null ? { deletionDeadline } : {}),
      },
      afterSignal({ eligibility: record }, signal),
    );
    await ctx.writeCredentials(async () => {
      await ctx.credentials.removeItem(statusKey(backend.name));
      await ctx.credentials.removeItem(deletedKey(backend.name));
      await ctx.remember(remembered);
    });
    await session.openAccount(remembered);
    if (session.opened) await age.reportSignal(session.opened);
    return true;
  };

  const obtainCredential = async (provider: IdentityProvider, nonce = ctx.randomHex(32)): Promise<ProviderCredential | 'canceled' | 'failed'> => {
    const settings = options.providers;
    const route = settings?.ports.route[provider] ?? 'unavailable';
    if (!settings || route === 'unavailable') return 'failed';
    const { ports } = settings;
    const hashedNonce = await ports.sha256Hex(nonce);
    if (route === 'native') {
      const answer = await ports.nativeIdToken(provider, { hashedNonce });
      if (answer.status !== 'token') return answer.status;
      return { provider, idToken: answer.idToken, nonce, ...(answer.authorizationCode ? { code: { value: answer.authorizationCode, flow: 'native' as const } } : {}) };
    }
    return browserCredential(provider, settings, nonce, hashedNonce);
  };

  const browserCredential = async (
    provider: IdentityProvider,
    { ports, appleWeb }: ProviderSettings,
    nonce: string,
    hashedNonce: string,
  ): Promise<ProviderCredential | 'canceled' | 'failed'> => {
    if (!appleWeb) return 'failed';
    const verifier = ctx.randomHex(32);
    const state = `${backend.name}~${await ports.sha256Hex(verifier)}`;
    const callbackUrl = authCallbackUrl(backend.name);
    const redirectUri = `${backend.url}/functions/v1/provider-callback?provider=${encodeURIComponent(authName(provider))}`;
    const authorize = `${appleWeb.authorizeUrl}?${queryString({
      client_id: appleWeb.clientId,
      redirect_uri: redirectUri,
      response_type: 'code id_token',
      response_mode: 'form_post',
      scope: 'email',
      state,
      nonce: hashedNonce,
    })}`;
    await ctx.connect();
    const opened = await ports.openAuthSession(authorize, callbackUrl);
    if (opened.status === 'canceled') return 'canceled';
    const [returnedTo, returnedQuery = ''] = opened.url.split('?', 2);
    const returned = parseQuery(returnedQuery);
    if (returnedTo !== callbackUrl || returned.state !== state) return 'failed';
    if (returned.error) return returned.error === 'canceled' ? 'canceled' : 'failed';
    const supabase = await ctx.connect();
    const { data, error } = await supabase.rpc('redeem_provider_flow_code', { verifier });
    const redeemed = data as { idToken?: unknown; code?: unknown } | null;
    if (error || typeof redeemed?.idToken !== 'string' || !redeemed.idToken) return 'failed';
    return { provider, idToken: redeemed.idToken, nonce, ...(typeof redeemed.code === 'string' && redeemed.code ? { code: { value: redeemed.code, flow: 'web' as const, redirectUri } } : {}) };
  };

  const keepGrant = async (credential: ProviderCredential): Promise<void> => {
    if (!credential.code) return;
    await ctx
      .actAsPlayer(
        'provider-grant',
        { provider: authName(credential.provider), code: credential.code.value, flow: credential.code.flow, ...(credential.code.redirectUri ? { redirectUri: credential.code.redirectUri } : {}) },
        'restricted',
      )
      .catch(() => null);
  };

  const bindAssertion = async (
    credential: ProviderCredential,
    ageAssertion: { readonly token: string },
  ): Promise<'bound' | 'existing' | 'age-required' | 'invalid-token' | 'failed'> => {
    const response = await ctx.post('/functions/v1/bind-provider-assertion', {
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

  const signInWithIdToken = async (supabase: SupabaseClient, credential: ProviderCredential) => {
    const { error } = await supabase.auth.signInWithIdToken({ provider: authName(credential.provider), token: credential.idToken, nonce: credential.nonce });
    if (!error) return 'signed-in' as const;
    return /eligibility_assertion_required/.test(error.message) ? ('no-account' as const) : ('failed' as const);
  };

  const sendCode = async ({ email, intent }: { readonly email: string; readonly intent: CodeIntent }): Promise<CodeRequestResult> => {
    const held = age.currentAssertion();
    if (intent === 'create' && !held) return { status: 'age-required' };
    try {
      const response = await ctx.post('/functions/v1/request-code', { email, intent, ...(intent === 'create' && held ? { assertion: held.token } : {}) });
      const answer = codeRequestAnswer(response.status, await response.json().catch(() => null));
      if (answer.status === 'age-required') age.dropAssertion();
      return answer;
    } catch {
      return { status: 'failed' };
    }
  };

  const providerProof = async (provider: IdentityProvider) => {
    const nonce = await ctx.operation('issue_proof_nonce_v1', undefined, 'restricted');
    if (typeof nonce !== 'string') return 'failed' as const;
    const credential = await obtainCredential(provider, nonce);
    if (typeof credential === 'string') return credential;
    return { proof: { provider: authName(provider), idToken: credential.idToken, nonce: credential.nonce }, credential };
  };

  const api: Pick<AccountService, 'requestEmailCode' | 'verifyEmailCode' | 'signInAsReviewer' | 'signInWithProvider' | 'createWithProvider'> = {
    requestEmailCode: sendCode,

    async verifyEmailCode({ email, code }) {
      try {
        const supabase = await ctx.connect();
        const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
        if (error) return { status: error.code === 'otp_expired' ? 'invalid-code' : 'failed' };
        return (await finishSignIn(supabase)) ? { status: 'signed-in' } : { status: 'failed' };
      } catch {
        return { status: 'failed' };
      }
    },

    async signInAsReviewer({ email, credential }) {
      try {
        const response = await ctx.post('/functions/v1/reviewer-sign-in', { email, credential });
        const body = (await response.json().catch(() => null)) as { status?: string; session?: { access_token?: unknown; refresh_token?: unknown } } | null;
        if (response.status === 401 && body?.status === 'refused') return { status: 'refused' };
        const stored = body?.session;
        if (!response.ok || typeof stored?.access_token !== 'string' || typeof stored.refresh_token !== 'string') return { status: 'failed' };
        const supabase = await ctx.connect();
        const { error } = await supabase.auth.setSession({ access_token: stored.access_token, refresh_token: stored.refresh_token });
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
        const supabase = await ctx.connect();
        const outcome = await signInWithIdToken(supabase, credential);
        if (outcome === 'no-account') {
          heldCredential = { ...credential, until: options.clock() + HELD_CREDENTIAL_MS };
          return { status: 'no-account' };
        }
        if (outcome === 'failed') return { status: 'failed' };
        if (!(await finishSignIn(supabase))) return { status: 'failed' };
        await keepGrant(credential);
        return { status: 'signed-in' };
      } catch {
        return { status: 'failed' };
      }
    },

    async createWithProvider(provider, { sameIdentity = false } = {}) {
      const kept = sameIdentity && heldCredential?.provider === provider && heldCredential.until > options.clock() ? heldCredential : null;
      heldCredential = null;
      const ageAssertion = age.currentAssertion();
      if (!ageAssertion) return { status: 'age-required' };
      try {
        let credential = kept ?? (await obtainCredential(provider));
        if (typeof credential === 'string') return { status: credential };
        let bound = await bindAssertion(credential, ageAssertion);
        if (bound === 'invalid-token' && kept) {
          credential = await obtainCredential(provider);
          if (typeof credential === 'string') return { status: credential };
          bound = await bindAssertion(credential, ageAssertion);
        }
        if (bound === 'age-required') {
          age.dropAssertion();
          return { status: 'age-required' };
        }
        if (bound !== 'bound' && bound !== 'existing') return { status: 'failed' };
        const supabase = await ctx.connect();
        const signedIn = await signInWithIdToken(supabase, credential);
        if (signedIn === 'no-account') {
          age.dropAssertion();
          return { status: 'age-required' };
        }
        if (signedIn === 'failed') return { status: 'failed' };
        const created = (await supabase.rpc('account_created_by', { assertion: ageAssertion.token })).data === true;
        if (!(await finishSignIn(supabase))) return { status: 'failed' };
        await keepGrant(credential);
        return { status: created ? 'created' : 'signed-in' };
      } catch {
        return { status: 'failed' };
      }
    },
  };

  return { api, sendCode, providerProof, keepGrant, parseMethods, methodOf };
}

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
    }
  }
  return out;
}
