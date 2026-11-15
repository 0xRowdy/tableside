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

import { admitCodeRequest, generateCode, logSend } from '../_shared/codes.ts';
import { withCors } from '../_shared/cors.ts';
import { type Mail, codeMail, deliver } from '../_shared/mail.ts';
import { StepError, clientIp, environmentOf, readJsonPost, reply, rpcJson, serviceAuth } from '../_shared/service.ts';

declare const Deno: { serve(handler: (request: Request) => Promise<Response>): void };

/** 'other': an account holds the address but signs in only with Apple or Google. */
type Recipient = 'account' | 'other' | 'pending' | 'none';
type MailType = 'code' | 'no-account';
type Rpc = <T>(name: string, args: Record<string, unknown>) => Promise<T>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** How long every admitted request takes at least; above the code path's own time with the local mail catcher. #122 tunes it against Resend. */
const RESPONSE_FLOOR_MS = 300;

Deno.serve(withCors(async (request) => {
  const body = await readJsonPost<{ email: unknown; intent: unknown; assertion: unknown }>(request);
  if (!body) return reply(400, { status: 'invalid' });
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const intent = body.intent;
  if (!EMAIL_PATTERN.test(email) || email.length > 254 || (intent !== 'sign-in' && intent !== 'create')) {
    return reply(400, { status: 'invalid' });
  }
  const assertion = typeof body.assertion === 'string' ? body.assertion : '';
  // Passed on to every database call, whose pre-request hook refuses another
  // environment (or none) before anything runs; so is a new user's.
  const environment = environmentOf(request);
  const rpc: Rpc = <T,>(name: string, args: Record<string, unknown>) => rpcJson<T>(environment, name, args);

  try {
    // Create needs a usable assertion whoever owns the address, so this
    // answer reveals nothing about it either.
    if (intent === 'create' && !(await rpc<boolean>('eligibility_assertion_usable', { assertion, address: email }))) {
      return reply(403, { status: 'age-required' });
    }
    const refused = await admitCodeRequest(environment, email, clientIp(request));
    if (refused) return refused;

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
    await logSend(environment, type, delivered);
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
  rpc: Rpc;
}): Promise<string> {
  if (recipient === 'none') {
    const created = await serviceAuth('/admin/users', { email, user_metadata: { eligibility_assertion: assertion, environment } });
    // A racing Create for the same address made the user first: send it a code too.
    if (!created.ok && created.code !== 'email_exists') throw new StepError('create-user');
  }
  // A Create still under way takes this Create's age answer, using up its assertion.
  if (recipient === 'pending' && !(await rpc<boolean>('renew_pending_eligibility', { address: email, assertion }))) {
    throw new StepError('renew-eligibility');
  }
  return generateCode(email);
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
