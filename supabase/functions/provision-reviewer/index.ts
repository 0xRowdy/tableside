// Provisions a reviewer account (spec 2 Amendment 8 §6; #107): the privileged,
// per-environment operation that makes the designated synthetic accounts app
// reviewers sign in to (spec 7 decides which, and their content).
//
// POST { email }, called with this project's secret key (apikey and
// authorization) and naming its backend environment in x-tableside-environment.
//   200 { status: 'provisioned', credential }
//       A new reviewer account with an established adult eligibility record, or,
//       for an address that already is one, a new reviewer credential that
//       replaces its last. Shown only here: only its hash is kept.
//   409 { status: 'not-designated' }   the address belongs to an account (or a Create under way) this didn't make
//   403 { status: 'forbidden' }        not called with the secret key, or naming another environment
//   400 { status: 'invalid' }
//   502 { status: 'failed' }
//
// It holds no privilege of its own: every call goes out with the caller's key,
// so the database and Auth refuse a caller without the secret key. The new
// account is made the way any Create makes one: an Auth user carrying an 18+
// eligibility assertion, which the database consumes before the account opens.
// Nothing here logs an address, assertion or credential.

import { ENVIRONMENT_HEADER, reply } from '../_shared/service.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class Refused extends Error {}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return reply(400, { status: 'invalid' });
  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return reply(400, { status: 'invalid' });
  }
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return reply(400, { status: 'invalid' });

  const environment = request.headers.get(ENVIRONMENT_HEADER) ?? '';
  const authorization = request.headers.get('authorization');
  const caller = { apikey: request.headers.get('apikey') ?? '', ...(authorization ? { authorization } : {}) };
  const asCaller = async (path: string, payload: unknown): Promise<{ ok: boolean; code?: string; body: unknown }> => {
    const response = await fetch(`${SUPABASE_URL}${path}`, {
      method: 'POST',
      headers: { ...caller, 'content-type': 'application/json', [ENVIRONMENT_HEADER]: environment },
      body: JSON.stringify(payload),
    });
    const parsed = (await response.json().catch(() => null)) as { error_code?: string } | null;
    if (response.status === 401 || response.status === 403) throw new Refused();
    return { ok: response.ok, code: parsed?.error_code, body: parsed };
  };
  const issueCredential = async (): Promise<string | null> => {
    const issued = await asCaller('/rest/v1/rpc/issue_reviewer_credential', { address: email });
    if (!issued.ok) throw new Error('issue-credential');
    return typeof issued.body === 'string' ? issued.body : null;
  };

  try {
    // Already a reviewer account: a new credential, replacing the last.
    const reissued = await issueCredential();
    if (reissued) return reply(200, { status: 'provisioned', credential: reissued });

    const age = await asCaller('/rest/v1/rpc/issue_eligibility_assertion', { age_range: '18+' });
    const assertion = (age.body as { assertion?: unknown } | null)?.assertion;
    if (!age.ok || typeof assertion !== 'string') throw new Error('assertion');
    // A confirmed address opens the account at once; the app metadata (which
    // only the secret key can write) designates it as it opens.
    const created = await asCaller('/auth/v1/admin/users', {
      email,
      email_confirm: true,
      user_metadata: { eligibility_assertion: assertion, environment },
      app_metadata: { tableside_reviewer: true },
    });
    // A failed create may be a racing call for the same address that got there
    // first (Auth then answers email_exists, or a database error on its unique
    // address): it is a reviewer account if that call made it.
    const credential = await issueCredential();
    if (credential) return reply(200, { status: 'provisioned', credential });
    if (created.code === 'email_exists') return reply(409, { status: 'not-designated' });
    throw new Error(created.ok ? 'designate' : 'create-user');
  } catch (error) {
    if (error instanceof Refused) return reply(403, { status: 'forbidden' });
    console.error('provision-reviewer failed', error instanceof Error ? error.message : 'unexpected');
    return reply(502, { status: 'failed' });
  }
});
