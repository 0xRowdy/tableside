// Spec 2 Amendment 1 A2; #39

export type EnvironmentName = 'local' | 'beta' | 'production';
export const ENVIRONMENT_NAMES: readonly EnvironmentName[] = ['local', 'beta', 'production'];

export const ENVIRONMENT_HEADER = 'x-tableside-environment';

export interface BackendEnvironment {
  readonly name: EnvironmentName;
  readonly url: string;
  readonly publishableKey: string;
}

export function retiredEnvironments(name: EnvironmentName): readonly EnvironmentName[] {
  return name === 'production' ? ['beta'] : [];
}

export function authCallbackUrl(name: EnvironmentName): string {
  return `tableside://auth/${name}`;
}

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
