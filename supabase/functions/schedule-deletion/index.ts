// Spec 2 S2-22; #103

import { callerOf } from '../_shared/caller.ts';
import { withCors } from '../_shared/cors.ts';
import { deletionScheduledMail, sendSecurityNotice } from '../_shared/mail.ts';
import { environmentOf, readJsonPost, reply, rpcJson } from '../_shared/service.ts';

declare const Deno: { serve(handler: (request: Request) => Promise<Response>): void };

const STATUS_CODES: Readonly<Record<string, number>> = {
  scheduled: 200,
  'fresh-authentication-required': 403,
  'not-signed-in': 401,
};

Deno.serve(withCors(async (request) => {
  const body = await readJsonPost<{ operationId: unknown }>(request);
  if (!body) return reply(400, { status: 'invalid' });
  const operationId = typeof body.operationId === 'string' && /^[0-9a-f]{32}$/.test(body.operationId) ? body.operationId : null;
  if (!operationId) return reply(400, { status: 'invalid' });
  const environment = environmentOf(request);
  try {
    const caller = await callerOf(request);
    if (!caller) return reply(401, { status: 'not-signed-in' });
    const outcome = await rpcJson<{ status: string; deadline?: string; scheduledAt?: string; accepted?: boolean; email?: string | null }>(environment, 'schedule_deletion', {
      session: caller.sessionId,
      auth_user: caller.authUserId,
      operation_id: operationId,
    });
    if (outcome.status === 'none') return reply(409, { status: 'not-scheduled' });
    if (outcome.status !== 'scheduled' || !outcome.deadline) return reply(STATUS_CODES[outcome.status] ?? 502, { status: outcome.status });
    if (outcome.accepted) await sendSecurityNotice(environment, outcome.email, deletionScheduledMail(outcome.deadline), 'deletion-scheduled');
    return reply(200, { status: 'scheduled', deadline: outcome.deadline, scheduledAt: outcome.scheduledAt });
  } catch {
    console.error('schedule-deletion failed');
    return reply(502, { status: 'failed' });
  }
}));
