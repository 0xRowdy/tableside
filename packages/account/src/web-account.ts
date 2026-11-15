// The web account page's client (spec 2, #106; S2-24): what a browser needs to
// sign in (an email code, or Apple or Google through the provider's web flow
// and the provider-callback function), schedule or cancel deletion, delete permanently
// now, and read deletion status, from a page reachable without the app. It
// calls the app's own server operations, so the server applies the same
// rules: every deletion action needs Confirm it's you, a retry never schedules
// or cancels twice, and signing in never cancels a scheduled deletion.
//
// Unlike the app's Account service it keeps no records and never syncs: the
// page is lifecycle only (Amendment 9 §2). The browser registers its session
// as a 'web' installation for the status credential alone, so it can still
// show the deletion's progress once the account is gone. When the browser
// sends Global Privacy Control, a signed-in visit records the ad-data opt-out
// with source GPC (Amendment 8 §5); the browser's own Sec-GPC header is the
// signal the server checks.
//
// Plain fetch and Web Storage, with no Supabase client, so the page's bundle
// carries nothing it doesn't use.

import type {
  CancelDeletionResult,
  CodeRequestResult,
  DeletePermanentlyResult,
  DeletionProgress,
  FreshAuthenticationResult,
  IdentityProvider,
  ScheduleDeletionResult,
} from './account-service/types';
import { backendPost } from './backend-request';
import { type PendingDeletion, parseDeletionStatus, parseProgress } from './deletion-progress';
import type { BackendEnvironment } from './environment';
import { cancelAnswer, codeRequestAnswer, freshCodeAnswer, freshProviderAnswer, retriedOperations, scheduleAnswer } from './lifecycle-answers';
import { hex } from './values';

/** The page's view of the account: what it shows. */
export type WebAccountView =
  | { readonly state: 'signed-out' }
  /**
   * Signed in. `deletion` is the server's deletion status (none, or scheduled
   * with its deadline), or null when it couldn't be asked.
   */
  | {
      readonly state: 'signed-in';
      readonly email: string;
      readonly deletion: PendingDeletion | null;
    }
  /** Deleted permanently: its progress, or null when it can't be asked. */
  | { readonly state: 'deleted'; readonly progress: DeletionProgress | null };

/** A browser's Web Storage (sessionStorage, localStorage). */
export interface WebStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface WebAccountOptions {
  /** The one backend this page was built for. */
  readonly backend: BackendEnvironment;
  readonly fetch: typeof fetch;
  /** This tab's storage (sessionStorage): the Auth session, which ends with the tab. */
  readonly session: WebStorage;
  /**
   * This browser's storage (localStorage): its installation and its
   * secrets, and the status credential, which reads only the account's
   * lifecycle (never a record) and outlives the session.
   */
  readonly lasting: WebStorage;
  readonly randomBytes: (count: number) => Uint8Array;
  /** Whether the browser sends Global Privacy Control (navigator.globalPrivacyControl). */
  readonly globalPrivacyControl: () => boolean;
  /**
   * Apple and Google sign-in on the page, through the provider's web flow and
   * the provider-callback function: each provider this build was configured
   * for (its authorization endpoint and the page's client ID), and the name
   * Auth knows it by when not its own (a local stack's test identity provider).
   */
  readonly providers?: Partial<Record<WebProvider, WebProviderSettings>>;
  /** SHA-256 of `text`, as lowercase hex; the browser's Web Crypto by default. */
  readonly sha256Hex?: (text: string) => Promise<string>;
}

/** The providers the page signs in with: the app's own (IdentityProvider). */
export type WebProvider = IdentityProvider;

/** Apple's and Google's authorization pages: where the page sends the browser to sign in (navigations, never loads). */
export const PROVIDER_AUTHORIZE_URLS: Readonly<Record<WebProvider, string>> = {
  apple: 'https://appleid.apple.com/auth/authorize',
  google: 'https://accounts.google.com/o/oauth2/v2/auth',
};

export interface WebProviderSettings {
  readonly authorizeUrl: string;
  readonly clientId: string;
  readonly authName?: string;
}

