// #88; #100

import { codeMail, deliver } from './mail.ts';
import { StepError, reply, rpcJson, serviceAuth } from './service.ts';

export async function admitCodeRequest(environment: string, address: string, ip: string): Promise<Response | null> {
  const admission = await rpcJson<{ admitted: boolean; retry_after?: number }>(environment, 'admit_code_request', { address, ip });
  return admission.admitted ? null : reply(429, { status: 'rate-limited', retryAfter: admission.retry_after ?? 60 });
}

export async function generateCode(email: string): Promise<string> {
  const link = await serviceAuth('/admin/generate_link', { type: 'magiclink', email });
  const code = (link.body as { email_otp?: unknown } | null)?.email_otp;
  if (!link.ok || typeof code !== 'string') throw new StepError('generate-code');
  return code;
}

export async function logSend(environment: string, type: string, delivered: boolean): Promise<void> {
  await rpcJson(environment, 'log_email_send', { type, pacing: 'immediate', outcome: delivered ? 'sent' : 'failed' });
}

export async function sendCodeEmail(environment: string, email: string): Promise<boolean> {
  const delivered = await generateCode(email).then((code) => deliver(email, codeMail(code)), () => false);
  await logSend(environment, 'code', delivered);
  return delivered;
}
