// A request to the backend outside the Supabase client, as both the Account
// service and the web account page send them: naming the build's
// environment, as every request does (the server rejects a mismatch).

import { type BackendEnvironment, ENVIRONMENT_HEADER } from './environment';

export function backendPost(fetcher: typeof fetch, backend: BackendEnvironment, path: string, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return fetcher(`${backend.url}${path}`, {
    method: 'POST',
    headers: { apikey: backend.publishableKey, [ENVIRONMENT_HEADER]: backend.name, 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}
