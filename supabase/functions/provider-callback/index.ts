// The redirect URI of Apple's web flow (Sign in with Apple on Android,
// spec 2 #89): Apple's page posts its answer here (response_mode=form_post),
// and this sends the system browser back to the app.
//
// POST /provider-callback?provider=<Auth's provider name>, form fields
// `state`, `id_token` and, when the player canceled, `error`.
//
// The web account page (#106) signs in with Apple and Google the same way:
// its state ends "~web", and the browser goes back to the page's own URL in
// this environment, TABLESIDE_WEB_ACCOUNT_URL (per environment: the real
// domain is spec 7's), with the state alone. Without that setting the page's
// flows are refused.
//
// The state is "<environment>~<challenge>", the challenge being the SHA-256
// of a verifier only the initiating app holds. A verified ID token is kept
// under that challenge (public.store_provider_flow), and the browser goes back
// to this environment's own callback URL, tableside://auth/<environment>, with
// the state alone: never the token. The app redeems the token once with its
// verifier (public.redeem_provider_flow), so the callback is bound to the
// request and app that began it, and a callback for another environment is
// refused by the database. Nothing here logs a token or state.

import { verifyIdToken } from '../_shared/id-token.ts';
import { serviceRpc } from '../_shared/service.ts';

declare const Deno: { serve(handler: (request: Request) => Promise<Response>): void; env: { get(name: string): string | undefined } };

const STATE_PATTERN = /^(local|beta|production)~([0-9a-f]{64})(~web)?$/;
/** Where the web account page lives in this environment; its flows are refused without it. */
const WEB_ACCOUNT_URL = Deno.env.get('TABLESIDE_WEB_ACCOUNT_URL') ?? '';
/**
 * The providers that sign in through the browser: Apple, and the local
 * stack's test identity provider standing in for it. Only a provider with ID
 * token settings is ever accepted (_shared/id-token.ts), and beta and
 * production have none for the test provider.
 */
const BROWSER_PROVIDERS = ['apple', 'keycloak'];
/** The web account page signs in with Google through the browser too. */
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
  // Apple's cancel, or Google's (access_denied).
  if (error !== null) return back(error === 'user_cancelled_authorize' || error === 'access_denied' ? 'canceled' : 'failed');
  const idToken = String(form.get('id_token') ?? '');
  // The nonce is checked when the app uses the token (it alone holds the nonce); here only that it is the provider's, for this app.
  if (!(await verifyIdToken(provider, idToken))) return back('failed');

  // Apple's authorization code too, for the app to exchange for a revocable grant (provider-grant).
  const code = String(form.get('code') ?? '');
  const response = await serviceRpc(environment, 'store_provider_flow', { challenge, id_token: idToken, code });
  // Another environment's flow: this project never answers for it, not even with a redirect.
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
