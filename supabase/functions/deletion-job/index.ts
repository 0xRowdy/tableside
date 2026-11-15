// The deletion job (spec 2, #104): runs the cleanup after the irreversible
// boundary, step by step, for every deleted account whose cleanup is due.
// The database wakes it (pg_net, after the boundary and from the
// deletion-upkeep cron); a wake carries no authority, since the work comes
// from the database with the service role.
//
// POST, naming the backend environment in x-tableside-environment. Answers
// 200 { advanced } or 502 { status: 'failed' }.
//
// advance_deletion runs the database's own steps and hands back the first
// that needs a service outside it (the "permanent deletion accepted" email,
// the Storage API, the analytics provider, RevenueCat, Apple and Google); this does it and
// reports back. A failure is reported and retried later with backoff: the
// account stays deleted, and the status shows the delay. Nothing here logs
// an address, account, identifier or token.

import { type ProviderIdentity, deletionPorts } from '../_shared/deletion-ports.ts';
import { deletionAcceptedMail, sendSecurityNotice } from '../_shared/mail.ts';
import { ENVIRONMENT_HEADER, reply, serviceRpc } from '../_shared/service.ts';

declare const Deno: { serve(handler: (request: Request) => Promise<Response>): void; env: { get(name: string): string | undefined } };

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
/** The bucket of the account's own objects (its folder is the account ID). */
const PRIVATE_BUCKET = 'account-private';
/** External steps per account per wake: every step once, with room for several pages of objects; the rest wait for the next wake. */
const MAX_STEPS = 20;

type Step =
  | { step: 'mail'; email: string | null; cleanupBy: string }
  | { step: 'objects'; paths: string[] }
  | { step: 'analytics'; ids: string[] }
  | { step: 'purchases'; customer: string }
  | { step: 'providers'; identities: ProviderIdentity[] }
  | { step: 'waiting' | 'busy' | 'complete' };

async function rpc<T>(environment: string, name: string, args: Record<string, unknown>): Promise<T> {
  const response = await serviceRpc(environment, name, args);
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(name);
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** Does the external step; its outcome for deletion_step_done. */
async function perform(environment: string, next: Step): Promise<Record<string, unknown>> {
  switch (next.step) {
    case 'mail':
      await sendSecurityNotice(environment, next.email, deletionAcceptedMail(next.cleanupBy), 'deletion-accepted');
      return {};
    case 'objects': {
      // Through the Storage API, which removes the files with their rows (the database can't).
      const removed = await fetch(`${SUPABASE_URL}/storage/v1/object/${PRIVATE_BUCKET}`, {
        method: 'DELETE',
        headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ prefixes: next.paths }),
      });
      await removed.body?.cancel();
      if (!removed.ok) throw new Error('objects');
      return {};
    }
    case 'analytics':
      return { completed: (await deletionPorts.requestAnalyticsErasure(next.ids)).completed };
    case 'purchases':
      await deletionPorts.deleteRevenueCatCustomer(next.customer);
      return {};
    case 'providers': {
      let outcome: 'revoked' | 'not-held' = 'revoked';
      for (const identity of next.identities) {
        if ((await deletionPorts.revokeProviderGrant(identity)) === 'not-held') outcome = 'not-held';
      }
      return { outcome };
    }
    default:
      return {};
  }
}

/** Runs one account's cleanup as far as it can go now. */
async function advance(environment: string, account: string): Promise<void> {
  for (let steps = 0; steps < MAX_STEPS; steps++) {
    const next = await rpc<Step>(environment, 'advance_deletion', { account });
    if (next.step === 'waiting' || next.step === 'busy' || next.step === 'complete') return;
    try {
      const outcome = await perform(environment, next);
      await rpc(environment, 'deletion_step_done', { account, step: next.step, outcome });
    } catch {
      console.error('deletion step failed', next.step);
      await rpc(environment, 'deletion_step_failed', { account }).catch(() => null);
      return;
    }
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return reply(400, { status: 'invalid' });
  await request.body?.cancel();
  const environment = request.headers.get(ENVIRONMENT_HEADER) ?? '';
  try {
    const due = await rpc<string[]>(environment, 'deletions_due', {});
    for (const account of due) {
      await advance(environment, account).catch(() => console.error('deletion advance failed'));
    }
    return reply(200, { advanced: due.length });
  } catch {
    console.error('deletion job failed');
    return reply(502, { status: 'failed' });
  }
});
