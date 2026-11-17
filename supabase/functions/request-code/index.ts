// #88

import { admitCodeRequest, generateCode, logSend } from '../_shared/codes.ts';
import { withCors } from '../_shared/cors.ts';
import { type Mail, codeMail, deliver } from '../_shared/mail.ts';
import { StepError, clientIp, environmentOf, readJsonPost, reply, rpcJson, serviceAuth } from '../_shared/service.ts';

declare const Deno: { serve(handler: (request: Request) => Promise<Response>): void };

type Recipient = 'account' | 'other' | 'pending' | 'none';
type MailType = 'code' | 'no-account';
type Rpc = <T>(name: string, args: Record<string, unknown>) => Promise<T>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// TODO(#122)
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
  const environment = environmentOf(request);
  const rpc: Rpc = <T,>(name: string, args: Record<string, unknown>) => rpcJson<T>(environment, name, args);

  try {
    if (intent === 'create' && !(await rpc<boolean>('eligibility_assertion_usable', { assertion, address: email }))) {
      return reply(403, { status: 'age-required' });
    }
    const refused = await admitCodeRequest(environment, email, clientIp(request));
    if (refused) return refused;

    const floor = sleep(RESPONSE_FLOOR_MS);
    const recipient = await rpc<Recipient>('email_code_recipient', { address: email });
    const type: MailType = recipient === 'other' || (intent === 'sign-in' && recipient !== 'account') ? 'no-account' : 'code';
    let delivered = false;
    try {
      delivered = await deliver(email, type === 'code' ? codeMail(await issueCode({ email, recipient, assertion, environment, rpc })) : NO_ACCOUNT_MAIL);
    } catch (error) {
      logFailure(error);
    }
    await logSend(environment, type, delivered);
    await floor;
    return delivered ? reply(200, { status: 'sent' }) : reply(502, { status: 'failed' });
  } catch (error) {
    logFailure(error);
    return reply(502, { status: 'failed' });
  }
}));

function logFailure(error: unknown): void {
  console.error('request-code failed', error instanceof StepError ? error.step : 'unexpected');
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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
    if (!created.ok && created.code !== 'email_exists') throw new StepError('create-user');
  }
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
