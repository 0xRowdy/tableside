import { describe, expect, it } from 'vitest';

import { authCallbackUrl, backendEnvironment, retiredEnvironments } from './environment';

describe('a build’s backend environment', () => {
  it('is one named environment with its endpoint and publishable key, fixed for the build', () => {
    const backend = backendEnvironment({ name: 'production', url: 'https://example.supabase.co/', publishableKey: 'sb_publishable_x' });
    expect(backend).toEqual({ name: 'production', url: 'https://example.supabase.co', publishableKey: 'sb_publishable_x' });
    expect(Object.isFrozen(backend)).toBe(true);
  });

  it('refuses an unknown or missing environment, endpoint or key', () => {
    const good = { name: 'beta', url: 'https://beta.example.com', publishableKey: 'k' };
    for (const settings of [
      { ...good, name: 'staging' },
      { ...good, name: undefined },
      { ...good, url: undefined },
      { ...good, url: 'not a url' },
      { ...good, publishableKey: '' },
    ]) {
      expect(() => backendEnvironment(settings)).toThrow();
    }
  });

  it('lets only a local build use plain HTTP', () => {
    expect(backendEnvironment({ name: 'local', url: 'http://127.0.0.1:54321', publishableKey: 'k' }).url).toBe('http://127.0.0.1:54321');
    expect(() => backendEnvironment({ name: 'beta', url: 'http://beta.example.com', publishableKey: 'k' })).toThrow(/HTTPS/);
    expect(() => backendEnvironment({ name: 'production', url: 'http://example.com', publishableKey: 'k' })).toThrow(/HTTPS/);
  });
});

describe('retired environments', () => {
  it('a production build retires beta; no other build retires anything', () => {
    expect(retiredEnvironments('production')).toEqual(['beta']);
    expect(retiredEnvironments('beta')).toEqual([]);
    expect(retiredEnvironments('local')).toEqual([]);
  });
});

describe('Auth callbacks', () => {
  it('name their environment, so each project accepts only its own', () => {
    expect(authCallbackUrl('production')).toBe('tableside://auth/production');
    expect(authCallbackUrl('beta')).toBe('tableside://auth/beta');
  });
});
