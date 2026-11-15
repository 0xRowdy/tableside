// Sign in to a reviewer account with its reviewer credential (spec 2,
// *App-review access*; Amendment 1 C4; #107): how app reviewers sign in, on
// any platform, without anyone answering an email code.
//
// POST { email, credential }, naming its backend environment in
// x-tableside-environment like every request (docs/environments.md).
//   200 { status: 'signed-in', session: { access_token, refresh_token } }
//   401 { status: 'refused' }   not this address's reviewer account and credential
//   400 { status: 'invalid' }   not a request this function understands
//   502 { status: 'failed' }
//
// The credential works only for the one reviewer account it was issued to, in
// this environment; the answer is the same refusal for an ordinary account, an
// unknown address or a wrong credential. A valid one gets an ordinary session,
// exactly as a verified email code would: the same token, gate, eligibility
// and authorization as any account, and nothing more. No email is sent.
// Nothing here logs an address, credential, code or token.

import { ENVIRONMENT_HEADER, reply, serviceAuth, serviceRpc } from '../_shared/service.ts';

declare const Deno: { serve(handler: (request: Request) => Promise<Response>): void };

Deno.serve(async (request) => {
  if (request.method !== 'POST') return reply(400, { status: 'invalid' });
  let body: { email?: unknown; credential?: unknown };
  try {
    body = await request.json();
  } catch {
    return reply(400, { status: 'invalid' });
  }
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const { credential } = body;
  if (!email || email.length > 254 || typeof credential !== 'string' || credential.length > 64) return reply(400, { status: 'invalid' });

  try {
    const checked = await serviceRpc(request.headers.get(ENVIRONMENT_HEADER) ?? '', 'reviewer_credential_valid', { address: email, credential });
    if (!checked.ok) throw new Error(`check ${checked.status}`);
    if ((await checked.json()) !== true) return reply(401, { status: 'refused' });

    return reply(200, { status: 'signed-in', session: await signInWithFreshCode(email) });
  } catch (error) {
    console.error('reviewer-sign-in failed', error instanceof Error ? error.message : 'unexpected');
    return reply(502, { status: 'failed' });
  }
});

const ATTEMPTS = 5;

/**
 * A one-time code for the account, used at once: the session is the one a
 * verified email code makes. (Auth sends nothing for an admin link.) Auth
 * keeps one code per user, so a sign-in on another device between issuing and
 * using it replaces it: issue another after a short, random wait.
 */
async function signInWithFreshCode(email: string): Promise<{ access_token: string; refresh_token: string }> {
  for (let attempt = 1; ; attempt++) {
    const link = await serviceAuth('/admin/generate_link', { type: 'magiclink', email });
    const code = (link.body as { email_otp?: unknown } | null)?.email_otp;
    if (!link.ok || typeof code !== 'string') throw new Error('generate-code');
    const verified = await serviceAuth('/verify', { type: 'email', email, token: code });
    const session = verified.body as { access_token?: unknown; refresh_token?: unknown } | null;
    if (verified.ok && typeof session?.access_token === 'string' && typeof session.refresh_token === 'string') {
      return { access_token: session.access_token, refresh_token: session.refresh_token };
    }
    if (attempt === ATTEMPTS) throw new Error('verify-code');
    await new Promise((resolve) => setTimeout(resolve, 25 + Math.random() * 100 * attempt));
  }
}
