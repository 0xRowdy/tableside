// Emailed codes, as request-code and link-method send them (#88, #100): the
// per-address and per-IP admission, a code from Auth (which sends nothing
// itself), and the send log. Nothing here logs an address or code.

import { codeMail, deliver } from './mail.ts';
import { StepError, reply, rpcJson, serviceAuth } from './service.ts';

/** The code-request limits: null when admitted, or the 429 answer saying how long to wait. */
export async function admitCodeRequest(environment: string, address: string, ip: string): Promise<Response | null> {
  const admission = await rpcJson<{ admitted: boolean; retry_after?: number }>(environment, 'admit_code_request', { address, ip });
  return admission.admitted ? null : reply(429, { status: 'rate-limited', retryAfter: admission.retry_after ?? 60 });
}

/** A fresh one-time code for the address's Auth user (Auth keeps one per user). */
export async function generateCode(email: string): Promise<string> {
  const link = await serviceAuth('/admin/generate_link', { type: 'magiclink', email });
  const code = (link.body as { email_otp?: unknown } | null)?.email_otp;
  if (!link.ok || typeof code !== 'string') throw new StepError('generate-code');
  return code;
}

/** Records that an email of `type` went out, or couldn't: never its address or body. */
export async function logSend(environment: string, type: string, delivered: boolean): Promise<void> {
  await rpcJson(environment, 'log_email_send', { type, pacing: 'immediate', outcome: delivered ? 'sent' : 'failed' });
}

/** Emails the address a fresh code and logs the send: true when it was delivered. */
export async function sendCodeEmail(environment: string, email: string): Promise<boolean> {
  const delivered = await generateCode(email).then((code) => deliver(email, codeMail(code)), () => false);
  await logSend(environment, 'code', delivered);
  return delivered;
}
