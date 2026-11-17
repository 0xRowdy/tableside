// Spec 2 Amendment 8 §6; #107

import { ENVIRONMENT_HEADER, StepError, environmentOf, readJsonPost, reply } from '../_shared/service.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class Refused extends Error {}

Deno.serve(async (request) => {
  const body = await readJsonPost<{ email: unknown }>(request);
  if (!body) return reply(400, { status: 'invalid' });
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return reply(400, { status: 'invalid' });

  const environment = environmentOf(request);
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
    if (!issued.ok) throw new StepError('issue-credential');
    return typeof issued.body === 'string' ? issued.body : null;
  };

  try {
    const reissued = await issueCredential();
    if (reissued) return reply(200, { status: 'provisioned', credential: reissued });

    const age = await asCaller('/rest/v1/rpc/issue_eligibility_assertion', { age_range: '18+' });
    const assertion = (age.body as { assertion?: unknown } | null)?.assertion;
    if (!age.ok || typeof assertion !== 'string') throw new StepError('assertion');
    const created = await asCaller('/auth/v1/admin/users', {
      email,
      email_confirm: true,
      user_metadata: { eligibility_assertion: assertion, environment },
      app_metadata: { tableside_reviewer: true },
    });
    const credential = await issueCredential();
    if (credential) return reply(200, { status: 'provisioned', credential });
    if (created.code === 'email_exists') return reply(409, { status: 'not-designated' });
    throw new StepError(created.ok ? 'designate' : 'create-user');
  } catch (error) {
    if (error instanceof Refused) return reply(403, { status: 'forbidden' });
    console.error('provision-reviewer failed', error instanceof StepError ? error.step : 'unexpected');
    return reply(502, { status: 'failed' });
  }
});
