// Create with Apple or Google (spec 2, #89; Amendment 3 §1): binds the age
// step's eligibility assertion to the provider identity the player is
// creating an account for, so Auth's before-user-created hook lets that one
// identity, and no other, become a new Auth user. Signing in with the same ID
// token then creates the user, and the database consumes the assertion.
//
// POST { provider, idToken, nonce, assertion }, naming its backend environment
// in x-tableside-environment like every request (docs/environments.md).
//   200 { status: 'bound' }          the assertion now covers this identity
//   200 { status: 'existing' }       the identity already has an account: sign in instead (nothing bound)
//   403 { status: 'age-required' }   no usable assertion (used, expired, or bound to another identity)
//   401 { status: 'invalid-token' }  not a valid ID token from this provider for this app and nonce
//   400 { status: 'invalid' }        not a request this function understands
//   502 { status: 'failed' }
//
// The ID token is verified here, as Auth will verify it (signature, issuer,
// audience, expiry and the nonce the client holds), so nobody can bind an
// assertion to an identity they can't sign in as. Nothing here logs a token,
// nonce, assertion or claim.

import { sha256Hex, verifyIdToken } from '../_shared/id-token.ts';
import { ENVIRONMENT_HEADER, reply, serviceRpc } from '../_shared/service.ts';

declare const Deno: { serve(handler: (request: Request) => Promise<Response>): void };

Deno.serve(async (request) => {
  if (request.method !== 'POST') return reply(400, { status: 'invalid' });
  let body: { provider?: unknown; idToken?: unknown; nonce?: unknown; assertion?: unknown };
  try {
    body = await request.json();
  } catch {
    return reply(400, { status: 'invalid' });
  }
  const { provider, idToken, nonce, assertion } = body;
  if (typeof provider !== 'string' || typeof idToken !== 'string' || typeof nonce !== 'string' || !nonce || typeof assertion !== 'string') {
    return reply(400, { status: 'invalid' });
  }

  const claims = await verifyIdToken(provider, idToken, await sha256Hex(nonce));
  if (!claims) return reply(401, { status: 'invalid-token' });

  const response = await serviceRpc(request.headers.get(ENVIRONMENT_HEADER) ?? '', 'bind_provider_assertion', { assertion, provider, subject: claims.sub });
  if (!response.ok) {
    await response.body?.cancel();
    console.error('bind-provider-assertion failed', response.status);
    return reply(502, { status: 'failed' });
  }
  const outcome = (await response.json()) as string;
  if (outcome === 'bound' || outcome === 'existing') return reply(200, { status: outcome });
  return reply(403, { status: 'age-required' });
});
