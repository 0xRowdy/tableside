// Sign out another device, or all other devices (spec 2, #101; S2-19), after
// the player confirmed it's them (fresh-auth). Every session of that device
// (or every session but this one) is revoked at once: the device locks the
// next time it reaches the server, keeping its records. The account gets a
// security email either way.
//
// POST, with the caller's own access token as the bearer and naming its
// backend environment in x-tableside-environment like every request:
//   { device }        a device ID from devices_v1
//   { others: true }  every device but this one
// Answers:
//   200 { status: 'signed-out', devices, email }  how many devices were signed out; the email went to `email`
//   403 { status: 'fresh-authentication-required' }
//   404 { status: 'not-found' }                   no such device signed in to the account
//   409 { status: 'this-device' }                 the caller's own device: that is Sign out
//   401 { status: 'not-signed-in' }
//   400 { status: 'invalid' } | 502 { status: 'failed' }
//
// Nothing here logs a token, device or address.

import { callerOf } from '../_shared/caller.ts';
import { deliver, devicesSignedOutMail } from '../_shared/mail.ts';
import { ENVIRONMENT_HEADER, reply, serviceRpc } from '../_shared/service.ts';

declare const Deno: { serve(handler: (request: Request) => Promise<Response>): void };

const STATUS_CODES: Readonly<Record<string, number>> = {
  'signed-out': 200,
  'fresh-authentication-required': 403,
  'not-found': 404,
  'this-device': 409,
  'not-signed-in': 401,
};

Deno.serve(async (request) => {
  if (request.method !== 'POST') return reply(400, { status: 'invalid' });
  let body: { device?: unknown; others?: unknown };
  try {
    body = await request.json();
  } catch {
    return reply(400, { status: 'invalid' });
  }
  const target = body.others === true ? 'others' : typeof body.device === 'string' && body.device ? body.device : null;
  if (!target) return reply(400, { status: 'invalid' });
  const environment = request.headers.get(ENVIRONMENT_HEADER) ?? '';
  try {
    const caller = await callerOf(request);
    if (!caller) return reply(401, { status: 'not-signed-in' });
    const response = await serviceRpc(environment, 'revoke_devices', { session: caller.sessionId, auth_user: caller.authUserId, target });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('revoke_devices');
    }
    const outcome = (await response.json()) as { status: string; devices?: number; email?: string | null };
    if (outcome.status !== 'signed-out') return reply(STATUS_CODES[outcome.status] ?? 502, { status: outcome.status });
    const devices = outcome.devices ?? 0;
    if (devices > 0) {
      const delivered = outcome.email ? await deliver(outcome.email, devicesSignedOutMail(devices), 'security') : false;
      // The devices are signed out either way: a notice that couldn't go is logged as a failed send, never retried.
      const logged = await serviceRpc(environment, 'log_email_send', { type: 'device-revoked', pacing: 'immediate', outcome: delivered ? 'sent' : 'failed' });
      await logged.body?.cancel();
    }
    return reply(200, { status: 'signed-out', devices, email: outcome.email ?? null });
  } catch {
    console.error('revoke-devices failed');
    return reply(502, { status: 'failed' });
  }
});
