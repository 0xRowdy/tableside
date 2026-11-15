// Confirm it's you (spec 2, #100; S2-18): the player signs in again with one
// of the account's own methods, and the caller's session is recorded as
// freshly authenticated for a few minutes (private.fresh_authentications).
// Being signed in already, or refreshing a token, never counts.
//
// POST, with the caller's own access token as the bearer and naming its
// backend environment in x-tableside-environment like every request:
//   { method: 'email', code }                      the code request-code sent to the email method's address
//   { method: 'provider', provider, idToken, nonce } an ID token for one of the account's Apple or Google
//                                                   identities, minted for a nonce from issue_proof_nonce_v1
// Answers:
//   200 { status: 'confirmed' }
//   401 { status: 'invalid-code' | 'invalid-token' }   the proof didn't check out
//   403 { status: 'not-a-method' }                     a valid proof, but not of one of this account's methods
//   401 { status: 'not-signed-in' }                    no live session behind the token
//   400 { status: 'invalid' } | 502 { status: 'failed' }
//
// Nothing here logs a token, nonce, code or claim.

import { callerOf, emailCodeValid, provenIdentity } from '../_shared/caller.ts';
import { withCors } from '../_shared/cors.ts';
import { environmentOf, readJsonPost, reply, serviceRpc } from '../_shared/service.ts';

declare const Deno: { serve(handler: (request: Request) => Promise<Response>): void };

Deno.serve(withCors(async (request) => {
  const body = await readJsonPost<{ method: unknown; code: unknown; provider: unknown; idToken: unknown; nonce: unknown }>(request);
  if (!body) return reply(400, { status: 'invalid' });
  try {
    const caller = await callerOf(request);
    if (!caller) return reply(401, { status: 'not-signed-in' });

    let proof: { provider: string; subject: string | null };
    if (body.method === 'email' && typeof body.code === 'string' && /^\d{6}$/.test(body.code)) {
      if (!caller.email || !(await emailCodeValid(caller.email, body.code, caller.authUserId))) return reply(401, { status: 'invalid-code' });
      proof = { provider: 'email', subject: null };
    } else if (body.method === 'provider') {
      const proven = await provenIdentity(request, caller, body);
      if (proven === 'invalid') return reply(400, { status: 'invalid' });
      if (proven === 'invalid-token') return reply(401, { status: 'invalid-token' });
      proof = { provider: proven.provider, subject: proven.claims.sub };
    } else {
      return reply(400, { status: 'invalid' });
    }

    const response = await serviceRpc(environmentOf(request), 'record_fresh_authentication', {
      session: caller.sessionId,
      auth_user: caller.authUserId,
      provider: proof.provider,
      subject: proof.subject,
    });
    if (!response.ok) {
      await response.body?.cancel();
      console.error('fresh-auth failed', response.status);
      return reply(502, { status: 'failed' });
    }
    const status = ((await response.json()) as { status?: string }).status;
    if (status === 'confirmed') return reply(200, { status });
    if (status === 'not-a-method') return reply(403, { status });
    return reply(401, { status: 'not-signed-in' });
  } catch {
    console.error('fresh-auth failed', 'unexpected');
    return reply(502, { status: 'failed' });
  }
}));
