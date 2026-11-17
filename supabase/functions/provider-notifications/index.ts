// #101
// docs/account-service.md Apple and Google

import { verifyProviderJwt } from '../_shared/id-token.ts';
import { devicesSignedOutMail, sendSecurityNotice } from '../_shared/mail.ts';
import { reply, serviceRpc } from '../_shared/service.ts';

declare const Deno: { serve(handler: (request: Request) => Promise<Response>): void };

const MAX_AGE_SECONDS = 24 * 60 * 60;
const LEEWAY_SECONDS = 300;

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
      await sendSecurityNotice(environment, outcome.email, devicesSignedOutMail(outcome.devices ?? 0, method), 'device-revoked');
    }
    return reply(202, { status: 'accepted' });
  } catch {
    console.error('provider-notifications failed');
    return reply(502, { status: 'failed' });
  }
});

function revocationOf(events: unknown): Revocation | null {
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
