// #89; #106

import { verifyIdToken } from '../_shared/id-token.ts';
import { serviceRpc } from '../_shared/service.ts';

declare const Deno: { serve(handler: (request: Request) => Promise<Response>): void; env: { get(name: string): string | undefined } };

const STATE_PATTERN = /^(local|beta|production)~([0-9a-f]{64})(~web)?$/;
const WEB_ACCOUNT_URL = Deno.env.get('TABLESIDE_WEB_ACCOUNT_URL') ?? '';
const BROWSER_PROVIDERS = ['apple', 'keycloak'];
const WEB_PROVIDERS = [...BROWSER_PROVIDERS, 'google'];

Deno.serve(async (request) => {
  if (request.method !== 'POST') return refuse();
  const provider = new URL(request.url).searchParams.get('provider') ?? '';
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return refuse();
  }
  const state = String(form.get('state') ?? '');
  const match = STATE_PATTERN.exec(state);
  const web = match?.[3] === '~web';
  if (!match || !(web ? WEB_PROVIDERS : BROWSER_PROVIDERS).includes(provider) || (web && !WEB_ACCOUNT_URL)) return refuse();
  const [, environment, challenge] = match as unknown as [string, string, string];
  const returnTo = web ? WEB_ACCOUNT_URL : `tableside://auth/${environment}`;
  const back = (outcome?: 'canceled' | 'failed') =>
    new Response(null, {
      status: 303,
      headers: { location: `${returnTo}?state=${encodeURIComponent(state)}${outcome ? `&error=${outcome}` : ''}` },
    });

  const error = form.get('error');
  if (error !== null) return back(error === 'user_cancelled_authorize' || error === 'access_denied' ? 'canceled' : 'failed');
  const idToken = String(form.get('id_token') ?? '');
  if (!(await verifyIdToken(provider, idToken))) return back('failed');

  const code = String(form.get('code') ?? '');
  const response = await serviceRpc(environment, 'store_provider_flow', { challenge, id_token: idToken, code });
  if (response.status === 403) {
    await response.body?.cancel();
    return refuse();
  }
  if (!response.ok) {
    await response.body?.cancel();
    console.error('provider-callback failed', response.status);
    return back('failed');
  }
  return (await response.json()) === true ? back() : back('failed');
});

function refuse(): Response {
  return new Response('Not a sign-in this service started.', { status: 400, headers: { 'content-type': 'text/plain' } });
}
