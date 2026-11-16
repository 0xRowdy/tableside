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
import { devicesSignedOutMail, sendSecurityNotice } from '../_shared/mail.ts';
import { environmentOf, readJsonPost, reply, rpcJson } from '../_shared/service.ts';

declare const Deno: { serve(handler: (request: Request) => Promise<Response>): void };

const STATUS_CODES: Readonly<Record<string, number>> = {
  'signed-out': 200,
  'fresh-authentication-required': 403,
  'not-found': 404,
  'this-device': 409,
  'not-signed-in': 401,
};

Deno.serve(async (request) => {
  const body = await readJsonPost<{ device: unknown; others: unknown }>(request);
  if (!body) return reply(400, { status: 'invalid' });
  const target = body.others === true ? 'others' : typeof body.device === 'string' && body.device ? body.device : null;
  if (!target) return reply(400, { status: 'invalid' });
  const environment = environmentOf(request);
  try {
    const caller = await callerOf(request);
    if (!caller) return reply(401, { status: 'not-signed-in' });
    const outcome = await rpcJson<{ status: string; devices?: number; email?: string | null }>(environment, 'revoke_devices', {
      session: caller.sessionId,
      auth_user: caller.authUserId,
      target,
    });
    if (outcome.status !== 'signed-out') return reply(STATUS_CODES[outcome.status] ?? 502, { status: outcome.status });
    const devices = outcome.devices ?? 0;
    if (devices > 0) await sendSecurityNotice(environment, outcome.email, devicesSignedOutMail(devices), 'device-revoked');
    return reply(200, { status: 'signed-out', devices, email: outcome.email ?? null });
  } catch {
    console.error('revoke-devices failed');
    return reply(502, { status: 'failed' });
  }
});
