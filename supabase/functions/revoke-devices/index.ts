// Spec 2 S2-19; #101

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
