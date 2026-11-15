// The web account page's client (spec 2, #106; S2-24): what a browser needs to
// sign in with an email code, schedule or cancel deletion, delete permanently
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

import { instant, parseProgress } from './deletion-progress';
import { type BackendEnvironment, ENVIRONMENT_HEADER } from './environment';
import type {
  CancelDeletionResult,
  CodeRequestResult,
  DeletePermanentlyResult,
  DeletionProgress,
  FreshAuthenticationResult,
  ScheduleDeletionResult,
} from './service';

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
      readonly deletion: { readonly status: 'none' } | { readonly status: 'scheduled'; readonly deadline: number; readonly scheduledAt: number } | null;
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
}

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
  /** Confirm it's you, with a code emailed to the account's email method. */
  readonly confirm: {
    requestCode(): Promise<CodeRequestResult>;
    withCode(code: string): Promise<FreshAuthenticationResult>;
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

interface Answer {
  readonly code: number;
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

  let view: WebAccountView = { state: 'signed-out' };
  /** Global Privacy Control is recorded once per page load. */
  let gpcRecorded = false;
  /** A Schedule or Cancel request with no answer: a retry sends the same operation ID. */
  let pending: { readonly action: 'schedule' | 'cancel'; readonly id: string } | null = null;

  const hex = (count: number) => Array.from(options.randomBytes(count), (byte) => byte.toString(16).padStart(2, '0')).join('');
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
      const response = await options.fetch(`${backend.url}${path}`, {
        method: 'POST',
        headers: {
          apikey: backend.publishableKey,
          [ENVIRONMENT_HEADER]: backend.name,
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      return { code: response.status, body: await response.json().catch(() => null) };
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
    if (answer.code !== 200) {
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
        installation = hex(16);
        lasting.setItem(INSTALLATION, installation);
      }
      let secret = lasting.getItem(secretKey(accountId));
      if (!secret || attempt > 0) {
        secret = hex(32);
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
    if (answer?.code === 200) gpcRecorded = true;
  };

  /** Deleted: keeps the status credential for the deletion's progress, and nothing else of the account. */
  const becomeDeleted = (progress: DeletionProgress | null, accountId: string | null): WebAccountView => {
    write(lasting, DELETED, { token: statusToken() });
    lasting.removeItem(STATUS);
    if (accountId) lasting.removeItem(secretKey(accountId));
    session.removeItem(SESSION);
    pending = null;
    return (view = { state: 'deleted', progress });
  };

  const deletedMarker = () => read<{ token?: unknown }>(lasting, DELETED);

  const progressOf = async (token: string | null): Promise<DeletionProgress | null> => {
    if (!token) return null;
    const answer = await rpc('deletion_progress_v1', { token });
    return answer?.code === 200 ? parseProgress(answer.body) : null;
  };

  /** With no usable session: whether the account behind this browser's status credential was deleted. */
  const lifecycleDeleted = async (): Promise<boolean> => {
    const token = statusToken();
    if (!token) return false;
    const answer = await rpc('lifecycle_status_v1', { token });
    return answer?.code === 200 && statusOf(answer) === 'deleted';
  };

  const signedOut = (): WebAccountView => {
    session.removeItem(SESSION);
    return (view = { state: 'signed-out' });
  };

  /** The deletion status for the signed-in session, from deletion_status_v1. */
  const deletionStatus = (body: unknown): Extract<WebAccountView, { state: 'signed-in' }>['deletion'] => {
    const value = body as { status?: unknown; deadline?: unknown; scheduledAt?: unknown } | null;
    if (value?.status === 'none') return { status: 'none' };
    const deadline = instant(value?.deadline);
    const scheduledAt = instant(value?.scheduledAt);
    return value?.status === 'scheduled' && deadline !== null && scheduledAt !== null ? { status: 'scheduled', deadline, scheduledAt } : null;
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
    if (answer.code !== 200 || answer.body === null) {
      // The session is no longer signed in: revoked, signed out elsewhere, or the account deleted.
      if (await lifecycleDeleted()) return becomeDeleted(await progressOf(statusToken()), stored.accountId);
      return signedOut();
    }
    view = { state: 'signed-in', email: stored.email, deletion: deletionStatus(answer.body) };
    await recordGpc(token);
    return view;
  };

  /** A Schedule or Cancel request's operation ID: the same for every retry until an answer comes. */
  const operationId = (action: 'schedule' | 'cancel'): string => {
    if (pending?.action !== action) pending = { action, id: hex(16) };
    return pending.id;
  };

  const requestCode = async (email: string): Promise<CodeRequestResult> => {
    const answer = await send('/functions/v1/request-code', { email: email.trim(), intent: 'sign-in' });
    const body = answer?.body as { status?: unknown; retryAfter?: unknown } | null;
    if (answer?.code === 200 && body?.status === 'sent') return { status: 'sent' };
    if (answer?.code === 429 && typeof body?.retryAfter === 'number') return { status: 'rate-limited', retryAfterSeconds: body.retryAfter };
    return { status: 'failed' };
  };

  return {
    get view() {
      return view;
    },

    start: refresh,
    refresh,
    requestCode,

    async signIn(email, code) {
      const address = email.trim();
      const verified = await send('/auth/v1/verify', { type: 'email', email: address, token: code.trim() });
      if (!verified) return { status: 'failed' };
      if (verified.code !== 200) {
        const error = (verified.body as { error_code?: unknown; code?: unknown } | null)?.error_code;
        return { status: error === 'otp_expired' ? 'invalid-code' : 'failed' };
      }
      const token = (verified.body as { access_token?: unknown } | null)?.access_token;
      if (typeof token !== 'string') return { status: 'failed' };
      const account = await rpc('current_account', {}, token);
      const accountId = (account?.body as { account_id?: unknown } | null)?.account_id;
      if (account?.code !== 200 || typeof accountId !== 'string' || !keepSession(verified.body, address, accountId)) {
        await send('/auth/v1/logout?scope=local', {}, token);
        return { status: 'failed' };
      }
      // A new sign-in: an earlier deletion's status in this browser is done with.
      lasting.removeItem(DELETED);
      lasting.removeItem(STATUS);
      pending = null;
      await register(token, accountId);
      await refresh();
      return { status: 'signed-in' };
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
        if (answer?.code === 200 && statusOf(answer) === 'confirmed') return { status: 'confirmed' };
        if (answer?.code === 401 && statusOf(answer) === 'invalid-code') return { status: 'invalid-code' };
        return { status: 'failed' };
      },
    },

    async schedule() {
      if (view.state === 'signed-in' && view.deletion?.status === 'scheduled') return { status: 'scheduled', deadline: view.deletion.deadline };
      const token = await accessToken();
      if (!token) return { status: 'failed' };
      const answer = await send('/functions/v1/schedule-deletion', { operationId: operationId('schedule') }, token);
      if (answer && answer.code < 500) pending = null;
      if (answer?.code === 403 && statusOf(answer) === 'fresh-authentication-required') return { status: 'fresh-authentication-required' };
      const body = answer?.body as { deadline?: unknown; scheduledAt?: unknown } | null;
      const deadline = answer?.code === 200 && statusOf(answer) === 'scheduled' ? instant(body?.deadline) : null;
      const scheduledAt = instant(body?.scheduledAt);
      if (deadline === null || scheduledAt === null || view.state !== 'signed-in') {
        // No answer, or a retry whose scheduling was canceled since: the server's status decides what shows.
        await refresh();
        return { status: 'failed' };
      }
      view = { ...view, deletion: { status: 'scheduled', deadline, scheduledAt } };
      return { status: 'scheduled', deadline };
    },

    async cancel() {
      const token = await accessToken();
      if (!token) return { status: 'failed' };
      const answer = await rpc('cancel_deletion_v1', { operation_id: operationId('cancel') }, token);
      const status = answer?.code === 200 ? statusOf(answer) : undefined;
      if (typeof status === 'string') pending = null;
      if (status === 'fresh-authentication-required') return { status };
      if ((status === 'canceled' || status === 'not-scheduled') && view.state === 'signed-in') {
        view = { ...view, deletion: { status: 'none' } };
        return { status: 'canceled' };
      }
      await refresh();
      return status === 'too-late' ? { status } : { status: 'failed' };
    },

    async deletePermanently() {
      if (view.state === 'deleted') return { status: 'deleted' };
      const stored = storedSession();
      const token = await accessToken();
      if (!stored || !token) return { status: 'failed' };
      const answer = await rpc('delete_permanently_v1', {}, token);
      const status = answer?.code === 200 ? statusOf(answer) : undefined;
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
      pending = null;
      signedOut();
    },

    async dismiss() {
      lasting.removeItem(DELETED);
      lasting.removeItem(STATUS);
      view = { state: 'signed-out' };
    },
  };
}
