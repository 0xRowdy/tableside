// Spec 2 App-review access, Amendment 1 C4; #107
// docs/account-service.md Supabase Auth

import { generateCode } from '../_shared/codes.ts';
import { StepError, environmentOf, readJsonPost, reply, serviceAuth, serviceRpc } from '../_shared/service.ts';

declare const Deno: { serve(handler: (request: Request) => Promise<Response>): void };

Deno.serve(async (request) => {
  const body = await readJsonPost<{ email: unknown; credential: unknown }>(request);
  if (!body) return reply(400, { status: 'invalid' });
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const { credential } = body;
  if (!email || email.length > 254 || typeof credential !== 'string' || credential.length > 64) return reply(400, { status: 'invalid' });

  try {
    const checked = await serviceRpc(environmentOf(request), 'reviewer_credential_valid', { address: email, credential });
    if (!checked.ok) throw new StepError('check-credential');
    if ((await checked.json()) !== true) return reply(401, { status: 'refused' });

    return reply(200, { status: 'signed-in', session: await signInWithFreshCode(email) });
  } catch (error) {
    console.error('reviewer-sign-in failed', error instanceof StepError ? error.step : 'unexpected');
    return reply(502, { status: 'failed' });
  }
});

const ATTEMPTS = 5;

async function signInWithFreshCode(email: string): Promise<{ access_token: string; refresh_token: string }> {
  for (let attempt = 1; ; attempt++) {
    const code = await generateCode(email);
    const verified = await serviceAuth('/verify', { type: 'email', email, token: code });
    const session = verified.body as { access_token?: unknown; refresh_token?: unknown } | null;
    if (verified.ok && typeof session?.access_token === 'string' && typeof session.refresh_token === 'string') {
      return { access_token: session.access_token, refresh_token: session.refresh_token };
    }
    if (attempt === ATTEMPTS) throw new StepError('verify-code');
    await new Promise((resolve) => setTimeout(resolve, 25 + Math.random() * 100 * attempt));
  }
}
