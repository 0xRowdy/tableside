import { buildBackend } from '@/account/backend';

const SETTINGS = ['EXPO_PUBLIC_TABLESIDE_ENVIRONMENT', 'EXPO_PUBLIC_TABLESIDE_SUPABASE_URL', 'EXPO_PUBLIC_TABLESIDE_SUPABASE_PUBLISHABLE_KEY'] as const;
const saved = Object.fromEntries(SETTINGS.map((name) => [name, process.env[name]]));
afterEach(() => {
  for (const name of SETTINGS) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
});

function build(environment: string | undefined, url: string | undefined, key: string | undefined) {
  const values = [environment, url, key];
  SETTINGS.forEach((name, at) => {
    if (values[at] === undefined) delete process.env[name];
    else process.env[name] = values[at];
  });
  return buildBackend();
}

describe('the build’s backend', () => {
  it('is the environment, endpoint and key the build was made with', () => {
    expect(build('production', 'https://example.supabase.co', 'sb_publishable_x')).toEqual({
      name: 'production',
      url: 'https://example.supabase.co',
      publishableKey: 'sb_publishable_x',
    });
  });

  it('refuses a build with no environment, or a beta or production build on plain HTTP', () => {
    expect(() => build(undefined, 'https://example.supabase.co', 'k')).toThrow();
    expect(() => build('beta', 'http://example.com', 'k')).toThrow(/HTTPS/);
  });
});
