// Spec 2 Deletion; #104

import { type ProviderIdentity, deletionPorts } from '../_shared/deletion-ports.ts';
import { deletionAcceptedMail, sendSecurityNotice } from '../_shared/mail.ts';
import { environmentOf, reply, rpcJson, serviceFetch } from '../_shared/service.ts';

declare const Deno: { serve(handler: (request: Request) => Promise<Response>): void };
const PRIVATE_BUCKET = 'account-private';
const MAX_STEPS_PER_WAKE = 20;

type Step =
  | { step: 'mail'; email: string | null; cleanupBy: string }
  | { step: 'objects'; paths: string[] }
  | { step: 'analytics'; ids: string[] }
  | { step: 'purchases'; customer: string }
  | { step: 'providers'; identities: ProviderIdentity[] }
  | { step: 'waiting' | 'busy' | 'complete' };

const rpc = rpcJson;

async function perform(environment: string, next: Step): Promise<Record<string, unknown>> {
  switch (next.step) {
    case 'mail':
      await sendSecurityNotice(environment, next.email, deletionAcceptedMail(next.cleanupBy), 'deletion-accepted');
      return {};
    case 'objects': {
      const removed = await serviceFetch(`/storage/v1/object/${PRIVATE_BUCKET}`, { method: 'DELETE', body: JSON.stringify({ prefixes: next.paths }) });
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

async function advance(environment: string, account: string): Promise<void> {
  for (let steps = 0; steps < MAX_STEPS_PER_WAKE; steps++) {
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
  const environment = environmentOf(request);
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
