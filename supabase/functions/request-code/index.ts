// Requests an email code (spec 2, #88): the only way the app gets one. Auth's
// own code endpoint sends nothing (private.refuse_auth_email).
//
// POST { email, intent: 'sign-in' | 'create', assertion? }, naming its backend
// environment in x-tableside-environment like every request (docs/environments.md).
//   200 { status: 'sent' }                        an email went out
//   429 { status: 'rate-limited', retryAfter }    seconds to wait
//   403 { status: 'age-required' }                Create without a usable eligibility assertion
//   502 { status: 'failed' }                      the email could not be delivered
//   400 { status: 'invalid' }                     not a request this function understands
//
// Every admitted request sends an email: the code when the address has an
// account (or a Create is under way), otherwise "No account for this address".
// The answer, and a delivery failure, read the same either way. Sign-in never
// creates an Auth user. An address reaches an account's codes only while the
// account has the email-code method for it (#100). Nothing here logs an
// address, code or token.

import { withCors } from '../_shared/cors.ts';
import { type Mail, codeMail, deliver } from '../_shared/mail.ts';
import { clientIp } from '../_shared/service.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

/** 'other': an account holds the address but signs in only with Apple or Google. */
type Recipient = 'account' | 'other' | 'pending' | 'none';
type MailType = 'code' | 'no-account';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const ENVIRONMENT_HEADER = 'x-tableside-environment';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** How long every admitted request takes at least; above the code path's own time with the local mail catcher. #122 tunes it against Resend. */
const RESPONSE_FLOOR_MS = 300;

Deno.serve(withCors(async (request) => {
  if (request.method !== 'POST') return reply(400, { status: 'invalid' });
  let body: { email?: unknown; intent?: unknown; assertion?: unknown };
  try {
    body = await request.json();
  } catch {
    return reply(400, { status: 'invalid' });
  }
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const intent = body.intent;
  if (!EMAIL_PATTERN.test(email) || email.length > 254 || (intent !== 'sign-in' && intent !== 'create')) {
    return reply(400, { status: 'invalid' });
  }
  const assertion = typeof body.assertion === 'string' ? body.assertion : '';
  // Passed on to every database call, whose pre-request hook refuses another
  // environment (or none) before anything runs; so is a new user's.
  const environment = request.headers.get(ENVIRONMENT_HEADER) ?? '';
  const rpc = <T = unknown>(name: string, args: Record<string, unknown>) => callRpc<T>(environment, name, args);

  try {
    // Create needs a usable assertion whoever owns the address, so this
    // answer reveals nothing about it either.
    if (intent === 'create' && !(await rpc<boolean>('eligibility_assertion_usable', { assertion, address: email }))) {
      return reply(403, { status: 'age-required' });
    }
    const admission = await rpc<{ admitted: boolean; retry_after?: number }>('admit_code_request', { address: email, ip: clientIp(request) });
    if (!admission.admitted) return reply(429, { status: 'rate-limited', retryAfter: admission.retry_after ?? 60 });

    // Every admitted answer waits out the same floor, so the extra work of
    // issuing a code doesn't show in how long the answer takes.
    const floor = sleep(RESPONSE_FLOOR_MS);
    const recipient = await rpc<Recipient>('email_code_recipient', { address: email });
    // Sign-in only reaches an existing account's email method; Create finishes
    // one under way, or starts one. An account without the email method gets
    // the "No account" email either way, which says to use Apple or Google.
    const type: MailType = recipient === 'other' || (intent === 'sign-in' && recipient !== 'account') ? 'no-account' : 'code';
    let delivered = false;
    try {
      delivered = await deliver(email, type === 'code' ? codeMail(await issueCode({ email, recipient, assertion, environment, rpc })) : NO_ACCOUNT_MAIL);
    } catch (error) {
      logFailure(error);
    }
    // Every failure to send, whatever the step, is a failed send of its type.
    await rpc('log_email_send', { type, pacing: 'immediate', outcome: delivered ? 'sent' : 'failed' });
    await floor;
    return delivered ? reply(200, { status: 'sent' }) : reply(502, { status: 'failed' });
  } catch (error) {
    logFailure(error);
    return reply(502, { status: 'failed' });
  }
}));

/** Only the step that failed: never an address, code or token. */
function logFailure(error: unknown): void {
  console.error('request-code failed', error instanceof StepError ? error.step : 'unexpected');
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * A fresh code for the address. Create makes the Auth user with the assertion
 * (the database consumes it), or finishes one already under way.
 * `recipient` is 'pending' or 'none' only for Create.
 */
async function issueCode({
  email,
  recipient,
  assertion,
  environment,
  rpc,
}: {
  email: string;
  recipient: Recipient;
  assertion: string;
  environment: string;
  rpc: <T>(name: string, args: Record<string, unknown>) => Promise<T>;
}): Promise<string> {
  if (recipient === 'none') {
    const created = await auth('/admin/users', { email, user_metadata: { eligibility_assertion: assertion, environment } });
    // A racing Create for the same address made the user first: send it a code too.
    if (!created.ok && created.code !== 'email_exists') throw new StepError('create-user');
  }
  // A Create still under way takes this Create's age answer, using up its assertion.
  if (recipient === 'pending' && !(await rpc<boolean>('renew_pending_eligibility', { address: email, assertion }))) {
    throw new StepError('renew-eligibility');
  }
  const link = await auth('/admin/generate_link', { type: 'magiclink', email });
  const code = (link.body as { email_otp?: unknown } | null)?.email_otp;
  if (!link.ok || typeof code !== 'string') throw new StepError('generate-code');
  return code;
}

const NO_ACCOUNT_MAIL: Mail = {
  subject: 'No account for this address',
  text:
    "Someone asked to sign in to Tableside with this address, but there's no Tableside account for it.\n\n" +
    'To start one, open Tableside and choose Create account. If you joined with Apple or Google, sign in with that instead.\n\n' +
    "If you didn't ask, you can ignore this email.",
  html:
    "<p>Someone asked to sign in to Tableside with this address, but there's no Tableside account for it.</p>" +
    '<p>To start one, open Tableside and choose <strong>Create account</strong>. If you joined with Apple or Google, sign in with that instead.</p>' +
    "<p>If you didn't ask, you can ignore this email.</p>",
};

class StepError extends Error {
  constructor(readonly step: string) {
    super(step);
  }
}

async function callRpc<T>(environment: string, name: string, args: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { ...serviceHeaders(), [ENVIRONMENT_HEADER]: environment },
    body: JSON.stringify(args),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new StepError(name);
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

async function auth(path: string, body: unknown): Promise<{ ok: boolean; code?: string; body: unknown }> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1${path}`, { method: 'POST', headers: serviceHeaders(), body: JSON.stringify(body) });
  const parsed = (await response.json().catch(() => null)) as { error_code?: string } | null;
  return { ok: response.ok, code: parsed?.error_code, body: parsed };
}

function serviceHeaders(): Record<string, string> {
  return { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' };
}

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
