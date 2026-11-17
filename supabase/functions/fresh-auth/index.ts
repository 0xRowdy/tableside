// Spec 2 S2-18; #100

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
