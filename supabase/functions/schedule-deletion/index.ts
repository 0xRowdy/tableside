// Schedule deletion with a 30-day undo (spec 2, #103; S2-22), after the player
// confirmed it's them (fresh-auth). The account locks at once with a
// server-set deadline; sessions, methods and data stay until then. The request
// that schedules it sends the "deletion scheduled" email (deadline and undo);
// a retry with the same operation ID, or a request while deletion is already
// scheduled, answers the schedule as it stands and sends nothing.
//
// POST, with the caller's own access token as the bearer and naming its
// backend environment in x-tableside-environment like every request:
//   { operationId }   32 hex characters, the same for every retry of one request
// Answers:
//   200 { status: 'scheduled', deadline, scheduledAt }
//   403 { status: 'fresh-authentication-required' }
//   401 { status: 'not-signed-in' }
//   400 { status: 'invalid' } | 502 { status: 'failed' }
//
// Nothing here logs a token or address.

import { callerOf } from '../_shared/caller.ts';
import { deletionScheduledMail, sendSecurityNotice } from '../_shared/mail.ts';
import { ENVIRONMENT_HEADER, reply, serviceRpc } from '../_shared/service.ts';

declare const Deno: { serve(handler: (request: Request) => Promise<Response>): void };

const STATUS_CODES: Readonly<Record<string, number>> = {
  scheduled: 200,
  'fresh-authentication-required': 403,
  'not-signed-in': 401,
};

Deno.serve(async (request) => {
  if (request.method !== 'POST') return reply(400, { status: 'invalid' });
  let body: { operationId?: unknown };
  try {
    body = await request.json();
  } catch {
    return reply(400, { status: 'invalid' });
  }
  const operationId = typeof body.operationId === 'string' && /^[0-9a-f]{32}$/.test(body.operationId) ? body.operationId : null;
  if (!operationId) return reply(400, { status: 'invalid' });
  const environment = request.headers.get(ENVIRONMENT_HEADER) ?? '';
  try {
    const caller = await callerOf(request);
    if (!caller) return reply(401, { status: 'not-signed-in' });
    const response = await serviceRpc(environment, 'schedule_deletion', {
      session: caller.sessionId,
      auth_user: caller.authUserId,
      operation_id: operationId,
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('schedule_deletion');
    }
    const outcome = (await response.json()) as { status: string; deadline?: string; scheduledAt?: string; accepted?: boolean; email?: string | null };
    if (outcome.status !== 'scheduled' || !outcome.deadline) return reply(STATUS_CODES[outcome.status] ?? 502, { status: outcome.status });
    if (outcome.accepted) await sendSecurityNotice(environment, outcome.email, deletionScheduledMail(outcome.deadline), 'deletion-scheduled');
    return reply(200, { status: 'scheduled', deadline: outcome.deadline, scheduledAt: outcome.scheduledAt });
  } catch {
    console.error('schedule-deletion failed');
    return reply(502, { status: 'failed' });
  }
});
