// What the account functions share: a database function called with the
// service role, naming the backend environment the request named (the
// database's pre-request hook refuses another environment, or none, before
// anything runs), and a JSON reply.

declare const Deno: { env: { get(name: string): string | undefined } };

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
export const ENVIRONMENT_HEADER = 'x-tableside-environment';

export function serviceRpc(environment: string, name: string, args: Record<string, unknown>): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json', [ENVIRONMENT_HEADER]: environment },
    body: JSON.stringify(args),
  });
}

/** An Auth endpoint called with the service role (admin calls, and verifying a code this function issued). */
export async function serviceAuth(path: string, body: unknown): Promise<{ readonly ok: boolean; readonly code?: string; readonly body: unknown }> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const parsed = (await response.json().catch(() => null)) as { error_code?: string } | null;
  return { ok: response.ok, code: parsed?.error_code, body: parsed };
}

export function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/**
 * The caller's address: the X-Forwarded-For hop the gateway added last. Earlier
 * hops come from the caller and could be anything. (Which hop is the client's on
 * the hosted platform is checked at launch gate 9.)
 */
export function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'unknown';
}
