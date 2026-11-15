// Provider revocation (spec 2, #101): Apple's server-to-server notifications
// and Google's security events (Cross-Account Protection) say a player
// stopped using their Apple ID or Google account with Tableside, or that
// Apple stopped forwarding to a private relay address. Each is a JWT the
// provider signed; once it checks out, apply_provider_revocation disables
// that sign-in method and revokes the sessions signed in with it. The
// account is never deleted. A security email tells the account.
//
// Apple and Google call it with no Supabase key, at the URL registered with
// each, which names the provider (Auth's name for it) and this project's
// environment: /functions/v1/provider-notifications?provider=apple&environment=production
//   Apple:  POST { "payload": "<JWT>" }, the event in its `events` claim (a JSON string)
//   Google: POST the JWT itself (application/secevent+jwt), events keyed by type in `events`
// Answers 202 for any event that checks out (even one for nobody Tableside
// knows, so the answer tells nothing), 400 for one that doesn't, 502 when
// it couldn't be applied (the provider retries).
//
// The keys, issuer and audiences are those of the provider's ID tokens
// (TABLESIDE_ID_TOKEN_<PROVIDER>_*, see _shared/id-token.ts). Qualified
// against Apple's and Google's live endpoints at launch gate 3.
//
// Nothing here logs a token, subject, address or claim.

import { verifyProviderJwt } from '../_shared/id-token.ts';
import { deliver, devicesSignedOutMail } from '../_shared/mail.ts';
import { reply, serviceRpc } from '../_shared/service.ts';

declare const Deno: { serve(handler: (request: Request) => Promise<Response>): void };

/** How long after it was issued an event is still taken: older ones (replays included) are refused. */
const MAX_AGE_SECONDS = 24 * 60 * 60;
const LEEWAY_SECONDS = 300;

/** Google's security event types that withdraw the account from Tableside (Cross-Account Protection). */
const RISC = 'https://schemas.openid.net/secevent/risc/event-type/';
const GOOGLE_WITHDRAWALS = ['sessions-revoked', 'tokens-revoked', 'account-disabled', 'account-purged'].map((type) => RISC + type);

interface Revocation {
  readonly event: 'consent-revoked' | 'relay-disabled';
  readonly subject: string;
  readonly address?: string;
}

Deno.serve(async (request) => {
  const url = new URL(request.url);
  const provider = url.searchParams.get('provider') ?? '';
  const environment = url.searchParams.get('environment') ?? '';
  if (request.method !== 'POST' || !/^[a-z]+$/.test(provider)) return reply(400, { status: 'invalid' });

  const body = (await request.text().catch(() => '')).trim();
  let token = body;
  if (body.startsWith('{')) {
    try {
      const payload = (JSON.parse(body) as { payload?: unknown }).payload;
      token = typeof payload === 'string' ? payload : '';
    } catch {
      token = '';
    }
  }
  const claims = token ? await verifyProviderJwt(provider, token) : null;
  const now = Date.now() / 1000;
  if (!claims || typeof claims.iat !== 'number' || claims.iat > now + LEEWAY_SECONDS || claims.iat < now - MAX_AGE_SECONDS) {
    return reply(400, { status: 'invalid' });
  }
  const eventId = typeof claims.jti === 'string' && claims.jti ? claims.jti : null;
  if (!eventId) return reply(400, { status: 'invalid' });

  const revocation = revocationOf(claims.events);
  if (!revocation) return reply(202, { status: 'accepted' });
  try {
    const response = await serviceRpc(environment, 'apply_provider_revocation', {
      provider,
      subject: revocation.subject,
      event: revocation.event,
      event_id: eventId,
      address: revocation.address ?? null,
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('apply_provider_revocation');
    }
    const outcome = (await response.json()) as { status: string; devices?: number; email?: string | null };
    if (outcome.status === 'applied') {
      const method = revocation.event === 'relay-disabled' ? 'Email code at your private relay address' : providerName(provider);
      const delivered = outcome.email ? await deliver(outcome.email, devicesSignedOutMail(outcome.devices ?? 0, method), 'security') : false;
      const logged = await serviceRpc(environment, 'log_email_send', { type: 'device-revoked', pacing: 'immediate', outcome: delivered ? 'sent' : 'failed' });
      await logged.body?.cancel();
    }
    return reply(202, { status: 'accepted' });
  } catch {
    console.error('provider-notifications failed');
    return reply(502, { status: 'failed' });
  }
});

/** The revocation an event's `events` claim describes, in Apple's form or Google's; null for any other event. */
function revocationOf(events: unknown): Revocation | null {
  // Apple: a JSON string { type, sub, email? }.
  if (typeof events === 'string') {
    let apple: { type?: unknown; sub?: unknown; email?: unknown };
    try {
      apple = JSON.parse(events);
    } catch {
      return null;
    }
    if (typeof apple.sub !== 'string' || !apple.sub) return null;
    if (apple.type === 'consent-revoked' || apple.type === 'account-delete') return { event: 'consent-revoked', subject: apple.sub };
    if (apple.type === 'email-disabled' && typeof apple.email === 'string') return { event: 'relay-disabled', subject: apple.sub, address: apple.email };
    return null;
  }
  // Google: { "<event type URI>": { subject: { subject_type: 'iss-sub', sub } } }.
  if (events && typeof events === 'object') {
    for (const type of GOOGLE_WITHDRAWALS) {
      const subject = (events as Record<string, { subject?: { subject_type?: unknown; sub?: unknown } } | undefined>)[type]?.subject;
      if (subject?.subject_type === 'iss-sub' && typeof subject.sub === 'string' && subject.sub) return { event: 'consent-revoked', subject: subject.sub };
    }
  }
  return null;
}

function providerName(provider: string): string {
  return ({ apple: 'Sign in with Apple', google: 'Sign in with Google' } as Record<string, string>)[provider] ?? 'Your Apple or Google sign-in';
}