export type WebProviderSignInResult =
  | { readonly status: 'signed-in' }
  /** No account signs in with this identity: none was created (Create is in the app, after the age step). */
  | { readonly status: 'no-account' }
  | { readonly status: 'canceled' }
  | { readonly status: 'failed' };

export type WebSignInResult = { readonly status: 'signed-in' } | { readonly status: 'invalid-code' } | { readonly status: 'failed' };

export interface WebAccount {
  readonly view: WebAccountView;
  /** Opening the page: what this browser knows, then the server's answer. */
  start(): Promise<WebAccountView>;
  /** Asks the server again (deletion status, or the progress of a deletion). */
  refresh(): Promise<WebAccountView>;
  /** Sign in: emails a code ("If an account exists for this address…"). Never creates an account. */
  requestCode(email: string): Promise<CodeRequestResult>;
  signIn(email: string, code: string): Promise<WebSignInResult>;
  /** The providers this page can sign in with. */
  readonly providers: readonly WebProvider[];
  /**
   * Sign in with Apple or Google, never creating an account: the provider's
   * page to send the browser to. The flow comes back to this page, which then
   * calls completeProviderSignIn with what the page's URL came back with.
   */
  startProviderSignIn(provider: WebProvider): Promise<string | null>;
  /** Whether `query` (the page URL's query) is a provider sign-in coming back to this page. */
  isProviderReturn(query: string): boolean;
  /**
   * Finishes the provider flow `query` came back with: a sign-in (a deletion
   * stays as it is: signing in never cancels it), or Confirm it's you
   * ('confirmed', 'not-a-method').
   */
  completeProviderSignIn(query: string): Promise<WebProviderSignInResult | FreshAuthenticationResult>;
  /** Confirm it's you, with a code emailed to the account's email method, or with one of its Apple or Google identities. */
  readonly confirm: {
    requestCode(): Promise<CodeRequestResult>;
    withCode(code: string): Promise<FreshAuthenticationResult>;
    /** The provider's page to send the browser to; the flow comes back through completeProviderSignIn. */
    startProvider(provider: WebProvider): Promise<string | null>;
  };
  schedule(): Promise<ScheduleDeletionResult>;
  cancel(): Promise<CancelDeletionResult>;
  deletePermanently(): Promise<DeletePermanentlyResult>;
  /** Ends this browser's session on the server and here. */
  signOut(): Promise<void>;
  /** Done with a deletion's status: forgets its credential in this browser. */
  dismiss(): Promise<void>;
}

/** What the web page calls itself on Devices. */
export const WEB_DEVICE_LABEL = 'Web browser';

interface StoredSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  /** Milliseconds since the epoch. */
  readonly expiresAt: number;
  readonly email: string;
  readonly accountId: string;
}

/** An answer from the backend: its HTTP status and parsed JSON body. */
interface Answer {
  readonly httpStatus: number;
  readonly body: unknown;
}

/** How long before its expiry a token is renewed. */
const RENEW_EARLY_MS = 60_000;

