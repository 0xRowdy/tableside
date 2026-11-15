// Global Privacy Control on the web account page (spec 2 Amendment 8 §5,
// #106): when a signed-in visitor's browser sends GPC, the ad-data opt-out is
// recorded with source GPC. The signal is the browser's own Sec-GPC request
// header, which no page script can set, so the source recorded is what the
// browser said. An account whose ad data is already limited keeps its choice.
//
// POST, with the caller's own access token as the bearer and naming its
// backend environment in x-tableside-environment like every request, from a
// browser sending Sec-GPC: 1. Answers:
//   200 { status: 'recorded' | 'already-limited' }
//   400 { status: 'no-signal' }        the request carries no Sec-GPC: 1
//   401 { status: 'not-signed-in' }
//   400 { status: 'invalid' } | 502 { status: 'failed' }
//
// Nothing here logs a token.

import { callerOf } from '../_shared/caller.ts';
import { withCors } from '../_shared/cors.ts';
import { environmentOf, reply, serviceRpc } from '../_shared/service.ts';

declare const Deno: { serve(handler: (request: Request) => Promise<Response>): void };

Deno.serve(
  withCors(async (request) => {
    if (request.method !== 'POST') return reply(400, { status: 'invalid' });
    if (request.headers.get('sec-gpc')?.trim() !== '1') return reply(400, { status: 'no-signal' });
    try {
      const caller = await callerOf(request);
      if (!caller) return reply(401, { status: 'not-signed-in' });
      const response = await serviceRpc(environmentOf(request), 'record_gpc_opt_out', {
        session: caller.sessionId,
        auth_user: caller.authUserId,
      });
      if (!response.ok) {
        await response.body?.cancel();
        console.error('record-gpc failed', response.status);
        return reply(502, { status: 'failed' });
      }
      const status = ((await response.json()) as { status?: string }).status;
      if (status === 'recorded' || status === 'already-limited') return reply(200, { status });
      return reply(401, { status: 'not-signed-in' });
    } catch {
      console.error('record-gpc failed', 'unexpected');
      return reply(502, { status: 'failed' });
    }
  }),
);
