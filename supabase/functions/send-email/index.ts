// Auth's send-email hook (config.toml [auth.hook.send_email]): the only
// email Auth sends itself is Secure Email Change's pair of codes, one to the
// current address and one to the new (spec 2, #100). Everything else Auth
// would send (sign-in codes, magic links, reauthentication) is refused:
// sign-in codes come only from request-code, under its limits.
//
// An email change goes out only when the account's freshly authenticated
// session authorized that exact address first (authorize_email_change_v1);
// otherwise nothing is sent and Auth's request fails. The database trigger on
// auth.users refuses the change itself too.
//
// Auth signs every call (Standard Webhooks, with the hook secret), and the
// hook URI names the backend environment, which every database call names in
// turn. Nothing here logs an address or code.

import { codeMail, deliver } from '../_shared/mail.ts';
import { serviceRpc } from '../_shared/service.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

const HOOK_SECRET = Deno.env.get('TABLESIDE_SEND_EMAIL_HOOK_SECRET') ?? '';
/** How far a signature's timestamp may be from now, as Standard Webhooks allows. */
const TOLERANCE_SECONDS = 5 * 60;

interface HookPayload {
  readonly user?: { readonly id?: unknown; readonly email?: unknown; readonly new_email?: unknown };
  readonly email_data?: { readonly email_action_type?: unknown; readonly token?: unknown; readonly token_new?: unknown };
}

Deno.serve(async (request) => {
  const body = await request.text();
  if (!(await signedByAuth(request.headers, body))) return refuse(401, 'invalid signature');
  let payload: HookPayload;
  try {
    payload = JSON.parse(body) as HookPayload;
  } catch {
    return refuse(400, 'invalid payload');
  }
  const { user, email_data: data } = payload;
  if (data?.email_action_type !== 'email_change') return refuse(422, 'email codes are requested through request-code');

  const environment = new URL(request.url).searchParams.get('environment') ?? '';
  const { id, email: current, new_email: next } = user ?? {};
  const { token, token_new: tokenNew } = data;
  if (typeof id !== 'string' || typeof current !== 'string' || typeof next !== 'string' || typeof token !== 'string' || typeof tokenNew !== 'string') {
    return refuse(422, 'email changes confirm both addresses');
  }
  try {
    const authorized = await serviceRpc(environment, 'email_change_authorized', { auth_user: id, address: next });
    const allowed = authorized.ok ? (await authorized.json()) === true : (await authorized.body?.cancel(), false);
    if (!allowed) return refuse(403, 'fresh_authentication_required');
    // Secure Email Change: the current address confirms with `token`, the new one with `token_new`.
    const sent = [
      await deliver(current, codeMail(token, 'Confirm your Tableside email change')),
      await deliver(next, codeMail(tokenNew, 'Confirm your new Tableside email')),
    ];
    for (const ok of sent) {
      const logged = await serviceRpc(environment, 'log_email_send', { type: 'email-change', pacing: 'immediate', outcome: ok ? 'sent' : 'failed' });
      await logged.body?.cancel();
    }
    // Both or nothing: a change only one address heard of could never complete.
    return sent.every(Boolean) ? new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }) : refuse(502, 'email could not be delivered');
  } catch {
    console.error('send-email failed');
    return refuse(502, 'email could not be delivered');
  }
});

/** Auth's hook error format: Auth answers its own caller with this status and message. */
function refuse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { http_code: status, message } }), { status, headers: { 'content-type': 'application/json' } });
}

/** Standard Webhooks: HMAC-SHA256 over "id.timestamp.body", keyed with the secret after "v1,whsec_", in base64. */
async function signedByAuth(headers: Headers, body: string): Promise<boolean> {
  const id = headers.get('webhook-id');
  const timestamp = headers.get('webhook-timestamp');
  const signatures = headers.get('webhook-signature');
  const secret = HOOK_SECRET.replace(/^v1,whsec_/, '');
  if (!id || !timestamp || !signatures || !secret) return false;
  if (!/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > TOLERANCE_SECONDS) return false;
  try {
    const key = await crypto.subtle.importKey('raw', Uint8Array.from(atob(secret), (c) => c.charCodeAt(0)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${body}`)));
    const expected = btoa(String.fromCharCode(...mac));
    return signatures.split(' ').some((signature) => constantTimeEqual(signature.replace(/^v1,/, ''), expected));
  } catch {
    return false;
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
