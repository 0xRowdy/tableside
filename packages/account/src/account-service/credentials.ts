import { type EnvironmentName, retiredEnvironments } from '../environment';

import type { AccountServiceOptions, CredentialStorage } from './types';

export function parseJson(text: string | null): unknown {
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function removeRetiredEnvironments({ backend, credentials, vault }: AccountServiceOptions): Promise<void> {
  for (const retired of retiredEnvironments(backend.name)) {
    await removeCredentials(credentials, retired);
    await vault.removeEnvironment(retired);
  }
}

export const credentialsKey = (environment: EnvironmentName) => `tableside.${environment}.auth`;
export const statusKey = (environment: EnvironmentName) => `tableside.${environment}.status`;
export const deletedKey = (environment: EnvironmentName) => `tableside.${environment}.deleted`;

export interface DeletedMarker {
  readonly accountId?: string;
  readonly token: string | null;
}

export function parseDeleted(text: string | null): DeletedMarker | null {
  const value = parseJson(text) as { accountId?: unknown; token?: unknown } | null;
  if (!value || typeof value !== 'object') return null;
  return {
    ...(typeof value.accountId === 'string' ? { accountId: value.accountId } : {}),
    token: typeof value.token === 'string' ? value.token : null,
  };
}

export const installationSecretKey = (environment: EnvironmentName, installationId: string, accountId: string) =>
  `tableside.${environment}.${installationId}.${accountId}.device`;
const credentialsIndex = (environment: EnvironmentName) => `tableside.${environment}.credentials`;

export function namespacedCredentials(storage: CredentialStorage, environment: EnvironmentName): CredentialStorage {
  const index = credentialsIndex(environment);
  return {
    getItem: (key) => storage.getItem(key),
    async setItem(key, value) {
      const names = await readIndex(storage, index);
      if (!names.includes(key)) await storage.setItem(index, JSON.stringify([...names, key]));
      await storage.setItem(key, value);
    },
    removeItem: (key) => storage.removeItem(key),
  };
}

export async function forgetCredentials(storage: CredentialStorage, environment: EnvironmentName, matches: (name: string) => boolean): Promise<void> {
  const index = credentialsIndex(environment);
  const names = await readIndex(storage, index);
  const gone = names.filter(matches);
  for (const name of gone) await storage.removeItem(name);
  if (gone.length > 0) await storage.setItem(index, JSON.stringify(names.filter((name) => !matches(name))));
}

export async function removeCredentials(storage: CredentialStorage, environment: EnvironmentName): Promise<void> {
  const index = credentialsIndex(environment);
  for (const key of new Set([credentialsKey(environment), ...(await readIndex(storage, index))])) await storage.removeItem(key);
  await storage.removeItem(index);
}

async function readIndex(storage: CredentialStorage, index: string): Promise<string[]> {
  try {
    const names: unknown = JSON.parse((await storage.getItem(index)) ?? '[]');
    return Array.isArray(names) ? names.filter((name): name is string => typeof name === 'string') : [];
  } catch {
    return [];
  }
}
