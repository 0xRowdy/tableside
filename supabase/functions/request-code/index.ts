// Requests an email code (spec 2, #88): the only way the app gets one. Auth's
// own code endpoint sends nothing (private.refuse_auth_email).
//
// POST { email, intent: 'sign-in' | 'create', assertion? }
//   200 { status: 'sent' }                        an email went out
//   429 { status: 'rate-limited', retryAfter }    seconds to wait
//   403 { status: 'age-required' }                Create without a usable eligibility assertion
//   502 { status: 'failed' }                      the email could not be delivered
//   400 { status: 'invalid' }                     not a request this function understands
//
// Every admitted request sends an email: the code when the address has an
// account (or a Create is under way), otherwise "No account for this address".
// The answer, and a delivery failure, read the same either way. Sign-in never
// creates an Auth user. Nothing here logs an address, code or token.

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

type Recipient = 'account' | 'pending' | 'none';
type MailType = 'code' | 'no-account';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
/** The local stack's mail catcher (config.toml [edge_runtime.secrets]). Production sending is #122's. */
const MAILPIT_URL = Deno.env.get('TABLESIDE_MAILPIT_URL');
const SENDER = { Email: 'codes@tableside.local', Name: 'Tableside' };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (request) => {
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

  try {
    // Create needs a usable assertion whoever owns the address, so this
    // answer reveals nothing about it either.
    if (intent === 'create' && !(await rpc<boolean>('eligibility_assertion_usable', { assertion, address: email }))) {
      return reply(403, { status: 'age-required' });
    }
    const admission = await rpc<{ admitted: boolean; retry_after?: number }>('admit_code_request', { address: email, ip: clientIp(request) });
    if (!admission.admitted) return reply(429, { status: 'rate-limited', retryAfter: admission.retry_after ?? 60 });

    const recipient = await rpc<Recipient>('email_code_recipient', { address: email });
    // Sign-in only reaches an existing account; Create finishes one under way, or starts one.
    const type: MailType = intent === 'sign-in' && recipient !== 'account' ? 'no-account' : 'code';
    let delivered = false;
    try {
      delivered = await deliver(email, type === 'code' ? codeMail(await issueCode(email, recipient, assertion)) : NO_ACCOUNT_MAIL);
    } catch (error) {
      console.error('request-code failed', error instanceof StepError ? error.step : 'unexpected');
    }
    // Every failure to send, whatever the step, is a failed send of its type.
    await rpc('log_email_send', { type, pacing: 'immediate', outcome: delivered ? 'sent' : 'failed' });
    return delivered ? reply(200, { status: 'sent' }) : reply(502, { status: 'failed' });
  } catch (error) {
    console.error('request-code failed', error instanceof StepError ? error.step : 'unexpected');
    return reply(502, { status: 'failed' });
  }
});

/**
 * A fresh code for the address. Create makes the Auth user with the assertion
 * (the database consumes it), or finishes one already under way.
 */
async function issueCode(email: string, recipient: Recipient, assertion: string): Promise<string> {
  if (recipient === 'none') {
    const created = await auth('/admin/users', { email, user_metadata: { eligibility_assertion: assertion } });
    // A racing Create for the same address made the user first: send it a code too.
    if (!created.ok && created.code !== 'email_exists') throw new StepError('create-user');
  }
  const link = await auth('/admin/generate_link', { type: 'magiclink', email });
  const code = (link.body as { email_otp?: unknown } | null)?.email_otp;
  if (!link.ok || typeof code !== 'string') throw new StepError('generate-code');
  return code;
}

interface Mail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

function codeMail(code: string): Mail {
  return {
    subject: 'Your Tableside code',
    text: `Your Tableside code is ${code}.\n\nIt works once and expires soon. If you didn't ask for it, you can ignore this email.`,
    html: `<p>Your Tableside code is <strong>${code}</strong>.</p><p>It works once and expires soon. If you didn't ask for it, you can ignore this email.</p>`,
  };
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

/** Sends one email synchronously; false when it wasn't accepted. There is no retry queue. */
async function deliver(to: string, mail: Mail): Promise<boolean> {
  if (!MAILPIT_URL) return false;
  try {
    const response = await fetch(`${MAILPIT_URL}/api/v1/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ From: SENDER, To: [{ Email: to }], Subject: mail.subject, Text: mail.text, HTML: mail.html }),
    });
    await response.body?.cancel();
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * The caller's address: the X-Forwarded-For hop the gateway added last. Earlier
 * hops come from the caller and could be anything. (Which hop is the client's on
 * the hosted platform is checked at launch gate 9.)
 */
function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'unknown';
}

class StepError extends Error {
  constructor(readonly step: string) {
    super(step);
  }
}

async function rpc<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: serviceHeaders(),
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
