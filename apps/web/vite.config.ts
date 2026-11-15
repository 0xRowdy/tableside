// The web account page's build (#106). One backend per build, as for the app:
// TABLESIDE_WEB_ENVIRONMENT, TABLESIDE_WEB_SUPABASE_URL (HTTPS outside local)
// and TABLESIDE_WEB_SUPABASE_PUBLISHABLE_KEY are written into the page and its
// Content Security Policy when it is built, and nothing at run time changes
// them. `pnpm --filter @tableside/web dev` with none of them set uses this
// checkout's local stack (TABLESIDE_STACK_SLOT picks the slot).

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { backendEnvironment } from '@tableside/account/environment';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('../..', import.meta.url));

/** The running local stack's API URL and publishable key, from `supabase status`. */
function localStack(): { url: string; publishableKey: string } {
  const slot = process.env.TABLESIDE_STACK_SLOT ?? '0';
  const workdir = slot === '0' ? root : join(root, '.stacks', slot);
  let status: string;
  try {
    status = execFileSync('supabase', ['status', '-o', 'env', '--workdir', workdir], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    throw new Error(`The local Supabase stack (slot ${slot}) is not running. Start it from the repository root with \`pnpm stack start\`.`);
  }
  const value = (name: string) => new RegExp(`^${name}="(.*)"$`, 'm').exec(status)?.[1] ?? '';
  return { url: value('API_URL'), publishableKey: value('PUBLISHABLE_KEY') };
}

export default defineConfig(({ command }) => {
  const env = process.env;
  if (command === 'serve' && !env.TABLESIDE_WEB_ENVIRONMENT) {
    const stack = localStack();
    env.TABLESIDE_WEB_ENVIRONMENT = 'local';
    env.TABLESIDE_WEB_SUPABASE_URL = stack.url;
    env.TABLESIDE_WEB_SUPABASE_PUBLISHABLE_KEY = stack.publishableKey;
  }
  // Refuses an incomplete backend, or plain HTTP outside local, before anything is built.
  const backend = backendEnvironment({
    name: env.TABLESIDE_WEB_ENVIRONMENT,
    url: env.TABLESIDE_WEB_SUPABASE_URL,
    publishableKey: env.TABLESIDE_WEB_SUPABASE_PUBLISHABLE_KEY,
  });
  env.TABLESIDE_WEB_SUPABASE_URL = backend.url;
  return {
    envPrefix: 'TABLESIDE_WEB_',
    build: { outDir: 'dist', emptyOutDir: true },
  };
});
