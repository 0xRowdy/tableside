// Backend environments (spec 2 Amendment 1 A2, #39). Beta and production are
// separate Supabase projects; a build talks to exactly one, fixed when it is
// built, and names it on every request. Its credentials, keys and data on the
// device are namespaced by that environment.

/** `local` is a development stack (`pnpm stack start`). */
export type EnvironmentName = 'local' | 'beta' | 'production';
export const ENVIRONMENT_NAMES: readonly EnvironmentName[] = ['local', 'beta', 'production'];

/** The header every request to the backend carries; the server refuses a request naming another environment, or none. */
export const ENVIRONMENT_HEADER = 'x-tableside-environment';

/** The backend a build talks to. */
export interface BackendEnvironment {
  readonly name: EnvironmentName;
  readonly url: string;
  readonly publishableKey: string;
}

/**
 * The environments whose namespaces a build of this environment removes before
 * it opens an account database, restores credentials or sends work. A
 * production build may be installed over a beta one (a store-track change
 * keeps the app's data), and nothing from the beta may reach production.
 */
export function retiredEnvironments(name: EnvironmentName): readonly EnvironmentName[] {
  return name === 'production' ? ['beta'] : [];
}

/** Where Auth sends this environment's callbacks; each project allows only its own. */
export function authCallbackUrl(name: EnvironmentName): string {
  return `tableside://auth/${name}`;
}

/**
 * Reads a build's backend from its build-time settings, refusing anything
 * incomplete. Beta and production must use HTTPS; only a local build may name a
 * plain-HTTP development stack.
 */
export function backendEnvironment(settings: {
  readonly name: string | undefined;
  readonly url: string | undefined;
  readonly publishableKey: string | undefined;
}): BackendEnvironment {
  const { name, url, publishableKey } = settings;
  if (!ENVIRONMENT_NAMES.includes(name as EnvironmentName)) throw new Error(`unknown backend environment "${name ?? ''}"`);
  const environment = name as EnvironmentName;
  let parsed: URL;
  try {
    parsed = new URL(url ?? '');
  } catch {
    throw new Error(`the ${environment} backend has no valid URL`);
  }
  if (parsed.protocol !== 'https:' && !(environment === 'local' && parsed.protocol === 'http:')) {
    throw new Error(`the ${environment} backend must use HTTPS`);
  }
  if (!publishableKey) throw new Error(`the ${environment} backend has no publishable key`);
  return Object.freeze({ name: environment, url: parsed.origin, publishableKey });
}
