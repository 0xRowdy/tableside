// The redirect URI of Apple's web flow (Sign in with Apple on Android,
// spec 2 #89): Apple's page posts its answer here (response_mode=form_post),
// and this sends the system browser back to the app.
//
// POST /provider-callback?provider=<Auth's provider name>, form fields
// `state`, `id_token` and, when the player cancelled, `error`.
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

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ENVIRONMENT_HEADER = 'x-tableside-environment';
const STATE_PATTERN = /^(local|beta|production)~([0-9a-f]{64})$/;
/** The providers that sign in through the browser: Apple, and locally the test identity provider standing in for it. */
const BROWSER_PROVIDERS = ['apple', 'keycloak'];

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
  if (!match || !BROWSER_PROVIDERS.includes(provider)) return refuse();
  const [, environment, challenge] = match as unknown as [string, string, string];
  const back = (outcome?: 'cancelled' | 'failed') =>
    new Response(null, {
      status: 303,
      headers: { location: `tableside://auth/${environment}?state=${encodeURIComponent(state)}${outcome ? `&error=${outcome}` : ''}` },
    });

  const error = form.get('error');
  if (error !== null) return back(error === 'user_cancelled_authorize' ? 'cancelled' : 'failed');
  const idToken = String(form.get('id_token') ?? '');
  // The nonce is checked when the app uses the token (it alone holds the nonce); here only that it is the provider's, for this app.
  if (!(await verifyIdToken(provider, idToken))) return back('failed');

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/store_provider_flow`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json', [ENVIRONMENT_HEADER]: environment },
    body: JSON.stringify({ challenge, id_token: idToken }),
  });
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