export function createWebAccount(options: WebAccountOptions): WebAccount {
  const { backend, session, lasting } = options;
  const key = (name: string) => `tableside.${backend.name}.web.${name}`;
  const SESSION = key('session');
  const STATUS = key('status');
  const DELETED = key('deleted');
  const INSTALLATION = key('installation');
  const secretKey = (accountId: string) => key(`secret.${accountId}`);
  /** A provider sign-in under way in this tab: its verifier, nonce and provider. */
  const PROVIDER_FLOW = key('provider-flow');
  const sha256Hex =
    options.sha256Hex ??
    (async (text: string) => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))));

  let view: WebAccountView = { state: 'signed-out' };
  /** Global Privacy Control is recorded once per page load. */
  let gpcRecorded = false;
  /** A Schedule or Cancel request with no answer: a retry sends the same operation ID. */
  const operations = retriedOperations(() => randomHex(16));

  const randomHex = (count: number) => hex(options.randomBytes(count));
  const read = <T>(storage: WebStorage, name: string): T | null => {
    try {
      return JSON.parse(storage.getItem(name) ?? 'null') as T | null;
    } catch {
      return null;
    }
  };
  const write = (storage: WebStorage, name: string, value: unknown) => storage.setItem(name, JSON.stringify(value));

  /** A request naming this environment, as every request does. Null when no answer came. */
  const send = async (path: string, body: unknown, token?: string): Promise<Answer | null> => {
    try {
      const response = await backendPost(options.fetch, backend, path, body, token ? { authorization: `Bearer ${token}` } : {});
      return { httpStatus: response.status, body: await response.json().catch(() => null) };
    } catch {
      return null;
    }
  };
  const rpc = (name: string, args: Record<string, unknown>, token?: string) => send(`/rest/v1/rpc/${name}`, args, token);
  const statusOf = (answer: Answer | null): unknown => (answer?.body as { status?: unknown } | null)?.status;

  const storedSession = () => {
    const stored = read<Partial<StoredSession>>(session, SESSION);
    return stored && typeof stored.accessToken === 'string' && typeof stored.refreshToken === 'string' && typeof stored.expiresAt === 'number'
      && typeof stored.email === 'string' && typeof stored.accountId === 'string'
      ? (stored as StoredSession)
      : null;
  };

  /** Auth's session answer, kept for this tab. */
  const keepSession = (answer: unknown, email: string, accountId: string): StoredSession | null => {
    const value = answer as { access_token?: unknown; refresh_token?: unknown; expires_in?: unknown } | null;
    if (typeof value?.access_token !== 'string' || typeof value.refresh_token !== 'string' || typeof value.expires_in !== 'number') return null;
    const kept = { accessToken: value.access_token, refreshToken: value.refresh_token, expiresAt: Date.now() + value.expires_in * 1000, email, accountId };
    write(session, SESSION, kept);
    return kept;
  };

  /** This tab's access token, renewed first when it is about to expire; null when the session is gone. */
  const accessToken = async (): Promise<string | null> => {
    const stored = storedSession();
    if (!stored) return null;
    if (stored.expiresAt - RENEW_EARLY_MS > Date.now()) return stored.accessToken;
    const answer = await send('/auth/v1/token?grant_type=refresh_token', { refresh_token: stored.refreshToken });
    if (!answer) return null;
    if (answer.httpStatus !== 200) {
      // Refused: the session ended (signed out elsewhere, revoked or deleted).
      session.removeItem(SESSION);
      return null;
    }
    return keepSession(answer.body, stored.email, stored.accountId)?.accessToken ?? null;
  };

  /** The status credential this browser holds for its last session's account. */
  const statusToken = (): string | null => {
    const stored = read<{ token?: unknown }>(lasting, STATUS);
    return typeof stored?.token === 'string' ? stored.token : null;
  };

  /**
   * Registers this tab's session as a 'web' installation, for its status
   * credential. The installation's secret is kept before the server hears it,
   * so a lost answer never strands it; a claimed installation (its secret
   * lost) starts a new one.
   */
  const register = async (token: string, accountId: string): Promise<void> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      let installation = lasting.getItem(INSTALLATION);
      if (!installation || attempt > 0) {
        installation = randomHex(16);
        lasting.setItem(INSTALLATION, installation);
      }
      let secret = lasting.getItem(secretKey(accountId));
      if (!secret || attempt > 0) {
        secret = randomHex(32);
        lasting.setItem(secretKey(accountId), secret);
      }
      const answer = await rpc('register_device_v1', { installation, secret, platform: 'web', label: WEB_DEVICE_LABEL }, token);
      const body = answer?.body as { status?: unknown; status_token?: unknown } | null;
      if (body?.status === 'registered' && typeof body.status_token === 'string') {
        write(lasting, STATUS, { accountId, token: body.status_token });
        return;
      }
      if (body?.status !== 'installation-claimed') return;
    }
  };

  /** Records Global Privacy Control for the signed-in account, once per page load. */
  const recordGpc = async (token: string): Promise<void> => {
    if (gpcRecorded || !options.globalPrivacyControl()) return;
    const answer = await send('/functions/v1/record-gpc', {}, token);
    if (answer?.httpStatus === 200) gpcRecorded = true;
  };

  /** Deleted: keeps the status credential for the deletion's progress, and nothing else of the account. */
  const becomeDeleted = (progress: DeletionProgress | null, accountId: string | null): WebAccountView => {
    write(lasting, DELETED, { token: statusToken() });
    lasting.removeItem(STATUS);
    if (accountId) lasting.removeItem(secretKey(accountId));
    session.removeItem(SESSION);
    operations.settle();
    return (view = { state: 'deleted', progress });
  };

  const deletedMarker = () => read<{ token?: unknown }>(lasting, DELETED);

  const progressOf = async (token: string | null): Promise<DeletionProgress | null> => {
    if (!token) return null;
    const answer = await rpc('deletion_progress_v1', { token });
    return answer?.httpStatus === 200 ? parseProgress(answer.body) : null;
  };

  /** With no usable session: whether the account behind this browser's status credential was deleted. */
  const lifecycleDeleted = async (): Promise<boolean> => {
    const token = statusToken();
    if (!token) return false;
    const answer = await rpc('lifecycle_status_v1', { token });
    return answer?.httpStatus === 200 && statusOf(answer) === 'deleted';
  };

  const signedOut = (): WebAccountView => {
    session.removeItem(SESSION);
    return (view = { state: 'signed-out' });
  };

  const refresh = async (): Promise<WebAccountView> => {
    const marker = deletedMarker();
    if (marker) {
      const token = typeof marker.token === 'string' ? marker.token : null;
      return (view = { state: 'deleted', progress: await progressOf(token) });
    }
    const stored = storedSession();
    const token = await accessToken();
    if (!stored || !token) {
      if (await lifecycleDeleted()) return becomeDeleted(await progressOf(statusToken()), stored?.accountId ?? null);
      // Offline with a session still held: keep what the page showed.
      return storedSession() ? view : signedOut();
    }
    const answer = await rpc('deletion_status_v1', {}, token);
    if (!answer) return (view = { state: 'signed-in', email: stored.email, deletion: null });
    if (answer.httpStatus !== 200 || answer.body === null) {
      // The session is no longer signed in: revoked, signed out elsewhere, or the account deleted.
      if (await lifecycleDeleted()) return becomeDeleted(await progressOf(statusToken()), stored.accountId);
      return signedOut();
    }
    view = { state: 'signed-in', email: stored.email, deletion: parseDeletionStatus(answer.body) };
    await recordGpc(token);
    return view;
  };

  const requestCode = async (email: string): Promise<CodeRequestResult> => {
    const answer = await send('/functions/v1/request-code', { email: email.trim(), intent: 'sign-in' });
    return answer ? codeRequestAnswer(answer.httpStatus, answer.body) : { status: 'failed' };
  };

  /** After Auth answered with a session: the account it opened, kept for this tab, registered; null when it opened none. */
  const openSession = async (answer: unknown, email: string): Promise<boolean> => {
    const token = (answer as { access_token?: unknown } | null)?.access_token;
    if (typeof token !== 'string') return false;
    const account = await rpc('current_account', {}, token);
    const accountId = (account?.body as { account_id?: unknown } | null)?.account_id;
    if (account?.httpStatus !== 200 || typeof accountId !== 'string' || !keepSession(answer, email, accountId)) {
      await send('/auth/v1/logout?scope=local', {}, token);
      return false;
    }
    // A new sign-in: an earlier deletion's status in this browser is done with.
    lasting.removeItem(DELETED);
    lasting.removeItem(STATUS);
    operations.settle();
    await register(token, accountId);
    await refresh();
    return true;
  };

  const providerNames = (['apple', 'google'] as const).filter((provider) => options.providers?.[provider]);
  /** provider-callback for a provider: the redirect URI its web flow posts to, which the grant exchange repeats. */
  const callbackUri = (authName: string) => `${backend.url}/functions/v1/provider-callback?provider=${encodeURIComponent(authName)}`;

  /**
   * The provider's page for a sign-in or a Confirm it's you, kept for this
   * tab: its verifier (the state names its hash) and nonce (the ID token
   * names its hash). A confirmation's nonce is one the server issued to this
   * session for the proof.
   */
  const startProviderFlow = async (provider: WebProvider, kind: 'sign-in' | 'confirm', nonce: string): Promise<string | null> => {
    const settings = options.providers?.[provider];
    if (!settings) return null;
    const verifier = randomHex(32);
    const state = `${backend.name}~${await sha256Hex(verifier)}~web`;
    session.setItem(PROVIDER_FLOW, JSON.stringify({ provider, kind, verifier, nonce, state }));
    const authName = settings.authName ?? provider;
    return `${settings.authorizeUrl}?${query({
      client_id: settings.clientId,
      redirect_uri: callbackUri(authName),
      response_type: 'code id_token',
      response_mode: 'form_post',
      scope: provider === 'google' ? 'openid email' : 'email',
      state,
      nonce: await sha256Hex(nonce),
    })}`;
  };
  const query = (params: Record<string, string>) =>
    Object.entries(params)
      .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
      .join('&');
  const parseQuery = (text: string): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const pair of text.replace(/^\?/, '').split('&')) {
      if (!pair) continue;
      const [name = '', value = ''] = pair.split('=', 2);
      try {
        out[decodeURIComponent(name.replace(/\+/g, ' '))] = decodeURIComponent(value.replace(/\+/g, ' '));
      } catch {
        // A malformed pair says nothing.
      }
    }
    return out;
  };

  return {
    get view() {
      return view;
    },

    providers: providerNames,

    startProviderSignIn: (provider) => startProviderFlow(provider, 'sign-in', randomHex(32)),

    isProviderReturn(text) {
      const returned = parseQuery(text);
      return typeof returned.state === 'string' && returned.state.endsWith('~web');
    },

    async completeProviderSignIn(text) {
      const flow = read<{ provider?: unknown; kind?: unknown; verifier?: unknown; nonce?: unknown; state?: unknown }>(session, PROVIDER_FLOW);
      session.removeItem(PROVIDER_FLOW);
      const returned = parseQuery(text);
      // Only the flow this tab began: the state names its verifier's hash.
      if (!flow || returned.state !== flow.state || typeof flow.verifier !== 'string' || typeof flow.nonce !== 'string') return { status: 'failed' };
      if (returned.error) return { status: returned.error === 'canceled' ? 'canceled' : 'failed' };
      const provider = providerNames.find((name) => name === flow.provider) ?? null;
      const settings = provider ? options.providers?.[provider] : undefined;
      if (!provider || !settings) return { status: 'failed' };
      const authName = settings.authName ?? provider;
      const redeemed = await rpc('redeem_provider_flow_code', { verifier: flow.verifier });
      const { idToken, code } = (redeemed?.body ?? {}) as { idToken?: unknown; code?: unknown };
      if (redeemed?.httpStatus !== 200 || typeof idToken !== 'string') return { status: 'failed' };
      if (flow.kind === 'confirm') {
        const token = await accessToken();
        if (!token) return { status: 'failed' };
        const answer = await send('/functions/v1/fresh-auth', { method: 'provider', provider: authName, idToken, nonce: flow.nonce }, token);
        return freshProviderAnswer(answer?.httpStatus, statusOf(answer));
      }
      const signedIn = await send('/auth/v1/token?grant_type=id_token', { provider: authName, id_token: idToken, nonce: flow.nonce });
      if (!signedIn) return { status: 'failed' };
      // The before-user-created hook refused a new Auth user: nobody has this identity, and nothing was created.
      if (signedIn.httpStatus !== 200) return { status: JSON.stringify(signedIn.body).includes('eligibility_assertion_required') ? 'no-account' : 'failed' };
      const email = (signedIn.body as { user?: { email?: unknown } } | null)?.user?.email;
      if (!(await openSession(signedIn.body, typeof email === 'string' ? email : ''))) return { status: 'failed' };
      // The provider's revocable grant, kept for permanent deletion to revoke (best effort).
      const token = storedSession()?.accessToken;
      if (typeof code === 'string' && code && token) await send('/functions/v1/provider-grant', { provider: authName, code, flow: 'web', redirectUri: callbackUri(authName) }, token);
      return { status: 'signed-in' };
    },

    start: refresh,
    refresh,
    requestCode,

    async signIn(email, code) {
      const address = email.trim();
      const verified = await send('/auth/v1/verify', { type: 'email', email: address, token: code.trim() });
      if (!verified) return { status: 'failed' };
      if (verified.httpStatus !== 200) {
        const error = (verified.body as { error_code?: unknown; code?: unknown } | null)?.error_code;
        return { status: error === 'otp_expired' ? 'invalid-code' : 'failed' };
      }
      return (await openSession(verified.body, address)) ? { status: 'signed-in' } : { status: 'failed' };
    },

    confirm: {
      async requestCode() {
        const token = await accessToken();
        if (!token) return { status: 'failed' };
        const caller = await rpc('caller_session_v1', {}, token);
        const email = (caller?.body as { email?: unknown } | null)?.email;
        return typeof email === 'string' ? requestCode(email) : { status: 'failed' };
      },
      async withCode(code) {
        const token = await accessToken();
        if (!token) return { status: 'failed' };
        const answer = await send('/functions/v1/fresh-auth', { method: 'email', code: code.trim() }, token);
        return freshCodeAnswer(answer?.httpStatus, statusOf(answer));
      },
      async startProvider(provider) {
        const token = await accessToken();
        if (!token) return null;
        // A nonce the server issued to this session for this proof alone.
        const issued = await rpc('issue_proof_nonce_v1', {}, token);
        return issued?.httpStatus === 200 && typeof issued.body === 'string' ? startProviderFlow(provider, 'confirm', issued.body) : null;
      },
    },

    async schedule() {
      if (view.state === 'signed-in' && view.deletion?.status === 'scheduled') return { status: 'scheduled', deadline: view.deletion.deadline };
      const token = await accessToken();
      if (!token) return { status: 'failed' };
      const answer = await send('/functions/v1/schedule-deletion', { operationId: operations.id('schedule') }, token);
      if (answer && answer.httpStatus < 500) operations.settle();
      const scheduled = scheduleAnswer(answer?.httpStatus, answer?.body);
      if (scheduled?.status === 'fresh-authentication-required') return scheduled;
      if (!scheduled || scheduled.scheduledAt === null || view.state !== 'signed-in') {
        // No answer, or a retry whose scheduling was canceled since: the server's status decides what shows.
        await refresh();
        return { status: 'failed' };
      }
      const { deadline, scheduledAt } = scheduled;
      view = { ...view, deletion: { status: 'scheduled', deadline, scheduledAt } };
      return { status: 'scheduled', deadline };
    },

    async cancel() {
      const token = await accessToken();
      if (!token) return { status: 'failed' };
      const answer = await rpc('cancel_deletion_v1', { operation_id: operations.id('cancel') }, token);
      const status = answer?.httpStatus === 200 ? statusOf(answer) : undefined;
      if (typeof status === 'string') operations.settle();
      const result = cancelAnswer(status);
      if (result?.status === 'fresh-authentication-required') return result;
      if (result?.status === 'canceled' && view.state === 'signed-in') {
        view = { ...view, deletion: { status: 'none' } };
        return result;
      }
      await refresh();
      return result?.status === 'too-late' ? result : { status: 'failed' };
    },

    async deletePermanently() {
      if (view.state === 'deleted') return { status: 'deleted' };
      const stored = storedSession();
      const token = await accessToken();
      if (!stored || !token) return { status: 'failed' };
      const answer = await rpc('delete_permanently_v1', {}, token);
      const status = answer?.httpStatus === 200 ? statusOf(answer) : undefined;
      if (status === 'fresh-authentication-required') return { status };
      if (status === 'deleted') {
        becomeDeleted(parseProgress((answer?.body as { progress?: unknown } | null)?.progress), stored.accountId);
        return { status: 'deleted' };
      }
      // Refused, or no answer: what the server says of the account decides.
      return (await refresh()).state === 'deleted' ? { status: 'deleted' } : { status: 'failed' };
    },

    async signOut() {
      const token = storedSession()?.accessToken;
      if (token) await send('/auth/v1/logout?scope=local', {}, token);
      lasting.removeItem(STATUS);
      operations.settle();
      signedOut();
    },

    async dismiss() {
      lasting.removeItem(DELETED);
      lasting.removeItem(STATUS);
      view = { state: 'signed-out' };
    },
  };
}
