// #100

import { type IdTokenClaims, sha256Hex, verifyIdToken } from './id-token.ts';
import { ENVIRONMENT_HEADER, serviceRpc } from './service.ts';

declare const Deno: { env: { get(name: string): string | undefined } };

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

export interface Caller {
  readonly sessionId: string;
  readonly authUserId: string;
  readonly email: string | null;
}

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
  const answer = (await response.json().catch(() => null)) as { session_id?: unknown; auth_user_id?: unknown; email?: unknown } | null;
  if (!answer || typeof answer.session_id !== 'string' || typeof answer.auth_user_id !== 'string') return null;
  return {
    sessionId: answer.session_id,
    authUserId: answer.auth_user_id,
    email: typeof answer.email === 'string' ? answer.email : null,
  };
}

export async function provenIdentity(
  request: Request,
  caller: Caller,
  body: { readonly provider?: unknown; readonly idToken?: unknown; readonly nonce?: unknown },
): Promise<{ readonly provider: string; readonly claims: IdTokenClaims } | 'invalid' | 'invalid-token'> {
  const { provider, idToken, nonce } = body;
  if (typeof provider !== 'string' || typeof idToken !== 'string' || typeof nonce !== 'string' || !nonce) return 'invalid';
  const consumed = await serviceRpc(request.headers.get(ENVIRONMENT_HEADER) ?? '', 'consume_proof_nonce', { session: caller.sessionId, nonce });
  if (!consumed.ok || (await consumed.json()) !== true) return 'invalid-token';
  const claims = await verifyIdToken(provider, idToken, await sha256Hex(nonce));
  return claims ? { provider, claims } : 'invalid-token';
}

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
