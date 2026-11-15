// Keep a revocable Apple or Google grant (spec 2, *Deletion*; #52 review):
// after a sign-in, Create or link with a provider that gave the app an
// authorization code, the app sends it here. It is exchanged for the
// provider's refresh token, sealed (provider-grants.ts) and kept for the
// identity, so permanent deletion can revoke it. Best effort: an account
// works the same without one, and deletion then reports a provider exception.
//
// POST, with the caller's own access token as the bearer and naming its
// backend environment in x-tableside-environment like every request:
//   { provider, code, flow: 'native' | 'web' }
// Answers:
//   200 { status: 'held' }
//   422 { status: 'unavailable' }      no grant settings for this provider here, or the provider refused the code
//   403 { status: 'not-a-method' }     the code is for an identity that isn't one of this account's
//   401 { status: 'not-signed-in' }
//   400 { status: 'invalid' } | 502 { status: 'failed' }
//
// Nothing here logs a code, token or claim.

import { callerOf } from '../_shared/caller.ts';
import { withCors } from '../_shared/cors.ts';
import { exchangeCode, grantsConfigured, seal } from '../_shared/provider-grants.ts';
import { environmentOf, readJsonPost, reply, rpcJson } from '../_shared/service.ts';

declare const Deno: { serve(handler: (request: Request) => Promise<Response>): void };

const STATUS_CODES: Readonly<Record<string, number>> = { held: 200, 'not-a-method': 403, 'not-signed-in': 401 };

Deno.serve(withCors(async (request) => {
  const body = await readJsonPost<{ provider: unknown; code: unknown; flow: unknown }>(request);
  const { provider, code, flow } = body ?? {};
  if (typeof provider !== 'string' || !/^[a-z]+$/.test(provider) || provider === 'email' || typeof code !== 'string' || !code || code.length > 2048
    || (flow !== 'native' && flow !== 'web')) {
    return reply(400, { status: 'invalid' });
  }
  try {
    const caller = await callerOf(request);
    if (!caller) return reply(401, { status: 'not-signed-in' });
    if (!grantsConfigured(provider)) return reply(422, { status: 'unavailable' });
    const exchanged = await exchangeCode(provider, code, flow);
    const sealed = exchanged ? await seal(exchanged.grant) : null;
    if (!exchanged || !sealed) return reply(422, { status: 'unavailable' });
    const status = await rpcJson<string>(environmentOf(request), 'store_provider_grant', {
      session: caller.sessionId,
      auth_user: caller.authUserId,
      provider,
      subject: exchanged.subject,
      sealed,
    });
    return reply(STATUS_CODES[status] ?? 502, { status });
  } catch {
    console.error('provider-grant failed');
    return reply(502, { status: 'failed' });
  }
}));
