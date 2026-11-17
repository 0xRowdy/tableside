// Spec 2 Amendment 3 §1; #89

import { sha256Hex, verifyIdToken } from '../_shared/id-token.ts';
import { environmentOf, readJsonPost, reply, serviceRpc } from '../_shared/service.ts';

declare const Deno: { serve(handler: (request: Request) => Promise<Response>): void };

Deno.serve(async (request) => {
  const body = await readJsonPost<{ provider: unknown; idToken: unknown; nonce: unknown; assertion: unknown }>(request);
  if (!body) return reply(400, { status: 'invalid' });
  const { provider, idToken, nonce, assertion } = body;
  if (typeof provider !== 'string' || typeof idToken !== 'string' || typeof nonce !== 'string' || !nonce || typeof assertion !== 'string') {
    return reply(400, { status: 'invalid' });
  }

  const claims = await verifyIdToken(provider, idToken, await sha256Hex(nonce));
  if (!claims) return reply(401, { status: 'invalid-token' });

  const response = await serviceRpc(environmentOf(request), 'bind_provider_assertion', { assertion, provider, subject: claims.sub });
  if (!response.ok) {
    await response.body?.cancel();
    console.error('bind-provider-assertion failed', response.status);
    return reply(502, { status: 'failed' });
  }
  const outcome = (await response.json()) as string;
  if (outcome === 'bound' || outcome === 'existing') return reply(200, { status: outcome });
  return reply(403, { status: 'age-required' });
});
