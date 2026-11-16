// Add a sign-in method (spec 2, #100; S2-18): after the player confirmed it's
// them (fresh-auth), and with proof of the new method. A method another
// account signs in with is a conflict, never a merge. Every method added
// sends the account a security notice.
//
// POST, with the caller's own access token as the bearer and naming its
// backend environment in x-tableside-environment like every request:
//   { method: 'provider', provider, idToken, nonce }  an ID token for the Apple or Google identity to add,
//                                                     minted for a nonce from issue_proof_nonce_v1
//   { method: 'email', step: 'send' }                 emails a code to the account's sign-in email
//   { method: 'email', code }                         adds the email-code method with that code
// Answers:
//   200 { status: 'linked' | 'already-linked' | 'sent' }
//   409 { status: 'conflict' }                         another account signs in with this identity
//   403 { status: 'fresh-authentication-required' }
//   401 { status: 'invalid-token' | 'invalid-code' | 'not-signed-in' }
//   429 { status: 'rate-limited', retryAfter }         code requests, as request-code limits them
//   422 { status: 'no-address' }                       no confirmed sign-in email to add the method for
//   502 { status: 'failed' }
//   400 { status: 'invalid' }
//
// Nothing here logs a token, nonce, code, claim or address.

import { callerOf, emailCodeValid, provenIdentity } from '../_shared/caller.ts';
import { admitCodeRequest, logSend, sendCodeEmail } from '../_shared/codes.ts';
import { type Mail, deliver } from '../_shared/mail.ts';
import { clientIp, environmentOf, readJsonPost, reply, rpcJson } from '../_shared/service.ts';

declare const Deno: { serve(handler: (request: Request) => Promise<Response>): void };

type Rpc = <T>(name: string, args: Record<string, unknown>) => Promise<T>;
type Outcome = { status: string; email?: string };

const STATUS_CODES: Readonly<Record<string, number>> = {
  linked: 200,
  'already-linked': 200,
  conflict: 409,
  'fresh-authentication-required': 403,
  'not-signed-in': 401,
  'no-address': 422,
};

Deno.serve(async (request) => {
  const body = await readJsonPost<{ method: unknown; step: unknown; code: unknown; provider: unknown; idToken: unknown; nonce: unknown }>(request);
  if (!body) return reply(400, { status: 'invalid' });
  const environment = environmentOf(request);
  const rpc: Rpc = <T,>(name: string, args: Record<string, unknown>) => rpcJson<T>(environment, name, args);
  try {
    const caller = await callerOf(request);
    if (!caller) return reply(401, { status: 'not-signed-in' });
    const who = { session: caller.sessionId, auth_user: caller.authUserId };

    if (body.method === 'provider') {
      const proven = await provenIdentity(request, caller, body);
      if (proven === 'invalid') return reply(400, { status: 'invalid' });
      if (proven === 'invalid-token') return reply(401, { status: 'invalid-token' });
      const { provider, claims } = proven;
      const { email, email_verified } = claims as { email?: unknown; email_verified?: unknown };
      const outcome = await rpc<Outcome>('link_provider_identity', {
        ...who,
        provider,
        subject: claims.sub,
        claims: { iss: claims.iss, sub: claims.sub, ...(typeof email === 'string' ? { email, email_verified: email_verified === true } : {}) },
      });
      return finish(environment, outcome, providerLabel(provider));
    }

    if (body.method === 'email' && body.step === 'send') {
      const address = await rpc<Outcome>('email_method_address', who);
      if (address.status !== 'ready' || !address.email) return reply(STATUS_CODES[address.status] ?? 502, { status: address.status });
      return sendCode(environment, address.email, clientIp(request));
    }

    if (body.method === 'email' && typeof body.code === 'string' && /^\d{6}$/.test(body.code)) {
      // Checked again, not remembered: the account may have changed since the code was sent.
      const address = await rpc<Outcome>('email_method_address', who);
      if (address.status !== 'ready' || !address.email) return reply(STATUS_CODES[address.status] ?? 502, { status: address.status });
      if (!(await emailCodeValid(address.email, body.code, caller.authUserId))) return reply(401, { status: 'invalid-code' });
      return finish(environment, await rpc<Outcome>('link_email_identity', who), 'Email code');
    }

    return reply(400, { status: 'invalid' });
  } catch {
    console.error('link-method failed');
    return reply(502, { status: 'failed' });
  }
});

/** Answers a link's outcome, sending the security notice first when a method was added. */
async function finish(environment: string, outcome: Outcome, label: string): Promise<Response> {
  if (outcome.status !== 'linked') return reply(STATUS_CODES[outcome.status] ?? 502, { status: outcome.status });
  const delivered = outcome.email ? await deliver(outcome.email, methodLinkedMail(label), 'security') : false;
  // The method is added either way: a notice that couldn't go is logged as a failed send, never retried.
  await logSend(environment, 'method-linked', delivered);
  return reply(200, { status: 'linked' });
}

/** Emails the account's sign-in address a code, under request-code's limits. */
async function sendCode(environment: string, email: string, ip: string): Promise<Response> {
  const refused = await admitCodeRequest(environment, email, ip);
  if (refused) return refused;
  return (await sendCodeEmail(environment, email)) ? reply(200, { status: 'sent' }) : reply(502, { status: 'failed' });
}

function providerLabel(provider: string): string {
  return ({ apple: 'Apple', google: 'Google' } as Record<string, string>)[provider] ?? 'Apple or Google';
}

function methodLinkedMail(label: string): Mail {
  const text =
    `A new way to sign in was added to your Tableside account: ${label}.\n\n` +
    "If this was you, there's nothing to do. If it wasn't, open Tableside, go to More → Settings → Account → Sign-in methods, " +
    'remove it, and contact support.';
  return {
    subject: 'A sign-in method was added to your account',
    text,
    html: text
      .split('\n\n')
      .map((paragraph) => `<p>${paragraph}</p>`)
      .join(''),
  };
}
