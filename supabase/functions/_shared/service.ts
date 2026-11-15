// What the account functions share: a database function called with the
// service role, naming the backend environment the request named (the
// database's pre-request hook refuses another environment, or none, before
// anything runs), reading the request, and a JSON reply.

declare const Deno: { env: { get(name: string): string | undefined } };

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
export const ENVIRONMENT_HEADER = 'x-tableside-environment';

/** A request to this project with the service role (`path` from the project URL: /rest/v1/…, /auth/v1/…, /storage/v1/…). */
export function serviceFetch(path: string, init: { method?: string; body?: BodyInit; headers?: Record<string, string> } = {}): Promise<Response> {
  return fetch(`${SUPABASE_URL}${path}`, {
    method: init.method ?? 'POST',
    headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json', ...init.headers },
    ...(init.body !== undefined ? { body: init.body } : {}),
  });
}

export function serviceRpc(environment: string, name: string, args: Record<string, unknown>): Promise<Response> {
  return serviceFetch(`/rest/v1/rpc/${name}`, { body: JSON.stringify(args), headers: { [ENVIRONMENT_HEADER]: environment } });
}

/** A failed step, logged by name only: never an address, code, token or credential. */
export class StepError extends Error {
  constructor(readonly step: string) {
    super(step);
  }
}

/** A database function's JSON answer (null for none), or a StepError named after it when it failed. */
export async function rpcJson<T>(environment: string, name: string, args: Record<string, unknown> = {}): Promise<T> {
  const response = await serviceRpc(environment, name, args);
  if (!response.ok) {
    await response.body?.cancel();
    throw new StepError(name);
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** An Auth endpoint called with the service role (admin calls, and verifying a code this function issued). */
export async function serviceAuth(path: string, body: unknown): Promise<{ readonly ok: boolean; readonly code?: string; readonly body: unknown }> {
  const response = await serviceFetch(`/auth/v1${path}`, { body: JSON.stringify(body) });
  const parsed = (await response.json().catch(() => null)) as { error_code?: string } | null;
  return { ok: response.ok, code: parsed?.error_code, body: parsed };
}

/** A POST's JSON body, or null when the request is no POST or its body isn't JSON (answer 400 invalid). */
export async function readJsonPost<T extends Record<string, unknown>>(request: Request): Promise<Partial<T> | null> {
  if (request.method !== 'POST') return null;
  try {
    const body: unknown = await request.json();
    return typeof body === 'object' && body !== null ? (body as Partial<T>) : null;
  } catch {
    return null;
  }
}

export function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** The request's backend environment, which every database call names. */
export const environmentOf = (request: Request): string => request.headers.get(ENVIRONMENT_HEADER) ?? '';

/**
 * The caller's address: the X-Forwarded-For hop the gateway added last. Earlier
 * hops come from the caller and could be anything. (Which hop is the client's on
 * the hosted platform is checked at launch gate 9.)
 */
export function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'unknown';
}
