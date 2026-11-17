// Spec 2 Deletion; #52

import { callerOf } from '../_shared/caller.ts';
import { withCors } from '../_shared/cors.ts';
import { exchangeCode, grantsConfigured, seal } from '../_shared/provider-grants.ts';
import { environmentOf, readJsonPost, reply, rpcJson } from '../_shared/service.ts';

declare const Deno: { serve(handler: (request: Request) => Promise<Response>): void };

const STATUS_CODES: Readonly<Record<string, number>> = { held: 200, 'not-a-method': 403, 'not-signed-in': 401 };

Deno.serve(withCors(async (request) => {
  const body = await readJsonPost<{ provider: unknown; code: unknown; flow: unknown; redirectUri: unknown }>(request);
  const { provider, code, flow, redirectUri } = body ?? {};
  if (typeof provider !== 'string' || !/^[a-z]+$/.test(provider) || provider === 'email' || typeof code !== 'string' || !code || code.length > 2048
    || (flow !== 'native' && flow !== 'web')) {
    return reply(400, { status: 'invalid' });
  }
  const callback = typeof redirectUri === 'string' && new RegExp(`^https?://[^/?#]+/functions/v1/provider-callback\\?provider=${provider}$`).test(redirectUri) ? redirectUri : null;
  if (flow === 'web' && !callback) return reply(400, { status: 'invalid' });
  try {
    const caller = await callerOf(request);
    if (!caller) return reply(401, { status: 'not-signed-in' });
    if (!grantsConfigured(provider)) return reply(422, { status: 'unavailable' });
    const exchanged = await exchangeCode(provider, code, flow, flow === 'web' ? callback : null);
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
