// What the functions acting for a signed-in player share (#100): who is
// calling, from their own token, and checking an emailed code without
// touching their session. Nothing here logs a token or code.

import { ENVIRONMENT_HEADER } from './service.ts';

declare const Deno: { env: { get(name: string): string | undefined } };

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

export interface Caller {
  readonly sessionId: string;
  readonly authUserId: string;
  /** The email method's address, if the account has that method. */
  readonly email: string | null;
  /** Whether the account has ordinary access (established 13+ eligibility), not only the restricted paths. */
  readonly active: boolean;
}

/**
 * The caller, from the bearer token the request carries: the database checks
 * its signature, that its session still exists, that it is from this
 * environment, and that its account is signed in (#90's restricted-path
 * gate, private.signed_in_account). Null otherwise.
 */
export async function callerOf(request: Request): Promise<Caller | null> {
  const authorization = request.headers.get('authorization') ?? '';
  if (!/^Bearer \S+$/.test(authorization)) return null;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/caller_session_v1`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      authorization,
      'content-type': 'application/json',
      [ENVIRONMENT_HEADER]: request.headers.get(ENVIRONMENT_HEADER) ?? '',
    },
    body: '{}',
  });
  if (!response.ok) {
    await response.body?.cancel();
    return null;
  }
  const answer = (await response.json().catch(() => null)) as { session_id?: unknown; auth_user_id?: unknown; email?: unknown; active?: unknown } | null;
  if (!answer || typeof answer.session_id !== 'string' || typeof answer.auth_user_id !== 'string') return null;
  return {
    sessionId: answer.session_id,
    authUserId: answer.auth_user_id,
    email: typeof answer.email === 'string' ? answer.email : null,
    active: answer.active === true,
  };
}

/**
 * Whether `code` is the email code Auth issued `email` (through request-code
 * or link-method), for `authUserId`. Auth checks it the way it checks a
 * sign-in code, using it up; the session that answer opens is ended at once,
 * so the caller's own session is the only one that changes.
 */
export async function emailCodeValid(email: string, code: string, authUserId: string): Promise<boolean> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'email', email, token: code }),
  });
  const session = (await response.json().catch(() => null)) as { access_token?: unknown; user?: { id?: unknown } } | null;
  if (!response.ok || typeof session?.access_token !== 'string') return false;
  const ended = await fetch(`${SUPABASE_URL}/auth/v1/logout?scope=local`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, authorization: `Bearer ${session.access_token}` },
  });
  await ended.body?.cancel();
  return session.user?.id === authUserId;
}
